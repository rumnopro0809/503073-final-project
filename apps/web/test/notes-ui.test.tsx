import { afterEach, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { Label, Note, NotesResponse } from '../src/types/notes';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Element', 'MutationObserver', 'FileReader', 'File']) {
  Object.defineProperty(globalThis, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true });
}
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { render, screen, cleanup, waitFor, act, fireEvent, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { NotesWorkspace } = await import('../src/components/NotesWorkspace');
const { NoteEditor } = await import('../src/components/NoteEditor');
const { App } = await import('../src/App');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const originalFetch = globalThis.fetch;
const calls: { url: string; method: string; signal?: AbortSignal | null; body?: string; key?: string | null }[] = [];
let respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
let respondLabels: (url: string, init?: RequestInit) => Response | Promise<Response>;
let expired: number;
let preferences = {density:'comfortable',fontSize:14,theme:'light',noteColor:'#fffdf7'};
let isDirty: boolean;
const onExpired = () => { expired++; };
const onDirty = (value: boolean) => { isDirty = value; };
const noteA: Note = { id: 'a', title: 'Ghi chú A', content: 'Nội dung A', pinned: false, pinnedAt: null, dueAt: null, completedAt: null, completed: false, important: false, daily: false, labels: [], version: 1, createdAt: '2026-10-27T08:00:00Z', updatedAt: '2026-10-27T08:00:00Z' };
const noteB: Note = { ...noteA, id: 'b', title: 'Ghi chú B', content: 'Nội dung B' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const page = (notes: Note[], hasMore = false, offset = 0): NotesResponse => ({ notes, pagination: { limit: 50, offset, hasMore } });
const mount = () => render(<NotesWorkspace onSessionExpired={onExpired} onDirtyChange={onDirty} />);
const user = () => userEvent.setup({ document: dom.window.document });
const titleInput = () => screen.getByLabelText<HTMLInputElement>('Tiêu đề');
const contentInput = () => screen.getByLabelText<HTMLTextAreaElement>('Nội dung');

beforeEach(() => {
  calls.length = 0; expired = 0; isDirty = false;
  preferences = {density:'comfortable',fontSize:14,theme:'light',noteColor:'#fffdf7'};
  window.localStorage.clear();
  window.confirm = () => true;
  respond = url => url.includes('?') ? json(page([])) : json({ note: noteA });
  respondLabels = () => json({ labels: [] });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/attachments/notes/')) return json({attachments:[]});
    if (url === '/api/auth/preferences') {
      if (init?.method === 'PATCH') preferences = {...preferences,...JSON.parse(String(init.body))};
      return json({preferences});
    }
    calls.push({ url, method: init?.method || 'GET', signal: init?.signal, body: init?.body as string | undefined,
      key: new Headers(init?.headers).get('Idempotency-Key') });
    return url.startsWith('/api/labels') ? respondLabels(url, init) : respond(url, init);
  }) as typeof fetch;
});
afterEach(async () => { cleanup(); await act(async () => {}); });
after(() => { globalThis.fetch = originalFetch; dom.window.close(); });

function LocationProbe(){const location=useLocation();return <output data-testid="current-path">{location.pathname}</output>;}
test('anonymous root and retired guest/welcome routes redirect to login without a guest bypass',async()=>{
  respond=url=>url==='/api/auth/me'?json({message:'Chưa đăng nhập'},401):json(page([]));
  for(const path of ['/','/guest','/welcome','/unknown']){
    render(<MemoryRouter initialEntries={[path]}><App/><LocationProbe/></MemoryRouter>);
    assert.ok(await screen.findByRole('region',{name:'Đăng nhập tài khoản'}));
    await waitFor(()=>assert.equal(screen.getByTestId('current-path').textContent,'/login'));
    assert.equal(screen.queryByRole('region',{name:'Không gian ghi chú'}),null);
    assert.equal(document.querySelector('a[href="/guest"]'),null);
    cleanup();
  }
});
test('successful login opens account notes and logout returns to login',async()=>{
  const account={id:'user-a',email:'student@example.test',displayName:'Sinh viên',emailVerified:true};let signedIn=false;
  respond=(url,init)=>{
    if(url==='/api/auth/me')return signedIn?json({user:account}):json({message:'Chưa đăng nhập'},401);
    if(url==='/api/auth/login'&&init?.method==='POST'){signedIn=true;return json({user:account});}
    if(url==='/api/auth/logout'){signedIn=false;return new Response(null,{status:204});}
    return json(page([]));
  };
  render(<MemoryRouter initialEntries={['/']}><App/><LocationProbe/></MemoryRouter>);const actor=user();
  await actor.type(await screen.findByLabelText('Email'),'student@example.test');await actor.type(screen.getByLabelText('Mật khẩu'),'Demo password 2026!');
  await actor.click(screen.getByRole('button',{name:'Đăng nhập'}));
  assert.ok(await screen.findByRole('region',{name:'Không gian ghi chú'}));
  await waitFor(()=>assert.equal(screen.getByTestId('current-path').textContent,'/'));
  await actor.click(screen.getByRole('button',{name:'Đăng xuất'}));
  assert.ok(await screen.findByRole('region',{name:'Đăng nhập tài khoản'}));
  await waitFor(()=>assert.equal(screen.getByTestId('current-path').textContent,'/login'));
});
test('auth lookup failure does not expose notes or a guest fallback',async()=>{
  respond=()=>json({message:'Máy chủ chưa sẵn sàng'},503);
  render(<MemoryRouter initialEntries={['/guest']}><App/></MemoryRouter>);
  assert.ok(await screen.findByRole('alert'));assert.equal(screen.queryByRole('region',{name:'Không gian ghi chú'}),null);assert.equal(document.querySelector('a[href="/guest"]'),null);
});
test('legacy reminder metadata has no controls, badges or influence on default note ordering',async()=>{
  const old={...noteA,important:true,dueAt:'2026-01-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'};
  const recent={...noteB,updatedAt:'2026-10-02T00:00:00Z'};
  respond=url=>url.includes('?')?json(page([old,recent])):json({note:old});mount();
  await screen.findByRole('button',{name:'Mở ghi chú Ghi chú B'});
  assert.deepEqual(within(screen.getByLabelText('Danh sách ghi chú')).getAllByRole('button').map(b=>b.getAttribute('aria-label')),['Mở ghi chú Ghi chú B','Mở ghi chú Ghi chú A']);
  await user().click(screen.getByRole('button',{name:'Mở ghi chú Ghi chú A'}));
  for(const name of ['Quá hạn','Sắp đến hạn','Hằng ngày','Đã hoàn thành','Đặt nhắc việc'])assert.equal(screen.queryByRole('button',{name}),null);
  assert.equal(screen.queryByLabelText('Quan trọng'),null);assert.equal(document.querySelector('.task-deadline'),null);assert.ok(!calls.some(c=>c.url.includes('/reminders')));
});

