import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Database, Sql } from './database.js';
import { findSessionUser } from './session.js';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { accessibleNote, isUnlocked, unlockedIds, grantUnlock, LOCKED } from './noteAccess.js';

type NoteRow = Record<string, unknown> & {
  id: string;
  title: string;
  content: string;
  version: number;
  pinned: boolean;
  due_at: Date | string | null;
  completed_at: Date | string | null;
  important: boolean;
  daily: boolean;
  completed: boolean;
  pinned_at: Date | string | null;
  labels: { id: string; name: string; color: string }[];
  created_at: Date | string;
  updated_at: Date | string;
  password_hash: string | null;
  permission: 'owner'|'read'|'write';
  owner_name: string;
  shared_at: Date | string | null;
};

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const NOT_FOUND = { message: 'Không tìm thấy ghi chú.' };
const publicNote = (note: NoteRow, unlocked=true) => ({
  id: note.id,
  title: !unlocked && note.password_hash ? 'Ghi chú được bảo vệ' : note.title,
  content: !unlocked && note.password_hash ? '' : note.content,
  ...(note.password_hash ? {protected:true,locked:!unlocked} : {}),
  ...(note.permission && note.permission!=='owner' ? {share:{permission:note.permission,ownerName:note.owner_name,sharedAt:note.shared_at}} : {}),
  version: note.version,
  pinned: note.pinned,
  dueAt: note.due_at ? new Date(note.due_at).toISOString() : null,
  completedAt: note.completed_at ? new Date(note.completed_at).toISOString() : null,
  important: note.important, daily: note.daily, completed: note.completed,
  pinnedAt: note.pinned_at ? new Date(note.pinned_at).toISOString() : null,
  labels: note.labels,
  createdAt: new Date(note.created_at).toISOString(),
  updatedAt: new Date(note.updated_at).toISOString(),
});

// Fetch metadata with the same statement/snapshot as the note's content and version.
const DONE = `(n.completed_at IS NOT NULL AND (NOT n.daily OR (n.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))`;
const noteSelect = (actorParam:string) => `SELECT n.id, n.title, n.content, n.version, n.pinned, n.pinned_at, n.created_at, n.updated_at,n.password_hash,
  CASE WHEN n.owner_id=${actorParam} THEN 'owner' ELSE (SELECT s.permission FROM note_shares s WHERE s.note_id=n.id AND s.recipient_id=${actorParam}) END AS permission,
  (SELECT u.display_name FROM users u WHERE u.id=n.owner_id) AS owner_name,
  (SELECT s.created_at FROM note_shares s WHERE s.note_id=n.id AND s.recipient_id=${actorParam}) AS shared_at,
  n.due_at, n.completed_at, n.important, n.daily, ${DONE} AS completed,
  COALESCE((SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color)
    ORDER BY lower(l.name), l.id) FROM note_labels nl JOIN labels l
    ON l.id = nl.label_id AND l.owner_id = nl.owner_id
    WHERE nl.note_id = n.id AND nl.owner_id = n.owner_id), '[]'::json) AS labels FROM notes n`;
