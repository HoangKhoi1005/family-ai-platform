import Link from 'next/link';
import { getPreviewMember, previewDirectory, previewGathering, previewMember } from './fixtures';
import { HomeMoment } from './home/home-moment';
import { HomePulse } from './home/home-pulse';
import styles from './mobile.module.css';
import { PreviewShell } from './preview-shell';

export default async function DesignPreviewHome({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const isEmpty = state === 'empty';
  const viewer = getPreviewMember('gia-bao');
  const pulseMembers = ['thanh-huong', 'minh-anh', 'thi-mai', 'hai-nam'].map((id) =>
    getPreviewMember(id),
  );

  return (
    <PreviewShell>
      <main id="main" className={styles.homePage}>
        <header className={styles.homeGreeting}>
          <p>Thứ tư, 09 tháng 9</p>
          <h1>Chào {viewer.familiarName}, nhà mình có gì mới?</h1>
        </header>

        {isEmpty ? (
          <section className={styles.emptyState} aria-labelledby="empty-home-heading">
            <span className={styles.emptyIllustration} aria-hidden="true">
              NM
            </span>
            <h2 id="empty-home-heading">Nhà đang chờ khoảnh khắc đầu tiên.</h2>
            <p>Mời người thân hoặc gửi một tấm ảnh để mọi người có lý do ghé về mỗi ngày.</p>
            <Link className={styles.primaryButton} href="/design-preview/join">
              Mời người thân
            </Link>
          </section>
        ) : (
          <>
            <HomePulse members={pulseMembers} />

            <section className={styles.homeMomentSection} aria-labelledby="moments-heading">
              <div className={styles.homeSectionHeading}>
                <h2 id="moments-heading">Mới trong nhà</h2>
                <Link href="/design-preview/moments">Xem tất cả</Link>
              </div>
              <HomeMoment
                member={previewMember}
                timeLabel="12 phút trước"
                message="Canh chua đã lên bếp, ai về trễ vẫn còn phần."
              />
              <Link
                className={styles.shareMomentAction}
                href="/design-preview/moments?compose=true"
                aria-label="Gửi Khoảnh khắc"
              >
                <span aria-hidden="true">＋</span>
                <span>
                  <strong>Gửi Khoảnh khắc</strong>
                  <small>Cho cả nhà thấy bạn đang làm gì</small>
                </span>
              </Link>
            </section>

            <Link className={styles.homeEvent} href="/design-preview/me?panel=notifications">
              <time dateTime={previewGathering.date}>
                <strong>{previewGathering.day}</strong>
                <span>tháng 9</span>
              </time>
              <span>
                <small>Còn 12 ngày</small>
                <strong>{previewGathering.title}</strong>
                <span>
                  {previewGathering.time} · {previewGathering.location}
                </span>
              </span>
              <span aria-hidden="true">›</span>
            </Link>

            <section className={styles.homePaths} aria-label="Khám phá gia đình">
              <Link className={styles.memoryPath} href="/design-preview/memories">
                <small>Kỷ niệm</small>
                <strong>Nghe bà Mai kể chuyện căn nhà đầu tiên</strong>
                <span>
                  Mở dòng ký ức <b aria-hidden="true">›</b>
                </span>
              </Link>
              <Link className={styles.treePath} href="/design-preview/tree">
                <span className={styles.familyFaces} aria-hidden="true">
                  {previewDirectory.slice(0, 4).map((member) => (
                    <span key={member.id}>{member.initials}</span>
                  ))}
                </span>
                <small>15 người trong nhà</small>
                <strong>Xem người thân quanh bạn</strong>
              </Link>
            </section>
          </>
        )}

        <footer className={styles.mobileFooter}>
          <span>Riêng tư cho gia đình</span>
          <Link href={isEmpty ? '/design-preview' : '/design-preview?state=empty'}>
            {isEmpty ? 'Xem nhà có nội dung' : 'Xem trạng thái nhà mới'}
          </Link>
        </footer>
      </main>
    </PreviewShell>
  );
}
