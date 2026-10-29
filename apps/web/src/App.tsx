import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, LogOut, Mail, ShieldCheck, Sparkles, StickyNote, UserRound } from 'lucide-react';
import { api, ApiError, type User } from './api';
import { NotesWorkspace } from './components/NotesWorkspace';

function Brand() {
  return <div className="brand"><span className="brand-mark"><StickyNote size={23} strokeWidth={1.9} /></span><span>ghi chú<span className="brand-dot">.</span></span></div>;
}

function Story() {
  return <aside className="story">
    <Brand />
    <div className="story-body">
      <div className="eyebrow"><span /> MỘT CHÚT NGĂN NẮP, MỖI NGÀY</div>
      <h1>Gom ý tưởng.<br />Giữ điều<br /><em>quan trọng.</em></h1>
      <p>Một nơi yên tĩnh cho những ý tưởng bất chợt,<br className="desktop-break" /> bài học mới và những điều bạn muốn nhớ.</p>
      <div className="note-scene" aria-hidden="true">
        <div className="paper paper-back"><span className="paper-kicker">Ý TƯỞNG NHỎ</span><div className="paper-line" /><div className="paper-line short" /></div>
        <div className="paper paper-main"><span className="paper-tape" /><div className="paper-heading"><span>Cho một ngày rõ ràng hơn</span><Sparkles size={19} /></div>
          <p><span className="tiny-check"><Check size={11} /></span> Ghi lại điều vừa nghĩ đến</p>
          <p><span className="tiny-check"><Check size={11} /></span> Dành chỗ cho ý tưởng mới</p>
          <p><span className="tiny-box" /> Bắt đầu từ một ghi chú</p>
          <div className="paper-footer"><span>mỗi ngày một chút</span><span>✳</span></div>
        </div>
        <div className="floating-note"><span>Đừng để ý tưởng<br />hay trôi mất.</span><span className="drawn-arrow">↗</span></div>
      </div>
    </div>
    <div className="story-foot"><span className="foot-line" /> KHÔNG GIAN RIÊNG CHO SUY NGHĨ CỦA BẠN</div>
  </aside>;
}

