'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreviewDialog } from '../use-preview-dialog';
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
  const sheetRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const treeTopRef = useRef<HTMLElement>(null);
  const [mobileSheet, setMobileSheet] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const update = () => setMobileSheet(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    returnFocusRef.current ??= treeTopRef.current;
  }, []);

  useEffect(() => {
    if (!profileOpen || !mobileSheet) return;
    window.requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (sheet && !sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
    });
  }, [mobileSheet, profileOpen, selected.id]);

  function selectPerson(id: string, opener?: HTMLButtonElement) {
    if (opener) returnFocusRef.current = opener;
    const next = new URLSearchParams(searchParams.toString());
    next.set('person', id);
    router.replace(`/design-preview/tree?${next.toString()}`, { scroll: false });
  }

  const closeProfile = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('person');
    router.replace(`/design-preview/tree${next.size ? `?${next.toString()}` : ''}`, {
      scroll: false,
    });
  }, [router, searchParams]);

  usePreviewDialog({
    open: profileOpen && mobileSheet,
    dialogRef: sheetRef,
    returnFocusRef,
    onClose: closeProfile,
  });

  return (
    <main id="main" className={styles.treePage}>
      <header ref={treeTopRef} id="tree-top" className={styles.treeMasthead} tabIndex={-1}>
        <div>
          <p>GIA PHẢ · 15 NGƯỜI</p>
          <h1>Cây nhà mình</h1>
        </div>
        <div className={styles.treeIntro}>
          <nav aria-label="Chế độ xem gia phả">
            <Link
              href="/design-preview/tree?person=gia-bao"
              onClick={(event) => {
                returnFocusRef.current = event.currentTarget;
              }}
            >
              Về tôi
            </Link>
            <Link href="/design-preview/tree?view=directory">Tìm người</Link>
          </nav>
        </div>
      </header>
      <div className={styles.treeWorkspace}>
        {directoryView ? (
          <TreeDirectory
            selectedId={selected.id}
            onOpenProfile={(opener) => {
              returnFocusRef.current = opener;
            }}
          />
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
          sheetRef={sheetRef}
          modal={mobileSheet}
        />
      </div>
    </main>
  );
}
