import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { openDatabase, migrate, type Database } from '../src/database.js';
import { createApp } from '../src/app.js';

let db: Database;
let app: ReturnType<typeof createApp>;
let alice: string;
let bob: string;
let aliceId: string;
let bobId: string;
const payload = { title: 'Bài học hôm nay', content: 'Tìm hiểu HTTP, SQL và quyền truy cập.' };
const headers = { 'X-Requested-With': 'GhiChu', Origin: 'http://localhost:5173' };

async function register(email: string) {
  const response = await request(app).post('/api/auth/register').set(headers).send({
    email, displayName: email.split('@')[0], password: 'Test password 2026!', confirmPassword: 'Test password 2026!',
  });
  assert.equal(response.status, 201);
  return { cookie: (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0], user: response.body.user };
}

async function createNote(cookie = alice, body: object = payload) {
  const response = await request(app).post('/api/notes').set(headers).set('Cookie', cookie).send(body);
  assert.equal(response.status, 201);
  return response.body.note as {
    id: string; title: string; content: string; version: number; createdAt: string; updatedAt: string;
  };
}

before(async () => {
  db = await openDatabase();
  await migrate(db);
  app = createApp({ db, appUrl: 'http://localhost:5173', production: false, rateLimit: false, sendVerification: async () => {} });
  const a = await register('alice@example.test');
  const b = await register('bob@example.test');
  alice = a.cookie; bob = b.cookie; aliceId = a.user.id; bobId = b.user.id;
  assert.equal(a.user.emailVerified, false);
});

beforeEach(async () => {
  await db.query('TRUNCATE notes, labels CASCADE');
  await db.query("UPDATE sessions SET expires_at = NOW() + INTERVAL '1 day'");
});
after(async () => { await db.close(); });

test('organization filters search literal content and enforce label ownership and versions', async () => {
  const note = await createNote(alice, { title: 'Project', content: '100% _ path\\code' });
  await createNote(alice, { title: 'Other', content: 'plain text' });
  const label = (await request(app).post('/api/labels').set(headers).set('Cookie', alice).send({ name: 'Học tập' }).expect(201)).body.label;
  await request(app).post('/api/labels').set(headers).set('Cookie', alice).send({ name: 'học tập' }).expect(409);
  await request(app).patch(`/api/notes/${note.id}/organization`).set(headers).set('Cookie', bob).send({ version: 1, pinned: true }).expect(404);
  const foreign = await createNote(bob);
  await request(app).patch(`/api/notes/${foreign.id}/organization`).set(headers).set('Cookie', bob).send({ version: 1, labelIds: [label.id] }).expect(422);
  const organized = (await request(app).patch(`/api/notes/${note.id}/organization`).set(headers).set('Cookie', alice).send({ version: 1, pinned: true, labelIds: [label.id] }).expect(200)).body.note;
  assert.equal(organized.version, 2); assert.ok(organized.pinnedAt); assert.equal(organized.labels[0].name, 'Học tập');
  await request(app).patch(`/api/notes/${note.id}/organization`).set(headers).set('Cookie', alice).send({ version: 1, pinned: false }).expect(409);
  for (const q of ['%', '_', '\\', 'PROJECT']) {
    const found = await request(app).get('/api/notes').query({ q, pinned: true, labelId: label.id }).set('Cookie', alice).expect(200);
    assert.deepEqual(found.body.notes.map((n: {id:string}) => n.id), [note.id]);
  }
  assert.deepEqual((await request(app).get('/api/labels').set('Cookie', bob)).body.labels, []);
  await request(app).patch(`/api/labels/${label.id}`).set(headers).set('Cookie', bob).send({ name: 'Intrude' }).expect(404);
  await request(app).patch(`/api/labels/${label.id}`).set(headers).set('Cookie', alice).send({ name: 'Đã đổi', color: '#527db5' }).expect(200);
  const renamed = (await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice)).body.note;
  assert.equal(renamed.labels[0].name, 'Đã đổi'); assert.equal(renamed.version, 3);
  await request(app).delete(`/api/labels/${label.id}`).set(headers).set('Cookie', bob).send({}).expect(404);
  await request(app).delete(`/api/labels/${label.id}`).set(headers).set('Cookie', alice).send({}).expect(204);
  const retained = (await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice)).body.note;
  assert.equal(retained.content, note.content); assert.deepEqual(retained.labels, []); assert.equal(retained.version, 4);
});

