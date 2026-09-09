'use client';

import type { ReactNode } from 'react';
import s from './connected.module.css';

export type ConnectedTab = 'home' | 'moments' | 'directory' | 'chat' | 'profile' | 'admin';

const destinations = [
  { key: 'home', label: 'Nhà', accessibleName: 'Nhà mình', icon: 'home' },
  { key: 'moments', label: 'Khoảnh khắc', accessibleName: 'Khoảnh khắc', icon: 'moments' },
  { key: 'directory', label: 'Gia phả', accessibleName: 'Người thân', icon: 'tree' },
  { key: 'chat', label: 'Trò chuyện', accessibleName: 'Trò chuyện', icon: 'chat' },
  { key: 'profile', label: 'Tôi', accessibleName: 'Hồ sơ của tôi', icon: 'me' },
] as const;

export function ConnectedAppShell({
  tab,
  houseName,
  viewerName,
  onNavigate,
  children,
}: {
  tab: ConnectedTab;
  houseName: string;
  viewerName: string;
  onNavigate: (tab: ConnectedTab) => void;
  children: ReactNode;
}) {
  return (
    <>
      <header className={s.productAppBar}>
        <button className={s.productHouse} type="button" onClick={() => onNavigate('home')}>
          <span className={s.productHouseMark} aria-hidden="true">
            NM
          </span>
          <span>
            <small>{houseName}</small>
            <strong>Nhà mình</strong>
          </span>
        </button>
        <button
          className={s.productViewer}
          type="button"
          onClick={() => onNavigate('profile')}
          aria-label={`Mở hồ sơ của ${viewerName}`}
        >
          <ConnectedIdentity name={viewerName} />
        </button>
      </header>
      <nav className={s.productNavigation} aria-label="Điều hướng chính">
        <button className={s.productRailBrand} type="button" onClick={() => onNavigate('home')}>
          nhà mình<span>.</span>
        </button>
        <div className={s.productNavigationItems}>
          {destinations.map((destination) => {
            const active =
              destination.key === tab || (destination.key === 'profile' && tab === 'admin');
            return (
              <button
                key={destination.key}
                type="button"
                aria-label={destination.accessibleName}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(destination.key)}
              >
                <ConnectedNavIcon name={destination.icon} />
                <span>{destination.label}</span>
              </button>
            );
          })}
        </div>
        <p className={s.productRailPrivacy}>Riêng tư cho gia đình</p>
      </nav>
      <div className={s.productContent}>{children}</div>
    </>
  );
}

export function ConnectedIdentity({ name }: { name: string }) {
  return (
    <span className={s.connectedIdentity} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(-2)
      .map((word) => word[0])
      .join('')
      .toLocaleUpperCase('vi') || 'NM'
  );
}

function ConnectedNavIcon({ name }: { name: (typeof destinations)[number]['icon'] }) {
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
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}
