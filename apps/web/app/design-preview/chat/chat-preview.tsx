'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { getPreviewMember, previewMember } from '../fixtures';
import styles from '../mobile.module.css';
import { PreviewIdentity } from '../preview-identity';

type ThreadId = 'family' | 'minh-anh' | 'thanh-huong';

export function ChatPreview({ initialThread }: { initialThread: ThreadId | undefined }) {
  const [selectedThread, setSelectedThread] = useState<ThreadId | null>(initialThread ?? null);
  const [message, setMessage] = useState('');
  const [sentMessages, setSentMessages] = useState<Record<ThreadId, string[]>>({
    family: [],
    'minh-anh': [],
    'thanh-huong': [],
  });
  const minhAnh = getPreviewMember('minh-anh');

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = message.trim();
    if (!next || !selectedThread) return;
    setSentMessages((items) => ({ ...items, [selectedThread]: [...items[selectedThread], next] }));
    setMessage('');
  }

  if (selectedThread) {
    const isFamily = selectedThread === 'family';
    const correspondent = selectedThread === 'minh-anh' ? minhAnh : previewMember;
    const threadName = isFamily ? 'Cả nhà' : correspondent.familiarName;

    return (
      <main id="main" className={`${styles.surfacePage} ${styles.chatPage}`}>
        <header className={styles.conversationHeader}>
          <button
            type="button"
            onClick={() => setSelectedThread(null)}
            aria-label="Quay lại danh sách"
          >
            ‹
          </button>
          <span>
            <h1>{threadName}</h1>
            <small>{isFamily ? '12 người đã được duyệt' : 'Cuộc trò chuyện riêng tư'}</small>
          </span>
        </header>
        <section className={styles.messageStream} aria-label={`Tin nhắn ${threadName}`}>
          <time dateTime="2026-09-09">Hôm nay</time>
          {isFamily ? (
            <>
              <article>
                <PreviewIdentity member={previewMember} size="small" />
                <span>
                  <strong>{previewMember.familiarName}</strong>
                  <p>Chủ nhật này mọi người về lúc mấy giờ?</p>
                  <small>17:42</small>
                </span>
              </article>
              <article>
                <PreviewIdentity member={minhAnh} size="small" />
                <span>
                  <strong>{minhAnh.familiarName}</strong>
                  <p>Con về chuyến sáng, chắc 10 giờ có mặt.</p>
                  <small>17:45</small>
                </span>
              </article>
            </>
          ) : (
            <article>
              <PreviewIdentity member={correspondent} size="small" />
              <span>
                <strong>{correspondent.familiarName}</strong>
                <p>
                  {selectedThread === 'minh-anh'
                    ? 'Con gửi bà chút gió biển.'
                    : 'Canh chua đã lên bếp, ai về trễ vẫn còn phần.'}
                </p>
                <small>17:45</small>
              </span>
            </article>
          )}
          {sentMessages[selectedThread].map((item, index) => (
            <article className={styles.ownMessage} key={`${item}-${index}`}>
              <span>
                <p>{item}</p>
                <small>Vừa xong · Chỉ hiển thị trên thiết bị này</small>
              </span>
            </article>
          ))}
        </section>
        <form className={styles.messageComposer} onSubmit={send}>
          <label className={styles.srOnly} htmlFor="preview-message">
            Tin nhắn
          </label>
          <input
            id="preview-message"
            aria-label="Tin nhắn"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`Nhắn cho ${threadName}…`}
          />
          <button type="submit">Gửi</button>
        </form>
      </main>
    );
  }

  return (
    <main id="main" className={styles.surfacePage}>
      <header className={styles.surfaceHeader}>
        <div>
          <p>TRÒ CHUYỆN</p>
          <h1>Cả nhà đang nói gì?</h1>
        </div>
      </header>
      <p className={styles.surfaceLead}>Những cuộc trò chuyện riêng tư giữa người trong nhà.</p>
      <section className={styles.threadList} aria-label="Danh sách trò chuyện">
        <button
          type="button"
          onClick={() => setSelectedThread('family')}
          aria-label="Mở trò chuyện Cả nhà"
        >
          <span className={styles.threadMark}>NM</span>
          <span>
            <strong>Cả nhà</strong>
            <small>Dì Hương: Chủ nhật này mọi người về lúc mấy giờ?</small>
          </span>
          <time dateTime="2026-09-09T17:42">17:42</time>
        </button>
        <button
          type="button"
          onClick={() => setSelectedThread('minh-anh')}
          aria-label="Mở trò chuyện Minh Anh"
        >
          <PreviewIdentity member={minhAnh} size="small" />
          <span>
            <strong>{minhAnh.familiarName}</strong>
            <small>Con gửi bà chút gió biển.</small>
          </span>
          <time dateTime="2026-09-08">Hôm qua</time>
        </button>
      </section>
      <p className={styles.privacyStrip}>Tin nhắn riêng không được Family AI đọc mặc định.</p>
    </main>
  );
}