test('pins order by pin time, survive content edits, and can be removed', async () => {
  const a = await createNote(alice, { title: 'A', content: 'first' });
  const b = await createNote(alice, { title: 'B', content: 'second' });
  for (const note of [a, b]) await request(app).patch(`/api/notes/${note.id}/organization`).set(headers).set('Cookie', alice).send({ version: 1, pinned: true }).expect(200);
  await db.query("UPDATE notes SET pinned_at = '2026-10-01' WHERE id=$1", [a.id]);
  await request(app).patch(`/api/notes/${a.id}`).set(headers).set('Cookie', alice).send({ version: 2, content: 'edited' }).expect(200);
  const result = await request(app).get('/api/notes').query({ pinned: true, limit: 1 }).set('Cookie', alice).expect(200);
  assert.equal(result.body.notes[0].id, b.id); assert.equal(result.body.pagination.hasMore, true);
  const next = await request(app).get('/api/notes').query({ pinned: true, limit: 1, offset: 1 }).set('Cookie', alice).expect(200);
  assert.equal(next.body.notes[0].id, a.id);
  const unpinned = await request(app).patch(`/api/notes/${b.id}/organization`).set(headers).set('Cookie', alice).send({ version: 2, pinned: false }).expect(200);
  assert.equal(unpinned.body.note.pinnedAt, null);
});

test('pin chronology precedes unpinned notes in every sort and pagination mode', async () => {
  const old = await createNote(alice,{title:'A old pin',content:'first'});
  const recent = await createNote(alice,{title:'Z new pin',content:'second'});
  const urgent = await createNote(alice,{title:'Urgent unpinned',content:'third'});
  for(const note of [old,recent]) await request(app).patch(`/api/notes/${note.id}/organization`).set(headers).set('Cookie',alice).send({version:1,pinned:true}).expect(200);
  await db.query("UPDATE notes SET pinned_at=NOW()-INTERVAL '1 day',due_at=NOW()-INTERVAL '2 days',important=TRUE WHERE id=$1",[old.id]);
  await db.query("UPDATE notes SET due_at=NOW()-INTERVAL '3 days',important=TRUE WHERE id=$1",[urgent.id]);
  for(const sort of ['created','updated','title']) {
    const list=await request(app).get('/api/notes').query({sort}).set('Cookie',alice).expect(200);
    assert.deepEqual(list.body.notes.map((note:{id:string})=>note.id),[recent.id,old.id,urgent.id]);
    const second=await request(app).get('/api/notes').query({sort,limit:1,offset:1}).set('Cookie',alice).expect(200);
    assert.equal(second.body.notes[0].id,old.id);
  }
});

test('default listing orders unpinned notes by modification time despite retired reminder metadata',async()=>{
  const old=await createNote(alice,{title:'Older important',content:'Keep legacy data'}),recent=await createNote(alice,{title:'Recent',content:'Newer update'}),pinned=await createNote(alice,{title:'Pinned',content:'Always first'});
  await db.query("UPDATE notes SET important=TRUE,due_at='2026-01-01',updated_at='2026-10-01' WHERE id=$1",[old.id]);
  await db.query("UPDATE notes SET updated_at='2026-10-02' WHERE id=$1",[recent.id]);
  await request(app).patch(`/api/notes/${pinned.id}/organization`).set(headers).set('Cookie',alice).send({version:1,pinned:true}).expect(200);
  const list=await request(app).get('/api/notes').set('Cookie',alice).expect(200);assert.deepEqual(list.body.notes.map((n:{id:string})=>n.id),[pinned.id,recent.id,old.id]);
  assert.equal((await db.query('SELECT important FROM notes WHERE id=$1',[old.id])).rows[0].important,true);
});
test('retired reminder routes and category filters cannot be used',async()=>{
  const n=await createNote();
  await request(app).get('/api/notes/reminders').set('Cookie',alice).expect(404);
  await request(app).patch(`/api/notes/${n.id}/reminder`).set(headers).set('Cookie',alice).send({version:1,important:true}).expect(404);
  await request(app).get('/api/notes?category=important').set('Cookie',alice).expect(422);
  assert.equal((await request(app).get(`/api/notes/${n.id}`).set('Cookie',alice)).body.note.version,1);
});

