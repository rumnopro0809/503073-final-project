import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Database, Sql } from './database.js';
import { findSessionUser } from './session.js';

type NoteRow = Record<string, unknown> & {
  id: string;
  title: string;
  content: string;
  version: number;
  pinned: boolean;
  pinned_at: Date | string | null;
  labels: { id: string; name: string; color: string }[];
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
  pinned: note.pinned,
  pinnedAt: note.pinned_at ? new Date(note.pinned_at).toISOString() : null,
  labels: note.labels,
  createdAt: new Date(note.created_at).toISOString(),
  updatedAt: new Date(note.updated_at).toISOString(),
});

// Fetch metadata with the same statement/snapshot as the note's content and version.
const NOTE_SELECT = `SELECT n.id, n.title, n.content, n.version, n.pinned, n.pinned_at, n.created_at, n.updated_at,
  COALESCE((SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color)
    ORDER BY lower(l.name), l.id) FROM note_labels nl JOIN labels l
    ON l.id = nl.label_id AND l.owner_id = nl.owner_id
    WHERE nl.note_id = n.id AND nl.owner_id = n.owner_id), '[]'::json) AS labels FROM notes n`;
async function readNote(sql: Sql, id: unknown, ownerId: string) {
  return (await sql.query<NoteRow>(`${NOTE_SELECT} WHERE n.id = $1 AND n.owner_id = $2`, [id, ownerId])).rows[0];
}
const CONFLICT = { code: 'NOTE_VERSION_CONFLICT', message: 'Ghi chú đã có thay đổi mới. Hãy tải lại ghi chú trước khi lưu.' };
const validVersion = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2147483646;

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
  if (editing && !validVersion(version)) {
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
    const { q, pinned, labelId, sort = 'updated' } = req.query;
    if (limit === undefined || offset === undefined
      || Object.keys(req.query).some(key => !['limit', 'offset', 'q', 'pinned', 'labelId', 'sort'].includes(key))
      || (q !== undefined && (typeof q !== 'string' || q.length > 200))
      || (pinned !== undefined && pinned !== 'true')
      || (labelId !== undefined && (typeof labelId !== 'string' || !UUID.test(labelId)))
      || (typeof sort !== 'string' || !['updated', 'created', 'title'].includes(sort))) {
      res.status(422).json({ message: 'Bộ lọc không hợp lệ. Từ khóa tối đa 200 ký tự; limit từ 1 đến 100, offset từ 0 đến 1.000.000.' }); return;
    }
    const params: unknown[] = [res.locals.ownerId];
    const where = ['n.owner_id = $1'];
    if (typeof q === 'string' && q.trim()) {
      // strpos treats %, _ and backslashes literally, unlike SQL LIKE wildcards.
      params.push(q.trim());
      where.push(`(strpos(lower(n.title), lower($${params.length}::text)) > 0 OR strpos(lower(n.content), lower($${params.length}::text)) > 0)`);
    }
    if (pinned === 'true') where.push('n.pinned = TRUE');
    if (labelId !== undefined) {
      params.push(labelId);
      where.push(`EXISTS (SELECT 1 FROM note_labels f WHERE f.note_id = n.id AND f.owner_id = n.owner_id AND f.label_id = $${params.length})`);
    }
    const order = sort === 'created' ? 'n.created_at DESC' : sort === 'title' ? 'lower(n.title) ASC' : 'n.updated_at DESC';
    params.push(limit + 1, offset);
    // Fetch one extra row to determine whether the next page exists.
    const { rows } = await db.query<NoteRow>(
      `${NOTE_SELECT} WHERE ${where.join(' AND ')} ORDER BY n.pinned DESC, n.pinned_at DESC NULLS LAST, ${order}, n.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
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
    const note = await db.transaction(async sql => {
      const { rows } = await sql.query<{ id: string }>(
        `INSERT INTO notes(id, owner_id, title, content, creation_key) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (owner_id, creation_key) WHERE creation_key IS NOT NULL
         DO UPDATE SET creation_key = EXCLUDED.creation_key RETURNING id`,
        [randomUUID(), res.locals.ownerId, title, content, creationKey ?? null],
      );
      return (await readNote(sql, rows[0].id, res.locals.ownerId))!;
    });
    res.location(`/api/notes/${note.id}`).status(201).json({ note: publicNote(note) });
  });

  router.param('id', (_req, res, next, id: string) => {
    if (!UUID.test(id)) { res.status(404).json(NOT_FOUND); return; }
    next();
  });

  router.get('/:id', async (req, res) => {
    const note = await readNote(db, req.params.id, res.locals.ownerId);
    if (!note) { res.status(404).json(NOT_FOUND); return; }
    res.json({ note: publicNote(note) });
  });

  router.patch('/:id/organization', async (req, res) => {
    const input: Record<string, unknown> = req.body;
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['version', 'pinned', 'labelIds'].includes(key))
      || !validVersion(input.version) || (!('pinned' in input) && !('labelIds' in input))
      || ('pinned' in input && typeof input.pinned !== 'boolean')
      || ('labelIds' in input && (!Array.isArray(input.labelIds) || input.labelIds.length > 20
        || input.labelIds.some(id => typeof id !== 'string' || !UUID.test(id))
        || new Set((input.labelIds as string[]).map(id => id.toLowerCase())).size !== input.labelIds.length))) {
      res.status(422).json({ message: 'Gửi phiên bản hiện tại, trạng thái ghim và/hoặc tối đa 20 nhãn hợp lệ.' }); return;
    }
    const result = await db.transaction(async sql => {
      const own = await sql.query('SELECT id FROM notes WHERE id = $1 AND owner_id = $2', [req.params.id, res.locals.ownerId]);
      if (!own.rows.length) return { status: 404, body: NOT_FOUND };
      // Lock labels before notes, matching the label mutation order. This prevents a label
      // being deleted or renamed between ownership validation and association insertion.
      const labelIds = input.labelIds as string[] | undefined;
      if (labelIds?.length) {
        const labels = await sql.query('SELECT id FROM labels WHERE owner_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR SHARE', [res.locals.ownerId, labelIds]);
        if (labels.rows.length !== labelIds.length) return { status: 422, body: { message: 'Có nhãn không tồn tại hoặc không thuộc tài khoản của bạn.' } };
      }
      const { rows } = await sql.query(
        `UPDATE notes SET pinned = COALESCE($1, pinned),
         pinned_at = CASE WHEN $1::boolean = FALSE THEN NULL WHEN $1::boolean = TRUE AND NOT pinned THEN clock_timestamp() ELSE pinned_at END,
         version = version + 1, updated_at = clock_timestamp()
         WHERE id = $2 AND owner_id = $3 AND version = $4 RETURNING id`,
        [input.pinned ?? null, req.params.id, res.locals.ownerId, input.version],
      );
      if (!rows.length) {
        const existing = await sql.query('SELECT id FROM notes WHERE id = $1 AND owner_id = $2', [req.params.id, res.locals.ownerId]);
        return existing.rows.length ? { status: 409, body: CONFLICT } : { status: 404, body: NOT_FOUND };
      }
      if (labelIds !== undefined) {
        await sql.query('DELETE FROM note_labels WHERE note_id = $1 AND owner_id = $2', [req.params.id, res.locals.ownerId]);
        if (labelIds.length) await sql.query(
          'INSERT INTO note_labels(note_id, label_id, owner_id) SELECT $1::uuid, unnest($2::uuid[]), $3::uuid',
          [req.params.id, labelIds, res.locals.ownerId],
        );
      }
      return { status: 200, body: { note: publicNote((await readNote(sql, req.params.id, res.locals.ownerId))!) } };
    });
    res.status(result.status).json(result.body);
  });

  router.patch('/:id', async (req, res) => {
    const { fields, title, content, version } = validateBody(req.body, true);
    if (Object.keys(fields).length) { res.status(422).json({ message: 'Bạn kiểm tra lại thay đổi của ghi chú nhé.', fields }); return; }
    // Atomic version check prevents an older save overwriting a newer edit.
    const result = await db.transaction(async sql => {
      const { rows } = await sql.query(
        `UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content),
          updated_at = clock_timestamp(), version = version + 1
         WHERE id = $3 AND owner_id = $4 AND version = $5 RETURNING id`,
        [title ?? null, content ?? null, req.params.id, res.locals.ownerId, version],
      );
      if (rows.length) return { status: 200, body: { note: publicNote((await readNote(sql, req.params.id, res.locals.ownerId))!) } };
      const existing = await sql.query('SELECT id FROM notes WHERE id = $1 AND owner_id = $2', [req.params.id, res.locals.ownerId]);
      return existing.rows.length ? { status: 409, body: CONFLICT } : { status: 404, body: NOT_FOUND };
    });
    res.status(result.status).json(result.body);
  });

  router.delete('/:id', async (req, res) => {
    const { rows } = await db.query('DELETE FROM notes WHERE id = $1 AND owner_id = $2 RETURNING id', [req.params.id, res.locals.ownerId]);
    if (!rows.length) { res.status(404).json(NOT_FOUND); return; }
    res.status(204).end();
  });

  return router;
}
