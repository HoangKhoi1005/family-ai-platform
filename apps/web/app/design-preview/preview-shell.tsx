'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './preview.module.css';

export function PreviewShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const destinations = [
    ['Nhà mình', '/design-preview'],
    ['Gia phả', '/design-preview/tree'],
    ['Hồ sơ', '/design-preview/profile'],
    ['Vào nhà', '/design-preview/join'],
    ['Quản trị', '/design-preview/admin'],
  ] as const;

  return (
    <>
      <aside className={styles.previewNotice} aria-label="Thông tin bản mẫu">
        <span>Bản mẫu trải nghiệm</span>
        <span>Dữ liệu minh họa, không phải thông tin gia đình thật</span>
      </aside>
      <nav className={styles.shellNav} aria-label="Bản mẫu">
        <div className={styles.shellNavInner}>
          <Link
            className={styles.shellBrand}
            href="/design-preview"
            aria-label="Nhà mình · Trang đầu"
          >
            nhà mình<span>.</span>
          </Link>
          <div className={styles.shellLinks}>
            {destinations.map(([label, href]) => (
              <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}
