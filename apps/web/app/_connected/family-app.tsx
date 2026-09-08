'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { captureInvite, clearInvite, pendingInvite, request, explain, RequestError } from './api';
import type { Me, Onboarding, Member } from './types';
import { ProfilePanel } from './profile-panel';
import { AdminPanel } from './admin-panel';
import s from './connected.module.css';

export function FamilyApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [familyId, setFamilyId] = useState('');
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<'home' | 'profile' | 'directory' | 'admin'>('home');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const clearFamily = useCallback(() => {
    setOnboarding(null);
    setMembers([]);
    setRevision((value) => value + 1);
  }, []);
  const fail = useCallback(
    (error: unknown) => {
      setError(explain(error));
      if (error instanceof RequestError && [401, 403].includes(error.status)) {
        sequence.current++;
        clearFamily();
        setMe(null);
        if (error.status === 401) window.location.replace('/login');
      }
    },
    [clearFamily],
  );
  const refresh = useCallback(async () => {
    const run = ++sequence.current;
    try {
      const next = await request<Me>('/api/v1/me');
      const active =
        next.memberships.find((m) => m.status === 'active' && m.family_id === familyId) ??
        next.memberships.find((m) => m.status === 'active');
      if (!active?.family_id) {
        if (run === sequence.current) {
          setMe(next);
          clearFamily();
          setError('');
        }
        return;
      }
      const base = '/api/v1/families/' + active.family_id;
      const [state, list] = await Promise.all([
        request<Onboarding>(base + '/onboarding'),
        request<{ members: Member[] }>(base + '/members?limit=100'),
      ]);
      if (run !== sequence.current) return;
      setFamilyId(active.family_id);
      setOnboarding(state);
      setMembers(list.members);
      setMe(next);
      setError('');
    } catch (error) {
      if (run === sequence.current) {
        clearFamily();
        setMe(null);
        fail(error);
      }
    } finally {
      if (run === sequence.current) setLoading(false);
    }
  }, [familyId, clearFamily, fail]);
  useEffect(() => {
    const requestSequence = sequence;
    captureInvite();
    // The pending invite is external per-tab browser state, unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvite(pendingInvite());
    void refresh();
    const check = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = setInterval(check, 15000);
    window.addEventListener('focus', check);
    return () => {
      requestSequence.current++;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [refresh]);
  async function logout() {
    setBusy(true);
    try {
      await request('/api/auth/sign-out', {});
      sequence.current++;
      clearFamily();
      setMe(null);
      clearInvite();
      window.location.replace('/login');
    } catch (error) {
      fail(error);
      setBusy(false);
    }
  }
  async function accept() {
    setBusy(true);
    setError('');
    try {
      await request('/api/v1/invitations/accept', { token: invite });
      clearInvite();
      setInvite('');
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  const active = me?.memberships.find((m) => m.status === 'active' && m.family_id === familyId);
  const pending = me?.memberships.some((m) => m.status === 'pending');
  const own = members.find((member) => member.id === onboarding?.member_id);
  const base = '/api/v1/families/' + familyId;
  return (
    <main id="main" className={s.shell}>
      <header className={s.brand}>
        <Link href="/app">
          nhà<span>mình.</span>
        </Link>
        <span>{active?.name ?? 'Không gian riêng của gia đình'}</span>
        {me && (
          <button onClick={logout} disabled={busy}>
            Đăng xuất
          </button>
        )}
      </header>
      {error && (
        <div role="alert" className={s.error}>
          {error}
          <button onClick={() => void refresh()}>Thử lại</button>
        </div>
      )}
      {loading ? (
        <p role="status" className={s.content}>
          Đang mở cửa nhà…
        </p>
      ) : !me ? (
        <section className={s.content}>
          <h1>Chưa kết nối được với nhà.</h1>
          <button onClick={() => void refresh()}>Thử lại</button>
          <Link href="/login">Về đăng nhập</Link>
        </section>
      ) : (
        <>
          {invite && (
            <section className={s.invitation}>
              <p className={s.eyebrow}>BẠN CÓ LỜI MỜI</p>
              <h2>Thêm một người, thêm chuyện nhà.</h2>
              <p>
                Nhận lời mời bằng tài khoản {me.user.email}. Quản trị viên sẽ xác nhận trước khi bạn
                xem thông tin nhà.
              </p>
              <button className={s.primary} onClick={accept} disabled={busy}>
                {busy ? 'Đang gửi…' : 'Nhận lời mời'}
              </button>
              <button
                onClick={() => {
                  clearInvite();
                  setInvite('');
                }}
              >
                Để sau
              </button>
            </section>
          )}
          {!active || !onboarding ? (
            <section className={s.content}>
              <p className={s.eyebrow}>CHÀO {me.user.name}</p>
              <h1>{pending ? 'Chờ nhà mình đón bạn.' : 'Bạn chưa tham gia nhà nào.'}</h1>
              <p>
                {pending
                  ? 'Yêu cầu đã được gửi. Quản trị viên cần duyệt để bảo vệ thông tin của mọi người. Trang sẽ tự kiểm tra trạng thái.'
                  : me.memberships.some((m) => m.status === 'revoked')
                    ? 'Quyền vào nhà đã được thu hồi. Liên hệ quản trị viên nếu cần tham gia lại.'
                    : 'Mở link lời mời mà người thân đã chia sẻ, hoặc nhờ quản trị viên tạo lời mời cho bạn.'}
              </p>
              <button onClick={() => void refresh()}>Kiểm tra trạng thái</button>
            </section>
          ) : (
            <>
              <nav className={s.tabs} aria-label="Điều hướng nhà">
                {(['home', 'directory', 'profile'] as const).map((key) => (
                  <button
                    key={key}
                    aria-current={tab === key ? 'page' : undefined}
                    onClick={() => {
                      setTab(key);
                      setError('');
                    }}
                  >
                    {{ home: 'Nhà mình', directory: 'Người thân', profile: 'Hồ sơ của tôi' }[key]}
                  </button>
                ))}
                {active.role === 'admin' && (
                  <button
                    aria-current={tab === 'admin' ? 'page' : undefined}
                    onClick={() => setTab('admin')}
                  >
                    Quản trị nhà
                  </button>
                )}
              </nav>
              {tab === 'home' && (
                <section className={s.content}>
                  <p className={s.eyebrow}>CHÀO {own?.familiar_name ?? me.user.name}</p>
                  <h1>Nhà mình ở đây.</h1>
                  <p>Bắt đầu bằng việc tìm người thân và hoàn thiện hồ sơ của bạn.</p>
                  {!onboarding.member_id && (
                    <div className={s.invitation}>
                      <h2>
                        {onboarding.claims.length
                          ? 'Một hồ sơ đang chờ bạn xác nhận.'
                          : 'Mình là ai trong gia phả?'}
                      </h2>
                      <p>
                        {onboarding.claims.length
                          ? 'Kiểm tra thông tin và chọn ai được xem liên hệ trước khi nhận hồ sơ.'
                          : 'Quản trị viên sẽ chọn đúng hồ sơ cho bạn. Bạn vẫn có thể xem danh bạ trong lúc chờ.'}
                      </p>
                      <button onClick={() => setTab('profile')}>Xem hồ sơ của tôi →</button>
                    </div>
                  )}
                  <div className={s.homeRows}>
                    <button onClick={() => setTab('directory')}>
                      <strong>Gặp người thân</strong>
                      <span>Tìm tên, xem hồ sơ và liên hệ được chia sẻ ↗</span>
                    </button>
                    <Link href="/design-preview/tree">
                      <strong>Khám phá cây gia phả</strong>
                      <span>Bản minh họa riêng · 15 người hư cấu, chưa phải cây của nhà bạn ↗</span>
                    </Link>
                  </div>
                </section>
              )}
              {tab === 'directory' && (
                <section className={s.content}>
                  <h1>Những người trong nhà.</h1>
                  <label className={s.search}>
                    Tìm theo tên
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Tên người thân…"
                    />
                  </label>
                  <div className={s.memberList}>
                    {members
                      .filter((m) =>
                        fold(m.display_name + ' ' + (m.familiar_name ?? '')).includes(fold(query)),
                      )
                      .map((m) => (
                        <DirectoryEntry
                          key={`${familyId}:${revision}:${m.id}`}
                          member={m}
                          base={base}
                          onError={fail}
                        />
                      ))}
                    {!members.length && (
                      <p>Nhà chưa có hồ sơ. Quản trị viên có thể thêm người thân.</p>
                    )}
                    {members.length > 0 &&
                      !members.some((m) =>
                        fold(m.display_name + ' ' + (m.familiar_name ?? '')).includes(fold(query)),
                      ) && <p>Chưa tìm thấy tên này.</p>}
                  </div>
                  {members.length === 100 && (
                    <p>
                      Đang hiển thị 100 hồ sơ đầu tiên; phân trang cho nhà lớn chưa có trong đợt
                      pilot.
                    </p>
                  )}
                </section>
              )}
              {tab === 'profile' && (
                <ProfilePanel
                  key={`${familyId}:${revision}:${onboarding.member_id ?? onboarding.claims[0]?.id ?? 'none'}`}
                  base={base}
                  onboarding={onboarding}
                  onRefresh={refresh}
                  onError={fail}
                />
              )}
              {tab === 'admin' && active.role === 'admin' && (
                <AdminPanel
                  key={`${familyId}:${revision}`}
                  base={base}
                  members={members}
                  onRefresh={refresh}
                  onError={fail}
                />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}
function DirectoryEntry({
  member,
  base,
  onError,
}: {
  member: Member;
  base: string;
  onError: (error: unknown) => void;
}) {
  const [profile, setProfile] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <article>
      <button
        disabled={busy}
        aria-expanded={Boolean(profile)}
        onClick={async () => {
          if (profile) {
            setProfile(null);
            return;
          }
          setBusy(true);
          try {
            setProfile(await request<Member>(base + '/members/' + member.id));
          } catch (error) {
            onError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <strong>{member.display_name}</strong>
        <span>{busy ? 'Đang tải…' : (member.familiar_name ?? 'Xem hồ sơ')} ↗</span>
      </button>
      {profile && (
        <div>
          <p>{profile.hometown ?? 'Chưa bổ sung quê quán'}</p>
          <p>{profile.biography}</p>
          {profile.contacts?.map((c, index) => (
            <p key={index}>
              {c.kind === 'phone' ? 'Điện thoại' : c.kind === 'email' ? 'Email' : 'Facebook'}:{' '}
              {c.value}
            </p>
          ))}
          {!profile.contacts?.length && <p>Chưa có liên hệ được chia sẻ với bạn.</p>}
        </div>
      )}
    </article>
  );
}
