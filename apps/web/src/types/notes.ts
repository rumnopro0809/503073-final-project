export interface Note {
  id: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

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
