import { api } from './api';
import type { Note, NoteDraft } from './types/notes';

export const notesApi = {
  async read(id: string) { return (await api<{ note: Note }>(`/notes/${id}`)).note; },
  async create(draft: NoteDraft, key: string) {
    return (await api<{ note: Note }>('/notes', draft, { idempotencyKey: key })).note;
  },
  async update(note: Note, draft: NoteDraft) {
    return (await api<{ note: Note }>(`/notes/${note.id}`, { ...draft, version: note.version }, { method: 'PATCH' })).note;
  },
  async remove(id: string) { await api(`/notes/${id}`, {}, { method: 'DELETE' }); },
};
