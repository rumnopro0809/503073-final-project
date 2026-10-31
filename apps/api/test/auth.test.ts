import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { openDatabase, migrate, type Database } from '../src/database.js';
import { createApp } from '../src/app.js';

let db: Database;
let app: ReturnType<typeof createApp>;
let messages: { email: string; url: string }[] = [];
let resets: { email: string; url: string }[] = [];
let failEmail = false;
const base = { email: 'student@example.test', displayName: 'Sinh viên', password: 'A good password 123!', confirmPassword: 'A good password 123!' };
const options = () => ({ db, appUrl: 'http://localhost:5173', production: false, rateLimit: false,
  sendPasswordReset: async (email: string, url: string) => { if (failEmail) throw new Error('SMTP unavailable'); resets.push({ email, url }); },
  sendVerification: async (email: string, url: string) => { if (failEmail) throw new Error('SMTP unavailable'); messages.push({ email, url }); } });
const post = (route: string, body: object, cookie?: string) => {
  const req = request(app).post(`/api/auth/${route}`).set('X-Requested-With', 'GhiChu').set('Origin', 'http://localhost:5173');
  if (cookie) req.set('Cookie', cookie);
  return req.send(body);
};
const cookieOf = (res: { headers: Record<string, unknown> }) => (res.headers['set-cookie'] as string[])[0].split(';')[0];

before(async () => { db = await openDatabase(); await migrate(db); app = createApp(options()); });
beforeEach(async () => { await db.query('TRUNCATE users CASCADE'); messages = []; resets = []; failEmail = false; });
after(async () => { await db.close(); });

