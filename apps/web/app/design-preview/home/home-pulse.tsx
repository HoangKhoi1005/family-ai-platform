import Link from 'next/link';
import type { PreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import styles from '../mobile.module.css';

export function HomePulse({ members }: { members: ReadonlyArray<PreviewMember> }) {
  return (
    <nav className={styles.homePulse} aria-label="Cập nhật từ người thân">
      <Link
        className={styles.pulseCreate}
        href="/design-preview/moments?compose=true"
        aria-label="Chia sẻ nhanh"
      >
        <span aria-hidden="true">＋</span>
        <small>Chia sẻ</small>
      </Link>
      {members.map((member) => (
        <Link
          className={styles.pulsePerson}
          href={`/design-preview/profile?person=${member.id}`}
          aria-label={`Xem cập nhật của ${member.familiarName}`}
          key={member.id}
        >
          <span className={styles.pulsePortrait}>
            <PreviewIdentity member={member} size="small" />
          </span>
          <small>{member.familiarName}</small>
        </Link>
      ))}
    </nav>
  );
}
