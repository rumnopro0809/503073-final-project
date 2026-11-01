import {useEffect,useRef,useState} from 'react';
import {api} from '../api';

type Result={summary:string;sourceVersion:number;generatedAt:string};
export function NoteSummary({noteId,version,dirty,busy,onAction}:{noteId:string;version:number;dirty:boolean;busy:boolean;onAction:(work:()=>Promise<void>)=>Promise<boolean>}){
  const [result,setResult]=useState<Result|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  // Any edit invalidates the displayed summary; never label an old summary as current.
  useEffect(()=>{setResult(previous=>!dirty&&previous?.sourceVersion===version?previous:null);},[version,dirty]);
  async function generate(){
    if(pending)return;setPending(true);setError('');setResult(null);
    const request=new AbortController();controller.current=request;
    try{
      await onAction(async()=>{
        try{
          const next=await api<Result>(`/notes/${noteId}/summary`,{}, {signal:request.signal,timeoutMs:40000});
          if(!request.signal.aborted)setResult(next);
        }catch(failure){if(!request.signal.aborted)setError(failure instanceof Error?failure.message:'Chưa tạo được tóm tắt.');}
      });
    }finally{if(!request.signal.aborted)setPending(false);}
  }
  return <section className="note-ai-summary" aria-label="AI Summary">
    <h3>Tóm tắt bằng AI</h3>
    <p>Khi bấm tóm tắt, tiêu đề và nội dung ghi chú đã lưu sẽ được gửi đến Google Gemini. Kết quả có thể sai; hãy kiểm tra với ghi chú gốc.</p>
    <button type="button" className="quiet-button" disabled={busy||pending} onClick={()=>void generate()}>{pending?'Đang tóm tắt…':result?'Tóm tắt lại bằng AI':'Tóm tắt bằng AI'}</button>
    {pending&&<p role="status">Đang tạo bản tóm tắt…</p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {result&&!dirty&&<div className="ai-summary-result" role="status"><strong>Bản tóm tắt · phiên bản {result.sourceVersion}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{result.summary}</p></div>}
  </section>;
}