async function readNote(sql: Sql, id: unknown, ownerId: string) {
  return (await sql.query<NoteRow>(`${noteSelect('$2')} WHERE n.id = $1 AND (n.owner_id = $2 OR EXISTS(SELECT 1 FROM note_shares s WHERE s.note_id=n.id AND s.recipient_id=$2))`, [id, ownerId])).rows[0];
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
    const { q, pinned, labelId, sort = 'updated', shared } = req.query;
    if (limit === undefined || offset === undefined
      || Object.keys(req.query).some(key => !['limit', 'offset', 'q', 'pinned', 'labelId', 'sort', 'shared'].includes(key))
      || (shared!==undefined && shared!=='true')
      || (q !== undefined && (typeof q !== 'string' || q.length > 200))
      || (pinned !== undefined && pinned !== 'true')
      || (labelId !== undefined && (typeof labelId !== 'string' || !UUID.test(labelId)))
      || (typeof sort !== 'string' || !['updated', 'created', 'title'].includes(sort))) {
      res.status(422).json({ message: 'Bộ lọc không hợp lệ. Từ khóa tối đa 200 ký tự; limit từ 1 đến 100, offset từ 0 đến 1.000.000.' }); return;
    }
    const params: unknown[] = [res.locals.ownerId];
    const where = [shared==='true' ? 'EXISTS(SELECT 1 FROM note_shares s WHERE s.note_id=n.id AND s.recipient_id=$1)' : 'n.owner_id = $1'];
    const unlocked=await unlockedIds(db,req);
    if (typeof q === 'string' && q.trim()) {
      // strpos treats %, _ and backslashes literally, unlike SQL LIKE wildcards.
      params.push(q.trim());
      where.push(`(n.password_hash IS NULL OR n.id=ANY($${params.length+1}::uuid[])) AND (strpos(lower(n.title), lower($${params.length}::text)) > 0 OR strpos(lower(n.content), lower($${params.length}::text)) > 0)`);
      params.push([...unlocked]);
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
      `${noteSelect('$1')} WHERE ${where.join(' AND ')} ORDER BY n.pinned DESC, n.pinned_at DESC NULLS LAST, ${order}, n.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ notes: rows.slice(0, limit).map(note=>publicNote(note,unlocked.has(note.id))), pagination: { limit, offset, hasMore: rows.length > limit } });
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

  router.get('/shared-notifications',async (_req,res)=>{
    const {rows}=await db.query<{count:string}>('SELECT COUNT(*)::text AS count FROM note_shares WHERE recipient_id=$1 AND seen_at IS NULL',[res.locals.ownerId]);
    res.json({count:Number(rows[0].count)});
  });
  router.post('/shared-notifications/read',async (_req,res)=>{
    await db.query('UPDATE note_shares SET seen_at=NOW() WHERE recipient_id=$1 AND seen_at IS NULL',[res.locals.ownerId]); res.sendStatus(204);
  });
  router.post('/:id/unlock',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{
    const note=await accessibleNote(db,req.params.id,res.locals.ownerId);
    if(!note) {res.status(404).json(NOT_FOUND);return;}
    const password=req.body?.password;
    if(typeof password!=='string'||Buffer.byteLength(password)>72) {res.status(422).json({message:'Nhập mật khẩu ghi chú hợp lệ.'});return;}
    const result=await db.transaction(async sql=>{
      const current=await accessibleNote(sql,req.params.id,res.locals.ownerId,'read',true);
      if(!current) return {status:404,body:NOT_FOUND};
      if(current.password_hash&&!await bcrypt.compare(password,current.password_hash)) return {status:422,body:{message:'Mật khẩu ghi chú chưa đúng.'}};
      if(current.password_hash) await grantUnlock(sql,req,current);
      return {status:200,body:{note:publicNote((await readNote(sql,current.id,res.locals.ownerId))!)}};
    });
    res.status(result.status).json(result.body);
  });
  router.post('/:id/lock',async(req,res)=>{
    if(!await accessibleNote(db,req.params.id,res.locals.ownerId)) {res.status(404).json(NOT_FOUND);return;}
    const {sessionHash}=await import('./noteAccess.js');
    await db.query('DELETE FROM note_unlocks WHERE note_id=$1 AND session_hash=$2',[req.params.id,sessionHash(req)]);res.sendStatus(204);
  });
  router.post('/:id/protection',async(req,res)=>{
    if(!await accessibleNote(db,req.params.id,res.locals.ownerId,'owner')) {res.status(404).json(NOT_FOUND);return;}
    const {password,confirmPassword,currentPassword,version}=req.body??{};
    if(!validVersion(version)||(password!==null&&(typeof password!=='string'||password.length<8||Buffer.byteLength(password)>72||password!==confirmPassword))) {
      res.status(422).json({message:'Nhập phiên bản hiện tại và mật khẩu mới ít nhất 8 ký tự, tối đa 72 byte, nhập lại khớp nhau.'});return;
    }
    const hash=password===null?null:await bcrypt.hash(password,12);
    const result=await db.transaction(async sql=>{
      const note=await accessibleNote(sql,req.params.id,res.locals.ownerId,'owner',true);
      if(!note) return {status:404,body:NOT_FOUND};
      if(note.version!==version) return {status:409,body:CONFLICT};
      if(note.password_hash&&(typeof currentPassword!=='string'||Buffer.byteLength(currentPassword)>72||!await bcrypt.compare(currentPassword,note.password_hash))) return {status:422,body:{message:'Mật khẩu hiện tại của ghi chú chưa đúng.'}};
      await sql.query('UPDATE notes SET password_hash=$1,protection_version=protection_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=$2',[hash,note.id]);
      await sql.query('DELETE FROM note_unlocks WHERE note_id=$1',[note.id]);
      const changed=(await accessibleNote(sql,note.id,res.locals.ownerId,'owner'))!;
      if(hash) await grantUnlock(sql,req,changed);
      return {status:200,body:{note:publicNote((await readNote(sql,note.id,res.locals.ownerId))!)}};
    });
    res.status(result.status).json(result.body);
  });

  // Every operation below, including deletion and sharing, requires unlocking protected notes.
  router.use('/:id',async(req,res,next)=>{
    const note=await accessibleNote(db,req.params.id,res.locals.ownerId);
    if(!note) {res.status(404).json(NOT_FOUND);return;}
    if(!await isUnlocked(db,req,note)) {res.status(423).json(LOCKED);return;}
    next();
  });
  router.get('/:id/shares',async(req,res)=>{
    if(!await accessibleNote(db,req.params.id,res.locals.ownerId,'owner')) {res.status(404).json(NOT_FOUND);return;}
    const {rows}=await db.query(`SELECT s.recipient_id AS "recipientId",u.email,u.display_name AS "displayName",s.permission,s.created_at AS "sharedAt"
      FROM note_shares s JOIN users u ON u.id=s.recipient_id WHERE s.note_id=$1 ORDER BY u.email`,[req.params.id]);res.json({shares:rows});
  });
  router.post('/:id/shares',async(req,res)=>{
    const {emails,permission}=req.body??{};
    if(!Array.isArray(emails)||!emails.length||emails.length>10||emails.some(email=>typeof email!=='string'||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))||!['read','write'].includes(permission)) {
      res.status(422).json({message:'Nhập từ 1 đến 10 email đã đăng ký và quyền xem hoặc sửa.'});return;
    }
    const normalized=[...new Set((emails as string[]).map(email=>email.trim().toLowerCase()))];
    const result=await db.transaction(async sql=>{
      const note=await accessibleNote(sql,req.params.id,res.locals.ownerId,'owner',true);
      if(!note) return {status:404,body:NOT_FOUND};
      if(!await isUnlocked(sql,req,note)) return {status:423,body:LOCKED};
      const {rows}=await sql.query<{id:string;email:string}>('SELECT id,email FROM users WHERE email=ANY($1::text[])',[normalized]);
      if(rows.length!==normalized.length||rows.some(user=>user.id===res.locals.ownerId)) return {status:422,body:{message:'Một email chưa đăng ký hoặc là tài khoản của bạn. Không có thay đổi nào được lưu.'}};
      for(const user of rows) await sql.query(`INSERT INTO note_shares(note_id,recipient_id,permission) VALUES($1,$2,$3)
        ON CONFLICT(note_id,recipient_id) DO UPDATE SET permission=EXCLUDED.permission,seen_at=NULL`,[note.id,user.id,permission]);
      return {status:200,body:{message:'Đã cập nhật chia sẻ. Người nhận sẽ thấy thông báo trong tài khoản.'}};
    });res.status(result.status).json(result.body);
  });
  router.delete('/:id/shares/:recipientId',async(req,res)=>{
    if(!UUID.test(String(req.params.recipientId))) {res.status(404).json(NOT_FOUND);return;}
    const result=await db.transaction(async sql=>{
      const note=await accessibleNote(sql,req.params.id,res.locals.ownerId,'owner',true);
      if(!note) return 404;
      if(!await isUnlocked(sql,req,note)) return 423;
      await sql.query('DELETE FROM note_shares WHERE note_id=$1 AND recipient_id=$2',[note.id,req.params.recipientId]);
      await sql.query('DELETE FROM note_unlocks WHERE note_id=$1 AND session_hash IN (SELECT token_hash FROM sessions WHERE user_id=$2)',[note.id,req.params.recipientId]);
      return 204;
    });res.status(result).json(result===423?LOCKED:result===404?NOT_FOUND:undefined);
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
      const access=await accessibleNote(sql,req.params.id,res.locals.ownerId,'owner',true);
      if(!access) return {status:404,body:NOT_FOUND};
      if(!await isUnlocked(sql,req,access)) return {status:423,body:LOCKED};
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
      const access=await accessibleNote(sql,req.params.id,res.locals.ownerId,'write',true);
      if(!access) return {status:404,body:NOT_FOUND};
      if(!await isUnlocked(sql,req,access)) return {status:423,body:LOCKED};
      const { rows } = await sql.query(
        `UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content),
          updated_at = clock_timestamp(), version = version + 1
         WHERE id = $3 AND version = $5 AND (owner_id=$4 OR EXISTS(SELECT 1 FROM note_shares s WHERE s.note_id=notes.id AND s.recipient_id=$4 AND s.permission='write')) RETURNING id`,
        [title ?? null, content ?? null, req.params.id, res.locals.ownerId, version],
      );
      if (rows.length) return { status: 200, body: { note: publicNote((await readNote(sql, req.params.id, res.locals.ownerId))!) } };
      return {status:409,body:CONFLICT};
    });
    res.status(result.status).json(result.body);
  });

  router.delete('/:id', async (req, res) => {
    const status=await db.transaction(async sql=>{
      const note=await accessibleNote(sql,req.params.id,res.locals.ownerId,'owner',true);
      if(!note) return 404;
      if(!await isUnlocked(sql,req,note)) return 423;
      await sql.query('DELETE FROM notes WHERE id=$1',[note.id]);return 204;
    });res.status(status).json(status===423?LOCKED:status===404?NOT_FOUND:undefined);
  });

  return router;
}
