'use client';

import { useEffect, useRef, useState } from 'react';
import { getPreviewMember, previewMember } from '../fixtures';
import styles from '../mobile.module.css';
import { PreviewIdentity } from '../preview-identity';

export function MomentsPreview({ initiallyComposing }: { initiallyComposing: boolean }) {
  const [composing, setComposing] = useState(initiallyComposing);
  const [shared, setShared] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const minhAnh = getPreviewMember('minh-anh');

  useEffect(() => {
    if (composing) closeButtonRef.current?.focus();
  }, [composing]);

  return (
    <main id="main" className={styles.surfacePage}>
      <header className={styles.surfaceHeader}>
        <div>
          <p>KHOẢNH KHẮC</p>
          <h1>Chuyện vừa gửi về.</h1>
        </div>
        <button
          className={styles.roundAction}
          type="button"
          onClick={() => setComposing(true)}
          aria-label="Gửi khoảnh khắc"
        >
          ＋
        </button>
      </header>
      <p className={styles.surfaceLead}>
        Một góc nhỏ để cả nhà thấy nhau trong những ngày rất bình thường.
      </p>
      {shared ? (
        <p className={styles.localStatus} role="status">
          Đã thêm vào bản mẫu trên thiết bị này.
        </p>
      ) : null}

      <section className={styles.momentsFeed} aria-label="Khoảnh khắc mới">
        <article className={styles.feedMoment}>
          <header>
            <PreviewIdentity member={minhAnh} size="small" />
            <span>
              <strong>{minhAnh.familiarName}</strong>
              <small>2 giờ trước · Cả nhà</small>
            </span>
          </header>
          <div
            className={`${styles.feedPhoto} ${styles.photoRain}`}
            role="img"
            aria-label="Minh họa trời mưa sau khung cửa"
          >
            <span>CHIỀU MƯA · ĐÀ NẴNG</span>
          </div>
          <p>Trời mưa một lát rồi tạnh. Con gửi bà chút gió biển.</p>
          <footer>
            <button type="button">Thương</button>
            <button type="button">Trả lời riêng</button>
          </footer>
        </article>
        <article className={styles.feedMoment}>
          <header>
            <PreviewIdentity member={previewMember} size="small" />
            <span>
              <strong>{previewMember.familiarName}</strong>
              <small>hôm qua · Cả nhà</small>
            </span>
          </header>
          <div
            className={`${styles.feedPhoto} ${styles.photoKitchen}`}
            role="img"
            aria-label="Minh họa nồi canh chua trên bàn"
          >
            <span>BẾP NHÀ DÌ HƯƠNG</span>
          </div>
          <p>Canh chua đã lên bếp, ai về trễ vẫn còn phần.</p>
          <footer>
            <button type="button">Thương</button>
            <button type="button">Trả lời riêng</button>
          </footer>
        </article>
      </section>

      {composing ? (
        <div className={styles.sheetBackdrop} onMouseDown={() => setComposing(false)}>
          <section
            className={styles.composerSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Gửi khoảnh khắc"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>
                <small>CHỈ TRONG GIA ĐÌNH</small>
                <h2>Gửi khoảnh khắc</h2>
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setComposing(false)}
                aria-label="Đóng"
              >
                ×
              </button>
            </header>
            <button className={styles.photoPlaceholder} type="button">
              <span aria-hidden="true">＋</span>
              <strong>Chọn một tấm ảnh</strong>
              <small>Bản mẫu không tải ảnh lên</small>
            </button>
            <label>
              Lời nhắn
              <textarea aria-label="Lời nhắn" rows={3} placeholder="Kể một câu ngắn cho cả nhà…" />
            </label>
            <label>
              Ai được xem?
              <select defaultValue="family">
                <option value="family">Cả nhà</option>
                <option value="household">Gia đình gần</option>
                <option value="selected">Chọn người</option>
              </select>
            </label>
            <button
              className={styles.sheetPrimary}
              type="button"
              onClick={() => {
                setComposing(false);
                setShared(true);
              }}
            >
              Chia sẻ với cả nhà
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
