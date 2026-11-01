import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Grid2X2, List, LoaderCircle, Pin, Plus, RefreshCw, Search, StickyNote, Tag, X, Star, Clock, CalendarDays, CheckCircle2, Settings, Info, LogOut, UserRound, LockKeyhole, Share2 } from 'lucide-react';
import { api as serverApi, ApiError } from '../api';
import type { Label, Note, NoteDraft, NoteSort, NotesResponse } from '../types/notes';
import { NoteEditor } from './NoteEditor';
import { useNoteAutosave } from '../hooks/useNoteAutosave';
import { createNoteServices } from '../notesApi';
import { localApi, GUEST_KEY } from '../localNotes';
import { LabelManager, type LabelAction } from './LabelManager';
import { NoteOrganization } from './NoteOrganization';
import { NoteReminder, type ReminderChanges } from './NoteReminder';
import { priority, taskState, taskLabel, formatDue, isCompleted, inCategory, type NoteCategory } from '../reminders';
import { useEntrance } from '../hooks/useEntrance';
import { useCardLayout } from '../hooks/useCardLayout';
import { ImportantBadge, LabelChip } from './LabelChip';
import { normalizePreferences, type Preferences } from '../preferences';
import { NoteAttachments } from './NoteAttachments';
import { NoteSecurity, type ProtectionChange } from './NoteSecurity';
import { NoteShares } from './NoteShares';
import { CollaborativeEditor } from './CollaborativeEditor';
import {NoteSummary} from './NoteSummary';
import {NoteQuestions} from './NoteQuestions';

