import { ApiError, type api } from './api';
import type { Note, Label } from './types/notes';
import { isCompleted, priority, inCategory, type NoteCategory } from './reminders';

export const GUEST_KEY = 'ghichu.guest.v1';
type Store = { version: 1; notes: Note[]; labels: Label[]; keys: Record<string, string> };
const colors = ['#8b6bb1', '#3c8270', '#b47c35', '#b75d78', '#527db5', '#737784'];
const fail = (message: string, status = 422): never => { throw new ApiError(message, status); };

// One document write makes changes to notes and labels succeed or fail together.
// Web Locks serialize read/check/write across tabs of this browser and origin.
export function createLocalApi(storage: Pick<Storage, 'getItem' | 'setItem'>): typeof api {
  return async <T>(url: string, body?: unknown, options: Parameters<typeof api>[2] = {}): Promise<T> => {
    const execute = () => {
      if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      let store: Store;
      try {
        const raw = storage.getItem(GUEST_KEY);
        store = raw ? JSON.parse(raw) : { version: 1, notes: [], labels: [], keys: {} };
        if (store.version !== 1 || !Array.isArray(store.notes) || !Array.isArray(store.labels) || !store.keys) throw new Error();
      } catch { return fail('Không đọc được dữ liệu cục bộ. Dữ liệu cũ được giữ nguyên; kiểm tra quyền lưu trữ của trình duyệt.', 0); }
      const parsed = new URL(url, 'http://local');
      const parts = parsed.pathname.split('/').filter(Boolean);
      const method = options.method ?? (body === undefined ? 'GET' : 'POST');
      const input = (body ?? {}) as Record<string, unknown>;
      const now = new Date().toISOString();
      const hydrate = (note: Note): Note => ({ ...note, completed: isCompleted(note), labels: note.labels.flatMap(label => store.labels.find(item => item.id === label.id) ?? []) });
      const sortNotes = (notes: Note[]) => notes.sort((a,b) => Number(b.pinned) - Number(a.pinned)
        || (a.pinned && b.pinned ? Date.parse(b.pinnedAt!) - Date.parse(a.pinnedAt!) : 0)
        || priority(a) - priority(b)
        || (priority(a) <= 1 ? Date.parse(a.dueAt!) - Date.parse(b.dueAt!) : 0)
        || (parsed.searchParams.get('sort') === 'title' ? a.title.toLowerCase().localeCompare(b.title.toLowerCase())
          : Date.parse(parsed.searchParams.get('sort') === 'created' ? b.createdAt : b.updatedAt) - Date.parse(parsed.searchParams.get('sort') === 'created' ? a.createdAt : a.updatedAt))
        || b.id.localeCompare(a.id));
      let result: unknown;
      if (parts[0] === 'notes') {
        if (method === 'GET' && (!parts[1] || parts[1] === 'reminders')) {
          const q = (parsed.searchParams.get('q') ?? '').trim().toLowerCase();
          let notes = sortNotes(store.notes.map(hydrate).filter(note =>
            inCategory(note, (parsed.searchParams.get('category') ?? 'all') as NoteCategory)
            &&
            (!q || note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q))
            && (parsed.searchParams.get('pinned') !== 'true' || note.pinned)
            && (!parsed.searchParams.get('labelId') || note.labels.some(label => label.id === parsed.searchParams.get('labelId')))));
          if (parts[1] === 'reminders') return { notes: notes.filter(note => !isCompleted(note) && note.dueAt && Date.parse(note.dueAt) <= Date.now() + 86400000).slice(0,100) } as T;
          const limit = Number(parsed.searchParams.get('limit') ?? 50), offset = Number(parsed.searchParams.get('offset') ?? 0);
          return { notes: notes.slice(offset, offset + limit), pagination: { limit, offset, hasMore: notes.length > offset + limit } } as T;
        }
        if (method === 'POST' && !parts[1]) {
          const previous = options.idempotencyKey && store.keys[options.idempotencyKey];
          if (previous) { const note = store.notes.find(note => note.id === previous); if (note) return { note: hydrate(note) } as T; }
          if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200 || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 100000) return fail('Nhập tiêu đề và nội dung hợp lệ.');
          const note: Note = { id: crypto.randomUUID(), title: input.title.trim(), content: input.content, version: 1, labels: [], pinned: false, pinnedAt: null, dueAt: null, completedAt: null, completed: false, important: false, daily: false, createdAt: now, updatedAt: now };
          store.notes.push(note);
          if (options.idempotencyKey) store.keys[options.idempotencyKey] = note.id;
          result = { note };
        } else {
          const note = store.notes.find(note => note.id === parts[1]);
          if (!note) return fail('Không tìm thấy ghi chú cục bộ.', 404);
          if (method === 'GET') return { note: hydrate(note) } as T;
          if (method === 'DELETE') {
            store.notes = store.notes.filter(item => item.id !== note.id);
            store.keys = Object.fromEntries(Object.entries(store.keys).filter(([,id]) => id !== note.id));
          } else {
            if (input.version !== note.version) return fail('Ghi chú đã thay đổi ở tab khác. Hãy đối chiếu trước khi lưu.', 409);
            if (parts[2] === 'organization') {
              if ('pinned' in input) { note.pinned = Boolean(input.pinned); note.pinnedAt = note.pinned ? note.pinnedAt ?? now : null; }
              if (Array.isArray(input.labelIds)) {
                if (input.labelIds.length > 20 || input.labelIds.some(id => !store.labels.some(label => label.id === id))) return fail('Chọn tối đa 20 nhãn còn tồn tại.');
                note.labels = store.labels.filter(label => (input.labelIds as unknown[]).includes(label.id));
              }
            } else if (parts[2] === 'reminder') {
              if ('dueAt' in input && input.dueAt !== null && (typeof input.dueAt !== 'string' || !Number.isFinite(Date.parse(input.dueAt)))) return fail('Thời gian không hợp lệ.');
              for (const key of ['important','daily','completed']) if (key in input && typeof input[key] !== 'boolean') return fail('Trạng thái không hợp lệ.');
              if ('dueAt' in input) note.dueAt = input.dueAt as string | null;
              if ('daily' in input) note.daily = input.daily as boolean;
              if (note.daily && note.dueAt) return fail('Việc hằng ngày không dùng hạn một lần.');
              if ('important' in input) note.important = input.important as boolean;
              if ('completed' in input) { note.completed = input.completed as boolean; note.completedAt = note.completed ? now : null; }
            } else {
              if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200 || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 100000) return fail('Nhập tiêu đề và nội dung hợp lệ.');
              note.title = input.title.trim(); note.content = input.content;
            }
            note.version++; note.updatedAt = now; result = { note: hydrate(note) };
          }
        }
      } else if (parts[0] === 'labels') {
        if (method === 'GET') return { labels: store.labels } as T;
        const label = store.labels.find(label => label.id === parts[1]);
        if (parts[1] && !label) return fail('Không tìm thấy nhãn.',404);
        if (method === 'DELETE') {
          store.labels = store.labels.filter(item => item.id !== parts[1]);
        } else {
          const name = typeof input.name === 'string' ? input.name.trim() : '';
          if (!name || name.length > 40 || !colors.includes(String(input.color))) return fail('Tên hoặc màu nhãn không hợp lệ.');
          if (store.labels.some(item => item.id !== parts[1] && item.name.toLowerCase() === name.toLowerCase())) return fail('Bạn đã có nhãn với tên này.',409);
          const updated = { id: label?.id ?? crypto.randomUUID(), name, color: String(input.color) };
          if (label) Object.assign(label, updated); else store.labels.push(updated);
          result = { label: updated };
        }
        if (label) for (const note of store.notes.filter(note => note.labels.some(item => item.id === label.id))) {
          note.labels = note.labels.flatMap(item => store.labels.find(existing => existing.id === item.id) ?? []);
          note.version++; note.updatedAt = now;
        }
      } else return fail('Không hỗ trợ thao tác này.',404);
      try { storage.setItem(GUEST_KEY, JSON.stringify(store)); }
      catch { return fail('Chưa lưu được trên máy: bộ nhớ đầy hoặc bị chặn. Bản nháp vẫn được giữ trên trang.',0); }
      return result as T;
    };
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(GUEST_KEY, execute) : execute();
  };
}
export const localApi: typeof api = (...args) => {
  try { return createLocalApi(window.localStorage)(...args); }
  catch { return Promise.reject(new ApiError('Trình duyệt đang chặn lưu trữ cục bộ.',0)); }
};
