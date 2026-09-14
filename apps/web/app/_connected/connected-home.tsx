'use client';

import type { ReactNode } from 'react';
import type { ConnectedHomeModel } from './home-model';
import type { CalendarTimelineState } from './calendar-state';
import type { Member } from './types';
import { CalendarHomeSection } from './family-calendar';
import { ConnectedIdentity } from './connected-app-shell';
import { familyMediaContentUrl } from './api';
import styles from './connected-home.module.css';

export function ConnectedHome({
  model,
  familyId,
  calendar,
  members,
  ownershipPrompt,
  onOpenCalendar,
  onCreateEvent,
  onRefreshCalendar,
  onOpenMoments,
  onOpenPerson,
  onOpenTree,
}: {
  model: ConnectedHomeModel;
  familyId: string;
  calendar: CalendarTimelineState;
  members: Member[];
  ownershipPrompt?: ReactNode;
  onOpenCalendar: (occurrenceId?: string) => void;
  onCreateEvent: () => void;
  onRefreshCalendar: () => void;
  onOpenMoments: () => void;
  onOpenPerson: (memberId: string) => void;
  onOpenTree: () => void;
}) {
  return (
    <section className={styles.page} aria-labelledby="connected-home-title">
      <header className={styles.greeting}>
        <span>Nhà đang sống</span>
        <h1 id="connected-home-title">Chào {model.viewerName}, nhà mình có gì mới?</h1>
        <p>Những người thân, ngày cần nhớ và câu chuyện của gia đình đều ở đây.</p>
      </header>

      <section className={styles.people} aria-labelledby="connected-home-people">
        <div className={styles.sectionHeading}>
          <div>
            <span>{model.memberCount} người trong nhà</span>
            <h2 id="connected-home-people">Người thân trong nhà</h2>
          </div>
          <button type="button" onClick={onOpenTree}>
            Xem tất cả
          </button>
        </div>
        {model.people.length ? (
          <div className={styles.peopleRow}>
            {model.people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onOpenPerson(person.id)}
                aria-label={`Mở Gia phả để xem ${person.displayName}`}
              >
                <ConnectedIdentity name={person.displayName} />
                <span>{person.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.emptyCopy}>
            Mời người thân để căn nhà này bắt đầu có tiếng chuyện trò.
          </p>
        )}
      </section>

      <section
        className={`${styles.moment} ${model.latestMoment ? styles.momentWithPhoto : ''}`}
        aria-labelledby="connected-home-moment"
      >
        {model.latestMoment && (
          <img
            src={familyMediaContentUrl(familyId, model.latestMoment.media.id)}
            alt={
              model.latestMoment.caption
                ? `Khoảnh khắc: ${model.latestMoment.caption}`
                : 'Khoảnh khắc mới nhất của gia đình'
            }
          />
        )}
        <div>
          <span>Khoảnh khắc mới nhất</span>
          <h2 id="connected-home-moment">
            {model.latestMoment
              ? (model.latestMoment.caption ?? 'Một lát cắt hôm nay vừa được gửi về nhà.')
              : 'Gửi một tấm ảnh để cả nhà biết hôm nay của bạn.'}
          </h2>
          <p>
            {model.latestMoment
              ? `Từ ${model.latestMoment.author?.familiar_name ?? model.latestMoment.author?.display_name ?? 'một người thân'}`
              : 'Khoảnh khắc thật sẽ xuất hiện ở đây khi người trong nhà chia sẻ.'}
          </p>
        </div>
        <button type="button" onClick={onOpenMoments}>
          {model.latestMoment ? 'Mở album nhà mình' : 'Gửi Khoảnh khắc đầu tiên'}
        </button>
      </section>

      <CalendarHomeSection
        timeline={calendar}
        members={members}
        onOpen={onOpenCalendar}
        onCreate={onCreateEvent}
        onRefresh={onRefreshCalendar}
      />

      {ownershipPrompt}

      <section className={styles.treePath}>
        <div>
          <span>Gia phả</span>
          <h2>Bắt đầu từ một người, hiểu thêm cả một nhánh nhà.</h2>
          <p>Quan hệ chỉ hiện sau khi gia đình xác nhận.</p>
        </div>
        <button type="button" onClick={onOpenTree}>
          Mở Gia phả
        </button>
      </section>
    </section>
  );
}
