'use client';
import type {
  EventReminderOffset,
  EventRsvpResponse,
  NotificationDto,
  NotificationListResponse,
  NotificationPreferencesDto,
} from '@family/contracts';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import {
  cancelFamilyEvent,
  captureInvite,
  clearInvite,
  createFamilyEvent,
  getFamilyNotificationPreferences,
  listFamilyOccurrences,
  listFamilyNotifications,
  markFamilyNotificationRead,
  pendingInvite,
  rememberInvite,
  request,
  explain,
  RequestError,
  updateFamilyEvent,
  updateFamilyNotificationPreferences,
  upsertFamilyOccurrenceRsvp,
} from './api';
import type { Me, Onboarding, Member } from './types';
import { ProfilePanel } from './profile-panel';
import { AdminPanel } from './admin-panel';
import { ConnectedAppShell, ConnectedIdentity, type ConnectedTab } from './connected-app-shell';
import { RelationshipTree } from './relationship-tree';
import { JoinHouse } from './join-house';
import {
  calendarTimelineRange,
  calendarTimelineReducer,
  createCalendarTimelineState,
} from './calendar-state';
import { CalendarHomeSection, FamilyCalendarTimeline } from './family-calendar';
import { NotificationInbox } from './notification-inbox';
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
  const [calendar, dispatchCalendar] = useReducer(
    calendarTimelineReducer,
    undefined,
    createCalendarTimelineState,
  );
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [calendarCreateRequested, setCalendarCreateRequested] = useState(false);
  const [notificationInbox, setNotificationInbox] = useState<NotificationListResponse>({
    notifications: [],
    unread_count: 0,
    next_cursor: null,
  });
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferencesDto | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const sequence = useRef(0);
  const calendarSequence = useRef(0);
  const calendarGeneration = useRef(0);
  const notificationSequence = useRef(0);
  const familyIdRef = useRef('');
  const clearFamily = useCallback(() => {
    calendarSequence.current++;
    calendarGeneration.current = 0;
    const url = new URL(window.location.href);
    if (url.searchParams.has('view') || url.searchParams.has('occurrence')) {
      url.searchParams.delete('view');
      url.searchParams.delete('occurrence');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    familyIdRef.current = '';
    setFamilyId('');
    setOnboarding(null);
    setMembers([]);
    dispatchCalendar({ type: 'cleared' });
    setSelectedOccurrenceId(null);
    setCalendarCreateRequested(false);
    notificationSequence.current++;
    setNotificationInbox({ notifications: [], unread_count: 0, next_cursor: null });
    setNotificationPreferences(null);
    setNotificationOpen(false);
    setNotificationLoading(false);
    setNotificationError('');
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
  const failCalendar = useCallback(
    (failedFamilyId: string, error: unknown) => {
      if (familyIdRef.current === failedFamilyId) fail(error);
    },
    [fail],
  );
  const refreshNotifications = useCallback(
    async (requestedFamilyId?: string) => {
      const targetFamilyId = requestedFamilyId ?? familyIdRef.current;
      if (!targetFamilyId) return;
      const requestId = ++notificationSequence.current;
      setNotificationLoading(true);
      try {
        const [inbox, preferences] = await Promise.all([
          listFamilyNotifications(targetFamilyId, { limit: 40 }),
          getFamilyNotificationPreferences(targetFamilyId),
        ]);
        if (requestId !== notificationSequence.current || familyIdRef.current !== targetFamilyId)
          return;
        setNotificationInbox(inbox);
        setNotificationPreferences(preferences);
        setNotificationError('');
      } catch (error) {
        if (requestId !== notificationSequence.current || familyIdRef.current !== targetFamilyId)
          return;
        if (error instanceof RequestError && error.status === 401) fail(error);
        else if (error instanceof RequestError && [403, 404].includes(error.status)) {
          sequence.current++;
          clearFamily();
          setError(explain(error));
        } else setNotificationError(explain(error));
      } finally {
        if (requestId === notificationSequence.current) setNotificationLoading(false);
      }
    },
    [clearFamily, fail],
  );
  const refreshCalendar = useCallback(
    async (requestedFamilyId?: string) => {
      const targetFamilyId = requestedFamilyId ?? familyIdRef.current;
      if (!targetFamilyId) return;
      const requestId = ++calendarSequence.current;
      const generation = calendarGeneration.current;
      dispatchCalendar({ type: 'load-started', familyId: targetFamilyId, requestId });
      try {
        const range = calendarTimelineRange();
        const result = await listFamilyOccurrences(targetFamilyId, { ...range, limit: 100 });
        dispatchCalendar({
          type: 'load-succeeded',
          familyId: targetFamilyId,
          requestId,
          generation,
          occurrences: result.occurrences,
          nextCursor: result.next_cursor,
        });
      } catch (error) {
        if (requestId !== calendarSequence.current) return;
        const accessRevoked =
          error instanceof RequestError && [401, 403, 404].includes(error.status);
        dispatchCalendar({
          type: 'load-failed',
          familyId: targetFamilyId,
          requestId,
          code: error instanceof RequestError ? error.code : 'REQUEST_FAILED',
          accessRevoked,
        });
        if (accessRevoked) {
          if (error instanceof RequestError && error.status === 401) {
            fail(error);
          } else {
            sequence.current++;
            clearFamily();
            setError(explain(error));
          }
        }
      }
    },
    [clearFamily, fail],
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
      void refreshCalendar(active.family_id);
      void refreshNotifications(active.family_id);
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
  }, [clearFamily, fail, refreshCalendar, refreshNotifications]);

  useEffect(() => {
    const requestSequence = sequence;
    const calendarRequestSequence = calendarSequence;
    const notificationRequestSequence = notificationSequence;
    captureInvite();
    // The pending invite is external per-tab browser state, unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvite(pendingInvite());
    const syncCalendarLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const occurrenceId = params.get('occurrence');
      if (params.get('view') === 'calendar' || occurrenceId) {
        setTab('calendar');
        setSelectedOccurrenceId(occurrenceId);
      } else {
        setSelectedOccurrenceId(null);
        setTab((current) => (current === 'calendar' ? 'home' : current));
      }
    };
    syncCalendarLocation();
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
    window.addEventListener('popstate', syncCalendarLocation);
    return () => {
      requestSequence.current++;
      calendarRequestSequence.current++;
      notificationRequestSequence.current++;
      clearInterval(timer);
      window.removeEventListener('focus', refocus);
      window.removeEventListener('popstate', syncCalendarLocation);
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
    if (destination !== 'calendar') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('view') || url.searchParams.has('occurrence')) {
        url.searchParams.delete('view');
        url.searchParams.delete('occurrence');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      setSelectedOccurrenceId(null);
    }
    setTab(destination);
    setError('');
  };

  function openCalendar(occurrenceId?: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'calendar');
    if (occurrenceId) url.searchParams.set('occurrence', occurrenceId);
    else url.searchParams.delete('occurrence');
    const nextUrl = url.pathname + url.search + url.hash;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (nextUrl !== currentUrl) window.history.pushState({ calendarView: true }, '', nextUrl);
    setSelectedOccurrenceId(occurrenceId ?? null);
    setTab('calendar');
    setError('');
  }

  function startCreatingCalendarEvent() {
    openCalendar();
    setCalendarCreateRequested(true);
  }

  function selectCalendarOccurrence(occurrenceId: string | null) {
    if (!occurrenceId && window.history.state?.calendarOccurrence) {
      setSelectedOccurrenceId(null);
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'calendar');
    if (occurrenceId) url.searchParams.set('occurrence', occurrenceId);
    else url.searchParams.delete('occurrence');
    const nextUrl = url.pathname + url.search + url.hash;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (nextUrl !== currentUrl) {
      if (occurrenceId) {
        window.history.pushState({ calendarOccurrence: true }, '', nextUrl);
      } else {
        window.history.replaceState({ calendarView: true }, '', nextUrl);
      }
    }
    setSelectedOccurrenceId(occurrenceId);
  }

  async function respondToOccurrence(occurrenceId: string, response: EventRsvpResponse) {
    const targetFamilyId = familyId;
    const result = await upsertFamilyOccurrenceRsvp(targetFamilyId, occurrenceId, { response });
    if (familyIdRef.current !== targetFamilyId) return;
    calendarGeneration.current++;
    dispatchCalendar({
      type: 'rsvp-succeeded',
      familyId: targetFamilyId,
      occurrenceId: result.occurrence_id,
      response: result.response,
    });
  }

  async function openNotification(notification: NotificationDto) {
    const targetFamilyId = familyId;
    try {
      const read = await markFamilyNotificationRead(targetFamilyId, notification.id);
      if (familyIdRef.current !== targetFamilyId) return;
      setNotificationInbox((current) => ({
        ...current,
        unread_count: Math.max(0, current.unread_count - (notification.read_at ? 0 : 1)),
        notifications: current.notifications.map((item) =>
          item.id === notification.id ? { ...item, read_at: read.read_at } : item,
        ),
      }));
      setNotificationOpen(false);
      openCalendar(notification.occurrence_id);
      void refreshCalendar(targetFamilyId);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) fail(error);
      else if (error instanceof RequestError && [403, 404].includes(error.status)) {
        sequence.current++;
        clearFamily();
        setError(explain(error));
      } else setNotificationError(explain(error));
    }
  }

  async function loadMoreNotifications() {
    const targetFamilyId = familyId;
    const cursor = notificationInbox.next_cursor;
    if (!cursor) return;
    const requestId = ++notificationSequence.current;
    setNotificationLoading(true);
    try {
      const next = await listFamilyNotifications(targetFamilyId, { cursor, limit: 40 });
      if (requestId !== notificationSequence.current || familyIdRef.current !== targetFamilyId)
        return;
      setNotificationInbox((current) => {
        const seen = new Set(current.notifications.map((item) => item.id));
        return {
          notifications: [
            ...current.notifications,
            ...next.notifications.filter((item) => !seen.has(item.id)),
          ],
          unread_count: next.unread_count,
          next_cursor: next.next_cursor,
        };
      });
      setNotificationError('');
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) fail(error);
      else if (error instanceof RequestError && [403, 404].includes(error.status)) {
        sequence.current++;
        clearFamily();
        setError(explain(error));
      } else setNotificationError(explain(error));
    } finally {
      if (requestId === notificationSequence.current) setNotificationLoading(false);
    }
  }

  async function saveNotificationPreferences(reminderOffsets: EventReminderOffset[]) {
    const targetFamilyId = familyId;
    const current = notificationPreferences;
    if (!current) return;
    try {
      const updated = await updateFamilyNotificationPreferences(targetFamilyId, {
        reminder_offsets: reminderOffsets,
        quiet_hours: current.quiet_hours,
        push_enabled: false,
        version: current.version,
      });
      if (familyIdRef.current !== targetFamilyId) return;
      setNotificationPreferences(updated);
      setNotificationError('');
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) fail(error);
      else if (error instanceof RequestError && [403, 404].includes(error.status)) {
        sequence.current++;
        clearFamily();
        setError(explain(error));
      } else {
        setNotificationError(explain(error));
        throw error;
      }
    }
  }

  async function createCalendarEvent(
    event: Parameters<typeof createFamilyEvent>[1],
    idempotencyKey: string,
  ) {
    const targetFamilyId = familyId;
    const detail = await createFamilyEvent(targetFamilyId, event, idempotencyKey);
    if (familyIdRef.current !== targetFamilyId) return detail;
    calendarGeneration.current++;
    dispatchCalendar({ type: 'event-succeeded', familyId: targetFamilyId, detail });
    return detail;
  }

  async function updateCalendarEvent(
    eventId: string,
    version: number,
    event: Parameters<typeof updateFamilyEvent>[2]['event'],
  ) {
    const targetFamilyId = familyId;
    const detail = await updateFamilyEvent(targetFamilyId, eventId, { version, event });
    if (familyIdRef.current !== targetFamilyId) return detail;
    calendarGeneration.current++;
    dispatchCalendar({ type: 'event-succeeded', familyId: targetFamilyId, detail });
    return detail;
  }

  async function cancelCalendarEvent(eventId: string, version: number) {
    const targetFamilyId = familyId;
    const detail = await cancelFamilyEvent(targetFamilyId, eventId, { version });
    if (familyIdRef.current !== targetFamilyId) return detail;
    calendarGeneration.current++;
    dispatchCalendar({ type: 'event-succeeded', familyId: targetFamilyId, detail });
    return detail;
  }

  if (!loading && me && active && onboarding) {
    const viewerName = own?.familiar_name ?? own?.display_name ?? me.user.name;
    return (
      <main id="main" className={`${s.shell} ${s.productShell}`}>
        <ConnectedAppShell
          tab={tab}
          houseName={active.name ?? 'Nhà mình'}
          viewerName={viewerName}
          unreadNotifications={notificationInbox.unread_count}
          onOpenNotifications={() => {
            setNotificationOpen(true);
            void refreshNotifications();
          }}
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
              <CalendarHomeSection
                timeline={calendar}
                members={members}
                onOpen={openCalendar}
                onCreate={startCreatingCalendarEvent}
                onRefresh={() => void refreshCalendar()}
              />
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
          {tab === 'calendar' && (
            <FamilyCalendarTimeline
              familyId={familyId}
              timeline={calendar}
              members={members}
              selectedOccurrenceId={selectedOccurrenceId}
              onBack={() => navigate('home')}
              onSelectOccurrence={selectCalendarOccurrence}
              onRefresh={() => void refreshCalendar()}
              onRsvp={respondToOccurrence}
              createRequested={calendarCreateRequested}
              onCreateRequestClose={() => setCalendarCreateRequested(false)}
              onCreateEvent={createCalendarEvent}
              onUpdateEvent={updateCalendarEvent}
              onCancelEvent={cancelCalendarEvent}
              onError={failCalendar}
            />
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
        <NotificationInbox
          open={notificationOpen}
          loading={notificationLoading}
          notifications={notificationInbox.notifications}
          hasMore={notificationInbox.next_cursor !== null}
          preferences={notificationPreferences}
          error={notificationError}
          onClose={() => setNotificationOpen(false)}
          onRefresh={() => void refreshNotifications()}
          onLoadMore={() => void loadMoreNotifications()}
          onOpenNotification={(notification) => void openNotification(notification)}
          onSavePreferences={saveNotificationPreferences}
        />
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