test('live collaboration opens from a saved note without HTTP autosave and restores normal navigation',async()=>{
  const originalSocket=globalThis.WebSocket;
  const {Doc,encodeStateAsUpdate}=await import('yjs');
  const doc=new Doc();doc.getText('title').insert(0,noteA.title);doc.getText('content').insert(0,noteA.content);
  class FakeSocket {
    readyState=1;onmessage:((event:{data:string})=>void)|null=null;onerror:unknown;onclose:unknown;
    constructor(public url:string){queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'state',epoch:'ui-test',readOnly:false,update:Buffer.from(encodeStateAsUpdate(doc)).toString('base64')})}));}
    send(){}close(){}
  }
  globalThis.WebSocket=FakeSocket as unknown as typeof WebSocket;
  try{
    respond=url=>url.includes('?')?json(page([noteA])):json({note:noteA});mount();const actor=user();
    await actor.click(await screen.findByRole('button',{name:'Mở ghi chú Ghi chú A'}));
    await actor.click(await screen.findByRole('button',{name:'Cộng tác trực tiếp'}));
    await waitFor(()=>assert.equal(screen.getByLabelText<HTMLInputElement>('Tiêu đề trực tiếp').value,noteA.title));
    assert.equal(screen.queryByLabelText('Tiêu đề'),null);
    assert.ok(screen.getByText('Đã đồng bộ'));
    assert.equal(calls.filter(call=>call.method==='PATCH').length,0);
    await actor.click(screen.getByRole('button',{name:'Đóng cộng tác'}));
    assert.equal(screen.queryByRole('region',{name:'Cộng tác trực tiếp'}),null);
    await actor.click(screen.getByRole('button',{name:'Ghi chú mới'}));assert.equal(titleInput().value,'');
  }finally{cleanup();globalThis.WebSocket=originalSocket;doc.destroy();}
});

test('AI Summary flushes a draft before generating, renders text safely and clears after editing',async()=>{
  let saved={...noteA};const operations:string[]=[];
  respond=(url,init)=>{
    if(url.includes('?'))return json(page([saved]));
    if(url.endsWith('/summary')){operations.push('summary');return json({summary:'<script>unsafe()</script>\nÝ chính: đã sửa.',sourceVersion:saved.version,generatedAt:new Date().toISOString()});}
    if(init?.method==='PATCH'){operations.push('save');saved={...saved,...JSON.parse(String(init.body)),version:saved.version+1};}
    return json({note:saved});
  };
  mount();const actor=user();await actor.click(await screen.findByRole('button',{name:'Mở ghi chú Ghi chú A'}));
  await actor.type(contentInput(),' phần thêm');
  await actor.click(screen.getByRole('button',{name:'Tóm tắt bằng AI'}));
  await waitFor(()=>assert.ok(screen.getByText(/Ý chính: đã sửa/)));
  assert.ok(operations.indexOf('save')<operations.indexOf('summary'));assert.equal(document.querySelector('.ai-summary-result script'),null);
  await actor.type(contentInput(),' mới');assert.equal(document.querySelector('.ai-summary-result'),null);
});

test('AI Summary reports missing configuration and can retry without changing note content',async()=>{
  let attempt=0;
  respond=url=>url.includes('?')?json(page([noteA])):url.endsWith('/summary')?(++attempt===1?json({message:'AI chưa được cấu hình.'},503):json({summary:'Bản tóm tắt thật từ phản hồi API.',sourceVersion:1,generatedAt:new Date().toISOString()})):json({note:noteA});
  mount();const actor=user();await actor.click(await screen.findByRole('button',{name:'Mở ghi chú Ghi chú A'}));
  await actor.click(screen.getByRole('button',{name:'Tóm tắt bằng AI'}));assert.ok(await screen.findByText('AI chưa được cấu hình.'));
  await actor.click(screen.getByRole('button',{name:'Tóm tắt bằng AI'}));assert.ok(await screen.findByText('Bản tóm tắt thật từ phản hồi API.'));
  assert.equal(contentInput().value,noteA.content);assert.equal(calls.filter(call=>call.method==='PATCH').length,0);
});

test('AI Q&A saves a pending draft, renders cited sources safely and opens the original note',async()=>{
  let saved={...noteA};const operations:string[]=[];
  respond=(url,init)=>{
    if(url==='/api/ai/ask'){
      operations.push('ask');assert.deepEqual(JSON.parse(String(init?.body)),{question:'Ai quay video?'});
      return json({answer:'Thái quay video [1]. <script>unsafe()</script>',insufficient:false,sources:[{id:noteA.id,title:noteA.title,excerpt:'Thái quay video.',version:saved.version,label:1}]});
    }
    if(url.includes('?'))return json(page([saved]));
    if(init?.method==='PATCH'){operations.push('save');saved={...saved,...JSON.parse(String(init.body)),version:saved.version+1};}
    return json({note:saved});
  };
  mount();const actor=user();await actor.click(await screen.findByRole('button',{name:'Mở ghi chú Ghi chú A'}));await actor.type(contentInput(),' cập nhật');
  await actor.click(screen.getByRole('button',{name:'Hỏi AI'}));
  const panel=within(screen.getByRole('region',{name:'Hỏi AI về ghi chú'}));
  await actor.type(panel.getByLabelText('Câu hỏi về ghi chú'),'Ai quay video?');await actor.click(panel.getByRole('button',{name:'Hỏi AI'}));
  assert.ok(await panel.findByText(/Thái quay video \[1\]/));assert.ok(operations.indexOf('save')<operations.indexOf('ask'));assert.equal(document.querySelector('.ai-answer script'),null);
  await actor.click(panel.getByRole('button',{name:'[1] Ghi chú A'}));await waitFor(()=>assert.equal(titleInput().value,noteA.title));
  assert.ok(calls.filter(call=>call.url==='/api/notes/a').length>=2);
});

test('AI Q&A shows insufficient evidence and provider errors',async()=>{
  let attempt=0;respond=url=>url==='/api/ai/ask'?(++attempt===1?json({answer:'Chưa đủ thông tin trong ghi chú.',insufficient:true,sources:[]}):json({message:'AI hết hạn mức, thử lại sau.'},429)):url.includes('?')?json(page([])):json({note:noteA});
  mount();const actor=user();await actor.click(screen.getByRole('button',{name:'Hỏi AI'}));let panel=within(screen.getByRole('region',{name:'Hỏi AI về ghi chú'}));
  await actor.type(panel.getByLabelText('Câu hỏi về ghi chú'),'Thiên thạch ở đâu?');await actor.click(panel.getByRole('button',{name:'Hỏi AI'}));
  assert.ok(await panel.findByText('Chưa đủ thông tin trong ghi chú.'));assert.equal(panel.queryByRole('region',{name:'Nguồn ghi chú'}),null);
  await actor.click(panel.getByRole('button',{name:'Hỏi AI'}));assert.ok(await panel.findByText('AI hết hạn mức, thử lại sau.'));
});