test('attachments enforce ownership on upload, list, download and removal, and cascade with notes', async () => {
  const note=await createNote();
  const url=`/api/attachments/notes/${note.id}`;
  const data=Buffer.from('Nội dung tệp bài tập').toString('base64');
  await request(app).post(url).set(headers).send({name:'bài tập.txt',data}).expect(401);
  await request(app).post(url).set(headers).set('Cookie',bob).send({name:'bài tập.txt',data}).expect(404);
  const file=(await request(app).post(url).set(headers).set('Cookie',alice).send({name:'bài tập.txt',data,mediaType:'image/png'}).expect(201)).body.attachment;
  assert.equal(file.mediaType,'application/octet-stream');
  assert.equal((await request(app).get(url).set('Cookie',alice)).body.attachments[0].id,file.id);
  await request(app).get(url).set('Cookie',bob).expect(404);
  await request(app).get(file.url).set('Cookie',bob).expect(404);
  await request(app).get(file.url).expect(401);
  const downloaded=await request(app).get(file.url).set('Cookie',alice).expect(200);
  assert.deepEqual(downloaded.body,Buffer.from(data,'base64')); assert.match(downloaded.headers['content-disposition'],/^attachment;/);
  await request(app).delete(file.url).set(headers).set('Cookie',bob).send({}).expect(404);
  await request(app).delete(file.url).set(headers).set('Cookie',alice).send({}).expect(204);
  await request(app).get(file.url).set('Cookie',alice).expect(404);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const image=(await request(app).post(url).set(headers).set('Cookie',alice).send({name:'ảnh.png',data:png}).expect(201)).body.attachment;
  const inline=await request(app).get(image.url).set('Cookie',alice).expect(200);
  assert.match(inline.headers['content-type'],/image\/png/); assert.match(inline.headers['content-disposition'],/^inline;/);
  assert.match((await request(app).get(`${image.url}?download=1`).set('Cookie',alice)).headers['content-disposition'],/^attachment;/);
  await request(app).delete(`/api/notes/${note.id}`).set(headers).set('Cookie',alice).send({}).expect(204);
  await request(app).get(image.url).set('Cookie',alice).expect(404);
  assert.equal((await db.query('SELECT id FROM attachments')).rows.length,0);
});

test('attachments reject malformed names, data, large files and concurrent quota overflow', async () => {
  const note=await createNote(); const url=`/api/attachments/notes/${note.id}`;
  for(const body of [{name:'../bad.txt',data:'YQ=='},{name:'bad\r\n.txt',data:'YQ=='},{name:'empty.txt',data:''},{name:'bad.txt',data:'not base64'},{name:'large.txt',data:Buffer.alloc(10*1024*1024+1).toString('base64')}])
    await request(app).post(url).set(headers).set('Cookie',alice).send(body).expect(422);
  const responses=await Promise.all(Array.from({length:21},(_,i)=>request(app).post(url).set(headers).set('Cookie',alice).send({name:`file${i}.txt`,data:'YQ=='})));
  assert.equal(responses.filter(result=>result.status===201).length,20); assert.equal(responses.filter(result=>result.status===422).length,1);
  const script=(await createNote()).id;
  const safe=(await request(app).post(`/api/attachments/notes/${script}`).set(headers).set('Cookie',alice).send({name:'unsafe.svg',data:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}).expect(201)).body.attachment;
  assert.equal(safe.mediaType,'application/octet-stream');
});

test('organization rejects malformed filters and labels and preserves data across migrations', async () => {
  for (const query of [{ q: 'x'.repeat(201) }, { pinned: 'false' }, { labelId: 'bad' }, { sort: 'sql' }])
    await request(app).get('/api/notes').query(query).set('Cookie', alice).expect(422);
  for (const body of [{ name: '' }, { name: 'x'.repeat(41) }, { name: 'Valid', color: 'red' }, { name: 'Valid', ownerId: bobId }])
    await request(app).post('/api/labels').set(headers).set('Cookie', alice).send(body).expect(422);
  await request(app).get('/api/labels').expect(401);
  const note = await createNote();
  await migrate(db);
  assert.equal((await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice)).body.note.content, note.content);
});

