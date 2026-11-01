import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, ApiError } from '../api';

export function PasswordRecovery({ reset = false, onReset }: { reset?: boolean; onReset: () => void }) {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { document.title = `${reset ? 'Đặt lại' : 'Quên'} mật khẩu — Ghi chú`; }, [reset]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ message: string }>(reset ? '/auth/reset-password' : '/auth/forgot-password', reset ? { token, password, confirmPassword } : { email });
      setMessage(result.message);
      if (reset) { setPassword(''); setConfirmPassword(''); onReset(); }
    } catch (failure) {
      setError(failure instanceof ApiError ? [failure.message, ...Object.values(failure.fields)].join(' ') : (failure as Error).message);
    } finally { setBusy(false); }
  }
  return <main className="account-page"><section className="workspace-panel recovery-panel">
    <Link to="/login" className="brand">ghi chú.</Link>
    <h1>{reset ? 'Đặt lại mật khẩu' : 'Bạn quên mật khẩu?'}</h1>
    <p>{reset ? 'Nhập mật khẩu mới hai lần. Sau khi hoàn tất, bạn cần đăng nhập lại.' : 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.'}</p>
    {message && <p className="notice success" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!(reset && message) && <form onSubmit={submit} aria-busy={busy}>
      {reset ? <>
        <label>Mật khẩu mới<input name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
        <label>Nhập lại mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={busy} /></label>
      </> : <label>Email tài khoản<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>}
      <button className="primary-button" disabled={busy || (reset && !token)}>{busy ? 'Đang xử lý…' : reset ? 'Đặt lại mật khẩu' : 'Gửi liên kết đặt lại'}</button>
      {reset && !token && <p role="alert">Liên kết thiếu mã đặt lại. Hãy yêu cầu liên kết mới.</p>}
    </form>}
    <div className="account-links"><Link to="/login">Về đăng nhập</Link>{reset && <Link to="/forgot-password">Yêu cầu liên kết mới</Link>}</div>
  </section></main>;
}