test('sidebar settings and about keep the editor draft and remember display preferences', async () => {
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button',{name:'Ghi chú mới'}));
  await actor.type(titleInput(),'Bản nháp còn đây');
  await actor.click(screen.getByRole('button',{name:'Cài đặt'}));
  assert.ok(screen.getByRole('region',{name:'Cài đặt hiển thị'}));
  await actor.selectOptions(screen.getByLabelText('Mật độ thẻ'),'compact');
  await actor.selectOptions(screen.getByLabelText('Cỡ chữ ghi chú'),'16');
  await actor.selectOptions(screen.getByLabelText('Giao diện'),'dark');
  await actor.selectOptions(screen.getByLabelText('Màu ghi chú'),'#e8f1ff');
  assert.equal(document.documentElement.dataset.theme,'dark');
  await actor.click(screen.getByRole('button',{name:'Về ứng dụng'}));
  assert.ok(screen.getByRole('region',{name:'Về ứng dụng'}));
  await actor.click(screen.getByRole('button',{name:'Quay lại ghi chú'}));
  assert.equal(titleInput().value,'Bản nháp còn đây');
  assert.equal(calls.filter(call=>call.method==='POST').length,0);
  cleanup(); mount();
  await actor.click(screen.getByRole('button',{name:'Cài đặt'}));
  assert.equal(screen.getByLabelText<HTMLSelectElement>('Mật độ thẻ').value,'compact');
  assert.equal(screen.getByLabelText<HTMLSelectElement>('Cỡ chữ ghi chú').value,'16');
  assert.equal(screen.getByLabelText<HTMLSelectElement>('Giao diện').value,'dark');
  assert.equal(screen.getByLabelText<HTMLSelectElement>('Màu ghi chú').value,'#e8f1ff');
});

test('password recovery submits email, validates reset failure and only completes after API success', async () => {
  const {PasswordRecovery}=await import('../src/components/PasswordRecovery');
  let resetCount=0;
  respond=(url,init)=>{
    if(url==='/api/auth/forgot-password') { assert.equal(JSON.parse(String(init?.body)).email,'student@example.test'); return json({message:'Kiểm tra hộp thư'}); }
    if(url==='/api/auth/reset-password') return JSON.parse(String(init?.body)).confirmPassword==='New password 2026!' ? json({message:'Đã đặt lại mật khẩu'}) : json({message:'Mật khẩu nhập lại chưa khớp'},422);
    return json({message:'Vui lòng đăng nhập'},401);
  };
  const actor=user();
  render(<MemoryRouter><PasswordRecovery onReset={()=>resetCount++}/></MemoryRouter>);
  await actor.type(screen.getByLabelText('Email tài khoản'),'student@example.test');
  await actor.click(screen.getByRole('button',{name:'Gửi liên kết đặt lại'}));
  await screen.findByText('Kiểm tra hộp thư'); cleanup();
  render(<MemoryRouter initialEntries={['/reset-password?token=abc']}><PasswordRecovery reset onReset={()=>resetCount++}/></MemoryRouter>);
  await actor.type(screen.getByLabelText('Mật khẩu mới',{exact:true}),'New password 2026!');
  await actor.type(screen.getByLabelText('Nhập lại mật khẩu mới'),'wrong');
  await actor.click(screen.getByRole('button',{name:'Đặt lại mật khẩu'}));
  assert.match((await screen.findByRole('alert')).textContent??'',/chưa khớp/); assert.equal(resetCount,0);
  await actor.clear(screen.getByLabelText('Nhập lại mật khẩu mới'));
  await actor.type(screen.getByLabelText('Nhập lại mật khẩu mới'),'New password 2026!');
  await actor.click(screen.getByRole('button',{name:'Đặt lại mật khẩu'}));
  await screen.findByText('Đã đặt lại mật khẩu'); assert.equal(resetCount,1);
  assert.equal(screen.queryByLabelText('Mật khẩu mới',{exact:true}),null);
});

test('profile edits update the account and password change waits for a saved draft', async () => {
  const {ProfilePanel}=await import('../src/components/ProfilePanel');
  let changedName='',signedOut=0,allow=false;
  respond=(url,init)=>url==='/api/auth/profile'?json({user:{id:'u',email:'student@example.test',displayName:JSON.parse(String(init?.body)).displayName,emailVerified:false}}):json({message:'Đã đổi mật khẩu'});
  render(<ProfilePanel user={{id:'u',email:'student@example.test',displayName:'Student',emailVerified:false}} onUserChange={user=>{changedName=user.displayName;}} onClose={()=>{}} onSignedOut={()=>signedOut++} beforePasswordChange={async()=>allow}/>);
  const actor=user();
  await actor.clear(screen.getByLabelText('Tên hiển thị')); await actor.type(screen.getByLabelText('Tên hiển thị'),'Tên mới');
  await actor.click(screen.getByRole('button',{name:'Cập nhật hồ sơ'})); await screen.findByText('Đã cập nhật hồ sơ.'); assert.equal(changedName,'Tên mới');
  await actor.type(screen.getByLabelText('Mật khẩu hiện tại'),'Old password 2026!');
  await actor.type(screen.getByLabelText('Mật khẩu mới',{exact:true}),'New password 2026!');
  await actor.type(screen.getByLabelText('Nhập lại mật khẩu mới'),'New password 2026!');
  await actor.click(screen.getByRole('button',{name:'Đổi mật khẩu và đăng xuất'}));
  assert.equal(calls.some(call=>call.url==='/api/auth/change-password'),false);
  allow=true; await actor.click(screen.getByRole('button',{name:'Đổi mật khẩu và đăng xuất'}));
  await waitFor(()=>assert.equal(signedOut,1));
});

test('attachment control appears on new drafts and enables after the note is saved',async()=>{
  const {NoteAttachments}=await import('../src/components/NoteAttachments');
  const view=render(<NoteAttachments noteId={null} beforeUpload={async()=>true}/>);
  const button=screen.getByRole('button',{name:'Thêm tệp đính kèm'}) as HTMLButtonElement;
  assert.equal(button.disabled,true);
  assert.ok(screen.getByText('Nhập tiêu đề và nội dung, chờ Đã lưu để thêm tệp vào ghi chú.'));
  view.rerender(<NoteAttachments noteId="a" beforeUpload={async()=>true}/>);
  await waitFor(()=>assert.equal(button.disabled,false));
  assert.equal(screen.queryByText('Nhập tiêu đề và nội dung, chờ Đã lưu để thêm tệp vào ghi chú.'),null);
  view.rerender(<NoteAttachments noteId="a" readOnly beforeUpload={async()=>true}/>);
  assert.equal(screen.queryByRole('button',{name:'Thêm tệp đính kèm'}),null);
});

