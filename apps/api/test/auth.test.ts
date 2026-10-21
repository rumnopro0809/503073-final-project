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
let failEmail = false;
const base = { email: 'student@example.test', displayName: 'Sinh viên', password: 'A good password 123!', confirmPassword: 'A good password 123!' };
const options = () => ({ db, appUrl: 'http://localhost:5173', production: false, rateLimit: false,
  sendVerification: async (email: string, url: string) => { if (failEmail) throw new Error('SMTP unavailable'); messages.push({ email, url }); } });
const post = (route: string, body: object, cookie?: string) => {
  const req = request(app).post(`/api/auth/${route}`).set('X-Requested-With', 'GhiChu').set('Origin', 'http://localhost:5173');
  if (cookie) req.set('Cookie', cookie);
  return req.send(body);
};
const cookieOf = (res: { headers: Record<string, unknown> }) => (res.headers['set-cookie'] as string[])[0].split(';')[0];

before(async () => { db = await openDatabase(); await migrate(db); app = createApp(options()); });
beforeEach(async () => { await db.query('TRUNCATE users CASCADE'); messages = []; failEmail = false; });
after(async () => { await db.close(); });

test('unauthenticated requests cannot read the current account', async () => {
  const response = await request(app).get('/api/auth/me');
  assert.equal(response.status, 401);
  assert.equal(response.headers['cache-control'], 'no-store');
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

test('accounts and sessions survive closing and reopening the development database', async () => {
  await mkdir(path.resolve('.data'), { recursive: true });
  const folder = await mkdtemp(path.resolve('.data/test-auth-'));
  let persistent = await openDatabase({ directory: folder });
  try {
    await migrate(persistent);
    const firstApp = createApp({ ...options(), db: persistent });
    const result = await request(firstApp).post('/api/auth/register').set('X-Requested-With', 'GhiChu').send(base);
    assert.equal(result.status, 201);
    const cookie = cookieOf(result);
    await persistent.close();
    persistent = await openDatabase({ directory: folder });
    await migrate(persistent);
    const reopened = createApp({ ...options(), db: persistent });
    assert.equal((await request(reopened).get('/api/auth/me').set('Cookie', cookie)).status, 200);
    const saved = await persistent.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    assert.equal(saved.rows[0].token_hash, createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
  } finally {
    await persistent.close();
    assert.equal(path.dirname(folder), path.resolve('.data'), 'Only remove a test directory inside .data');
    await rm(folder, { recursive: true, force: true });
  }
});
