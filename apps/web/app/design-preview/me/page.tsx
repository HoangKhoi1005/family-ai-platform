import Link from 'next/link';
import { getPreviewMember } from '../fixtures';
import styles from '../mobile.module.css';
import { PreviewIdentity } from '../preview-identity';
import { PreviewShell } from '../preview-shell';

export default async function DesignPreviewMe({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const { panel } = await searchParams;
  const viewer = getPreviewMember('gia-bao');
  return (
    <PreviewShell>
      <main id="main" className={styles.mePage}>
        <header className={styles.meIdentity}>
          <PreviewIdentity member={viewer} size="large" />
          <div>
            <p>HỒ SƠ CỦA TÔI</p>
            <h1>Gia Bảo</h1>
            <span>{viewer.displayName} · Thành viên</span>
          </div>
          <Link href="/design-preview/profile?mode=edit">Chỉnh sửa</Link>
        </header>
        {panel === 'notifications' ? (
          <section className={styles.notificationPanel}>
            <p>THÔNG BÁO</p>
            <h2>Hai điều sắp tới</h2>
            <div>
              <strong>Sinh nhật Minh Anh</strong>
              <span>5 ngày nữa · Nhắc lúc 8:00</span>
            </div>
            <div>
              <strong>Bữa cơm chủ nhật</strong>
              <span>12 ngày nữa · Cần Thơ</span>
            </div>
          </section>
        ) : null}
        <nav className={styles.settingsList} aria-label="Cài đặt tài khoản">
          <Link href="/design-preview/profile">
            <span>
              <strong>Hồ sơ cá nhân</strong>
              <small>Thông tin và cách cả nhà gọi bạn</small>
            </span>
            <b aria-hidden="true">›</b>
          </Link>
          <Link href="/design-preview/me?panel=notifications">
            <span>
              <strong>Thông báo</strong>
              <small>Sinh nhật, ngày giỗ và sự kiện</small>
            </span>
            <b aria-hidden="true">›</b>
          </Link>
          <Link href="/design-preview/me?panel=privacy">
            <span>
              <strong>Quyền riêng tư</strong>
              <small>Ai được xem thông tin của bạn</small>
            </span>
            <b aria-hidden="true">›</b>
          </Link>
        </nav>
        <section className={styles.adminEntry}>
          <p>QUẢN TRỊ NHÀ</p>
          <div>
            <span>
              <strong>Có 1 đề nghị cần xem</strong>
              <small>Xác nhận đúng người trước khi cho vào nhà</small>
            </span>
            <Link href="/design-preview/admin">Duyệt thành viên</Link>
          </div>
        </section>
        <p className={styles.previewFootnote}>
          Bản mẫu dùng dữ liệu hư cấu và không thay đổi tài khoản thật.
        </p>
      </main>
    </PreviewShell>
  );
}