test('unauthenticated requests cannot read the current account', async () => {
  const response = await request(app).get('/api/auth/me');
  assert.equal(response.status, 401);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('profile updates are authenticated, validate names and cannot change email or ownership', async () => {
  await request(app).patch('/api/auth/profile').set('X-Requested-With','GhiChu').send({displayName:'New'}).expect(401);
  const registered = await post('register', base);
  const cookie = cookieOf(registered);
  for (const body of [{displayName:''},{displayName:'x'.repeat(81)},{displayName:'New',email:'intruder@example.test'}])
    await request(app).patch('/api/auth/profile').set('X-Requested-With','GhiChu').set('Cookie',cookie).send(body).expect(422);
  const changed = await request(app).patch('/api/auth/profile').set('X-Requested-With','GhiChu').set('Cookie',cookie).send({displayName:'  Tên mới  '}).expect(200);
  assert.equal(changed.body.user.displayName,'Tên mới'); assert.equal(changed.body.user.email,base.email);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie',cookie)).body.user.displayName,'Tên mới');
});

test('preferences validate every field, merge partial changes and stay scoped to the account', async () => {
  const cookie=cookieOf(await post('register',base));
  await request(app).get('/api/auth/preferences').expect(401);
  const patch=(body:object)=>request(app).patch('/api/auth/preferences').set('X-Requested-With','GhiChu').set('Cookie',cookie).send(body);
  for(const body of [{theme:'script'},{fontSize:200},{noteColor:'url(evil)'},{unknown:true},{}]) assert.equal((await patch(body)).status,422);
  assert.equal((await patch({theme:'dark',fontSize:18})).status,200);
  assert.equal((await patch({noteColor:'#e8f1ff'})).status,200);
  await migrate(db);
  const saved=(await request(app).get('/api/auth/preferences').set('Cookie',cookie).expect(200)).body.preferences;
  assert.equal(saved.theme,'dark'); assert.equal(saved.fontSize,18); assert.equal(saved.noteColor,'#e8f1ff');
  const other=cookieOf(await post('register',{...base,email:'other@example.test'}));
  assert.equal((await request(app).get('/api/auth/preferences').set('Cookie',other)).body.preferences.theme,'light');
});

test('avatars validate content and size, persist and remain private to the signed-in account', async () => {
  const cookie = cookieOf(await post('register',base));
  await request(app).post('/api/auth/avatar').set('X-Requested-With','GhiChu').send({data:'aGVsbG8='}).expect(401);
  for (const data of ['invalid','aGVsbG8=',Buffer.from('<svg></svg>').toString('base64'),Buffer.alloc(2*1024*1024+1).toString('base64')])
    await request(app).post('/api/auth/avatar').set('X-Requested-With','GhiChu').set('Cookie',cookie).send({data}).expect(422);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const uploaded = await request(app).post('/api/auth/avatar').set('X-Requested-With','GhiChu').set('Cookie',cookie).send({data:png}).expect(200);
  assert.match(uploaded.body.user.avatarUrl,/^\/api\/auth\/avatar\?v=/);
  const image = await request(app).get(uploaded.body.user.avatarUrl).set('Cookie',cookie).expect(200);
  assert.match(image.headers['content-type'],/image\/png/); assert.deepEqual(image.body,Buffer.from(png,'base64'));
  const other = cookieOf(await post('register',{...base,email:'other@example.test'}));
  await request(app).get('/api/auth/avatar').set('Cookie',other).expect(404);
  await request(app).get('/api/auth/avatar').expect(401);
  const removed = await request(app).delete('/api/auth/avatar').set('X-Requested-With','GhiChu').set('Cookie',cookie).send({}).expect(200);
  assert.equal(removed.body.user.avatarUrl,null);
  await request(app).get('/api/auth/avatar').set('Cookie',cookie).expect(404);
});

test('changing password needs the current password and revokes every session and pending reset', async () => {
  const cookie = cookieOf(await post('register',base));
  const second = cookieOf(await post('login',base));
  await post('forgot-password',{email:base.email});
  const next = {currentPassword:base.password,password:'A changed password 2026!',confirmPassword:'A changed password 2026!'};
  await post('change-password',next).then(r=>assert.equal(r.status,401));
  assert.equal((await post('change-password',{...next,currentPassword:'wrong'},cookie)).status,422);
  assert.equal((await post('change-password',{...next,confirmPassword:'wrong'},cookie)).status,422);
  assert.equal((await post('change-password',next,cookie)).status,200);
  for (const session of [cookie,second]) await request(app).get('/api/auth/me').set('Cookie',session).expect(401);
  assert.equal((await post('login',base)).status,401);
  assert.equal((await post('login',{email:base.email,password:next.password})).status,200);
  assert.equal((await db.query('SELECT * FROM password_reset_tokens')).rows.length,0);
});

test('reset links replace previous links, expire, are single-use and never auto-login', async () => {
  const cookie = cookieOf(await post('register',base));
  const known = await post('forgot-password',{email:base.email});
  const unknown = await post('forgot-password',{email:'unknown@example.test'});
  assert.equal(known.status,200); assert.deepEqual(known.body,unknown.body); assert.equal(resets.length,1);
  const firstToken = new URL(resets[0].url).searchParams.get('token');
  await post('forgot-password',{email:base.email});
  const token = new URL(resets[1].url).searchParams.get('token');
  const body = {password:'New password 2026!',confirmPassword:'New password 2026!',token};
  assert.equal((await post('reset-password',{...body,token:firstToken})).status,422);
  assert.equal((await post('reset-password',{...body,confirmPassword:'wrong'})).status,422);
  const reset = await post('reset-password',body);
  assert.equal(reset.status,200); assert.equal(reset.headers['set-cookie'],undefined);
  assert.equal((await post('reset-password',body)).status,422);
  await request(app).get('/api/auth/me').set('Cookie',cookie).expect(401);
  assert.equal((await post('login',base)).status,401);
  assert.equal((await post('login',{email:base.email,password:body.password})).status,200);
  await post('forgot-password',{email:base.email});
  await db.query("UPDATE password_reset_tokens SET expires_at=NOW()-INTERVAL '1 second'");
  const expiredToken = new URL(resets.at(-1)!.url).searchParams.get('token');
  assert.equal((await post('reset-password',{...body,token:expiredToken})).status,422);
  failEmail=true;
  assert.deepEqual((await post('forgot-password',{email:base.email})).body,unknown.body);
});

test('registration hashes password, auto-logs in and sends an activation link', async () => {
  const response = await post('register', { ...base, email: ' Student@Example.Test ' });
  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, base.email);
  assert.equal(response.body.user.emailVerified, false);
  assert.equal(response.body.user.password_hash, undefined);
  assert.equal(response.body.user.password, undefined);
  const cookie = cookieOf(response);
  assert.match((response.headers['set-cookie'] as unknown as string[])[0], /HttpOnly/);
  assert.match((response.headers['set-cookie'] as unknown as string[])[0], /SameSite=Lax/);
  const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.displayName, base.displayName);
  const { rows } = await db.query<{ password_hash: string }>('SELECT password_hash FROM users');
  assert.match(rows[0].password_hash, /^\$2[aby]\$12\$/);
  assert.notEqual(rows[0].password_hash, base.password);
  assert.equal(await bcrypt.compare(base.password, rows[0].password_hash), true);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].email, base.email);
  assert.match(messages[0].url, /\/api\/auth\/verify\?token=[a-f0-9]{64}$/);
  const storedSession = await db.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
  assert.notEqual(storedSession.rows[0].token_hash, cookie.split('=')[1]);
});

