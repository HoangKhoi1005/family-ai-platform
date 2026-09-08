'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { directoryFixtures } from '../onboarding-fixtures';
import styles from '../onboarding.module.css';

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN');
}

function initials(value: string): string {
  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
}

export function DirectoryFlow() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedProfileHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultLinkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const matches = useMemo(() => {
    const foldedQuery = fold(query.trim());
    if (!foldedQuery) return directoryFixtures;
    return directoryFixtures.filter((member) =>
      fold(`${member.displayName} ${member.familiarName}`).includes(foldedQuery),
    );
  }, [query]);
  const selected = directoryFixtures.find((member) => member.id === selectedId);

  useEffect(() => {
    if (selectedId) selectedProfileHeadingRef.current?.focus();
  }, [selectedId]);

  function returnToResults() {
    const returningId = selectedId;
    setSelectedId(null);
    if (returningId) {
      window.requestAnimationFrame(() => resultLinkRefs.current[returningId]?.focus());
    }
  }

  return (
    <div className={styles.flowPage}>
      <header className={styles.flowHeader}>
        <div>
          <p className={styles.eyebrow}>Danh bạ · Bản mẫu</p>
          <h1 className={styles.directoryTitle}>Tìm đúng người trong nhà.</h1>
          <p className={styles.directoryIntro}>
            Gõ tên đầy đủ hoặc tên thường gọi để tìm nhanh hơn.
          </p>
        </div>
      </header>

      <div className={styles.directoryLayout}>
        <section className={styles.directorySearch} aria-labelledby="search-heading">
          <h2 id="search-heading" className={styles.stageTitle}>
            Tìm kiếm
          </h2>
          <label className={styles.searchLabel} htmlFor="directory-search">
            Tìm theo tên hoặc tên thường gọi
          </label>
          <input
            id="directory-search"
            className={styles.searchInput}
            type="search"
            placeholder="Ví dụ: Huong hoặc Dì Hương"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId(null);
            }}
          />
          <p className={styles.supportingText}>
            Tìm theo tên có dấu hoặc không dấu; thông tin liên hệ riêng tư không hiện trong kết quả.
          </p>
          <Link className={styles.quietButton} href="/design-preview/join">
            Xem lại luồng vào nhà
          </Link>
        </section>

        <section className={styles.directoryResults} aria-labelledby="results-heading">
          <h2 id="results-heading" className={styles.stageTitle}>
            Người trong nhà
          </h2>
          {matches.length > 0 ? (
            <ul className={styles.resultList}>
              {matches.map((member) => (
                <li className={styles.resultItem} key={member.id}>
                  <span className={styles.resultInitials} aria-hidden="true">
                    {initials(member.familiarName)}
                  </span>
                  <div className={styles.resultCopy}>
                    <Link
                      className={styles.resultLink}
                      ref={(element) => {
                        resultLinkRefs.current[member.id] = element;
                      }}
                      href={`/design-preview/directory?member=${member.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        setSelectedId(member.id);
                      }}
                    >
                      Mở hồ sơ {member.familiarName}
                    </Link>
                    <span className={styles.resultMeta}>{member.displayName}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyResult}>Chưa có người phù hợp trong dữ liệu minh họa.</p>
          )}
        </section>

        {selected ? (
          <aside className={styles.profilePanel} aria-labelledby="selected-profile-heading">
            <button className={styles.quietButton} type="button" onClick={returnToResults}>
              Quay lại danh sách kết quả
            </button>
            <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
              Đã mở hồ sơ {selected.familiarName}.
            </p>
            <p className={styles.eyebrow}>Hồ sơ minh họa</p>
            <div className={styles.profileHeader}>
              <span className={styles.profileInitials} aria-hidden="true">
                {initials(selected.familiarName)}
              </span>
              <div>
                <h2
                  ref={selectedProfileHeadingRef}
                  id="selected-profile-heading"
                  tabIndex={-1}
                  className={styles.profileTitle}
                >
                  {selected.familiarName}
                </h2>
                <p className={styles.profileFullName}>{selected.displayName}</p>
              </div>
            </div>
            <p className={styles.profileCopy}>{selected.biography}</p>
            <dl className={styles.profileDetails}>
              <div>
                <dt>Năm sinh</dt>
                <dd>{selected.birthYear}</dd>
              </div>
              <div>
                <dt>Quê quán</dt>
                <dd>{selected.hometown}</dd>
              </div>
            </dl>
            <p className={styles.profileCopy}>
              Thông tin liên hệ chưa được cung cấp trong bản mẫu này.
            </p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
