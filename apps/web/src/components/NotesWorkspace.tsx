import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Grid2X2, List, LoaderCircle, Pin, Plus, RefreshCw, Search, StickyNote, Tag, X } from 'lucide-react';
import { api as serverApi, ApiError } from '../api';
import type { Label, Note, NoteDraft, NoteSort, NotesResponse } from '../types/notes';
import { NoteEditor } from './NoteEditor';
import { useNoteAutosave } from '../hooks/useNoteAutosave';
import { createNoteServices } from '../notesApi';
import { localApi, GUEST_KEY } from '../localNotes';
import { LabelManager, type LabelAction } from './LabelManager';
import { NoteOrganization } from './NoteOrganization';
import { NoteReminder, type ReminderChanges } from './NoteReminder';
import { priority, taskState, taskLabel, formatDue, isCompleted } from '../reminders';
import { useEntrance } from '../hooks/useEntrance';
import { useCardLayout } from '../hooks/useCardLayout';
import { ImportantBadge, LabelChip } from './LabelChip';

interface Props {
  guest?: boolean;
  onSessionExpired: () => void; onDirtyChange: (dirty: boolean) => void;
  authenticationRevision?: number; beforeLeaveRef?: MutableRefObject<(() => Promise<boolean>) | null>;
}
const PAGE_SIZE = 50;
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Không tải được ghi chú. Vui lòng thử lại.';
type Filters = { q: string; pinned: boolean; labelId: string; sort: NoteSort };
function matches(note: Note, filters: Filters) {
  const text = filters.q.toLowerCase();
  return (!filters.pinned || note.pinned)
    && (!filters.labelId || (note.labels ?? []).some(label => label.id === filters.labelId))
    && (!text || note.title.toLowerCase().includes(text) || note.content.toLowerCase().includes(text));
}
function mergeNotes(filters: Filters, ...groups: Note[][]) {
  const map = new Map<string, Note>();
  for (const note of groups.flat()) {
    if (!map.has(note.id) || map.get(note.id)!.version <= note.version) map.set(note.id, note);
  }
  return [...map.values()].filter(note => matches(note, filters)).sort((a, b) => {
    const urgency = priority(a) - priority(b);
    if (urgency) return urgency;
    if (priority(a) <= 1 && a.dueAt && b.dueAt) {
      const deadline = Date.parse(a.dueAt) - Date.parse(b.dueAt);
      if (deadline) return deadline;
    }
    const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinned) return pinned;
    if (a.pinned && b.pinned) {
      const pinnedTime = Date.parse(b.pinnedAt ?? b.updatedAt) - Date.parse(a.pinnedAt ?? a.updatedAt);
      if (pinnedTime) return pinnedTime;
    }
    const sort = filters.sort === 'title' ? (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0)
      : Date.parse(filters.sort === 'created' ? b.createdAt : b.updatedAt) - Date.parse(filters.sort === 'created' ? a.createdAt : a.updatedAt);
    return sort || b.id.localeCompare(a.id);
  });
}
function listUrl(filters: Filters, offset: number) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (filters.q) params.set('q', filters.q);
  if (filters.pinned) params.set('pinned', 'true');
  if (filters.labelId) params.set('labelId', filters.labelId);
  if (filters.sort !== 'updated') params.set('sort', filters.sort);
  return `/notes?${params}`;
}

