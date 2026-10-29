import type { Note } from './types/notes';
export function isCompleted(note: Note, now = Date.now()) {
  if (!note.daily) return Boolean(note.completed);
  if (!note.completedAt) return false;
  const day = (date: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return day(Date.parse(note.completedAt)) === day(now);
}
export function taskState(note: Note, now = Date.now()) {
  if (isCompleted(note, now)) return 'done';
  const due = note.dueAt ? Date.parse(note.dueAt) : Infinity;
  if (due < now) return 'overdue';
  if (due <= now + 86400000 || note.important) return 'urgent';
  return note.daily ? 'daily' : 'normal';
}
export function priority(note: Note, now = Date.now()) {
  const state = taskState(note, now);
  return state === 'overdue' ? 0 : state === 'urgent' && note.dueAt && Date.parse(note.dueAt) <= now + 86400000 ? 1 : state === 'urgent' ? 2 : 3;
}
export function taskLabel(note: Note, now = Date.now()) {
  const state = taskState(note, now);
  if (state === 'done') return note.daily ? 'Đã xong hôm nay' : 'Đã hoàn thành';
  if (state === 'overdue') return 'Quá hạn';
  if (note.dueAt && Date.parse(note.dueAt) <= now + 86400000) return 'Sắp đến hạn';
  if (note.important) return 'Quan trọng';
  return note.daily ? 'Hằng ngày' : '';
}
export const formatDue = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
