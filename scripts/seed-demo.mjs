// Tạo tài khoản và dữ liệu mẫu cho buổi chấm/demo.
// Cách dùng: chạy `npm run dev` ở terminal 1, sau đó `npm run seed:demo` ở terminal 2.
// Script gọi API local nên không mở database trực tiếp và có thể chạy lại nhiều lần.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const base = process.env.SEED_API_URL || 'http://127.0.0.1:3001/api';
const local=['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname);
if(!local&&(process.env.SEED_ALLOW_REMOTE!=='true'||!process.env.SEED_A_EMAIL||!process.env.SEED_B_EMAIL||!process.env.SEED_A_PASSWORD||!process.env.SEED_B_PASSWORD))throw new Error('Remote seed requires SEED_ALLOW_REMOTE=true and dedicated SEED_A/B_EMAIL/PASSWORD. Never seed personal accounts online.');
const headers = { 'content-type': 'application/json', 'x-requested-with': 'GhiChu' };

const accountA = { displayName: local?'Nguyễn Hải Triều':'Tài khoản chấm A', email:process.env.SEED_A_EMAIL||'rumnopro0809@gmail.com', password:process.env.SEED_A_PASSWORD||'Rum@1234' };
const accountB = { displayName: local?'Dương Phạm Thái':'Tài khoản chấm B', email:process.env.SEED_B_EMAIL||'duongphamthai82@gmail.com', password:process.env.SEED_B_PASSWORD||'Thai@1234' };
const notePassword = 'Note@1234';

function cookieFrom(response) {
  return (response.headers.getSetCookie?.() ?? []).map(cookie => cookie.split(';')[0]).join('; ');
}

async function request(cookie, url, options = {}) {
  const response = await fetch(base + url, {
    method: options.method ?? 'GET',
    headers: { ...headers, ...(cookie ? { cookie } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
    signal:AbortSignal.timeout(45000),
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  return { status: response.status, json, cookie: cookieFrom(response) };
}

async function signIn(account) {
  const login = await request(undefined, '/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
  if (login.status === 200) return { cookie: login.cookie, created: false };
  const register = await request(undefined, '/auth/register', { method: 'POST', body: { ...account, confirmPassword: account.password } });
  if (register.status === 201) return { cookie: register.cookie, created: true };
  throw new Error(`Không đăng nhập hoặc đăng ký được ${account.email}: ${register.status} ${JSON.stringify(register.json)}`);
}

function latestVerificationLink(email) {
  const mailDir = path.join(root, '.data/mail');
  if (!fs.existsSync(mailDir)) return undefined;
  const files = fs.readdirSync(mailDir).filter(file => file.endsWith('.txt'))
    .map(file => ({ file, time: fs.statSync(path.join(mailDir, file)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  for (const { file } of files) {
    const text = fs.readFileSync(path.join(mailDir, file), 'utf8');
    if (!text.includes(`To: ${email}`)) continue;
    const link = text.match(/https?:\/\/[^\s]+verify\?token=[a-f0-9]{64}/);
    if (link) return link[0];
  }
  return undefined;
}

async function verifyEmail(cookie, email) {
  if(!local){console.log('- Tài khoản chấm online chưa xác minh email; chức năng vẫn dùng đầy đủ.');return;}
  await request(cookie, '/auth/resend-verification', { method: 'POST', body: {} });
  const link = latestVerificationLink(email);
  if (!link) {
    console.log(`- Không tìm thấy thư xác minh cho ${email} (có thể đang dùng SMTP); bỏ qua bước xác minh.`);
    return;
  }
  const response = await fetch(link, { redirect: 'manual' });
  console.log(`- Xác minh ${email}: ${response.status === 302 ? 'thành công' : `HTTP ${response.status}`}`);
}

async function ensureNote(cookie, notes, title, content) {
  const existing = notes.find(note => note.title === title);
  if (existing) return existing;
  const response = await request(cookie, '/notes', { method: 'POST', body: { title, content } });
  if (response.status !== 201) throw new Error(`Không tạo được ghi chú "${title}": ${response.status} ${JSON.stringify(response.json)}`);
  notes.push(response.json.note);
  return response.json.note;
}

async function ensureLabel(cookie, labels, name, color) {
  const existing = labels.find(label => label.name === name);
  if (existing) return existing;
  const response = await request(cookie, '/labels', { method: 'POST', body: { name, color } });
  if (response.status !== 201) throw new Error(`Không tạo được nhãn "${name}": ${response.status} ${JSON.stringify(response.json)}`);
  labels.push(response.json.label);
  return response.json.label;
}

async function patchNote(cookie, note, action, body) {
  const response = await request(cookie, `/notes/${note.id}/${action}`, { method: 'PATCH', body: { version: note.version, ...body } });
  if (response.status !== 200) {
    console.log(`- Bỏ qua cập nhật ${action} cho "${note.title}": HTTP ${response.status}`);
    return note;
  }
  Object.assign(note, response.json.note);
  return note;
}

function tinyPng() {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAJb8C9WcT5ioAAAAASUVORK5CYII=';
}

async function main() {
  console.log(`Đang tạo dữ liệu mẫu qua ${base}`);
  const sessionA = await signIn(accountA);
  console.log(`- Tài khoản A: ${sessionA.created ? 'đã tạo mới' : 'đã tồn tại'}`);
  await verifyEmail(sessionA.cookie, accountA.email);

  const sessionB = await signIn(accountB);
  console.log(`- Tài khoản B: ${sessionB.created ? 'đã tạo mới' : 'đã tồn tại'}`);
  await verifyEmail(sessionB.cookie, accountB.email);

  await request(sessionA.cookie, '/auth/preferences', {
    method: 'PATCH', body: { fontSize: 16, density: 'comfortable', theme: 'light', noteColor: '#fffdf7' },
  });

  const labelResponse = await request(sessionA.cookie, '/labels');
  const labels = labelResponse.json.labels;
  const study = await ensureLabel(sessionA.cookie, labels, 'Học tập', '#8b6bb1');
  const work = await ensureLabel(sessionA.cookie, labels, 'Công việc', '#3c8270');
  const personal = await ensureLabel(sessionA.cookie, labels, 'Cá nhân', '#527db5');

  const noteResponse = await request(sessionA.cookie, '/notes?limit=100');
  const notes = noteResponse.json.notes;
  const n1 = await ensureNote(sessionA.cookie, notes, 'Kế hoạch tuần này', 'Mục tiêu tuần:\n- Hoàn thiện báo cáo môn Web Programming\n- Ôn tập React và Express\n- Chuẩn bị demo project trước ngày 2/11');
  const n2 = await ensureNote(sessionA.cookie, notes, 'Bài tập Web Programming', 'Nộp bài Final Project trước 23:59 ngày 02/11/2026.\nKiểm tra lại Readme.txt, Rubric.xlsx, video demo và source trên GitHub.');
  const n3 = await ensureNote(sessionA.cookie, notes, 'Danh sách mua sắm', 'Sữa, trứng, gạo, rau xanh, trái cây.');
  const n4 = await ensureNote(sessionA.cookie, notes, 'Ghi chú họp nhóm', 'Đã thống nhất chia việc: Triều phụ trách backend và kiểm thử, Thái phụ trách giao diện và video demo.');
  // Ghi chú đã bảo vệ bị che tiêu đề khi chưa mở khóa, nên nhận diện bằng tiêu đề đã che.
  const n5 = notes.find(note => note.title === 'Ghi chú bảo mật') ?? notes.find(note => note.title === 'Ghi chú được bảo vệ')
    ?? await ensureNote(sessionA.cookie, notes, 'Ghi chú bảo mật', `Nội dung này được bảo vệ bằng mật khẩu riêng của ghi chú.\nMật khẩu demo: ${notePassword}`);
  const n6 = await ensureNote(sessionA.cookie, notes, 'Tài liệu tham khảo', 'Danh sách tài liệu:\n- Express: https://expressjs.com/\n- PostgreSQL: https://www.postgresql.org/docs/\n- Vite: https://vite.dev/guide/');

  await patchNote(sessionA.cookie, n1, 'organization', { pinned: true, labelIds: [study.id, work.id] });
  await patchNote(sessionA.cookie, n2, 'organization', { labelIds: [study.id] });
  await patchNote(sessionA.cookie, n3, 'organization', { labelIds: [personal.id] });
  await patchNote(sessionA.cookie, n6, 'organization', { labelIds: [study.id] });
  if (!n5.protected) await patchNote(sessionA.cookie, n5, 'organization', { labelIds: [work.id] });

  const current = await request(sessionA.cookie, `/notes/${n5.id}`);
  if (current.status === 200 && !current.json.note?.protected) {
    const protect = await request(sessionA.cookie, `/notes/${n5.id}/protection`, {
      method: 'POST', body: { version: current.json.note.version, password: notePassword, confirmPassword: notePassword },
    });
    console.log(`- Bảo vệ ghi chú "Ghi chú bảo mật": ${protect.status === 200 ? 'thành công' : `HTTP ${protect.status}`}`);
  }

  const attachments = await request(sessionA.cookie, `/attachments/notes/${n1.id}`);
  if (!attachments.json.attachments?.length) {
    await request(sessionA.cookie, `/attachments/notes/${n1.id}`, { method: 'POST', body: { name: 'ke-hoach.png', data: tinyPng() } });
    await request(sessionA.cookie, `/attachments/notes/${n1.id}`, {
      method: 'POST', body: { name: 'ghi-chu-demo.txt', data: Buffer.from('Ghi chú đính kèm mẫu cho buổi demo.\n', 'utf8').toString('base64') },
    });
    console.log('- Đã thêm 2 tệp đính kèm mẫu');
  }

  await request(sessionA.cookie, `/notes/${n2.id}/shares`, { method: 'POST', body: { emails: [accountB.email], permission: 'read' } });
  await request(sessionA.cookie, `/notes/${n6.id}/shares`, { method: 'POST', body: { emails: [accountB.email], permission: 'write' } });
  console.log('- Đã chia sẻ 1 ghi chú chỉ đọc và 1 ghi chú được sửa cho tài khoản B');

  const bNotes = await request(sessionB.cookie, '/notes?limit=100');
  if (!bNotes.json.notes.some(note => note.title === 'Ghi chú của Thái')) {
    await request(sessionB.cookie, '/notes', {
      method: 'POST', body: { title: 'Ghi chú của Thái', content: 'Tài khoản này dùng để thử nhận ghi chú được chia sẻ từ tài khoản của Triều.' },
    });
  }

  console.log('\nHoàn tất. Tài khoản chấm bài:');
  console.log(`  A: ${accountA.email} / ${accountA.password}`);
  console.log(`  B: ${accountB.email} / ${accountB.password}`);
  console.log(`  Ghi chú bảo mật dùng mật khẩu: ${notePassword}`);
  await request(sessionA.cookie,'/auth/logout',{method:'POST',body:{}});
  await request(sessionB.cookie,'/auth/logout',{method:'POST',body:{}});
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