test('protected notes redact lists and searches and require a per-session password for every resource', async () => {
  const note=await createNote(alice,{title:'Private title',content:'Secret content'});
  const file=(await request(app).post(`/api/attachments/notes/${note.id}`).set(headers).set('Cookie',alice).send({name:'private.txt',data:'YQ=='}).expect(201)).body.attachment;
  const password='A private note 2026!';
  const set=await request(app).post(`/api/notes/${note.id}/protection`).set(headers).set('Cookie',alice).send({version:1,password,confirmPassword:password}).expect(200);
  assert.equal(set.body.note.protected,true);assert.equal(set.body.note.locked,false);assert.equal(set.body.note.version,2);
  const hash=(await db.query('SELECT password_hash FROM notes WHERE id=$1',[note.id])).rows[0].password_hash;
  assert.notEqual(hash,password);
  await request(app).post(`/api/notes/${note.id}/lock`).set(headers).set('Cookie',alice).send({}).expect(204);
  const listed=(await request(app).get('/api/notes').set('Cookie',alice)).body.notes[0];
  assert.equal(listed.locked,true);assert.equal(listed.title,'Ghi chú được bảo vệ');assert.equal(listed.content,'');assert.equal(listed.password_hash,undefined);
  assert.equal((await request(app).get('/api/notes?q=Secret').set('Cookie',alice)).body.notes.length,0);
  await request(app).get(`/api/notes/${note.id}`).set('Cookie',alice).expect(423);
  await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie',alice).send({version:2,content:'overwrite'}).expect(423);
  await request(app).delete(`/api/notes/${note.id}`).set(headers).set('Cookie',alice).send({}).expect(423);
  await request(app).get(file.url).set('Cookie',alice).expect(423);
  await request(app).get(`/api/attachments/notes/${note.id}`).set('Cookie',alice).expect(423);
  await request(app).post(`/api/notes/${note.id}/unlock`).set(headers).set('Cookie',alice).send({password:'wrong'}).expect(422);
  await request(app).post(`/api/notes/${note.id}/unlock`).set(headers).set('Cookie',bob).send({password}).expect(404);
  await request(app).post(`/api/notes/${note.id}/unlock`).set(headers).set('Cookie',alice).send({password}).expect(200);
  await request(app).get(file.url).set('Cookie',alice).expect(200);
  await db.query("UPDATE note_unlocks SET expires_at=NOW()-INTERVAL '1 second'");
  await request(app).get(`/api/notes/${note.id}`).set('Cookie',alice).expect(423);
});

