'use client';

import { useState } from 'react';
import type { PreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import { treeGenerations } from './tree-model';
import styles from './tree.module.css';

export function TreeCanvas({
  selected,
  onSelect,
}: {
  selected: PreviewMember;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(0.9);

  return (
    <section className={styles.canvasPanel} aria-labelledby="tree-canvas-heading">
      <header className={styles.canvasHeader}>
        <div>
          <p>SƠ ĐỒ QUAN HỆ · 03 THẾ HỆ</p>
          <h2 id="tree-canvas-heading">Quanh Gia Bảo</h2>
        </div>
        <div className={styles.canvasControls} aria-label="Điều khiển sơ đồ">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))}
            aria-label="Thu nhỏ"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.2, value + 0.1))}
            aria-label="Phóng to"
          >
            ＋
          </button>
          <button type="button" onClick={() => setZoom(0.9)}>
            Đặt lại
          </button>
        </div>
      </header>
      <div className={styles.treeViewport} tabIndex={0} aria-label="Sơ đồ gia phả ba thế hệ">
        <div className={styles.generationStack} style={{ transform: `scale(${zoom})` }}>
          {treeGenerations.map(({ generation, members }) => (
            <section
              className={styles.generation}
              key={generation}
              aria-label={`Thế hệ ${generation}`}
            >
              <span className={styles.generationLabel}>
                THẾ HỆ {String(generation).padStart(2, '0')}
              </span>
              <div className={styles.generationPeople}>
                {members.map((member) => (
                  <button
                    key={member.id}
                    className={`${styles.personNode} ${selected.id === member.id ? styles.personNodeSelected : ''}`}
                    type="button"
                    aria-label={`Xem hồ sơ ${member.displayName}`}
                    aria-pressed={selected.id === member.id}
                    onClick={() => onSelect(member.id)}
                  >
                    <PreviewIdentity member={member} size="small" />
                    <span className={styles.nodeCopy}>
                      <strong>{member.familiarName}</strong>
                      <small>{member.relationToViewer}</small>
                    </span>
                    {member.lifeStatus === 'deceased' ? (
                      <span className={styles.memoryMark}>Tưởng nhớ</span>
                    ) : null}
                    {member.id === 'ngoc-vy' ? (
                      <span className={styles.adoptiveMark}>Con nuôi</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <footer className={styles.legend}>
        <span>
          <i className={styles.legendLine} /> Quan hệ đã xác nhận
        </span>
        <span>
          <i className={styles.legendDash} /> Quan hệ nuôi dưỡng
        </span>
        <span>Hoàng An đang ở mục “chưa rõ nhánh” trong danh bạ</span>
      </footer>
    </section>
  );
}
