'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getPreviewMember } from './fixtures';
import { PreviewIdentity } from './preview-identity';
import styles from './mobile.module.css';

type Destination = {
  label: string;
  href: string;
  icon: 'home' | 'moments' | 'tree' | 'chat' | 'me';
};

const destinations: ReadonlyArray<Destination> = [
  { label: 'Nhà', href: '/design-preview', icon: 'home' },
  { label: 'Khoảnh khắc', href: '/design-preview/moments', icon: 'moments' },
  { label: 'Gia phả', href: '/design-preview/tree', icon: 'tree' },
  { label: 'Trò chuyện', href: '/design-preview/chat', icon: 'chat' },
  { label: 'Tôi', href: '/design-preview/me', icon: 'me' },
];

export function PreviewShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onboarding = pathname.startsWith('/design-preview/join');
  const viewer = getPreviewMember('gia-bao');

  if (onboarding) {
    return (
      <div className={styles.onboardingShell}>
        <aside className={styles.previewNotice} aria-label="Thông tin bản mẫu">
          <span>Bản mẫu</span>
          <span>Dữ liệu minh họa</span>
        </aside>
        <header className={styles.onboardingHeader}>
          <Link href="/design-preview" aria-label="Nhà mình · Trang đầu">
            nhà mình<span>.</span>
          </Link>
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className={styles.appShell}>
      <aside className={styles.previewNotice} aria-label="Thông tin bản mẫu">
        <span>Bản mẫu</span>
        <span>Dữ liệu minh họa</span>
      </aside>
      <header className={styles.appBar}>
        <Link className={styles.houseIdentity} href="/design-preview">
          <span className={styles.houseMark} aria-hidden="true">
            NM
          </span>
          <span>
            <small>NHÀ ÔNG BÌNH &amp; BÀ MAI</small>
            <strong>Nhà mình</strong>
          </span>
        </Link>
        <div className={styles.appBarActions}>
          <Link className={styles.notificationAction} href="/design-preview/me?panel=notifications">
            <NavIcon name="notifications" />
            <span className={styles.srOnly}>Thông báo</span>
            <i aria-hidden="true" />
          </Link>
          <Link
            className={styles.viewerLink}
            href="/design-preview/me"
            aria-label="Mở trang của Gia Bảo"
          >
            <PreviewIdentity member={viewer} size="small" />
          </Link>
        </div>
      </header>
      <nav className={styles.appNavigation} aria-label="Điều hướng chính">
        <Link className={styles.railBrand} href="/design-preview" aria-label="Nhà mình · Trang đầu">
          nhà mình<span>.</span>
        </Link>
        <div className={styles.navigationItems}>
          {destinations.map(({ label, href, icon }) => {
            const active =
              href === '/design-preview' ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
                <NavIcon name={icon} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
        <p className={styles.railPrivacy}>Riêng tư cho gia đình</p>
      </nav>
      <div className={styles.appContent}>{children}</div>
    </div>
  );
}

function NavIcon({ name }: { name: Destination['icon'] | 'notifications' }) {
  const paths = {
    home: <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9Z" />,
    moments: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="m7 16 3.5-3.5 2.5 2.3 2.5-2.8 4.5 4.5M8.5 9.5h.01" />
      </>
    ),
    tree: (
      <>
        <circle cx="12" cy="5" r="2.5" />
        <circle cx="6" cy="18.5" r="2.5" />
        <circle cx="18" cy="18.5" r="2.5" />
        <path d="M12 7.5v4M6 16v-2.5h12V16" />
      </>
    ),
    chat: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 4v-4.5A2.5 2.5 0 0 1 4 14V5.5Z" />
    ),
    me: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    notifications: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}