test('invalid fields do not create an account', async () => {
  const response = await post('register', { email: 'invalid', displayName: ' ', password: 'short', confirmPassword: 'different' });
  assert.equal(response.status, 422);
  assert.deepEqual(Object.keys(response.body.fields).sort(), ['confirmPassword', 'displayName', 'email', 'password']);
  assert.equal((await db.query('SELECT id FROM users')).rows.length, 0);
});

test('bcrypt byte limit also rejects long Unicode passwords', async () => {
  const password = 'đ'.repeat(37);
  const response = await post('register', { ...base, password, confirmPassword: password });
  assert.equal(response.status, 422);
  assert.ok(response.body.fields.password);
});

test('duplicate email is rejected regardless of letter casing', async () => {
  assert.equal((await post('register', base)).status, 201);
  const response = await post('register', { ...base, email: base.email.toUpperCase() });
  assert.equal(response.status, 409);
  assert.ok(response.body.fields.email);
  assert.equal((await db.query('SELECT id FROM users')).rows.length, 1);
});

test('simultaneous registrations cannot create duplicate accounts or partial sessions', async () => {
  const results = await Promise.all([post('register', base), post('register', base)]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await db.query('SELECT id FROM users')).rows.length, 1);
  assert.equal((await db.query('SELECT token_hash FROM sessions')).rows.length, 1);
  assert.equal(messages.length, 1);
});

test('production responses mark the session cookie Secure', async () => {
  const productionApp = createApp({ ...options(), production: true, appUrl: 'https://notes.example.test' });
  const result = await request(productionApp).post('/api/auth/register')
    .set('X-Requested-With', 'GhiChu').set('Origin', 'https://notes.example.test').send(base);
  assert.equal(result.status, 201);
  assert.match((result.headers['set-cookie'] as unknown as string[])[0], /; Secure/);
});

test('login rejects wrong credentials without identifying which field is wrong', async () => {
  await post('register', base);
  const wrong = await post('login', { email: base.email, password: 'incorrect' });
  const unknown = await post('login', { email: 'unknown@example.test', password: 'incorrect' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.message, unknown.body.message);
  assert.equal(wrong.headers['set-cookie'], undefined);
});

test('login rotates the existing session and logout invalidates its token', async () => {
  const registered = await post('register', base);
  const oldCookie = cookieOf(registered);
  const loggedIn = await post('login', { email: base.email, password: base.password }, oldCookie);
  assert.equal(loggedIn.status, 200);
  const newCookie = cookieOf(loggedIn);
  assert.notEqual(newCookie, oldCookie);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', newCookie)).status, 200);
  assert.equal((await post('logout', {}, newCookie)).status, 204);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', newCookie)).status, 401);
});

test('an expired session is rejected', async () => {
  const response = await post('register', base);
  await db.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 minute'");
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookieOf(response))).status, 401);
});

test('verification updates the account and its one-time link cannot be replayed', async () => {
  const registered = await post('register', base);
  const activation = new URL(messages[0].url);
  const verified = await request(app).get(activation.pathname + activation.search);
  assert.equal(verified.status, 302);
  assert.equal(verified.headers.location, '/?verification=success');
  const me = await request(app).get('/api/auth/me').set('Cookie', cookieOf(registered));
  assert.equal(me.body.user.emailVerified, true);
  const replay = await request(app).get(activation.pathname + activation.search);
  assert.equal(replay.headers.location, '/login?verification=invalid');
});