export function NotesWorkspace({ onSessionExpired, onDirtyChange, authenticationRevision = 0, beforeLeaveRef, guest = false }: Props) {
  const api = guest ? localApi : serverApi;
  const { notesApi, labelsApi } = useMemo(() => createNoteServices(api), [api]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Note[]>([]);
  const [reminderError, setReminderError] = useState('');
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const [pagination, setPagination] = useState<NotesResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [labelId, setLabelId] = useState('');
  const [sort, setSort] = useState<NoteSort>('updated');
  const filters: Filters = { q: query, pinned: pinnedOnly, labelId, sort };
  const filtersRef = useRef(filters); filtersRef.current = filters;
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelsError, setLabelsError] = useState('');
  const [labelsReload, setLabelsReload] = useState(0);
  const labelsGeneration = useRef(0);
  const [showLabels, setShowLabels] = useState(false);
  const labelManagerButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [actionMessage, setActionMessage] = useState('');
  const filtered = Boolean(query || pinnedOnly || labelId);
  const container = useRef<HTMLElement>(null);
  const visibleNotes = mergeNotes(filters, notes);
  const cardIds = visibleNotes.map(note => note.id).join('|');
  useEntrance(container, '.note-card, .empty-notes', [loading, query, pinnedOnly, labelId, sort, cardIds]);
  const captureLayout = useCardLayout(container, view);
  function changeView(next: 'grid' | 'list') { if (next !== view) { captureLayout(); setView(next); } }
  useEntrance(container, '.organization-feedback', [actionMessage]);
  useEntrance(container, '.reminder-notifications', [reminders.map(note => note.id).join('|')]);
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);
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
    setNotes(current => mergeNotes(filtersRef.current, current, [note]));
    setReminders(current => [...current.filter(item => item.id !== note.id), note].filter(item => !isCompleted(item) && item.dueAt && Date.parse(item.dueAt) <= Date.now() + 86400000));
  }, []);
  const autosave = useNoteAutosave({ onSaved, onAuthenticationRequired: onSessionExpired, authenticationRevision, transport: notesApi });
  useEffect(() => {
    if (!guest) return;
    const refresh = (event: StorageEvent) => { if (event.key === GUEST_KEY || event.key === null) { setReload(value => value + 1); setLabelsReload(value => value + 1); } };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [guest]);
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
  useEffect(() => {
    const controller = new AbortController();
    const revision = saveRevision.current;
    api<{ notes: Note[] }>('/notes/reminders', undefined, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      const saved = [...recentSaves.current.values()].filter(entry => entry.revision > revision).map(entry => entry.note);
      setReminders(mergeNotes({ q: '', pinned: false, labelId: '', sort: 'updated' }, Array.isArray(result.notes) ? result.notes : [], saved)
        .filter(note => !removedIds.current.has(note.id) && !isCompleted(note) && note.dueAt && Date.parse(note.dueAt) <= Date.now() + 86400000));
      setReminderError('');
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
      else setReminderError('Chưa cập nhật được nhắc việc. Bấm Tải lại để thử lại.');
    });
    return () => controller.abort();
  }, [clock, reload, authenticationRevision, onSessionExpired]);
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
    const generation = ++labelsGeneration.current;
    const controller = new AbortController();
    setLabelsError('');
    labelsApi.list(controller.signal).then(result => {
      if (!controller.signal.aborted && generation === labelsGeneration.current) setLabels(result);
    }).catch(failure => {
      if (controller.signal.aborted || generation !== labelsGeneration.current) return;
      if (failure instanceof ApiError && failure.status === 401) { onSessionExpired(); return; }
      setLabelsError(messageOf(failure));
    });
    return () => controller.abort();
  }, [labelsReload, authenticationRevision, onSessionExpired]);

  useEffect(() => {
    const generation = ++listGeneration.current;
    const revision = saveRevision.current;
    const controller = new AbortController();
    moreController.current?.abort();
    moreBusy.current = false;
    setLoadingMore(false); setMoreError(''); setLoading(true); setError('');
    api<NotesResponse>(listUrl(filters, 0), undefined, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted || generation !== listGeneration.current) return;
        const savedSinceRequest = [...recentSaves.current.values()].filter(entry => entry.revision > revision).map(entry => entry.note);
        setNotes(mergeNotes(filters, result.notes, savedSinceRequest).filter(note => !removedIds.current.has(note.id))); setPagination(result.pagination);
      })
      .catch(failure => {
        if (controller.signal.aborted || generation !== listGeneration.current) return;
        if (failure instanceof ApiError && failure.status === 401) { onSessionExpired(); return; }
        setError(messageOf(failure));
      })
      .finally(() => { if (!controller.signal.aborted && generation === listGeneration.current) setLoading(false); });
    return () => { controller.abort(); moreController.current?.abort(); };
  }, [reload, onSessionExpired, authenticationRevision, query, pinnedOnly, labelId, sort]);

  useEffect(() => () => { detailController.current?.abort(); detailGeneration.current++; }, []);

  async function loadMore() {
    if (!pagination?.hasMore || moreBusy.current || loading) return;
    moreBusy.current = true; setLoadingMore(true); setMoreError('');
    const generation = listGeneration.current;
    const revision = saveRevision.current;
    const requestedFilters = filtersRef.current;
    const controller = new AbortController();
    moreController.current = controller;
    try {
      const result = await api<NotesResponse>(listUrl(requestedFilters, pagination.offset + pagination.limit), undefined, { signal: controller.signal });
      if (controller.signal.aborted || generation !== listGeneration.current) return;
      setNotes(current => {
        const savedSinceRequest = [...recentSaves.current.values()].filter(entry => entry.revision > revision).map(entry => entry.note);
        return mergeNotes(requestedFilters, result.notes, current, savedSinceRequest).filter(note => !removedIds.current.has(note.id));
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
    if (navigating.current) return;
    // Typing while another note is loading cancels that navigation, preserving the current draft.
    cancelOpening();
    autosave.change(draft);
  }

  // Keep one mutation in flight and save text first. Metadata can never discard a draft.
  async function organizedAction(work: () => Promise<void>) {
    if (navigating.current) return false;
    navigating.current = true; setNavigationBusy(true); setEditorError(''); setActionMessage(''); cancelOpening();
    try {
      if (!await autosave.flush()) {
        setEditorError('Hãy hoàn tất việc lưu ghi chú trước khi thay đổi ghim hoặc nhãn. Bản nháp của bạn vẫn được giữ.');
        return false;
      }
      await work();
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
      setEditorError(messageOf(failure));
      return false;
    } finally { navigating.current = false; setNavigationBusy(false); }
  }
  async function organizeNote(intent: { pinned: boolean } | { labelId: string; checked: boolean }) {
    const id = autosave.getState()?.note?.id;
    if (!id) return;
    await organizedAction(async () => {
      const current = await notesApi.read(id);
      const assigned = new Set((current.labels ?? []).map(label => label.id));
      if ('labelId' in intent) { if (intent.checked) assigned.add(intent.labelId); else assigned.delete(intent.labelId); }
      const updated = await notesApi.organize(current, 'pinned' in intent ? { pinned: intent.pinned } : { labelIds: [...assigned] });
      onSaved(updated);
      if (autosave.getState()?.note?.id === id) autosave.open(updated);
      setReload(value => value + 1);
      setActionMessage('pinned' in intent ? intent.pinned ? 'Đã ghim ghi chú lên đầu danh sách.' : 'Đã bỏ ghim ghi chú.' : 'Đã cập nhật nhãn của ghi chú.');
    });
  }
  async function changeReminder(changes: ReminderChanges, target?: Note) {
    const id = target?.id ?? autosave.getState()?.note?.id;
    if (!id) return false;
    return organizedAction(async () => {
      const current = await notesApi.read(id);
      const updated = await notesApi.reminder(current, changes);
      onSaved(updated);
      if (autosave.getState()?.note?.id === id) autosave.open(updated);
      setReload(value => value + 1);
      setActionMessage('Đã cập nhật nhắc việc.');
    });
  }
  async function changeLabel(action: LabelAction) {
    return organizedAction(async () => {
      labelsGeneration.current++;
      if (action.kind === 'delete') {
        await labelsApi.remove(action.id);
        setLabels(current => current.filter(label => label.id !== action.id));
        if (labelId === action.id) setLabelId('');
      } else {
        const label = action.kind === 'create' ? await labelsApi.create(action.values) : await labelsApi.update(action.id, action.values);
        setLabels(current => [...current.filter(item => item.id !== label.id), label].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
      }
      // The mutation has succeeded. Do not report it as failed if refreshing the editor fails.
      setLabelsReload(value => value + 1);
      const selectedId = autosave.getState()?.note?.id;
      if (selectedId) {
        try {
          const refreshed = await notesApi.read(selectedId);
          onSaved(refreshed); autosave.open(refreshed);
        } catch (failure) {
          if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
          setEditorError(`Nhãn đã được cập nhật nhưng chưa tải lại được ghi chú. ${messageOf(failure)}`);
        }
      }
      setReload(value => value + 1);
      setActionMessage(action.kind === 'delete' ? 'Đã xóa nhãn. Các ghi chú vẫn được giữ lại.' : action.kind === 'create' ? 'Đã tạo nhãn. Mở ghi chú để gắn nhãn.' : 'Đã cập nhật nhãn.');
    });
  }
  function clearFilters() {
    setSearch(''); setQuery(''); setPinnedOnly(false); setLabelId(''); searchInput.current?.focus();
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
      setReminders(current => current.filter(note => note.id !== id));
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

  return <section ref={container} className="notes-workspace" aria-label="Không gian ghi chú">
    {reminderError && <p className="field-error">{reminderError}</p>}
    {reminders.length > 0 && <section className="reminder-notifications" aria-label="Thông báo nhắc việc" aria-live="polite">
      <h2>Cần bạn chú ý · {reminders.length}{reminders.length === 100 ? '+' : ''}</h2>
      <p>Nhắc trong ứng dụng khi trang đang mở. Việc quá hạn và sắp đến hạn được ưu tiên trước ghim.</p>
      {mergeNotes({ q: '', pinned: false, labelId: '', sort: 'updated' }, reminders).slice(0,5).map(note => <div key={note.id} className={`reminder-notification task-${taskState(note)}`}>
        <button type="button" className="quiet-button" disabled={navigationBusy} onClick={() => void openNote(note)}>{taskLabel(note)} · {note.title} · {formatDue(note.dueAt!)}</button>
        <button type="button" className="quiet-button" disabled={navigationBusy} onClick={() => void changeReminder({ completed: true }, note)}>Đánh dấu hoàn thành {note.title}</button>
      </div>)}
    </section>}
    <div className="notes-toolbar">
      <div><h2>Những điều muốn nhớ</h2><p role="status">{loading || search.trim() !== query ? 'Đang tìm ghi chú của bạn…' : error ? 'Chưa thể tải danh sách ghi chú.' : `${notes.length} ghi chú${filtered ? ' phù hợp' : ' đã tải'}${pagination?.hasMore ? ' · còn ghi chú khác' : ''}`}</p></div>
      <div className="notes-actions">
        <div className="note-view-switch" role="group" aria-label="Kiểu hiển thị ghi chú">
          <button className="icon-button" type="button" aria-label="Xem dạng lưới" aria-pressed={view === 'grid'} onClick={() => changeView('grid')}><Grid2X2 size={17} /></button>
          <button className="icon-button" type="button" aria-label="Xem dạng danh sách" aria-pressed={view === 'list'} onClick={() => changeView('list')}><List size={17} /></button>
        </div>
        <button type="button" className="quiet-button" onClick={() => setReload(value => value + 1)} disabled={loading || navigationBusy}><RefreshCw size={16} /> Tải lại</button>
        <button ref={newButton} type="button" className="primary-button new-note-button" disabled={navigationBusy} onClick={() => void openNew()}><Plus size={17} /> Ghi chú mới</button>
      </div>
    </div>
    {!editor && <button type="button" className="quick-note" onClick={() => void openNew()} disabled={navigationBusy}><Plus size={20} />Ghi lại điều gì đó…<span>Tự lưu</span></button>}
    <div className="notes-search-row">
      <div className="notes-search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="notes-search">Tìm ghi chú</label>
        <input ref={searchInput} type="search" id="notes-search" value={search} maxLength={200} autoComplete="off"
          placeholder="Tìm theo tiêu đề hoặc nội dung…" onChange={event => setSearch(event.target.value)} />
        {search && <button type="button" className="icon-button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => { setSearch(''); setQuery(''); searchInput.current?.focus(); }}><X size={17} /></button>}
      </div>
      <button ref={labelManagerButton} type="button" className="quiet-button manage-labels-button" aria-expanded={showLabels}
        disabled={navigationBusy} onClick={() => setShowLabels(value => !value)}><Tag size={17} />Quản lý nhãn</button>
    </div>
    <div className="notes-filter-row">
      <button type="button" className={`quiet-button pin-filter ${pinnedOnly ? 'active' : ''}`} aria-pressed={pinnedOnly}
        onClick={() => setPinnedOnly(value => !value)}><Pin size={15} />Chỉ ghi chú đã ghim</button>
      <label className="filter-select"><span>Nhãn</span><select aria-label="Lọc theo nhãn" value={labelId} onChange={event => setLabelId(event.target.value)}>
        <option value="">Tất cả nhãn</option>{labels.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>
      <label className="filter-select sort-select"><span>Sắp xếp</span><select aria-label="Sắp xếp ghi chú" value={sort} onChange={event => setSort(event.target.value as NoteSort)}>
        <option value="updated">Vừa chỉnh sửa</option><option value="created">Mới tạo</option><option value="title">Tiêu đề A–Z</option></select></label>
      {(filtered || search) && <button type="button" className="quiet-button clear-filters" onClick={clearFilters}><X size={14} />Xóa bộ lọc</button>}
    </div>
    <p className="notes-order-hint"><Pin size={12} />Ưu tiên việc quá hạn, sắp đến hạn, quan trọng; sau đó đến ghi chú ghim.</p>
    {labelsError && <div className="labels-load-error"><p className="notice error" role="alert">Không tải được nhãn: {labelsError}</p>
      <button type="button" className="quiet-button" onClick={() => setLabelsReload(value => value + 1)}>Thử tải nhãn lại</button></div>}
    {showLabels && <LabelManager labels={labels} busy={navigationBusy} onAction={changeLabel} onClose={() => { setShowLabels(false); labelManagerButton.current?.focus(); }} />}
    {actionMessage && <p className="organization-feedback" role="status">{actionMessage}</p>}
    {editorError && <div className="notice error" role="alert">{editorError}</div>}
    {openingId && <p className="notes-loading" role="status"><LoaderCircle className="spin" size={17} /> Đang mở ghi chú…</p>}
    {editor && <NoteEditor key={editorKey} draft={editor.draft} isNew={editor.note === null}
      onChange={changeDraft} onClose={() => void closeEditor()} disabled={navigationBusy}
      saveStatus={editor.status} saveError={editor.error} fieldErrors={editor.fields}
      onRetry={() => void autosave.retry()} onDelete={() => void deleteNote()}
      organization={<><NoteOrganization note={editor.note} labels={labels} disabled={navigationBusy}
        onPin={pinned => void organizeNote({ pinned })} onLabel={(id, checked) => void organizeNote({ labelId: id, checked })}
        onManageLabels={() => { setShowLabels(true); labelManagerButton.current?.focus(); }} />
        {editor.note && <NoteReminder key={`${editor.note.id}-${editor.note.dueAt}-${editor.note.daily}`} note={editor.note} busy={navigationBusy} onChange={changeReminder} />}</>} />}
    {editor?.status === 'conflict' && <section className="note-conflict" aria-label="Đối chiếu thay đổi">
      <h3>Ghi chú đã được sửa ở một phiên khác</h3>
      <p>Nội dung đang nhập của bạn vẫn được giữ. Đọc bản mới trước khi chọn cách tiếp tục.</p>
      <button className="quiet-button" type="button" disabled={editor.loadingRemote || navigationBusy} onClick={() => void autosave.readRemote()}>{editor.loadingRemote ? 'Đang tải bản mới…' : 'Đọc bản mới trên máy chủ'}</button>
      {editor.remote && <>
        <div className="remote-note"><strong>{editor.remote.title}</strong><p>{editor.remote.content}</p></div>
        <div className="notes-actions">
          <button className="quiet-button" type="button" disabled={navigationBusy} onClick={() => {
            if (window.confirm('Thay bản đang nhập bằng bản trên máy chủ? Nội dung chưa lưu của bạn sẽ bị bỏ.')) autosave.useRemote();
          }}>Dùng bản trên máy chủ</button>
          <button className="quiet-button" type="button" disabled={navigationBusy} onClick={() => {
            if (window.confirm('Tiếp tục tự lưu nội dung đang nhập của bạn để thay cho bản vừa đối chiếu?')) void autosave.keepLocal();
          }}>Tiếp tục với nội dung đang nhập</button>
        </div>
      </>}
    </section>}
    {loading ? <p className="notes-loading" role="status"><LoaderCircle className="spin" size={19} /> Đang tải ghi chú…</p>
      : error ? <div className="notes-load-error"><p className="notice error" role="alert">{error}</p><button type="button" className="quiet-button" onClick={() => setReload(value => value + 1)}>Thử tải lại</button></div>
      : notes.length === 0 ? <div className="empty-notes"><div className="empty-illustration">{filtered ? <Search size={46} strokeWidth={1.1} /> : <StickyNote size={46} strokeWidth={1.1} />}<span className="empty-spark">✳</span></div>
        <h2>{filtered ? 'Chưa tìm thấy ghi chú phù hợp.' : 'Mọi ý tưởng đều có điểm bắt đầu.'}</h2>
        {filtered ? <><p>Thử từ khóa khác hoặc bỏ bớt bộ lọc.</p><button type="button" className="quiet-button" onClick={clearFilters}>Hiện tất cả ghi chú</button></>
          : <p>Bạn chưa có ghi chú nào.<br />Bắt đầu bằng nút Ghi chú mới ở phía trên.</p>}</div>
      : <div className={`notes-grid ${view === 'list' ? 'view-list' : ''}`} aria-label="Danh sách ghi chú">
        {visibleNotes.map(note => <button type="button" disabled={navigationBusy} className={`note-card task-${taskState(note)} ${note.important ? 'note-important' : ''} ${editor?.note?.id === note.id ? 'selected' : ''}`} key={note.id}
          onClick={() => void openNote(note)} aria-pressed={editor?.note?.id === note.id} aria-label={`Mở ghi chú ${note.title}`}>
          <span className="note-card-corner">{note.pinned ? <span className="note-pinned-badge"><Pin size={14} />Đã ghim</span> : <StickyNote size={16} />}</span>
          {note.important && <ImportantBadge />}
          <h3>{note.title}</h3><p>{note.content}</p>
          {taskLabel(note) && taskLabel(note) !== 'Quan trọng' && <span className="task-badge">{taskLabel(note)}</span>}
          {note.dueAt && <span className="task-deadline">Hạn: {formatDue(note.dueAt)}</span>}
          {(note.labels ?? []).length > 0 && <span className="note-labels">{note.labels.map(label => <LabelChip key={label.id} label={label} />)}</span>}
          <time dateTime={note.updatedAt}>Sửa {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(note.updatedAt))}</time>
        </button>)}
      </div>}
    {!loading && !error && pagination?.hasMore && <div className="notes-pagination">
      {moreError && <p className="notice error" role="alert">{moreError}</p>}
      <button type="button" className="quiet-button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Đang tải thêm…' : moreError ? 'Thử tải thêm' : 'Tải thêm ghi chú'}</button>
    </div>}
  </section>;
}
