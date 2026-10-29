import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { NoteAutosaver, type NoteTransport } from '../src/autosave/NoteAutosaver';
import { ApiError } from '../src/api';
import type { Note, NoteDraft } from '../src/types/notes';

const original: Note = { id: 'note-a', title: 'Tiêu đề', content: 'Nội dung cũ', pinned: false, pinnedAt: null, labels: [], version: 1, createdAt: '2026-10-29T00:00:00Z', updatedAt: '2026-10-29T00:00:00Z' };
const engines: NoteAutosaver[] = [];
afterEach(() => { for (const engine of engines.splice(0)) engine.dispose(); });

function fixture(note: Note | null = null, overrides: Partial<NoteTransport> = {}, debounceMs = 60000) {
  const database = new Map<string, Note>(note ? [[note.id, { ...note }]] : []);
  const keys = new Map<string, string>();
  const calls: { method: string; draft?: NoteDraft; version?: number; key?: string }[] = [];
  const saved: Note[] = [];
  let authenticationRequests = 0;
  const transport: NoteTransport = {
    async read(id) {
      calls.push({ method: 'GET' });
      const row = database.get(id);
      if (!row) throw new ApiError('Không tìm thấy ghi chú.', 404);
      return { ...row };
    },
    async create(draft, key) {
      calls.push({ method: 'POST', draft: { ...draft }, key });
      if (keys.has(key)) return { ...database.get(keys.get(key)!)! };
      const id = `created-${keys.size}`;
      const row = { ...original, id, ...draft };
      database.set(id, row); keys.set(key, id);
      return { ...row };
    },
    async update(base, draft) {
      calls.push({ method: 'PATCH', draft: { ...draft }, version: base.version });
      const current = database.get(base.id);
      if (!current) throw new ApiError('Không tìm thấy ghi chú.', 404);
      if (current.version !== base.version) throw new ApiError('Đã có thay đổi mới.', 409);
      const row = { ...current, ...draft, version: current.version + 1, updatedAt: new Date().toISOString() };
      database.set(row.id, row);
      return { ...row };
    },
    ...overrides,
  };
  const engine = new NoteAutosaver({ note, transport, debounceMs, onChange: () => {}, onSaved: row => saved.push(row),
    onAuthenticationRequired: () => { authenticationRequests++; } });
  engines.push(engine);
  return { engine, database, transport, calls, saved, get authenticationRequests() { return authenticationRequests; } };
}

test('empty new editors do not create notes; partial drafts wait for required fields', async () => {
  const { engine, calls } = fixture();
  assert.equal(await engine.flush(), true);
  engine.change({ title: 'Chỉ tiêu đề', content: ' ' });
  assert.equal(await engine.flush(), false);
  assert.ok(engine.state.fields.content);
  assert.equal(calls.length, 0);
});

test('a valid draft is created, normalized, then updated with the returned version', async () => {
  const { engine, calls, database } = fixture();
  engine.change({ title: '  Ý tưởng  ', content: '  Nội dung\n' });
  assert.equal(await engine.flush(), true);
  assert.equal(engine.state.status, 'saved');
  assert.equal(engine.state.draft.title, 'Ý tưởng');
  assert.equal(engine.state.draft.content, '  Nội dung\n');
  engine.change({ title: 'Ý tưởng', content: 'Sửa tiếp' });
  assert.equal(await engine.flush(), true);
  assert.deepEqual(calls.map(call => call.method), ['POST', 'PATCH']);
  assert.equal(calls[1].version, 1);
  assert.equal(database.get(engine.state.note!.id)!.content, 'Sửa tiếp');
});

test('typing while creation is pending preserves the latest draft and creates only once', async () => {
  let release!: (note: Note) => void;
  const f = fixture(null, { create: async () => new Promise<Note>(resolve => { release = resolve; }) });
  f.engine.change({ title: 'Ghi chú', content: 'Bản đầu' });
  const saving = f.engine.flush();
  f.engine.change({ title: 'Ghi chú', content: 'Bản mới nhất' });
  const created = { ...original, id: 'created', title: 'Ghi chú', content: 'Bản đầu' };
  f.database.set(created.id, created); release(created);
  assert.equal(await saving, true);
  assert.equal(f.engine.state.draft.content, 'Bản mới nhất');
  assert.equal(f.engine.state.note!.version, 2);
  assert.deepEqual(f.calls.map(call => call.method), ['PATCH']);
});

