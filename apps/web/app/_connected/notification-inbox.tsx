'use client';

import type {
  EventReminderOffset,
  NotificationDto,
  NotificationPreferencesDto,
} from '@family/contracts';
import { useEffect, useRef, useState } from 'react';
import styles from './notification-inbox.module.css';

const offsets: Array<{ value: EventReminderOffset; label: string; hint: string }> = [
  { value: 'seven_days', label: 'Trước 7 ngày', hint: 'Đủ thời gian để cả nhà sắp xếp.' },
  { value: 'one_day', label: 'Trước 1 ngày', hint: 'Nhắc lại vào ngày hôm trước.' },
  { value: 'same_day', label: 'Trong ngày', hint: 'Một lời nhắc vào sáng hôm đó.' },
];

export function NotificationInbox({
  open,
  loading,
  notifications,
  hasMore,
  preferences,
  error,
  onClose,
  onRefresh,
  onLoadMore,
  onOpenNotification,
  onSavePreferences,
}: {
  open: boolean;
  loading: boolean;
  notifications: NotificationDto[];
  hasMore: boolean;
  preferences: NotificationPreferencesDto | null;
  error: string;
  onClose: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenNotification: (notification: NotificationDto) => void;
  onSavePreferences: (offsets: EventReminderOffset[]) => Promise<void>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<EventReminderOffset[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      closeRef.current?.focus();
    } else {
      triggerRef.current?.focus();
      triggerRef.current = null;
    }
  }, [open]);
  if (!open) return null;

  function close() {
    setSettingsOpen(false);
    onClose();
  }

  function toggleOffset(value: EventReminderOffset) {
    setDraft((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  async function save() {
    setSaving(true);
    try {
      await onSavePreferences(draft);
      setSettingsOpen(false);
    } catch {
      // The parent keeps the latest preferences and exposes the recoverable error in this sheet.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={styles.layer}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <aside
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-inbox-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
          if (event.key !== 'Tab') return;
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), a[href]',
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
        }}
      >
        <header className={styles.header}>
          <div>
            <p>LỜI NHẮC CỦA NHÀ</p>
            <h2 id="notification-inbox-title">Thông báo</h2>
          </div>
          <button ref={closeRef} type="button" onClick={close} aria-label="Đóng thông báo">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.toolbar}>
          <button
            type="button"
            onClick={() => {
              if (settingsOpen) setSettingsOpen(false);
              else {
                setDraft(preferences?.reminder_offsets ?? []);
                setSettingsOpen(true);
              }
            }}
          >
            {settingsOpen ? 'Trở về lời nhắc' : 'Chọn mốc nhắc'}
          </button>
          <button type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>

        {error && (
          <div className={styles.localError} role="alert">
            <strong>Chưa cập nhật được.</strong>
            <span>{error} Những lời nhắc đã tải vẫn được giữ lại.</span>
          </div>
        )}

        {settingsOpen ? (
          <section className={styles.preferences} aria-labelledby="reminder-preferences-title">
            <h3 id="reminder-preferences-title">Khi nào nhà mình nhắc bạn?</h3>
            <p>Bạn có thể chọn một, nhiều hoặc tắt cả ba mốc. Thay đổi chỉ áp dụng cho bạn.</p>
            <div className={styles.offsets}>
              {offsets.map((offset) => (
                <label key={offset.value}>
                  <input
                    type="checkbox"
                    checked={draft.includes(offset.value)}
                    onChange={() => toggleOffset(offset.value)}
                  />
                  <span>
                    <strong>{offset.label}</strong>
                    <small>{offset.hint}</small>
                  </span>
                </label>
              ))}
            </div>
            <p className={styles.quietHours}>
              Giờ nghỉ được giữ từ 21:00 đến 07:00 (giờ Việt Nam).
            </p>
            <button
              className={styles.save}
              type="button"
              onClick={() => void save()}
              disabled={saving || !preferences}
            >
              {saving ? 'Đang lưu…' : preferences ? 'Lưu mốc nhắc' : 'Đang tải mốc nhắc…'}
            </button>
          </section>
        ) : loading && notifications.length === 0 ? (
          <p className={styles.loading} role="status">
            Đang tìm lời nhắc của bạn…
          </p>
        ) : notifications.length > 0 ? (
          <ol className={styles.list} aria-label="Danh sách thông báo">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={notification.read_at ? styles.read : styles.unread}
              >
                <button type="button" onClick={() => onOpenNotification(notification)}>
                  <span className={styles.marker} aria-hidden="true" />
                  <span className={styles.copy}>
                    <strong>Nhà mình có một ngày quan trọng sắp tới.</strong>
                    <small>
                      {offsetLabel(notification.reminder_offset)} ·{' '}
                      {formatTime(notification.created_at)}
                    </small>
                  </span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            ))}
            {hasMore && (
              <li className={styles.moreRow}>
                <button type="button" onClick={onLoadMore} disabled={loading}>
                  Xem lời nhắc cũ hơn
                </button>
              </li>
            )}
          </ol>
        ) : (
          <section className={styles.empty}>
            <span aria-hidden="true">✓</span>
            <h3>Chưa có lời nhắc mới.</h3>
            <p>Khi một ngày quan trọng đến gần, lời nhắc riêng của bạn sẽ nằm ở đây.</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function offsetLabel(value: EventReminderOffset) {
  return offsets.find((offset) => offset.value === value)?.label ?? 'Lời nhắc';
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}