test('attachments flush before upload and preserve existing files after a failed removal', async () => {
  const {NoteAttachments}=await import('../src/components/NoteAttachments');
  const attachments:{url:string;method:string}[]=[]; let flush=false,removalFails=true;
  const file={id:'file',name:'bài tập.txt',mediaType:'application/octet-stream',size:3,url:'/api/attachments/file'};
  const previous=globalThis.fetch;
  globalThis.fetch=(async(input,init)=>{
    const url=String(input); if(!url.startsWith('/api/attachments')) return previous(input,init);
    attachments.push({url,method:init?.method??'GET'});
    if(init?.method==='POST') {assert.equal(flush,true);return json({attachment:file});}
    if(init?.method==='DELETE') return removalFails?json({message:'Chưa xóa được'},500):new Response(null,{status:204});
    return json({attachments:[]});
  }) as typeof fetch;
  render(<NoteAttachments noteId="note" beforeUpload={async()=>{flush=true;return true;}}/>);
  const input=screen.getByLabelText<HTMLInputElement>('Đính kèm tệp');
  await waitFor(()=>assert.equal(input.disabled,false));
  await user().upload(input,new window.File(['abc'],'bài tập.txt',{type:'text/plain'}));
  await screen.findByRole('link',{name:/bài tập.txt/});
  await user().click(screen.getByRole('button',{name:'Xóa tệp bài tập.txt'}));
  await screen.findByText('Chưa xóa được'); assert.ok(screen.getByRole('link',{name:/bài tập.txt/}));
  removalFails=false; await user().click(screen.getByRole('button',{name:'Xóa tệp bài tập.txt'}));
  await waitFor(()=>assert.equal(screen.queryByRole('link',{name:/bài tập.txt/}),null));
  assert.equal(attachments.filter(call=>call.method==='POST').length,1);
});

test('GSAP entrance preserves editor focus, does not replay while typing and cleans up on unmount', async () => {
  const { gsap } = await import('gsap');
  const originalMedia = window.matchMedia;
  const originalStyle = globalThis.getComputedStyle;
  window.matchMedia = ((media: string) => ({ media, matches: true,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  try {
    const props = { isNew: true, onChange: () => {}, onClose: () => {}, saveStatus: 'unsaved' as const };
    const view = render(<NoteEditor {...props} draft={{ title: 'A', content: 'B' }} />);
    const panel = screen.getByRole('region', { name: 'Ghi chú mới' });
    const tween = gsap.getTweensOf(panel)[0];
    assert.ok(tween);
    assert.equal(document.activeElement, titleInput());
    view.rerender(<NoteEditor {...props} draft={{ title: 'Typing', content: 'Continues' }} />);
    assert.equal(gsap.getTweensOf(panel)[0], tween);
    assert.equal(titleInput().value, 'Typing');
    view.unmount();
    assert.equal(gsap.getTweensOf(panel).length, 0);
    assert.equal(panel.style.transform, '');
    assert.equal(panel.style.opacity, '');
  } finally { window.matchMedia = originalMedia; globalThis.getComputedStyle = originalStyle; }
});

test('reduced motion leaves the editor visible and focusable with no GSAP tween', async () => {
  const { gsap } = await import('gsap');
  const original = window.matchMedia;
  window.matchMedia = ((media: string) => ({ media, matches: false, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  try {
    const view = render(<NoteEditor isNew draft={{ title: '', content: '' }} onChange={() => {}} onClose={() => {}} saveStatus="idle" />);
    const panel = screen.getByRole('region', { name: 'Ghi chú mới' });
    assert.equal(gsap.getTweensOf(panel).length, 0);
    assert.equal(panel.style.opacity, '');
    assert.equal(panel.style.visibility, '');
    assert.equal(document.activeElement, titleInput());
    view.unmount();
  } finally { window.matchMedia = original; }
});

test('an empty account shows the empty state and opens the shared editor', async () => {
  mount();
  assert.ok(await screen.findByText(/Bạn chưa có ghi chú nào\./));
  await user().click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  assert.equal(titleInput().value, '');
  assert.equal(contentInput().value, '');
  assert.ok(screen.getByText('Bản nháp mới'));
  assert.equal(document.activeElement, titleInput());
});

test('a slow request shows loading before rendering real note cards', async () => {
  let finish!: (response: Response) => void;
  respond = () => new Promise<Response>(resolve => { finish = resolve; });
  mount();
  assert.ok(screen.getByText('Đang tải ghi chú…'));
  await act(async () => { finish(json(page([noteA]))); });
  assert.ok(await screen.findByRole('button', { name: /Ghi chú A/ }));
  assert.equal(screen.queryByText('Đang tải ghi chú…'), null);
});

test('a failed list request can be retried', async () => {
  respond = () => json({ message: 'Không tải được dữ liệu.' }, 503);
  mount();
  assert.ok(await screen.findByRole('alert'));
  respond = () => json(page([noteA]));
  await user().click(screen.getByRole('button', { name: 'Thử tải lại' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú A/ }));
});

test('pagination appends the next page and removes overlapping note IDs', async () => {
  respond = url => url.includes('offset=50') ? json(page([noteA, noteB], false, 50)) : json(page([noteA], true));
  mount();
  await user().click(await screen.findByRole('button', { name: 'Tải thêm ghi chú' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú B/ }));
  assert.equal(screen.getAllByRole('button', { name: /Ghi chú A/ }).length, 1);
  assert.equal(screen.queryByRole('button', { name: 'Tải thêm ghi chú' }), null);
});

test('failure on a later page preserves existing cards and allows retry', async () => {
  let fail = true;
  respond = url => url.includes('offset=50') ? fail ? json({ message: 'Lỗi trang sau.' }, 503) : json(page([noteB], false, 50)) : json(page([noteA], true));
  mount();
  await user().click(await screen.findByRole('button', { name: 'Tải thêm ghi chú' }));
  assert.ok(await screen.findByText('Lỗi trang sau.'));
  assert.ok(screen.getByRole('button', { name: /Ghi chú A/ }));
  fail = false;
  await user().click(screen.getByRole('button', { name: 'Thử tải thêm' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú B/ }));
});

test('opening a note fetches its current content and version rather than the list snapshot', async () => {
  respond = url => url.includes('?') ? json(page([noteA])) : json({ note: { ...noteA, content: 'Phiên bản mới trên server', version: 2 } });
  mount();
  await user().click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await waitFor(() => assert.equal(contentInput().value, 'Phiên bản mới trên server'));
  assert.ok(screen.getByText('Đã lưu'));
  assert.equal(isDirty, false);
  assert.ok(calls.some(call => call.url === '/api/notes/a'));
});

test('typing debounces saving and never requires a Save button', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Ý tưởng mới');
  await actor.type(contentInput(), 'Nội dung chưa lưu');
  assert.ok(screen.getByText('Bản nháp chưa lưu'));
  assert.equal(isDirty, true);
  assert.equal(screen.queryByRole('button', { name: /^(Save|Lưu)$/ }), null);
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('closing a dirty editor respects the discard decision', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Giữ bản nháp');
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: 'Đóng trình soạn ghi chú' }));
  assert.equal(titleInput().value, 'Giữ bản nháp');
  window.confirm = () => true;
  await actor.click(screen.getByRole('button', { name: 'Đóng trình soạn ghi chú' }));
  await waitFor(() => assert.equal(screen.queryByLabelText('Tiêu đề') === null, true));
  assert.equal(isDirty, false);
  await waitFor(() => assert.equal(document.activeElement === screen.getByRole('button', { name: 'Ghi chú mới' }), true));
});

test('declining to discard a draft prevents navigation to another note', async () => {
  respond = url => url.includes('?') ? json(page([noteA, noteB])) : json({ note: url.endsWith('/b') ? noteB : noteA });
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await waitFor(() => assert.equal(titleInput().value, noteA.title));
  await actor.clear(titleInput());
  await actor.type(contentInput(), ' thêm bản nháp');
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: /Ghi chú B/ }));
  assert.equal(calls.some(call => call.url.endsWith('/b')), false);
  assert.equal(contentInput().value, `${noteA.content} thêm bản nháp`);
});

