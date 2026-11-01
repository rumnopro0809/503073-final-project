import {randomUUID} from 'node:crypto';
import type {Server} from 'node:http';
import type {Request} from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import * as Y from 'yjs';
import type {Database,Sql} from './database.js';
import {findSessionUser,SESSION_COOKIE} from './session.js';
import {accessibleNote,isUnlocked} from './noteAccess.js';

type Peer={socket:WebSocket;req:Request;id:string};
type Row=Record<string,unknown>&{title:string;content:string;version:number;live_state:Uint8Array|null;live_epoch:string|null};
class LiveError extends Error {constructor(public code:string){super(code);}}
async function authorize(sql:Sql,peer:Peer,write=false,lock=false){
  const user=await findSessionUser(sql,peer.req);
  const note=user&&await accessibleNote(sql,peer.id,user.id,write?'write':'read',lock);
  if(!note||!await isUnlocked(sql,peer.req,note))throw new LiveError('ACCESS_DENIED');
  return note;
}
async function document(sql:Sql,id:string){
  const row=(await sql.query<Row>('SELECT title,content,version,live_state,live_epoch FROM notes WHERE id=$1',[id])).rows[0];
  let doc=new Y.Doc();let epoch=row.live_epoch;
  if(row.live_state)Y.applyUpdate(doc,row.live_state);
  if(!row.live_state||doc.getText('title').toString()!==row.title||doc.getText('content').toString()!==row.content){
    doc.destroy();doc=new Y.Doc();doc.getText('title').insert(0,row.title);doc.getText('content').insert(0,row.content);epoch=randomUUID();
    await sql.query('UPDATE notes SET live_state=$1,live_epoch=$2 WHERE id=$3',[Buffer.from(Y.encodeStateAsUpdate(doc)),epoch,id]);
  }
  return {doc,epoch:epoch!,version:row.version};
}
const encode=(doc:Y.Doc)=>Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
export function attachRealtime(server:Server,db:Database,appUrl:string){
  const wss=new WebSocketServer({noServer:true,maxPayload:2*1024*1024,perMessageDeflate:false});
  const peers=new Set<Peer>();
  const send=(peer:Peer,value:unknown)=>{if(peer.socket.readyState===WebSocket.OPEN)peer.socket.send(JSON.stringify(value));};
  const deny=(peer:Peer,code:string)=>{send(peer,{type:'error',code});peer.socket.close(1008,code);};
  async function broadcast(id:string,state:unknown){
    for(const peer of peers){if(peer.id!==id||peer.socket.readyState!==WebSocket.OPEN)continue;
      try{await authorize(db,peer);send(peer,state);}catch{deny(peer,'ACCESS_DENIED');}
    }
  }
  server.on('upgrade',(incoming,socket,head)=>{
    const match=/^\/api\/live\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec((incoming.url??'').split('?')[0]);
    if(!match||incoming.headers.origin!==new URL(appUrl).origin){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    const token=(incoming.headers.cookie??'').split(';').map(value=>value.trim()).find(value=>value.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
    const req=incoming as unknown as Request;req.cookies={[SESSION_COOKIE]:token};
    const provisional={req,id:match[1]} as Peer;
    void authorize(db,provisional).then(()=>{
      wss.handleUpgrade(incoming,socket,head,ws=>{
        const peer:Peer={socket:ws,req,id:match[1]};peers.add(peer);
        let chain:Promise<unknown>=Promise.resolve();let count=0,windowStart=Date.now();
        const enqueue=(work:()=>Promise<void>)=>{chain=chain.then(work).catch(error=>deny(peer,error instanceof LiveError?error.code:'SERVER_ERROR'));};
        ws.on('error',()=>{});ws.on('close',()=>peers.delete(peer));
        enqueue(async()=>{
          const state=await db.transaction(async sql=>{await authorize(sql,peer,false,true);const current=await document(sql,peer.id);
            let readOnly=false;try{await authorize(sql,peer,true);}catch{readOnly=true;}
            const packet={type:'state',update:encode(current.doc),epoch:current.epoch,version:current.version,readOnly};current.doc.destroy();return packet;});send(peer,state);
        });
        ws.on('message',(raw,binary)=>enqueue(async()=>{
          if(binary)throw new LiveError('INVALID_UPDATE');
          if(Date.now()-windowStart>10000){windowStart=Date.now();count=0;}if(++count>100)throw new LiveError('RATE_LIMIT');
          let message:{epoch:string;update:string;seq:number};try{message=JSON.parse(raw.toString());}catch{throw new LiveError('INVALID_UPDATE');}
          if(typeof message.update!=='string'||message.update.length>1400000||!Number.isSafeInteger(message.seq)||message.seq<1)throw new LiveError('INVALID_UPDATE');
          const state=await db.transaction(async sql=>{
            await authorize(sql,peer,true,true);const current=await document(sql,peer.id);
            try{
              if(message.epoch!==current.epoch)throw new LiveError('EXTERNAL_CHANGE');
              const bytes=Buffer.from(message.update,'base64');if(bytes.toString('base64')!==message.update)throw new LiveError('INVALID_UPDATE');
              try{Y.applyUpdate(current.doc,bytes);}catch{throw new LiveError('INVALID_UPDATE');}
              const title=current.doc.getText('title').toString(),content=current.doc.getText('content').toString();
              const valid=[...current.doc.share.keys()].every(key=>['title','content'].includes(key))&&['title','content'].every(key=>current.doc.getText(key).toDelta().every((part:{insert?:unknown;attributes?:unknown})=>typeof part.insert==='string'&&!part.attributes));
              if(!valid||!title.trim()||title.length>200||!content.trim()||content.length>100000||Y.encodeStateAsUpdate(current.doc).length>1000000)throw new LiveError('INVALID_CONTENT');
              // The row lock serializes snapshot/merge/commit across all collaborators and server processes.
              const result=await sql.query<{version:number}>('UPDATE notes SET title=$1,content=$2,live_state=$3,version=version+1,updated_at=clock_timestamp() WHERE id=$4 RETURNING version',[title,content,Buffer.from(Y.encodeStateAsUpdate(current.doc)),peer.id]);
              return {type:'state',epoch:current.epoch,update:encode(current.doc),version:result.rows[0].version};
            }finally{current.doc.destroy();}
          });
          // ACK only after the database commit; other peers must not receive somebody else's ACK.
          send(peer,{...state,ack:message.seq});await broadcast(peer.id,state);
        }));
      });
    }).catch(()=>{socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');});
  });
  let checking=false;
  const heartbeat=setInterval(()=>{if(checking)return;checking=true;
    void(async()=>{for(const peer of peers){try{await authorize(db,peer);peer.socket.ping();}catch{deny(peer,'ACCESS_DENIED');}}})().finally(()=>{checking=false;});
  },3000);heartbeat.unref();
  return ()=>{clearInterval(heartbeat);for(const peer of peers)peer.socket.terminate();wss.close();};
}
