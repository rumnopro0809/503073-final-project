import { useRef, useState, type FormEvent } from 'react';
import { Camera } from 'lucide-react';
import { api, ApiError, type User } from '../api';
import { fileBase64 } from '../files';

export function ProfilePanel({ user, onUserChange, onClose, beforePasswordChange, onSignedOut }: {
  user: User; onUserChange: (user: User) => void; onClose: () => void;
  beforePasswordChange: () => Promise<boolean>; onSignedOut: () => void;
}) {
  const [name, setName] = useState(user.displayName);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); }
    catch (failure) { setError(failure instanceof ApiError ? [failure.message, ...Object.values(failure.fields)].join(' ') : (failure as Error).message); }
    finally { setBusy(false); }
  }
  function saveName(event: FormEvent) {
    event.preventDefault();
    void action(async () => { const result = await api<{ user: User }>('/auth/profile', { displayName: name }, { method: 'PATCH' }); onUserChange(result.user); setMessage('Đã cập nhật hồ sơ.'); });
  }
  function changePassword(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!await beforePasswordChange()) return;
      await api('/auth/change-password', { currentPassword, password, confirmPassword });
      onSignedOut();
    });
  }
  return <section className="workspace-panel profile-panel" aria-label="Hồ sơ tài khoản">
    <div className="panel-heading"><h2>Hồ sơ của bạn</h2><button className="quiet-button" type="button" onClick={onClose} disabled={busy}>Đóng hồ sơ</button></div>
    <div className="profile-identity"><button type="button" className="profile-avatar-button" aria-label="Đổi ảnh đại diện" title="Nhấn vào ảnh để đổi ảnh đại diện" disabled={busy} onClick={()=>avatarInput.current?.click()}>
      {user.avatarUrl ? <img className="profile-avatar" src={user.avatarUrl} alt={`Avatar của ${user.displayName}`} /> : <span className="profile-avatar avatar">{user.displayName.slice(0,1).toLocaleUpperCase('vi')}</span>}
      <span className="profile-avatar-camera" aria-hidden="true"><Camera size={14}/></span></button>
      <div><strong>{user.displayName}</strong><p>{user.email}</p><small>{user.emailVerified ? 'Email đã xác minh' : 'Email chưa xác minh'}</small><p className="profile-avatar-hint">Nhấn vào ảnh để đổi · PNG, JPEG, WebP · tối đa 2 MB.</p></div></div>
    <input ref={avatarInput} aria-label="Chọn tệp ảnh đại diện" type="file" hidden accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) void action(async () => { const data = await fileBase64(file, 2 * 1024 * 1024); const result = await api<{user:User}>('/auth/avatar', { data }); onUserChange(result.user); setMessage('Đã cập nhật ảnh đại diện.'); });
    }} />
    {user.avatarUrl && <button className="quiet-button" disabled={busy} onClick={() => void action(async () => { const result = await api<{user:User}>('/auth/avatar', {}, {method:'DELETE'}); onUserChange(result.user); setMessage('Đã dùng ảnh đại diện mặc định.'); })}>Dùng ảnh đại diện mặc định</button>}
    <form onSubmit={saveName}><label>Tên hiển thị<input name="displayName" required maxLength={80} autoComplete="nickname" value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label><button className="primary-button" disabled={busy}>Cập nhật hồ sơ</button></form>
    <h3>Đổi mật khẩu</h3><p>Thay đổi sẽ đăng xuất tất cả các phiên. Ghi chú đang nhập được lưu trước khi đổi.</p>
    <form onSubmit={changePassword}>
      <label>Mật khẩu hiện tại<input type="password" required autoComplete="current-password" value={currentPassword} disabled={busy} onChange={e => setCurrentPassword(e.target.value)} /></label>
      <label>Mật khẩu mới<input type="password" required minLength={8} autoComplete="new-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></label>
      <label>Nhập lại mật khẩu mới<input type="password" required autoComplete="new-password" value={confirmPassword} disabled={busy} onChange={e => setConfirmPassword(e.target.value)} /></label>
      <button className="primary-button" disabled={busy}>{busy ? 'Đang xử lý…' : 'Đổi mật khẩu và đăng xuất'}</button>
    </form>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice success" role="status">{message}</p>}
  </section>;
}