test('changing or disabling note protection needs the current password and revokes other unlocks', async () => {
  const note=await createNote();const password='Note password 2026!',next='New note password 2026!';
  await request(app).post(`/api/notes/${note.id}/protection`).set(headers).set('Cookie',alice).send({version:1,password,confirmPassword:'wrong'}).expect(422);
  await request(app).post(`/api/notes/${note.id}/protection`).set(headers).set('Cookie',alice).send({version:1,password,confirmPassword:password}).expect(200);
  const login=await request(app).post('/api/auth/login').set(headers).send({email:'alice@example.test',password:'Test password 2026!'}).expect(200);
  const second=(login.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  await request(app).get(`/api/notes/${note.id}`).set('Cookie',second).expect(423);
  await request(app).post(`/api/notes/${note.id}/unlock`).set(headers).set('Cookie',second).send({password}).expect(200);
  await request(app).post(`/api/notes/${note.id}/protection`).set(headers).set('Cookie',alice).send({version:2,password:next,confirmPassword:next,currentPassword:'wrong'}).expect(422);
  await request(app).post(`/api/notes/${note.id}/protection`).set(headers).set('Cookie',alice).send({version:2,password:next,confirmPassword:next,currentPassword:password}).expect(200);
  await request(app).get(`/api/notes/${note.id}`).set('Cookie',second).expect(423);
  await request(app).post(`/api/notes/${note.id}/unlock`).set(headers).set('Cookie',second).send({password}).expect(422);
  await request(app).post(`/api/notes/${note.id}/protection`).set(headers).set('Cookie',alice).send({version:3,password:null}).expect(422);
  await request(app).post(`/api/notes/${note.id}/protection`).set(headers).set('Cookie',alice).send({version:3,password:null,currentPassword:next}).expect(200);
  assert.equal((await request(app).get(`/api/notes/${note.id}`).set('Cookie',second).expect(200)).body.note.protected,undefined);
});

test('sharing grants read or edit only, not ownership, and revocation blocks all subsequent access', async () => {
  const note=await createNote();
  const share=(body:object)=>request(app).post(`/api/notes/${note.id}/shares`).set(headers).set('Cookie',alice).send(body);
  await share({emails:['bob@example.test','missing@example.test'],permission:'write'}).expect(422);
  assert.equal((await db.query('SELECT * FROM note_shares')).rows.length,0);
  await share({emails:['bob@example.test'],permission:'read'}).expect(200);
  assert.equal((await request(app).get('/api/notes/shared-notifications').set('Cookie',bob)).body.count,1);
  const received=(await request(app).get('/api/notes?shared=true').set('Cookie',bob).expect(200)).body.notes;
  assert.equal(received.length,1);assert.equal(received[0].share.permission,'read');assert.equal(received[0].share.ownerName,'alice');
  assert.equal((await request(app).get('/api/notes').set('Cookie',bob)).body.notes.length,0);
  await request(app).get(`/api/notes/${note.id}`).set('Cookie',bob).expect(200);
  await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie',bob).send({version:1,content:'Not allowed'}).expect(404);
  await request(app).delete(`/api/notes/${note.id}`).set(headers).set('Cookie',bob).send({}).expect(404);
  await request(app).post(`/api/notes/${note.id}/shares`).set(headers).set('Cookie',bob).send({emails:['alice@example.test'],permission:'write'}).expect(404);
  await share({emails:['bob@example.test'],permission:'write'}).expect(200);
  await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie',bob).send({version:1,content:'Shared edit'}).expect(200);
  await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie',alice).send({version:1,content:'Stale owner edit'}).expect(409);
  const file=(await request(app).post(`/api/attachments/notes/${note.id}`).set(headers).set('Cookie',bob).send({name:'shared.txt',data:'YQ=='}).expect(201)).body.attachment;
  await request(app).get(file.url).set('Cookie',bob).expect(200);
  await request(app).delete(`/api/notes/${note.id}/shares/${bobId}`).set(headers).set('Cookie',alice).send({}).expect(204);
  await request(app).get(`/api/notes/${note.id}`).set('Cookie',bob).expect(404);
  await request(app).get(file.url).set('Cookie',bob).expect(404);
  await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie',bob).send({version:2,content:'Revoked edit'}).expect(404);
  assert.equal((await request(app).get('/api/notes?shared=true').set('Cookie',bob)).body.notes.length,0);
});

test('every notes endpoint requires an authenticated session', async () => {
  const id = randomUUID();
  assert.equal((await request(app).get('/api/notes')).status, 401);
  assert.equal((await request(app).get(`/api/notes/${id}`)).status, 401);
  assert.equal((await request(app).post('/api/notes').set(headers).send(payload)).status, 401);
  assert.equal((await request(app).patch(`/api/notes/${id}`).set(headers).send({ title: 'Sửa', version: 1 })).status, 401);
  assert.equal((await request(app).delete(`/api/notes/${id}`).set(headers).send({})).status, 401);
});

test('an unverified account can create and read its own note', async () => {
  const note = await createNote();
  assert.equal(note.title, payload.title);
  assert.equal(note.content, payload.content);
  assert.equal(note.version, 1);
  assert.ok(Number.isFinite(Date.parse(note.createdAt)));
  assert.ok(Number.isFinite(Date.parse(note.updatedAt)));
  const stored = await db.query<{ owner_id: string }>('SELECT owner_id FROM notes WHERE id = $1', [note.id]);
  assert.equal(stored.rows[0].owner_id, aliceId);
  const read = await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice);
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.note, note);
  assert.equal(read.body.note.owner_id, undefined);
  assert.equal(read.body.note.password_hash, undefined);
  assert.equal(read.headers['cache-control'], 'no-store');
});

