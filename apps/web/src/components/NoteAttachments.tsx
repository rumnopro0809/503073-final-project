import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { fileBase64 } from '../files';

type Attachment = {id:string;name:string;mediaType:string;size:number;url:string};
export function NoteAttachments({noteId,beforeUpload,readOnly=false}:{noteId:string;beforeUpload:()=>Promise<boolean>;readOnly?:boolean}) {
  const [files,setFiles]=useState<Attachment[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const generation=useRef(0);
  useEffect(()=>{
    const current=++generation.current;
    const controller=new AbortController(); setLoading(true); setError('');
    void api<{attachments:Attachment[]}>(`/attachments/notes/${noteId}`,undefined,{signal:controller.signal}).then(result=>{if(current===generation.current) setFiles(result.attachments);}).catch(failure=>{if(!controller.signal.aborted) setError((failure as Error).message);}).finally(()=>{if(!controller.signal.aborted) setLoading(false);});
    return ()=>{++generation.current;controller.abort();};
  },[noteId,revision]);
  async function upload(file:File) {
    const current=generation.current;
    setBusy(true);setError('');
    try {
      if(!await beforeUpload()) return;
      if(current!==generation.current) return;
      const data=await fileBase64(file,10*1024*1024);
      if(current!==generation.current) return;
      const result=await api<{attachment:Attachment}>(`/attachments/notes/${noteId}`,{name:file.name,data});
      if(current===generation.current) setFiles(old=>[...old,result.attachment]);
    } catch(failure) {if(current===generation.current) setError((failure as Error).message);}
    finally {if(current===generation.current) setBusy(false);}
  }
  async function remove(file:Attachment) {
    if(!window.confirm(`Xóa tệp đính kèm “${file.name}”?`)) return;
    const current=generation.current;setBusy(true);setError('');
    try { await api(`/attachments/${file.id}`,{},{method:'DELETE'}); if(current===generation.current) setFiles(old=>old.filter(item=>item.id!==file.id)); }
    catch(failure) {if(current===generation.current) setError((failure as Error).message);}
    finally {if(current===generation.current) setBusy(false);}
  }
  return <section className="note-attachments" aria-label="Tệp đính kèm"><h3>Tệp đính kèm</h3>
    <p>Ảnh, video hoặc tệp · tối đa 10 MB/tệp, 20 tệp/ghi chú. Ảnh PNG/JPEG/WebP và video MP4/WebM có bản xem trước.</p>
    {!readOnly&&<label>Đính kèm tệp<input type="file" disabled={busy||loading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file) void upload(file);}} /></label>}
    {(busy||loading)&&<p role="status">{busy?'Đang xử lý tệp…':'Đang tải tệp…'}</p>}
    {error&&<div><p className="notice error" role="alert">{error}</p><button type="button" className="quiet-button" disabled={busy} onClick={()=>setRevision(value=>value+1)}>Thử tải tệp lại</button></div>}
    <ul>{files.map(file=><li key={file.id}>
      {file.mediaType.startsWith('image/')&&<img src={file.url} alt={file.name} loading="lazy" />}
      {file.mediaType.startsWith('video/')&&<video src={file.url} controls preload="metadata" aria-label={file.name} />}
      <a href={`${file.url}?download=1`} download={file.name}>{file.name} · {(file.size/1024).toFixed(1)} KB</a>
      {!readOnly&&<button type="button" className="quiet-button" disabled={busy} onClick={()=>void remove(file)}>Xóa tệp {file.name}</button>}
    </li>)}</ul>
  </section>;
}
