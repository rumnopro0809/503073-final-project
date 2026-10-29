import { ApiError } from '../api';
import type { Note, NoteDraft, NoteSaveStatus } from '../types/notes';

export interface NoteTransport {
  read(id: string): Promise<Note>;
  create(draft: NoteDraft, key: string): Promise<Note>;
  update(note: Note, draft: NoteDraft): Promise<Note>;
}
export interface AutosaveState {
  note: Note | null;
  draft: NoteDraft;
  status: NoteSaveStatus;
  error: string;
  fields: Partial<Record<keyof NoteDraft, string>>;
  dirty: boolean;
  saving: boolean;
  remote: Note | null;
  loadingRemote: boolean;
  authenticationRequired: boolean;
}
type Attempt = { note: Note | null; draft: NoteDraft; uncertain: boolean };
type Block = 'network' | 'auth' | 'validation' | 'conflict' | null;
const same = (a: NoteDraft, b: NoteDraft) => a.title === b.title && a.content === b.content;
const normalized = (draft: NoteDraft) => ({ title: draft.title.trim(), content: draft.content });

export class NoteAutosaver {
  private note: Note | null;
  private draft: NoteDraft;
  private status: NoteSaveStatus;
  private error = '';
  private fields: AutosaveState['fields'] = {};
  private block: Block = null;
  private pending: Attempt | null = null;
  private running: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private remote: Note | null = null;
  private loadingRemote = false;
  private readonly creationKey = crypto.randomUUID();

  constructor(private options: {
    note: Note | null; transport: NoteTransport; onChange: (state: AutosaveState) => void;
    onSaved: (note: Note) => void; onAuthenticationRequired: () => void; debounceMs?: number;
  }) {
    this.note = options.note;
    this.draft = { title: options.note?.title ?? '', content: options.note?.content ?? '' };
    this.status = options.note ? 'saved' : 'idle';
  }

  get state(): AutosaveState {
    return {
      note: this.note, draft: { ...this.draft }, status: this.status, error: this.error,
      fields: { ...this.fields }, dirty: this.hasChanges() || this.pending !== null,
      saving: this.running !== null || this.status === 'saving', remote: this.remote, loadingRemote: this.loadingRemote,
      authenticationRequired: this.block === 'auth',
    };
  }
  private hasChanges() { return this.note ? !same(this.draft, this.note) : Boolean(this.draft.title || this.draft.content); }
  private notify() { if (!this.disposed) this.options.onChange(this.state); }
  private validate() {
    const fields: AutosaveState['fields'] = {};
    if (!this.draft.title.trim() || this.draft.title.trim().length > 200) fields.title = 'Nhập tiêu đề từ 1 đến 200 ký tự để tự lưu.';
    if (!this.draft.content.trim() || this.draft.content.length > 100000) fields.content = 'Nhập nội dung từ 1 đến 100.000 ký tự để tự lưu.';
    return fields;
  }
  private cancelTimer() { clearTimeout(this.timer); this.timer = undefined; }

  change(draft: NoteDraft) {
    if (this.disposed) return;
    this.draft = { ...draft };
    this.cancelTimer();
    if (this.block === 'conflict' || this.block === 'auth') { this.notify(); return; }
    this.error = ''; this.block = null;
    this.fields = this.hasChanges() ? this.validate() : {};
    if (!this.running) this.status = this.hasChanges() || this.pending ? 'unsaved' : this.note ? 'saved' : 'idle';
    this.notify();
    if (!this.running && (this.pending || !Object.keys(this.fields).length) && (this.hasChanges() || this.pending)) {
      this.timer = setTimeout(() => { void this.flush(); }, this.options.debounceMs ?? 600);
    }
  }

  async flush(): Promise<boolean> {
    this.cancelTimer();
    if (this.disposed || this.block === 'conflict' || this.block === 'auth') return false;
    if (this.running) { await this.running; return !this.disposed && !this.state.dirty; }
    const run = this.drain();
    this.running = run;
    try { return await run; }
    finally { if (this.running === run) { this.running = null; this.notify(); } }
  }

