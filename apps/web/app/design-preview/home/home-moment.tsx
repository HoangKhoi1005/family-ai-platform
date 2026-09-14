import Link from 'next/link';
import type { PreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import styles from '../mobile.module.css';

export function HomeMoment({
  member,
  message,
  timeLabel,
}: {
  member: PreviewMember;
  message: string;
  timeLabel: string;
}) {
  return (
    <article className={styles.heroMoment} aria-labelledby="home-moment-message">
      <div
        className={styles.heroMomentVisual}
        role="img"
        aria-label="Minh họa hư cấu một bữa cơm gia đình có canh chua"
      >
        <span>Dữ liệu minh họa</span>
      </div>
      <div className={styles.heroMomentBody}>
        <header>
          <Link href="/design-preview/profile" aria-label={`Xem hồ sơ ${member.familiarName}`}>
            <PreviewIdentity member={member} size="small" />
            <span>
              <strong>{member.familiarName}</strong>
              <small>{timeLabel}</small>
            </span>
          </Link>
          <span className={styles.audienceLabel}>Cả nhà</span>
        </header>
        <p id="home-moment-message">{message}</p>
        <footer>
          <span>Đã có lời thương từ người nhà</span>
          <Link href={`/design-preview/chat?thread=${member.id}`}>Nhắn một lời</Link>
        </footer>
      </div>
    </article>
  );
}
