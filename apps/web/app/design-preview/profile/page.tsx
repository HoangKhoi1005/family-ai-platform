import Link from 'next/link';
import { getPreviewMember } from '../fixtures';
import type { PreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import styles from '../preview.module.css';
import { PreviewShell } from '../preview-shell';

type ProfileMode = 'view' | 'edit' | 'saving' | 'error' | 'conflict';

function profileHref(memberId: string, mode: ProfileMode = 'view') {
  const params = new URLSearchParams({ person: memberId });
  if (mode !== 'view') params.set('mode', mode);
  return `/design-preview/profile?${params.toString()}`;
}

export default async function DesignPreviewProfile({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; person?: string }>;
}) {
  const { mode: requestedMode, person } = await searchParams;
  const member = getPreviewMember(person ?? 'thanh-huong');
  const mode: ProfileMode = ['edit', 'saving', 'error', 'conflict'].includes(requestedMode ?? '')
    ? (requestedMode as ProfileMode)
    : 'view';
  const editing = mode !== 'view';
  const isViewer = member.id === 'gia-bao';

  return (
    <PreviewShell>
      <main id="main" className={styles.profilePage}>
        <header className={styles.profileMasthead}>
          <div className={styles.profilePortraitWrap}>
            <PreviewIdentity member={member} size="large" />
            <span>THẾ HỆ {String(member.generation).padStart(2, '0')}</span>
          </div>
          <div className={styles.profileIdentity}>
            <p className={styles.kicker}>
              {isViewer ? 'Hồ sơ của bạn' : 'Trang của một người thân'}
            </p>
            <h1>
              <span>{member.familiarName}</span>
              {member.displayName}
            </h1>
            <p>
              {isViewer ? 'Thành viên của Nhà mình' : `${member.relationToViewer} của Gia Bảo`} ·
              Nhánh ông Bình và bà Mai
            </p>
          </div>
          <nav className={styles.profileActions} aria-label="Thao tác hồ sơ">
            {member.phone ? (
              <>
                <a
                  href={`tel:${member.phone.replaceAll(' ', '')}`}
                  aria-label={`Gọi ${member.familiarName}`}
                >
                  Gọi
                </a>
                <a
                  href={`sms:${member.phone.replaceAll(' ', '')}`}
                  aria-label={`Nhắn ${member.familiarName}`}
                >
                  Nhắn
                </a>
              </>
            ) : null}
            {member.email ? (
              <a
                href={`mailto:${member.email}`}
                aria-label={`Gửi email cho ${member.familiarName}`}
              >
                Email
              </a>
            ) : null}
            <Link href={`/design-preview/tree?person=${member.id}`}>Xem trong gia phả</Link>
            <Link href={editing ? profileHref(member.id) : profileHref(member.id, 'edit')}>
              {editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa hồ sơ'}
            </Link>
          </nav>
        </header>

        {editing ? (
          <ProfileEditPreview member={member} mode={mode} />
        ) : (
          <div className={styles.profileEditorial}>
            <section className={styles.profileStory} aria-labelledby="profile-story-heading">
              <span className={styles.sectionNumber}>01</span>
              <div>
                <p className={styles.kicker}>
                  {isViewer ? 'Một vài điều về bạn' : `Một vài điều về ${member.familiarName}`}
                </p>
                <h2 id="profile-story-heading">
                  {member.biography
                    ? 'Một câu chuyện nhỏ được cả nhà gìn giữ.'
                    : 'Hồ sơ này đang chờ bạn kể thêm.'}
                </h2>
                <p>
                  {member.biography ??
                    'Thêm vài dòng về sở thích, công việc hoặc một kỷ niệm mà bạn muốn cả nhà nhớ.'}
                </p>
                {member.biography ? (
                  <blockquote>“Món ngon là món có người ngồi ăn cùng.”</blockquote>
                ) : null}
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
                {member.birthYear ? (
                  <ProfileFact label="Năm sinh" value={member.birthYear} />
                ) : null}
                {member.hometown ? <ProfileFact label="Quê quán" value={member.hometown} /> : null}
                {member.currentCity ? (
                  <ProfileFact label="Đang sống tại" value={member.currentCity} />
                ) : null}
                {member.phone ? (
                  <div>
                    <dt>Điện thoại</dt>
                    <dd>
                      <a
                        href={`tel:${member.phone.replaceAll(' ', '')}`}
                        aria-label={`Số điện thoại của ${member.familiarName}`}
                      >
                        {member.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {member.email ? (
                  <div className={styles.wideFact}>
                    <dt>Email</dt>
                    <dd>
                      <a
                        href={`mailto:${member.email}`}
                        aria-label={`Địa chỉ email của ${member.familiarName}`}
                      >
                        {member.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
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

function ProfileFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProfileEditPreview({ member, mode }: { member: PreviewMember; mode: ProfileMode }) {
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
          <h2 id="edit-heading">Điều gì về {member.familiarName} cần được giữ đúng?</h2>
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
          <input defaultValue={member.familiarName} />
        </label>
        <label>
          Họ và tên
          <input defaultValue={member.displayName} />
        </label>
        <label>
          Quê quán
          <input defaultValue={member.hometown ?? ''} />
        </label>
        <label className={styles.fullField}>
          Một vài điều về mình
          <textarea defaultValue={member.biography ?? ''} rows={4} />
        </label>
      </form>
      <div className={styles.editActions}>
        <Link className={styles.primaryAction} href={profileHref(member.id, 'saving')}>
          Lưu bản mẫu
        </Link>
        {mode === 'saving' ? <Link href={profileHref(member.id)}>Hoàn tất lưu</Link> : null}
        {mode === 'error' ? <Link href={profileHref(member.id, 'saving')}>Thử lưu lại</Link> : null}
        {mode === 'conflict' ? (
          <Link href={profileHref(member.id, 'edit')}>Xem bản mới nhất</Link>
        ) : null}
        <Link href={profileHref(member.id)}>Hủy</Link>
      </div>
      <nav className={styles.stateSwitcher} aria-label="Trạng thái chỉnh sửa minh họa">
        <span>Xem trạng thái:</span>
        <Link href={profileHref(member.id, 'edit')}>Đang sửa</Link>
        <Link href={profileHref(member.id, 'saving')}>Đang lưu</Link>
        <Link href={profileHref(member.id, 'error')}>Có lỗi</Link>
        <Link href={profileHref(member.id, 'conflict')}>Xung đột</Link>
      </nav>
    </section>
  );
}