test('patches are serialized using each new version while typing continues', async () => {
  let release!: () => void;
  let first = true;
  const f = fixture(original);
  const update = f.transport.update;
  f.transport.update = async (note, draft) => {
    if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); }
    return update(note, draft);
  };
  f.engine.change({ title: original.title, content: 'A' });
  const saving = f.engine.flush();
  f.engine.change({ title: original.title, content: 'B' });
  release();
  assert.equal(await saving, true);
  assert.deepEqual(f.calls.map(call => call.version), [1, 2]);
  assert.equal(f.engine.state.note!.content, 'B');
  assert.equal(f.engine.state.note!.version, 3);
});

test('lost creation responses retry the same key before saving newer input', async () => {
  const f = fixture();
  const create = f.transport.create;
  let lost = true;
  f.transport.create = async (draft, key) => {
    const row = await create(draft, key);
    if (lost) { lost = false; throw new ApiError('Mất phản hồi.', 0); }
    return row;
  };
  f.engine.change({ title: 'Ghi chú', content: 'A' });
  assert.equal(await f.engine.flush(), false);
  assert.equal(f.engine.state.status, 'error');
  f.engine.change({ title: 'Ghi chú', content: 'B' });
  assert.equal(await f.engine.retry(), true);
  assert.equal(f.database.size, 1);
  const creates = f.calls.filter(call => call.method === 'POST');
  assert.equal(creates.length, 2);
  assert.equal(creates[0].key, creates[1].key);
  assert.equal(f.engine.state.note!.content, 'B');
});

test('a lost PATCH response is reconciled rather than causing a duplicate update', async () => {
  const f = fixture(original);
  const update = f.transport.update;
  let lost = true;
  f.transport.update = async (note, draft) => {
    const row = await update(note, draft);
    if (lost) { lost = false; throw new ApiError('Mất phản hồi.', 0); }
    return row;
  };
  f.engine.change({ title: original.title, content: 'Đã tới server' });
  assert.equal(await f.engine.flush(), false);
  assert.equal(await f.engine.retry(), true);
  assert.equal(f.calls.filter(call => call.method === 'PATCH').length, 1);
  assert.equal(f.engine.state.note!.version, 2);
  assert.equal(f.engine.state.dirty, false);
});

test('a creation replay that finds another tabs edit preserves local input as a conflict', async () => {
  const f = fixture();
  const create = f.transport.create;
  let lost = true;
  f.transport.create = async (draft, key) => {
    const row = await create(draft, key);
    if (lost) { lost = false; throw new ApiError('Mất phản hồi.', 0); }
    return row;
  };
  f.engine.change({ title: 'Ghi chú', content: 'Bản đang nhập của tôi' });
  await f.engine.flush();
  const row = [...f.database.values()][0];
  f.database.set(row.id, { ...row, content: 'Đã sửa ở tab khác', version: 2 });
  assert.equal(await f.engine.retry(), false);
  assert.equal(f.engine.state.status, 'conflict');
  assert.equal(f.engine.state.draft.content, 'Bản đang nhập của tôi');
  assert.equal(f.engine.state.remote!.content, 'Đã sửa ở tab khác');
  assert.equal(f.database.size, 1);
});

test('reverting while a save response is lost still reconciles and restores the desired text', async () => {
  const f = fixture(original);
  const update = f.transport.update;
  let lost = true;
  f.transport.update = async (note, draft) => {
    const row = await update(note, draft);
    if (lost) { lost = false; throw new ApiError('Mất phản hồi.', 0); }
    return row;
  };
  f.engine.change({ title: original.title, content: 'Thay đổi tạm' });
  await f.engine.flush();
  f.engine.change({ title: original.title, content: original.content });
  assert.equal(await f.engine.retry(), true);
  assert.equal(f.engine.state.note!.content, original.content);
  assert.equal(f.engine.state.note!.version, 3);
});

