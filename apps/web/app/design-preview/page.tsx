import Link from 'next/link';
import { getPreviewMember, previewDirectory, previewGathering, previewMember } from './fixtures';
import styles from './mobile.module.css';
import { PreviewIdentity } from './preview-identity';
import { PreviewShell } from './preview-shell';

export default async function DesignPreviewHome({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const isEmpty = state === 'empty';
  const viewer = getPreviewMember('gia-bao');
  const minhAnh = getPreviewMember('minh-anh');

  return (
    <PreviewShell>
      <main id="main" className={styles.homePage}>
        <header className={styles.mobilePageHeader}>
          <div>
            <p>THỨ TƯ, 09 THÁNG 9</p>
            <h1>Nhà mình, hôm nay.</h1>
            <span>Chào buổi tối, {viewer.familiarName}</span>
          </div>
          <PreviewIdentity member={viewer} size="medium" />
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
            <Link className={styles.nextEvent} href="/design-preview/me?panel=notifications">
              <time dateTime={previewGathering.date}>
                <strong>{previewGathering.day}</strong>
                <span>THÁNG 9</span>
              </time>
              <span className={styles.eventMain}>
                <small>12 NGÀY NỮA</small>
                <strong>{previewGathering.title}</strong>
                <span>
                  {previewGathering.time} · {previewGathering.location}
                </span>
              </span>
              <span aria-hidden="true">›</span>
            </Link>

            <section className={styles.homeSection} aria-labelledby="moments-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <p>VỪA XẢY RA</p>
                  <h2 id="moments-heading">Khoảnh khắc trong nhà</h2>
                </div>
                <Link href="/design-preview/moments">Xem tất cả</Link>
              </div>
              <div className={styles.momentQuickBar}>
                <span>Có chuyện gì muốn gửi về nhà?</span>
                <Link href="/design-preview/moments?compose=true">Gửi ảnh</Link>
              </div>
              <div className={styles.momentRail}>
                <Link
                  className={`${styles.momentCard} ${styles.momentKitchen}`}
                  href="/design-preview/profile"
                  aria-label="Xem hồ sơ Dì Hương"
                >
                  <span
                    className={styles.momentImage}
                    aria-label="Minh họa nồi canh chua trên bàn"
                    role="img"
                  />
                  <span className={styles.momentPerson}>
                    <PreviewIdentity member={previewMember} size="small" />
                    <span>
                      <strong>{previewMember.familiarName}</strong>
                      <small>hôm qua</small>
                    </span>
                  </span>
                  <span>Canh chua đã lên bếp, ai về trễ vẫn còn phần.</span>
                </Link>
                <article className={`${styles.momentCard} ${styles.momentRain}`}>
                  <span
                    className={styles.momentImage}
                    aria-label="Minh họa trời mưa sau khung cửa"
                    role="img"
                  />
                  <span className={styles.momentPerson}>
                    <PreviewIdentity member={minhAnh} size="small" />
                    <span>
                      <strong>{minhAnh.familiarName}</strong>
                      <small>2 giờ trước</small>
                    </span>
                  </span>
                  <span>Đà Nẵng chiều nay mưa. Cả nhà nhớ mang áo nhé.</span>
                </article>
              </div>
            </section>

            <section className={styles.homeSection} aria-labelledby="upcoming-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <p>SẮP TỚI</p>
                  <h2 id="upcoming-heading">Để mình cùng nhớ</h2>
                </div>
              </div>
              <div className={styles.reminderList}>
                <div>
                  <time dateTime="2026-09-14">
                    <strong>14</strong>
                    <span>TH 9</span>
                  </time>
                  <span>
                    <strong>Sinh nhật Minh Anh</strong>
                    <small>5 ngày nữa · Nhắc cả nhà lúc 8:00</small>
                  </span>
                </div>
                <div>
                  <time dateTime="2026-09-27">
                    <strong>27</strong>
                    <span>TH 9</span>
                  </time>
                  <span>
                    <strong>Bữa cơm chủ nhật</strong>
                    <small>Nhà bà Mai · Cần Thơ</small>
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.familyShortcut}>
              <div>
                <span className={styles.familyFaces} aria-hidden="true">
                  {previewDirectory.slice(0, 4).map((member) => (
                    <PreviewIdentity key={member.id} member={member} size="small" />
                  ))}
                </span>
                <p>
                  <strong>15 người trong nhà</strong>
                  <span>Tìm người thân và xem quan hệ</span>
                </p>
              </div>
              <Link href="/design-preview/tree">
                Mở gia phả <span aria-hidden="true">→</span>
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
