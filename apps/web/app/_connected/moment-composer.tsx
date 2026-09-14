'use client';

import { useEffect, useId, useRef, useState } from 'react';
import s from './moments.module.css';

export function MomentComposer({
  open,
  onClose,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  onPublish: (file: File, caption: string, clientRequestId: string) => Promise<void>;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'failed'>('idle');
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  if (!open) return null;

  function choose(selected: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setFile(null);
    setError('');
    requestId.current = crypto.randomUUID();
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError('Ảnh này chưa được hỗ trợ. Hãy chọn JPEG, PNG hoặc WebP.');
      return;
    }
    if (selected.size > 10_000_000) {
      setError('Ảnh lớn hơn 10 MB. Hãy chọn ảnh nhẹ hơn.');
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function publish() {
    if (!file || phase === 'uploading' || phase === 'processing') return;
    setError('');
    setPhase('uploading');
    try {
      await onPublish(file, caption.trim(), requestId.current);
      setFile(null);
      setCaption('');
      if (preview) URL.revokeObjectURL(preview);
      setPreview('');
      setPhase('idle');
      requestId.current = crypto.randomUUID();
      onClose();
    } catch (caught) {
      setPhase('failed');
      setError(caught instanceof Error ? caught.message : 'Chưa gửi được ảnh. Hãy thử lại.');
    }
  }

  return (
    <div
      className={s.sheetBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && phase === 'idle') onClose();
      }}
    >
      <section
        className={s.composer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
      >
        <header>
          <button type="button" onClick={onClose} disabled={phase !== 'idle' && phase !== 'failed'}>
            Đóng
          </button>
          <div>
            <span>GỬI VỀ NHÀ</span>
            <h2 id={`${inputId}-title`}>Một khoảnh khắc hôm nay</h2>
          </div>
        </header>
        {preview ? (
          <div className={s.preview}>
            <img src={preview} alt="Ảnh đang chuẩn bị gửi" />
          </div>
        ) : (
          <label className={s.photoPicker} htmlFor={inputId}>
            <span aria-hidden="true">+</span>
            <strong>Chụp hoặc chọn một ảnh</strong>
            <small>JPEG, PNG hoặc WebP · tối đa 10 MB</small>
          </label>
        )}
        <input
          id={inputId}
          className={s.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
        {file && (
          <button
            className={s.changePhoto}
            type="button"
            onClick={() => document.getElementById(inputId)?.click()}
          >
            Chọn ảnh khác
          </button>
        )}
        <label className={s.caption}>
          Kể một câu ngắn
          <textarea
            maxLength={500}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Ví dụ: Cả nhà ăn cơm ở quê…"
          />
        </label>
        <div className={s.audience}>
          <span aria-hidden="true">⌂</span>
          <div>
            <strong>Cả nhà</strong>
            <small>Chỉ thành viên đang có quyền mới xem được</small>
          </div>
        </div>
        {error && (
          <p className={s.inlineError} role="alert">
            {error}
          </p>
        )}
        <button
          className={s.publish}
          type="button"
          disabled={!file || phase === 'uploading' || phase === 'processing'}
          onClick={() => void publish()}
        >
          {phase === 'uploading'
            ? 'Đang gửi ảnh…'
            : phase === 'processing'
              ? 'Đang chuẩn bị ảnh…'
              : phase === 'failed'
                ? 'Thử gửi lại'
                : 'Gửi về nhà'}
        </button>
        <p className={s.draftNote}>Ảnh nháp chỉ ở trong tab này và sẽ mất khi bạn đóng tab.</p>
      </section>
    </div>
  );
}
