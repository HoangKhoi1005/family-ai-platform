'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { captureInvite, explain, request } from './api';
import s from './connected.module.css';

type Mode = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';
const titles: Record<Mode, string> = {
  login: 'Mừng bạn về nhà.',
  register: 'Bắt đầu từ một lời chào.',
  'verify-email': 'Mở thư, rồi về nhà.',
  'forgot-password': 'Mình đặt lại mật khẩu nhé.',
  'reset-password': 'Một mật khẩu mới.',
};
export function AuthScreen({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const [token, setToken] = useState('');
  useEffect(() => {
    captureInvite();
    const params = new URLSearchParams(window.location.search);
    if (mode === 'reset-password') {
      // Hydrate a one-use token from the browser URL, then remove it from history.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(params.get('token') ?? '');
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (params.has('error'))
      setError('Liên kết đã hết hạn hoặc không hợp lệ. Bạn có thể yêu cầu thư mới.');
    if (params.get('verified') === '1')
      setMessage('Bạn đã mở liên kết xác minh. Đăng nhập để tiếp tục; máy chủ sẽ kiểm tra email.');
  }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password') ?? '');
    try {
      if (mode === 'login') {
        await request('/api/auth/sign-in/email', { email, password });
        window.location.assign('/app');
      } else if (mode === 'register') {
        await request('/api/auth/sign-up/email', {
          email,
          password,
          name: String(values.get('name')),
          callbackURL: window.location.origin + '/login?verified=1',
        });
        window.location.assign('/verify-email');
      } else if (mode === 'verify-email') {
        await request('/api/auth/send-verification-email', {
          email,
          callbackURL: window.location.origin + '/login?verified=1',
        });
        setMessage(
          'Nếu tài khoản cần xác minh, thư sẽ được gửi tới email này. Kiểm tra cả thư rác nhé.',
        );
      } else if (mode === 'forgot-password') {
        await request('/api/auth/request-password-reset', {
          email,
          redirectTo: window.location.origin + '/reset-password',
        });
        setMessage('Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.');
      } else {
        if (!token) {
          setError('Thiếu liên kết đặt lại mật khẩu. Hãy yêu cầu thư mới.');
          return;
        }
        if (password !== values.get('confirmation')) {
          setError('Hai mật khẩu chưa giống nhau.');
          return;
        }
        await request('/api/auth/reset-password', { token, newPassword: password });
        setToken('');
        setMessage('Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.');
      }
    } catch (error) {
      setError(explain(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className={s.shell}>
      <header className={s.brand}>
        <Link href="/login">
          nhà<span>mình.</span>
        </Link>
        <span>Không gian riêng của gia đình</span>
      </header>
      <div className={s.authLayout}>
        <aside className={s.welcome}>
          <span>BIẾT NHAU · KẾT NỐI · LƯU GIỮ</span>
          <h2>
            Một nơi
            <br />
            để trở về.
          </h2>
          <p>
            Những người thân quen.
            <br />
            Những câu chuyện còn mãi.
          </p>
          <div className={s.familyDrawing} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </aside>
        <section className={s.authForm}>
          <p className={s.eyebrow}>
            NHÀ MÌNH / {mode === 'register' ? 'TẠO TÀI KHOẢN' : 'CHÀO BẠN'}
          </p>
          <h1>{titles[mode]}</h1>
          {mode === 'verify-email' && (
            <p>
              Mở liên kết trong email xác minh, rồi đăng nhập. Chưa thấy thư? Nhập email để gửi lại.
            </p>
          )}
          {mode === 'register' && (
            <p>Bạn cần lời mời và quản trị viên duyệt để xem thông tin gia đình.</p>
          )}
          <form onSubmit={submit} className={s.form}>
            {mode === 'register' && (
              <label>
                Tên của bạn
                <input name="name" autoComplete="name" required maxLength={120} />
              </label>
            )}
            {mode !== 'reset-password' && (
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                />
              </label>
            )}
            {['login', 'register', 'reset-password'].includes(mode) && (
              <>
                <label>
                  Mật khẩu
                  <input
                    name="password"
                    type={show ? 'text' : 'password'}
                    required
                    minLength={mode === 'login' ? 1 : 12}
                    maxLength={128}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </label>
                <label className={s.checkbox}>
                  <input
                    type="checkbox"
                    checked={show}
                    onChange={(e) => setShow(e.target.checked)}
                  />
                  Hiện mật khẩu
                </label>
                {mode !== 'login' && (
                  <small>Từ 12 đến 128 ký tự. Nên dùng một cụm từ dễ nhớ với bạn.</small>
                )}
              </>
            )}
            {mode === 'reset-password' && (
              <label>
                Nhập lại mật khẩu
                <input
                  name="confirmation"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </label>
            )}
            {error && (
              <p role="alert" className={s.error}>
                {error}
              </p>
            )}
            {message && (
              <p role="status" className={s.success}>
                {message}
              </p>
            )}
            <button className={s.primary} disabled={busy || (mode === 'reset-password' && !token)}>
              {busy
                ? 'Đang xử lý…'
                : mode === 'login'
                  ? 'Vào nhà →'
                  : mode === 'register'
                    ? 'Tạo tài khoản →'
                    : mode === 'verify-email'
                      ? 'Gửi lại thư xác minh'
                      : mode === 'forgot-password'
                        ? 'Gửi liên kết đặt lại'
                        : 'Lưu mật khẩu mới'}
            </button>
          </form>
          <nav className={s.authLinks} aria-label="Trợ giúp đăng nhập">
            {mode === 'login' ? (
              <>
                <Link href="/forgot-password">Quên mật khẩu?</Link>
                <Link href="/register">Chưa có tài khoản? Đăng ký</Link>
                <Link href="/verify-email">Gửi lại thư xác minh</Link>
              </>
            ) : (
              <>
                <Link href="/login">Về đăng nhập</Link>
                {mode === 'reset-password' && (
                  <Link href="/forgot-password">Yêu cầu liên kết mới</Link>
                )}
              </>
            )}
          </nav>
        </section>
      </div>
    </main>
  );
}
