import * as Y from 'yjs';

export type LiveView={title:string;content:string;dirty:boolean;readOnly:boolean;status:string};
export class LiveSession {
  doc=new Y.Doc();
  private socket:WebSocket|null=null;
  private epoch='';
  private ready=false;
  private stopped=false;
  private revision=0;
  private saved=0;
  private sequence=0;
  private pending=new Map<number,number>();
  private timer:ReturnType<typeof setTimeout>|undefined;
  private reconnect:ReturnType<typeof setTimeout>|undefined;
  private attempts=0;
  private readOnly=true;
  private status='Đang kết nối…';
  constructor(private url:string,private changed:(view:LiveView)=>void,private makeSocket=(url:string)=>new WebSocket(url)){}
  get dirty(){return this.revision>this.saved;}
  private emit(){this.changed({title:this.doc.getText('title').toString(),content:this.doc.getText('content').toString(),dirty:this.dirty,readOnly:this.readOnly||this.stopped,status:this.status});}
  connect(){
    if(this.stopped)return;
    const socket=this.makeSocket(this.url);this.socket=socket;this.ready=false;
    socket.onmessage=event=>{
      if(this.socket!==socket||this.stopped)return;
      try{
        const packet=JSON.parse(String(event.data));
        if(packet.type==='error'){
          this.stopped=true;this.status=packet.code==='EXTERNAL_CHANGE'?'Ghi chú đã đổi ở trình sửa thường. Sao chép bản nháp, đóng và mở lại để kiểm tra.':packet.code==='ACCESS_DENIED'?'Phiên đăng nhập, quyền chia sẻ hoặc khóa ghi chú đã thay đổi. Đóng và mở lại để kiểm tra.':'Chưa đồng bộ được. Sao chép bản nháp trước khi đóng.';
          socket.close();this.emit();return;
        }
        if(packet.type!=='state'||typeof packet.update!=='string'||typeof packet.epoch!=='string')return;
        if(this.epoch&&packet.epoch!==this.epoch){
          if(this.dirty){this.stopped=true;this.status='Bản máy chủ đã thay đổi. Sao chép bản nháp trước khi đóng và mở lại.';socket.close();this.emit();return;}
          this.doc.destroy();this.doc=new Y.Doc();
        }
        this.epoch=packet.epoch;
        Y.applyUpdate(this.doc,Uint8Array.from(atob(packet.update),char=>char.charCodeAt(0)));
        if(typeof packet.readOnly==='boolean')this.readOnly=packet.readOnly;
        if(typeof packet.ack==='number'){
          this.saved=Math.max(this.saved,this.pending.get(packet.ack)??0);
          for(const seq of this.pending.keys())if(seq<=packet.ack)this.pending.delete(seq);
        }
        const first=!this.ready;this.ready=true;this.attempts=0;
        this.status=this.dirty?'Đang đồng bộ…':this.readOnly?'Đang xem trực tiếp · Chỉ đọc':'Đã đồng bộ';this.emit();
        if(first&&this.dirty)this.send();
      }catch{this.stopped=true;this.status='Không đọc được dữ liệu đồng bộ. Sao chép bản nháp trước khi đóng.';socket.close();this.emit();}
    };
    socket.onerror=()=>{};
    socket.onclose=()=>{
      if(this.socket!==socket||this.stopped)return;
      this.ready=false;this.status='Mất kết nối · Đang thử lại, hãy giữ trang mở';this.emit();
      this.reconnect=setTimeout(()=>this.connect(),Math.min(1000*2**this.attempts++,15000));
    };
  }
  edit(key:'title'|'content',value:string){
    if(this.stopped||this.readOnly||!this.epoch)return;
    const text=this.doc.getText(key),old=text.toString();if(old===value)return;
    let start=0,end=0;
    while(start<old.length&&start<value.length&&old[start]===value[start])start++;
    while(end<old.length-start&&end<value.length-start&&old[old.length-1-end]===value[value.length-1-end])end++;
    this.doc.transact(()=>{text.delete(start,old.length-start-end);text.insert(start,value.slice(start,value.length-end));});
    this.revision++;this.status=this.ready?'Đang đồng bộ…':'Mất kết nối · Bản nháp chưa đồng bộ';this.emit();
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.send(),180);
  }
  private send(){
    if(!this.ready||this.stopped||!this.dirty||this.socket?.readyState!==1)return;
    const title=this.doc.getText('title').toString(),content=this.doc.getText('content').toString();
    if(!title.trim()||!content.trim()||title.length>200||content.length>100000){this.status='Cần tiêu đề và nội dung hợp lệ để đồng bộ';this.emit();return;}
    const update=Y.encodeStateAsUpdate(this.doc);
    // Chunk conversion avoids the argument limit on larger notes.
    let binary='';for(const byte of update)binary+=String.fromCharCode(byte);
    const seq=++this.sequence;this.pending.set(seq,this.revision);
    this.socket.send(JSON.stringify({epoch:this.epoch,update:btoa(binary),seq}));
  }
  async flush(){
    if(!this.dirty)return true;
    clearTimeout(this.timer);this.send();
    const deadline=Date.now()+5000;
    while(this.dirty&&!this.stopped&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,40));
    return !this.dirty;
  }
  destroy(){this.stopped=true;clearTimeout(this.timer);clearTimeout(this.reconnect);this.socket?.close();this.doc.destroy();}
}
