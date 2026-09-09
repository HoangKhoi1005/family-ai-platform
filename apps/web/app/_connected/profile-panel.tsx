'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request, explain, RequestError } from './api';
import type { Claim, Contact, Member, Onboarding } from './types';
import s from './connected.module.css';

export function ProfilePanel({
  base,
  onboarding,
  revalidateRevision,
  onRefresh,
  onError,
}: {
  base: string;
  onboarding: Onboarding;
  revalidateRevision: number;
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [profile, setProfile] = useState<Member | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const profileVersion = useRef<number | null>(null);
  const claimId = onboarding.claims[0]?.id;
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function load() {
      if (claimId || profileVersion.current === null) setLoading(true);
      setError('');
      if (claimId) {
        setClaim(null);
        setContacts([]);
      }
      try {
        if (onboarding.member_id) {
          const member = await request<Member>(
            base + '/members/' + onboarding.member_id,
            undefined,
            'GET',
            {
              signal: controller.signal,
            },
          );
          if (alive) {
            if (profileVersion.current === null || member.version > profileVersion.current) {
              profileVersion.current = member.version;
              setProfile(member);
              setContacts(member.contacts ?? []);
            }
          }
        } else if (claimId) {
          const next = await request<Claim>(
            base + '/member-claims/' + claimId + '/preview',
            undefined,
            'GET',
            { signal: controller.signal },
          );
          if (alive) {
            setClaim(next);
            setContacts(next.contacts);
          }
        }
      } catch (error) {
        if (alive) {
          setError(explain(error));
          onError(error);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [base, onboarding.member_id, claimId, onError, retry, revalidateRevision]);
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claim) return;
    setBusy(true);
    setError('');
    try {
      await request(base + '/member-claims/' + claim.id + '/confirm', {
        version: claim.version,
        member_version: claim.member_version,
        accept_ownership: true,
        contact_visibilities: contacts.map((c) => ({ id: c.id, visibility: c.visibility })),
      });
      setClaim(null);
      setContacts([]);
      await onRefresh();
    } catch (error) {
      if (error instanceof RequestError && [404, 409].includes(error.status)) {
        setClaim(null);
        setContacts([]);
      }
      setError(explain(error));
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const updated = await request<Member>(
        base + '/members/' + profile.id,
        {
          version: profile.version,
          display_name: String(data.get('display_name')).trim(),
          familiar_name: String(data.get('familiar_name')).trim() || null,
          hometown: String(data.get('hometown')).trim() || null,
          biography: String(data.get('biography')).trim() || null,
          contacts: contacts.map(({ kind, value, visibility }) => ({ kind, value, visibility })),
        },
        'PATCH',
      );
      profileVersion.current = updated.version;
      setProfile(updated);
      setContacts(updated.contacts ?? []);
      setMessage('Đã lưu hồ sơ của bạn.');
      await onRefresh();
    } catch (error) {
      setError(explain(error));
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.content}>
      <p className={s.eyebrow}>MỘT TRANG VỀ BẠN</p>
      <h1>{profile ? 'Hồ sơ của tôi.' : 'Nhận đúng hồ sơ của mình.'}</h1>
      {loading ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : (
        <>
          {error && (
            <div role="alert" className={s.error}>
              {error}
              <button onClick={() => setRetry(retry + 1)}>Tải lại hồ sơ</button>
            </div>
          )}
          {message && (
            <p role="status" className={s.success}>
              {message}
            </p>
          )}
          {!profile && !claim && !error && (
            <>
              <p>
                Chưa có hồ sơ được chỉ định cho bạn. Nhờ quản trị viên chọn hồ sơ có sẵn hoặc tạo hồ
                sơ mới, rồi quay lại đây xác nhận.
              </p>
              <button onClick={() => void onRefresh()}>Kiểm tra hồ sơ được chỉ định</button>
            </>
          )}
          {claim && !profile && (
            <form className={s.form} onSubmit={confirm}>
              <h2>{claim.member.display_name}</h2>
              <p>{claim.member.hometown}</p>
              <p>{claim.member.biography}</p>
              <p>Chỉ xác nhận nếu đây là bạn. Chọn quyền xem từng liên hệ trước khi nhận.</p>
              {contacts.map((contact, index) => (
                <label key={contact.id}>
                  {contact.value}
                  <select
                    value={contact.visibility}
                    onChange={(e) =>
                      setContacts(
                        contacts.map((c, i) =>
                          i === index
                            ? { ...c, visibility: e.target.value as Contact['visibility'] }
                            : c,
                        ),
                      )
                    }
                  >
                    <option value="self">Chỉ mình tôi</option>
                    <option value="family">Cả nhà</option>
                  </select>
                </label>
              ))}
              <label className={s.checkbox}>
                <input type="checkbox" required />
                Đây là hồ sơ của tôi; tôi đồng ý nhận quản lý thông tin này.
              </label>
              <button className={s.primary} disabled={busy}>
                {busy ? 'Đang xác nhận…' : 'Xác nhận nhận hồ sơ'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await request(base + '/member-claims/' + claim.id + '/decline', {
                      version: claim.version,
                    });
                    setClaim(null);
                    await onRefresh();
                  } catch (error) {
                    if (error instanceof RequestError && [404, 409].includes(error.status)) {
                      setClaim(null);
                      setContacts([]);
                    }
                    setError(explain(error));
                    onError(error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Đây không phải tôi
              </button>
            </form>
          )}
          {profile && (
            <form key={profile.version} className={s.form} onSubmit={save}>
              <label>
                Họ và tên
                <input
                  name="display_name"
                  defaultValue={profile.display_name}
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Tên thường gọi
                <input
                  name="familiar_name"
                  defaultValue={profile.familiar_name ?? ''}
                  maxLength={120}
                />
              </label>
              <label>
                Quê quán
                <input name="hometown" defaultValue={profile.hometown ?? ''} maxLength={200} />
              </label>
              <label>
                Đôi điều về bạn
                <textarea
                  name="biography"
                  defaultValue={profile.biography ?? ''}
                  maxLength={1000}
                  rows={4}
                />
              </label>
              <h2>Liên hệ</h2>
              <p>Liên hệ mới mặc định chỉ mình bạn xem được.</p>
              {contacts.map((contact, index) => (
                <fieldset key={index} className={s.contact}>
                  <legend>Liên hệ {index + 1}</legend>
                  <label>
                    Loại
                    <select
                      aria-label="Loại"
                      value={contact.kind}
                      onChange={(e) =>
                        setContacts(
                          contacts.map((c, i) =>
                            i === index ? { ...c, kind: e.target.value as Contact['kind'] } : c,
                          ),
                        )
                      }
                    >
                      <option value="phone">Điện thoại</option>
                      <option value="email">Email</option>
                      <option value="facebook">Facebook</option>
                    </select>
                  </label>
                  <label>
                    Nội dung
                    <input
                      value={contact.value}
                      onChange={(e) =>
                        setContacts(
                          contacts.map((c, i) =>
                            i === index ? { ...c, value: e.target.value } : c,
                          ),
                        )
                      }
                      required
                      maxLength={320}
                    />
                  </label>
                  <label>
                    Ai được xem
                    <select
                      aria-label="Ai được xem"
                      value={contact.visibility}
                      onChange={(e) =>
                        setContacts(
                          contacts.map((c, i) =>
                            i === index
                              ? { ...c, visibility: e.target.value as Contact['visibility'] }
                              : c,
                          ),
                        )
                      }
                    >
                      <option value="self">Chỉ mình tôi</option>
                      <option value="family">Cả nhà</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setContacts(contacts.filter((_, i) => i !== index))}
                  >
                    Bỏ liên hệ {index + 1}
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={contacts.length >= 10}
                onClick={() =>
                  setContacts([...contacts, { kind: 'phone', value: '', visibility: 'self' }])
                }
              >
                Thêm liên hệ
              </button>
              <button className={s.primary} disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
