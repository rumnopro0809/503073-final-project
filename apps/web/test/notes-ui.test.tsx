import { afterEach, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { Note, NotesResponse } from '../src/types/notes';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Element', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true });
}
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { render, screen, cleanup, waitFor, act, fireEvent } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { NotesWorkspace } = await import('../src/components/NotesWorkspace');
const { NoteEditor } = await import('../src/components/NoteEditor');
const { App } = await import('../src/App');
const { MemoryRouter } = await import('react-router-dom');
const originalFetch = globalThis.fetch;
const calls: { url: string; method: string; signal?: AbortSignal | null }[] = [];
let respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
let expired: number;
let isDirty: boolean;
const onExpired = () => { expired++; };
const onDirty = (value: boolean) => { isDirty = value; };
const noteA: Note = { id: 'a', title: 'Ghi chú A', content: 'Nội dung A', version: 1, createdAt: '2026-10-27T08:00:00Z', updatedAt: '2026-10-27T08:00:00Z' };
const noteB: Note = { ...noteA, id: 'b', title: 'Ghi chú B', content: 'Nội dung B' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const page = (notes: Note[], hasMore = false, offset = 0): NotesResponse => ({ notes, pagination: { limit: 50, offset, hasMore } });
const mount = () => render(<NotesWorkspace onSessionExpired={onExpired} onDirtyChange={onDirty} />);
const user = () => userEvent.setup({ document: dom.window.document });
const titleInput = () => screen.getByLabelText<HTMLInputElement>('Tiêu đề');
const contentInput = () => screen.getByLabelText<HTMLTextAreaElement>('Nội dung');

beforeEach(() => {
  calls.length = 0; expired = 0; isDirty = false;
  window.confirm = () => true;
  respond = url => url.includes('?') ? json(page([])) : json({ note: noteA });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET', signal: init?.signal });
    return respond(url, init);
  }) as typeof fetch;
});
afterEach(async () => { cleanup(); await act(async () => {}); });
after(() => { globalThis.fetch = originalFetch; dom.window.close(); });

test('an empty account shows the empty state and opens the shared editor', async () => {
  mount();
  assert.ok(await screen.findByText(/Bạn chưa có ghi chú nào\./));
  await user().click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  assert.equal(titleInput().value, '');
  assert.equal(contentInput().value, '');
  assert.ok(screen.getByText('Bản nháp mới'));
  assert.equal(document.activeElement, titleInput());
});

test('a slow request shows loading before rendering real note cards', async () => {
  let finish!: (response: Response) => void;
  respond = () => new Promise<Response>(resolve => { finish = resolve; });
  mount();
  assert.ok(screen.getByText('Đang tải ghi chú…'));
  await act(async () => { finish(json(page([noteA]))); });
  assert.ok(await screen.findByRole('button', { name: /Ghi chú A/ }));
  assert.equal(screen.queryByText('Đang tải ghi chú…'), null);
});

test('a failed list request can be retried', async () => {
  respond = () => json({ message: 'Không tải được dữ liệu.' }, 503);
  mount();
  assert.ok(await screen.findByRole('alert'));
  respond = () => json(page([noteA]));
  await user().click(screen.getByRole('button', { name: 'Thử tải lại' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú A/ }));
});

test('pagination appends the next page and removes overlapping note IDs', async () => {
  respond = url => url.includes('offset=50') ? json(page([noteA, noteB], false, 50)) : json(page([noteA], true));
  mount();
  await user().click(await screen.findByRole('button', { name: 'Tải thêm ghi chú' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú B/ }));
  assert.equal(screen.getAllByRole('button', { name: /Ghi chú A/ }).length, 1);
  assert.equal(screen.queryByRole('button', { name: 'Tải thêm ghi chú' }), null);
});

test('failure on a later page preserves existing cards and allows retry', async () => {
  let fail = true;
  respond = url => url.includes('offset=50') ? fail ? json({ message: 'Lỗi trang sau.' }, 503) : json(page([noteB], false, 50)) : json(page([noteA], true));
  mount();
  await user().click(await screen.findByRole('button', { name: 'Tải thêm ghi chú' }));
  assert.ok(await screen.findByText('Lỗi trang sau.'));
  assert.ok(screen.getByRole('button', { name: /Ghi chú A/ }));
  fail = false;
  await user().click(screen.getByRole('button', { name: 'Thử tải thêm' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú B/ }));
});

test('opening a note fetches its current content and version rather than the list snapshot', async () => {
  respond = url => url.includes('?') ? json(page([noteA])) : json({ note: { ...noteA, content: 'Phiên bản mới trên server', version: 2 } });
  mount();
  await user().click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await waitFor(() => assert.equal(contentInput().value, 'Phiên bản mới trên server'));
  assert.ok(screen.getByText('Đã lưu'));
  assert.equal(isDirty, false);
  assert.ok(calls.some(call => call.url === '/api/notes/a'));
});

