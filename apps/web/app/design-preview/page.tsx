import Link from 'next/link';
import { previewDirectory, previewGathering, previewMember } from './fixtures';
import { PreviewIdentity } from './preview-identity';
import styles from './preview.module.css';
import { PreviewShell } from './preview-shell';

export default async function DesignPreviewHome({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const isEmpty = state === 'empty';

  return (
    <PreviewShell>
      <main id="main" className={styles.homePage}>
        <header className={styles.homeHeader}>
          <div className={styles.issueMark}>
            <span>NHÀ ÔNG BÌNH &amp; BÀ MAI</span>
            <span>THỨ TƯ · 09.09.2026</span>
          </div>
          <div className={styles.homeHeading}>
            <div>
              <p className={styles.kicker}>Chuyện mới trong nhà</p>
              <h1>Nhà mình, hôm nay.</h1>
            </div>
            <p>
              Một trang mở ra để biết ai đang nhớ nhà, điều gì sắp đến và câu chuyện nào nên được
              giữ lại.
            </p>
          </div>
        </header>

        {isEmpty ? (
          <section className={styles.emptyHome} aria-labelledby="empty-home-heading">
            <span className={styles.emptyNumber}>01</span>
            <div>
              <p className={styles.kicker}>Ngày đầu tiên</p>
              <h2 id="empty-home-heading">Nhà mình đang chờ câu chuyện đầu tiên.</h2>
              <p>
                Mời người thân, thêm một ngày quan trọng hoặc bắt đầu từ cây gia phả. Mỗi việc đều
                giúp căn nhà số này trở nên quen thuộc hơn.
              </p>
              <Link className={styles.textLink} href="/design-preview/join">
                Xem luồng mời người thân <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className={styles.eventLedger} aria-labelledby="next-event-heading">
              <time dateTime={previewGathering.date} className={styles.eventDate}>
                <strong>{previewGathering.day}</strong>
                <span>{previewGathering.month}</span>
              </time>
              <div className={styles.eventCopy}>
                <p className={styles.kicker}>Cả nhà sắp gặp</p>
                <h2 id="next-event-heading">{previewGathering.title}</h2>
                <p>
                  {previewGathering.time} · {previewGathering.location}
                </p>
              </div>
              <div className={styles.eventNote}>
                <span>12 ngày nữa</span>
                <p>{previewGathering.description}</p>
              </div>
            </section>

            <section className={styles.storyFeature} aria-labelledby="story-heading">
              <div
                className={styles.storyArtwork}
                role="img"
                aria-label="Minh họa nồi canh chua trên bàn ăn gia đình"
              >
                <span className={styles.artWindow} />
                <span className={styles.artTable} />
                <span className={styles.artBowl} />
                <span className={styles.artLeafOne} />
                <span className={styles.artLeafTwo} />
                <small>ẢNH GIA ĐÌNH · CHƯA CÓ</small>
              </div>
              <article className={styles.storyCopy}>
                <span className={styles.storyNumber}>01 / CHUYỆN NHÀ</span>
                <h2 id="story-heading">Nồi canh chua mà ai đi xa cũng nhớ.</h2>
                <p className={styles.storyLead}>
                  Dì Hương vừa ghi lại công thức chủ nhật: me vừa tay, rau om cắt sau cùng và luôn
                  chừa một phần cho người về trễ.
                </p>
                <div className={styles.storyByline}>
                  <PreviewIdentity member={previewMember} size="small" />
                  <div>
                    <strong>{previewMember.familiarName}</strong>
                    <span>ghi lại · hôm qua</span>
                  </div>
                </div>
                <Link className={styles.textLink} href="/design-preview/profile">
                  Xem hồ sơ Dì Hương <span aria-hidden="true">→</span>
                </Link>
              </article>
            </section>

            <section className={styles.peopleSection} aria-labelledby="people-heading">
              <div className={styles.sectionIntro}>
                <div>
                  <p className={styles.kicker}>Người trong nhà</p>
                  <h2 id="people-heading">Gần nhau qua từng khuôn mặt.</h2>
                </div>
                <Link className={styles.textLink} href="/design-preview/tree?view=directory">
                  Mở danh bạ <span aria-hidden="true">→</span>
                </Link>
              </div>
              <ol className={styles.peopleList}>
                {previewDirectory.slice(0, 5).map((member, index) => (
                  <li key={member.id}>
                    <span className={styles.peopleIndex}>{String(index + 1).padStart(2, '0')}</span>
                    <PreviewIdentity member={member} />
                    <div>
                      {member.id === 'thanh-huong' ? (
                        <Link href="/design-preview/profile">{member.familiarName}</Link>
                      ) : (
                        <strong>{member.familiarName}</strong>
                      )}
                      <span>{member.relationToViewer}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <footer className={styles.homeFooter}>
          <span>Không quảng cáo · Không người lạ · Dữ liệu thuộc về gia đình</span>
          <Link href={isEmpty ? '/design-preview' : '/design-preview?state=empty'}>
            {isEmpty ? 'Xem trạng thái có nội dung' : 'Xem trạng thái nhà mới'}
          </Link>
        </footer>
      </main>
    </PreviewShell>
  );
}
