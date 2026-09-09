'use client';

import { useState } from 'react';
import { previewMembers } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import styles from './admin.module.css';

export type AdminState = 'pending' | 'empty' | 'conflict';

export function AdminPreview({ initialState }: { initialState: AdminState }) {
  const [state, setState] = useState<AdminState>(initialState);
  const [decision, setDecision] = useState<string | null>(null);
  const candidate = previewMembers.find((member) => member.id === 'hoang-an')!;

  function showState(nextState: AdminState) {
    setState(nextState);
    setDecision(null);
    window.history.replaceState(null, '', `/design-preview/admin?state=${nextState}`);
  }

  return (
    <main id="main" className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <p>QUẢN TRỊ NHÀ MÌNH</p>
          <h1>Giữ cửa nhà, bằng sự rõ ràng.</h1>
        </div>
        <p>
          Mỗi lời mời và thay đổi quan hệ đều cần một người trong nhà xem lại trước khi trở thành dữ
          liệu chung.
        </p>
      </header>
      <nav className={styles.stateNav} aria-label="Trạng thái quản trị minh họa">
        <span>Xem trạng thái</span>
        <button
          type="button"
          aria-pressed={state === 'pending'}
          onClick={() => showState('pending')}
        >
          Đang chờ
        </button>
        <button type="button" aria-pressed={state === 'empty'} onClick={() => showState('empty')}>
          Đã xử lý hết
        </button>
        <button
          type="button"
          aria-pressed={state === 'conflict'}
          onClick={() => showState('conflict')}
        >
          Cần đối chiếu
        </button>
      </nav>

      {state === 'empty' ? (
        <section className={styles.emptyQueue}>
          <span>00</span>
          <div>
            <p>HÀNG CHỜ HÔM NAY</p>
            <h2>Mọi đề nghị đã được xem.</h2>
            <p>Khi có người mới xin vào nhà hoặc muốn sửa quan hệ, đề nghị sẽ xuất hiện tại đây.</p>
          </div>
        </section>
      ) : (
        <section className={styles.reviewSheet} aria-labelledby="review-heading">
          <div className={styles.reviewNumber}>
            <span>01</span>
            <small>{state === 'conflict' ? 'CẦN ĐỐI CHIẾU' : 'ĐỢI DUYỆT'}</small>
          </div>
          <div className={styles.candidate}>
            <PreviewIdentity member={candidate} size="large" />
            <div>
              <p>ĐỀ NGHỊ THÊM NGƯỜI THÂN</p>
              <h2 id="review-heading">{candidate.displayName}</h2>
              <span>Được đề nghị là “em họ của Gia Bảo” · gửi 18 phút trước</span>
            </div>
          </div>
          <div className={styles.evidence}>
            <h3>Thông tin để quyết định</h3>
            <dl>
              <div>
                <dt>Người đề nghị</dt>
                <dd>Dì Hương</dd>
              </div>
              <div>
                <dt>Nhánh dự kiến</dt>
                <dd>Nhánh ông Bình</dd>
              </div>
              <div>
                <dt>Quan hệ</dt>
                <dd>{state === 'conflict' ? 'Hai mô tả chưa khớp' : 'Em họ'}</dd>
              </div>
            </dl>
            {state === 'conflict' ? (
              <p role="alert" className={styles.conflictNote}>
                Dì Hương ghi “em họ”, còn Chú Sơn ghi “cháu họ”. Cần hỏi lại trước khi duyệt.
              </p>
            ) : null}
          </div>
          <div className={styles.reviewActions}>
            {decision ? (
              <p role="status">
                Đã chọn “{decision}” trong bản mẫu. Không có dữ liệu nào được gửi.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() =>
                setDecision(state === 'conflict' ? 'Yêu cầu làm rõ' : 'Duyệt thành viên')
              }
            >
              {state === 'conflict' ? 'Yêu cầu làm rõ' : 'Duyệt thành viên'}
            </button>
            <button type="button" onClick={() => setDecision('Từ chối đề nghị')}>
              Từ chối
            </button>
          </div>
        </section>
      )}
      <footer className={styles.adminFooter}>
        Bản mẫu không thay đổi thành viên, quyền truy cập hay quan hệ thật.
      </footer>
    </main>
  );
}
