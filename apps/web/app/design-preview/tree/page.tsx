import { Suspense } from 'react';
import { PreviewShell } from '../preview-shell';
import { TreePreview } from './tree-preview';

export default function DesignPreviewTree() {
  return (
    <PreviewShell>
      <Suspense
        fallback={
          <main id="main" aria-busy="true">
            Đang mở gia phả minh họa…
          </main>
        }
      >
        <TreePreview />
      </Suspense>
    </PreviewShell>
  );
}
