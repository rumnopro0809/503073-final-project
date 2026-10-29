import { useCallback, useEffect, useRef, useState } from 'react';
import { NoteAutosaver, type AutosaveState } from '../autosave/NoteAutosaver';
import { notesApi } from '../notesApi';
import type { Note, NoteDraft } from '../types/notes';

export function useNoteAutosave(options: { onSaved: (note: Note) => void; onAuthenticationRequired: () => void; authenticationRevision: number; transport?: typeof notesApi }) {
  const engine = useRef<NoteAutosaver | null>(null);
  const callbacks = useRef(options); callbacks.current = options;
  const [state, setState] = useState<AutosaveState | null>(null);
  const open = useCallback((note: Note | null) => {
    engine.current?.dispose();
    const session = new NoteAutosaver({ note, transport: callbacks.current.transport ?? notesApi, onChange: setState,
      onSaved: note => callbacks.current.onSaved(note), onAuthenticationRequired: () => callbacks.current.onAuthenticationRequired() });
    engine.current = session; setState(session.state);
  }, []);
  const close = useCallback(() => { engine.current?.dispose(); engine.current = null; setState(null); }, []);
  const change = useCallback((draft: NoteDraft) => { engine.current?.change(draft); }, []);
  const flush = useCallback(async () => engine.current ? engine.current.flush() : true, []);
  const getState = useCallback(() => engine.current?.state ?? null, []);
  const retry = useCallback(async () => engine.current?.retry(), []);
  const settle = useCallback(async () => engine.current?.settle(), []);
  const readRemote = useCallback(async () => { await engine.current?.readRemote(); }, []);
  const useRemote = useCallback(() => { engine.current?.useRemote(); }, []);
  const keepLocal = useCallback(async () => engine.current?.keepLocal(), []);
  useEffect(() => {
    const online = () => { if (engine.current?.state.status === 'error') void engine.current.retry(); };
    window.addEventListener('online', online);
    return () => { window.removeEventListener('online', online); engine.current?.dispose(); };
  }, []);
  useEffect(() => { if (options.authenticationRevision) void engine.current?.retry(true); }, [options.authenticationRevision]);
  return { state, open, close, change, flush, getState, retry, settle, readRemote, useRemote, keepLocal };
}
