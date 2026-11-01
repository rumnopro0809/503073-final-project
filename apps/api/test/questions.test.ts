import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {openDatabase,migrate,type Database} from '../src/database.js';
import {createApp} from '../src/app.js';
import {geminiAnswerer,type AnswerInput,type AnswerQuestion} from '../src/questions.js';
import {SummaryError} from '../src/summary.js';

const headers={'X-Requested-With':'GhiChu',Origin:'http://localhost:5173'};
let db:Database,app:ReturnType<typeof createApp>,alice:string,bob:string,bobId:string;
let calls:AnswerInput[],provider:AnswerQuestion;
async function register(email:string){const r=await request(app).post('/api/auth/register').set(headers).send({email,displayName:'QA Test',password:'Test password 2026!',confirmPassword:'Test password 2026!'}).expect(201);return{cookie:r.headers['set-cookie'][0].split(';')[0],id:r.body.user.id};}
async function note(cookie=alice,title='Phân công video',content='Thái phụ trách quay video 1080p. Triều kiểm thử.'){
  return (await request(app).post('/api/notes').set(headers).set('Cookie',cookie).send({title,content}).expect(201)).body.note;
}
const ask=(question='Ai phụ trách quay video?',cookie=alice)=>request(app).post('/api/ai/ask').set(headers).set('Cookie',cookie).send({question});
before(async()=>{
  db=await openDatabase();await migrate(db);app=createApp({db,appUrl:headers.Origin,production:false,rateLimit:false,sendVerification:async()=>{},answerQuestion:input=>{calls.push(input);return provider(input);}});
  alice=(await register('qa-alice@example.test')).cookie;const b=await register('qa-bob@example.test');bob=b.cookie;bobId=b.id;
});
beforeEach(async()=>{await db.query('TRUNCATE notes CASCADE');await db.query("UPDATE sessions SET expires_at=NOW()+INTERVAL '1 day'");calls=[];provider=async({sources})=>({answer:`Thái phụ trách quay video [${sources[0].label}].`,sourceIds:[sources[0].id],insufficient:false});});
after(async()=>db.close());
test('QA retrieves relevant saved text with inline citations and immutable source metadata',async()=>{
  const n=await note();const r=await ask().expect(200);
  assert.match(r.body.answer,/\[1\]/);assert.equal(r.body.sources[0].id,n.id);assert.equal(r.body.sources[0].version,1);assert.ok(r.body.sources[0].excerpt.includes('Thái'));
  assert.equal(calls.length,1);assert.equal(calls[0].sources[0].id,n.id);
  assert.equal((await request(app).get(`/api/notes/${n.id}`).set('Cookie',alice)).body.note.version,1);
});
test('QA never sends another user private notes or locked shared notes to the model',async()=>{
  const shared=await note(),privateNote=await note(alice,'Video SECRET','Video PRIVATE CONTENT never send to Bob.');
  await request(app).post(`/api/notes/${shared.id}/shares`).set(headers).set('Cookie',alice).send({emails:['qa-bob@example.test'],permission:'read'}).expect(200);
  await ask('video',bob).expect(200);assert.deepEqual(calls[0].sources.map(source=>source.id),[shared.id]);assert.ok(!JSON.stringify(calls).includes(privateNote.id));
  const password='QA protected password!';await request(app).post(`/api/notes/${shared.id}/protection`).set(headers).set('Cookie',alice).send({version:1,password,confirmPassword:password}).expect(200);
  const locked=await ask('video',bob).expect(200);assert.equal(locked.body.insufficient,true);assert.deepEqual(locked.body.sources,[]);assert.equal(calls.length,1);
  await request(app).post(`/api/notes/${shared.id}/unlock`).set(headers).set('Cookie',bob).send({password}).expect(200);
  await ask('video',bob).expect(200);assert.equal(calls.length,2);
});
test('QA says insufficient without provider calls when retrieval has no matching evidence',async()=>{
  await note();const r=await ask('Thiên thạch ZYX987').expect(200);assert.equal(r.body.insufficient,true);assert.deepEqual(r.body.sources,[]);assert.equal(calls.length,0);
  provider=async()=>({answer:'Unverified invented answer',sourceIds:[],insufficient:true});
  const uncertain=await ask().expect(200);assert.equal(uncertain.body.insufficient,true);assert.ok(!uncertain.body.answer.includes('invented'));
});
test('QA rechecks permissions, session and source versions after generation',async()=>{
  const n=await note();provider=async({sources})=>{await db.query('UPDATE notes SET version=version+1 WHERE id=$1',[n.id]);return {answer:'Stale [1]',sourceIds:[sources[0].id],insufficient:false};};
  assert.equal((await ask().expect(409)).body.answer,undefined);
  await request(app).post(`/api/notes/${n.id}/shares`).set(headers).set('Cookie',alice).send({emails:['qa-bob@example.test'],permission:'read'}).expect(200);
  provider=async({sources})=>{await db.query('DELETE FROM note_shares WHERE note_id=$1 AND recipient_id=$2',[n.id,bobId]);return{answer:'Revoked [1]',sourceIds:[sources[0].id],insufficient:false};};
  assert.equal((await ask('video',bob).expect(409)).body.answer,undefined);
  provider=async({sources})=>{await db.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second'");return{answer:'Expired [1]',sourceIds:[sources[0].id],insufficient:false};};
  assert.equal((await ask().expect(401)).body.answer,undefined);
});
test('QA rejects invented sources, invalid citations and provider failures without exposing raw errors',async()=>{
  await note();
  for(const result of [{answer:'Invented [1]',sourceIds:['unknown'],insufficient:false},{answer:'No sources',sourceIds:[],insufficient:false}]){provider=async()=>result;await ask().expect(502);}
  provider=async({sources})=>({answer:'Wrong citation [99]',sourceIds:[sources[0].id],insufficient:false});await ask().expect(502);
  provider=async()=>{throw new Error('SECRET KEY');};assert.ok(!JSON.stringify((await ask().expect(502)).body).includes('SECRET'));
  provider=async()=>{throw new SummaryError(429,'AI hết hạn mức.');};await ask().expect(429);
});
test('QA bounds retrieval and finds evidence deep in long notes',async()=>{
  for(let i=0;i<8;i++)await note(alice,`Video ${i}`,'video '.repeat(3000)+' Dữ liệu cuối NEEDLE456 cuối ghi chú.');
  await ask('NEEDLE456').expect(200);assert.equal(calls[0].sources.length,6);assert.ok(calls[0].sources.every(source=>source.excerpt.length<=4000&&source.excerpt.includes('NEEDLE456')));
});
test('QA validates input and requires authentication and provider configuration',async()=>{
  await ask('video','').expect(401);
  for(const body of [{question:''},{question:'x'.repeat(501)},{question:'video',noteIds:['forged']},{question:123}])await request(app).post('/api/ai/ask').set(headers).set('Cookie',alice).send(body).expect(422);
  const disabled=createApp({db,appUrl:headers.Origin,production:false,rateLimit:false,sendVerification:async()=>{}});
  await request(disabled).post('/api/ai/ask').set(headers).set('Cookie',alice).send({question:'video'}).expect(503);
});
test('QA avoids duplicate concurrent provider requests per account',async()=>{
  await note();let release!:()=>void,entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});
  provider=({sources})=>new Promise(resolve=>{release=()=>resolve({answer:'Answer [1]',sourceIds:[sources[0].id],insufficient:false});entered();});
  const first=ask().then(r=>r);await started;try{await ask().expect(429);assert.equal(calls.length,1);}finally{release();}assert.equal((await first).status,200);
});
test('Gemini QA uses JSON schema and only sends bounded source excerpts, not internal metadata',async()=>{
  const fake=(async(_url,options)=>{
    const body=JSON.parse(String(options?.body));assert.equal(body.generationConfig.responseMimeType,'application/json');assert.ok(body.generationConfig.responseSchema);
    const data=JSON.parse(body.contents[0].parts[0].text);assert.equal(data.question,'video');assert.equal(data.sources[0].protection_version,undefined);assert.equal(data.sources[0].version,undefined);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({answer:'Thái [1]',sourceIds:['id'],insufficient:false})}]}}]});
  }) as typeof fetch;
  const result=await geminiAnswerer('private-key',undefined,fake)({question:'video',sources:[{id:'id',title:'Video',excerpt:'Thái quay video.',version:1,protection_version:2,label:1}]});assert.equal(result.sourceIds[0],'id');
});
