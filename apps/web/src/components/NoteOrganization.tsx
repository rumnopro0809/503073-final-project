import { Pin, PinOff, Tag } from 'lucide-react';
import type { Label, Note } from '../types/notes';
import { LabelChip } from './LabelChip';

export function NoteOrganization({ note, labels, disabled, onPin, onLabel, onManageLabels }: {
  note: Note | null; labels: Label[]; disabled: boolean;
  onPin: (pinned: boolean) => void; onLabel: (id: string, checked: boolean) => void; onManageLabels: () => void;
}) {
  if (!note) return <p className="organization-hint">Sau lần tự lưu đầu tiên, bạn có thể ghim và gắn nhãn cho ghi chú.</p>;
  const assigned = new Set((note.labels ?? []).map(label => label.id));
  return <div className="note-organization">
    <button type="button" className={`quiet-button note-pin ${note.pinned ? 'is-pinned' : ''}`} disabled={disabled}
      aria-pressed={note.pinned} onClick={() => onPin(!note.pinned)}>{note.pinned ? <PinOff size={16} /> : <Pin size={16} />}{note.pinned ? 'Bỏ ghim ghi chú' : 'Ghim ghi chú'}</button>
    <details className="note-label-picker"><summary><Tag size={16} />Nhãn cho ghi chú <span>{assigned.size}</span></summary>
      <fieldset disabled={disabled}><legend className="sr-only">Nhãn cho ghi chú</legend>
        {labels.length ? labels.map(label => <label className="note-label-option" key={label.id}>
          <input type="checkbox" checked={assigned.has(label.id)} onChange={event => onLabel(label.id, event.target.checked)} />
          <i style={{ backgroundColor: label.color }} /><span>{label.name}</span></label>) : <p>Bạn chưa có nhãn nào.</p>}
      </fieldset>
      <button type="button" className="quiet-button" disabled={disabled} onClick={onManageLabels}>Quản lý nhãn</button>
    </details>
    {(note.labels ?? []).length > 0 && <div className="note-labels" aria-label="Nhãn đã gắn">{note.labels.map(label => <LabelChip key={label.id} label={label} />)}</div>}
  </div>;
}
