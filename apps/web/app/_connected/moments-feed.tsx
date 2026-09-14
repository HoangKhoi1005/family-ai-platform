'use client';

import type { MomentDto } from '@family/contracts';
import { ConnectedIdentity } from './connected-app-shell';
import { familyMediaContentUrl } from './api';
import s from './moments.module.css';

export function MomentsFeed({
  familyId,
  moments,
  status,
  error,
  hasMore,
  onCompose,
  onRetry,
  onLoadMore,
  onReact,
  onDelete,
  onPreserve,
  onOpenMemories,
}: {
  familyId: string;
  moments: MomentDto[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  hasMore: boolean;
  onCompose: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onReact: (moment: MomentDto) => void;
  onDelete: (moment: MomentDto) => void;
  onPreserve: (moment: MomentDto) => void;
  onOpenMemories: () => void;
}) {
  return (
    <section className={s.page} aria-labelledby="moments-heading">
      <header className={s.pageHeader}>
        <div>
          <span>CHUYỆN ĐANG DIỄN RA</span>
          <h1 id="moments-heading">Khoảnh khắc</h1>
          <p>Một dòng ảnh nhỏ, chỉ dành cho người trong nhà.</p>
        </div>
        <div className={s.headerActions}>
          <button type="button" onClick={onOpenMemories}>
            Mở Kỷ niệm
          </button>
          <button className={s.newMoment} type="button" onClick={onCompose}>
            Gửi ảnh
          </button>
        </div>
      </header>
      {status === 'loading' && moments.length === 0 && (
        <div className={s.loading} aria-live="polite">
          <span />
          <span />
          <p>Đang mở album nhà mình…</p>
        </div>
      )}
      {status === 'error' && moments.length === 0 && (
        <div className={s.empty}>
          <h2>Chưa mở được album.</h2>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      )}
      {status !== 'loading' && status !== 'error' && moments.length === 0 && (
        <div className={s.empty}>
          <span className={s.emptyFrame} aria-hidden="true" />
          <h2>Ảnh đầu tiên sẽ bắt đầu câu chuyện.</h2>
          <p>Không cần chỉnh đẹp. Một bữa cơm, góc vườn hay nụ cười bất chợt là đủ.</p>
          <button type="button" onClick={onCompose}>
            Gửi Khoảnh khắc đầu tiên
          </button>
        </div>
      )}
      <div className={s.feed}>
        {moments.map((moment) => (
          <article className={s.moment} key={moment.id}>
            <header>
              <ConnectedIdentity
                name={moment.author?.familiar_name ?? moment.author?.display_name ?? 'Nhà mình'}
              />
              <div>
                <strong>
                  {moment.author?.familiar_name ?? moment.author?.display_name ?? 'Người thân'}
                </strong>
                <time dateTime={moment.created_at}>{formatMomentTime(moment.created_at)}</time>
              </div>
            </header>
            <img
              src={familyMediaContentUrl(familyId, moment.media.id)}
              alt={moment.caption ? `Khoảnh khắc: ${moment.caption}` : 'Khoảnh khắc gia đình'}
              loading="lazy"
            />
            {moment.caption && <p className={s.momentCaption}>{moment.caption}</p>}
            <footer>
              <button
                className={moment.my_reaction ? s.reacted : undefined}
                type="button"
                aria-pressed={moment.my_reaction === 'thuong'}
                onClick={() => onReact(moment)}
              >
                Thương
              </button>
              <button type="button" onClick={() => onPreserve(moment)}>
                Lưu thành Kỷ niệm
              </button>
              {moment.can_delete && (
                <button type="button" onClick={() => onDelete(moment)}>
                  Xóa
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
      {status === 'error' && moments.length > 0 && (
        <div className={s.feedError} role="alert">
          {error}
          <button type="button" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      )}
      {hasMore && (
        <button
          className={s.loadMore}
          type="button"
          onClick={onLoadMore}
          disabled={status === 'loading'}
        >
          Xem thêm ảnh cũ
        </button>
      )}
    </section>
  );
}

function formatMomentTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
