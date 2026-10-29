import type { CSSProperties } from 'react';
import { Star } from 'lucide-react';
import type { Label } from '../types/notes';

export function ImportantBadge() {
  return <span className="important-badge"><Star size={13} fill="currentColor" aria-hidden="true" />Quan trọng</span>;
}
export function LabelChip({ label }: { label: Label }) {
  const important = label.name.trim().toLocaleLowerCase('vi') === 'quan trọng';
  return <span className={`label-chip colored-label ${important ? 'label-important' : ''}`}
    style={{ '--label-color': important ? '#b77908' : label.color } as CSSProperties}>
    {important ? <Star size={12} fill="currentColor" aria-hidden="true" /> : <i style={{ backgroundColor: label.color }} />}{label.name}
  </span>;
}