interface Props {
  guest?: boolean;
  onLogout?: () => void; onAccount?: () => void; preferenceKey?: string;
  onSessionExpired: () => void; onDirtyChange: (dirty: boolean) => void;
  authenticationRevision?: number; beforeLeaveRef?: MutableRefObject<(() => Promise<boolean>) | null>;
}
const PAGE_SIZE = 50;
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Không tải được ghi chú. Vui lòng thử lại.';
type Filters = { q: string; pinned: boolean; labelId: string; sort: NoteSort; category?: NoteCategory; shared?:boolean };
function matches(note: Note, filters: Filters) {
  const text = filters.q.toLowerCase();
  return Boolean(note.share)===Boolean(filters.shared) && (!filters.pinned || note.pinned)
    && inCategory(note, filters.category)
    && (!filters.labelId || (note.labels ?? []).some(label => label.id === filters.labelId))
    && (!text || note.title.toLowerCase().includes(text) || note.content.toLowerCase().includes(text));
}
function mergeNotes(filters: Filters, ...groups: Note[][]) {
  const map = new Map<string, Note>();
  for (const note of groups.flat()) {
    if (!map.has(note.id) || map.get(note.id)!.version <= note.version) map.set(note.id, note);
  }
  return [...map.values()].filter(note => matches(note, filters)).sort((a, b) => {
    const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinned) return pinned;
    if (a.pinned && b.pinned) {
      const pinnedTime = Date.parse(b.pinnedAt ?? b.updatedAt) - Date.parse(a.pinnedAt ?? a.updatedAt);
      if (pinnedTime) return pinnedTime;
    }
    const urgency = priority(a) - priority(b);
    if (urgency) return urgency;
    if (priority(a) <= 1 && a.dueAt && b.dueAt) {
      const deadline = Date.parse(a.dueAt) - Date.parse(b.dueAt);
      if (deadline) return deadline;
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
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.shared) params.set('shared','true');
  return `/notes?${params}`;
}

const categories = [
  { id: 'all', title: 'Tất cả ghi chú', icon: StickyNote }, { id: 'important', title: 'Quan trọng', icon: Star },
  { id: 'overdue', title: 'Quá hạn', icon: Clock }, { id: 'upcoming', title: 'Sắp đến hạn', icon: CalendarDays },
  { id: 'daily', title: 'Hằng ngày', icon: CalendarDays }, { id: 'completed', title: 'Đã hoàn thành', icon: CheckCircle2 },
] as const;
function readPreferences(key: string) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    return normalizePreferences(stored);
  } catch { return normalizePreferences(); }
}
export function NotesWorkspace({ onSessionExpired, onDirtyChange, authenticationRevision = 0, beforeLeaveRef, guest = false, onLogout, onAccount, preferenceKey = 'ghichu.display.guest' }: Props) {
  const [panel, setPanel] = useState<'notes' | 'settings' | 'about' | 'qa'>('notes');
  const [preferences, setPreferences] = useState(() => readPreferences(preferenceKey));
  const [preferenceError, setPreferenceError] = useState('');
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const preferenceRevision = useRef(0);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [preferences.theme]);
  useEffect(() => {
    if (guest) return;
    const controller = new AbortController();
    const revision = preferenceRevision.current;
    void serverApi<{preferences:Preferences}>('/auth/preferences',undefined,{signal:controller.signal}).then(result => {
      if (result.preferences && revision === preferenceRevision.current) setPreferences(normalizePreferences(result.preferences));
    }).catch(error => { if (!controller.signal.aborted) setPreferenceError('Chưa tải được tùy chọn tài khoản. Bạn có thể thay đổi và thử lưu lại.'); });
    return () => controller.abort();
  }, [guest, preferenceKey]);
  async function updatePreferences(next: typeof preferences) {
    preferenceRevision.current++;
    setPreferences(next);
    try { window.localStorage.setItem(preferenceKey, JSON.stringify(next)); setPreferenceError(''); }
    catch { setPreferenceError('Tùy chọn đã áp dụng cho lần mở này; trình duyệt chưa cho phép lưu lại.'); }
    if (!guest) {
      setPreferenceBusy(true);
      try { await serverApi('/auth/preferences',next,{method:'PATCH'}); setPreferenceError(''); }
      catch { setPreferenceError('Đã áp dụng trên trang nhưng chưa đồng bộ tài khoản. Chọn lại tùy chọn khi có mạng để thử lưu.'); }
      finally { setPreferenceBusy(false); }
    }
  }
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
  const [category, setCategory] = useState<NoteCategory>('all');
  const [shared,setShared]=useState(false);
  const [sharedCount,setSharedCount]=useState(0);
  const [lockedId,setLockedId]=useState<string|null>(null);
  const [unlockPassword,setUnlockPassword]=useState('');
  const [unlockBusy,setUnlockBusy]=useState(false);
  useEffect(()=>{
    if(guest)return;const controller=new AbortController();
    void serverApi<{count:number}>('/notes/shared-notifications',undefined,{signal:controller.signal}).then(result=>setSharedCount(result.count??0)).catch(()=>{});
    return()=>controller.abort();
  },[guest,clock,authenticationRevision]);
  const categoryClock = ['overdue','upcoming','daily','completed'].includes(category) ? clock : 0;
  const filters: Filters = { q: query, pinned: pinnedOnly, labelId, sort, category, shared };
  const filtersRef = useRef(filters); filtersRef.current = filters;
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelsError, setLabelsError] = useState('');
  const [labelsReload, setLabelsReload] = useState(0);
  const labelsGeneration = useRef(0);
  const [showLabels, setShowLabels] = useState(false);
  const labelManagerButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [actionMessage, setActionMessage] = useState('');
  const filtered = Boolean(query || pinnedOnly || labelId || category !== 'all');
  const container = useRef<HTMLElement>(null);
  const visibleNotes = mergeNotes(filters, notes);
  const cardIds = visibleNotes.map(note => note.id).join('|');
  useEntrance(container, '.note-card, .empty-notes', [loading, query, pinnedOnly, labelId, sort, category, cardIds, panel]);
  const captureLayout = useCardLayout(container, view);
  function changeView(next: 'grid' | 'list') { if (next !== view) { captureLayout(); setView(next); } }
  useEntrance(container, '.organization-feedback', [actionMessage]);
  useEntrance(container, '.workspace-panel', [panel]);
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
  const [liveNote,setLiveNote]=useState<Note|null>(null);
  const [liveDirty,setLiveDirty]=useState(false);
  const liveFlushRef=useRef<(()=>Promise<boolean>)|null>(null);
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

  const dirty = Boolean(editor?.dirty || editor?.saving || liveDirty);
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
      if (liveFlushRef.current) {
        if(await liveFlushRef.current())return true;
      } else if (await autosave.flush()) return true;
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
  }, [reload, onSessionExpired, authenticationRevision, query, pinnedOnly, labelId, sort, category, categoryClock,shared]);

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
    setLiveNote(null);
    cancelOpening(); setLockedId(null);setEditorError(''); setEditorKey(value => value + 1); autosave.open(null);
  }
  async function closeEditor() {
    if (!await prepareToLeave()) return;
    setLiveNote(null);setReload(value=>value+1);
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
      if(liveFlushRef.current&&!await liveFlushRef.current()){
        setEditorError('Hãy chờ cộng tác đồng bộ xong trước khi tiếp tục.');return false;
      }
      if (!await autosave.flush()) {
        setEditorError('Hãy hoàn tất việc lưu ghi chú trước khi thay đổi ghim hoặc nhãn. Bản nháp của bạn vẫn được giữ.');
        return false;
      }
      await work();
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
      if (failure instanceof ApiError && failure.status === 423) setLockedId(autosave.getState()?.note?.id??null);
      setEditorError(messageOf(failure));
      return false;
    } finally { navigating.current = false; setNavigationBusy(false); }
  }
  async function protectNote(change:ProtectionChange) {
    const id=autosave.getState()?.note?.id;if(!id)return false;
    return organizedAction(async()=>{
      const current=autosave.getState()!.note!;
      const result=await serverApi<{note:Note}>(`/notes/${id}/protection`,{...change,version:current.version});
      onSaved(result.note);autosave.open(result.note);setReload(value=>value+1);
    });
  }
  async function lockNote() {
    const id=autosave.getState()?.note?.id;if(!id)return;
    await organizedAction(async()=>{
      await serverApi(`/notes/${id}/lock`,{});autosave.close();recentSaves.current.delete(id);
      setNotes(notes=>notes.map(note=>note.id===id?{...note,title:'Ghi chú được bảo vệ',content:'',locked:true}:note));setReload(value=>value+1);
    });
  }
  async function unlockNote() {
    if(!lockedId)return;setUnlockBusy(true);setEditorError('');
    try {
      const preserving=autosave.getState()?.note?.id===lockedId;
      const result=await serverApi<{note:Note}>(`/notes/${lockedId}/unlock`,{password:unlockPassword});
      if(preserving) await autosave.retry(); else {setEditorKey(value=>value+1);autosave.open(result.note);}
      onSaved(result.note);setLockedId(null);setUnlockPassword('');
    }
    catch(failure){setEditorError(messageOf(failure));}finally{setUnlockBusy(false);}
  }
  function showShared() {
    setShared(true);setCategory('all');setLabelId('');setPanel('notes');
    void serverApi('/notes/shared-notifications/read',{}).then(()=>setSharedCount(0)).catch(()=>{});
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
    setSearch(''); setQuery(''); setPinnedOnly(false); setLabelId(''); setCategory('all'); searchInput.current?.focus();
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
  async function openNote(note: Pick<Note,'id'>,refresh=false) {
    if (editor?.note?.id === note.id && !openingId && !refresh) return;
    if (!await prepareToLeave()) return;
    setLiveNote(null);
    cancelOpening();
    const generation = detailGeneration.current;
    const controller = new AbortController();
    detailController.current = controller;
    setOpeningId(note.id); setEditorError('');
    try {
      const result = await api<{ note: Note }>(`/notes/${note.id}`, undefined, { signal: controller.signal });
      if (controller.signal.aborted || generation !== detailGeneration.current) return;
      setLockedId(null);setEditorKey(value => value + 1); autosave.open(result.note);
    } catch (failure) {
      if (controller.signal.aborted || generation !== detailGeneration.current) return;
      if (failure instanceof ApiError && failure.status === 401) { onSessionExpired(); return; }
      if (failure instanceof ApiError && failure.status === 423) {setLockedId(note.id);setUnlockPassword('');autosave.close();return;}
      setEditorError(messageOf(failure));
    } finally {
      if (!controller.signal.aborted && generation === detailGeneration.current) setOpeningId(null);
    }
  }

  return <section ref={container} className={`notes-workspace has-sidebar density-${preferences.density}`} style={{ '--note-font-size': `${preferences.fontSize}px`, '--note-background':preferences.noteColor } as React.CSSProperties} aria-label="Không gian ghi chú">
    <aside className="workspace-sidebar" aria-label="Thanh công cụ ghi chú">
      <div className="sidebar-heading"><StickyNote size={19} /><strong>Không gian của bạn</strong></div>
      <div className="notes-search"><Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="notes-search">Tìm ghi chú</label>
        <input ref={searchInput} type="search" id="notes-search" value={search} maxLength={200} autoComplete="off" placeholder="Tìm ghi chú…"
          onChange={event => { setSearch(event.target.value); setPanel('notes'); }} />
        {search && <button type="button" className="icon-button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => { setSearch(''); setQuery(''); searchInput.current?.focus(); }}><X size={15} /></button>}
      </div>
      <nav className="sidebar-navigation" aria-label="Nhóm ghi chú">{categories.map(item => <button key={item.id} type="button"
        className={`sidebar-item category-${item.id}`} aria-current={panel === 'notes' && category === item.id ? 'page' : undefined}
        onClick={() => { setShared(false);setCategory(item.id); setPanel('notes'); }}><item.icon size={18} />{item.title}</button>)}
        {!guest&&<button type="button" className="sidebar-item" aria-current={shared?'page':undefined} onClick={showShared}><Share2 size={18}/>Được chia sẻ với tôi{sharedCount>0?` (${sharedCount} mới)`:''}</button>}</nav>
      <div className="sidebar-labels"><label className="filter-select"><span>Lọc theo nhãn</span><select aria-label="Lọc theo nhãn" value={labelId} onChange={event => { setLabelId(event.target.value); setPanel('notes'); }}>
        <option value="">Tất cả nhãn</option>{labels.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>
        <button ref={labelManagerButton} type="button" className="sidebar-item" aria-expanded={showLabels} disabled={navigationBusy}
          onClick={() => { setPanel('notes'); setShowLabels(value => !value); }}><Tag size={18} />Quản lý nhãn</button></div>
      <nav className="sidebar-system" aria-label="Ứng dụng">
        {!guest&&<button type="button" className="sidebar-item" aria-current={panel==='qa'?'page':undefined} onClick={()=>setPanel('qa')}><StickyNote size={18}/>Hỏi AI</button>}
        <button type="button" className="sidebar-item" aria-current={panel === 'settings' ? 'page' : undefined} onClick={() => setPanel('settings')}><Settings size={18} />Cài đặt</button>
        <button type="button" className="sidebar-item" aria-current={panel === 'about' ? 'page' : undefined} onClick={() => setPanel('about')}><Info size={18} />Về ứng dụng</button>
        {onLogout && <button type="button" className="sidebar-item sidebar-logout" onClick={onLogout}><LogOut size={18} />Đăng xuất</button>}
        {onAccount && <button type="button" className="sidebar-item" onClick={onAccount}><UserRound size={18} />Mở tài khoản</button>}
      </nav><p className="sidebar-storage">{guest ? 'Lưu trên trình duyệt này' : 'Lưu trên máy chủ'} · Tự lưu</p>
    </aside>
    <div className="workspace-content" hidden={panel !== 'notes'}>
    {sharedCount>0&&!guest&&<div className="notice success" role="status">Bạn có {sharedCount} ghi chú được chia sẻ mới. <button type="button" className="quiet-button" onClick={showShared}>Xem ghi chú được chia sẻ</button></div>}
    {reminderError && <p className="field-error">{reminderError}</p>}
    {reminders.length > 0 && <section className="reminder-notifications" aria-label="Thông báo nhắc việc" aria-live="polite">
      <h2>Cần bạn chú ý · {reminders.length}{reminders.length === 100 ? '+' : ''}</h2>
      <p>Nhắc trong ứng dụng khi trang đang mở. Ghi chú ghim luôn ở đầu danh sách.</p>
      {mergeNotes({ q: '', pinned: false, labelId: '', sort: 'updated' }, reminders).slice(0,5).map(note => <div key={note.id} className={`reminder-notification task-${taskState(note)}`}>
        <button type="button" className="quiet-button" disabled={navigationBusy} onClick={() => void openNote(note)}>{taskLabel(note)} · {note.title} · {formatDue(note.dueAt!)}</button>
        <button type="button" className="quiet-button" disabled={navigationBusy} onClick={() => void changeReminder({ completed: true }, note)}>Đánh dấu hoàn thành {note.title}</button>
      </div>)}
    </section>}
    <div className="notes-toolbar">
      <div><h2>{shared?'Được chia sẻ với tôi':category === 'all' ? 'Những điều muốn nhớ' : categories.find(item => item.id === category)?.title}</h2><p role="status">{loading || search.trim() !== query ? 'Đang tìm ghi chú của bạn…' : error ? 'Chưa thể tải danh sách ghi chú.' : `${notes.length} ghi chú${filtered ? ' phù hợp' : ' đã tải'}${pagination?.hasMore ? ' · còn ghi chú khác' : ''}`}</p></div>
      <div className="notes-actions">
        <div className="note-view-switch" role="group" aria-label="Kiểu hiển thị ghi chú">
          <button className="icon-button" type="button" aria-label="Xem dạng lưới" aria-pressed={view === 'grid'} onClick={() => changeView('grid')}><Grid2X2 size={17} /></button>
          <button className="icon-button" type="button" aria-label="Xem dạng danh sách" aria-pressed={view === 'list'} onClick={() => changeView('list')}><List size={17} /></button>
        </div>
        <button type="button" className="quiet-button" onClick={() => setReload(value => value + 1)} disabled={loading || navigationBusy}><RefreshCw size={16} /> Tải lại</button>
        <button ref={newButton} type="button" className="primary-button new-note-button" disabled={navigationBusy} onClick={() => void openNew()}><Plus size={17} /> Ghi chú mới</button>
      </div>
    </div>
    {!editor && !liveNote && <button type="button" className="quick-note" onClick={() => void openNew()} disabled={navigationBusy}><Plus size={20} />Ghi lại điều gì đó…<span>Tự lưu</span></button>}
    <div className="notes-filter-row">
      <button type="button" className={`quiet-button pin-filter ${pinnedOnly ? 'active' : ''}`} aria-pressed={pinnedOnly}
        onClick={() => setPinnedOnly(value => !value)}><Pin size={15} />Chỉ ghi chú đã ghim</button>
      <label className="filter-select sort-select"><span>Sắp xếp</span><select aria-label="Sắp xếp ghi chú" value={sort} onChange={event => setSort(event.target.value as NoteSort)}>
        <option value="updated">Vừa chỉnh sửa</option><option value="created">Mới tạo</option><option value="title">Tiêu đề A–Z</option></select></label>
      {(filtered || search) && <button type="button" className="quiet-button clear-filters" onClick={clearFilters}><X size={14} />Xóa bộ lọc</button>}
    </div>
    <p className="notes-order-hint"><Pin size={12} />Ghi chú ghim luôn ở đầu, ghim gần nhất trước; tiếp theo là việc quá hạn, sắp đến hạn và quan trọng.</p>
    {labelsError && <div className="labels-load-error"><p className="notice error" role="alert">Không tải được nhãn: {labelsError}</p>
      <button type="button" className="quiet-button" onClick={() => setLabelsReload(value => value + 1)}>Thử tải nhãn lại</button></div>}
    {showLabels && <LabelManager labels={labels} busy={navigationBusy} onAction={changeLabel} onClose={() => { setShowLabels(false); labelManagerButton.current?.focus(); }} />}
    {actionMessage && <p className="organization-feedback" role="status">{actionMessage}</p>}
    {editorError && <div className="notice error" role="alert">{editorError}</div>}
    {lockedId&&<section className="workspace-panel" aria-label="Mở khóa ghi chú"><h3>Ghi chú được bảo vệ</h3><form onSubmit={event=>{event.preventDefault();void unlockNote();}}><label>Mật khẩu ghi chú<input type="password" required autoComplete="off" value={unlockPassword} disabled={unlockBusy} onChange={event=>setUnlockPassword(event.target.value)}/></label><button className="primary-button" disabled={unlockBusy}>{unlockBusy?'Đang mở khóa…':'Mở khóa ghi chú'}</button></form><button type="button" className="quiet-button" disabled={unlockBusy} onClick={()=>{setLockedId(null);setUnlockPassword('');}}>Hủy mở khóa</button></section>}
    {openingId && <p className="notes-loading" role="status"><LoaderCircle className="spin" size={17} /> Đang mở ghi chú…</p>}
    {liveNote&&<CollaborativeEditor key={liveNote.id} noteId={liveNote.id} busy={navigationBusy} onClose={()=>void closeEditor()} onDirty={setLiveDirty} flushRef={liveFlushRef}/>}
    {editor && <NoteEditor key={editorKey} draft={editor.draft} isNew={editor.note === null}
      onChange={changeDraft} onClose={() => void closeEditor()} disabled={navigationBusy} readOnly={editor.note?.share?.permission==='read'}
      saveStatus={editor.status} saveError={editor.error} fieldErrors={editor.fields}
      onRetry={() => {if(editor.note?.protected&&editor.error?.includes('bảo vệ'))setLockedId(editor.note.id);else void autosave.retry();}} onDelete={editor.note?.share?undefined:() => void deleteNote()}
      organization={<>{editor.note?.share&&<p className="notice success">{editor.note.share.ownerName} chia sẻ · {editor.note.share.permission==='read'?'Chỉ đọc':'Được sửa'} · {new Date(editor.note.share.sharedAt).toLocaleString('vi-VN')}</p>}
        {!guest&&editor.note&&<button type="button" className="quiet-button" disabled={navigationBusy} onClick={()=>void organizedAction(async()=>{
          const id=autosave.getState()?.note?.id;if(!id)return;
          const fresh=await notesApi.read(id);autosave.close();setLiveNote(fresh);
        })}><Share2 size={15}/>Cộng tác trực tiếp</button>}
        {!editor.note?.share&&<NoteOrganization note={editor.note} labels={labels} disabled={navigationBusy}
        onPin={pinned => void organizeNote({ pinned })} onLabel={(id, checked) => void organizeNote({ labelId: id, checked })}
        onManageLabels={() => { setShowLabels(true); labelManagerButton.current?.focus(); }} />}
        {editor.note && !editor.note.share&&<NoteReminder key={`${editor.note.id}-${editor.note.dueAt}-${editor.note.daily}`} note={editor.note} busy={navigationBusy} onChange={changeReminder} />}
        {!guest && editor.note && <><NoteSummary key={`summary-${editor.note.id}`} noteId={editor.note.id} version={editor.note.version} dirty={editor.dirty||editor.saving} busy={navigationBusy} onAction={organizedAction}/><NoteAttachments key={editor.note.id} noteId={editor.note.id} readOnly={editor.note.share?.permission==='read'} beforeUpload={async () => { await autosave.flush(); return autosave.getState()?.status === 'saved'; }} />
          {!editor.note.share&&<><NoteSecurity note={editor.note} busy={navigationBusy} onProtect={protectNote} onLock={()=>void lockNote()}/><NoteShares key={`shares-${editor.note.id}`} noteId={editor.note.id} onAction={organizedAction}/></>}
          {editor.note.share&&editor.note.protected&&<button type="button" className="quiet-button" onClick={()=>void lockNote()}>Khóa lại ghi chú</button>}
        </>}</>} />}
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
          {note.protected&&<span className="note-pinned-badge"><LockKeyhole size={14}/>{note.locked?'Đã khóa':'Có mật khẩu'}</span>}
          {note.share&&<span className="note-pinned-badge"><Share2 size={14}/>{note.share.ownerName} · {note.share.permission==='read'?'Chỉ đọc':'Được sửa'}</span>}
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
    </div>
    {panel==='qa'&&!guest&&<NoteQuestions busy={navigationBusy} onAction={async work=>{
      let failure:unknown;
      const completed=await organizedAction(async()=>{try{await work();}catch(error){failure=error;throw error;}});
      if(failure)throw failure;return completed;
    }} onOpenSource={id=>{setPanel('notes');void openNote({id},true);}}/>}
    {panel === 'settings' && <section className="workspace-panel" aria-label="Cài đặt hiển thị"><h2>Cài đặt</h2><p>{guest ? 'Tùy chọn được nhớ trên trình duyệt này.' : 'Tùy chọn được đồng bộ theo tài khoản khi có kết nối.'} Kiểu xem áp dụng cho phiên hiện tại; lần mở mới mặc định là lưới.</p>
      <fieldset disabled={preferenceBusy} className="preferences-fields"><legend className="sr-only">Tùy chọn hiển thị</legend>
      <label>Mật độ thẻ<select value={preferences.density} onChange={event => updatePreferences({ ...preferences, density: event.target.value })}><option value="comfortable">Thoáng, dễ đọc</option><option value="compact">Gọn, xem nhiều ghi chú</option></select></label>
      <label>Cỡ chữ ghi chú<select value={preferences.fontSize} onChange={event => updatePreferences({ ...preferences, fontSize: Number(event.target.value) })}><option value={14}>Vừa · 14px</option><option value={16}>Lớn · 16px</option><option value={18}>Rất lớn · 18px</option></select></label>
      <label>Kiểu xem<select value={view} onChange={event => setView(event.target.value as 'grid' | 'list')}><option value="grid">Lưới</option><option value="list">Danh sách</option></select></label>
      <label>Giao diện<select value={preferences.theme} onChange={event => void updatePreferences({...preferences,theme:event.target.value as 'light'|'dark'})}><option value="light">Sáng</option><option value="dark">Tối</option></select></label>
      <label>Màu ghi chú<select value={preferences.noteColor} onChange={event => void updatePreferences({...preferences,noteColor:event.target.value})}><option value="#fffdf7">Kem</option><option value="#f0eaff">Tím</option><option value="#e8f5ee">Xanh lá</option><option value="#fff2d8">Vàng</option><option value="#fce9ef">Hồng</option><option value="#e8f1ff">Xanh dương</option></select></label>
      </fieldset>{preferenceBusy && <p role="status">Đang lưu tùy chọn…</p>}
      <p>Tự lưu đang bật. Hiệu ứng tự giảm theo thiết lập giảm chuyển động của thiết bị.</p>
      {preferenceError && <p role="alert">{preferenceError}</p>}
      <button type="button" className="quiet-button" onClick={() => setPanel('notes')}>Quay lại ghi chú</button>
    </section>}
    {panel === 'about' && <section className="workspace-panel" aria-label="Về ứng dụng"><h2>Về ghi chú.</h2><p>Không gian cho ý tưởng, công việc và những điều muốn nhớ.</p>
      <dl><dt>Ghi chú tài khoản</dt><dd>Tự lưu trên máy chủ và mở lại bằng cùng tài khoản trên thiết bị khác. Tài khoản chưa xác minh email vẫn dùng đầy đủ chức năng.</dd>
        <dt>Ghi chú trên máy</dt><dd>Lưu trong trình duyệt này, tách riêng với dữ liệu tài khoản. Xóa dữ liệu trình duyệt sẽ xóa ghi chú cục bộ.</dd>
        <dt>Nhắc việc</dt><dd>Vàng khi sắp hạn hoặc quan trọng; đỏ khi quá hạn. Thông báo trong ứng dụng cần trang đang mở.</dd>
        <dt>Dự án</dt><dd>503073 · Web Programming &amp; Applications · Nguyễn Hải Triều và Thái.</dd></dl>
      <button type="button" className="quiet-button" onClick={() => setPanel('notes')}>Quay lại ghi chú</button>
    </section>}
  </section>;
}
