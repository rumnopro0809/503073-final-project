import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { mkdir } from 'node:fs/promises';

export interface Sql {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Sql {
  transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Both adapters execute the same parameterized PostgreSQL queries.
export async function openDatabase(options: { url?: string; directory?: string } = {}): Promise<Database> {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url });
    return {
      query: (text, params) => pool.query(text, params),
      async transaction(work) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await work({ query: (text, params) => client.query(text, params) });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      },
      close: () => pool.end(),
    };
  }
  if (options.directory) await mkdir(options.directory, { recursive: true });
  const local = new PGlite(options.directory);
  await local.waitReady;
  return {
    query: (text, params) => local.query(text, params),
    transaction: work => local.transaction(tx => work({ query: (text, params) => tx.query(text, params) })),
    close: () => local.close(),
  };
}

export async function migrate(db: Database) {
  await db.transaction(async sql => {
    await sql.query(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE,
      display_name VARCHAR(80) NOT NULL, password_hash TEXT NOT NULL,
      email_verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS verification_tokens (
      token_hash CHAR(64) PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )`);
    await sql.query('CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)');
    await sql.query(`CREATE TABLE IF NOT EXISTS notes (
      id UUID PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL CHECK (char_length(btrim(title)) > 0),
      content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 100000),
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await sql.query(`CREATE INDEX IF NOT EXISTS notes_owner_updated_idx
      ON notes(owner_id, updated_at DESC, id DESC)`);
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS creation_key UUID');
    await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS notes_owner_creation_key_idx
      ON notes(owner_id, creation_key) WHERE creation_key IS NOT NULL`);
    await sql.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await sql.query('DELETE FROM verification_tokens WHERE expires_at <= NOW()');
  });
}
