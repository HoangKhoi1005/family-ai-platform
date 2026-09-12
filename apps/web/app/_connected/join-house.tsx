'use client';

import { useState, type FormEvent } from 'react';
import s from './join-house.module.css';

interface JoinHouseProps {
  userName: string;
  email: string;
  invitation: string;
  pending: boolean;
  revoked: boolean;
  busy: boolean;
  lastCheckedAt: Date | null;
  onPrepareInvitation: (value: string) => boolean;
  onAcceptInvitation: () => void;
  onClearInvitation: () => void;
  onRefresh: () => void;
}

const invitationHelp =
  'Chào mọi người, gửi cho mình link mời vào Nhà mình nhé. Mình đã tạo tài khoản và sẵn sàng tham gia. Cảm ơn cả nhà.';

export function JoinHouse({
  userName,
  email,
  invitation,
  pending,
  revoked,
  busy,
  lastCheckedAt,
  onPrepareInvitation,
  onAcceptInvitation,
  onClearInvitation,
  onRefresh,
}: JoinHouseProps) {
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState('');

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onPrepareInvitation(input)) {
      setFeedback('Link hoặc mã mời chưa đúng. Hãy dán lại toàn bộ nội dung người thân đã gửi.');
      return;
    }
    setFeedback('');
    setInput('');
  }

  async function copyHelp() {
    try {
      await navigator.clipboard.writeText(invitationHelp);
      setFeedback('Đã sao chép lời nhắn. Bạn có thể gửi vào nhóm chat của gia đình.');
    } catch {
      setFeedback('Chưa sao chép được. Bạn có thể nhờ người thân gửi lại link mời.');
    }
  }

  if (pending) {
    return (
      <section className={s.page} aria-labelledby="join-house-title">
        <header className={s.intro}>
          <p className={s.eyebrow}>ĐANG CHỜ DUYỆT</p>
          <h1 id="join-house-title">Nhà mình đang xác nhận bạn.</h1>
          <p className={s.lead}>
            Lời mời đã được nhận. Quản trị viên cần xác nhận trước khi thông tin riêng của gia đình
            được mở.
          </p>
        </header>
        <div className={s.waitingLayout}>
          <ol className={s.steps} aria-label="Tiến trình tham gia nhà">
            <li data-complete="true">
              <span aria-hidden="true">1</span>
              <div>
                <strong>Tài khoản đã xác minh</strong>
                <small>Bạn đang dùng {email}</small>
              </div>
            </li>
            <li data-complete="true">
              <span aria-hidden="true">2</span>
              <div>
                <strong>Lời mời đã nhận</strong>
                <small>Yêu cầu tham gia đã được chuyển đến nhà.</small>
              </div>
            </li>
            <li aria-current="step">
              <span aria-hidden="true">3</span>
              <div>
                <strong>Chờ quản trị viên duyệt</strong>
                <small>Trang sẽ tự kiểm tra khi bạn quay lại.</small>
              </div>
            </li>
          </ol>
          <aside className={s.waitingAction}>
            <p>
              Lần kiểm tra gần nhất{' '}
              <strong>
                {lastCheckedAt
                  ? lastCheckedAt.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'vừa xong'}
              </strong>
            </p>
            <button type="button" onClick={onRefresh} disabled={busy}>
              {busy ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái'}
            </button>
          </aside>
        </div>
      </section>
    );
  }

  if (invitation) {
    return (
      <section className={s.page} aria-labelledby="join-house-title">
        <header className={s.intro}>
          <p className={s.eyebrow}>LỜI MỜI ĐÃ SẴN SÀNG</p>
          <h1 id="join-house-title">Bạn đang vào Nhà mình.</h1>
          <p className={s.lead}>
            Lời mời sẽ được nhận bằng tài khoản <strong>{email}</strong>. Quản trị viên sẽ xác nhận
            trước khi bạn xem thông tin gia đình.
          </p>
        </header>
        <div className={s.review}>
          <p>
            Vì quyền riêng tư, tên nhà và danh sách người thân chỉ hiện sau khi yêu cầu của bạn được
            duyệt.
          </p>
          <div className={s.actions}>
            <button
              className={s.primary}
              type="button"
              onClick={onAcceptInvitation}
              disabled={busy}
            >
              {busy ? 'Đang gửi…' : 'Nhận lời mời'}
            </button>
            <button type="button" onClick={onClearInvitation} disabled={busy}>
              Dùng lời mời khác
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={s.page} aria-labelledby="join-house-title">
      <header className={s.intro}>
        <p className={s.eyebrow}>
          {revoked ? 'QUYỀN TRUY CẬP' : `CHÀO ${userName.toLocaleUpperCase('vi')}`}
        </p>
        <h1 id="join-house-title">
          {revoked ? 'Quyền vào nhà đã được thu hồi.' : 'Một lời mời là đủ để về nhà.'}
        </h1>
        <p className={s.lead}>
          {revoked
            ? 'Lời mời cũ không còn mở lại quyền truy cập. Hãy liên hệ quản trị viên nếu bạn cần tham gia lại.'
            : 'Nhà mình là không gian riêng. Bạn cần link do một người quản trị trong gia đình gửi để bắt đầu.'}
        </p>
      </header>
      <div className={s.entryLayout}>
        <form className={s.invitationForm} onSubmit={prepare}>
          <label htmlFor="invitation-input">Link hoặc mã mời</label>
          <p id="invitation-help">Dán nguyên link nhận được qua tin nhắn hoặc email.</p>
          <input
            id="invitation-input"
            aria-describedby="invitation-help"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setFeedback('');
            }}
            autoComplete="off"
            inputMode="url"
            placeholder="Dán link mời tại đây"
          />
          <button className={s.primary} type="submit" disabled={!input.trim()}>
            Xem lời mời
          </button>
        </form>
        <aside className={s.help}>
          <p className={s.eyebrow}>CHƯA CÓ LỜI MỜI?</p>
          <h2>Nhờ một người trong nhà gửi giúp.</h2>
          <p>Sao chép lời nhắn ngắn dưới đây rồi gửi vào nhóm chat gia đình.</p>
          <button type="button" onClick={() => void copyHelp()}>
            Sao chép lời nhắn xin mời
          </button>
          <small>Bạn chưa thể xem tên nhà, thành viên hoặc ảnh trước khi được duyệt.</small>
        </aside>
      </div>
      {feedback && (
        <p className={s.feedback} role="status" aria-live="polite">
          {feedback}
        </p>
      )}
    </section>
  );
}
