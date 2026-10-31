import { useState, type FormEvent } from 'react';
import type { Note } from '../types/notes';
export type ProtectionChange = {password:string|null;confirmPassword?:string;currentPassword?:string};
export function NoteSecurity({note,busy,onProtect,onLock}:{note:Note;busy:boolean;onProtect:(change:ProtectionChange)=>Promise<boolean>;onLock:()=>void}) {
  const [currentPassword,setCurrent]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirm]=useState('');
  const [message,setMessage]=useState('');
  async function apply(event:FormEvent) {event.preventDefault();if(await onProtect({password,confirmPassword,currentPassword})) {setCurrent('');setPassword('');setConfirm('');setMessage('Đã cập nhật bảo vệ ghi chú.');}}
  return <details className="note-security"><summary>{note.protected?'Đang bảo vệ bằng mật khẩu':'Bảo vệ ghi chú bằng mật khẩu'}</summary>
    <p>Mật khẩu này riêng cho ghi chú. Mỗi phiên mở khóa trong 15 phút; khóa lại khi dùng xong.</p>
    <form onSubmit={apply}>
      {note.protected&&<label>Mật khẩu ghi chú hiện tại<input type="password" autoComplete="off" value={currentPassword} required disabled={busy} onChange={event=>setCurrent(event.target.value)}/></label>}
      <label>Mật khẩu ghi chú mới<input type="password" autoComplete="new-password" minLength={8} required value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></label>
      <label>Nhập lại mật khẩu ghi chú<input type="password" autoComplete="new-password" required value={confirmPassword} disabled={busy} onChange={event=>setConfirm(event.target.value)}/></label>
      <button className="quiet-button" disabled={busy}>{note.protected?'Đổi mật khẩu ghi chú':'Bật bảo vệ'}</button>
    </form>
    {note.protected&&<div className="notes-actions"><button type="button" className="quiet-button" disabled={busy} onClick={async()=>{if(await onProtect({password:null,currentPassword})) {setCurrent('');setMessage('Đã tắt bảo vệ ghi chú.');}}}>Tắt bảo vệ</button><button type="button" className="quiet-button" disabled={busy} onClick={onLock}>Khóa lại ghi chú</button></div>}
    {message&&<p role="status">{message}</p>}
  </details>;
}
