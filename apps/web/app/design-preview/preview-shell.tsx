import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './preview.module.css';

export function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <>
      <aside className={styles.previewNotice} aria-label="Thông tin bản mẫu">
        Bản mẫu thiết kế · Dữ liệu minh họa, không phải thông tin gia đình thật.
      </aside>
      <nav className={styles.shellNav} aria-label="Bản mẫu">
        <div className={styles.shellNavInner}>
          <Link href="/design-preview">Nhà mình</Link>
          <Link href="/design-preview/profile">Hồ sơ</Link>
          <Link href="/design-preview/join">Thử luồng vào nhà</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
