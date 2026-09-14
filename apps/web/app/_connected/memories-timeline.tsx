'use client';

import type { MemoryDto } from '@family/contracts';
import { useState } from 'react';
import { familyMediaContentUrl } from './api';
import { MemoryContributionSheet } from './memory-contribution';
import s from './memories.module.css';

export function MemoriesTimeline({
  familyId,
  memories,
  status,
  error,
  hasMore,
  onBack,
  onRetry,
  onLoadMore,
  onAddText,
  onAddAudio,
}: {
  familyId: string;
  memories: MemoryDto[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  hasMore: boolean;
  onBack: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onAddText: (memory: MemoryDto, body: string) => Promise<void>;
  onAddAudio: (memory: MemoryDto, file: File) => Promise<void>;
}) {
  const [contributingTo, setContributingTo] = useState<MemoryDto | null>(null);
  return (
    <section className={s.page} aria-labelledby="memories-heading">
      <header className={s.header}>
        <button type="button" onClick={onBack}>
          ← Khoảnh khắc
        </button>
        <span>CHUYỆN NHÀ ĐƯỢC GIỮ LẠI</span>
        <h1 id="memories-heading">Kỷ niệm</h1>
        <p>Không chạy theo lượt thích. Chỉ giữ những điều cả nhà muốn nhớ lâu.</p>
      </header>
      {status === 'loading' && memories.length === 0 && (
        <p className={s.status}>Đang mở dòng Kỷ niệm…</p>
      )}
      {status === 'error' && memories.length === 0 && (
        <div className={s.empty}>
          <h2>Chưa mở được Kỷ niệm.</h2>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      )}
      {status === 'ready' && memories.length === 0 && (
        <div className={s.empty}>
          <div aria-hidden="true">
            1998
            <br />·<br />
            2026
          </div>
          <h2>Những mốc đầu tiên đang chờ được kể.</h2>
          <p>Từ một Khoảnh khắc, chọn “Lưu thành Kỷ niệm” để bắt đầu.</p>
        </div>
      )}
      <ol className={s.timeline}>
        {memories.map((memory) => (
          <li key={memory.id}>
            <time dateTime={memory.occurred_on}>{formatDate(memory.occurred_on)}</time>
            <article>
              <h2>{memory.title}</h2>
              {memory.source_moment_id && <span className={s.source}>Được giữ từ Khoảnh khắc</span>}
              <div className={s.items}>
                {memory.items.map((item) => (
                  <div key={item.id}>
                    {item.kind === 'text' && <p>{item.body}</p>}
                    {item.kind === 'image' && item.media && (
                      <img
                        src={familyMediaContentUrl(familyId, item.media.id)}
                        alt="Ảnh trong Kỷ niệm gia đình"
                        loading="lazy"
                      />
                    )}
                    {item.kind === 'audio' && item.media && (
                      <div className={s.audio}>
                        <strong>
                          Lời kể của{' '}
                          {item.contributor?.familiar_name ??
                            item.contributor?.display_name ??
                            'người thân'}
                        </strong>
                        <audio
                          controls
                          preload="none"
                          src={familyMediaContentUrl(familyId, item.media.id)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {memory.can_edit && (
                <button
                  className={s.contribute}
                  type="button"
                  onClick={() => setContributingTo(memory)}
                >
                  Thêm lời kể
                </button>
              )}
            </article>
          </li>
        ))}
      </ol>
      {hasMore && (
        <button
          className={s.loadMore}
          type="button"
          onClick={onLoadMore}
          disabled={status === 'loading'}
        >
          Xem những năm trước
        </button>
      )}
      {contributingTo && (
        <MemoryContributionSheet
          key={contributingTo.id}
          memory={contributingTo}
          onClose={() => setContributingTo(null)}
          onAddText={onAddText}
          onAddAudio={onAddAudio}
        />
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00+07:00`));
}
