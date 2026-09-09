'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { TreeCanvas } from './tree-canvas';
import { TreeDirectory } from './tree-directory';
import { getTreePerson } from './tree-model';
import { MemberSheet } from './member-sheet';
import styles from './tree.module.css';

export function TreePreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = getTreePerson(searchParams.get('person'));
  const profileOpen = searchParams.has('person');
  const directoryView = searchParams.get('view') === 'directory';

  useEffect(() => {
    if (!profileOpen || !window.matchMedia('(max-width: 760px)').matches) return;
    const profile = document.getElementById('selected-member-profile');
    profile?.focus({ preventScroll: true });
  }, [profileOpen, selected.id]);

  function selectPerson(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('person', id);
    router.replace(`/design-preview/tree?${next.toString()}`, { scroll: false });
  }

  function closeProfile() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('person');
    router.replace(`/design-preview/tree${next.size ? `?${next.toString()}` : ''}`, {
      scroll: false,
    });
    document.getElementById('tree-top')?.focus({ preventScroll: true });
    document.getElementById('tree-top')?.scrollIntoView({ block: 'start' });
  }

  return (
    <main id="main" className={styles.treePage}>
      <header id="tree-top" className={styles.treeMasthead} tabIndex={-1}>
        <div>
          <p>GIA PHẢ · 15 NGƯỜI</p>
          <h1>Cây nhà mình</h1>
        </div>
        <div className={styles.treeIntro}>
          <nav aria-label="Chế độ xem gia phả">
            <Link href="/design-preview/tree?person=gia-bao">Về tôi</Link>
            <Link href="/design-preview/tree?view=directory">Tìm người</Link>
          </nav>
        </div>
      </header>
      <div className={styles.treeWorkspace}>
        {directoryView ? (
          <TreeDirectory selectedId={selected.id} />
        ) : (
          <TreeCanvas selected={selected} onSelect={selectPerson} />
        )}
        {profileOpen ? (
          <button
            className={styles.sheetBackdrop}
            type="button"
            aria-label="Đóng hồ sơ người thân"
            onClick={closeProfile}
          />
        ) : null}
        <MemberSheet
          member={selected}
          onSelect={selectPerson}
          open={profileOpen}
          onClose={closeProfile}
        />
      </div>
    </main>
  );
}
