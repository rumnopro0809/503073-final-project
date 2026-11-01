import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import {LiveSession,type LiveView} from '../liveSession';

type Props={noteId:string;busy?:boolean;onClose:()=>void;onDirty:(dirty:boolean)=>void;flushRef:MutableRefObject<(()=>Promise<boolean>)|null>};
export function CollaborativeEditor({noteId,busy=false,onClose,onDirty,flushRef}:Props){
  const title=useRef<HTMLInputElement>(null),content=useRef<HTMLTextAreaElement>(null),session=useRef<LiveSession|null>(null);
  const [view,setView]=useState<LiveView>({title:'',content:'',dirty:false,readOnly:true,status:'Đang kết nối…'});
  useEffect(()=>{
    function render(next:LiveView){
      for(const [key,element] of [['title',title.current],['content',content.current]] as const){
        if(!element||element.value===next[key])continue;
        const start=element.selectionStart??0,end=element.selectionEnd??start,old=element.value;
        let prefix=0;while(prefix<old.length&&prefix<next[key].length&&old[prefix]===next[key][prefix])prefix++;
        const shift=next[key].length-old.length;
        element.value=next[key];
        if(document.activeElement===element)element.setSelectionRange(Math.max(0,start<=prefix?start:start+shift),Math.max(0,end<=prefix?end:end+shift));
      }
      setView(next);onDirty(next.dirty);
    }
    const live=new LiveSession(`${window.location.protocol==='https:'?'wss:':'ws:'}//${window.location.host}/api/live/${noteId}`,render);
    session.current=live;flushRef.current=()=>live.flush();live.connect();
    return()=>{flushRef.current=null;session.current=null;live.destroy();onDirty(false);};
  },[noteId,onDirty,flushRef]);
  return <section className="note-editor" aria-label="Cộng tác trực tiếp">
    <header className="note-editor-header"><h2>Cộng tác trực tiếp</h2><button type="button" className="quiet-button" disabled={busy} onClick={onClose}>Đóng cộng tác</button></header>
    <p>Mở cùng ghi chú và chọn “Cộng tác trực tiếp” ở tài khoản được chia sẻ để cùng chỉnh sửa.</p>
    <div className="note-editor-fields">
      <label htmlFor="live-title">Tiêu đề trực tiếp</label><input id="live-title" ref={title} readOnly={view.readOnly||busy} maxLength={200} onChange={event=>session.current?.edit('title',event.target.value)}/>
      <label htmlFor="live-content">Nội dung trực tiếp</label><textarea id="live-content" ref={content} rows={10} readOnly={view.readOnly||busy} maxLength={100000} onChange={event=>session.current?.edit('content',event.target.value)}/>
    </div>
    <p role="status" aria-live="polite">{view.status}</p>
    <p className="draft-explanation">Chờ “Đã đồng bộ” trước khi rời trang. Khi mất mạng, giữ trang mở để tự kết nối lại; bản nháp chưa đồng bộ chỉ nằm trong phiên này.</p>
  </section>;
}