function Field({ label, name, value, onChange, error, type = 'text', autoComplete, placeholder, disabled, hint }: {
  label: string; name: string; value: string; onChange: (value: string) => void; error?: string;
  type?: string; autoComplete?: string; placeholder: string; disabled: boolean; hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const password = type === 'password';
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className={`input-wrap ${error ? 'invalid' : ''}`}>
      <input id={id} name={name} value={value} onChange={e => onChange(e.target.value)}
        type={password && visible ? 'text' : type} autoComplete={autoComplete} placeholder={placeholder}
        disabled={disabled} required aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-help` : undefined}
        maxLength={name === 'displayName' ? 80 : name === 'email' ? 254 : undefined} />
      {password && <button type="button" className="reveal" onClick={() => setVisible(!visible)} aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} aria-pressed={visible} disabled={disabled}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
    </div>
    {(error || hint) && <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>{error || hint}</p>}
  </div>;
}

function AuthPage({ mode, onAuthenticated, reauthEmail }: { mode: 'login' | 'register'; onAuthenticated: (user: User, delivery?: string) => void; reauthEmail?: string }) {
  const register = mode === 'register';
  const [values, setValues] = useState({ email: reauthEmail ?? '', displayName: '', password: '', confirmPassword: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const verification = new URLSearchParams(location.search).get('verification');

  useEffect(() => { document.title = `${register ? 'Đăng ký' : 'Đăng nhập'} — Ghi chú`; }, [register]);
  function update(name: keyof typeof values, value: string) {
    setValues(current => ({ ...current, [name]: value }));
    setFields(current => ({ ...current, [name]: '' }));
    setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Nhập địa chỉ email hợp lệ.';
    if (register && !values.displayName.trim()) next.displayName = 'Bạn muốn được gọi là gì?';
    if (!values.password) next.password = 'Bạn chưa nhập mật khẩu.';
    if (register && (values.password.length < 8 || new TextEncoder().encode(values.password).length > 72)) next.password = 'Dùng ít nhất 8 ký tự, tối đa 72 byte.';
    if (register && values.confirmPassword !== values.password) next.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
    setFields(next);
    if (Object.keys(next).length) { setError('Bạn kiểm tra lại các trường được đánh dấu nhé.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api<{ user: User; emailDelivery?: string }>(`/auth/${mode}`, register ? values : { email: values.email, password: values.password });
      onAuthenticated(result.user, result.emailDelivery);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa thể hoàn tất yêu cầu.');
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally { setBusy(false); }
  }

  return <main className="auth-layout">
    <Story />
    <section className="auth-side" aria-label={register ? 'Đăng ký tài khoản' : 'Đăng nhập tài khoản'}>
      <div className="auth-top"><span>BẠN VÀ NHỮNG Ý TƯỞNG</span><span className="top-flower">✳</span></div>
      <div className="auth-card">
        {!reauthEmail && <div className="switcher" aria-label="Chọn đăng nhập hoặc đăng ký">
          <Link to="/login" className={!register ? 'active' : ''} aria-current={!register ? 'page' : undefined}>Đăng nhập</Link>
          <Link to="/register" className={register ? 'active' : ''} aria-current={register ? 'page' : undefined}>Đăng ký</Link>
        </div>}
        <div className="form-heading"><span className="welcome-icon">{register ? <Sparkles size={22} /> : <UserRound size={22} />}</span>
          <h2>{reauthEmail ? 'Đăng nhập lại.' : register ? 'Một khởi đầu mới.' : 'Chào bạn trở lại.'}</h2>
          <p>{reauthEmail ? 'Phiên đã hết hạn. Bản nháp đang được giữ trên trang; đăng nhập lại để tiếp tục tự lưu.' : register ? 'Tạo tài khoản, dành một góc nhỏ cho ý tưởng của bạn.' : 'Đăng nhập để trở về với những ghi chú của bạn.'}</p>
        </div>
        {verification === 'invalid' && <div className="notice error" role="alert">Liên kết xác minh không hợp lệ hoặc đã hết hạn. Đăng nhập để yêu cầu một email mới.</div>}
        {verification === 'success' && <div className="notice success" role="status">Tài khoản đã được xác minh. Bạn đăng nhập để tiếp tục nhé.</div>}
        <form onSubmit={submit} noValidate aria-busy={busy}>
          {register && <Field label="Tên hiển thị" name="displayName" value={values.displayName} onChange={v => update('displayName', v)} error={fields.displayName} placeholder="Tên bạn muốn mọi người gọi" autoComplete="nickname" disabled={busy} />}
          <Field label="Email" name="email" value={values.email} onChange={v => update('email', v)} error={fields.email} type="email" placeholder="ban@example.com" autoComplete="email" disabled={busy || Boolean(reauthEmail)} />
          <Field label="Mật khẩu" name="password" value={values.password} onChange={v => update('password', v)} error={fields.password} type="password" placeholder={register ? 'Tạo mật khẩu của bạn' : 'Nhập mật khẩu của bạn'} autoComplete={register ? 'new-password' : 'current-password'} hint={register ? 'Ít nhất 8 ký tự.' : undefined} disabled={busy} />
          {register && <Field label="Nhập lại mật khẩu" name="confirmPassword" value={values.confirmPassword} onChange={v => update('confirmPassword', v)} error={fields.confirmPassword} type="password" placeholder="Nhập lại mật khẩu vừa tạo" autoComplete="new-password" disabled={busy} />}
          {error && <div className="notice error" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? <><LoaderCircle className="spin" size={18} /> Đang xử lý…</> : <>{register ? 'Tạo tài khoản' : 'Đăng nhập'}<ArrowRight size={18} /></>}
          </button>
        </form>
        {!reauthEmail && <p className="account-prompt">{register ? 'Đã có một góc riêng?' : 'Bạn chưa có tài khoản?'} <Link to={register ? '/login' : '/register'}>{register ? 'Đăng nhập' : 'Tạo tài khoản'} <ArrowRight size={13} /></Link></p>}
        <div className="form-assurance"><ShieldCheck size={15} /><span>Không gian của bạn, chỉ bạn mới có thể truy cập.</span></div>
      </div>
      <footer className="auth-bottom"><span>© {new Date().getFullYear()} ghi chú.</span><span>Viết xuống. Nhẹ đầu hơn.</span></footer>
    </section>
  </main>;
}

function Home({ user, onLogout, onSessionExpired, emailFailed, authenticationRevision }: {
  user: User; onLogout: () => void; onSessionExpired: () => void; emailFailed: boolean; authenticationRevision: number;
}) {
  const [draftDirty, setDraftDirty] = useState(false);
  const beforeLeaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => { document.title = 'Ghi chú của bạn — Ghi chú'; }, []);
  async function logout() {
    if (beforeLeaveRef.current) { if (!await beforeLeaveRef.current()) return; }
    else if (draftDirty && !window.confirm('Bản nháp chưa được lưu. Bạn có muốn bỏ thay đổi và đăng xuất?')) return;
    setBusy(true); setError('');
    try { await api('/auth/logout', {}); onLogout(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function resend() {
    setResending(true); setMessage(''); setError('');
    try { const result = await api<{ message: string }>('/auth/resend-verification', {}); setMessage(result.message); }
    catch (failure) { setError((failure as Error).message); }
    finally { setResending(false); }
  }
  return <div className="workspace">
    <header className="workspace-header"><Brand /><div className="account-bar"><span className="avatar">{user.displayName.slice(0, 1).toLocaleUpperCase('vi')}</span><span className="account-name">{user.displayName}</span><button className="quiet-button" onClick={logout} disabled={busy}><LogOut size={17} />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div></header>
    <main className="workspace-main">
      {!user.emailVerified && <div className="verification-banner"><Mail size={21} /><div><strong>Tài khoản của bạn chưa được xác minh</strong><p>{emailFailed ? 'Chưa gửi được email xác minh. Bạn có thể yêu cầu gửi lại.' : <>Kiểm tra hộp thư <b>{user.email}</b> và mở liên kết xác minh. Bạn vẫn có thể sử dụng ứng dụng.</>}</p></div><button className="text-button" onClick={resend} disabled={resending}>{resending ? 'Đang gửi…' : 'Gửi lại email'}</button></div>}
      {user.emailVerified && new URLSearchParams(location.search).get('verification') === 'success' && <div className="notice success" role="status"><CheckCircle2 size={18} /> Email đã được xác minh thành công.</div>}
      {new URLSearchParams(location.search).get('verification') === 'invalid' && <div className="notice error" role="alert">Liên kết xác minh không hợp lệ hoặc đã hết hạn. Nếu tài khoản chưa được xác minh, bạn có thể yêu cầu gửi lại email.</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {message && <div className="notice success" role="status">{message}</div>}
      <div className="workspace-intro"><span className="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Ghi chú của bạn<span>.</span></h1><p>Chào {user.displayName}, hôm nay bạn muốn ghi nhớ điều gì?</p></div>
      <NotesWorkspace onSessionExpired={onSessionExpired} onDirtyChange={setDraftDirty}
        authenticationRevision={authenticationRevision} beforeLeaveRef={beforeLeaveRef} />
    </main>
    <footer className="workspace-footer">Một chút ngăn nắp, mỗi ngày.</footer>
  </div>;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [emailFailed, setEmailFailed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authenticationRevision, setAuthenticationRevision] = useState(0);
  const requireAuthentication = useCallback(() => { setSessionExpired(true); }, []);
  const clearSession = useCallback(() => { setUser(null); setEmailFailed(false); setSessionExpired(false); }, []);
  async function refresh(initial = false) {
    try { const result = await api<{ user: User }>('/auth/me'); setUser(result.user); setConnectionError(''); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (user) setSessionExpired(true); else setUser(null);
        setConnectionError('');
      }
      else if (initial) setConnectionError((error as Error).message);
    } finally { if (initial) setLoading(false); }
  }
  useEffect(() => {
    void refresh(true);
  }, []);
  useEffect(() => {
    if (!user) return;
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id]);
  if (loading || connectionError) return <main className="loading-screen"><Brand />{loading ? <><LoaderCircle className="spin" /><p>Đang mở không gian của bạn…</p></> : <><p role="alert">{connectionError}</p><button className="primary-button" onClick={() => { setLoading(true); setConnectionError(''); void refresh(true); }}>Thử kết nối lại <ArrowRight size={16} /></button></>}</main>;
  const onAuthenticated = (next: User, delivery?: string) => {
    setUser(next); setEmailFailed(delivery === 'failed'); setSessionExpired(false); setAuthenticationRevision(value => value + 1);
  };
  return <><div hidden={sessionExpired}><Routes>
    <Route path="/login" element={user ? <Navigate to={`/${window.location.search}`} replace /> : <AuthPage key="login" mode="login" onAuthenticated={onAuthenticated} />} />
    <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage key="register" mode="register" onAuthenticated={onAuthenticated} />} />
    <Route path="/" element={user ? <Home key={user.id} user={user} emailFailed={emailFailed} onLogout={clearSession}
      onSessionExpired={requireAuthentication} authenticationRevision={authenticationRevision} /> : <Navigate to={`/login${window.location.search}`} replace />} />
    <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
  </Routes></div>{sessionExpired && user && <AuthPage key="reauthenticate" mode="login" reauthEmail={user.email} onAuthenticated={onAuthenticated} />}</>;
}
