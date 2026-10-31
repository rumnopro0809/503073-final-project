import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { Sql } from './database.js';

export const SESSION_COOKIE = 'ghichu_session';
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

export type SessionUser = Record<string, unknown> & {
  id: string;
  email: string;
  display_name: string;
  email_verified_at: Date | null;
};

// Reuse the same database-backed session check for accounts and notes.
// Email verification is intentionally not a prerequisite for using the app.
export async function findSessionUser(db: Sql, req: Request): Promise<SessionUser | undefined> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return undefined;
  const { rows } = await db.query<SessionUser>(
    `SELECT u.id, u.email, u.display_name, u.email_verified_at, (u.avatar_data IS NOT NULL) AS has_avatar, u.profile_version
       FROM users u JOIN sessions s ON s.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)],
  );
  return rows[0];
}
