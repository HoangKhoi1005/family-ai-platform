'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { MemberProfileDto, RelationshipGraphResponse } from '@family/contracts';
import { explain, request, RequestError } from './api';
import type { Member } from './types';
import { ConnectedIdentity } from './connected-app-shell';
import {
  buildTreeRows,
  connectionsFor,
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

  const rows = useMemo(() => (graph ? buildTreeRows(graph) : []), [graph]);
  const graphMembers = useMemo(
    () => new Map(graph?.nodes.map((member) => [member.id, member]) ?? []),
    [graph],
  );
  const root = rootMemberId ? graphMembers.get(rootMemberId) : undefined;
  const statements = useMemo(() => (graph ? relationshipStatements(graph) : []), [graph]);

  async function openProfile(memberId: string, button?: HTMLButtonElement) {
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
  }

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
          ) : graph && rows.length ? (
            <section className={styles.canvas} aria-label="Sơ đồ quan hệ gia đình đã xác nhận">
              <div className={styles.canvasIntro}>
                <span>QUANH HỒ SƠ CỦA BẠN · {graph.depth} BƯỚC KẾT NỐI</span>
                <h2>Quanh {root?.familiar_name ?? root?.display_name ?? 'bạn'}</h2>
              </div>
              <div className={styles.rows}>
                {rows.map((row) => (
                  <section className={styles.generation} key={row.level}>
                    <p>{generationLabel(row.level)}</p>
                    <div className={styles.nodes}>
                      {row.members.map((member) => {
                        const connection = rootMemberId
                          ? connectionsFor(graph, rootMemberId).find(
                              (item) => item.member_id === member.id,
                            )
                          : undefined;
                        return (
                          <div className={styles.nodeWrap} key={member.id}>
                            {connection ? <span>{connection.label}</span> : null}
                            <button
                              className={member.id === rootMemberId ? styles.rootNode : styles.node}
                              type="button"
                              aria-label={`Mở hồ sơ ${member.display_name}`}
                              onClick={(event) => void openProfile(member.id, event.currentTarget)}
                            >
                              <ConnectedIdentity name={member.display_name} />
                              <strong>{member.familiar_name ?? member.display_name}</strong>
                              <small>
                                {member.deceased
                                  ? 'Hồ sơ tưởng nhớ'
                                  : (member.hometown ?? 'Người thân')}
                              </small>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
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
          onClose={closeProfile}
          onSelect={(id) => void openProfile(id)}
          onSubmit={async (choice, targetMemberId) => {
            await request(
              `${base}/change-requests`,
              relationshipProposal(selectedId, targetMemberId, choice),
            );
            setProposalOpen(false);
            setMessage('Đã gửi đề xuất. Quản trị viên sẽ kiểm tra trước khi cây thay đổi.');
          }}
          onError={onError}
        />
      ) : null}
    </section>
  );
}

function generationLabel(level: number) {
  if (level === 0) return 'VỊ TRÍ ĐANG XEM';
  if (level < 0) return level === -1 ? 'THẾ HỆ TRƯỚC' : `${Math.abs(level)} THẾ HỆ TRƯỚC`;
  return level === 1 ? 'THẾ HỆ SAU' : `${level} THẾ HỆ SAU`;
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
  onClose,
  onSelect,
  onSubmit,
  onError,
}: {
  member: ProfileMember | undefined;
  loading: boolean;
  graph: RelationshipGraphResponse | null;
  members: Member[];
  selectedId: string;
  proposalOpen: boolean;
  onProposalOpen: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  onSubmit: (choice: RelationshipProposalChoice, targetMemberId: string) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
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
                onSubmit={async (choice, targetMemberId) => {
                  setBusy(true);
                  setLocalError('');
                  try {
                    await onSubmit(choice, targetMemberId);
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
  onSubmit,
}: {
  selected: ProfileMember;
  members: Member[];
  busy: boolean;
  error: string;
  onSubmit: (choice: RelationshipProposalChoice, targetMemberId: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<'parent' | 'child' | 'partner'>('parent');
  const kindRef = useRef<HTMLSelectElement>(null);
  const candidates = members.filter((member) => member.id !== selected.id);
  useEffect(() => {
    kindRef.current?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = String(data.get('target'));
    const subtype = String(data.get('subtype'));
    const choice: RelationshipProposalChoice =
      kind === 'partner'
        ? { kind, subtype: subtype as 'married' | 'partner' }
        : { kind, subtype: subtype as 'biological' | 'adoptive' | 'unspecified' };
    await onSubmit(choice, target);
  }
  return (
    <form className={styles.proposal} onSubmit={(event) => void submit(event)}>
      <div>
        <p>ĐỀ XUẤT THAY ĐỔI</p>
        <h3>Nối thêm một người.</h3>
        <span>Đề xuất chỉ thành quan hệ chính thức sau khi quản trị viên duyệt.</span>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <label>
        Người này là
        <select
          ref={kindRef}
          aria-label="Người này là"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          <option value="parent">Cha / mẹ của {selected.display_name}</option>
          <option value="child">Con của {selected.display_name}</option>
          <option value="partner">Bạn đời của {selected.display_name}</option>
        </select>
      </label>
      <label>
        Chọn người thân
        <select aria-label="Chọn người thân" name="target" required defaultValue="">
          <option value="" disabled>
            Chọn trong danh bạ
          </option>
          {candidates.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Loại quan hệ
        <select
          key={kind}
          aria-label="Loại quan hệ"
          name="subtype"
          defaultValue={kind === 'partner' ? 'married' : 'unspecified'}
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
      <button type="submit" disabled={busy || !candidates.length}>
        {busy ? 'Đang gửi…' : 'Gửi đề xuất'}
      </button>
    </form>
  );
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
