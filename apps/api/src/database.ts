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
    await sql.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data BYTEA');
    await sql.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(32)');
    await sql.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1');
    await sql.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb");
    await sql.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash CHAR(64) PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
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
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS important BOOLEAN NOT NULL DEFAULT FALSE');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS daily BOOLEAN NOT NULL DEFAULT FALSE');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS live_state BYTEA');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS live_epoch TEXT');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS password_hash TEXT');
    await sql.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS protection_version INTEGER NOT NULL DEFAULT 1');
    await sql.query(`CREATE TABLE IF NOT EXISTS note_unlocks (
      note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      session_hash CHAR(64) NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
      protection_version INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY(note_id,session_hash)
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS note_shares (
      note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission VARCHAR(5) NOT NULL CHECK(permission IN ('read','write')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), seen_at TIMESTAMPTZ,
      PRIMARY KEY(note_id,recipient_id)
    )`);
    await sql.query('CREATE INDEX IF NOT EXISTS note_shares_recipient_idx ON note_shares(recipient_id)');
    await sql.query('UPDATE notes SET pinned_at = updated_at WHERE pinned AND pinned_at IS NULL');
    await sql.query('CREATE UNIQUE INDEX IF NOT EXISTS notes_id_owner_idx ON notes(id, owner_id)');
    await sql.query(`CREATE INDEX IF NOT EXISTS notes_owner_pinned_updated_idx
      ON notes(owner_id, pinned DESC, updated_at DESC, id DESC)`);
    await sql.query(`CREATE TABLE IF NOT EXISTS labels (
      id UUID PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(40) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
      color VARCHAR(7) NOT NULL DEFAULT '#8b6bb1'
        CHECK (color IN ('#8b6bb1', '#3c8270', '#b47c35', '#b75d78', '#527db5', '#737784')),
      UNIQUE(id, owner_id)
    )`);
    await sql.query('CREATE UNIQUE INDEX IF NOT EXISTS labels_owner_name_idx ON labels(owner_id, lower(name))');
    await sql.query(`CREATE TABLE IF NOT EXISTS note_labels (
      note_id UUID NOT NULL,
      label_id UUID NOT NULL,
      owner_id UUID NOT NULL,
      PRIMARY KEY(note_id, label_id),
      FOREIGN KEY(note_id, owner_id) REFERENCES notes(id, owner_id) ON DELETE CASCADE,
      FOREIGN KEY(label_id, owner_id) REFERENCES labels(id, owner_id) ON DELETE CASCADE
    )`);
    await sql.query('CREATE INDEX IF NOT EXISTS note_labels_owner_label_idx ON note_labels(owner_id, label_id, note_id)');
    await sql.query(`CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY, note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(180) NOT NULL, media_type VARCHAR(80) NOT NULL,
      size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 10485760), data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY(note_id,owner_id) REFERENCES notes(id,owner_id) ON DELETE CASCADE
    )`);
    await sql.query('CREATE INDEX IF NOT EXISTS attachments_note_idx ON attachments(note_id)');
    await sql.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await sql.query('DELETE FROM verification_tokens WHERE expires_at <= NOW()');
    await sql.query('DELETE FROM password_reset_tokens WHERE expires_at <= NOW()');
  });
}
