import { useState } from 'react';
import type { Note } from '../types/notes';
import { isCompleted } from '../reminders';
export type ReminderChanges = { dueAt?: string | null; important?: boolean; daily?: boolean; completed?: boolean };
const localValue = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
};
export function NoteReminder({ note, busy, onChange }: { note: Note; busy: boolean; onChange: (changes: ReminderChanges) => Promise<boolean> }) {
  const [time, setTime] = useState(localValue(note.dueAt));
  const [error, setError] = useState('');
  return <fieldset className="note-reminder" disabled={busy}><legend>Nhắc việc · tùy chọn</legend>
    <div className="reminder-options">
      <label><input type="checkbox" checked={isCompleted(note)} onChange={event => void onChange({ completed: event.target.checked })} />{note.daily ? 'Đã xong hôm nay' : 'Đã hoàn thành'}</label>
      <label><input type="checkbox" checked={note.important} onChange={event => void onChange({ important: event.target.checked })} />Quan trọng</label>
      <label><input type="checkbox" checked={note.daily} onChange={event => void onChange({ daily: event.target.checked, dueAt: null, completed: false })} />Việc hằng ngày</label>
    </div>
    {!note.daily && <div className="reminder-time"><label>Thời gian nhắc<input type="datetime-local" value={time} onChange={event => { setTime(event.target.value); setError(''); }} /></label>
      <button type="button" className="quiet-button" onClick={async () => {
        if (!time || !Number.isFinite(new Date(time).getTime())) { setError('Chọn ngày và giờ hợp lệ.'); return; }
        await onChange({ dueAt: new Date(time).toISOString(), completed: false });
      }}>Đặt nhắc việc</button>
      {note.dueAt && <button type="button" className="quiet-button" onClick={() => void onChange({ dueAt: null })}>Bỏ thời gian</button>}
    </div>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <p>{note.daily ? 'Tick được làm mới mỗi ngày theo giờ Việt Nam. Việc hằng ngày có màu xanh.' : 'Vàng: quan trọng hoặc đến hạn trong 24 giờ. Đỏ: quá hạn chưa hoàn thành. Giờ hiển thị theo thiết bị.'}</p>
  </fieldset>;
}
