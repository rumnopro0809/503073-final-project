import type { Request } from 'express';
import type { Sql } from './database.js';
import { hashToken, SESSION_COOKIE } from './session.js';

export type NoteAccess = Record<string,unknown> & {id:string;owner_id:string;password_hash:string|null;protection_version:number;version:number};
export function sessionHash(req: Request) { return hashToken(String(req.cookies?.[SESSION_COOKIE] ?? '')); }
export async function accessibleNote(sql: Sql, id: unknown, actorId: string, mode: 'read'|'write'|'owner'='read', lock=false) {
  const {rows}=await sql.query<NoteAccess>(`SELECT id,owner_id,password_hash,protection_version,version FROM notes WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id]);
  const note=rows[0]; if(!note) return;
  if(note.owner_id===actorId) return note;
  if(mode==='owner') return;
  const shares=await sql.query<{permission:string}>('SELECT permission FROM note_shares WHERE note_id=$1 AND recipient_id=$2',[id,actorId]);
  if(shares.rows[0] && (mode==='read'||shares.rows[0].permission==='write')) return note;
}
export async function isUnlocked(sql:Sql, req:Request, note:NoteAccess) {
  if(!note.password_hash) return true;
  return (await sql.query('SELECT note_id FROM note_unlocks WHERE note_id=$1 AND session_hash=$2 AND protection_version=$3 AND expires_at>NOW()',[note.id,sessionHash(req),note.protection_version])).rows.length>0;
}
export async function unlockedIds(sql:Sql,req:Request) {
  const {rows}=await sql.query<{note_id:string}>(`SELECT u.note_id FROM note_unlocks u JOIN notes n ON n.id=u.note_id
    WHERE u.session_hash=$1 AND u.protection_version=n.protection_version AND u.expires_at>NOW()`,[sessionHash(req)]);
  return new Set(rows.map(row=>row.note_id));
}
export async function grantUnlock(sql:Sql,req:Request,note:NoteAccess) {
  await sql.query(`INSERT INTO note_unlocks(note_id,session_hash,protection_version,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '15 minutes')
    ON CONFLICT(note_id,session_hash) DO UPDATE SET protection_version=EXCLUDED.protection_version,expires_at=EXCLUDED.expires_at`,[note.id,sessionHash(req),note.protection_version]);
}
export const LOCKED = {code:'NOTE_LOCKED',message:'Ghi chú được bảo vệ. Nhập mật khẩu ghi chú để tiếp tục.'};
