import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Database } from './database.js';
import { findSessionUser } from './session.js';
import { decodeUpload, imageType } from './uploads.js';
import { accessibleNote, isUnlocked, LOCKED } from './noteAccess.js';

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
type Attachment = Record<string,unknown> & { id:string; note_id:string; name:string; media_type:string; size:number; created_at:Date|string; data:Uint8Array };
const present = (file: Attachment) => ({id:file.id,name:file.name,mediaType:file.media_type,size:file.size,createdAt:new Date(file.created_at).toISOString(),url:`/api/attachments/${file.id}`});

export function attachmentsRouter(db: Database) {
  const router = Router();
  router.use(async (req,res,next) => {
    const user=await findSessionUser(db,req);
    if (!user) { res.status(401).json({message:'Vui lòng đăng nhập để tiếp tục.'}); return; }
    res.locals.ownerId=user.id; next();
  });
  router.get('/notes/:noteId',async (req,res) => {
    const id=req.params.noteId;
    const note=UUID.test(String(id)) ? await accessibleNote(db,id,res.locals.ownerId) : undefined;
    if (!note) { res.status(404).json({message:'Không tìm thấy ghi chú.'}); return; }
    if(!await isUnlocked(db,req,note)) {res.status(423).json(LOCKED);return;}
    const {rows}=await db.query<Attachment>('SELECT id,name,media_type,size,created_at FROM attachments WHERE note_id=$1 ORDER BY created_at,id',[id]);
    res.json({attachments:rows.map(present)});
  });
  router.post('/notes/:noteId',async (req,res) => {
    const id=req.params.noteId;
    if (!UUID.test(String(id))) { res.status(404).json({message:'Không tìm thấy ghi chú.'}); return; }
    const access=await accessibleNote(db,id,res.locals.ownerId,'write');
    if(!access) {res.status(404).json({message:'Không tìm thấy ghi chú.'});return;}
    const name=typeof req.body?.name==='string' ? req.body.name.trim():'';
    const data=decodeUpload(req.body?.data,10*1024*1024);
    if (!name || name.length>180 || /[\\/\x00-\x1f\x7f]/.test(name) || name==='.' || name==='..' || !data) { res.status(422).json({message:'Tên tệp không hợp lệ hoặc tệp trống/quá 10 MB.'}); return; }
    let type=imageType(data) ?? 'application/octet-stream';
    if (data.length>12 && data.toString('ascii',4,8)==='ftyp') type='video/mp4';
    if (data.length>4 && data.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))) type='video/webm';
    const result=await db.transaction(async sql => {
      await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[access.owner_id]);
      const note=await accessibleNote(sql,id,res.locals.ownerId,'write',true);
      if(!note) return {status:404,message:'Không tìm thấy ghi chú.'};
      if(!await isUnlocked(sql,req,note)) return {status:423,...LOCKED};
      const {rows}=await sql.query<{count:string;bytes:string}>(`SELECT COUNT(*) FILTER(WHERE note_id=$1)::text AS count,COALESCE(SUM(size),0)::text AS bytes FROM attachments WHERE owner_id=$2`,[id,note.owner_id]);
      if (Number(rows[0].count)>=20 || Number(rows[0].bytes)+data.length>100*1024*1024) return {status:422,message:'Tối đa 20 tệp mỗi ghi chú và 100 MB tệp cho mỗi tài khoản.'};
      const inserted=await sql.query<Attachment>('INSERT INTO attachments(id,note_id,owner_id,name,media_type,size,data) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,media_type,size,created_at',[randomUUID(),id,note.owner_id,name,type,data.length,data]);
      return {attachment:present(inserted.rows[0])};
    });
    if ('status' in result) { res.status(result.status!).json({message:result.message}); return; }
    res.status(201).json(result);
  });
  router.get('/:id',async (req,res) => {
    if (!UUID.test(String(req.params.id))) { res.sendStatus(404); return; }
    const {rows}=await db.query<Attachment>('SELECT * FROM attachments WHERE id=$1',[req.params.id]);
    const file=rows[0];
    const note=file&&await accessibleNote(db,file.note_id,res.locals.ownerId);
    if (!file||!note) { res.status(404).json({message:'Không tìm thấy tệp.'}); return; }
    if(!await isUnlocked(db,req,note)) {res.status(423).json(LOCKED);return;}
    const inline=req.query.download!=='1' && /^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(file.media_type);
    res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="file"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`);
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    res.type(file.media_type).send(Buffer.from(file.data));
  });
  router.delete('/:id',async (req,res) => {
    if (!UUID.test(String(req.params.id))) { res.sendStatus(404); return; }
    const {rows}=await db.query<Attachment>('SELECT note_id FROM attachments WHERE id=$1',[req.params.id]);
    const status=await db.transaction(async sql=>{
      const note=rows[0]&&await accessibleNote(sql,rows[0].note_id,res.locals.ownerId,'write',true);
      if(!note) return 404;
      if(!await isUnlocked(sql,req,note)) return 423;
      const removed=await sql.query('DELETE FROM attachments WHERE id=$1 RETURNING id',[req.params.id]);
      return removed.rows.length?204:404;
    });
    res.status(status).json(status===423?LOCKED:status===404?{message:'Không tìm thấy tệp.'}:undefined);
  });
  return router;
}
