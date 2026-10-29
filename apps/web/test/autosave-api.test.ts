import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../api/src/app.js';
import { migrate, openDatabase } from '../../api/src/database.js';
import { NoteAutosaver, type NoteTransport } from '../src/autosave/NoteAutosaver';
import { ApiError } from '../src/api';

test('the autosave engine creates and edits through the real notes API and can reopen persisted content', async () => {
  const db = await openDatabase();
  let engine: NoteAutosaver | undefined;
  try {
    await migrate(db);
    const app = createApp({ db, appUrl: 'http://localhost:5173', production: false, rateLimit: false, sendVerification: async () => {} });
    const headers = { 'X-Requested-With': 'GhiChu', Origin: 'http://localhost:5173' };
    const registered = await request(app).post('/api/auth/register').set(headers)
      .send({ email: 'autosave-demo@example.test', displayName: 'Demo', password: 'Demo password 2026!', confirmPassword: 'Demo password 2026!' });
    assert.equal(registered.status, 201);
    const cookie = (registered.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const result = (response: request.Response) => {
      if (response.status >= 400) throw new ApiError(response.body.message, response.status, response.body.fields);
      return response.body.note;
    };
    const transport: NoteTransport = {
      read: async id => result(await request(app).get(`/api/notes/${id}`).set('Cookie', cookie)),
      create: async (draft, key) => result(await request(app).post('/api/notes').set(headers).set('Cookie', cookie).set('Idempotency-Key', key).send(draft)),
      update: async (note, draft) => result(await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie', cookie).send({ ...draft, version: note.version })),
    };
    engine = new NoteAutosaver({ note: null, transport, onChange: () => {}, onSaved: () => {}, onAuthenticationRequired: () => {}, debounceMs: 60000 });
    engine.change({ title: 'Demo ngày 31 tháng 10', content: 'Tạo qua cơ chế tự lưu.' });
    assert.equal(await engine.flush(), true);
    const id = engine.state.note!.id;
    assert.equal(engine.state.status, 'saved');
    engine.change({ title: 'Demo ngày 31 tháng 10', content: 'Sửa tiếp và tự lưu đúng phiên bản.' });
    assert.equal(await engine.flush(), true);
    assert.equal(engine.state.note!.version, 2);
    engine.dispose();
    const persisted = await transport.read(id);
    engine = new NoteAutosaver({ note: persisted, transport, onChange: () => {}, onSaved: () => {}, onAuthenticationRequired: () => {} });
    assert.equal(engine.state.draft.content, 'Sửa tiếp và tự lưu đúng phiên bản.');
    assert.equal(engine.state.dirty, false);
    assert.equal((await db.query('SELECT id FROM notes')).rows.length, 1);
  } finally { engine?.dispose(); await db.close(); }
});
