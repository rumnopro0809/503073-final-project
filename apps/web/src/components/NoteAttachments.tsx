import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { fileBase64 } from '../files';
import { Paperclip } from 'lucide-react';

type Attachment = {id:string;name:string;mediaType:string;size:number;url:string};
export function NoteAttachments({noteId,beforeUpload,readOnly=false}:{noteId:string|null;beforeUpload:()=>Promise<boolean>;readOnly?:boolean}) {
  const input=useRef<HTMLInputElement>(null);
  const [files,setFiles]=useState<Attachment[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const generation=useRef(0);
  useEffect(()=>{
    const current=++generation.current;
    if(!noteId){setFiles([]);setLoading(false);setError('');return;}
    const controller=new AbortController(); setLoading(true); setError('');
    void api<{attachments:Attachment[]}>(`/attachments/notes/${noteId}`,undefined,{signal:controller.signal}).then(result=>{if(current===generation.current) setFiles(result.attachments);}).catch(failure=>{if(!controller.signal.aborted) setError((failure as Error).message);}).finally(()=>{if(!controller.signal.aborted) setLoading(false);});
    return ()=>{++generation.current;controller.abort();};
  },[noteId,revision]);
  async function upload(file:File) {
    if(!noteId)return;
    const current=generation.current;
    setBusy(true);setError('');
    try {
      if(!await beforeUpload()) {setError('Chưa lưu được nội dung ghi chú. Hãy chờ Đã lưu rồi thêm tệp lại.');return;}
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
  const picker=!readOnly&&<><button type="button" className="quiet-button attach-file-button" title={!noteId?'Nhập tiêu đề và nội dung, chờ Đã lưu để thêm tệp vào ghi chú.':'Thêm tệp vào ghi chú đang mở · tối đa 10 MB/tệp'} disabled={!noteId||busy||loading} onClick={()=>input.current?.click()}><Paperclip size={17}/>Thêm tệp đính kèm</button>
    <input ref={input} aria-label="Đính kèm tệp" type="file" hidden disabled={!noteId||busy||loading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file) void upload(file);}} /></>;
  return <section className="note-attachments" aria-label="Tệp đính kèm">
    <h3>Tệp đính kèm</h3>
    <p>Ảnh, video hoặc tệp · tối đa 10 MB/tệp, 20 tệp/ghi chú. Ảnh PNG/JPEG/WebP và video MP4/WebM có bản xem trước.</p>
    {picker}
    {!readOnly&&!noteId&&<p>Nhập tiêu đề và nội dung, chờ Đã lưu để thêm tệp vào ghi chú.</p>}
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
