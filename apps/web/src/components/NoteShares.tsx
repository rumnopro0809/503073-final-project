import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
type Share={recipientId:string;email:string;displayName:string;permission:'read'|'write'};
export function NoteShares({noteId,onAction}:{noteId:string;onAction:(work:()=>Promise<void>)=>Promise<boolean>}) {
  const [shares,setShares]=useState<Share[]>([]),[emails,setEmails]=useState(''),[permission,setPermission]=useState<'read'|'write'>('read');
  const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{if(!expanded)return;const controller=new AbortController();setBusy(true);
    void api<{shares:Share[]}>(`/notes/${noteId}/shares`,undefined,{signal:controller.signal}).then(result=>setShares(result.shares)).catch(failure=>{if(!controller.signal.aborted)setError((failure as Error).message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();
  },[noteId,expanded]);
  async function change(work:()=>Promise<void>) {
    setBusy(true);setError('');setMessage('');
    try {if(await onAction(async()=>{await work();setShares((await api<{shares:Share[]}>(`/notes/${noteId}/shares`)).shares);})) setMessage('Đã cập nhật chia sẻ.');}
    catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  function submit(event:FormEvent){event.preventDefault();void change(async()=>{await api(`/notes/${noteId}/shares`,{emails:emails.split(/[,;\n]/).map(email=>email.trim()).filter(Boolean),permission});setEmails('');});}
  return <details className="note-sharing" onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Chia sẻ ghi chú</summary><p>Chia sẻ cho tài khoản đã đăng ký. Người nhận được thông báo trong ứng dụng.</p>
    <form onSubmit={submit}><label>Email người nhận<textarea value={emails} required disabled={busy} placeholder="ban@example.com, nguoi-khac@example.com" onChange={event=>setEmails(event.target.value)}/></label>
      <label>Quyền chia sẻ<select value={permission} disabled={busy} onChange={event=>setPermission(event.target.value as 'read'|'write')}><option value="read">Chỉ đọc</option><option value="write">Được sửa</option></select></label>
      <button className="quiet-button" disabled={busy}>Chia sẻ</button></form>
    {busy&&<p role="status">Đang cập nhật chia sẻ…</p>}{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <ul>{shares.map(share=><li key={share.recipientId}><strong>{share.displayName}</strong><span>{share.email}</span>
      <label>Quyền của {share.email}<select value={share.permission} disabled={busy} onChange={event=>void change(async()=>{await api(`/notes/${noteId}/shares`,{emails:[share.email],permission:event.target.value});})}><option value="read">Chỉ đọc</option><option value="write">Được sửa</option></select></label>
      <button type="button" className="quiet-button" disabled={busy} onClick={()=>{if(window.confirm(`Thu hồi chia sẻ với ${share.email}?`))void change(async()=>{await api(`/notes/${noteId}/shares/${share.recipientId}`,{},{method:'DELETE'});});}}>Thu hồi {share.email}</button></li>)}</ul>
  </details>;
}
