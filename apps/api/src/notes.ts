import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Database } from './database.js';
import { findSessionUser } from './session.js';

type NoteRow = Record<string, unknown> & {
  id: string;
  title: string;
  content: string;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const NOT_FOUND = { message: 'Không tìm thấy ghi chú.' };
const publicNote = (note: NoteRow) => ({
  id: note.id,
  title: note.title,
  content: note.content,
  version: note.version,
  createdAt: new Date(note.created_at).toISOString(),
  updatedAt: new Date(note.updated_at).toISOString(),
});

function validateBody(body: unknown, editing: boolean) {
  const fields: Record<string, string> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { fields: { body: 'Nội dung yêu cầu phải là một đối tượng JSON.' }, title: undefined, content: undefined, version: undefined };
  }
  const input = body as Record<string, unknown>;
  const allowed = editing ? ['title', 'content', 'version'] : ['title', 'content'];
  if (Object.keys(input).some(key => !allowed.includes(key))) fields.body = 'Yêu cầu chứa trường không được hỗ trợ.';
  const title = typeof input.title === 'string' ? input.title.trim() : undefined;
  const content = typeof input.content === 'string' ? input.content : undefined;
  if ((!editing || 'title' in input) && (!title || title.length > 200)) {
    fields.title = 'Tiêu đề cần có từ 1 đến 200 ký tự.';
  }
  if ((!editing || 'content' in input) && (!content?.trim() || content.length > 100000)) {
    fields.content = 'Nội dung cần có từ 1 đến 100.000 ký tự.';
  }
  if (editing && !('title' in input) && !('content' in input)) fields.body = 'Cần gửi tiêu đề hoặc nội dung muốn sửa.';
  const version = input.version;
  if (editing && (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 2147483646)) {
    fields.version = 'Cần gửi phiên bản hiện tại của ghi chú để lưu thay đổi.';
  }
  return { fields, title, content, version };
}

function paginationNumber(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= min && result <= max ? result : undefined;
}

export function notesRouter(db: Database) {
  const router = Router();
  router.use(async (req, res, next) => {
    const user = await findSessionUser(db, req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    // Ownership always comes from the session, never the request body or URL query.
    res.locals.ownerId = user.id;
    next();
  });

  router.get('/', async (req, res) => {
    const limit = paginationNumber(req.query.limit, 50, 1, 100);
    const offset = paginationNumber(req.query.offset, 0, 0, 1000000);
    if (limit === undefined || offset === undefined || Object.keys(req.query).some(key => !['limit', 'offset'].includes(key))) {
      res.status(422).json({ message: 'Phân trang không hợp lệ: limit từ 1 đến 100, offset từ 0 đến 1.000.000.' }); return;
    }
    // Fetch one extra row to determine whether the next page exists.
    const { rows } = await db.query<NoteRow>(
      `SELECT id, title, content, version, created_at, updated_at FROM notes
        WHERE owner_id = $1 ORDER BY updated_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [res.locals.ownerId, limit + 1, offset],
    );
    res.json({ notes: rows.slice(0, limit).map(publicNote), pagination: { limit, offset, hasMore: rows.length > limit } });
  });

  router.post('/', async (req, res) => {
    const creationKey = req.get('Idempotency-Key');
    if (creationKey !== undefined && !UUID.test(creationKey)) {
      res.status(422).json({ message: 'Mã yêu cầu tạo ghi chú không hợp lệ.' }); return;
    }
    const { fields, title, content } = validateBody(req.body, false);
    if (Object.keys(fields).length) { res.status(422).json({ message: 'Bạn kiểm tra lại thông tin ghi chú nhé.', fields }); return; }
    const { rows } = await db.query<NoteRow>(
      `INSERT INTO notes(id, owner_id, title, content, creation_key) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (owner_id, creation_key) WHERE creation_key IS NOT NULL
       DO UPDATE SET creation_key = EXCLUDED.creation_key
       RETURNING id, title, content, version, created_at, updated_at`,
      [randomUUID(), res.locals.ownerId, title, content, creationKey ?? null],
    );
    res.location(`/api/notes/${rows[0].id}`).status(201).json({ note: publicNote(rows[0]) });
  });

  router.param('id', (_req, res, next, id: string) => {
    if (!UUID.test(id)) { res.status(404).json(NOT_FOUND); return; }
    next();
  });

  router.get('/:id', async (req, res) => {
    const { rows } = await db.query<NoteRow>(
      `SELECT id, title, content, version, created_at, updated_at FROM notes WHERE id = $1 AND owner_id = $2`,
      [req.params.id, res.locals.ownerId],
    );
    if (!rows[0]) { res.status(404).json(NOT_FOUND); return; }
    res.json({ note: publicNote(rows[0]) });
  });

  router.patch('/:id', async (req, res) => {
    const { fields, title, content, version } = validateBody(req.body, true);
    if (Object.keys(fields).length) { res.status(422).json({ message: 'Bạn kiểm tra lại thay đổi của ghi chú nhé.', fields }); return; }
    // Atomic version check prevents an older save overwriting a newer edit.
    const { rows } = await db.query<NoteRow>(
      `UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content),
        updated_at = clock_timestamp(), version = version + 1
       WHERE id = $3 AND owner_id = $4 AND version = $5
       RETURNING id, title, content, version, created_at, updated_at`,
      [title ?? null, content ?? null, req.params.id, res.locals.ownerId, version],
    );
    if (rows[0]) { res.json({ note: publicNote(rows[0]) }); return; }
    const existing = await db.query('SELECT id FROM notes WHERE id = $1 AND owner_id = $2', [req.params.id, res.locals.ownerId]);
    if (!existing.rows.length) { res.status(404).json(NOT_FOUND); return; }
    res.status(409).json({ code: 'NOTE_VERSION_CONFLICT', message: 'Ghi chú đã có thay đổi mới. Hãy tải lại ghi chú trước khi lưu.' });
  });

  router.delete('/:id', async (req, res) => {
    const { rows } = await db.query('DELETE FROM notes WHERE id = $1 AND owner_id = $2 RETURNING id', [req.params.id, res.locals.ownerId]);
    if (!rows.length) { res.status(404).json(NOT_FOUND); return; }
    res.status(204).end();
  });

  return router;
}
