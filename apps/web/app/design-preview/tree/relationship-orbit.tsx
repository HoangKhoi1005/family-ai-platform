import type { PreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import { getConnections } from './tree-model';
import styles from './tree.module.css';

export function RelationshipOrbit({
  selected,
  onSelect,
}: {
  selected: PreviewMember;
  onSelect: (id: string, opener?: HTMLButtonElement) => void;
}) {
  const connections = getConnections(selected.id).slice(0, 5);

  return (
    <section
      className={styles.relationshipOrbit}
      aria-label={`Người thân quanh ${selected.familiarName}`}
    >
      <div className={styles.orbitCenter}>
        <PreviewIdentity member={selected} size="medium" />
        <span>
          <small>Bạn đang xem</small>
          <strong>{selected.familiarName}</strong>
          <span>{selected.relationToViewer}</span>
        </span>
      </div>
      <div className={styles.orbitConnections}>
        {connections.length ? (
          connections.map(({ member, label }) => (
            <button
              type="button"
              key={`${member.id}-${label}`}
              aria-label={`Xem ${label} ${member.displayName}`}
              onClick={(event) => onSelect(member.id, event.currentTarget)}
            >
              <PreviewIdentity member={member} size="small" />
              <span>
                <small>{label}</small>
                <strong>{member.familiarName}</strong>
              </span>
            </button>
          ))
        ) : (
          <p>Người này chưa có quan hệ đã xác nhận để hiển thị.</p>
        )}
      </div>
    </section>
  );
}
