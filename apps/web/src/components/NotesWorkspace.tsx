import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Plus, RefreshCw, StickyNote } from 'lucide-react';
import { api, ApiError } from '../api';
import type { Note, NoteDraft, NotesResponse } from '../types/notes';
import { NoteEditor } from './NoteEditor';

type EditorSession = { note: Note | null; draft: NoteDraft };
interface Props { onSessionExpired: () => void; onDirtyChange: (dirty: boolean) => void; }
const PAGE_SIZE = 50;
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Không tải được ghi chú. Vui lòng thử lại.';

export function NotesWorkspace({ onSessionExpired, onDirtyChange }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [pagination, setPagination] = useState<NotesResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const listGeneration = useRef(0);
  const moreBusy = useRef(false);
  const moreController = useRef<AbortController | null>(null);
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const detailGeneration = useRef(0);
  const detailController = useRef<AbortController | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);

  const dirty = editor !== null && (editor.note === null
    ? Boolean(editor.draft.title || editor.draft.content)
    : editor.draft.title !== editor.note.title || editor.draft.content !== editor.note.content);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const generation = ++listGeneration.current;
    const controller = new AbortController();
    moreController.current?.abort();
    moreBusy.current = false;
    setLoadingMore(false); setMoreError(''); setLoading(true); setError('');
    api<NotesResponse>(`/notes?limit=${PAGE_SIZE}&offset=0`, undefined, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted || generation !== listGeneration.current) return;
        setNotes(result.notes); setPagination(result.pagination);
      })
      .catch(failure => {
        if (controller.signal.aborted || generation !== listGeneration.current) return;
        if (failure instanceof ApiError && failure.status === 401) { onSessionExpired(); return; }
        setError(messageOf(failure));
      })
      .finally(() => { if (!controller.signal.aborted && generation === listGeneration.current) setLoading(false); });
    return () => { controller.abort(); moreController.current?.abort(); };
  }, [reload, onSessionExpired]);

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
        return [...current, ...result.notes.filter(note => !existing.has(note.id))];
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

  function canLeaveDraft() {
    return !dirty || window.confirm('Bản nháp chưa được lưu. Bạn có muốn bỏ thay đổi để tiếp tục?');
  }
  function cancelOpening() {
    detailController.current?.abort(); detailGeneration.current++; setOpeningId(null);
  }
  function openNew() {
    if (!canLeaveDraft()) return;
    cancelOpening(); setEditorError(''); setEditor({ note: null, draft: { title: '', content: '' } });
  }
  function closeEditor() {
    if (!canLeaveDraft()) return;
    cancelOpening(); setEditor(null); setEditorError(''); newButton.current?.focus();
  }
  function changeDraft(draft: NoteDraft) {
    // Typing while another note is loading cancels that navigation, preserving the current draft.
    cancelOpening();
    setEditor(current => current ? { ...current, draft } : current);
  }
  async function openNote(note: Note) {
    if (editor?.note?.id === note.id && !openingId) return;
    if (!canLeaveDraft()) return;
    cancelOpening();
    const generation = detailGeneration.current;
    const controller = new AbortController();
    detailController.current = controller;
    setOpeningId(note.id); setEditorError('');
    try {
      const result = await api<{ note: Note }>(`/notes/${note.id}`, undefined, { signal: controller.signal });
      if (controller.signal.aborted || generation !== detailGeneration.current) return;
      setEditor({ note: result.note, draft: { title: result.note.title, content: result.note.content } });
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
        <button type="button" className="quiet-button" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={16} /> Tải lại</button>
        <button ref={newButton} type="button" className="primary-button new-note-button" onClick={openNew}><Plus size={17} /> Ghi chú mới</button>
      </div>
    </div>
    {editorError && <div className="notice error" role="alert">{editorError}</div>}
    {openingId && <p className="notes-loading" role="status"><LoaderCircle className="spin" size={17} /> Đang mở ghi chú…</p>}
    {editor && <NoteEditor key={editor.note?.id ?? 'new'} draft={editor.draft} isNew={editor.note === null}
      onChange={changeDraft} onClose={closeEditor}
      saveStatus={dirty ? 'unsaved' : editor.note ? 'saved' : 'idle'} />}
    {loading ? <p className="notes-loading" role="status"><LoaderCircle className="spin" size={19} /> Đang tải ghi chú…</p>
      : error ? <div className="notes-load-error"><p className="notice error" role="alert">{error}</p><button type="button" className="quiet-button" onClick={() => setReload(value => value + 1)}>Thử tải lại</button></div>
      : notes.length === 0 ? <div className="empty-notes"><div className="empty-illustration"><StickyNote size={46} strokeWidth={1.1} /><span className="empty-spark">✳</span></div><h2>Mọi ý tưởng đều có điểm bắt đầu.</h2><p>Bạn chưa có ghi chú nào.<br />Bắt đầu bằng nút Ghi chú mới ở phía trên.</p></div>
      : <div className="notes-grid" aria-label="Danh sách ghi chú">
        {notes.map(note => <button type="button" className={`note-card ${editor?.note?.id === note.id ? 'selected' : ''}`} key={note.id}
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
