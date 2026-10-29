export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  version: number;
  pinned: boolean;
  pinnedAt: string | null;
  labels: Label[];
  createdAt: string;
  updatedAt: string;
}

export type NoteSort = 'updated' | 'created' | 'title';

export type NoteDraft = Pick<Note, 'title' | 'content'>;

export type NoteSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';

export interface NotesResponse {
  notes: Note[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
