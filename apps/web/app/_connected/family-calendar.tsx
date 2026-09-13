'use client';

import type {
  CreateEventInput,
  EventDetailResponse,
  EventOccurrenceDto,
  EventRsvpResponse,
} from '@family/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { explain, getFamilyEvent, RequestError } from './api';
import {
  calendarDraftFromEvent,
  calendarDraftPreview,
  calendarDraftToInput,
  createCalendarDraft,
  type CalendarDraft,
} from './calendar-form-model';
import type { CalendarTimelineState } from './calendar-state';
import { ConnectedIdentity } from './connected-app-shell';
import type { Member } from './types';
import styles from './family-calendar.module.css';

interface CalendarSharedProps {
  timeline: CalendarTimelineState;
  members: Member[];
  onOpen: (occurrenceId?: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

export function CalendarHomeSection(props: CalendarSharedProps) {
  const visible = props.timeline.occurrences.slice(0, 3);
  return (
    <section className={styles.home} aria-label="Ngày gần nhất">
      <div className={styles.homeHeading}>
        <div>
          <p>NGÀY QUAN TRỌNG</p>
          <h2>Ngày gần nhất</h2>
        </div>
        {props.timeline.occurrences.length > 0 ? (
          <button type="button" onClick={() => props.onOpen()}>
            Xem tất cả ngày quan trọng <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>

      {props.timeline.phase === 'loading' && visible.length === 0 ? (
        <p className={styles.loading} role="status">
          Đang xem lịch nhà…
        </p>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyDate} aria-hidden="true">
            —
          </span>
          <div>
            <h3>Nhà mình chưa ghi ngày nào</h3>
            <p>Ghi một sinh nhật, ngày giỗ hoặc buổi sum họp để cả nhà cùng nhớ.</p>
            <button type="button" onClick={props.onCreate}>
              Thêm ngày quan trọng
            </button>
          </div>
        </div>
      ) : (
        <ol className={styles.homeList}>
          {visible.map((occurrence, index) => (
            <li key={occurrence.id} className={index === 0 ? styles.homeFeatured : undefined}>
              <OccurrenceButton
                occurrence={occurrence}
                member={memberFor(props.members, occurrence)}
                onOpen={() => props.onOpen(occurrence.id)}
              />
            </li>
          ))}
        </ol>
      )}

      {props.timeline.phase === 'refresh-error' ? (
        <div className={styles.localError} role="alert">
          <span>Lịch chưa cập nhật được. Bạn vẫn đang xem lần tải gần nhất.</span>
          <button type="button" onClick={props.onRefresh}>
            Thử lại
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function FamilyCalendarTimeline({
  familyId,
  timeline,
  members,
  selectedOccurrenceId,
  onBack,
  onSelectOccurrence,
  onRefresh,
  onRsvp,
  createRequested,
  onCreateRequestClose,
  onCreateEvent,
  onUpdateEvent,
  onCancelEvent,
  onError,
}: {
  familyId: string;
  timeline: CalendarTimelineState;
  members: Member[];
  selectedOccurrenceId: string | null;
  onBack: () => void;
  onSelectOccurrence: (occurrenceId: string | null) => void;
  onRefresh: () => void;
  onRsvp: (occurrenceId: string, response: EventRsvpResponse) => Promise<void>;
  createRequested: boolean;
  onCreateRequestClose: () => void;
  onCreateEvent: (event: CreateEventInput, idempotencyKey: string) => Promise<EventDetailResponse>;
  onUpdateEvent: (
    eventId: string,
    version: number,
    event: CreateEventInput,
  ) => Promise<EventDetailResponse>;
  onCancelEvent: (eventId: string, version: number) => Promise<EventDetailResponse>;
  onError: (familyId: string, error: unknown) => void;
}) {
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const [editorDetail, setEditorDetail] = useState<EventDetailResponse | 'create' | null>(null);
  const groups = useMemo(() => groupOccurrences(timeline.occurrences), [timeline.occurrences]);
  const selected = timeline.occurrences.find((item) => item.id === selectedOccurrenceId) ?? null;
  const closeDetail = useCallback(() => {
    const previousId = selectedOccurrenceId;
    onSelectOccurrence(null);
    if (previousId) requestAnimationFrame(() => triggers.current.get(previousId)?.focus());
  }, [onSelectOccurrence, selectedOccurrenceId]);

  const activeEditorDetail = editorDetail ?? (createRequested ? 'create' : null);

  return (
    <section className={styles.timelinePage}>
      <button className={styles.back} type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Trở về Nhà
      </button>
      <header className={styles.timelineHeader}>
        <p>LỊCH NHÀ</p>
        <h1>Ngày quan trọng của nhà mình.</h1>
        <span>Những ngày cả nhà muốn nhớ, xếp theo lần diễn ra gần nhất.</span>
        <button type="button" onClick={() => setEditorDetail('create')}>
          Thêm ngày quan trọng
        </button>
      </header>

      {timeline.phase === 'loading' && timeline.occurrences.length === 0 ? (
        <p className={styles.timelineState} role="status">
          Đang mở lịch nhà…
        </p>
      ) : groups.length === 0 ? (
        <div className={styles.timelineState}>
          <strong>Chưa có ngày nào trong lịch.</strong>
          <span>Ngày đầu tiên có thể là một sinh nhật, ngày giỗ hoặc buổi sum họp.</span>
        </div>
      ) : (
        <div className={styles.months}>
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`calendar-month-${group.key}`}>
              <h2 id={`calendar-month-${group.key}`}>{group.label}</h2>
              <ol>
                {group.occurrences.map((occurrence) => (
                  <li key={occurrence.id}>
                    <OccurrenceButton
                      occurrence={occurrence}
                      member={memberFor(members, occurrence)}
                      buttonRef={(node) => {
                        if (node) triggers.current.set(occurrence.id, node);
                        else triggers.current.delete(occurrence.id);
                      }}
                      onOpen={() => onSelectOccurrence(occurrence.id)}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {timeline.phase === 'refresh-error' ? (
        <div className={styles.localError} role="alert">
          <span>Lịch chưa cập nhật được. Các ngày bên dưới là lần tải gần nhất.</span>
          <button type="button" onClick={onRefresh}>
            Cập nhật lịch
          </button>
        </div>
      ) : null}

      {selected ? (
        <CalendarDetail
          key={selected.id}
          familyId={familyId}
          occurrence={selected}
          member={memberFor(members, selected)}
          onClose={closeDetail}
          onRsvp={onRsvp}
          onEdit={(detail) => {
            closeDetail();
            setEditorDetail(detail);
          }}
          onCancel={async (detail) => {
            await onCancelEvent(detail.event.id, detail.event.version);
            closeDetail();
          }}
          onError={onError}
        />
      ) : null}
      {activeEditorDetail ? (
        <CalendarEditor
          familyId={familyId}
          members={members}
          initialDetail={activeEditorDetail === 'create' ? null : activeEditorDetail}
          onClose={() => {
            setEditorDetail(null);
            onCreateRequestClose();
          }}
          onCreate={onCreateEvent}
          onUpdate={onUpdateEvent}
        />
      ) : null}
    </section>
  );
}

function OccurrenceButton({
  occurrence,
  member,
  onOpen,
  buttonRef,
}: {
  occurrence: EventOccurrenceDto;
  member: Member | undefined;
  onOpen: () => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  const [year, month, day] = occurrence.local_date.split('-');
  return (
    <button
      ref={buttonRef}
      className={styles.occurrence}
      type="button"
      aria-label={`Mở ${occurrence.event.title}, ngày ${day}/${month}/${year}`}
      onClick={onOpen}
    >
      <time dateTime={occurrence.local_date} className={styles.dateBlock}>
        <strong>{day}</strong>
        <span>thg {Number(month)}</span>
      </time>
      <span className={styles.portrait} aria-hidden="true">
        {member ? <ConnectedIdentity name={member.familiar_name ?? member.display_name} /> : <i />}
      </span>
      <span className={styles.occurrenceCopy}>
        <strong>{occurrence.event.title}</strong>
        <small>
          {occurrence.event.calendar_type === 'lunar_vietnamese' ? 'Âm lịch' : 'Dương lịch'}
          {' · '}
          {occurrence.event.all_day ? 'Cả ngày' : timeLabel(occurrence.starts_at)}
          {occurrence.my_rsvp ? ` · ${rsvpLabel(occurrence.my_rsvp)}` : ''}
        </small>
      </span>
      <span className={styles.disclosure} aria-hidden="true">
        ↗
      </span>
    </button>
  );
}

function CalendarDetail({
  familyId,
  occurrence,
  member,
  onClose,
  onRsvp,
  onEdit,
  onCancel,
  onError,
}: {
  familyId: string;
  occurrence: EventOccurrenceDto;
  member: Member | undefined;
  onClose: () => void;
  onRsvp: (occurrenceId: string, response: EventRsvpResponse) => Promise<void>;
  onEdit: (detail: EventDetailResponse) => void;
  onCancel: (detail: EventDetailResponse) => Promise<void>;
  onError: (familyId: string, error: unknown) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [detailError, setDetailError] = useState('');
  const [savingResponse, setSavingResponse] = useState<EventRsvpResponse | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getFamilyEvent(familyId, occurrence.event_id, { signal: controller.signal })
      .then(setDetail)
      .catch((error) => {
        if (controller.signal.aborted) return;
        setDetailError(explain(error));
        onError(familyId, error);
      });
    return () => controller.abort();
  }, [familyId, occurrence.event_id, onError]);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      const first = focusable?.[0];
      const last = focusable?.[focusable.length - 1];
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
  }, [onClose]);

  async function respond(response: EventRsvpResponse) {
    setSavingResponse(response);
    setDetailError('');
    try {
      await onRsvp(occurrence.id, response);
    } catch (error) {
      setDetailError(explain(error));
      onError(familyId, error);
    } finally {
      setSavingResponse(null);
    }
  }

  return (
    <div
      className={styles.detailBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={dialogRef}
        className={styles.detail}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-detail-title"
      >
        <button ref={closeRef} className={styles.detailClose} type="button" onClick={onClose}>
          Đóng
        </button>
        <div className={styles.detailDate}>
          <time dateTime={occurrence.local_date}>{fullDateLabel(occurrence.local_date)}</time>
          <span>
            {occurrence.event.calendar_type === 'lunar_vietnamese' ? 'Âm lịch' : 'Dương lịch'}
          </span>
        </div>
        <h2 id="calendar-detail-title">{occurrence.event.title}</h2>
        {member ? (
          <div className={styles.relatedMember}>
            <ConnectedIdentity name={member.familiar_name ?? member.display_name} />
            <span>
              <small>Người thân liên quan</small>
              <strong>{member.familiar_name ?? member.display_name}</strong>
            </span>
          </div>
        ) : null}

        {detail ? (
          <dl className={styles.detailFacts}>
            <div>
              <dt>Thời gian</dt>
              <dd>{occurrence.event.all_day ? 'Cả ngày' : timeLabel(occurrence.starts_at)}</dd>
            </div>
            {detail.event.location ? (
              <div>
                <dt>Nơi gặp</dt>
                <dd>{detail.event.location}</dd>
              </div>
            ) : null}
            {detail.event.note ? (
              <div>
                <dt>Chuyện cần nhớ</dt>
                <dd>{detail.event.note}</dd>
              </div>
            ) : null}
          </dl>
        ) : detailError ? null : (
          <p role="status" className={styles.detailLoading}>
            Đang mở ngày này…
          </p>
        )}

        <fieldset className={styles.rsvp} disabled={savingResponse !== null}>
          <legend>Bạn có tham gia không?</legend>
          {(['yes', 'maybe', 'no'] as const).map((response) => (
            <button
              key={response}
              type="button"
              aria-pressed={occurrence.my_rsvp === response}
              onClick={() => void respond(response)}
            >
              {response === 'yes'
                ? 'Tôi sẽ tham gia'
                : response === 'maybe'
                  ? 'Có thể'
                  : 'Không tham gia'}
            </button>
          ))}
        </fieldset>
        {savingResponse ? <p role="status">Đang ghi câu trả lời…</p> : null}
        {detail?.event.can_edit ? (
          <div className={styles.ownerActions}>
            <button type="button" onClick={() => onEdit(detail)}>
              Sửa ngày này
            </button>
            {!confirmingCancel ? (
              <button type="button" onClick={() => setConfirmingCancel(true)}>
                Hủy ngày này
              </button>
            ) : (
              <div className={styles.cancelConfirm}>
                <p>Ngày này sẽ rời khỏi lịch sắp tới của cả nhà.</p>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={async () => {
                    setCancelling(true);
                    setDetailError('');
                    try {
                      await onCancel(detail);
                    } catch (error) {
                      setDetailError(explain(error));
                      onError(familyId, error);
                      setCancelling(false);
                    }
                  }}
                >
                  {cancelling ? 'Đang hủy…' : 'Xác nhận hủy ngày này'}
                </button>
                <button type="button" onClick={() => setConfirmingCancel(false)}>
                  Giữ lại
                </button>
              </div>
            )}
          </div>
        ) : null}
        {detailError ? <p role="alert">{detailError}</p> : null}
      </aside>
    </div>
  );
}

function CalendarEditor({
  familyId,
  members,
  initialDetail,
  onClose,
  onCreate,
  onUpdate,
}: {
  familyId: string;
  members: Member[];
  initialDetail: EventDetailResponse | null;
  onClose: () => void;
  onCreate: (event: CreateEventInput, idempotencyKey: string) => Promise<EventDetailResponse>;
  onUpdate: (
    eventId: string,
    version: number,
    event: CreateEventInput,
  ) => Promise<EventDetailResponse>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const idempotencyKey = useRef(`calendar-${globalThis.crypto.randomUUID()}`);
  const [editingDetail, setEditingDetail] = useState(initialDetail);
  const [draft, setDraft] = useState<CalendarDraft>(() =>
    initialDetail ? calendarDraftFromEvent(initialDetail.event) : createCalendarDraft(),
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<EventDetailResponse | null>(null);
  const isEditing = editingDetail !== null;
  const titleId = 'calendar-editor-title';
  const preview = useMemo(() => {
    try {
      return { dates: calendarDraftPreview(draft), error: '' };
    } catch (previewError) {
      return {
        dates: [] as string[],
        error: previewError instanceof Error ? previewError.message : 'Ngày chưa hợp lệ',
      };
    }
  }, [draft]);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      const first = focusable?.[0];
      const last = focusable?.[focusable.length - 1];
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
  }, [onClose, saving]);

  function update(patch: Partial<CalendarDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError('');
    setConflict(null);
  }

  function continueFromIdentity() {
    if (!draft.title.trim()) {
      setError('Ghi tên ngày quan trọng trước khi tiếp tục.');
      return;
    }
    if (draft.kind === 'birthday' && !draft.memberId) {
      setError('Chọn người có ngày sinh nhật.');
      return;
    }
    setError('');
    setStep(2);
  }

  function continueFromDate() {
    if (preview.error) {
      setError('');
      return;
    }
    setError('');
    setStep(3);
  }

  async function save() {
    setSaving(true);
    setError('');
    setConflict(null);
    try {
      const input = calendarDraftToInput(draft);
      if (editingDetail) {
        await onUpdate(editingDetail.event.id, editingDetail.event.version, input);
      } else {
        await onCreate(input, idempotencyKey.current);
      }
      onClose();
    } catch (saveError) {
      if (saveError instanceof RequestError && saveError.status === 409 && editingDetail) {
        try {
          const latest = await getFamilyEvent(familyId, editingDetail.event.id);
          setConflict(latest);
          setError('Ngày này vừa được người khác cập nhật. Xem bản mới trước khi sửa tiếp.');
        } catch (reloadError) {
          setError(explain(reloadError));
        }
      } else {
        setError(explain(saveError));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editorBackdrop} role="presentation">
      <aside
        ref={dialogRef}
        className={styles.editor}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.editorTopbar}>
          <div>
            <span>BƯỚC {step} / 3</span>
            <h2 id={titleId}>{isEditing ? 'Sửa ngày quan trọng' : 'Thêm ngày quan trọng'}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={saving}>
            Đóng
          </button>
        </div>

        <div className={styles.stepLine} aria-label={`Bước ${step} trên 3`}>
          {[1, 2, 3].map((number) => (
            <span key={number} data-active={number <= step} />
          ))}
        </div>

        {step === 1 ? (
          <div className={styles.editorFields}>
            <label>
              Đây là ngày gì?
              <select
                value={draft.kind}
                onChange={(event) => update({ kind: event.target.value as CalendarDraft['kind'] })}
              >
                <option value="gathering">Họp mặt / bữa cơm</option>
                <option value="birthday">Sinh nhật</option>
                <option value="death_anniversary">Ngày giỗ</option>
                <option value="wedding_anniversary">Kỷ niệm cưới</option>
                <option value="other">Ngày khác</option>
              </select>
            </label>
            <label>
              Tên ngày
              <input
                value={draft.title}
                maxLength={160}
                onChange={(event) => update({ title: event.target.value })}
                placeholder="Ví dụ: Bữa cơm cuối tháng"
              />
            </label>
            <label>
              Người thân liên quan
              <select
                value={draft.memberId}
                onChange={(event) => update({ memberId: event.target.value })}
              >
                <option value="">Không gắn với một người</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.familiar_name ?? member.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className={styles.editorFields}>
            <label>
              Dùng lịch
              <select
                value={draft.calendarType}
                onChange={(event) =>
                  update({ calendarType: event.target.value as CalendarDraft['calendarType'] })
                }
              >
                <option value="gregorian">Dương lịch</option>
                <option value="lunar_vietnamese">Âm lịch Việt Nam</option>
              </select>
            </label>
            {draft.calendarType === 'gregorian' ? (
              <label>
                Ngày diễn ra
                <input
                  type="date"
                  value={dateInputValue(draft.date)}
                  onChange={(event) => update({ date: dateInputParts(event.target.value) })}
                />
              </label>
            ) : (
              <div className={styles.lunarDateGroup}>
                <div className={styles.lunarDateFields}>
                  <label>
                    Ngày âm
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={30}
                      value={draft.date.day || ''}
                      onChange={(event) =>
                        update({ date: { ...draft.date, day: Number(event.target.value) } })
                      }
                    />
                  </label>
                  <label>
                    Tháng âm
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={12}
                      value={draft.date.month || ''}
                      onChange={(event) =>
                        update({ date: { ...draft.date, month: Number(event.target.value) } })
                      }
                    />
                  </label>
                  <label>
                    Năm nguồn
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1200}
                      max={2199}
                      value={draft.date.year ?? ''}
                      onChange={(event) =>
                        update({
                          date: {
                            ...draft.date,
                            year: event.target.value ? Number(event.target.value) : null,
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <p>
                  Năm nguồn giúp kiểm tra đúng tháng nhuận. Nếu lặp hằng năm, nhà mình vẫn giữ ngày
                  và tháng âm đã chọn.
                </p>
              </div>
            )}
            <label>
              Lặp lại
              <select
                value={draft.recurrence}
                onChange={(event) => {
                  const recurrence = event.target.value as CalendarDraft['recurrence'];
                  update({
                    recurrence,
                    ...(recurrence === 'none' && draft.lunarMonthMode === 'both'
                      ? { lunarMonthMode: 'regular' as const }
                      : {}),
                  });
                }}
              >
                <option value="none">Chỉ một lần</option>
                <option value="yearly">Hằng năm</option>
              </select>
            </label>
            {draft.calendarType === 'lunar_vietnamese' ? (
              <div className={styles.policyFields}>
                <label>
                  Nếu có tháng nhuận
                  <select
                    value={draft.lunarMonthMode}
                    onChange={(event) =>
                      update({
                        lunarMonthMode: event.target.value as CalendarDraft['lunarMonthMode'],
                      })
                    }
                  >
                    <option value="regular">Chỉ tháng thường</option>
                    <option value="leap_only">Chỉ tháng nhuận</option>
                    <option value="both">Cả tháng thường và tháng nhuận</option>
                  </select>
                </label>
                <label>
                  Nếu tháng âm không có ngày 30
                  <select
                    value={draft.missingLunarDay}
                    onChange={(event) =>
                      update({
                        missingLunarDay: event.target.value as CalendarDraft['missingLunarDay'],
                      })
                    }
                  >
                    <option value="last_day">Dùng ngày cuối tháng</option>
                    <option value="skip">Bỏ qua năm đó</option>
                  </select>
                </label>
              </div>
            ) : null}
            {draft.calendarType === 'gregorian' &&
            draft.recurrence === 'yearly' &&
            draft.date.month === 2 &&
            draft.date.day === 29 ? (
              <label>
                Năm không có 29/2
                <select
                  value={draft.feb29Policy}
                  onChange={(event) =>
                    update({ feb29Policy: event.target.value as CalendarDraft['feb29Policy'] })
                  }
                >
                  <option value="feb28">Nhắc ngày 28/2</option>
                  <option value="mar1">Nhắc ngày 1/3</option>
                  <option value="skip">Bỏ qua năm đó</option>
                </select>
              </label>
            ) : null}
            <label className={styles.checkLine}>
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(event) => update({ allDay: event.target.checked })}
              />
              Cả ngày
            </label>
            {!draft.allDay ? (
              <label>
                Giờ bắt đầu
                <input
                  type="time"
                  value={draft.startsLocalTime}
                  onChange={(event) => update({ startsLocalTime: event.target.value })}
                />
              </label>
            ) : null}
            <p
              className={preview.error ? styles.previewError : styles.previewInline}
              role={preview.error ? 'alert' : undefined}
            >
              {preview.error
                ? preview.error
                : `Lần gần nhất: ${preview.dates.map(formatPreviewDate).join(' và ')}`}
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.editorFields}>
            <div className={styles.previewDate}>
              <span>LẦN DIỄN RA GẦN NHẤT</span>
              <strong>{preview.dates.map(formatPreviewDate).join(' và ')}</strong>
              <small>
                {draft.calendarType === 'lunar_vietnamese'
                  ? 'Ngày âm đã được xác minh'
                  : 'Dương lịch'}
              </small>
            </div>
            <label>
              Nơi gặp
              <input
                value={draft.location}
                maxLength={300}
                onChange={(event) => update({ location: event.target.value })}
                placeholder="Có thể để trống"
              />
            </label>
            <label>
              Chuyện cần nhớ
              <textarea
                value={draft.note}
                maxLength={2000}
                rows={3}
                onChange={(event) => update({ note: event.target.value })}
              />
            </label>
            <fieldset className={styles.reminders}>
              <legend>Nhắc cả nhà</legend>
              {(
                [
                  ['seven_days', 'Trước 7 ngày'],
                  ['one_day', 'Trước 1 ngày'],
                  ['same_day', 'Trong ngày'],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={draft.reminderOffsets.includes(value)}
                    onChange={(event) =>
                      update({
                        reminderOffsets: event.target.checked
                          ? [...draft.reminderOffsets, value]
                          : draft.reminderOffsets.filter((item) => item !== value),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        ) : null}

        {conflict ? (
          <div className={styles.conflict}>
            <strong>Bản mới nhất: {conflict.event.title}</strong>
            <button
              type="button"
              onClick={() => {
                setEditingDetail(conflict);
                setDraft(calendarDraftFromEvent(conflict.event));
                setConflict(null);
                setError('');
                setStep(1);
              }}
            >
              Dùng bản mới để sửa tiếp
            </button>
          </div>
        ) : null}
        {error ? (
          <p className={styles.editorError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.editorActions}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep((step - 1) as 1 | 2)} disabled={saving}>
              Quay lại
            </button>
          ) : (
            <span />
          )}
          {step === 1 ? (
            <button type="button" onClick={continueFromIdentity}>
              Tiếp: Chọn ngày
            </button>
          ) : step === 2 ? (
            <button type="button" onClick={continueFromDate}>
              Tiếp: Nhắc cả nhà
            </button>
          ) : (
            <button type="button" onClick={() => void save()} disabled={saving || !!preview.error}>
              {saving ? 'Đang lưu…' : isEditing ? 'Lưu thay đổi' : 'Lưu ngày quan trọng'}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function memberFor(members: Member[], occurrence: EventOccurrenceDto) {
  return members.find((member) => member.id === occurrence.event.member_id);
}

function dateInputValue(date: CalendarDraft['date']) {
  return `${String(date.year ?? new Date().getFullYear()).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function dateInputParts(value: string): CalendarDraft['date'] {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year || null, month: month || 1, day: day || 1 };
}

function formatPreviewDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function timeLabel(startsAt: string | null) {
  if (!startsAt) return 'Chưa ghi giờ';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startsAt));
}

function fullDateLabel(localDate: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${localDate}T00:00:00.000Z`));
}

function rsvpLabel(response: EventRsvpResponse) {
  if (response === 'yes') return 'Sẽ tham gia';
  if (response === 'maybe') return 'Có thể tham gia';
  return 'Không tham gia';
}

function groupOccurrences(occurrences: EventOccurrenceDto[]) {
  const groups = new Map<string, EventOccurrenceDto[]>();
  for (const occurrence of occurrences) {
    const key = occurrence.local_date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }
  return [...groups].map(([key, items]) => {
    const [year, month] = key.split('-');
    return {
      key,
      label: `Tháng ${Number(month)}, ${year}`,
      occurrences: items,
    };
  });
}
