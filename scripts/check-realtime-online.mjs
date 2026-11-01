import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import * as Y from 'yjs';

const base=new URL(process.argv[2]||'').origin;
assert.equal(new URL(base).protocol,'https:','Use the deployed HTTPS origin.');
const headers={Origin:base,'X-Requested-With':'GhiChu','Content-Type':'application/json'};
const clients=[];let owner,writer,noteId;
async function api(path,cookie='',body,method=body?'POST':'GET',status=200){
  const response=await fetch(base+'/api'+path,{method,headers:{...headers,...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  assert.equal(response.status,status,`${method} ${path}: HTTP ${response.status}`);return response;
}
async function login(account,create){
  const response=await api(create?'/auth/register':'/auth/login','',{...account,...(create?{confirmPassword:account.password,displayName:'Realtime verification'}:{})},'POST',create?201:200);
  return {cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),user:(await response.json()).user};
}
async function connect(id,cookie){
  const ws=new WebSocket(base.replace('https:','wss:')+`/api/live/${id}`,{origin:base,headers:{Cookie:cookie},handshakeTimeout:15000});clients.push(ws);
  const packets=[];let failure;
  ws.on('error',error=>{failure=error;});ws.on('unexpected-response',(_req,response)=>{failure=new Error(`WebSocket HTTP ${response.statusCode}`);ws.terminate();});
  ws.on('message',raw=>packets.push(JSON.parse(String(raw))));
  async function next(predicate=()=>true){const deadline=Date.now()+20000;
    for(;;){if(failure)throw failure;const index=packets.findIndex(predicate);if(index>=0)return packets.splice(index,1)[0];
      assert.ok(Date.now()<deadline,'WebSocket response timeout');await new Promise(resolve=>setTimeout(resolve,40));}
  }
  const initial=await next(p=>p.type==='state');const doc=new Y.Doc();Y.applyUpdate(doc,Buffer.from(initial.update,'base64'));
  return {ws,doc,initial,next,send(seq){ws.send(JSON.stringify({seq,epoch:initial.epoch,update:Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')}));}};
}
try{
  assert.deepEqual(await(await api('/health')).json(),{status:'ok'});
  const html=await(await fetch(base+'/login')).text();const asset=html.match(/src="([^"]+\.js)"/);assert.ok(asset);
  const js=await(await fetch(base+asset[1])).text();assert.ok(js.includes('/api/live/'),'Realtime build is not deployed yet.');
  // Reuse isolated accounts on repeat runs; credentials stay in ignored local .data.
  await mkdir('.data',{recursive:true});const filename=`.data/realtime-check-${new URL(base).hostname}.json`;
  let accounts,create=false;try{accounts=JSON.parse(await readFile(filename,'utf8'));}catch{
    create=true;accounts=['owner','writer'].map(role=>({email:`realtime-${role}-${Date.now()}@example.test`,password:randomUUID()+'aA1!'}));
    await writeFile(filename,JSON.stringify(accounts),{mode:0o600});
  }
  owner=await login(accounts[0],create);writer=await login(accounts[1],create);
  const created=await(await api('/notes',owner.cookie,{title:'Realtime deployment check',content:'Base'},'POST',201)).json();noteId=created.note.id;
  await api(`/notes/${noteId}/shares`,owner.cookie,{emails:[accounts[1].email],permission:'write'});
  const a=await connect(noteId,owner.cookie),b=await connect(noteId,writer.cookie);
  a.doc.getText('content').insert(0,'Owner ');b.doc.getText('content').insert(0,'Writer ');a.send(1);b.send(1);
  const ackA=await a.next(p=>p.ack===1),ackB=await b.next(p=>p.ack===1);
  const saved=(await(await api(`/notes/${noteId}`,owner.cookie)).json()).note;
  assert.ok(saved.content.includes('Owner '));assert.ok(saved.content.includes('Writer '));
  for(const doc of [a.doc,b.doc]){Y.applyUpdate(doc,Buffer.from(ackA.update,'base64'));Y.applyUpdate(doc,Buffer.from(ackB.update,'base64'));assert.equal(doc.getText('content').toString(),saved.content);}
  const reopened=await connect(noteId,owner.cookie);assert.equal(reopened.doc.getText('content').toString(),saved.content);assert.equal(reopened.initial.epoch,a.initial.epoch);
  b.ws.close();await api(`/notes/${noteId}/shares`,owner.cookie,{emails:[accounts[1].email],permission:'read'});
  const viewer=await connect(noteId,writer.cookie);assert.equal(viewer.initial.readOnly,true);viewer.doc.getText('content').insert(0,'Forbidden ');viewer.send(1);
  assert.equal((await viewer.next(p=>p.type==='error')).code,'ACCESS_DENIED');
  assert.equal((await(await api(`/notes/${noteId}`,owner.cookie)).json()).note.content,saved.content);
  await api(`/notes/${noteId}/shares/${writer.user.id}`,owner.cookie,{},'DELETE',204);
  console.log(JSON.stringify({result:'PASS',url:base,checks:['HTTPS realtime frontend deployed','authenticated WSS','two-account concurrent merge','ACK after persisted update','reopen restores Yjs snapshot','read-only write rejected','share revoked'],testData:'Temporary note removed in cleanup; two isolated example.test accounts remain for repeat checks.'}));
}finally{
  for(const ws of clients)ws.terminate();
  if(noteId&&owner)await api(`/notes/${noteId}`,owner.cookie,{},'DELETE',204).catch(()=>{});
  for(const account of [owner,writer])if(account)await api('/auth/logout',account.cookie,{},'POST',204).catch(()=>{});
}