  private async send(attempt: Attempt) {
    if (!attempt.note) return this.options.transport.create(normalized(attempt.draft), this.creationKey);
    if (attempt.uncertain) {
      // A PATCH response may be lost after the server committed it. Reconcile before retrying.
      const current = await this.options.transport.read(attempt.note.id);
      if (current.version === attempt.note.version + 1 && same(current, normalized(attempt.draft))) return current;
      if (current.version !== attempt.note.version || !same(current, attempt.note)) {
        this.remote = current;
        throw new ApiError('Ghi chú đã có thay đổi mới. Hãy đối chiếu trước khi tiếp tục.', 409);
      }
    }
    return this.options.transport.update(attempt.note, normalized(attempt.draft));
  }

  private async drain(): Promise<boolean> {
    this.block = null; this.error = '';
    while (!this.disposed && (this.hasChanges() || this.pending)) {
      if (!this.pending) {
        this.fields = this.validate();
        if (Object.keys(this.fields).length) { this.status = 'unsaved'; this.notify(); return false; }
        this.pending = { note: this.note, draft: { ...this.draft }, uncertain: false };
      }
      const attempt = this.pending;
      this.status = 'saving'; this.fields = {}; this.notify();
      let saved: Note;
      try { saved = await this.send(attempt); }
      catch (failure) {
        if (this.disposed) return false;
        const status = failure instanceof ApiError ? failure.status : 0;
        this.error = failure instanceof Error ? failure.message : 'Chưa lưu được ghi chú. Bản nháp vẫn được giữ trên trang.';
        if (status === 409) { this.block = 'conflict'; this.status = 'conflict'; this.pending = null; }
        else if (status === 401) { this.block = 'auth'; this.status = 'error'; this.pending = null; this.options.onAuthenticationRequired(); }
        else if (status === 422 || status === 404) {
          this.block = 'validation'; this.status = 'error'; this.pending = null;
          if (failure instanceof ApiError) this.fields = failure.fields;
        } else {
          this.block = 'network'; this.status = 'error'; attempt.uncertain = status === 0 || status >= 500 || status === 408;
        }
        this.notify(); return false;
      }
      if (this.disposed) return false;
      if (!attempt.note && !same(saved, normalized(attempt.draft))) {
        // A replayed creation can return a note edited by another tab in the meantime.
        // Keep local input and require comparison instead of treating that remote text as our save.
        this.note = saved; this.pending = null; this.remote = saved; this.block = 'conflict'; this.status = 'conflict';
        this.error = 'Ghi chú vừa tạo đã có thay đổi ở phiên khác. Hãy đối chiếu trước khi tiếp tục.';
        this.options.onSaved(saved); this.notify(); return false;
      }
      this.note = saved; this.pending = null; this.remote = null;
      // Update metadata without replacing text entered while the request was in flight.
      if (same(this.draft, attempt.draft)) this.draft = { title: saved.title, content: saved.content };
      this.options.onSaved(saved);
      this.status = this.hasChanges() ? 'unsaved' : 'saved'; this.notify();
    }
    if (this.disposed) return false;
    this.status = this.note ? 'saved' : 'idle'; this.fields = {}; this.error = ''; this.notify();
    return true;
  }

  async retry(authenticated = false) {
    if (this.block === 'conflict' || (this.block === 'auth' && !authenticated)) return false;
    this.block = null;
    return this.flush();
  }

  async settle() {
    this.cancelTimer();
    if (this.running) await this.running;
    return this.note;
  }

  async readRemote() {
    if (!this.note || this.disposed || this.loadingRemote) return;
    this.loadingRemote = true; this.notify();
    try {
      const remote = await this.options.transport.read(this.note.id);
      if (!this.disposed) { this.remote = remote; this.error = ''; }
    } catch (failure) {
      if (!this.disposed) this.error = failure instanceof Error ? failure.message : 'Chưa tải được phiên bản mới.';
    } finally { if (!this.disposed) { this.loadingRemote = false; this.notify(); } }
  }

  useRemote() {
    if (!this.remote || this.disposed) return;
    this.note = this.remote; this.draft = { title: this.remote.title, content: this.remote.content };
    this.pending = null; this.remote = null; this.block = null; this.error = ''; this.fields = {}; this.status = 'saved';
    this.options.onSaved(this.note); this.notify();
  }

  async keepLocal() {
    if (!this.remote || this.disposed) return false;
    // Only the explicit conflict-resolution action adopts the inspected remote version.
    this.note = this.remote; this.remote = null; this.pending = null; this.block = null; this.error = '';
    return this.flush();
  }

  dispose() { this.disposed = true; this.cancelTimer(); }
}
