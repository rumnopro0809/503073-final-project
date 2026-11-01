import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {LiveSession,type LiveView} from '../src/liveSession';

class Socket {
  readyState=1;
  onmessage:((event:{data:string})=>void)|null=null;
  onclose:(()=>void)|null=null;
  onerror:(()=>void)|null=null;
  sent:{epoch:string;update:string;seq:number}[]=[];
  send(data:string){this.sent.push(JSON.parse(data));}
  close(){this.readyState=3;this.onclose?.();}
  receive(data:object){this.onmessage?.({data:JSON.stringify(data)});}
}
const encode=(doc:Y.Doc)=>Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
function setup(readOnly=false){
  const sockets:Socket[]=[];let view:LiveView;
  const session=new LiveSession('ws://test',next=>{view=next;},()=>{const socket=new Socket();sockets.push(socket);return socket as unknown as WebSocket;});
  const doc=new Y.Doc();doc.getText('title').insert(0,'Title');doc.getText('content').insert(0,'Body');
  session.connect();sockets[0].receive({type:'state',update:encode(doc),epoch:'original',readOnly});
  return {session,sockets,doc,get view(){return view!;}};
}
test('only an acknowledgement for the latest local revision clears dirty, and flush waits for commit',async()=>{
  const live=setup();
  try{
    live.session.edit('content','Body first');
    const flush=live.session.flush();const first=live.sockets[0].sent[0];assert.ok(first);assert.equal(live.view.dirty,true);
    live.session.edit('content','Body first second');
    live.sockets[0].receive({type:'state',update:first.update,epoch:'original',ack:first.seq});
    assert.equal(live.view.dirty,true);
    const secondFlush=live.session.flush(),latest=live.sockets[0].sent.at(-1)!;
    live.sockets[0].receive({type:'state',update:latest.update,epoch:'original'});
    assert.equal(live.view.dirty,true,'another peer broadcast is not an ACK');
    live.sockets[0].receive({type:'state',update:latest.update,epoch:'original',ack:latest.seq});
    assert.equal(await flush,true);assert.equal(await secondFlush,true);assert.equal(live.view.status,'Đã đồng bộ');
  }finally{live.session.destroy();}
});
test('reconnecting merges pending local text and remote changes before resending',async()=>{
  const live=setup();
  try{
    live.session.edit('content','Body offline');live.sockets[0].close();
    live.doc.getText('content').insert(0,'Remote ');
    live.session.connect();const socket=live.sockets.at(-1)!;
    socket.receive({type:'state',epoch:'original',update:encode(live.doc),readOnly:false});
    assert.equal(live.view.content,'Remote Body offline');assert.equal(live.view.dirty,true);
    assert.equal(socket.sent.length,1);
    const sent=socket.sent[0];socket.receive({type:'state',epoch:'original',update:sent.update,ack:sent.seq});
    assert.equal(live.view.dirty,false);
  }finally{live.session.destroy();}
});
test('changed document epoch preserves an unsaved draft and stops automatic overwrites',async()=>{
  const live=setup();
  try{
    live.session.edit('content','My draft');live.sockets[0].close();live.session.connect();
    live.sockets.at(-1)!.receive({type:'state',epoch:'new',update:encode(live.doc),readOnly:false});
    assert.equal(live.view.content,'My draft');assert.equal(live.view.dirty,true);assert.equal(live.view.readOnly,true);
    assert.equal(await live.session.flush(),false);
  }finally{live.session.destroy();}
});
test('read-only viewing blocks edits and revoked access preserves an unsent draft for copying',()=>{
  const viewer=setup(true),writer=setup();
  try{
    viewer.session.edit('content','Forbidden');assert.equal(viewer.view.content,'Body');assert.equal(viewer.session.dirty,false);
    writer.session.edit('content','Keep my draft');writer.sockets[0].receive({type:'error',code:'ACCESS_DENIED'});
    assert.equal(writer.view.content,'Keep my draft');assert.equal(writer.view.readOnly,true);assert.equal(writer.view.dirty,true);
  }finally{viewer.session.destroy();writer.session.destroy();}
});
