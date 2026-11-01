import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base=new URL(process.argv[2]||'').origin;assert.equal(new URL(base).protocol,'https:');
const accounts=JSON.parse(await readFile(`.data/realtime-check-${new URL(base).hostname}.json`,'utf8'));
let cookie='',noteId;
async function api(path,body,method=body?'POST':'GET',expected=200){
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,Origin:base,'X-Requested-With':'GhiChu','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  if(response.status!==expected){let message='';try{message=(await response.json()).message||'';}catch{}
    throw new Error(`${method} ${path}: HTTP ${response.status}; ${message}`);}
  return response;
}
try{
  const login=await api('/auth/login',accounts[0]);cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const html=await(await fetch(base+'/login')).text(),asset=html.match(/src="([^"]+\.js)"/);assert.ok(asset);
  assert.ok((await(await fetch(base+asset[1])).text()).includes('Tóm tắt bằng AI'),'AI Summary frontend has not deployed yet.');
  const original={title:'Kế hoạch nộp bài thử nghiệm AI',content:'Nhóm có hai thành viên: Triều phụ trách kiểm thử, Thái phụ trách quay video. Hạn nộp là ngày 02/11 trước 23:59. Video phải đạt 1080p. Sau khi kiểm thử xong, cả nhóm xem lại video và nộp source code cùng Readme.txt.'};
  noteId=(await(await api('/notes',original,'POST',201)).json()).note.id;
  const result=await(await api(`/notes/${noteId}/summary`,{})).json();
  assert.equal(result.noteId,noteId);assert.equal(result.sourceVersion,1);assert.ok(typeof result.summary==='string'&&result.summary.trim().length>20);
  const saved=(await(await api(`/notes/${noteId}`)).json()).note;assert.equal(saved.content,original.content);assert.equal(saved.version,1);
  console.log(JSON.stringify({result:'PASS',url:base,checks:['deployed frontend','real AI summary through authenticated server endpoint','source version returned','original note unchanged'],summary:result.summary}));
}finally{
  if(noteId)await api(`/notes/${noteId}`,{},'DELETE',204).catch(()=>{});
  if(cookie)await api('/auth/logout',{},'POST',204).catch(()=>{});
}
