import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base=new URL(process.argv[2]||'').origin;assert.equal(new URL(base).protocol,'https:');
const accounts=JSON.parse(await readFile(`.data/realtime-check-${new URL(base).hostname}.json`,'utf8'));
let cookie='',noteId;
async function api(path,body,method=body?'POST':'GET',expected=200){
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,Origin:base,'X-Requested-With':'GhiChu','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  if(response.status!==expected){let message='';try{message=(await response.json()).message||'';}catch{}throw new Error(`${method} ${path}: HTTP ${response.status}; ${message}`);}
  return response;
}
try{
  const html=await(await fetch(base+'/login')).text(),asset=html.match(/src="([^"]+\.js)"/);assert.ok(asset);
  assert.ok((await(await fetch(base+asset[1])).text()).includes('Hỏi AI về ghi chú'),'QA frontend has not deployed yet.');
  const login=await api('/auth/login',accounts[0]);cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const original={title:'Phân công kiểm thử QATEST503073',content:'Trong kế hoạch QATEST503073, Thái phụ trách quay video demo đạt 1080p. Triều phụ trách kiểm thử phần mềm. Nhóm nộp bài trước 23:59 ngày 02/11.'};
  noteId=(await(await api('/notes',original,'POST',201)).json()).note.id;
  const result=await(await api('/ai/ask',{question:'Trong QATEST503073, ai phụ trách quay video demo và video cần đạt độ phân giải nào?'})).json();
  assert.equal(result.insufficient,false);assert.ok(result.sources.some(source=>source.id===noteId));
  assert.match(result.answer,/Thái/i);assert.match(result.answer,/1080/);assert.match(result.answer,/\[\d+\]/);
  for(const source of result.sources){const response=await api(`/notes/${source.id}`);assert.equal((await response.json()).note.version,source.version);}
  const missing=await(await api('/ai/ask',{question:'Thiên thạch XZZUNRELATED98765'})).json();assert.equal(missing.insufficient,true);assert.deepEqual(missing.sources,[]);
  const saved=(await(await api(`/notes/${noteId}`)).json()).note;assert.equal(saved.content,original.content);assert.equal(saved.version,1);
  console.log(JSON.stringify({result:'PASS',url:base,checks:['QA frontend deployed','real Gemini grounded answer','inline citation and accessible original source','insufficient evidence without invented sources','original note unchanged'],answer:result.answer,sources:result.sources.map(({label,title,version})=>({label,title,version}))}));
}finally{
  if(noteId)await api(`/notes/${noteId}`,{},'DELETE',204).catch(()=>{});
  if(cookie)await api('/auth/logout',{},'POST',204).catch(()=>{});
}
