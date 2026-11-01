import {useEffect,useRef,useState} from 'react';
import {api} from '../api';

type Source={id:string;title:string;excerpt:string;version:number;label:number};
type Result={answer:string;insufficient:boolean;sources:Source[]};
export function NoteQuestions({onAction,onOpenSource,busy}:{onAction:(work:()=>Promise<void>)=>Promise<boolean>;onOpenSource:(id:string)=>void;busy:boolean}){
  const [question,setQuestion]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function ask(){
    if(pending||!question.trim())return;
    setPending(true);setError('');setResult(null);
    const request=new AbortController();controller.current=request;
    try{
      const completed=await onAction(async()=>{
        try{
          const response=await api<Result>('/ai/ask',{question:question.trim()},{signal:request.signal,timeoutMs:40000});
          if(!request.signal.aborted)setResult(response);
        }catch(failure){if(!request.signal.aborted)throw failure;}
      });
      if(!completed&&!request.signal.aborted)setError('Chưa hoàn tất yêu cầu. Hãy kiểm tra ghi chú đã lưu và thử lại.');
    }catch(failure){if(!request.signal.aborted)setError(failure instanceof Error?failure.message:'Chưa trả lời được câu hỏi.');}
    finally{if(!request.signal.aborted)setPending(false);}
  }
  return <section className="workspace-panel note-questions" aria-label="Hỏi AI về ghi chú">
    <h2>Hỏi AI về ghi chú</h2>
    <p>Đặt câu hỏi có từ khóa cụ thể. AI dùng các đoạn liên quan từ ghi chú đã lưu mà bạn được đọc và đã mở khóa; không đọc tệp đính kèm.</p>
    <p>Khi bấm Hỏi AI, câu hỏi và tối đa 6 đoạn ghi chú liên quan được gửi đến Google Gemini. Kiểm tra câu trả lời với nguồn gốc.</p>
    <form onSubmit={event=>{event.preventDefault();void ask();}}>
      <label htmlFor="note-question">Câu hỏi về ghi chú</label>
      <textarea id="note-question" rows={3} maxLength={500} required disabled={busy||pending} value={question} placeholder="Ví dụ: Ai phụ trách quay video?" onChange={event=>{setQuestion(event.target.value);setResult(null);}}/>
      <button type="submit" className="primary-button" disabled={busy||pending||!question.trim()}>{pending?'Đang hỏi AI…':'Hỏi AI'}</button>
    </form>
    {pending&&<p role="status">Đang tìm ghi chú liên quan và tạo câu trả lời…</p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {result&&<div className="ai-answer"><h3>{result.insufficient?'Chưa đủ thông tin':'Câu trả lời'}</h3><p role="status" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{result.answer}</p>
      {result.sources.length>0&&<section aria-label="Nguồn ghi chú"><h3>Nguồn ghi chú</h3><ul>{result.sources.map(source=><li key={source.id}>
        <button type="button" className="quiet-button" disabled={busy} onClick={()=>onOpenSource(source.id)}>[{source.label}] {source.title}</button><small>Phiên bản {source.version} khi trả lời</small>
        <details><summary>Xem đoạn trích nguồn {source.label}</summary><p>{source.excerpt}</p></details>
      </li>)}</ul></section>}
    </div>}
    <p>Kết quả chỉ dùng các đoạn tìm được theo từ khóa, có thể bỏ sót ngữ cảnh. Nguồn thay đổi hoặc bị thu hồi quyền trong khi xử lý sẽ yêu cầu hỏi lại. Câu trả lời không được lưu thành ghi chú.</p>
  </section>;
}
