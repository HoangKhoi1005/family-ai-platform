'use client';

import { useState } from 'react';
import { previewRelationships, type PreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import {
  getRelationshipPath,
  getTreeNodePosition,
  treeCanvasSize,
  treeGenerations,
} from './tree-model';
import styles from './tree.module.css';

export function TreeCanvas({
  selected,
  onSelect,
}: {
  selected: PreviewMember;
  onSelect: (id: string, opener?: HTMLButtonElement) => void;
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
        <div
          className={styles.generationStack}
          style={{
            height: treeCanvasSize.height,
            transform: `scale(${zoom})`,
            width: treeCanvasSize.width,
          }}
        >
          <svg
            className={styles.relationshipLayer}
            viewBox={`0 0 ${treeCanvasSize.width} ${treeCanvasSize.height}`}
            aria-hidden="true"
          >
            {previewRelationships.map((relationship) => (
              <path
                key={`${relationship.kind}-${relationship.from}-${relationship.to}`}
                className={
                  relationship.kind === 'adoptive-parent'
                    ? styles.relationshipAdoptive
                    : styles.relationshipConfirmed
                }
                d={getRelationshipPath(relationship.from, relationship.to, relationship.kind)}
                data-relationship-kind={relationship.kind}
                data-from={relationship.from}
                data-to={relationship.to}
              />
            ))}
          </svg>
          {treeGenerations.map(({ generation, members }) => (
            <section
              className={styles.treeGenerationLayer}
              key={generation}
              aria-label={`Thế hệ ${generation}`}
            >
              <span
                className={styles.generationLabel}
                style={{ top: getTreeNodePosition(members[0]!.id).y }}
              >
                THẾ HỆ {String(generation).padStart(2, '0')}
              </span>
              {members.map((member) => {
                const position = getTreeNodePosition(member.id);
                return (
                  <button
                    key={member.id}
                    className={`${styles.personNode} ${selected.id === member.id ? styles.personNodeSelected : ''}`}
                    style={{ left: position.x, top: position.y }}
                    type="button"
                    aria-label={`Xem hồ sơ ${member.displayName}`}
                    aria-pressed={selected.id === member.id}
                    onClick={(event) => onSelect(member.id, event.currentTarget)}
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
                );
              })}
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
