import { api } from './api';
import type { Label, Note, NoteDraft } from './types/notes';

export const notesApi = {
  async reminder(note: Note, changes: { dueAt?: string | null; important?: boolean; daily?: boolean; completed?: boolean }) {
    return (await api<{ note: Note }>(`/notes/${note.id}/reminder`, { ...changes, version: note.version }, { method: 'PATCH' })).note;
  },
  async read(id: string) { return (await api<{ note: Note }>(`/notes/${id}`)).note; },
  async create(draft: NoteDraft, key: string) {
    return (await api<{ note: Note }>('/notes', draft, { idempotencyKey: key })).note;
  },
  async update(note: Note, draft: NoteDraft) {
    return (await api<{ note: Note }>(`/notes/${note.id}`, { ...draft, version: note.version }, { method: 'PATCH' })).note;
  },
  async remove(id: string) { await api(`/notes/${id}`, {}, { method: 'DELETE' }); },
  async organize(note: Note, changes: { pinned?: boolean; labelIds?: string[] }) {
    return (await api<{ note: Note }>(`/notes/${note.id}/organization`, { ...changes, version: note.version }, { method: 'PATCH' })).note;
  },
};

export const labelsApi = {
  async list(signal?: AbortSignal) { return (await api<{ labels: Label[] }>('/labels', undefined, { signal })).labels; },
  async create(values: Pick<Label, 'name' | 'color'>) { return (await api<{ label: Label }>('/labels', values)).label; },
  async update(id: string, values: Pick<Label, 'name' | 'color'>) {
    return (await api<{ label: Label }>(`/labels/${id}`, values, { method: 'PATCH' })).label;
  },
  async remove(id: string) { await api(`/labels/${id}`, {}, { method: 'DELETE' }); },
};
