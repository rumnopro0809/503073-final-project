import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Grid2X2, List, LoaderCircle, Plus, RefreshCw, StickyNote } from 'lucide-react';
import { api, ApiError } from '../api';
import type { Note, NoteDraft, NotesResponse } from '../types/notes';
import { NoteEditor } from './NoteEditor';
import { useNoteAutosave } from '../hooks/useNoteAutosave';
import { notesApi } from '../notesApi';

interface Props {
  onSessionExpired: () => void; onDirtyChange: (dirty: boolean) => void;
  authenticationRevision?: number; beforeLeaveRef?: MutableRefObject<(() => Promise<boolean>) | null>;
}
const PAGE_SIZE = 50;
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Không tải được ghi chú. Vui lòng thử lại.';
function mergeNotes(...groups: Note[][]) {
  const map = new Map<string, Note>();
  for (const note of groups.flat()) {
    if (!map.has(note.id) || map.get(note.id)!.version <= note.version) map.set(note.id, note);
  }
  return [...map.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id.localeCompare(a.id));
}

export function NotesWorkspace({ onSessionExpired, onDirtyChange, authenticationRevision = 0, beforeLeaveRef }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [pagination, setPagination] = useState<NotesResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const listGeneration = useRef(0);
  const moreBusy = useRef(false);
  const moreController = useRef<AbortController | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const navigating = useRef(false);
  const saveRevision = useRef(0);
  const removedIds = useRef(new Set<string>());
  const recentSaves = useRef(new Map<string, { note: Note; revision: number }>());
  const onSaved = useCallback((note: Note) => {
    if (removedIds.current.has(note.id)) return;
    recentSaves.current.set(note.id, { note, revision: ++saveRevision.current });
    setNotes(current => mergeNotes(current, [note]));
  }, []);
  const autosave = useNoteAutosave({ onSaved, onAuthenticationRequired: onSessionExpired, authenticationRevision });
  const editor = autosave.state;
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const detailGeneration = useRef(0);
  const detailController = useRef<AbortController | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const restoreNewFocus = useRef(false);
  useEffect(() => {
    if (!editor && !navigationBusy && restoreNewFocus.current) {
      restoreNewFocus.current = false; newButton.current?.focus();
    }
  }, [editor, navigationBusy]);

  const dirty = Boolean(editor?.dirty || editor?.saving);
  const prepareToLeave = useCallback(async () => {
    if (navigating.current) return false;
    navigating.current = true; setNavigationBusy(true);
    try {
      if (await autosave.flush()) return true;
      if (autosave.getState()?.authenticationRequired) return false;
      return window.confirm('Chưa lưu được toàn bộ thay đổi. Bản nháp sẽ bị bỏ nếu tiếp tục. Bạn có muốn tiếp tục?');
    } finally { navigating.current = false; setNavigationBusy(false); }
  }, [autosave.flush, autosave.getState]);
  useEffect(() => {
    if (beforeLeaveRef) beforeLeaveRef.current = prepareToLeave;
    return () => { if (beforeLeaveRef) beforeLeaveRef.current = null; };
  }, [beforeLeaveRef, prepareToLeave]);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const generation = ++listGeneration.current;
    const revision = saveRevision.current;
    const controller = new AbortController();
    moreController.current?.abort();
    moreBusy.current = false;
    setLoadingMore(false); setMoreError(''); setLoading(true); setError('');
    api<NotesResponse>(`/notes?limit=${PAGE_SIZE}&offset=0`, undefined, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted || generation !== listGeneration.current) return;
        const savedSinceRequest = [...recentSaves.current.values()].filter(entry => entry.revision > revision).map(entry => entry.note);
        setNotes(mergeNotes(result.notes, savedSinceRequest).filter(note => !removedIds.current.has(note.id))); setPagination(result.pagination);
      })
      .catch(failure => {
        if (controller.signal.aborted || generation !== listGeneration.current) return;
        if (failure instanceof ApiError && failure.status === 401) { onSessionExpired(); return; }
        setError(messageOf(failure));
      })
      .finally(() => { if (!controller.signal.aborted && generation === listGeneration.current) setLoading(false); });
    return () => { controller.abort(); moreController.current?.abort(); };
  }, [reload, onSessionExpired, authenticationRevision]);

  useEffect(() => () => { detailController.current?.abort(); detailGeneration.current++; }, []);

  async function loadMore() {
    if (!pagination?.hasMore || moreBusy.current || loading) return;
    moreBusy.current = true; setLoadingMore(true); setMoreError('');
    const generation = listGeneration.current;
    const controller = new AbortController();
    moreController.current = controller;
    try {
      const result = await api<NotesResponse>(`/notes?limit=${PAGE_SIZE}&offset=${pagination.offset + pagination.limit}`, undefined, { signal: controller.signal });
      if (controller.signal.aborted || generation !== listGeneration.current) return;
      setNotes(current => {
        const existing = new Set(current.map(note => note.id));
        return [...current, ...result.notes.filter(note => !existing.has(note.id) && !removedIds.current.has(note.id))];
      });
      setPagination(result.pagination);
    } catch (failure) {
      if (controller.signal.aborted || generation !== listGeneration.current) return;
      if (failure instanceof ApiError && failure.status === 401) { onSessionExpired(); return; }
      setMoreError(messageOf(failure));
    } finally {
      if (!controller.signal.aborted && generation === listGeneration.current) { moreBusy.current = false; setLoadingMore(false); }
    }
  }

  function cancelOpening() {
    detailController.current?.abort(); detailGeneration.current++; setOpeningId(null);
  }
  async function openNew() {
    if (!await prepareToLeave()) return;
    cancelOpening(); setEditorError(''); setEditorKey(value => value + 1); autosave.open(null);
  }
  async function closeEditor() {
    if (!await prepareToLeave()) return;
    cancelOpening(); restoreNewFocus.current = true; autosave.close(); setEditorError('');
  }
  function changeDraft(draft: NoteDraft) {
    // Typing while another note is loading cancels that navigation, preserving the current draft.
    cancelOpening();
    autosave.change(draft);
  }
  async function deleteNote() {
    if (navigating.current || !editor?.note) return;
    if (!window.confirm(`Xóa vĩnh viễn ghi chú “${editor.note.title}”?`)) return;
    navigating.current = true; setNavigationBusy(true); setEditorError('');
    try {
      await autosave.settle();
      if (autosave.getState()?.authenticationRequired) return;
      const id = autosave.getState()?.note?.id;
      if (!id) return;
      try { await notesApi.remove(id); }
      catch (failure) { if (!(failure instanceof ApiError && failure.status === 404)) throw failure; }
      removedIds.current.add(id); recentSaves.current.delete(id);
      setNotes(current => current.filter(note => note.id !== id));
      restoreNewFocus.current = true; autosave.close(); cancelOpening();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
      setEditorError(messageOf(failure));
    } finally { navigating.current = false; setNavigationBusy(false); }
  }
  async function openNote(note: Note) {
    if (editor?.note?.id === note.id && !openingId) return;
    if (!await prepareToLeave()) return;
    cancelOpening();
    const generation = detailGeneration.current;
    const controller = new AbortController();
    detailController.current = controller;
    setOpeningId(note.id); setEditorError('');
    try {
      const result = await api<{ note: Note }>(`/notes/${note.id}`, undefined, { signal: controller.signal });
      if (controller.signal.aborted || generation !== detailGeneration.current) return;
      setEditorKey(value => value + 1); autosave.open(result.note);
    } catch (failure) {
      if (controller.signal.aborted || generation !== detailGeneration.current) return;
      if (failure instanceof ApiError && failure.status === 401) { onSessionExpired(); return; }
      setEditorError(messageOf(failure));
    } finally {
      if (!controller.signal.aborted && generation === detailGeneration.current) setOpeningId(null);
    }
  }

  return <section className="notes-workspace" aria-label="Không gian ghi chú">
    <div className="notes-toolbar">
      <div><h2>Những điều muốn nhớ</h2><p>{loading ? 'Đang mở ghi chú của bạn…' : error ? 'Chưa thể tải danh sách ghi chú.' : `${notes.length} ghi chú đã tải${pagination?.hasMore ? ' · còn ghi chú khác' : ''}`}</p></div>
      <div className="notes-actions">
        <div className="note-view-switch" role="group" aria-label="Kiểu hiển thị ghi chú">
          <button className="icon-button" type="button" aria-label="Xem dạng lưới" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={17} /></button>
          <button className="icon-button" type="button" aria-label="Xem dạng danh sách" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} /></button>
        </div>
        <button type="button" className="quiet-button" onClick={() => setReload(value => value + 1)} disabled={loading || navigationBusy}><RefreshCw size={16} /> Tải lại</button>
        <button ref={newButton} type="button" className="primary-button new-note-button" disabled={navigationBusy} onClick={() => void openNew()}><Plus size={17} /> Ghi chú mới</button>
      </div>
    </div>
    {editorError && <div className="notice error" role="alert">{editorError}</div>}
    {openingId && <p className="notes-loading" role="status"><LoaderCircle className="spin" size={17} /> Đang mở ghi chú…</p>}
    {editor && <NoteEditor key={editorKey} draft={editor.draft} isNew={editor.note === null}
      onChange={changeDraft} onClose={() => void closeEditor()} disabled={navigationBusy}
      saveStatus={editor.status} saveError={editor.error} fieldErrors={editor.fields}
      onRetry={() => void autosave.retry()} onDelete={() => void deleteNote()} />}
    {editor?.status === 'conflict' && <section className="note-conflict" aria-label="Đối chiếu thay đổi">
      <h3>Ghi chú đã được sửa ở một phiên khác</h3>
      <p>Nội dung đang nhập của bạn vẫn được giữ. Đọc bản mới trước khi chọn cách tiếp tục.</p>
      <button className="quiet-button" type="button" disabled={editor.loadingRemote} onClick={() => void autosave.readRemote()}>{editor.loadingRemote ? 'Đang tải bản mới…' : 'Đọc bản mới trên máy chủ'}</button>
      {editor.remote && <>
        <div className="remote-note"><strong>{editor.remote.title}</strong><p>{editor.remote.content}</p></div>
        <div className="notes-actions">
          <button className="quiet-button" type="button" onClick={() => {
            if (window.confirm('Thay bản đang nhập bằng bản trên máy chủ? Nội dung chưa lưu của bạn sẽ bị bỏ.')) autosave.useRemote();
          }}>Dùng bản trên máy chủ</button>
          <button className="quiet-button" type="button" onClick={() => {
            if (window.confirm('Tiếp tục tự lưu nội dung đang nhập của bạn để thay cho bản vừa đối chiếu?')) void autosave.keepLocal();
          }}>Tiếp tục với nội dung đang nhập</button>
        </div>
      </>}
    </section>}
    {loading ? <p className="notes-loading" role="status"><LoaderCircle className="spin" size={19} /> Đang tải ghi chú…</p>
      : error ? <div className="notes-load-error"><p className="notice error" role="alert">{error}</p><button type="button" className="quiet-button" onClick={() => setReload(value => value + 1)}>Thử tải lại</button></div>
      : notes.length === 0 ? <div className="empty-notes"><div className="empty-illustration"><StickyNote size={46} strokeWidth={1.1} /><span className="empty-spark">✳</span></div><h2>Mọi ý tưởng đều có điểm bắt đầu.</h2><p>Bạn chưa có ghi chú nào.<br />Bắt đầu bằng nút Ghi chú mới ở phía trên.</p></div>
      : <div className={`notes-grid ${view === 'list' ? 'view-list' : ''}`} aria-label="Danh sách ghi chú">
        {notes.map(note => <button type="button" disabled={navigationBusy} className={`note-card ${editor?.note?.id === note.id ? 'selected' : ''}`} key={note.id}
          onClick={() => void openNote(note)} aria-pressed={editor?.note?.id === note.id}>
          <span className="note-card-corner"><StickyNote size={16} /></span>
          <h3>{note.title}</h3><p>{note.content}</p>
          <time dateTime={note.updatedAt}>Sửa {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(note.updatedAt))}</time>
        </button>)}
      </div>}
    {!loading && !error && pagination?.hasMore && <div className="notes-pagination">
      {moreError && <p className="notice error" role="alert">{moreError}</p>}
      <button type="button" className="quiet-button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Đang tải thêm…' : moreError ? 'Thử tải thêm' : 'Tải thêm ghi chú'}</button>
    </div>}
  </section>;
}
