import Link from 'next/link';
import { previewDirectory, previewGathering } from './fixtures';
import styles from './preview.module.css';
import { PreviewShell } from './preview-shell';

export default function DesignPreviewHome() {
  return (
    <PreviewShell>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.kicker}>Không gian gia đình · Bản mẫu</p>
            <h1 className={styles.homeTitle}>Chào cả nhà.</h1>
          </div>
          <p className={styles.headerIntro}>
            Một góc nhỏ để thấy việc cần nhớ, gặp người thân và giữ lại những câu chuyện của nhà.
          </p>
        </header>

        <main id="main" className={styles.main}>
          <section className={styles.dateStrip} aria-labelledby="upcoming-heading">
            <div className={styles.dateStripLabel}>
              <p className={styles.kicker}>Điều sắp tới</p>
              <h2 id="upcoming-heading">Lịch hẹn sắp tới</h2>
            </div>
            <div className={styles.dateStripEvent}>
              <time dateTime={previewGathering.date}>{previewGathering.dateLabel}</time>
              <div>
                <h3>{previewGathering.title}</h3>
                <p>{previewGathering.description}</p>
              </div>
              <span className={styles.syntheticLabel}>Dữ liệu minh họa</span>
            </div>
          </section>

          <div className={styles.editorialGrid}>
            <section className={styles.storySection} aria-labelledby="story-heading">
              <div className={styles.sectionHeading}>
                <p className={styles.kicker}>Chuyện nhà</p>
                <h2 id="story-heading">Nồi canh chua của Dì Hương.</h2>
              </div>
              <p className={styles.storyLead}>
                Dì Hương ghi lại món cả nhà thường nấu vào chủ nhật.
              </p>
              <div
                className={styles.imagePlaceholder}
                role="img"
                aria-label="Vị trí dành cho ảnh gia đình"
              >
                <span>Ảnh món ăn</span>
                <small>Chưa có ảnh trong bản mẫu</small>
              </div>
              <p className={styles.caption}>
                Bản mẫu giữ chỗ cho ảnh nồi canh chua được gia đình chia sẻ.
              </p>
            </section>

            <section className={styles.directorySection} aria-labelledby="directory-heading">
              <div className={styles.sectionHeading}>
                <p className={styles.kicker}>Người trong nhà</p>
                <h2 id="directory-heading">Danh bạ gia đình</h2>
              </div>
              <ul className={styles.directoryList}>
                {previewDirectory.map((member) => (
                  <li key={member.displayName}>
                    <span className={styles.initials} aria-hidden="true">
                      {member.familiarName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                    <div className={styles.directoryCopy}>
                      {member.familiarName === 'Dì Hương' ? (
                        <Link className={styles.directoryLink} href="/design-preview/profile">
                          Xem hồ sơ Dì Hương
                        </Link>
                      ) : (
                        <span className={styles.directoryName}>{member.familiarName}</span>
                      )}
                      <span className={styles.directoryMeta}>{member.displayName}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className={styles.supportingText}>
                Lịch nhà, Trò chuyện và Khoảnh khắc chưa thuộc bản mẫu này.
              </p>
            </section>
          </div>
        </main>
      </div>
    </PreviewShell>
  );
}
