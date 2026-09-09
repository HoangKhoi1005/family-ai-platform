'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { request, explain } from './api';
import type { AdminMembership, Member } from './types';
import { RelationshipAdmin } from './relationship-admin';
import s from './connected.module.css';

export function AdminPanel({
  base,
  members,
  onRefresh,
  onError,
}: {
  base: string;
  members: Member[];
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [rows, setRows] = useState<AdminMembership[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState<{ id: string; version: number; url: string } | null>(
    null,
  );
  const [revoke, setRevoke] = useState<AdminMembership | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await request<{ memberships: AdminMembership[] }>(base + '/memberships');
      setRows(result.memberships);
    } catch (error) {
      setError(explain(error));
      onError(error);
    }
  }, [base, onError]);
  useEffect(() => {
    // load awaits the server; no derived local state is recomputed here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function action(job: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await job();
      setMessage(message);
      await load();
      await onRefresh();
    } catch (error) {
      setError(explain(error));
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  async function createPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await action(async () => {
      await request(base + '/members', { display_name: String(data.get('name')).trim() });
      form.reset();
    }, 'Đã thêm hồ sơ. Bạn có thể chỉ định hồ sơ bên dưới.');
  }
  return (
    <section className={s.content}>
      <p className={s.eyebrow}>CÙNG CHĂM LO NHÀ MÌNH</p>
      <h1>Đón người thân vào nhà.</h1>
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
      <section className={s.adminSection}>
        <h2>1. Tạo lời mời</h2>
        <p>Mỗi lời mời dành cho một lần nhận. Bạn tự chia sẻ link cho đúng người thân.</p>
        <button
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const result = await request<{ id: string; token: string; version: number }>(
                base + '/invitations',
                {},
              );
              setInvitation({
                id: result.id,
                version: result.version,
                url: window.location.origin + '/login#invite=' + encodeURIComponent(result.token),
              });
            }, 'Đã tạo lời mời. Link chỉ hiển thị trong phiên này.')
          }
        >
          Tạo link lời mời
        </button>
        {invitation && (
          <>
            <label>
              Link lời mời
              <input readOnly value={invitation.url} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(invitation.url)
                  .then(() => setMessage('Đã sao chép link.'))
                  .catch(() => setMessage('Bạn có thể chọn và sao chép link trong ô phía trên.'))
              }
            >
              Sao chép link
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await request(base + '/invitations/' + invitation.id + '/revoke', {
                    version: invitation.version,
                  });
                  setInvitation(null);
                }, 'Đã thu hồi lời mời.')
              }
            >
              Thu hồi lời mời này
            </button>
          </>
        )}
      </section>
      <section className={s.adminSection}>
        <h2>2. Xác nhận người vào nhà</h2>
        <button onClick={() => void load()}>Tải lại danh sách</button>
        {rows.map((row) => (
          <div className={s.approvalRow} key={row.id}>
            <div>
              <strong>{row.user.name ?? 'Tài khoản chưa có tên'}</strong>
              <p>
                {row.status === 'pending'
                  ? 'Chờ duyệt'
                  : row.status === 'active'
                    ? 'Đã vào nhà'
                    : 'Đã thu hồi'}{' '}
                · {row.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
              </p>
            </div>
            {row.status === 'pending' && (
              <button
                disabled={busy}
                onClick={() =>
                  void action(
                    () =>
                      request(base + '/memberships/' + row.id + '/approve', {
                        version: row.version,
                      }),
                    'Đã duyệt thành viên.',
                  )
                }
              >
                Duyệt vào nhà
              </button>
            )}
            {row.status !== 'revoked' && (
              <button disabled={busy} onClick={() => setRevoke(row)}>
                Thu hồi quyền
              </button>
            )}
          </div>
        ))}
        {revoke && (
          <div className={s.invitation}>
            <p>
              Thu hồi quyền vào nhà của {revoke.user.name}? Họ sẽ không thể tiếp tục xem dữ liệu
              nhà.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await request(base + '/memberships/' + revoke.id + '/revoke', {
                    version: revoke.version,
                  });
                  setRevoke(null);
                }, 'Đã thu hồi quyền.')
              }
            >
              Xác nhận thu hồi
            </button>
            <button onClick={() => setRevoke(null)}>Hủy</button>
          </div>
        )}
      </section>
      <section className={s.adminSection}>
        <h2>3. Chuẩn bị hồ sơ</h2>
        <form onSubmit={createPerson} className={s.form}>
          <label>
            Tên người chưa có trong danh bạ
            <input name="name" required maxLength={120} />
          </label>
          <button disabled={busy}>Thêm hồ sơ mới</button>
        </form>
        <p>Kiểm tra danh bạ trước để tránh tạo trùng người.</p>
      </section>
      <section className={s.adminSection}>
        <h2>4. Chỉ định hồ sơ cho người đã vào nhà</h2>
        <form
          className={s.form}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void action(
              () =>
                request(base + '/member-claims', {
                  membership_id: String(data.get('membership')),
                  member_id: String(data.get('member')),
                }),
              'Đã chỉ định. Người nhận mở Hồ sơ của tôi để xác nhận.',
            );
          }}
        >
          <label>
            Tài khoản
            <select name="membership" aria-label="Tài khoản" required defaultValue="">
              <option value="" disabled>
                Chọn người đã được duyệt
              </option>
              {rows
                .filter((r) => r.status === 'active')
                .map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.user.name ?? row.id}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Hồ sơ tương ứng
            <select name="member" aria-label="Hồ sơ tương ứng" required defaultValue="">
              <option value="" disabled>
                Chọn đúng hồ sơ
              </option>
              {members.map((member) => (
                <option value={member.id} key={member.id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </label>
          <button className={s.primary} disabled={busy}>
            Gửi hồ sơ để người nhận xác nhận
          </button>
        </form>
        <p>
          Hồ sơ đã liên kết hoặc đang được chỉ định sẽ được máy chủ kiểm tra; không ghi đè liên kết
          đã có.
        </p>
      </section>
      <RelationshipAdmin base={base} members={members} onRefresh={onRefresh} />
    </section>
  );
}
