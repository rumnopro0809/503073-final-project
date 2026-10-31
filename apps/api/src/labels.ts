import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Database } from './database.js';
import { findSessionUser } from './session.js';
import { unlockedIds } from './noteAccess.js';

const colors = ['#8b6bb1', '#3c8270', '#b47c35', '#b75d78', '#527db5', '#737784'];
const missing = { message: 'Không tìm thấy nhãn.' };
export function labelsRouter(db: Database) {
  const router = Router();
  router.use(async (req, res, next) => {
    const user = await findSessionUser(db, req);
    if (!user) { res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' }); return; }
    res.locals.ownerId = user.id; next();
  });
  router.param('id', (_req, res, next, id: string) => {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) { res.status(404).json(missing); return; }
    next();
  });
  router.get('/', async (_req, res) => {
    const { rows } = await db.query('SELECT id, name, color FROM labels WHERE owner_id = $1 ORDER BY lower(name), id', [res.locals.ownerId]);
    res.json({ labels: rows });
  });
  for (const editing of [false, true]) {
    router[editing ? 'patch' : 'post'](editing ? '/:id' : '/', async (req, res) => {
      const input = req.body as Record<string, unknown>;
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some(key => !['name', 'color'].includes(key))
        || (!editing && !('name' in input)) || (editing && !Object.keys(input).length)
        || ('name' in input && (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 40))
        || ('color' in input && (typeof input.color !== 'string' || !colors.includes(input.color)))) {
        res.status(422).json({ message: 'Tên nhãn cần từ 1 đến 40 ký tự và màu thuộc bảng màu có sẵn.' }); return;
      }
      try {
        const label = await db.transaction(async sql => {
          if (!editing) {
            return (await sql.query('INSERT INTO labels(id, owner_id, name, color) VALUES ($1,$2,$3,$4) RETURNING id, name, color',
              [randomUUID(), res.locals.ownerId, (input.name as string).trim(), input.color ?? colors[0]])).rows[0];
          }
          const unlocked=await unlockedIds(sql,req);
          const locked=await sql.query(`SELECT n.id FROM notes n JOIN note_labels l ON l.note_id=n.id
            WHERE l.label_id=$1 AND n.owner_id=$2 AND n.password_hash IS NOT NULL AND NOT(n.id=ANY($3::uuid[])) LIMIT 1`,[(req.params as { id: string }).id,res.locals.ownerId,[...unlocked]]);
          if(locked.rows.length) throw Object.assign(new Error('Mở khóa các ghi chú dùng nhãn này trước khi sửa nhãn.'),{status:423});
          const { rows } = await sql.query('UPDATE labels SET name = COALESCE($1,name), color = COALESCE($2,color) WHERE id=$3 AND owner_id=$4 RETURNING id,name,color',
            [typeof input.name === 'string' ? input.name.trim() : null, input.color ?? null, (req.params as { id: string }).id, res.locals.ownerId]);
          if (!rows.length) return undefined;
          await sql.query(`UPDATE notes SET version=version+1, updated_at=clock_timestamp() WHERE owner_id=$1
            AND id IN (SELECT note_id FROM note_labels WHERE label_id=$2 AND owner_id=$1)`, [res.locals.ownerId, (req.params as { id: string }).id]);
          return rows[0];
        });
        if (!label) { res.status(404).json(missing); return; }
        res.status(editing ? 200 : 201).json({ label });
      } catch (error) {
        if((error as {status?:number}).status===423){res.status(423).json({message:(error as Error).message});return;}
        if ((error as { code?: string }).code === '23505') { res.status(409).json({ message: 'Bạn đã có nhãn với tên này.' }); return; }
        throw error;
      }
    });
  }
  router.delete('/:id', async (req, res) => {
    const unlocked=await unlockedIds(db,req);
    const locked=await db.query(`SELECT n.id FROM notes n JOIN note_labels l ON l.note_id=n.id
      WHERE l.label_id=$1 AND n.owner_id=$2 AND n.password_hash IS NOT NULL AND NOT(n.id=ANY($3::uuid[])) LIMIT 1`,[(req.params as { id: string }).id,res.locals.ownerId,[...unlocked]]);
    if(locked.rows.length){res.status(423).json({message:'Mở khóa các ghi chú dùng nhãn này trước khi xóa nhãn.'});return;}
    const deleted = await db.transaction(async sql => {
      const own = await sql.query('SELECT id FROM labels WHERE id=$1 AND owner_id=$2 FOR UPDATE', [(req.params as { id: string }).id, res.locals.ownerId]);
      if (!own.rows.length) return false;
      await sql.query(`UPDATE notes SET version=version+1, updated_at=clock_timestamp() WHERE owner_id=$1
        AND id IN (SELECT note_id FROM note_labels WHERE label_id=$2 AND owner_id=$1)`, [res.locals.ownerId, (req.params as { id: string }).id]);
      await sql.query('DELETE FROM labels WHERE id=$1 AND owner_id=$2', [(req.params as { id: string }).id, res.locals.ownerId]);
      return true;
    });
    if (!deleted) { res.status(404).json(missing); return; }
    res.status(204).end();
  });
  return router;
}