test('typing a draft marks it unsaved and does not pretend to save or send POST/PATCH', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Ý tưởng mới');
  await actor.type(contentInput(), 'Nội dung chưa lưu');
  assert.ok(screen.getByText('Bản nháp chưa lưu'));
  assert.equal(isDirty, true);
  assert.equal(screen.queryByRole('button', { name: /^(Save|Lưu)$/ }), null);
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('closing a dirty editor respects the discard decision', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Giữ bản nháp');
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: 'Đóng trình soạn ghi chú' }));
  assert.equal(titleInput().value, 'Giữ bản nháp');
  window.confirm = () => true;
  await actor.click(screen.getByRole('button', { name: 'Đóng trình soạn ghi chú' }));
  assert.equal(screen.queryByLabelText('Tiêu đề'), null);
  assert.equal(isDirty, false);
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'Ghi chú mới' }));
});

test('declining to discard a draft prevents navigation to another note', async () => {
  respond = url => url.includes('?') ? json(page([noteA, noteB])) : json({ note: url.endsWith('/b') ? noteB : noteA });
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await waitFor(() => assert.equal(titleInput().value, noteA.title));
  await actor.type(contentInput(), ' thêm bản nháp');
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: /Ghi chú B/ }));
  assert.equal(calls.some(call => call.url.endsWith('/b')), false);
  assert.equal(contentInput().value, `${noteA.content} thêm bản nháp`);
});

test('a late response from a previously selected note cannot overwrite the current editor', async () => {
  let finishA!: (response: Response) => void;
  respond = url => url.includes('?') ? json(page([noteA, noteB]))
    : url.endsWith('/a') ? new Promise<Response>(resolve => { finishA = resolve; }) : json({ note: noteB });
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await actor.click(screen.getByRole('button', { name: /Ghi chú B/ }));
  await waitFor(() => assert.equal(titleInput().value, noteB.title));
  await act(async () => { finishA(json({ note: noteA })); });
  assert.equal(titleInput().value, noteB.title);
  assert.equal(calls.find(call => call.url.endsWith('/a'))!.signal?.aborted, true);
});

test('refreshing the list never replaces the current unsaved draft', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(contentInput(), 'Còn trên trang');
  respond = () => json(page([noteA]));
  await actor.click(screen.getByRole('button', { name: 'Tải lại' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú A/ }));
  assert.equal(contentInput().value, 'Còn trên trang');
});

test('session expiry is reported to the parent', async () => {
  respond = () => json({ message: 'Phiên đã hết hạn.' }, 401);
  mount();
  await waitFor(() => assert.equal(expired, 1));
  assert.equal(screen.queryByRole('button', { name: /Ghi chú A/ }), null);
});

test('dirty drafts install the before-unload warning and clean editors remove it', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Chưa lưu');
  const first = new window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(first);
  assert.equal(first.defaultPrevented, true);
  await actor.click(screen.getByRole('button', { name: 'Đóng trình soạn ghi chú' }));
  const second = new window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(second);
  assert.equal(second.defaultPrevented, false);
});

test('the shared editor accepts autosave status and field errors from the future hook', () => {
  render(<NoteEditor draft={{ title: 'Ghi chú', content: 'Nội dung' }} isNew={false}
    onChange={() => {}} onClose={() => {}} saveStatus="conflict" saveError="Cần xử lý thay đổi mới."
    fieldErrors={{ title: 'Tiêu đề cần kiểm tra.' }} />);
  assert.ok(screen.getByText('Có thay đổi từ phiên khác'));
  assert.ok(screen.getByRole('alert'));
  assert.equal(titleInput().getAttribute('aria-invalid'), 'true');
  assert.equal(titleInput().maxLength, 200);
  assert.equal(contentInput().maxLength, 100000);
});

test('a session refresh does not refetch the list or erase a draft; logout asks before discarding', async () => {
  const account = { id: 'user-a', email: 'student@example.test', displayName: 'Sinh viên', emailVerified: true };
  respond = url => url === '/api/auth/me' ? json({ user: { ...account } }) : url === '/api/auth/logout' ? new Response(null, { status: 204 }) : json(page([]));
  render(<MemoryRouter><App /></MemoryRouter>);
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Không mất sau khi chuyển tab');
  const listRequests = calls.filter(call => call.url.startsWith('/api/notes?')).length;
  await act(async () => { fireEvent(window, new window.Event('focus')); });
  assert.equal(calls.filter(call => call.url.startsWith('/api/notes?')).length, listRequests);
  assert.equal(titleInput().value, 'Không mất sau khi chuyển tab');
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: 'Đăng xuất' }));
  assert.equal(calls.some(call => call.url === '/api/auth/logout'), false);
  assert.equal(titleInput().value, 'Không mất sau khi chuyển tab');
});
