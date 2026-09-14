'use client';

import { useState } from 'react';
import type { PreviewMemory } from '../fixtures';
import { getPreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import styles from './memories.module.css';

export function MemoriesTimeline({ memories }: { memories: ReadonlyArray<PreviewMemory> }) {
  const [status, setStatus] = useState('');

  return (
    <>
      <ol className={styles.timeline} aria-label="Các Kỷ niệm theo thời gian">
        {memories.map((memory, index) => {
          const contributor = getPreviewMember(memory.contributorId);
          return (
            <li className={styles.timelineItem} key={memory.id}>
              <time dateTime={memory.dateTime}>{memory.dateLabel}</time>
              <article className={`${styles.memory} ${styles[`memory${memory.kind}`]}`}>
                {memory.kind === 'photo' ? (
                  <div
                    className={styles.memoryPhoto}
                    role="img"
                    aria-label="Minh họa hư cấu một bữa cơm gia đình bên bến sông"
                  >
                    <span>Dữ liệu minh họa</span>
                  </div>
                ) : null}
                <div className={styles.memoryBody}>
                  <span className={styles.memoryIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <h2>{memory.title}</h2>
                  <p>{memory.excerpt}</p>
                  <div className={styles.contributor}>
                    <PreviewIdentity member={contributor} size="small" />
                    <span>
                      <strong>Được {contributor.familiarName} kể lại</strong>
                      <small>{memory.relatedEvent ?? 'Kỷ niệm của cả nhà'}</small>
                    </span>
                  </div>
                  {memory.kind === 'voice' ? (
                    <button
                      type="button"
                      className={styles.voiceButton}
                      aria-label={`Nghe lời kể của ${contributor.familiarName}`}
                      onClick={() =>
                        setStatus(
                          'Bản mẫu chưa phát âm thanh. Lời kể được mô phỏng để duyệt trải nghiệm.',
                        )
                      }
                    >
                      <span aria-hidden="true">▶</span>
                      <span>
                        <strong>Nghe lời kể</strong>
                        <small>{memory.duration}</small>
                      </span>
                    </button>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
      <p className={styles.localStatus} role="status" aria-live="polite">
        {status}
      </p>
    </>
  );
}
