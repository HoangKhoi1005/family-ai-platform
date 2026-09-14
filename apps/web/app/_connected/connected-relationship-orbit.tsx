import type { RelationshipGraphNodeDto } from '@family/contracts';
import { ConnectedIdentity } from './connected-app-shell';
import type { TreeConnection } from './relationship-tree-model';
import styles from './relationship-tree.module.css';

export function ConnectedRelationshipOrbit({
  selected,
  connections,
  membersById,
  onSelectMember,
}: {
  selected: RelationshipGraphNodeDto;
  connections: TreeConnection[];
  membersById: ReadonlyMap<string, RelationshipGraphNodeDto>;
  onSelectMember: (memberId: string, opener: HTMLButtonElement) => void;
}) {
  const visible = connections
    .map((connection) => ({ connection, member: membersById.get(connection.member_id) }))
    .filter(
      (item): item is { connection: TreeConnection; member: RelationshipGraphNodeDto } =>
        item.member !== undefined,
    )
    .slice(0, 5);

  return (
    <section className={styles.relationshipOrbit} aria-labelledby="relationship-orbit-heading">
      <div className={styles.orbitCenter}>
        <ConnectedIdentity name={selected.display_name} />
        <span>
          <small>Đang xem quanh</small>
          <strong id="relationship-orbit-heading">
            {selected.familiar_name ?? selected.display_name}
          </strong>
        </span>
      </div>
      {visible.length ? (
        <nav className={styles.orbitConnections} aria-label="Quanh người thân">
          {visible.map(({ connection, member }) => (
            <button
              key={connection.relationship_id}
              type="button"
              aria-label={`${connection.label} · ${member.display_name}`}
              onClick={(event) => onSelectMember(member.id, event.currentTarget)}
            >
              <ConnectedIdentity name={member.display_name} />
              <span>
                <small>{connection.label}</small>
                <strong>{member.familiar_name ?? member.display_name}</strong>
              </span>
            </button>
          ))}
        </nav>
      ) : (
        <p className={styles.orbitEmpty}>Chưa có quan hệ trực tiếp nào được gia đình xác nhận.</p>
      )}
    </section>
  );
}
