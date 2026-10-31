import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { Database, Sql } from './database.js';
import type { SendVerification } from './mail.js';
import { SESSION_COOKIE as COOKIE, hashToken as tokenHash, findSessionUser, type SessionUser } from './session.js';
import { decodeUpload, imageType } from './uploads.js';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const newToken = () => randomBytes(32).toString('hex');
type UserRow = Record<string, unknown> & {
  id: string; email: string; display_name: string; email_verified_at: Date | null; password_hash: string;
};
const publicUser = (u: SessionUser) => ({ id: u.id, email: u.email, displayName: u.display_name, emailVerified: Boolean(u.email_verified_at),
  avatarUrl: (u.has_avatar || u.avatar_data) ? `/api/auth/avatar?v=${u.profile_version}` : null });
const cookieOptions = (production: boolean) => ({ httpOnly: true, sameSite: 'lax' as const, secure: production, path: '/' });

export interface AuthOptions { db: Database; appUrl: string; production: boolean; sendVerification: SendVerification; sendPasswordReset?: SendVerification; rateLimit?: boolean; }

export function authRouter(options: AuthOptions) {
  const { db, appUrl, production, sendVerification } = options;
  const router = Router();
  const limiter = (limit: number) => rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    skip: () => options.rateLimit === false,
  });

  async function currentUser(req: Request) {
    return findSessionUser(db, req);
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

  router.patch('/profile', async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    const name = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!name || name.length > 80 || Object.keys(req.body ?? {}).some(key => key !== 'displayName')) {
      res.status(422).json({ message: 'Tên hiển thị cần có từ 1 đến 80 ký tự.' }); return;
    }
    await db.query('UPDATE users SET display_name = $1, profile_version = profile_version + 1 WHERE id = $2', [name, user.id]);
    res.json({ user: publicUser((await currentUser(req))!) });
  });

  const defaultPreferences = { density: 'comfortable', fontSize: 14, theme: 'light', noteColor: '#fffdf7' };
  router.get('/preferences', async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    const { rows } = await db.query<{preferences: Record<string, unknown>}>('SELECT preferences FROM users WHERE id=$1',[user.id]);
    res.json({preferences: {...defaultPreferences,...rows[0].preferences}});
  });
  router.patch('/preferences', async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    const body = req.body ?? {};
    const allowed: Record<string, unknown[]> = { density:['comfortable','compact'], fontSize:[14,16,18], theme:['light','dark'], noteColor:['#fffdf7','#f0eaff','#e8f5ee','#fff2d8','#fce9ef','#e8f1ff'] };
    if (!Object.keys(body).length || Object.entries(body).some(([key,value]) => !allowed[key]?.includes(value))) {
      res.status(422).json({message:'Tùy chọn hiển thị không hợp lệ.'}); return;
    }
    const {rows} = await db.query<{preferences:Record<string,unknown>}>(`UPDATE users SET preferences=preferences || $1::jsonb WHERE id=$2 RETURNING preferences`,[JSON.stringify(body),user.id]);
    res.json({preferences:{...defaultPreferences,...rows[0].preferences}});
  });

  router.get('/avatar', async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    const { rows } = await db.query<{ avatar_data: Uint8Array | null; avatar_type: string }>('SELECT avatar_data, avatar_type FROM users WHERE id = $1', [user.id]);
    if (!rows[0]?.avatar_data) { res.sendStatus(404); return; }
    res.type(rows[0].avatar_type).send(Buffer.from(rows[0].avatar_data));
  });
  router.post('/avatar', async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    const bytes = decodeUpload(req.body?.data, 2 * 1024 * 1024);
    const type = bytes && imageType(bytes);
    if (!bytes || !type) { res.status(422).json({ message: 'Chọn ảnh PNG, JPEG hoặc WebP hợp lệ, tối đa 2 MB.' }); return; }
    await db.query('UPDATE users SET avatar_data = $1, avatar_type = $2, profile_version = profile_version + 1 WHERE id = $3', [bytes, type, user.id]);
    res.json({ user: publicUser((await currentUser(req))!) });
  });
  router.delete('/avatar', async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    await db.query('UPDATE users SET avatar_data = NULL, avatar_type = NULL, profile_version = profile_version + 1 WHERE id = $1', [user.id]);
    res.json({ user: publicUser((await currentUser(req))!) });
  });

  const passwordFields = (body: Record<string, unknown>) => {
    const fields: Record<string, string> = {};
    if (typeof body.password !== 'string' || body.password.length < 8 || Buffer.byteLength(body.password, 'utf8') > 72) fields.password = 'Mật khẩu cần ít nhất 8 ký tự và không vượt quá 72 byte.';
    if (body.password !== body.confirmPassword) fields.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
    return fields;
  };
  router.post('/change-password', limiter(10), async (req, res) => {
    const user = await currentUser(req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    const body = req.body ?? {};
    const fields = passwordFields(body);
    if (typeof body.currentPassword !== 'string' || Buffer.byteLength(body.currentPassword) > 72) fields.currentPassword = 'Nhập mật khẩu hiện tại.';
    if (Object.keys(fields).length) { res.status(422).json({ message: 'Kiểm tra lại mật khẩu.', fields }); return; }
    const hash = await bcrypt.hash(body.password, 12);
    const changed = await db.transaction(async sql => {
      const { rows } = await sql.query<UserRow>('SELECT * FROM users WHERE id = $1 FOR UPDATE', [user.id]);
      if (!rows[0] || !await bcrypt.compare(body.currentPassword, rows[0].password_hash)) return false;
      // Recheck the session under the user lock; a concurrent password change may have revoked it.
      if (!await findSessionUser(sql, req)) return false;
      await sql.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
      await sql.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
      await sql.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      return true;
    });
    if (!changed) { res.status(422).json({ message: 'Mật khẩu hiện tại chưa đúng hoặc phiên đã hết hạn.', fields: { currentPassword: 'Kiểm tra mật khẩu hiện tại.' } }); return; }
    res.clearCookie(COOKIE, cookieOptions(production));
    res.json({ message: 'Đã đổi mật khẩu và đăng xuất các phiên. Vui lòng đăng nhập lại.' });
  });

  router.post('/forgot-password', limiter(5), async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) { res.status(422).json({ message: 'Nhập địa chỉ email hợp lệ.' }); return; }
    const token = newToken();
    const issued = await db.transaction(async sql => {
      const { rows } = await sql.query<{ id: string }>('SELECT id FROM users WHERE email = $1 FOR UPDATE', [email]);
      if (!rows[0]) return false;
      await sql.query(`INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)
        ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash, expires_at=EXCLUDED.expires_at`,
      [tokenHash(token), rows[0].id, new Date(Date.now() + 30 * 60 * 1000).toISOString()]);
      return true;
    });
    if (issued) {
      try {
        if (!options.sendPasswordReset) throw new Error('Password reset mail is not configured');
        await options.sendPasswordReset(email, `${new URL(appUrl).origin}/reset-password?token=${token}`);
      } catch { console.error('Password reset email delivery failed.'); }
    }
    // Do not disclose whether the address belongs to an account, including mail delivery failures.
    res.json({ message: 'Nếu email có tài khoản, liên kết đặt lại mật khẩu sẽ được gửi. Kiểm tra hộp thư; liên kết có hiệu lực 30 phút.' });
  });
  router.post('/reset-password', limiter(10), async (req, res) => {
    const body = req.body ?? {};
    const fields = passwordFields(body);
    if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) fields.token = 'Liên kết đặt lại không hợp lệ.';
    if (Object.keys(fields).length) { res.status(422).json({ message: 'Kiểm tra lại thông tin đặt lại mật khẩu.', fields }); return; }
    const hash = await bcrypt.hash(body.password, 12);
    const changed = await db.transaction(async sql => {
      // Always lock the user before token mutation, matching change-password/forgot-password.
      const { rows } = await sql.query<{ id: string }>(`SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id=u.id
        WHERE t.token_hash=$1 AND t.expires_at>NOW() FOR UPDATE OF u`, [tokenHash(body.token)]);
      if (!rows[0]) return false;
      const consumed = await sql.query<{ user_id: string }>('DELETE FROM password_reset_tokens WHERE token_hash=$1 AND expires_at>NOW() RETURNING user_id', [tokenHash(body.token)]);
      if (!consumed.rows[0]) return false;
      await sql.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, rows[0].id]);
      await sql.query('DELETE FROM sessions WHERE user_id=$1', [rows[0].id]);
      return true;
    });
    if (!changed) { res.status(422).json({ message: 'Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.' }); return; }
    // No auto-login after reset; unrelated signed-in accounts keep their own sessions.
    res.json({ message: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.' });
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
