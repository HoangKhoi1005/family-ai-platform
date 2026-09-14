'use client';

import type { MemoryDto } from '@family/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import s from './memory-contribution.module.css';

const supportedAudio = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'];

export function nextMemoryItemPosition(memory: MemoryDto): number | null {
  const next = memory.items.reduce((highest, item) => Math.max(highest, item.position), -1) + 1;
  return next <= 49 ? next : null;
}

export function validateMemoryAudio(file: Pick<File, 'type' | 'size'>): string {
  if (!supportedAudio.includes(file.type)) {
    return 'Bản ghi cần ở định dạng WebM, MP4, MP3 hoặc Ogg.';
  }
  if (file.size > 25_000_000) return 'Bản ghi lớn hơn 25 MB. Hãy chọn đoạn ngắn hơn.';
  return '';
}

export function MemoryContributionSheet({
  memory,
  onClose,
  onAddText,
  onAddAudio,
}: {
  memory: MemoryDto;
  onClose: () => void;
  onAddText: (memory: MemoryDto, body: string) => Promise<void>;
  onAddAudio: (memory: MemoryDto, file: File) => Promise<void>;
}) {
  const inputId = useId();
  const [mode, setMode] = useState<'text' | 'audio'>('text');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const canRecord =
    typeof window !== 'undefined' &&
    'MediaRecorder' in window &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => () => {
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  });

  function chooseAudio(selected: File | null) {
    setError('');
    setFile(null);
    if (!selected) return;
    const invalid = validateMemoryAudio(selected);
    if (invalid) {
      setError(invalid);
      return;
    }
    setFile(selected);
  }

  async function startRecording() {
    setError('');
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedAudio.find((type) => MediaRecorder.isTypeSupported(type));
      const nextRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
      stream.current = audioStream;
      recorder.current = nextRecorder;
      chunks.current = [];
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      nextRecorder.onstop = () => {
        const type = nextRecorder.mimeType || 'audio/webm';
        chooseAudio(new File(chunks.current, `loi-ke-${Date.now()}.webm`, { type }));
        audioStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        setRecording(false);
      };
      nextRecorder.start();
      setRecording(true);
    } catch {
      setError('Chưa mở được micro. Bạn có thể chọn một bản ghi có sẵn bên dưới.');
    }
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  async function submit() {
    if (busy) return;
    if (nextMemoryItemPosition(memory) === null) {
      setError('Kỷ niệm này đã đủ 50 phần nội dung.');
      return;
    }
    if (mode === 'text' && !body.trim()) {
      setError('Viết một câu chuyện ngắn trước khi lưu.');
      return;
    }
    if (mode === 'audio' && !file) {
      setError('Thu âm hoặc chọn một bản ghi trước khi lưu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mode === 'text') await onAddText(memory, body.trim());
      else await onAddAudio(memory, file!);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chưa lưu được lời kể. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.backdrop} role="presentation">
      <section
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
      >
        <header>
          <button type="button" onClick={onClose} disabled={busy || recording}>
            Đóng
          </button>
          <div>
            <span>GÓP THÊM CHUYỆN NHÀ</span>
            <h2 id={`${inputId}-title`}>{memory.title}</h2>
          </div>
        </header>
        <div className={s.modes} aria-label="Loại lời kể">
          <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
            Viết lời kể
          </button>
          <button type="button" aria-pressed={mode === 'audio'} onClick={() => setMode('audio')}>
            Gửi giọng nói
          </button>
        </div>
        {mode === 'text' ? (
          <label className={s.story}>
            Chuyện bạn muốn giữ lại
            <textarea
              value={body}
              maxLength={4000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ai đã ở đó, điều gì làm cả nhà nhớ nhất…"
            />
            <small>{body.length}/4000</small>
          </label>
        ) : (
          <div className={s.audioPicker}>
            {canRecord && (
              <button
                className={recording ? s.recording : undefined}
                type="button"
                onClick={() => (recording ? stopRecording() : void startRecording())}
              >
                {recording ? 'Dừng và dùng bản ghi' : 'Thu lời kể bằng micro'}
              </button>
            )}
            <label htmlFor={inputId}>Chọn bản ghi có sẵn</label>
            <input
              id={inputId}
              type="file"
              accept={supportedAudio.join(',')}
              onChange={(event) => chooseAudio(event.target.files?.[0] ?? null)}
            />
            {file && <p>Đã chọn: {file.name}</p>}
            <small>WebM, MP4, MP3 hoặc Ogg · tối đa 25 MB · không tự phát âm thanh</small>
          </div>
        )}
        <aside>
          <strong>Chỉ trong nhà mình</strong>
          <p>Lời kể được lưu vào kho riêng và chỉ thành viên còn quyền mới mở được.</p>
        </aside>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <button
          className={s.save}
          type="button"
          onClick={() => void submit()}
          disabled={busy || recording}
        >
          {busy ? 'Đang lưu vào Kỷ niệm…' : 'Lưu lời kể'}
        </button>
      </section>
    </div>
  );
}
