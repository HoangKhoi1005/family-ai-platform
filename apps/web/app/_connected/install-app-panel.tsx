'use client';

import { useEffect, useState } from 'react';
import { isAppleMobileBrowser, resolveInstallState } from './pwa-install';
import s from './connected.module.css';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function InstallAppPanel() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const updateEnvironment = () => {
      setStandalone(
        window.matchMedia('(display-mode: standalone)').matches ||
          Boolean((navigator as NavigatorWithStandalone).standalone),
      );
      setAppleMobile(
        isAppleMobileBrowser({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
        }),
      );
    };
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setStandalone(true);
      setAccepted(false);
    };

    updateEnvironment();
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const state = resolveInstallState({
    standalone,
    appleMobile,
    promptReady: promptEvent !== null,
  });

  const install = async () => {
    if (!promptEvent || installing) return;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setAccepted(choice.outcome === 'accepted');
      setPromptEvent(null);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <section className={s.installPanel} aria-labelledby="install-app-title">
      <div className={s.installPanelMark} aria-hidden="true">
        <span>n</span>
        <i />
      </div>
      <div className={s.installPanelBody}>
        <p className={s.eyebrow}>MỞ NHÀ NHANH HƠN</p>
        <h2 id="install-app-title">Cài Nhà mình trên điện thoại</h2>

        {state === 'installed' && (
          <p className={s.installStatus} role="status">
            <span aria-hidden="true">✓</span> Đã có trên thiết bị này
          </p>
        )}

        {state === 'prompt-ready' && (
          <>
            <p>Thêm một lối mở riêng trên màn hình chính, giống những ứng dụng bạn vẫn dùng.</p>
            <button type="button" onClick={() => void install()} disabled={installing}>
              {installing ? 'Đang mở…' : 'Cài ứng dụng'}
            </button>
          </>
        )}

        {state === 'ios-instructions' && (
          <>
            <p>Trên Safari, bạn chỉ cần làm ba bước:</p>
            <ol className={s.installSteps}>
              <li>
                Chạm <strong>Chia sẻ</strong> trên thanh công cụ.
              </li>
              <li>
                Chọn <strong>Thêm vào Màn hình chính</strong>.
              </li>
              <li>
                Chạm <strong>Thêm</strong> để hoàn tất.
              </li>
            </ol>
          </>
        )}

        {state === 'fallback' && (
          <p>
            Bạn vẫn có thể dùng Nhà mình trong trình duyệt. Khi menu trình duyệt có mục “Cài ứng
            dụng” hoặc “Thêm vào màn hình chính”, hãy chọn mục đó.
          </p>
        )}

        {accepted && (
          <p className={s.installHint} role="status">
            Trình duyệt đang hoàn tất việc cài đặt.
          </p>
        )}
        <small>
          Việc cài đặt chỉ thêm lối mở ứng dụng; dữ liệu gia đình không được lưu offline.
        </small>
      </div>
    </section>
  );
}
