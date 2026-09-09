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
    profile?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
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
          <p>NGƯỜI THÂN / GIA PHẢ</p>
          <h1>Nhìn một nhánh, nhớ cả nhà.</h1>
        </div>
        <div className={styles.treeIntro}>
          <p>
            Mỗi nút là một người. Chọn một khuôn mặt để thấy hồ sơ ngay bên cạnh mà không rời khỏi
            mạch gia đình.
          </p>
          <nav aria-label="Chế độ xem gia phả">
            <Link href={`/design-preview/tree?person=${selected.id}`}>Xem sơ đồ</Link>
            <Link href={`/design-preview/tree?view=directory&person=${selected.id}`}>
              Mở danh bạ
            </Link>
          </nav>
        </div>
      </header>
      <div className={styles.treeWorkspace}>
        {directoryView ? (
          <TreeDirectory selectedId={selected.id} />
        ) : (
          <TreeCanvas selected={selected} onSelect={selectPerson} />
        )}
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