test('conflicts retain local input and cannot write again until explicitly resolved', async () => {
  const f = fixture(original);
  f.database.set(original.id, { ...original, content: 'Bản từ phiên khác', version: 2 });
  f.engine.change({ title: original.title, content: 'Bản của tôi' });
  assert.equal(await f.engine.flush(), false);
  assert.equal(f.engine.state.status, 'conflict');
  assert.equal(f.engine.state.draft.content, 'Bản của tôi');
  assert.equal(await f.engine.flush(), false);
  assert.equal(f.calls.filter(call => call.method === 'PATCH').length, 1);
  await f.engine.readRemote();
  assert.equal(f.engine.state.remote!.content, 'Bản từ phiên khác');
  f.engine.useRemote();
  assert.equal(f.engine.state.draft.content, 'Bản từ phiên khác');
  assert.equal(f.engine.state.dirty, false);
});

test('keeping local input after comparison uses the inspected remote version', async () => {
  const f = fixture(original);
  f.database.set(original.id, { ...original, content: 'Phiên khác', version: 2 });
  f.engine.change({ title: original.title, content: 'Tôi chọn giữ bản này' });
  await f.engine.flush();
  await f.engine.readRemote();
  assert.equal(await f.engine.keepLocal(), true);
  assert.deepEqual(f.calls.filter(call => call.method === 'PATCH').map(call => call.version), [1, 2]);
  assert.equal(f.engine.state.note!.version, 3);
});

test('another edit after an uncertain PATCH becomes a conflict, never an automatic overwrite', async () => {
  const f = fixture(original);
  const update = f.transport.update;
  f.transport.update = async (note, draft) => { await update(note, draft); throw new ApiError('Mất phản hồi.', 0); };
  f.engine.change({ title: original.title, content: 'Bản tôi đã gửi' });
  await f.engine.flush();
  f.database.set(original.id, { ...original, content: 'Bản mới hơn của phiên khác', version: 3 });
  assert.equal(await f.engine.retry(), false);
  assert.equal(f.engine.state.status, 'conflict');
  assert.equal(f.database.get(original.id)!.content, 'Bản mới hơn của phiên khác');
  assert.equal(f.calls.filter(call => call.method === 'PATCH').length, 1);
});

test('authentication failures preserve the draft and resume after reauthentication', async () => {
  let authenticated = false;
  const f = fixture(original);
  const update = f.transport.update;
  f.transport.update = async (note, draft) => { if (!authenticated) throw new ApiError('Phiên hết hạn.', 401); return update(note, draft); };
  f.engine.change({ title: original.title, content: 'Cần giữ lại' });
  assert.equal(await f.engine.flush(), false);
  assert.equal(f.authenticationRequests, 1);
  assert.equal(f.engine.state.draft.content, 'Cần giữ lại');
  assert.equal(await f.engine.retry(), false);
  authenticated = true;
  assert.equal(await f.engine.retry(true), true);
  assert.equal(f.engine.state.note!.content, 'Cần giữ lại');
});

test('validation errors preserve the draft and can be corrected', async () => {
  let invalid = true;
  const f = fixture(original);
  const update = f.transport.update;
  f.transport.update = async (note, draft) => {
    if (invalid) throw new ApiError('Dữ liệu sai.', 422, { title: 'Kiểm tra tiêu đề.' });
    return update(note, draft);
  };
  f.engine.change({ title: 'Tiêu đề mới', content: 'Nội dung mới' });
  await f.engine.flush();
  assert.equal(f.engine.state.fields.title, 'Kiểm tra tiêu đề.');
  invalid = false;
  f.engine.change({ title: 'Đã sửa', content: 'Nội dung mới' });
  assert.equal(await f.engine.flush(), true);
});

test('disposing a session prevents late save callbacks from reaching a new editor', async () => {
  let release!: (note: Note) => void;
  const f = fixture(null, { create: async () => new Promise<Note>(resolve => { release = resolve; }) });
  f.engine.change({ title: 'Ghi chú', content: 'Nội dung' });
  const saving = f.engine.flush();
  f.engine.dispose(); release({ ...original });
  assert.equal(await saving, false);
  assert.equal(f.saved.length, 0);
});

test('debounce automatically saves the final input without a Save action', async () => {
  const f = fixture(null, {}, 20);
  f.engine.change({ title: 'Ghi chú', content: 'A' });
  f.engine.change({ title: 'Ghi chú', content: 'B' });
  for (let i = 0; i < 100 && f.engine.state.status !== 'saved'; i++) await delay(10);
  assert.equal(f.engine.state.status, 'saved');
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(f.engine.state.note!.content, 'B');
});
