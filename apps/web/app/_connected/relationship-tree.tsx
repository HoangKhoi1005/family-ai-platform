'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CreateRelationshipChangeRequestInput,
  MemberProfileDto,
  RelationshipChangeRequestDto,
  RelationshipChangeRequestListResponse,
  RelationshipGraphResponse,
} from '@family/contracts';
import { explain, request, RequestError } from './api';
import type { Member } from './types';
import { ConnectedIdentity } from './connected-app-shell';
import { InteractiveTreeCanvas } from './interactive-tree-canvas';
import {
  connectionsFor,
  newMemberProposal,
  relationshipRemovalProposal,
  relationshipProposal,
  relationshipStatements,
  safeContactHref,
  type RelationshipProposalChoice,
} from './relationship-tree-model';
import styles from './relationship-tree.module.css';

type TreeView = 'tree' | 'directory';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function RelationshipTree({
  base,
  rootMemberId,
  members,
  onError,
}: {
  base: string;
  rootMemberId: string | null;
  members: Member[];
  onError: (error: unknown) => void;
}) {
  const [view, setView] = useState<TreeView>('tree');
  const [graph, setGraph] = useState<RelationshipGraphResponse | null>(null);
  const [graphError, setGraphError] = useState('');
  const [loading, setLoading] = useState(Boolean(rootMemberId));
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<MemberProfileDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<RelationshipChangeRequestDto[]>([]);
  const opener = useRef<HTMLButtonElement | null>(null);
  const profileSequence = useRef(0);

  const loadGraph = useCallback(
    async (signal?: AbortSignal) => {
      if (!rootMemberId) {
        setGraph(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setGraphError('');
      try {
        const result = await request<RelationshipGraphResponse>(
          `${base}/relationships?root_member_id=${encodeURIComponent(rootMemberId)}&depth=2`,
          undefined,
          'GET',
          signal ? { signal } : {},
        );
        setGraph(result);
      } catch (error) {
        if (error instanceof RequestError && error.code === 'REQUEST_ABORTED') return;
        setGraphError(explain(error));
        if (error instanceof RequestError && [401, 403, 404].includes(error.status)) onError(error);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [base, onError, rootMemberId],
  );

  useEffect(() => {
    const controller = new AbortController();
    // The request owns this view's loading and error state for both the initial load and retries.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGraph(controller.signal);
    return () => controller.abort();
  }, [loadGraph]);

  const loadPending = useCallback(async () => {
    try {
      const result = await request<RelationshipChangeRequestListResponse>(
        `${base}/change-requests?status=pending&scope=mine`,
      );
      setPending(result.change_requests);
    } catch (error) {
      if (error instanceof RequestError && [401, 403, 404].includes(error.status)) onError(error);
    }
  }, [base, onError]);

  useEffect(() => {
    // The pending queue is server state and is refreshed after each local mutation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPending();
  }, [loadPending]);

  const graphMembers = useMemo(
    () => new Map(graph?.nodes.map((member) => [member.id, member]) ?? []),
    [graph],
  );
  const root = rootMemberId ? graphMembers.get(rootMemberId) : undefined;
  const statements = useMemo(() => (graph ? relationshipStatements(graph) : []), [graph]);

  const openProfile = useCallback(
    async (memberId: string, button?: HTMLButtonElement) => {
      const run = ++profileSequence.current;
      if (button) opener.current = button;
      setSelectedId(memberId);
      setProfile(null);
      setProfileLoading(true);
      setProposalOpen(false);
      setMessage('');
      try {
        const nextProfile = await request<MemberProfileDto>(`${base}/members/${memberId}`);
        if (run === profileSequence.current) setProfile(nextProfile);
      } catch (error) {
        if (run === profileSequence.current) onError(error);
      } finally {
        if (run === profileSequence.current) setProfileLoading(false);
      }
    },
    [base, onError],
  );

  const closeProfile = useCallback(() => {
    profileSequence.current += 1;
    setSelectedId(null);
    setProfile(null);
    setProposalOpen(false);
    requestAnimationFrame(() => opener.current?.focus());
  }, []);

  return (
    <section className={styles.page} aria-labelledby="connected-tree-title">
      <header className={styles.header}>
        <p>GIA PHẢ</p>
        <h1 id="connected-tree-title">Gia phả nhà mình.</h1>
        <span>
          Chỉ những quan hệ đã được gia đình xác nhận mới xuất hiện trên sơ đồ. Bạn vẫn có thể tìm
          mọi người bằng danh bạ.
        </span>
      </header>

      <div className={styles.viewSwitch} aria-label="Cách xem gia phả">
        <button aria-pressed={view === 'tree'} type="button" onClick={() => setView('tree')}>
          Sơ đồ
        </button>
        <button
          aria-pressed={view === 'directory'}
          type="button"
          onClick={() => setView('directory')}
        >
          Danh bạ
        </button>
      </div>

      {message ? (
        <p className={styles.notice} role="status">
          {message}
        </p>
      ) : null}

      {pending.length ? (
        <section className={styles.pending} aria-labelledby="pending-tree-heading">
          <div>
            <p>ĐANG CHỜ GIA ĐÌNH XÁC NHẬN</p>
            <h2 id="pending-tree-heading">{pending.length} đề xuất chưa lên cây.</h2>
          </div>
          <ul>
            {pending.map((item) => (
              <li key={item.id}>
                <span>{pendingLabel(item, members)}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await request(`${base}/change-requests/${item.id}/cancel`, {
                        version: item.version,
                      });
                      setMessage('Đã hủy đề xuất. Cây gia phả không thay đổi.');
                      await loadPending();
                    } catch (error) {
                      onError(error);
                    }
                  }}
                >
                  Hủy đề xuất
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === 'tree' ? (
        <div className={styles.treeView}>
          {!rootMemberId ? (
            <EmptyTree
              title="Chưa xác định vị trí của bạn."
              description="Quản trị viên cần chỉ định đúng hồ sơ trước khi mở sơ đồ quanh bạn. Danh bạ vẫn dùng được trong lúc chờ."
              action={() => setView('directory')}
            />
          ) : loading ? (
            <p className={styles.state} role="status">
              Đang xếp lại những mối quan hệ đã xác nhận…
            </p>
          ) : graphError ? (
            <div className={styles.state} role="alert">
              <strong>Chưa mở được sơ đồ.</strong>
              <span>{graphError}</span>
              <button type="button" onClick={() => void loadGraph()}>
                Thử lại
              </button>
            </div>
          ) : graph && graph.nodes.length ? (
            <section className={styles.canvas} aria-label="Sơ đồ quan hệ gia đình đã xác nhận">
              <div className={styles.canvasIntro}>
                <span>QUANH HỒ SƠ CỦA BẠN · {graph.depth} BƯỚC KẾT NỐI</span>
                <h2>Quanh {root?.familiar_name ?? root?.display_name ?? 'bạn'}</h2>
              </div>
              <InteractiveTreeCanvas
                graph={graph}
                rootMemberId={rootMemberId}
                onOpenProfile={(memberId, button) => void openProfile(memberId, button)}
              />
              {statements.length ? (
                <section className={styles.edgeLedger} aria-labelledby="approved-edges-heading">
                  <h3 id="approved-edges-heading">Các quan hệ trong phần cây này</h3>
                  <ul>
                    {statements.map((statement) => (
                      <li
                        key={statement.relationship_id}
                        data-approved-relationship={statement.relationship_id}
                      >
                        <span>{statement.detail}</span>
                        <strong>{statement.title}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {graph.relationships.length === 0 ? (
                <EmptyTree
                  title="Cây đang bắt đầu từ bạn."
                  description="Gửi một đề xuất quan hệ để quản trị viên kiểm tra và nối thêm người thân."
                  action={() => rootMemberId && void openProfile(rootMemberId)}
                  actionLabel="Bổ sung quan hệ"
                />
              ) : (
                <footer className={styles.legend}>
                  <span aria-hidden="true" /> Quan hệ đã xác nhận · Chạm một người để xem hồ sơ
                </footer>
              )}
            </section>
          ) : (
            <EmptyTree
              title="Chưa có quan hệ được xác nhận."
              description="Danh bạ vẫn giữ mọi hồ sơ trong nhà để bạn có thể tìm đúng người."
              action={() => setView('directory')}
            />
          )}
        </div>
      ) : (
        <Directory
          members={members}
          query={query}
          onQuery={setQuery}
          onOpen={(id, button) => void openProfile(id, button)}
        />
      )}

      {selectedId ? (
        <MemberProfileSheet
          member={
            profile ??
            graphMembers.get(selectedId) ??
            members.find((item) => item.id === selectedId)
          }
          loading={profileLoading}
          graph={graph}
          members={members}
          selectedId={selectedId}
          proposalOpen={proposalOpen}
          onProposalOpen={() => setProposalOpen(true)}
          onProposalClose={() => setProposalOpen(false)}
          onClose={closeProfile}
          onSelect={(id) => void openProfile(id)}
          onSubmit={async (input) => {
            await request(`${base}/change-requests`, input);
            setProposalOpen(false);
            await loadPending();
            setMessage('Đã gửi đề xuất. Quản trị viên sẽ kiểm tra trước khi cây thay đổi.');
          }}
          onRelationshipAction={async (input) => {
            await request(`${base}/change-requests`, input);
            setMessage('Đã gửi đề xuất sửa quan hệ để quản trị viên kiểm tra.');
            await loadPending();
          }}
          onError={onError}
        />
      ) : null}
    </section>
  );
}

function EmptyTree({
  title,
  description,
  action,
  actionLabel = 'Mở danh bạ',
}: {
  title: string;
  description: string;
  action: () => void;
  actionLabel?: string;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.seedMark} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button type="button" onClick={action}>
        {actionLabel}
      </button>
    </div>
  );
}

function Directory({
  members,
  query,
  onQuery,
  onOpen,
}: {
  members: Member[];
  query: string;
  onQuery: (value: string) => void;
  onOpen: (id: string, button: HTMLButtonElement) => void;
}) {
  const visible = members.filter((member) =>
    fold(`${member.display_name} ${member.familiar_name ?? ''}`).includes(fold(query)),
  );
  return (
    <section className={styles.directory} aria-labelledby="directory-heading">
      <div>
        <p>DANH BẠ TƯƠNG ĐƯƠNG</p>
        <h2 id="directory-heading">Tìm từng người thân.</h2>
      </div>
      <label className={styles.search}>
        <span>Tìm theo tên</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Tìm tên người thân…"
        />
      </label>
      <div className={styles.directoryList}>
        {visible.map((member) => (
          <button
            type="button"
            key={member.id}
            aria-label={`Mở hồ sơ ${member.display_name}`}
            onClick={(event) => onOpen(member.id, event.currentTarget)}
          >
            <ConnectedIdentity name={member.display_name} />
            <span>
              <strong>{member.display_name}</strong>
              <small>{member.familiar_name ?? member.hometown ?? 'Xem hồ sơ'}</small>
            </span>
            <i aria-hidden="true">→</i>
          </button>
        ))}
        {!visible.length ? <p>Chưa tìm thấy tên này.</p> : null}
      </div>
    </section>
  );
}

type ProfileMember = {
  id: string;
  display_name: string;
  familiar_name?: string | null;
  hometown?: string | null;
  biography?: string | null;
  contacts?: Array<{
    id?: string;
    kind: 'phone' | 'email' | 'facebook';
    value: string;
    visibility: 'self' | 'family';
  }>;
};

function MemberProfileSheet({
  member,
  loading,
  graph,
  members,
  selectedId,
  proposalOpen,
  onProposalOpen,
  onProposalClose,
  onClose,
  onSelect,
  onSubmit,
  onRelationshipAction,
  onError,
}: {
  member: ProfileMember | undefined;
  loading: boolean;
  graph: RelationshipGraphResponse | null;
  members: Member[];
  selectedId: string;
  proposalOpen: boolean;
  onProposalOpen: () => void;
  onProposalClose: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  onSubmit: (input: CreateRelationshipChangeRequestInput) => Promise<void>;
  onRelationshipAction: (input: CreateRelationshipChangeRequestInput) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const links = graph ? connectionsFor(graph, selectedId) : [];
  const graphMembers = new Map(graph?.nodes.map((item) => [item.id, item]) ?? []);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedId]);

  return (
    <div
      className={styles.sheetBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-sheet-name"
      >
        <button ref={closeRef} className={styles.close} type="button" onClick={onClose}>
          Đóng hồ sơ
        </button>
        {loading && !member ? <p role="status">Đang mở hồ sơ…</p> : null}
        {member ? (
          <>
            <div className={styles.sheetIdentity}>
              <ConnectedIdentity name={member.display_name} />
              <div>
                <p>NGƯỜI THÂN TRONG NHÀ</p>
                <h2 id="member-sheet-name">{member.display_name}</h2>
                <span>{member.hometown ?? 'Chưa ghi nơi ở'}</span>
              </div>
            </div>
            <p className={styles.biography}>
              {member.biography ?? 'Câu chuyện về người thân này đang chờ cả nhà cùng bổ sung.'}
            </p>
            {links.length ? (
              <section className={styles.connections} aria-labelledby="connected-relations-heading">
                <h3 id="connected-relations-heading">Quan hệ đã xác nhận</h3>
                {links.map((link) => {
                  const linked = graphMembers.get(link.member_id);
                  return linked ? (
                    <button
                      type="button"
                      key={link.relationship_id}
                      onClick={() => onSelect(link.member_id)}
                    >
                      <span>{link.label}</span>
                      <strong>{linked.display_name}</strong>
                      <i aria-hidden="true">↗</i>
                    </button>
                  ) : null;
                })}
              </section>
            ) : null}
            {links.length ? (
              <section className={styles.relationshipTools} aria-label="Chỉnh sửa quan hệ">
                {links.map((link) => {
                  const linked = graphMembers.get(link.member_id);
                  return linked ? (
                    <button
                      key={link.relationship_id}
                      type="button"
                      onClick={() => setEditingRelationshipId(link.relationship_id)}
                    >
                      Sửa quan hệ với {linked.display_name}
                    </button>
                  ) : null;
                })}
              </section>
            ) : null}
            {editingRelationshipId && graph ? (
              <RelationshipEditForm
                relationship={graph.relationships.find((item) => item.id === editingRelationshipId)}
                busy={busy}
                error={localError}
                onCancel={() => setEditingRelationshipId(null)}
                onSubmit={async (input) => {
                  setBusy(true);
                  setLocalError('');
                  try {
                    await onRelationshipAction(input);
                    setEditingRelationshipId(null);
                  } catch (error) {
                    setLocalError(explain(error));
                    onError(error);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : null}
            {'contacts' in member && member.contacts?.length ? (
              <nav className={styles.contacts} aria-label={`Liên hệ ${member.display_name}`}>
                {member.contacts.map((contact, index) => {
                  const href = safeContactHref(contact.kind, contact.value);
                  return href ? (
                    <a key={contact.id ?? `${contact.kind}:${index}`} href={href}>
                      {contactLabel(contact.kind)}
                    </a>
                  ) : null;
                })}
              </nav>
            ) : null}
            {!proposalOpen ? (
              <button className={styles.proposalButton} type="button" onClick={onProposalOpen}>
                Bổ sung quan hệ cho {member.display_name}
              </button>
            ) : (
              <ProposalForm
                selected={member}
                members={members}
                busy={busy}
                error={localError}
                onCancel={onProposalClose}
                onSubmit={async (input) => {
                  setBusy(true);
                  setLocalError('');
                  try {
                    await onSubmit(input);
                  } catch (error) {
                    setLocalError(explain(error));
                    onError(error);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </>
        ) : null}
      </aside>
    </div>
  );
}

function ProposalForm({
  selected,
  members,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  selected: ProfileMember;
  members: Member[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (input: CreateRelationshipChangeRequestInput) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kind, setKind] = useState<'parent' | 'child' | 'partner'>('parent');
  const [subtype, setSubtype] = useState('unspecified');
  const [source, setSource] = useState<'existing' | 'new'>('existing');
  const [targetId, setTargetId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familiarName, setFamiliarName] = useState('');
  const [hometown, setHometown] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const candidates = members.filter((member) => member.id !== selected.id);
  const choice: RelationshipProposalChoice =
    kind === 'partner'
      ? { kind, subtype: subtype as 'married' | 'partner' }
      : { kind, subtype: subtype as 'biological' | 'adoptive' | 'unspecified' };
  const targetName =
    source === 'new'
      ? displayName.trim()
      : (candidates.find((member) => member.id === targetId)?.display_name ?? '');

  function changeKind(next: typeof kind) {
    setKind(next);
    setSubtype(next === 'partner' ? 'married' : 'unspecified');
  }

  async function submit() {
    if (source === 'existing') {
      await onSubmit(relationshipProposal(selected.id, targetId, choice));
      return;
    }
    await onSubmit(
      newMemberProposal(selected.id, choice, {
        display_name: displayName,
        familiar_name: familiarName,
        hometown,
        ...(birthYear ? { birth_year: Number(birthYear) } : {}),
      }),
    );
  }

  return (
    <section className={styles.proposal} aria-labelledby="proposal-heading">
      <div>
        <p>ĐỀ XUẤT THAY ĐỔI · BƯỚC {step}/3</p>
        <h3 id="proposal-heading">
          {step === 1
            ? 'Người này là ai?'
            : step === 2
              ? 'Chọn đúng hồ sơ.'
              : 'Xem lại trước khi gửi.'}
        </h3>
        <span>Quan hệ chỉ xuất hiện trên cây sau khi quản trị viên xác nhận.</span>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {step === 1 ? (
        <>
          <label>
            Quan hệ với {selected.display_name}
            <select
              autoFocus
              aria-label="Người này là"
              value={kind}
              onChange={(event) => changeKind(event.target.value as typeof kind)}
            >
              <option value="parent">Cha / mẹ</option>
              <option value="child">Con</option>
              <option value="partner">Vợ / chồng hoặc bạn đời</option>
            </select>
          </label>
          <label>
            Loại quan hệ
            <select
              aria-label="Loại quan hệ"
              value={subtype}
              onChange={(event) => setSubtype(event.target.value)}
            >
              {kind === 'partner' ? (
                <>
                  <option value="married">Hôn nhân</option>
                  <option value="partner">Bạn đời</option>
                </>
              ) : (
                <>
                  <option value="unspecified">Chưa xác định</option>
                  <option value="biological">Huyết thống</option>
                  <option value="adoptive">Nuôi dưỡng</option>
                </>
              )}
            </select>
          </label>
          <button type="button" onClick={() => setStep(2)}>
            Tiếp tục
          </button>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div className={styles.sourceSwitch} role="group" aria-label="Nguồn hồ sơ">
            <button
              type="button"
              aria-pressed={source === 'existing'}
              onClick={() => setSource('existing')}
            >
              Người đã có
            </button>
            <button type="button" aria-pressed={source === 'new'} onClick={() => setSource('new')}>
              Tạo hồ sơ mới
            </button>
          </div>
          {source === 'existing' ? (
            <label>
              Chọn người thân
              <select
                aria-label="Chọn người thân"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="">Chọn trong danh bạ</option>
                {candidates.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className={styles.newMemberFields}>
              <label>
                Họ và tên
                <input
                  autoFocus
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </label>
              <label>
                Tên thường gọi
                <input
                  value={familiarName}
                  onChange={(event) => setFamiliarName(event.target.value)}
                />
              </label>
              <label>
                Quê quán
                <input value={hometown} onChange={(event) => setHometown(event.target.value)} />
              </label>
              <label>
                Năm sinh
                <input
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value)}
                />
              </label>
            </div>
          )}
          <div className={styles.proposalActions}>
            <button type="button" onClick={() => setStep(1)}>
              Quay lại
            </button>
            <button type="button" disabled={!targetName} onClick={() => setStep(3)}>
              Xem lại
            </button>
          </div>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <dl className={styles.review}>
            <div>
              <dt>Người được chọn</dt>
              <dd>{targetName}</dd>
            </div>
            <div>
              <dt>Quan hệ</dt>
              <dd>
                {proposalKindLabel(kind)} của {selected.display_name}
              </dd>
            </div>
            <div>
              <dt>Ghi nhận</dt>
              <dd>{proposalSubtypeLabel(subtype)}</dd>
            </div>
          </dl>
          <p className={styles.reviewNote}>
            Thông tin liên hệ riêng tư sẽ được bổ sung sau khi hồ sơ được duyệt.
          </p>
          <div className={styles.proposalActions}>
            <button type="button" onClick={() => setStep(2)}>
              Sửa lại
            </button>
            <button type="button" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Đang gửi…' : 'Gửi quản trị viên duyệt'}
            </button>
          </div>
        </>
      ) : null}
      <button className={styles.cancelProposal} type="button" onClick={onCancel}>
        Hủy thao tác
      </button>
    </section>
  );
}

function RelationshipEditForm({
  relationship,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  relationship: RelationshipGraphResponse['relationships'][number] | undefined;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (input: CreateRelationshipChangeRequestInput) => Promise<void>;
}) {
  const [subtype, setSubtype] = useState(relationship?.subtype ?? 'unspecified');
  if (!relationship) return null;
  const choices =
    relationship.type === 'partnership'
      ? [
          ['married', 'Hôn nhân'],
          ['partner', 'Bạn đời'],
        ]
      : [
          ['biological', 'Huyết thống'],
          ['adoptive', 'Nuôi dưỡng'],
          ['unspecified', 'Chưa xác định'],
        ];
  return (
    <section className={styles.relationshipEdit} aria-label="Xem lại thay đổi quan hệ">
      <h3>Sửa hoặc gỡ quan hệ</h3>
      {error ? <p role="alert">{error}</p> : null}
      <label>
        Loại quan hệ
        <select
          value={subtype}
          onChange={(event) => setSubtype(event.target.value as typeof subtype)}
        >
          {choices.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p>Mọi thay đổi đều chờ quản trị viên duyệt trước khi cây cập nhật.</p>
      <div className={styles.proposalActions}>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onSubmit({
              type: 'relationship_update',
              target_id: relationship.id,
              base_version: relationship.version,
              payload: { subtype: subtype as typeof relationship.subtype },
            })
          }
        >
          Gửi đề xuất sửa
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onSubmit(relationshipRemovalProposal(relationship.id, relationship.version))
          }
        >
          Gửi đề xuất gỡ
        </button>
        <button type="button" onClick={onCancel}>
          Thôi
        </button>
      </div>
    </section>
  );
}

function proposalKindLabel(kind: 'parent' | 'child' | 'partner') {
  if (kind === 'parent') return 'Cha / mẹ';
  if (kind === 'child') return 'Con';
  return 'Vợ / chồng hoặc bạn đời';
}

function proposalSubtypeLabel(subtype: string) {
  if (subtype === 'biological') return 'Huyết thống';
  if (subtype === 'adoptive') return 'Nuôi dưỡng';
  if (subtype === 'married') return 'Hôn nhân';
  if (subtype === 'partner') return 'Bạn đời';
  return 'Chưa xác định';
}

function pendingLabel(requestItem: RelationshipChangeRequestDto, members: Member[]) {
  const names = new Map(members.map((member) => [member.id, member.display_name]));
  if (
    requestItem.type === 'member_create' &&
    requestItem.payload &&
    'member' in requestItem.payload
  ) {
    return `Thêm ${requestItem.payload.member.display_name} vào gia phả`;
  }
  if (requestItem.type === 'relationship_remove') return 'Gỡ một quan hệ đã xác nhận';
  if (requestItem.type === 'relationship_update') return 'Sửa loại quan hệ đã xác nhận';
  if (requestItem.payload && 'from_member_id' in requestItem.payload) {
    return `${names.get(requestItem.payload.from_member_id) ?? 'Một người thân'} ↔ ${names.get(requestItem.payload.to_member_id) ?? 'một người thân'}`;
  }
  return 'Thay đổi gia phả';
}

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function contactLabel(kind: 'phone' | 'email' | 'facebook') {
  if (kind === 'phone') return 'Gọi điện';
  if (kind === 'email') return 'Gửi email';
  return 'Mở Facebook';
}