test('a late response from a previously selected note cannot overwrite the current editor', async () => {
  let finishA!: (response: Response) => void;
  respond = url => url.includes('?') ? json(page([noteA, noteB]))
    : url.endsWith('/a') ? new Promise<Response>(resolve => { finishA = resolve; }) : json({ note: noteB });
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await actor.click(screen.getByRole('button', { name: /Ghi chú B/ }));
  await waitFor(() => assert.equal(titleInput().value, noteB.title));
  await act(async () => { finishA(json({ note: noteA })); });
  assert.equal(titleInput().value, noteB.title);
  assert.equal(calls.find(call => call.url.endsWith('/a'))!.signal?.aborted, true);
});

test('refreshing the list never replaces the current unsaved draft', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(contentInput(), 'Còn trên trang');
  respond = () => json(page([noteA]));
  await actor.click(screen.getByRole('button', { name: 'Tải lại' }));
  assert.ok(await screen.findByRole('button', { name: /Ghi chú A/ }));
  assert.equal(contentInput().value, 'Còn trên trang');
});

test('session expiry is reported to the parent', async () => {
  respond = () => json({ message: 'Phiên đã hết hạn.' }, 401);
  mount();
  await waitFor(() => assert.equal(expired, 1));
  assert.equal(screen.queryByRole('button', { name: /Ghi chú A/ }), null);
});

test('dirty drafts install the before-unload warning and clean editors remove it', async () => {
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Chưa lưu');
  const first = new window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(first);
  assert.equal(first.defaultPrevented, true);
  await actor.click(screen.getByRole('button', { name: 'Đóng trình soạn ghi chú' }));
  const second = new window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(second);
  assert.equal(second.defaultPrevented, false);
});

test('the shared editor accepts autosave status and field errors from the future hook', () => {
  render(<NoteEditor draft={{ title: 'Ghi chú', content: 'Nội dung' }} isNew={false}
    onChange={() => {}} onClose={() => {}} saveStatus="conflict" saveError="Cần xử lý thay đổi mới."
    fieldErrors={{ title: 'Tiêu đề cần kiểm tra.' }} />);
  assert.ok(screen.getByText('Có thay đổi từ phiên khác'));
  assert.ok(screen.getByRole('alert'));
  assert.equal(titleInput().getAttribute('aria-invalid'), 'true');
  assert.equal(titleInput().maxLength, 200);
  assert.equal(contentInput().maxLength, 100000);
});

test('a session refresh does not refetch the list or erase a draft; logout asks before discarding', async () => {
  const account = { id: 'user-a', email: 'student@example.test', displayName: 'Sinh viên', emailVerified: true };
  respond = url => url === '/api/auth/me' ? json({ user: { ...account } }) : url === '/api/auth/logout' ? new Response(null, { status: 204 }) : json(page([]));
  render(<MemoryRouter><App /></MemoryRouter>);
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Không mất sau khi chuyển tab');
  const listRequests = calls.filter(call => call.url.startsWith('/api/notes?')).length;
  await act(async () => { fireEvent(window, new window.Event('focus')); });
  assert.equal(calls.filter(call => call.url.startsWith('/api/notes?')).length, listRequests);
  assert.equal(titleInput().value, 'Không mất sau khi chuyển tab');
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: 'Đăng xuất' }));
  assert.equal(calls.some(call => call.url === '/api/auth/logout'), false);
  assert.equal(titleInput().value, 'Không mất sau khi chuyển tab');
});

test('a new note is automatically created then patched with its server ID and version', async () => {
  respond = (url, init) => {
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      return json({ note: { ...noteA, title: body.title, content: body.content, version: init.method === 'PATCH' ? body.version + 1 : 1 } });
    }
    return json(page([]));
  };
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Tự lưu');
  await actor.type(contentInput(), 'Bản đầu');
  await screen.findByText('Đã lưu', {}, { timeout: 2000 });
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.ok(calls.find(call => call.method === 'POST')!.key);
  await actor.type(contentInput(), ' thêm');
  await screen.findByText('Đã lưu', {}, { timeout: 2000 });
  const patch = calls.find(call => call.method === 'PATCH')!;
  assert.equal(patch.url, '/api/notes/a');
  assert.equal(JSON.parse(patch.body!).version, 1);
  assert.equal(contentInput().value, 'Bản đầu thêm');
});

test('typing while the first POST is pending keeps focus and saves the newest text afterwards', async () => {
  let release!: (response: Response) => void;
  let posted!: { title: string; content: string };
  respond = (_url, init) => {
    if (init?.method === 'POST') { posted = JSON.parse(init.body as string); return new Promise<Response>(resolve => { release = resolve; }); }
    if (init?.method === 'PATCH') { const body = JSON.parse(init.body as string); return json({ note: { ...noteA, ...body, version: body.version + 1 } }); }
    return json(page([]));
  };
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Ghi chú');
  await actor.type(contentInput(), 'A');
  await waitFor(() => assert.ok(release), { timeout: 2000 });
  await actor.type(contentInput(), 'B');
  await act(async () => { release(json({ note: { ...noteA, ...posted } })); });
  await screen.findByText('Đã lưu', {}, { timeout: 2000 });
  assert.equal(contentInput().value, 'AB');
  assert.equal(document.activeElement, contentInput());
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(JSON.parse(calls.find(call => call.method === 'PATCH')!.body!).content, 'AB');
});

test('network failure retains the draft and retry reuses the creation key', async () => {
  let failed = true;
  respond = (_url, init) => {
    if (init?.method === 'POST') {
      if (failed) { failed = false; throw new TypeError('Network failed'); }
      const body = JSON.parse(init.body as string); return json({ note: { ...noteA, ...body } });
    }
    return json(page([]));
  };
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Giữ khi lỗi mạng');
  await actor.type(contentInput(), 'Không mất nội dung');
  await actor.click(await screen.findByRole('button', { name: 'Thử kết nối và lưu lại' }, { timeout: 2000 }));
  await screen.findByText('Đã lưu');
  assert.equal(contentInput().value, 'Không mất nội dung');
  const posts = calls.filter(call => call.method === 'POST');
  assert.equal(posts.length, 2);
  assert.equal(posts[0].key, posts[1].key);
});

