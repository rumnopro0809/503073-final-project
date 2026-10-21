import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { Database, Sql } from './database.js';
import type { SendVerification } from './mail.js';

const COOKIE = 'ghichu_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('hex');
type UserRow = Record<string, unknown> & {
  id: string; email: string; display_name: string; email_verified_at: Date | null; password_hash: string;
};
const publicUser = (u: UserRow) => ({ id: u.id, email: u.email, displayName: u.display_name, emailVerified: Boolean(u.email_verified_at) });
const cookieOptions = (production: boolean) => ({ httpOnly: true, sameSite: 'lax' as const, secure: production, path: '/' });

export interface AuthOptions { db: Database; appUrl: string; production: boolean; sendVerification: SendVerification; rateLimit?: boolean; }

export function authRouter(options: AuthOptions) {
  const { db, appUrl, production, sendVerification } = options;
  const router = Router();
  const limiter = (limit: number) => rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    skip: () => options.rateLimit === false,
  });

  async function currentUser(req: Request) {
    const token = req.cookies?.[COOKIE];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return undefined;
    const { rows } = await db.query<UserRow>(
      `SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`, [tokenHash(token)],
    );
    return rows[0];
  }

  async function createSession(sql: Sql, userId: string, req: Request) {
    const previous = req.cookies?.[COOKIE];
    if (typeof previous === 'string') await sql.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(previous)]);
    const token = newToken();
    await sql.query('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash(token), userId, new Date(Date.now() + SESSION_MS).toISOString()]);
    return token;
  }

  async function createVerification(sql: Sql, userId: string) {
    const token = newToken();
    await sql.query(`INSERT INTO verification_tokens(token_hash, user_id, expires_at) VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at`,
      [tokenHash(token), userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]);
    return `${new URL(appUrl).origin}/api/auth/verify?token=${token}`;
  }

  async function deliver(email: string, url: string) {
    try { await sendVerification(email, url); return 'sent' as const; }
    catch { console.error('Activation email delivery failed. The user can request another email.'); return 'failed' as const; }
  }

  router.get('/me', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = await currentUser(req);
    if (!user) { res.clearCookie(COOKIE, cookieOptions(production)); res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    res.json({ user: publicUser(user) });
  });

  router.post('/register', limiter(10), async (req, res) => {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fields: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fields.email = 'Nhập địa chỉ email hợp lệ.';
    if (!displayName || displayName.length > 80) fields.displayName = 'Tên hiển thị cần có từ 1 đến 80 ký tự.';
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) fields.password = 'Mật khẩu cần ít nhất 8 ký tự và không vượt quá 72 byte.';
    if (password !== body.confirmPassword) fields.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
    if (Object.keys(fields).length) { res.status(422).json({ message: 'Bạn kiểm tra lại thông tin bên dưới nhé.', fields }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const result = await db.transaction(async sql => {
        const { rows } = await sql.query<UserRow>(`INSERT INTO users(id, email, display_name, password_hash)
          VALUES ($1, $2, $3, $4) RETURNING *`, [randomUUID(), email, displayName, passwordHash]);
        const user = rows[0];
        return { user, token: await createSession(sql, user.id, req), activationUrl: await createVerification(sql, user.id) };
      });
      const emailDelivery = await deliver(email, result.activationUrl);
      res.cookie(COOKIE, result.token, { ...cookieOptions(production), maxAge: SESSION_MS });
      res.status(201).json({ user: publicUser(result.user), emailDelivery });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({ message: 'Email này đã được sử dụng.', fields: { email: 'Email này đã có tài khoản. Bạn có thể đăng nhập.' } }); return;
      }
      throw error;
    }
  });

  // A valid dummy hash keeps unknown-email and wrong-password checks comparable.
  const dummyHash = bcrypt.hashSync(newToken(), 12);
  router.post('/login', limiter(20), async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password || Buffer.byteLength(password, 'utf8') > 72) {
      res.status(401).json({ message: 'Email hoặc mật khẩu chưa đúng.' }); return;
    }
    const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !valid) { res.status(401).json({ message: 'Email hoặc mật khẩu chưa đúng.' }); return; }
    const token = await db.transaction(sql => createSession(sql, user.id, req));
    res.cookie(COOKIE, token, { ...cookieOptions(production), maxAge: SESSION_MS });
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', async (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (typeof token === 'string') await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
    res.clearCookie(COOKIE, cookieOptions(production));
    res.status(204).end();
  });

  router.post('/resend-verification', limiter(5), async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    if (user.email_verified_at) { res.json({ emailDelivery: 'sent' }); return; }
    const activationUrl = await db.transaction(sql => createVerification(sql, user.id));
    const emailDelivery = await deliver(user.email, activationUrl);
    res.status(emailDelivery === 'sent' ? 200 : 503).json({ emailDelivery,
      message: emailDelivery === 'sent' ? 'Đã gửi lại email xác minh.' : 'Chưa gửi được email. Bạn vui lòng thử lại sau.' });
  });

  router.get('/verify', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.query.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) { res.redirect('/login?verification=invalid'); return; }
    const verified = await db.transaction(async sql => {
      const { rows } = await sql.query<{ user_id: string }>(
        'DELETE FROM verification_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id', [tokenHash(token)]);
      if (!rows[0]) return false;
      await sql.query('UPDATE users SET email_verified_at = NOW() WHERE id = $1', [rows[0].user_id]);
      return true;
    });
    res.redirect(verified ? '/?verification=success' : '/login?verification=invalid');
  });
  return router;
}
