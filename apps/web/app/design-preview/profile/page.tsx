import { previewMember } from '../fixtures';
import styles from '../preview.module.css';
import { PreviewShell } from '../preview-shell';

export default function DesignPreviewProfile() {
  return (
    <PreviewShell>
      <div className={styles.page}>
        <header className={styles.profileHeader}>
          <div
            className={styles.profileAvatar}
            role="img"
            aria-label="Ảnh đại diện chưa có, viết tắt DH"
          >
            DH
          </div>
          <div>
            <p className={styles.kicker}>Hồ sơ thành viên · Bản mẫu</p>
            <h1 className={styles.profileTitle}>
              <span className={styles.familiarName}>{previewMember.familiarName}</span>
              <span className={styles.fullName}>{previewMember.displayName}</span>
            </h1>
            <p className={styles.profileIntro}>Một vài điều được ghi lại để cả nhà nhận ra nhau.</p>
          </div>
        </header>

        <main id="main" className={styles.profileMain}>
          <section className={styles.biographySection} aria-labelledby="biography-heading">
            <p className={styles.kicker}>Câu chuyện</p>
            <h2 id="biography-heading">Đôi điều về Dì Hương</h2>
            <p className={styles.biography}>{previewMember.biography}</p>
          </section>

          <section className={styles.detailsSection} aria-labelledby="details-heading">
            <p className={styles.kicker}>Thông tin cơ bản</p>
            <h2 id="details-heading">Điều đã được chia sẻ</h2>
            <dl className={styles.detailsList}>
              <div>
                <dt>Năm sinh</dt>
                <dd>{previewMember.birthYear}</dd>
              </div>
              <div>
                <dt>Quê quán</dt>
                <dd>{previewMember.hometown}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.contactSection} aria-labelledby="contact-heading">
            <p className={styles.kicker}>Kết nối</p>
            <h2 id="contact-heading">Thông tin liên hệ</h2>
            <p>
              Thông tin liên hệ chưa được cung cấp trong bản mẫu này. Khi có dữ liệu được chia sẻ,
              hồ sơ sẽ hiển thị đúng thông tin mà chủ hồ sơ cho phép.
            </p>
          </section>

          <p className={styles.supportingText}>
            Lịch nhà, Trò chuyện và Khoảnh khắc chưa thuộc bản mẫu này.
          </p>
        </main>
      </div>
    </PreviewShell>
  );
}