test('conflict comparison preserves input and requires a deliberate resolution', async () => {
  let conflict = false;
  const remote = { ...noteA, content: 'Bản từ phiên khác', version: 2 };
  respond = (url, init) => {
    if (init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      if (body.version === 1) { conflict = true; return json({ message: 'Có thay đổi mới.' }, 409); }
      return json({ note: { ...remote, title: body.title, content: body.content, version: 3 } });
    }
    return url.includes('?') ? json(page([noteA])) : json({ note: conflict ? remote : noteA });
  };
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await waitFor(() => assert.equal(contentInput().value, noteA.content));
  await actor.type(contentInput(), ' bản của tôi');
  await actor.click(await screen.findByRole('button', { name: 'Đọc bản mới trên máy chủ' }, { timeout: 2000 }));
  assert.ok(await screen.findByText(remote.content));
  assert.equal(contentInput().value, `${noteA.content} bản của tôi`);
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: 'Tiếp tục với nội dung đang nhập' }));
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 1);
  window.confirm = () => true;
  await actor.click(screen.getByRole('button', { name: 'Tiếp tục với nội dung đang nhập' }));
  await screen.findByText('Đã lưu');
  assert.equal(JSON.parse(calls.filter(call => call.method === 'PATCH')[1].body!).version, 2);
});

test('closing a valid draft flushes the pending debounce before closing the editor', async () => {
  respond = (_url, init) => init?.method === 'POST'
    ? json({ note: { ...noteA, ...JSON.parse(init.body as string) } }) : json(page([]));
  mount();
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Đóng an toàn');
  await actor.type(contentInput(), 'Được lưu trước khi đóng');
  let confirmations = 0;
  window.confirm = () => { confirmations++; return false; };
  await actor.click(screen.getByRole('button', { name: 'Đóng trình soạn ghi chú' }));
  await waitFor(() => assert.equal(screen.queryByLabelText('Tiêu đề'), null));
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(confirmations, 0);
});

test('reauthentication preserves the editor and resumes its pending autosave', async () => {
  const account = { id: 'user-a', email: 'student@example.test', displayName: 'Sinh viên', emailVerified: true };
  let authenticated = true;
  let expiresOnce = true;
  respond = (url, init) => {
    if (url === '/api/auth/me') return authenticated ? json({ user: account }) : json({ message: 'Phiên hết hạn.' }, 401);
    if (url === '/api/auth/login') { authenticated = true; return json({ user: account }); }
    if (init?.method === 'POST' && url === '/api/notes') {
      if (expiresOnce) { expiresOnce = false; authenticated = false; return json({ message: 'Phiên hết hạn.' }, 401); }
      return json({ note: { ...noteA, ...JSON.parse(init.body as string) } });
    }
    return json(page([]));
  };
  render(<MemoryRouter><App /></MemoryRouter>);
  await screen.findByText(/Bạn chưa có ghi chú nào\./);
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Bản nháp giữ qua đăng nhập');
  await actor.type(contentInput(), 'Nội dung đang soạn');
  await screen.findByRole('heading', { name: 'Đăng nhập lại.' }, { timeout: 2000 });
  await actor.type(screen.getByLabelText('Mật khẩu'), 'Test password 2026!');
  await actor.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  await screen.findByText('Đã lưu', {}, { timeout: 2000 });
  assert.equal(titleInput().value, 'Bản nháp giữ qua đăng nhập');
  assert.equal(contentInput().value, 'Nội dung đang soạn');
});

test('grid is the default and switching to list preserves the note cards', async () => {
  respond = () => json(page([noteA, noteB]));
  mount();
  await screen.findByRole('button', { name: /Ghi chú A/ });
  assert.equal(screen.getByRole('button', { name: 'Xem dạng lưới' }).getAttribute('aria-pressed'), 'true');
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Xem dạng danh sách' }));
  assert.equal(screen.getByRole('button', { name: 'Xem dạng danh sách' }).getAttribute('aria-pressed'), 'true');
  assert.ok(screen.getByRole('button', { name: /Ghi chú A/ }));
  assert.ok(screen.getByRole('button', { name: /Ghi chú B/ }));
  await actor.click(screen.getByRole('button', { name: 'Xem dạng lưới' }));
  assert.equal(screen.getByRole('button', { name: 'Xem dạng lưới' }).getAttribute('aria-pressed'), 'true');
});

test('deletion always asks for confirmation and removes the card only after success', async () => {
  respond = (url, init) => init?.method === 'DELETE' ? new Response(null, { status: 204 })
    : url.includes('?') ? json(page([noteA])) : json({ note: noteA });
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await screen.findByRole('button', { name: 'Xóa ghi chú' });
  let asked = 0;
  window.confirm = () => { asked++; return false; };
  await actor.click(screen.getByRole('button', { name: 'Xóa ghi chú' }));
  assert.equal(asked, 1);
  assert.equal(calls.some(call => call.method === 'DELETE'), false);
  window.confirm = () => { asked++; return true; };
  await actor.click(screen.getByRole('button', { name: 'Xóa ghi chú' }));
  await waitFor(() => assert.equal(screen.queryByRole('button', { name: /Ghi chú A/ }) === null, true));
  assert.equal(asked, 2);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
  assert.equal(screen.queryByLabelText('Tiêu đề'), null);
});

test('deletion waits for an in-flight save before removing the note', async () => {
  let release!: (response: Response) => void;
  let body!: { title: string; content: string; version: number };
  respond = (url, init) => {
    if (init?.method === 'PATCH') { body = JSON.parse(init.body as string); return new Promise<Response>(resolve => { release = resolve; }); }
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return url.includes('?') ? json(page([noteA])) : json({ note: noteA });
  };
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: /Ghi chú A/ }));
  await waitFor(() => assert.equal(contentInput().value, noteA.content));
  await actor.type(contentInput(), ' thay đổi');
  await waitFor(() => assert.ok(release), { timeout: 2000 });
  await actor.click(screen.getByRole('button', { name: 'Xóa ghi chú' }));
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
  await act(async () => { release(json({ note: { ...noteA, ...body, version: 2 } })); });
  await waitFor(() => assert.equal(calls.filter(call => call.method === 'DELETE').length, 1));
  assert.equal(screen.queryByLabelText('Tiêu đề'), null);
});

const studyLabel: Label = { id: '11111111-1111-4111-8111-111111111111', name: 'Học tập', color: '#8b6bb1' };
const workLabel: Label = { id: '22222222-2222-4222-8222-222222222222', name: 'Công việc', color: '#3c8270' };
const searchInput = () => screen.getByRole<HTMLInputElement>('searchbox', { name: 'Tìm ghi chú' });
const noteCard = (title: string) => screen.getByRole('button', { name: `Mở ghi chú ${title}` });
const listCalls = () => calls.filter(call => call.url.startsWith('/api/notes?'));
const queryOf = (url: string) => new URL(url, 'http://localhost').searchParams;

