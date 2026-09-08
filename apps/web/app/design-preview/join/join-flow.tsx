'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { onboardingInvite, type JoinScenario } from '../onboarding-fixtures';
import styles from '../onboarding.module.css';

type Stage = 'invite' | 'inviteDetails' | 'account' | 'pending' | 'claim' | 'success';

const steps: Array<{ id: Stage; label: string }> = [
  { id: 'invite', label: 'Lời mời' },
  { id: 'account', label: 'Tài khoản' },
  { id: 'pending', label: 'Chờ duyệt' },
  { id: 'claim', label: 'Nhận hồ sơ' },
  { id: 'success', label: 'Vào nhà' },
];

const scenarioMessages: Record<Exclude<JoinScenario, 'ready'>, string> = {
  expired: 'Lời mời này đã hết hạn trong bản mẫu. Hãy đặt lại để xem luồng bình thường.',
  revoked: 'Lời mời này đã được thu hồi trong bản mẫu. Hãy đặt lại để xem luồng bình thường.',
  error: 'Có lỗi minh họa khi tải lời mời. Hãy đặt lại để thử lại trong bản mẫu.',
};

export function JoinFlow() {
  const [stage, setStage] = useState<Stage>('invite');
  const [scenario, setScenario] = useState<JoinScenario>('ready');
  const [visibility, setVisibility] = useState<'self' | 'family'>('self');
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const initialStage = useRef(stage);

  useEffect(() => {
    if (stage === initialStage.current) return;
    stageHeadingRef.current?.focus();
  }, [stage]);

  function chooseScenario(nextScenario: JoinScenario) {
    setScenario(nextScenario);
    setStage('invite');
  }

  function resetScenario() {
    setScenario('ready');
    setStage('invite');
    setVisibility('self');
  }

  const activeIndex = stage === 'inviteDetails' ? 0 : steps.findIndex((step) => step.id === stage);

  return (
    <div className={styles.flowPage}>
      <header className={styles.flowHeader}>
        <div>
          <p className={styles.eyebrow}>Luồng vào nhà · Bản mẫu</p>
          <h1 className={styles.flowTitle}>Một lời mời, một bước gần nhà hơn.</h1>
          <p className={styles.flowIntro}>
            Xem lời mời minh họa và chọn cách xuất hiện trong danh bạ.
          </p>
        </div>
      </header>

      <ol className={styles.stepRail} aria-label="Các bước minh họa">
        {steps.map((step, index) => (
          <li key={step.id} className={index <= activeIndex ? styles.activeStep : undefined}>
            {index + 1}. {step.label}
          </li>
        ))}
      </ol>

      <div className={styles.flowLayout}>
        <section className={styles.stage} aria-live="polite">
          {scenario !== 'ready' ? (
            <div role="alert" aria-label="Trạng thái kịch bản" className={styles.scenarioAlert}>
              {scenarioMessages[scenario]}
            </div>
          ) : null}

          {stage === 'invite' || stage === 'inviteDetails' ? (
            <>
              <p className={styles.eyebrow}>Lời mời vào nhà</p>
              <h2 ref={stageHeadingRef} tabIndex={-1} className={styles.stageTitle}>
                Bạn được mời vào {onboardingInvite.houseName}
              </h2>
              <p className={styles.stageCopy}>Một không gian riêng để gia đình nhận ra nhau.</p>
              <p className={styles.stageNote}>
                Lời mời minh họa từ {onboardingInvite.inviterName}.
              </p>
              <div className={styles.stageActions}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setStage(stage === 'invite' ? 'inviteDetails' : 'account')}
                >
                  {stage === 'invite' ? 'Bắt đầu xem lời mời' : 'Tiếp tục với tài khoản minh họa'}
                </button>
              </div>
            </>
          ) : null}

          {stage === 'account' ? (
            <>
              <p className={styles.eyebrow}>Bước 2 · Tài khoản minh họa</p>
              <h2 ref={stageHeadingRef} tabIndex={-1} className={styles.stageTitle}>
                Tạo tài khoản minh họa
              </h2>
              <p className={styles.stageCopy}>
                Bản mẫu chỉ cho thấy vị trí của bước tài khoản. Không nhập mật khẩu thật và không có
                thao tác gửi nào ở đây.
              </p>
              <div className={styles.accountForm}>
                <label htmlFor="preview-email">Email minh họa</label>
                <input id="preview-email" type="email" defaultValue="ban.mau@example.invalid" />
              </div>
              <div className={styles.stageActions}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setStage('pending')}
                >
                  Xác nhận tài khoản minh họa
                </button>
                <button
                  className={styles.quietButton}
                  type="button"
                  onClick={() => setStage('invite')}
                >
                  Quay lại lời mời
                </button>
              </div>
            </>
          ) : null}

          {stage === 'pending' ? (
            <>
              <p className={styles.eyebrow}>Bước 3 · Xác minh và chờ duyệt</p>
              <h2 ref={stageHeadingRef} tabIndex={-1} className={styles.stageTitle}>
                Đang chờ quản trị viên duyệt
              </h2>
              <p className={styles.stageCopy}>
                Tài khoản minh họa đã xác minh email. Nhà mình sẽ xem lời mời trước khi bạn được xem
                thông tin riêng tư.
              </p>
              <p className={styles.stageNote}>
                Trạng thái chờ duyệt được hiển thị rõ; bản mẫu không tạo membership hay gọi máy chủ.
              </p>
              <div className={styles.stageActions}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setStage('claim')}
                >
                  Xem đề nghị nhận hồ sơ
                </button>
              </div>
            </>
          ) : null}

          {stage === 'claim' ? (
            <>
              <p className={styles.eyebrow}>Bước 4 · Quyền xem hồ sơ</p>
              <h2 ref={stageHeadingRef} tabIndex={-1} className={styles.stageTitle}>
                Bạn muốn chia sẻ điều gì?
              </h2>
              <p className={styles.stageCopy}>
                Đây là lựa chọn minh họa cho visibility. Bạn có thể giữ thông tin ở mức chỉ mình tôi
                hoặc cho cả nhà xem.
              </p>
              <div className={styles.claimChoices} role="group" aria-label="Mức hiển thị minh họa">
                <button
                  className={`${styles.visibilityButton} ${visibility === 'self' ? styles.visibilityButtonActive : ''}`}
                  type="button"
                  aria-pressed={visibility === 'self'}
                  onClick={() => setVisibility('self')}
                >
                  Chỉ mình tôi
                </button>
                <button
                  className={`${styles.visibilityButton} ${visibility === 'family' ? styles.visibilityButtonActive : ''}`}
                  type="button"
                  aria-pressed={visibility === 'family'}
                  onClick={() => setVisibility('family')}
                >
                  Hiển thị cho cả nhà
                </button>
              </div>
              <p className={styles.stageNote}>
                Lựa chọn hiện tại: {visibility === 'self' ? 'Chỉ mình tôi' : 'Hiển thị cho cả nhà'}.
              </p>
              <div className={styles.stageActions}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setStage('success')}
                >
                  Xác nhận bản mẫu
                </button>
              </div>
            </>
          ) : null}

          {stage === 'success' ? (
            <>
              <p className={styles.eyebrow}>Bước 5 · Hoàn tất minh họa</p>
              <h2 ref={stageHeadingRef} tabIndex={-1} className={styles.stageTitle}>
                Bạn đã sẵn sàng vào danh bạ
              </h2>
              <p className={styles.stageCopy}>
                Luồng mẫu đã kết thúc ở nơi bạn có thể tìm đúng người trong nhà. Hồ sơ và quyền thật
                vẫn chờ bước backend sau khi thiết kế được duyệt.
              </p>
              <div className={styles.stageActions}>
                <Link className={styles.primaryButton} href="/design-preview/directory">
                  Mở danh bạ mẫu
                </Link>
                <button className={styles.quietButton} type="button" onClick={resetScenario}>
                  Xem lại luồng
                </button>
              </div>
            </>
          ) : null}
        </section>

        <aside className={styles.scenarioPanel} aria-labelledby="scenario-heading">
          <h2 id="scenario-heading">Kịch bản minh họa</h2>
          <p>Chọn trạng thái lời mời để xem thông báo minh họa.</p>
          <fieldset className={styles.scenarioChoices}>
            <legend className={styles.srOnly}>Trạng thái lời mời</legend>
            <button
              className={`${styles.scenarioButton} ${scenario === 'ready' ? styles.scenarioButtonActive : ''}`}
              type="button"
              onClick={() => chooseScenario('ready')}
            >
              Lời mời còn hiệu lực
            </button>
            <button
              className={`${styles.scenarioButton} ${scenario === 'expired' ? styles.scenarioButtonActive : ''}`}
              type="button"
              onClick={() => chooseScenario('expired')}
            >
              Lời mời hết hạn
            </button>
            <button
              className={`${styles.scenarioButton} ${scenario === 'revoked' ? styles.scenarioButtonActive : ''}`}
              type="button"
              onClick={() => chooseScenario('revoked')}
            >
              Lời mời đã thu hồi
            </button>
            <button
              className={`${styles.scenarioButton} ${scenario === 'error' ? styles.scenarioButtonActive : ''}`}
              type="button"
              onClick={() => chooseScenario('error')}
            >
              Lỗi thử lại
            </button>
          </fieldset>
          {scenario !== 'ready' ? (
            <button className={styles.quietButton} type="button" onClick={resetScenario}>
              Đặt lại kịch bản
            </button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
