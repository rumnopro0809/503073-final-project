import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {once} from 'node:events';
import request from 'supertest';
import {WebSocket} from 'ws';
import * as Y from 'yjs';
import {openDatabase,migrate,type Database} from '../src/database.js';
import {createApp} from '../src/app.js';
import {attachRealtime} from '../src/realtime.js';

let db:Database,app:ReturnType<typeof createApp>,server:Server,stop:()=>void,url:string;
let owner:string,writer:string,outsider:string,writerId:string;
const headers={'X-Requested-With':'GhiChu',Origin:'http://localhost:5173'};
const sockets=new Set<WebSocket>();
async function register(email:string){
  const result=await request(app).post('/api/auth/register').set(headers).send({email,displayName:email.split('@')[0],password:'Test password 2026!',confirmPassword:'Test password 2026!'}).expect(201);
  return {cookie:result.headers['set-cookie'][0].split(';')[0],id:result.body.user.id};
}
async function note(permission:'read'|'write'='write'){
  const result=(await request(app).post('/api/notes').set(headers).set('Cookie',owner).send({title:'Shared',content:'Base'}).expect(201)).body.note;
  await request(app).post(`/api/notes/${result.id}/shares`).set(headers).set('Cookie',owner).send({emails:['writer@example.test'],permission}).expect(200);
  return result;
}
type Packet={type:string;update:string;epoch:string;ack?:number;readOnly?:boolean;code?:string};
async function connect(id:string,cookie:string){
  const ws=new WebSocket(`${url}/api/live/${id}`,{origin:headers.Origin,headers:{Cookie:cookie}});sockets.add(ws);
  const packets:Packet[]=[];let signal:(()=>void)|undefined;
  ws.on('error',()=>{});
  ws.on('message',raw=>{packets.push(JSON.parse(String(raw)));signal?.();});
  async function next(predicate:(value:Packet)=>boolean=()=>true):Promise<Packet>{
    const end=Date.now()+5000;
    for(;;){const index=packets.findIndex(predicate);if(index>=0)return packets.splice(index,1)[0];
      if(Date.now()>end)throw new Error('Timed out waiting for live packet');
      await new Promise<void>(resolve=>{const timer=setTimeout(resolve,30);signal=()=>{clearTimeout(timer);resolve();};});
    }
  }
  const initial=await next();assert.equal(initial.type,'state');
  const doc=new Y.Doc();Y.applyUpdate(doc,Buffer.from(initial.update,'base64'));
  return {ws,doc,initial,next,send(seq=1,epoch=initial.epoch){ws.send(JSON.stringify({seq,epoch,update:Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')}));}};
}
before(async()=>{
  db=await openDatabase();await migrate(db);
  app=createApp({db,appUrl:headers.Origin,production:false,rateLimit:false,sendVerification:async()=>{}});
  owner=(await register('owner@example.test')).cookie;
  const w=await register('writer@example.test');writer=w.cookie;writerId=w.id;
  outsider=(await register('outsider@example.test')).cookie;
  server=createServer(app);stop=attachRealtime(server,db,headers.Origin);server.listen(0,'127.0.0.1');await once(server,'listening');
  url=`ws://127.0.0.1:${(server.address() as {port:number}).port}`;
});
beforeEach(async()=>{for(const ws of sockets)ws.terminate();sockets.clear();await db.query('TRUNCATE notes CASCADE');});
after(async()=>{stop();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();});

test('simultaneous collaborators merge edits, acknowledge committed data and restore durable Yjs state',async()=>{
  const n=await note(),a=await connect(n.id,owner),b=await connect(n.id,writer);
  assert.equal(a.initial.epoch,b.initial.epoch);assert.equal(b.initial.readOnly,false);
  a.doc.getText('content').insert(0,'Alice ');b.doc.getText('content').insert(0,'Bob ');
  a.send();b.send();
  const ackA=await a.next(p=>p.ack===1),ackB=await b.next(p=>p.ack===1);
  const saved=(await request(app).get(`/api/notes/${n.id}`).set('Cookie',owner).expect(200)).body.note;
  assert.ok(saved.content.includes('Alice '));assert.ok(saved.content.includes('Bob '));assert.ok(saved.content.includes('Base'));
  for(const doc of [a.doc,b.doc]){Y.applyUpdate(doc,Buffer.from(ackA.update,'base64'));Y.applyUpdate(doc,Buffer.from(ackB.update,'base64'));assert.equal(doc.getText('content').toString(),saved.content);}
  const reloaded=await connect(n.id,owner);assert.equal(reloaded.initial.epoch,a.initial.epoch);assert.equal(reloaded.doc.getText('content').toString(),saved.content);
  // Replaying an already committed update cannot duplicate text.
  a.send(2);await a.next(p=>p.ack===2);
  assert.equal((await request(app).get(`/api/notes/${n.id}`).set('Cookie',owner)).body.note.content,saved.content);
});

test('disconnected draft merges with edits committed while offline',async()=>{
  const n=await note(),a=await connect(n.id,owner),b=await connect(n.id,writer);
  b.ws.terminate();b.doc.getText('content').insert(0,'Offline ');
  a.doc.getText('content').insert(0,'Online ');a.send();await a.next(p=>p.ack===1);
  const resumed=await connect(n.id,writer);Y.applyUpdate(resumed.doc,Y.encodeStateAsUpdate(b.doc));resumed.send();await resumed.next(p=>p.ack===1);
  const saved=(await request(app).get(`/api/notes/${n.id}`).set('Cookie',owner)).body.note.content;
  assert.ok(saved.includes('Offline '));assert.ok(saved.includes('Online '));
});

test('read-only peers receive live edits but cannot write',async()=>{
  const n=await note('read'),a=await connect(n.id,owner),b=await connect(n.id,writer);
  assert.equal(b.initial.readOnly,true);
  a.doc.getText('content').insert(0,'Live ');a.send();await a.next(p=>p.ack===1);
  const update=await b.next(p=>p.type==='state');Y.applyUpdate(b.doc,Buffer.from(update.update,'base64'));
  assert.equal(b.doc.getText('content').toString(),'Live Base');
  b.doc.getText('content').insert(0,'Forbidden ');b.send();assert.equal((await b.next(p=>p.type==='error')).code,'ACCESS_DENIED');
  assert.equal((await request(app).get(`/api/notes/${n.id}`).set('Cookie',owner)).body.note.content,'Live Base');
});

test('revoked shares cannot write or receive another broadcast',async()=>{
  const n=await note(),a=await connect(n.id,owner),b=await connect(n.id,writer);
  await request(app).delete(`/api/notes/${n.id}/shares/${writerId}`).set(headers).set('Cookie',owner).send({}).expect(204);
  a.doc.getText('content').insert(0,'Owner ');a.send();await a.next(p=>p.ack===1);
  assert.equal((await b.next()).code,'ACCESS_DENIED');
});

test('ordinary HTTP edits invalidate older live documents rather than overwrite newer text',async()=>{
  const n=await note(),a=await connect(n.id,owner);
  await request(app).patch(`/api/notes/${n.id}`).set(headers).set('Cookie',owner).send({version:1,content:'New HTTP body'}).expect(200);
  a.doc.getText('content').insert(0,'Stale ');a.send();assert.equal((await a.next()).code,'EXTERNAL_CHANGE');
  assert.equal((await request(app).get(`/api/notes/${n.id}`).set('Cookie',owner)).body.note.content,'New HTTP body');
});

async function rejected(id:string,cookie:string,origin=headers.Origin){
  const ws=new WebSocket(`${url}/api/live/${id}`,{origin,headers:{Cookie:cookie}});sockets.add(ws);ws.on('error',()=>{});
  const [response]=await once(ws,'unexpected-response');assert.ok(response);ws.terminate();
}
test('upgrade enforces origin, session, note permissions and password unlock',async()=>{
  const n=await note();
  await rejected(n.id,owner,'https://evil.example');await rejected(n.id,'');await rejected(n.id,outsider);
  const password='Private note password!';
  await request(app).post(`/api/notes/${n.id}/protection`).set(headers).set('Cookie',owner).send({version:1,password,confirmPassword:password}).expect(200);
  await rejected(n.id,writer);
  await request(app).post(`/api/notes/${n.id}/unlock`).set(headers).set('Cookie',writer).send({password}).expect(200);
  const b=await connect(n.id,writer);assert.equal(b.doc.getText('content').toString(),'Base');
  await db.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second'");
  b.send();assert.equal((await b.next()).code,'ACCESS_DENIED');
});
