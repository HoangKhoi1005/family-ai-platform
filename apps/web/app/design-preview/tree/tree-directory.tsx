import Link from 'next/link';
import { useMemo, useState } from 'react';
import { normalizeVietnamese, previewMembers } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import styles from './tree.module.css';

export function TreeDirectory({
  selectedId,
  onOpenProfile,
}: {
  selectedId: string;
  onOpenProfile: (opener: HTMLAnchorElement) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const normalized = normalizeVietnamese(query.trim());
    if (!normalized) return previewMembers;
    return previewMembers.filter((member) =>
      normalizeVietnamese(`${member.displayName} ${member.familiarName}`).includes(normalized),
    );
  }, [query]);

  return (
    <section className={styles.directoryPanel} aria-labelledby="directory-heading">
      <header>
        <p>DANH BẠ · 15 NGƯỜI</p>
        <h2 id="directory-heading">Tìm một người trong nhà.</h2>
      </header>
      <label className={styles.directorySearch}>
        <span>Tìm người thân</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tên hoặc cách gọi ở nhà"
        />
      </label>
      <ol className={styles.directoryList}>
        {results.map((member, index) => (
          <li
            key={member.id}
            className={selectedId === member.id ? styles.directorySelected : undefined}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <PreviewIdentity member={member} size="small" />
            <div>
              <Link
                href={`?view=directory&person=${member.id}#selected-member-profile`}
                onClick={(event) => onOpenProfile(event.currentTarget)}
              >
                {member.displayName}
              </Link>
              <small>
                {member.familiarName} · {member.relationToViewer}
              </small>
            </div>
          </li>
        ))}
      </ol>
      {results.length === 0 ? (
        <p className={styles.noResults}>Không tìm thấy tên này. Bạn có thể thử cách gọi ở nhà.</p>
      ) : null}
    </section>
  );
}
