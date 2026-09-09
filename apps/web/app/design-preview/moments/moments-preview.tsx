'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { getPreviewMember, previewMember } from '../fixtures';
import styles from '../mobile.module.css';
import { PreviewIdentity } from '../preview-identity';
import { usePreviewDialog } from '../use-preview-dialog';

type Audience = 'family' | 'household' | 'selected';

const audienceLabels: Record<Audience, string> = {
  family: 'Cả nhà',
  household: 'Gia đình gần',
  selected: 'Người được chọn',
};

const shareLabels: Record<Audience, string> = {
  family: 'Chia sẻ với cả nhà',
  household: 'Chia sẻ với gia đình gần',
  selected: 'Chia sẻ với người đã chọn',
};

export function MomentsPreview({ initiallyComposing }: { initiallyComposing: boolean }) {
  const [composing, setComposing] = useState(initiallyComposing);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('family');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [localMoment, setLocalMoment] = useState<{ caption: string; audience: string } | null>(
    null,
  );
  const [lovedMomentIds, setLovedMomentIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [photoChosen, setPhotoChosen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const minhAnh = getPreviewMember('minh-anh');
  const viewer = getPreviewMember('gia-bao');

  const closeComposer = useCallback(() => setComposing(false), []);
  usePreviewDialog({
    open: composing,
    dialogRef: composerRef,
    initialFocusRef: closeButtonRef,
    returnFocusRef: openerRef,
    onClose: closeComposer,
  });

  function toggleLoved(momentId: string, owner: string) {
    const removing = lovedMomentIds.includes(momentId);
    setLovedMomentIds((ids) =>
      removing ? ids.filter((id) => id !== momentId) : [...ids, momentId],
    );
    setStatus(removing ? `Đã bỏ lời thương dành cho ${owner}.` : `Đã gửi lời thương đến ${owner}.`);
  }

  function shareMoment() {
    const trimmedCaption = caption.trim() || 'Một khoảnh khắc mới của Gia Bảo.';
    const visibleAudience =
      audience === 'selected'
        ? selectedPeople
            .map((person) => (person === 'minh-anh' ? 'Minh Anh' : 'Dì Hương'))
            .join(', ')
        : audienceLabels[audience];
    setLocalMoment({ caption: trimmedCaption, audience: visibleAudience });
    setStatus(`Đã thêm vào bản mẫu · ${visibleAudience}.`);
    setComposing(false);
    setCaption('');
  }

  const selectedAudienceReady = audience !== 'selected' || selectedPeople.length > 0;

  return (
    <main id="main" className={styles.surfacePage}>
      <header className={styles.surfaceHeader}>
        <div>
          <p>KHOẢNH KHẮC</p>
          <h1>Chuyện vừa gửi về.</h1>
        </div>
        <button
          ref={openerRef}
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
      {status ? (
        <p className={styles.localStatus} role="status">
          {status}
        </p>
      ) : null}

      <section className={styles.momentsFeed} aria-label="Khoảnh khắc mới">
        {localMoment ? (
          <article className={styles.feedMoment}>
            <header>
              <PreviewIdentity member={viewer} size="small" />
              <span>
                <strong>{viewer.familiarName}</strong>
                <small>vừa xong · {localMoment.audience}</small>
              </span>
            </header>
            <div
              className={`${styles.feedPhoto} ${styles.photoKitchen}`}
              role="img"
              aria-label="Ảnh minh họa vừa chọn"
            >
              <span>KHOẢNH KHẮC CỦA GIA BẢO</span>
            </div>
            <p>{localMoment.caption}</p>
          </article>
        ) : null}

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
            <button
              type="button"
              aria-pressed={lovedMomentIds.includes('minh-anh-rain')}
              onClick={() => toggleLoved('minh-anh-rain', minhAnh.familiarName)}
            >
              {lovedMomentIds.includes('minh-anh-rain') ? 'Đã thương' : 'Thương'}
            </button>
            <Link href="/design-preview/chat?thread=minh-anh">Trả lời riêng</Link>
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
            <button
              type="button"
              aria-pressed={lovedMomentIds.includes('thanh-huong-kitchen')}
              onClick={() => toggleLoved('thanh-huong-kitchen', previewMember.familiarName)}
            >
              {lovedMomentIds.includes('thanh-huong-kitchen') ? 'Đã thương' : 'Thương'}
            </button>
            <Link href="/design-preview/chat?thread=thanh-huong">Trả lời riêng</Link>
          </footer>
        </article>
      </section>

      {composing ? (
        <div className={styles.sheetBackdrop} onMouseDown={closeComposer}>
          <section
            ref={composerRef}
            className={styles.composerSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Gửi khoảnh khắc"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>
                <small>CHỈ TRONG GIA ĐÌNH</small>
                <h2>Gửi khoảnh khắc</h2>
              </span>
              <button ref={closeButtonRef} type="button" onClick={closeComposer} aria-label="Đóng">
                ×
              </button>
            </header>
            <button
              className={styles.photoPlaceholder}
              type="button"
              aria-pressed={photoChosen}
              onClick={() => setPhotoChosen((chosen) => !chosen)}
            >
              <span aria-hidden="true">{photoChosen ? '✓' : '＋'}</span>
              <strong>{photoChosen ? 'Đã chọn ảnh minh họa' : 'Dùng khung ảnh minh họa'}</strong>
              <small>Chưa tải ảnh lên ở bản mẫu này</small>
            </button>
            <label>
              Lời nhắn
              <textarea
                aria-label="Lời nhắn"
                rows={3}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Kể một câu ngắn cho cả nhà…"
              />
            </label>
            <label>
              Ai được xem?
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as Audience)}
              >
                <option value="family">Cả nhà</option>
                <option value="household">Gia đình gần</option>
                <option value="selected">Chọn người</option>
              </select>
            </label>
            {audience === 'selected' ? (
              <fieldset className={styles.recipientChoices}>
                <legend>Chọn người nhận</legend>
                {[
                  { id: 'minh-anh', name: 'Minh Anh' },
                  { id: 'thanh-huong', name: 'Dì Hương' },
                ].map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={selectedPeople.includes(person.id)}
                      onChange={() =>
                        setSelectedPeople((people) =>
                          people.includes(person.id)
                            ? people.filter((id) => id !== person.id)
                            : [...people, person.id],
                        )
                      }
                    />
                    {person.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <button
              className={styles.sheetPrimary}
              type="button"
              disabled={!selectedAudienceReady}
              onClick={shareMoment}
            >
              {shareLabels[audience]}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
