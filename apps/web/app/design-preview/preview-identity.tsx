import type { PreviewMember } from './fixtures';
import styles from './preview.module.css';

export function PreviewIdentity({
  member,
  size = 'medium',
}: {
  member: PreviewMember;
  size?: 'small' | 'medium' | 'large';
}) {
  return (
    <span
      className={`${styles.identityPortrait} ${styles[`identityPortrait${size}`]} ${styles[`portrait${member.portraitTone}`]}`}
      aria-hidden="true"
    >
      <span className={styles.portraitSun} />
      <span className={styles.portraitHill} />
      <strong>{member.initials}</strong>
    </span>
  );
}