test('a note requires only title and content and returns its resource location', async () => {
  const response = await request(app).post('/api/notes').set(headers).set('Cookie', alice).send(payload);
  assert.equal(response.status, 201);
  assert.equal(response.headers.location, `/api/notes/${response.body.note.id}`);
  assert.deepEqual(Object.keys(response.body.note).sort(), ['completed', 'completedAt', 'content', 'createdAt', 'daily', 'dueAt', 'id', 'important', 'labels', 'pinned', 'pinnedAt', 'title', 'updatedAt', 'version']);
});

test('retrying creation with the same key returns the original note without duplicates', async () => {
  const key = randomUUID();
  const first = await request(app).post('/api/notes').set(headers).set('Idempotency-Key', key).set('Cookie', alice).send(payload);
  const again = await request(app).post('/api/notes').set(headers).set('Idempotency-Key', key).set('Cookie', alice)
    .send({ title: 'Nội dung gõ tiếp', content: 'Client sẽ PATCH sau khi biết ID.' });
  assert.equal(first.status, 201);
  assert.equal(again.status, 201);
  assert.deepEqual(again.body.note, first.body.note);
  assert.equal((await db.query('SELECT id FROM notes')).rows.length, 1);
});

test('concurrent creation retries are atomic and keys are scoped to each owner', async () => {
  const key = randomUUID();
  const requests = await Promise.all([1, 2].map(() => request(app).post('/api/notes').set(headers)
    .set('Idempotency-Key', key).set('Cookie', alice).send(payload)));
  assert.equal(requests[0].status, 201);
  assert.equal(requests[1].status, 201);
  assert.equal(requests[0].body.note.id, requests[1].body.note.id);
  const other = await request(app).post('/api/notes').set(headers).set('Idempotency-Key', key).set('Cookie', bob).send(payload);
  assert.equal(other.status, 201);
  assert.notEqual(other.body.note.id, requests[0].body.note.id);
  assert.equal((await db.query('SELECT id FROM notes')).rows.length, 2);
});

test('an invalid creation key is rejected', async () => {
  const result = await request(app).post('/api/notes').set(headers).set('Idempotency-Key', 'invalid').set('Cookie', alice).send(payload);
  assert.equal(result.status, 422);
  assert.equal((await db.query('SELECT id FROM notes')).rows.length, 0);
});

test('the owner is derived from the session and cannot be supplied by a client', async () => {
  for (const forged of [{ ownerId: bobId }, { owner_id: bobId }, { id: randomUUID() }, { version: 99 }]) {
    const result = await request(app).post('/api/notes').set(headers).set('Cookie', alice).send({ ...payload, ...forged });
    assert.equal(result.status, 422);
  }
  assert.equal((await db.query('SELECT id FROM notes')).rows.length, 0);
});

test('empty and invalid fields are rejected before writing to the database', async () => {
  for (const body of [{}, { title: ' ', content: '\n\t' }, { title: 123, content: {} }, [], null]) {
    const response = await request(app).post('/api/notes').set(headers).set('Cookie', alice).type('json').send(body ?? 'null');
    assert.equal(response.status, body === null ? 400 : 422);
  }
  assert.equal((await db.query('SELECT id FROM notes')).rows.length, 0);
});

test('title whitespace is normalized while content formatting is preserved', async () => {
  const content = '  Dòng một\n\n  Dòng hai\t  ';
  const note = await createNote(alice, { title: '  Tiêu đề  ', content });
  assert.equal(note.title, 'Tiêu đề');
  assert.equal(note.content, content);
});

test('input limits handle Vietnamese text without the old 16 KB auth-body limit', async () => {
  const accepted = await createNote(alice, { title: 'a'.repeat(200), content: 'đ'.repeat(100000) });
  assert.equal(accepted.content.length, 100000);
  const response = await request(app).post('/api/notes').set(headers).set('Cookie', alice)
    .send({ title: 'a'.repeat(201), content: 'a'.repeat(100001) });
  assert.equal(response.status, 422);
  assert.ok(response.body.fields.title);
  assert.ok(response.body.fields.content);
  const tooLarge = await request(app).post('/api/notes').set(headers).set('Cookie', alice)
    .send({ title: 'Quá lớn', content: 'a'.repeat(1100000) });
  assert.equal(tooLarge.status, 413);
});

