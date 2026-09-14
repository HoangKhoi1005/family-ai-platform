import Link from 'next/link';
import { previewMemories } from '../fixtures';
import { PreviewShell } from '../preview-shell';
import { MemoriesTimeline } from './memories-timeline';
import styles from './memories.module.css';

export default function MemoriesPreviewPage() {
  return (
    <PreviewShell>
      <main id="main" className={styles.page}>
        <header className={styles.header}>
          <Link href="/design-preview">‹ Nhà</Link>
          <p>Kỷ niệm được người nhà lưu lại</p>
          <h1>Dòng ký ức nhà mình</h1>
          <span>Ảnh, lời kể và những ngày quan trọng được đặt cạnh nhau theo thời gian.</span>
        </header>
        <MemoriesTimeline memories={previewMemories} />
        <footer className={styles.privacyNote}>
          <strong>Riêng tư theo từng Kỷ niệm</strong>
          <span>Người đóng góp chọn ai trong nhà được xem trước khi lưu.</span>
        </footer>
      </main>
    </PreviewShell>
  );
}