// Stateful transport fixtures let UI tests assert that subsequent requests use the
// metadata/version actually persisted, instead of returning a canned success.
function organizationFixture(initialNotes: Note[] = [noteA, noteB], initialLabels: Label[] = [studyLabel, workLabel]) {
  let notes = initialNotes.map(note => ({ ...note, labels: [...note.labels] }));
  let labels = initialLabels.map(label => ({ ...label }));
  let timestamp = 0;
  const edited = (note: Note) => ({ ...note, version: note.version + 1, updatedAt: new Date(Date.UTC(2026, 9, 29, 12, 0, ++timestamp)).toISOString() });
  respond = (url, init) => {
    const method = init?.method || 'GET';
    if (url.startsWith('/api/notes?')) return json(page(notes));
    const id = url.split('/')[3];
    const current = notes.find(note => note.id === id);
    if (!current) return json({ message: 'Không tìm thấy ghi chú.' }, 404);
    if (method === 'GET') return json({ note: current });
    if (method === 'PATCH') {
      const body = JSON.parse(init!.body as string);
      if (body.version !== current.version) return json({ message: 'Có thay đổi mới.' }, 409);
      let next = edited(current);
      if (url.endsWith('/organization')) {
        if (typeof body.pinned === 'boolean') {
          next.pinned = body.pinned;
          next.pinnedAt = body.pinned ? next.updatedAt : null;
        }
        if (body.labelIds) next.labels = labels.filter(label => body.labelIds.includes(label.id));
      } else next = { ...next, title: body.title ?? current.title, content: body.content ?? current.content };
      notes = notes.map(note => note.id === id ? next : note);
      return json({ note: next });
    }
    throw new Error(`Unexpected notes request: ${method} ${url}`);
  };
  respondLabels = (url, init) => {
    const method = init?.method || 'GET';
    if (method === 'GET') return json({ labels });
    const body = init?.body ? JSON.parse(init.body as string) : {};
    if (method === 'POST') {
      const label = { id: '33333333-3333-4333-8333-333333333333', name: body.name, color: body.color || '#8b6bb1' };
      labels.push(label); return json({ label }, 201);
    }
    const id = url.split('/')[3];
    const current = labels.find(label => label.id === id)!;
    if (method === 'PATCH') {
      const label = { ...current, ...body };
      labels = labels.map(row => row.id === id ? label : row);
      notes = notes.map(note => note.labels.some(row => row.id === id) ? edited({ ...note, labels: note.labels.map(row => row.id === id ? label : row) }) : note);
      return json({ label });
    }
    if (method === 'DELETE') {
      labels = labels.filter(label => label.id !== id);
      notes = notes.map(note => note.labels.some(label => label.id === id) ? edited({ ...note, labels: note.labels.filter(label => label.id !== id) }) : note);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected labels request: ${method} ${url}`);
  };
  return { get notes() { return notes; }, get labels() { return labels; } };
}

test('live search debounces the whole query and preserves an unfinished editor', async () => {
  respond = url => url.startsWith('/api/notes?') ? json(page(queryOf(url).get('q') === 'nội dung b' ? [noteB] : [noteA, noteB])) : json({ note: noteA });
  mount();
  await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' });
  const actor = user();
  await actor.click(screen.getByRole('button', { name: 'Ghi chú mới' }));
  await actor.type(titleInput(), 'Bản nháp chỉ có tiêu đề');
  const beforeSearch = listCalls().length;
  await actor.type(searchInput(), 'nội dung b');
  assert.equal(listCalls().length, beforeSearch);
  assert.equal(screen.queryByRole('button', { name: /^Tìm kiếm$/ }), null);
  await waitFor(() => assert.equal(queryOf(listCalls().at(-1)!.url).get('q'), 'nội dung b'));
  await waitFor(() => assert.equal(screen.queryByRole('button', { name: 'Mở ghi chú Ghi chú A' }), null));
  assert.ok(noteCard(noteB.title));
  assert.equal(listCalls().length, beforeSearch + 1);
  assert.equal(titleInput().value, 'Bản nháp chỉ có tiêu đề');
  assert.equal(isDirty, true);
});

test('an older search response cannot replace the newer results', async () => {
  let oldResponse!: (response: Response) => void;
  respond = url => {
    const query = queryOf(url).get('q');
    if (query === 'A') return new Promise<Response>(resolve => { oldResponse = resolve; });
    return json(page(query === 'B' ? [noteB] : [noteA, noteB]));
  };
  mount();
  await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' });
  const actor = user();
  await actor.type(searchInput(), 'A');
  await waitFor(() => assert.ok(oldResponse));
  await actor.clear(searchInput());
  await actor.type(searchInput(), 'B');
  await waitFor(() => assert.equal(queryOf(listCalls().at(-1)!.url).get('q'), 'B'));
  await act(async () => { oldResponse(json(page([noteA]))); });
  assert.ok(noteCard(noteB.title));
  assert.equal(screen.queryByRole('button', { name: 'Mở ghi chú Ghi chú A' }), null);
  assert.equal(listCalls().find(call => queryOf(call.url).get('q') === 'A')!.signal?.aborted, true);
});

test('combined filters and sorting travel to every page and can be cleared', async () => {
  respondLabels = () => json({ labels: [studyLabel] });
  const matching = { ...noteA, pinned: true, pinnedAt: noteA.updatedAt, labels: [studyLabel] };
  respond = url => json(page([matching], queryOf(url).get('offset') !== '50', queryOf(url).get('offset') === '50' ? 50 : 0));
  mount();
  await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' });
  const actor = user();
  await actor.type(searchInput(), 'Ghi');
  await waitFor(() => assert.equal(queryOf(listCalls().at(-1)!.url).get('q'), 'Ghi'));
  await actor.click(screen.getByRole('button', { name: 'Chỉ ghi chú đã ghim' }));
  await actor.selectOptions(screen.getByLabelText('Lọc theo nhãn'), studyLabel.id);
  await actor.selectOptions(screen.getByLabelText('Sắp xếp ghi chú'), 'title');
  await waitFor(() => assert.equal(queryOf(listCalls().at(-1)!.url).get('sort'), 'title'));
  await actor.click(await screen.findByRole('button', { name: 'Tải thêm ghi chú' }));
  await waitFor(() => assert.ok(listCalls().some(call => queryOf(call.url).get('offset') === '50')));
  const nextPage = queryOf(listCalls().at(-1)!.url);
  assert.equal(nextPage.get('q'), 'Ghi');
  assert.equal(nextPage.get('pinned'), 'true');
  assert.equal(nextPage.get('labelId'), studyLabel.id);
  assert.equal(nextPage.get('sort'), 'title');
  await actor.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  await waitFor(() => {
    const cleared = queryOf(listCalls().at(-1)!.url);
    assert.equal(cleared.get('q'), null);
    assert.equal(cleared.get('pinned'), null);
    assert.equal(cleared.get('labelId'), null);
  });
  assert.equal(searchInput().value, '');
  assert.equal(screen.getByRole('button', { name: 'Chỉ ghi chú đã ghim' }).getAttribute('aria-pressed'), 'false');
});

test('pinning flushes pending text first, persists the new version and moves the card to the top', async () => {
  const state = organizationFixture();
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' }));
  await waitFor(() => assert.equal(contentInput().value, noteA.content));
  await actor.type(contentInput(), ' vừa nhập');
  await actor.click(screen.getByRole('button', { name: 'Ghim ghi chú' }));
  await screen.findByRole('button', { name: 'Bỏ ghim ghi chú' });
  const writes = calls.filter(call => call.method === 'PATCH');
  assert.equal(writes[0].url, '/api/notes/a');
  assert.equal(writes[1].url, '/api/notes/a/organization');
  assert.equal(JSON.parse(writes[1].body!).version, 2);
  assert.equal(state.notes.find(note => note.id === 'a')!.pinned, true);
  assert.equal(contentInput().value, `${noteA.content} vừa nhập`);
  const cards = screen.getAllByRole('button', { name: /^Mở ghi chú / });
  assert.equal(cards[0].getAttribute('aria-label'), `Mở ghi chú ${noteA.title}`);
  await actor.type(contentInput(), ' tiếp');
  await screen.findByText('Đã lưu', {}, { timeout: 2000 });
  const textWrites = calls.filter(call => call.method === 'PATCH' && call.url === '/api/notes/a');
  assert.equal(JSON.parse(textWrites.at(-1)!.body!).version, 3);
  await actor.click(screen.getByRole('button', { name: 'Bỏ ghim ghi chú' }));
  await screen.findByRole('button', { name: 'Ghim ghi chú' });
  assert.equal(state.notes.find(note => note.id === 'a')!.pinned, false);
});

test('failed autosave blocks pin mutation and retains the user draft', async () => {
  respond = (url, init) => init?.method === 'PATCH' ? json({ message: 'Máy chủ tạm ngừng.' }, 503)
    : url.includes('?') ? json(page([noteA])) : json({ note: noteA });
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' }));
  await waitFor(() => assert.equal(contentInput().value, noteA.content));
  await actor.type(contentInput(), ' cần giữ');
  await actor.click(screen.getByRole('button', { name: 'Ghim ghi chú' }));
  await screen.findByRole('button', { name: 'Thử kết nối và lưu lại' });
  assert.equal(calls.some(call => call.url.endsWith('/organization')), false);
  assert.equal(contentInput().value, `${noteA.content} cần giữ`);
  assert.equal(isDirty, true);
});

test('pinned cards stay before recently edited notes and the latest pin appears first', async () => {
  const olderPin = { ...noteA, pinned: true, pinnedAt: '2026-10-28T08:00:00Z' };
  const newerPin = { ...noteB, pinned: true, pinnedAt: '2026-10-29T08:00:00Z' };
  const recent = { ...noteA, id: 'c', title: 'Ghi chú C', updatedAt: '2026-10-29T14:00:00Z' };
  organizationFixture([recent, olderPin, newerPin]);
  mount();
  await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú C' });
  assert.deepEqual(screen.getAllByRole('button', { name: /^Mở ghi chú / }).map(card => card.getAttribute('aria-label')),
    ['Mở ghi chú Ghi chú B', 'Mở ghi chú Ghi chú A', 'Mở ghi chú Ghi chú C']);
});

test('labels can be attached and removed without replacing the note text', async () => {
  const state = organizationFixture();
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' }));
  await waitFor(() => assert.equal(contentInput().value, noteA.content));
  const labels = within(screen.getByRole('group', { name: 'Nhãn cho ghi chú' }));
  await actor.click(labels.getByRole('checkbox', { name: studyLabel.name }));
  await waitFor(() => assert.equal(labels.getByRole<HTMLInputElement>('checkbox', { name: studyLabel.name }).checked, true));
  assert.deepEqual(state.notes.find(note => note.id === 'a')!.labels.map(label => label.id), [studyLabel.id]);
  await actor.click(labels.getByRole('checkbox', { name: workLabel.name }));
  await waitFor(() => assert.equal(state.notes.find(note => note.id === 'a')!.labels.length, 2));
  await actor.click(labels.getByRole('checkbox', { name: studyLabel.name }));
  await waitFor(() => assert.equal(labels.getByRole<HTMLInputElement>('checkbox', { name: studyLabel.name }).checked, false));
  assert.deepEqual(state.notes.find(note => note.id === 'a')!.labels.map(label => label.id), [workLabel.id]);
  assert.equal(contentInput().value, noteA.content);
});

test('label management creates, renames and confirms deletion without deleting attached notes', async () => {
  const state = organizationFixture([{ ...noteA, labels: [studyLabel] }], [studyLabel]);
  mount();
  const actor = user();
  await actor.click(await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' }));
  await waitFor(() => assert.equal(contentInput().value, noteA.content));
  await actor.click(screen.getByRole('button', { name: 'Quản lý nhãn', expanded: false }));
  await actor.type(screen.getByLabelText('Tên nhãn'), 'Ý tưởng');
  await actor.click(screen.getByRole('button', { name: 'Tạo nhãn' }));
  await screen.findByRole('button', { name: 'Chỉnh sửa nhãn Ý tưởng' });
  assert.ok(state.labels.some(label => label.name === 'Ý tưởng'));
  await actor.click(screen.getByRole('button', { name: 'Chỉnh sửa nhãn Học tập' }));
  await actor.clear(screen.getByLabelText('Tên nhãn mới'));
  await actor.type(screen.getByLabelText('Tên nhãn mới'), 'Ôn thi');
  await actor.click(screen.getByRole('button', { name: 'Cập nhật nhãn' }));
  await screen.findByRole('button', { name: 'Chỉnh sửa nhãn Ôn thi' });
  assert.equal(state.notes[0].labels[0].name, 'Ôn thi');
  window.confirm = () => false;
  await actor.click(screen.getByRole('button', { name: 'Xóa nhãn Ôn thi' }));
  assert.equal(calls.some(call => call.method === 'DELETE'), false);
  window.confirm = () => true;
  await actor.click(screen.getByRole('button', { name: 'Xóa nhãn Ôn thi' }));
  await waitFor(() => assert.equal(screen.queryByRole('button', { name: 'Chỉnh sửa nhãn Ôn thi' }), null));
  assert.equal(state.notes.length, 1);
  assert.equal(state.notes[0].labels.length, 0);
  assert.equal(contentInput().value, noteA.content);
  await actor.type(contentInput(), ' sau sửa nhãn');
  await screen.findByText('Đã lưu', {}, { timeout: 2000 });
  assert.equal(state.notes[0].content, `${noteA.content} sau sửa nhãn`);
});

test('a saved note that stops matching the search leaves the cards but stays open for editing', async () => {
  const state = organizationFixture([noteA]);
  mount();
  const actor = user();
  await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' });
  await actor.type(searchInput(), 'Ghi chú A');
  await waitFor(() => assert.equal(queryOf(listCalls().at(-1)!.url).get('q'), 'Ghi chú A'));
  await actor.click(await screen.findByRole('button', { name: 'Mở ghi chú Ghi chú A' }));
  await waitFor(() => assert.equal(titleInput().value, noteA.title));
  await actor.clear(titleInput());
  await actor.type(titleInput(), 'Tên mới');
  await screen.findByText('Đã lưu', {}, { timeout: 2000 });
  assert.equal(state.notes[0].title, 'Tên mới');
  assert.equal(screen.queryByRole('button', { name: 'Mở ghi chú Tên mới' }), null);
  assert.equal(titleInput().value, 'Tên mới');
  assert.equal(contentInput().value, noteA.content);
});