test('the list contains only notes owned by the authenticated user', async () => {
  const own = await createNote();
  const other = await createNote(bob, { title: 'Riêng của Bob', content: 'Không được trả cho Alice.' });
  const response = await request(app).get('/api/notes').set('Cookie', alice);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.notes.map((note: { id: string }) => note.id), [own.id]);
  assert.equal(JSON.stringify(response.body).includes(other.content), false);
  assert.deepEqual(response.body.pagination, { limit: 50, offset: 0, hasMore: false });
});

test('an empty account receives an empty list', async () => {
  await createNote(bob);
  const response = await request(app).get('/api/notes').set('Cookie', alice);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.notes, []);
});

test('another account cannot read, change or delete a note even if it knows the UUID', async () => {
  const note = await createNote();
  const missing = await request(app).get(`/api/notes/${randomUUID()}`).set('Cookie', bob);
  const read = await request(app).get(`/api/notes/${note.id}`).set('Cookie', bob);
  const edit = await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie', bob).send({ content: 'Ghi đè', version: 1 });
  const remove = await request(app).delete(`/api/notes/${note.id}`).set(headers).set('Cookie', bob).send({});
  for (const response of [read, edit, remove]) {
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, missing.body);
  }
  const original = await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice);
  assert.equal(original.body.note.content, payload.content);
  assert.equal(original.body.note.version, 1);
});

test('editing a title preserves content and advances version and modification time', async () => {
  const note = await createNote();
  await db.query("UPDATE notes SET updated_at = '2020-01-01T00:00:00Z' WHERE id = $1", [note.id]);
  const response = await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie', alice)
    .send({ title: 'Tiêu đề mới', version: note.version });
  assert.equal(response.status, 200);
  assert.equal(response.body.note.title, 'Tiêu đề mới');
  assert.equal(response.body.note.content, payload.content);
  assert.equal(response.body.note.version, 2);
  assert.equal(response.body.note.createdAt, note.createdAt);
  assert.ok(Date.parse(response.body.note.updatedAt) > Date.parse('2020-01-01T00:00:00Z'));
});

test('editing content preserves its formatting and the existing title', async () => {
  const note = await createNote();
  const content = '  Nội dung mới\n\nGiữ nguyên định dạng.  ';
  const response = await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie', alice).send({ content, version: 1 });
  assert.equal(response.status, 200);
  assert.equal(response.body.note.title, payload.title);
  assert.equal(response.body.note.content, content);
});

test('invalid, empty and ownership-changing patches leave the note untouched', async () => {
  const note = await createNote();
  for (const body of [
    {}, { version: 1 }, { title: ' ' , version: 1 }, { content: 42, version: 1 },
    { title: 'Mới' }, { title: 'Mới', version: '1' }, { title: 'Mới', version: 0 },
    { title: 'Mới', version: 1.5 }, { title: 'Mới', version: 1, owner_id: bobId },
  ]) {
    const response = await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie', alice).send(body);
    assert.equal(response.status, 422);
  }
  assert.deepEqual((await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice)).body.note, note);
});

test('a stale save is rejected and simultaneous edits cannot silently overwrite each other', async () => {
  const note = await createNote();
  const results = await Promise.all([
    request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie', alice).send({ content: 'Thay đổi A', version: 1 }),
    request(app).patch(`/api/notes/${note.id}`).set(headers).set('Cookie', alice).send({ content: 'Thay đổi B', version: 1 }),
  ]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  assert.equal(results.find(response => response.status === 409)!.body.code, 'NOTE_VERSION_CONFLICT');
  const current = await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice);
  assert.deepEqual(current.body.note, results.find(response => response.status === 200)!.body.note);
  assert.equal(current.body.note.version, 2);
});

test('lists sort by latest modification and pagination has a stable tie-breaker', async () => {
  const notes = [await createNote(), await createNote(), await createNote()];
  await db.query("UPDATE notes SET updated_at = '2020-01-01T00:00:00Z'");
  const first = await request(app).get('/api/notes?limit=2&offset=0').set('Cookie', alice);
  const second = await request(app).get('/api/notes?limit=2&offset=2').set('Cookie', alice);
  assert.equal(first.body.pagination.hasMore, true);
  assert.equal(second.body.pagination.hasMore, false);
  const ids = [...first.body.notes, ...second.body.notes].map((note: { id: string }) => note.id);
  assert.deepEqual(ids, notes.map(note => note.id).sort().reverse());
  await request(app).patch(`/api/notes/${notes[0].id}`).set(headers).set('Cookie', alice).send({ title: 'Vừa sửa', version: 1 });
  const latest = await request(app).get('/api/notes').set('Cookie', alice);
  assert.equal(latest.body.notes[0].id, notes[0].id);
  const beyond = await request(app).get('/api/notes?offset=100').set('Cookie', alice);
  assert.deepEqual(beyond.body.notes, []);
  assert.equal(beyond.body.pagination.hasMore, false);
});

