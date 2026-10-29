import { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, StickyNote, X } from 'lucide-react';
import type { NoteDraft, NoteSaveStatus } from '../types/notes';

export interface NoteEditorProps {
  draft: NoteDraft;
  isNew: boolean;
  onChange: (draft: NoteDraft) => void;
  onClose: () => void;
  saveStatus: NoteSaveStatus;
  saveError?: string;
  fieldErrors?: Partial<Record<keyof NoteDraft, string>>;
}

const statusLabels: Record<NoteSaveStatus, string> = {
  idle: 'Bản nháp mới', unsaved: 'Bản nháp chưa lưu', saving: 'Đang lưu…',
  saved: 'Đã lưu', error: 'Chưa lưu được', conflict: 'Có thay đổi từ phiên khác',
};

// A controlled form: persistence belongs to the autosave hook that consumes onChange.
export function NoteEditor({ draft, isNew, onChange, onClose, saveStatus, saveError, fieldErrors }: NoteEditorProps) {
  const id = useId();
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { titleInput.current?.focus(); }, []);
  return <section className="note-editor" aria-labelledby={`${id}-heading`}>
    <header className="note-editor-header">
      <div className="note-editor-heading"><StickyNote size={18} /><h2 id={`${id}-heading`}>{isNew ? 'Ghi chú mới' : 'Chỉnh sửa ghi chú'}</h2></div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng trình soạn ghi chú"><X size={19} /></button>
    </header>
    <div className="note-editor-fields">
      <label htmlFor={`${id}-title`}>Tiêu đề</label>
      <input ref={titleInput} id={`${id}-title`} name="title" value={draft.title} maxLength={200} required
        placeholder="Đặt tên cho ý tưởng này…" aria-invalid={Boolean(fieldErrors?.title)}
        aria-describedby={fieldErrors?.title ? `${id}-title-error` : undefined}
        onChange={event => onChange({ ...draft, title: event.target.value })} />
      {fieldErrors?.title && <p id={`${id}-title-error`} className="field-error">{fieldErrors.title}</p>}
      <label htmlFor={`${id}-content`}>Nội dung</label>
      <textarea id={`${id}-content`} name="content" value={draft.content} maxLength={100000} rows={10} required
        placeholder="Viết xuống những điều bạn muốn nhớ…" aria-invalid={Boolean(fieldErrors?.content)}
        aria-describedby={fieldErrors?.content ? `${id}-content-error` : undefined}
        onChange={event => onChange({ ...draft, content: event.target.value })} />
      {fieldErrors?.content && <p id={`${id}-content-error`} className="field-error">{fieldErrors.content}</p>}
    </div>
    <footer className="note-editor-footer">
      <span className={`note-save-status ${saveStatus}`} role="status" aria-live="polite">
        {saveStatus === 'saving' ? <LoaderCircle size={15} className="spin" />
          : saveStatus === 'saved' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
        {statusLabels[saveStatus]}
      </span>
      <span className="note-character-count">{draft.content.length.toLocaleString('vi-VN')} / 100.000</span>
    </footer>
    {saveError && <p className="notice error" role="alert">{saveError}</p>}
    {(saveStatus === 'idle' || saveStatus === 'unsaved') && <p className="draft-explanation">Nội dung đang ở bản nháp trên trang này và chưa được lưu vào tài khoản.</p>}
  </section>;
}
