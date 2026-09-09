import Link from 'next/link';
import { previewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import styles from '../preview.module.css';
import { PreviewShell } from '../preview-shell';

type ProfileMode = 'view' | 'edit' | 'saving' | 'error' | 'conflict';

export default async function DesignPreviewProfile({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: requestedMode } = await searchParams;
  const mode: ProfileMode = ['edit', 'saving', 'error', 'conflict'].includes(requestedMode ?? '')
    ? (requestedMode as ProfileMode)
    : 'view';
  const editing = mode !== 'view';

  return (
    <PreviewShell>
      <main id="main" className={styles.profilePage}>
        <header className={styles.profileMasthead}>
          <div className={styles.profilePortraitWrap}>
            <PreviewIdentity member={previewMember} size="large" />
            <span>THẾ HỆ 02</span>
          </div>
          <div className={styles.profileIdentity}>
            <p className={styles.kicker}>Trang của một người thân</p>
            <h1>
              <span>{previewMember.familiarName}</span>
              {previewMember.displayName}
            </h1>
            <p>{previewMember.relationToViewer} của Gia Bảo · Nhánh ông Bình và bà Mai</p>
          </div>
          <nav className={styles.profileActions} aria-label="Thao tác hồ sơ">
            <a href="tel:0900000002" aria-label="Gọi Dì Hương">
              Gọi
            </a>
            <a href="sms:0900000002" aria-label="Nhắn Dì Hương">
              Nhắn
            </a>
            <a href="mailto:di.huong@example.invalid" aria-label="Gửi email cho Dì Hương">
              Email
            </a>
            <Link href="/design-preview/tree?person=thanh-huong">Xem trong gia phả</Link>
            <Link href={editing ? '/design-preview/profile' : '/design-preview/profile?mode=edit'}>
              {editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa hồ sơ'}
            </Link>
          </nav>
        </header>

        {editing ? (
          <ProfileEditPreview mode={mode} />
        ) : (
          <div className={styles.profileEditorial}>
            <section className={styles.profileStory} aria-labelledby="profile-story-heading">
              <span className={styles.sectionNumber}>01</span>
              <div>
                <p className={styles.kicker}>Một vài điều về Dì</p>
                <h2 id="profile-story-heading">Người luôn nhớ phần cơm của người về muộn.</h2>
                <p>{previewMember.biography}</p>
                <blockquote>“Món ngon là món có người ngồi ăn cùng.”</blockquote>
              </div>
            </section>

            <section className={styles.profileFacts} aria-labelledby="profile-facts-heading">
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNumber}>02</span>
                <div>
                  <p className={styles.kicker}>Điều đã chia sẻ</p>
                  <h2 id="profile-facts-heading">Để cả nhà dễ tìm nhau.</h2>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Năm sinh</dt>
                  <dd>{previewMember.birthYear}</dd>
                </div>
                <div>
                  <dt>Quê quán</dt>
                  <dd>{previewMember.hometown}</dd>
                </div>
                <div>
                  <dt>Đang sống tại</dt>
                  <dd>{previewMember.currentCity}</dd>
                </div>
                <div>
                  <dt>Điện thoại</dt>
                  <dd>
                    <a
                      href={`tel:${previewMember.phone?.replaceAll(' ', '')}`}
                      aria-label={`Số điện thoại của ${previewMember.familiarName}`}
                    >
                      {previewMember.phone}
                    </a>
                  </dd>
                </div>
                <div className={styles.wideFact}>
                  <dt>Email</dt>
                  <dd>
                    <a
                      href={`mailto:${previewMember.email}`}
                      aria-label={`Địa chỉ email của ${previewMember.familiarName}`}
                    >
                      {previewMember.email}
                    </a>
                  </dd>
                </div>
              </dl>
              <p className={styles.privacyNote}>
                Chỉ thành viên đã được duyệt trong nhà mới thấy thông tin liên hệ minh họa này.
              </p>
            </section>
          </div>
        )}
      </main>
    </PreviewShell>
  );
}

function ProfileEditPreview({ mode }: { mode: ProfileMode }) {
  const status = {
    edit: null,
    saving: 'Đang lưu thay đổi minh họa…',
    error: 'Chưa thể lưu. Nội dung bạn nhập vẫn còn ở đây để thử lại.',
    conflict: 'Hồ sơ vừa được cập nhật ở nơi khác. Hãy xem lại trước khi lưu.',
    view: null,
  }[mode];

  return (
    <section className={styles.editPanel} aria-labelledby="edit-heading">
      <div className={styles.editIntro}>
        <span className={styles.sectionNumber}>01</span>
        <div>
          <p className={styles.kicker}>Chỉnh sửa có chủ đích</p>
          <h2 id="edit-heading">Điều gì về Dì Hương cần được giữ đúng?</h2>
          <p>Mỗi thay đổi ở đây chỉ là trạng thái thị giác. Bản mẫu không gửi hay lưu dữ liệu.</p>
        </div>
      </div>
      {status ? (
        <p
          className={`${styles.formStatus} ${styles[`formStatus${mode}`]}`}
          role={mode === 'error' || mode === 'conflict' ? 'alert' : 'status'}
        >
          {status}
        </p>
      ) : null}
      <form className={styles.profileForm}>
        <label>
          Ở nhà thường gọi
          <input defaultValue={previewMember.familiarName} />
        </label>
        <label>
          Họ và tên
          <input defaultValue={previewMember.displayName} />
        </label>
        <label>
          Quê quán
          <input defaultValue={previewMember.hometown} />
        </label>
        <label className={styles.fullField}>
          Một vài điều về mình
          <textarea defaultValue={previewMember.biography} rows={4} />
        </label>
      </form>
      <div className={styles.editActions}>
        <Link className={styles.primaryAction} href="/design-preview/profile?mode=saving">
          Lưu bản mẫu
        </Link>
        {mode === 'saving' ? <Link href="/design-preview/profile">Hoàn tất lưu</Link> : null}
        {mode === 'error' ? (
          <Link href="/design-preview/profile?mode=saving">Thử lưu lại</Link>
        ) : null}
        {mode === 'conflict' ? (
          <Link href="/design-preview/profile?mode=edit">Xem bản mới nhất</Link>
        ) : null}
        <Link href="/design-preview/profile">Hủy</Link>
      </div>
      <nav className={styles.stateSwitcher} aria-label="Trạng thái chỉnh sửa minh họa">
        <span>Xem trạng thái:</span>
        <Link href="?mode=edit">Đang sửa</Link>
        <Link href="?mode=saving">Đang lưu</Link>
        <Link href="?mode=error">Có lỗi</Link>
        <Link href="?mode=conflict">Xung đột</Link>
      </nav>
    </section>
  );
}