test('invalid or ownership-related list parameters are rejected', async () => {
  for (const query of ['limit=0', 'limit=101', 'limit=-1', 'limit=1.5', 'limit=abc', 'offset=-1', 'offset=1000001', 'limit=1&limit=2', `ownerId=${bobId}`]) {
    const response = await request(app).get(`/api/notes?${query}`).set('Cookie', alice);
    assert.equal(response.status, 422, query);
  }
});

test('malformed and nonexistent UUIDs return 404 without database errors', async () => {
  for (const id of ['not-a-uuid', encodeURIComponent("' OR 1=1 --"), randomUUID()]) {
    assert.equal((await request(app).get(`/api/notes/${id}`).set('Cookie', alice)).status, 404);
    assert.equal((await request(app).patch(`/api/notes/${id}`).set(headers).set('Cookie', alice).send({ title: 'Mới', version: 1 })).status, 404);
    assert.equal((await request(app).delete(`/api/notes/${id}`).set(headers).set('Cookie', alice).send({})).status, 404);
  }
});

test('SQL-like note text is stored literally rather than executed', async () => {
  const content = "'); DROP TABLE users; --";
  const note = await createNote(alice, { title: "' OR '1'='1", content });
  const response = await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice);
  assert.equal(response.body.note.content, content);
  assert.equal((await db.query('SELECT id FROM users')).rows.length, 2);
});

test('deletion removes only the owned note and repeated deletion returns 404', async () => {
  const own = await createNote();
  const other = await createNote(bob);
  const response = await request(app).delete(`/api/notes/${own.id}`).set(headers).set('Cookie', alice).send({});
  assert.equal(response.status, 204);
  assert.equal(response.text, '');
  assert.equal((await request(app).get(`/api/notes/${own.id}`).set('Cookie', alice)).status, 404);
  assert.equal((await request(app).delete(`/api/notes/${own.id}`).set(headers).set('Cookie', alice).send({})).status, 404);
  assert.equal((await request(app).get(`/api/notes/${other.id}`).set('Cookie', bob)).status, 200);
});

test('notes requests preserve the cross-origin and custom-header protections', async () => {
  const note = await createNote();
  const forged = await request(app).patch(`/api/notes/${note.id}`).set(headers).set('Origin', 'https://other.example')
    .set('Cookie', alice).send({ title: 'Không hợp lệ', version: 1 });
  assert.equal(forged.status, 403);
  assert.equal((await request(app).post('/api/notes').set('Cookie', alice).send(payload)).status, 403);
});

test('expired and logged-out sessions cannot access notes', async () => {
  const note = await createNote();
  await db.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [aliceId]);
  assert.equal((await request(app).get(`/api/notes/${note.id}`).set('Cookie', alice)).status, 401);
  const temp = await register('logged-out@example.test');
  await request(app).post('/api/auth/logout').set(headers).set('Cookie', temp.cookie).send({});
  assert.equal((await request(app).get('/api/notes').set('Cookie', temp.cookie)).status, 401);
});

test('the notes schema can be added to an account database without losing accounts', async () => {
  // This database is the isolated in-memory test database, not .data/postgres.
  await db.query('DROP TABLE note_unlocks');
  await db.query('DROP TABLE note_shares');
  await db.query('DROP TABLE attachments');
  await db.query('DROP TABLE note_labels');
  await db.query('DROP TABLE notes');
  const before = (await db.query('SELECT id FROM users ORDER BY id')).rows;
  await migrate(db);
  await migrate(db);
  assert.deepEqual((await db.query('SELECT id FROM users ORDER BY id')).rows, before);
  assert.equal((await request(app).get('/api/notes').set('Cookie', alice)).status, 200);
  await createNote();
});