test('expired verification links do not activate accounts', async () => {
  await post('register', base);
  await db.query("UPDATE verification_tokens SET expires_at = NOW() - INTERVAL '1 minute'");
  const url = new URL(messages[0].url);
  const result = await request(app).get(url.pathname + url.search);
  assert.equal(result.headers.location, '/login?verification=invalid');
  assert.equal((await db.query('SELECT email_verified_at FROM users')).rows[0].email_verified_at, null);
});

test('resending verification needs authentication and replaces the previous link', async () => {
  assert.equal((await post('resend-verification', {})).status, 401);
  const registered = await post('register', base);
  const old = new URL(messages[0].url);
  assert.equal((await post('resend-verification', {}, cookieOf(registered))).status, 200);
  assert.equal(messages.length, 2);
  assert.equal((await request(app).get(old.pathname + old.search)).headers.location, '/login?verification=invalid');
  const latest = new URL(messages[1].url);
  assert.equal((await request(app).get(latest.pathname + latest.search)).headers.location, '/?verification=success');
});

test('mail failure preserves the account and auto-login; retry can deliver later', async () => {
  failEmail = true;
  const result = await post('register', base);
  assert.equal(result.status, 201);
  assert.equal(result.body.emailDelivery, 'failed');
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookieOf(result))).status, 200);
  failEmail = false;
  assert.equal((await post('resend-verification', {}, cookieOf(result))).status, 200);
  assert.equal(messages.length, 1);
});

test('cross-origin requests, missing custom header and non-JSON forms are rejected', async () => {
  const crossSite = await request(app).post('/api/auth/register').set('X-Requested-With', 'GhiChu').set('Origin', 'https://other.example').send(base);
  assert.equal(crossSite.status, 403);
  assert.equal((await request(app).post('/api/auth/register').send(base)).status, 403);
  const form = await request(app).post('/api/auth/register').set('X-Requested-With', 'GhiChu').type('form').send(base);
  assert.equal(form.status, 403);
  assert.equal((await db.query('SELECT id FROM users')).rows.length, 0);
});

test('registration attempts are rate-limited', async () => {
  const limited = createApp({ ...options(), rateLimit: true });
  for (let i = 0; i < 10; i++) {
    const response = await request(limited).post('/api/auth/register').set('X-Requested-With', 'GhiChu').send({});
    assert.equal(response.status, 422);
  }
  const blocked = await request(limited).post('/api/auth/register').set('X-Requested-With', 'GhiChu').send({});
  assert.equal(blocked.status, 429);
});

test('accounts, sessions and notes survive closing and reopening the development database', async () => {
  await mkdir(path.resolve('.data'), { recursive: true });
  const folder = await mkdtemp(path.resolve('.data/test-auth-'));
  let persistent = await openDatabase({ directory: folder });
  try {
    await migrate(persistent);
    const firstApp = createApp({ ...options(), db: persistent });
    const result = await request(firstApp).post('/api/auth/register').set('X-Requested-With', 'GhiChu').send(base);
    assert.equal(result.status, 201);
    const cookie = cookieOf(result);
    const created = await request(firstApp).post('/api/notes').set('X-Requested-With', 'GhiChu')
      .set('Cookie', cookie).send({ title: 'Lưu xuống đĩa', content: 'Ghi chú còn nguyên khi mở lại database.' });
    assert.equal(created.status, 201);
    await persistent.close();
    persistent = await openDatabase({ directory: folder });
    await migrate(persistent);
    const reopened = createApp({ ...options(), db: persistent });
    assert.equal((await request(reopened).get('/api/auth/me').set('Cookie', cookie)).status, 200);
    const note = await request(reopened).get(`/api/notes/${created.body.note.id}`).set('Cookie', cookie);
    assert.equal(note.status, 200);
    assert.deepEqual(note.body.note, created.body.note);
    const saved = await persistent.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    assert.equal(saved.rows[0].token_hash, createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
  } finally {
    await persistent.close();
    assert.equal(path.dirname(folder), path.resolve('.data'), 'Only remove a test directory inside .data');
    await rm(folder, { recursive: true, force: true });
  }
});
