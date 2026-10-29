import { useId, useRef, useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import type { Label } from '../types/notes';
import { useEntrance } from '../hooks/useEntrance';
import { LabelChip } from './LabelChip';

const COLORS = [
  ['#8b6bb1', 'Tím'], ['#3c8270', 'Xanh lá'], ['#b47c35', 'Vàng'],
  ['#b75d78', 'Hồng'], ['#527db5', 'Xanh dương'], ['#737784', 'Xám'],
] as const;

export type LabelAction = { kind: 'create'; values: Pick<Label, 'name' | 'color'> }
  | { kind: 'update'; id: string; values: Pick<Label, 'name' | 'color'> }
  | { kind: 'delete'; id: string };

export function LabelManager({ labels, busy, onAction, onClose }: {
  labels: Label[]; busy: boolean; onAction: (action: LabelAction) => Promise<boolean>; onClose: () => void;
}) {
  const id = useId();
  const container = useRef<HTMLElement>(null);
  useEntrance(container);
  const input = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(COLORS[0][0]);
  const [error, setError] = useState('');
  function reset() { setEditingId(null); setName(''); setColor(COLORS[0][0]); setError(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('Nhập tên nhãn từ 1 đến 40 ký tự.'); input.current?.focus(); return; }
    const values = { name: name.trim(), color };
    if (await onAction(editingId ? { kind: 'update', id: editingId, values } : { kind: 'create', values })) {
      reset();
    }
  }
  return <section ref={container} className="label-manager" aria-labelledby={`${id}-heading`}>
    <header><div><h3 id={`${id}-heading`}><Tag size={17} /> Quản lý nhãn</h3><p>Dùng nhãn để nhóm bài học, công việc và ý tưởng.</p></div>
      <button type="button" className="icon-button" aria-label="Đóng quản lý nhãn" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    <form onSubmit={event => void submit(event)} className="label-form" aria-busy={busy}>
      <label htmlFor={`${id}-name`}>{editingId ? 'Tên nhãn mới' : 'Tên nhãn'}</label>
      <div className="label-name-row"><input ref={input} id={`${id}-name`} value={name} maxLength={40} disabled={busy}
        placeholder="Ví dụ: Học tập" onChange={event => { setName(event.target.value); setError(''); }} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined} />
        <button type="submit" className="quiet-button" disabled={busy}>{editingId ? <Check size={16} /> : <Plus size={16} />}{editingId ? 'Cập nhật nhãn' : 'Tạo nhãn'}</button>
        {editingId && <button type="button" className="quiet-button" disabled={busy} onClick={reset}>Hủy chỉnh sửa</button>}</div>
      <fieldset className="label-colors" disabled={busy}><legend>Màu nhãn</legend>{COLORS.map(([value, text]) => <label key={value} title={text}>
        <input type="radio" name={`${id}-color`} value={value} checked={color === value} onChange={() => setColor(value)} aria-label={text} />
        <span style={{ backgroundColor: value }}>{color === value && <Check size={14} />}</span></label>)}</fieldset>
      {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
    </form>
    {labels.length === 0 ? <p className="labels-empty">Chưa có nhãn. Tạo nhãn đầu tiên ở trên rồi gắn vào ghi chú.</p>
      : <ul className="label-manager-list">{labels.map(label => <li key={label.id}><LabelChip label={label} />
        <div><button type="button" className="icon-button" disabled={busy} aria-label={`Chỉnh sửa nhãn ${label.name}`} onClick={() => {
          setEditingId(label.id); setName(label.name); setColor(label.color); setError(''); input.current?.focus();
        }}><Pencil size={15} /></button>
        <button type="button" className="icon-button label-delete" disabled={busy} aria-label={`Xóa nhãn ${label.name}`} onClick={async () => {
          if (!window.confirm(`Xóa nhãn “${label.name}”? Các ghi chú vẫn được giữ lại.`)) return;
          if (await onAction({ kind: 'delete', id: label.id }) && editingId === label.id) reset();
        }}><Trash2 size={15} /></button></div></li>)}</ul>}
  </section>;
}
