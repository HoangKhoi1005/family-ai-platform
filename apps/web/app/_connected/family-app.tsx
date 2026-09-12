'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  captureInvite,
  clearInvite,
  pendingInvite,
  rememberInvite,
  request,
  explain,
  RequestError,
} from './api';
import type { Me, Onboarding, Member } from './types';
import { ProfilePanel } from './profile-panel';
import { AdminPanel } from './admin-panel';
import { ConnectedAppShell, ConnectedIdentity, type ConnectedTab } from './connected-app-shell';
import { RelationshipTree } from './relationship-tree';
import { JoinHouse } from './join-house';
import s from './connected.module.css';

export function FamilyApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [familyId, setFamilyId] = useState('');
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<ConnectedTab>('home');
  const [profileVisited, setProfileVisited] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [revision, setRevision] = useState(0);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [profileRevision, setProfileRevision] = useState(0);
  const sequence = useRef(0);
  const familyIdRef = useRef('');
  const clearFamily = useCallback(() => {
    familyIdRef.current = '';
    setFamilyId('');
    setOnboarding(null);
    setMembers([]);
    setTab('home');
    setProfileVisited(false);
    setRevision((value) => value + 1);
  }, []);
  const fail = useCallback(
    (error: unknown) => {
      setError(explain(error));
      if (error instanceof RequestError && error.status === 401) {
        sequence.current++;
        clearFamily();
        setMe(null);
        window.location.replace('/login');
      } else if (error instanceof RequestError && error.status === 403) {
        sequence.current++;
        clearFamily();
      }
    },
    [clearFamily],
  );
  const refresh = useCallback(async () => {
    const run = ++sequence.current;
    let next: Me | null = null;
    try {
      next = await request<Me>('/api/v1/me');
      if (run !== sequence.current) return;
      setLastCheckedAt(new Date());
      const previousFamilyId = familyIdRef.current;
      const active =
        next.memberships.find((m) => m.status === 'active' && m.family_id === previousFamilyId) ??
        next.memberships.find((m) => m.status === 'active');
      setMe(next);
      if (!active?.family_id) {
        if (run === sequence.current) {
          clearFamily();
          setError('');
        }
        return;
      }
      if (previousFamilyId && previousFamilyId !== active.family_id) clearFamily();
      const base = '/api/v1/families/' + active.family_id;
      const [state, list] = await Promise.all([
        request<Onboarding>(base + '/onboarding'),
        request<{ members: Member[] }>(base + '/members?limit=100'),
      ]);
      if (run !== sequence.current) return;
      familyIdRef.current = active.family_id;
      setFamilyId(active.family_id);
      setOnboarding(state);
      setMembers(list.members);
      setMe(next);
      setError('');
    } catch (error) {
      if (run === sequence.current) {
        if (error instanceof RequestError && error.status === 401) {
          fail(error);
        } else if (next && error instanceof RequestError && [403, 404].includes(error.status)) {
          clearFamily();
          setMe(next);
          setError(explain(error));
        } else {
          setError(explain(error));
        }
      }
    } finally {
      if (run === sequence.current) setLoading(false);
    }
  }, [clearFamily, fail]);
  useEffect(() => {
    const requestSequence = sequence;
    captureInvite();
    // The pending invite is external per-tab browser state, unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvite(pendingInvite());
    void refresh();
    const check = () => {
      if (document.visibilityState === 'visible') {
        setDirectoryRevision((value) => value + 1);
        void refresh();
      }
    };
    const refocus = () => {
      if (document.visibilityState === 'visible') {
        setDirectoryRevision((value) => value + 1);
        setProfileRevision((value) => value + 1);
        void refresh();
      }
    };
    const timer = setInterval(check, 15000);
    window.addEventListener('focus', refocus);
    return () => {
      requestSequence.current++;
      clearInterval(timer);
      window.removeEventListener('focus', refocus);
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
  async function checkMembership() {
    setChecking(true);
    await refresh();
    setChecking(false);
  }
  function prepareInvitation(value: string) {
    const token = rememberInvite(value);
    if (!token) return false;
    setInvite(token);
    setError('');
    return true;
  }
  const active = me?.memberships.find((m) => m.status === 'active' && m.family_id === familyId);
  const pending = me?.memberships.some((m) => m.status === 'pending') ?? false;
  const revoked = me?.memberships.some((m) => m.status === 'revoked') ?? false;
  const own = members.find((member) => member.id === onboarding?.member_id);
  const base = '/api/v1/families/' + familyId;
  const navigate = (destination: ConnectedTab) => {
    if (destination === 'profile') setProfileVisited(true);
    setTab(destination);
    setError('');
  };

  if (!loading && me && active && onboarding) {
    const viewerName = own?.familiar_name ?? own?.display_name ?? me.user.name;
    return (
      <main id="main" className={`${s.shell} ${s.productShell}`}>
        <ConnectedAppShell
          tab={tab}
          houseName={active.name ?? 'Nhà mình'}
          viewerName={viewerName}
          onNavigate={navigate}
        >
          {error && (
            <div role="alert" className={`${s.error} ${s.productError}`}>
              {error}
              <button onClick={() => void refresh()}>Thử lại</button>
            </div>
          )}
          {invite && (
            <section className={`${s.invitation} ${s.productInvitation}`}>
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
          {tab === 'home' && (
            <section className={s.productPage}>
              <header className={s.productHeader}>
                <p className={s.eyebrow}>CHÀO {viewerName.toLocaleUpperCase('vi')}</p>
                <h1>Nhà mình ở đây.</h1>
                <p className={s.productLead}>
                  Một nơi riêng để tìm người thân và chăm chút những thông tin cả nhà cùng gìn giữ.
                </p>
              </header>
              <div className={s.memberSummary}>
                <div>
                  <span className={s.summaryNumber}>{members.length}</span>
                  <span>{members.length} người trong nhà</span>
                </div>
                <button type="button" onClick={() => navigate('directory')}>
                  Mở danh bạ <span aria-hidden="true">→</span>
                </button>
              </div>
              {!onboarding.member_id && (
                <section className={s.ownershipPrompt}>
                  <p className={s.eyebrow}>HỒ SƠ CỦA BẠN</p>
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
                  <button type="button" onClick={() => navigate('profile')}>
                    Xem hồ sơ của tôi <span aria-hidden="true">→</span>
                  </button>
                </section>
              )}
              <section className={s.homeDirectory}>
                <div>
                  <p className={s.eyebrow}>NGƯỜI THÂN</p>
                  <h2>Những gương mặt trong nhà.</h2>
                </div>
                <div className={s.identityRow} aria-label={`${members.length} người trong nhà`}>
                  {members.slice(0, 5).map((member) => (
                    <ConnectedIdentity key={member.id} name={member.display_name} />
                  ))}
                </div>
                <button type="button" onClick={() => navigate('directory')}>
                  Tìm một người thân
                </button>
              </section>
            </section>
          )}
          {tab === 'moments' && (
            <UnavailableDestination
              eyebrow="KHOẢNH KHẮC"
              title="Khoảnh khắc đang được chuẩn bị."
              description="Ảnh và câu chuyện chỉ nên xuất hiện khi chúng thực sự thuộc về nhà bạn. Phần này sẽ được nối với API riêng tư ở gói tiếp theo."
            />
          )}
          {tab === 'directory' && (
            <RelationshipTree
              key={`${familyId}:${directoryRevision}`}
              base={base}
              rootMemberId={onboarding.member_id}
              members={members}
              onError={fail}
            />
          )}
          {tab === 'chat' && (
            <UnavailableDestination
              eyebrow="TRÒ CHUYỆN"
              title="Trò chuyện đang được chuẩn bị."
              description="Tin nhắn cần realtime, trạng thái gửi lại và quyền riêng tư hoàn chỉnh. Chúng tôi chưa hiển thị hội thoại minh họa như thể đó là tin thật của gia đình."
            />
          )}
          {(tab === 'profile' || profileVisited) && (
            <section className={s.profileDestination} hidden={tab !== 'profile'}>
              <div className={s.meOverview}>
                <ConnectedIdentity name={viewerName} />
                <div>
                  <strong>{viewerName}</strong>
                  <span>{me.user.email}</span>
                </div>
                <div className={s.meActions}>
                  {active.role === 'admin' && (
                    <button type="button" onClick={() => navigate('admin')}>
                      Quản trị nhà
                    </button>
                  )}
                  <button type="button" onClick={logout} disabled={busy}>
                    {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
                  </button>
                </div>
              </div>
              <aside className={s.privacyNote}>
                <strong>Quyền riêng tư của bạn</strong>
                <p>
                  Bạn quyết định liên hệ nào chỉ mình bạn xem và liên hệ nào được chia sẻ với cả
                  nhà.
                </p>
              </aside>
              <ProfilePanel
                key={`${familyId}:${revision}:${onboarding.member_id ?? onboarding.claims[0]?.id ?? 'none'}:${onboarding.claims[0]?.version ?? 'linked'}`}
                base={base}
                onboarding={onboarding}
                revalidateRevision={profileRevision}
                onRefresh={refresh}
                onError={fail}
              />
            </section>
          )}
          {tab === 'admin' && active.role === 'admin' && (
            <section className={s.adminDestination}>
              <button className={s.backButton} type="button" onClick={() => navigate('profile')}>
                <span aria-hidden="true">←</span> Trở về Tôi
              </button>
              <AdminPanel
                key={`${familyId}:${revision}`}
                base={base}
                members={members}
                onRefresh={refresh}
                onError={fail}
              />
            </section>
          )}
        </ConnectedAppShell>
      </main>
    );
  }

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
        <JoinHouse
          userName={me.user.name}
          email={me.user.email}
          invitation={invite}
          pending={pending}
          revoked={revoked}
          busy={busy || checking}
          lastCheckedAt={lastCheckedAt}
          onPrepareInvitation={prepareInvitation}
          onAcceptInvitation={() => void accept()}
          onClearInvitation={() => {
            clearInvite();
            setInvite('');
          }}
          onRefresh={() => void checkMembership()}
        />
      )}
    </main>
  );
}

function UnavailableDestination({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className={`${s.productPage} ${s.unavailablePage}`}>
      <div className={s.unavailableMark} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className={s.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p className={s.productLead}>{description}</p>
    </section>
  );
}
