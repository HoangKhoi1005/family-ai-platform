import type { PreviewMember } from '../fixtures';
import { PreviewIdentity } from '../preview-identity';
import { getConnections } from './tree-model';
import styles from './tree.module.css';

export function MemberSheet({
  member,
  onSelect,
  open,
  onClose,
}: {
  member: PreviewMember;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const connections = getConnections(member.id);
  return (
    <aside
      id="selected-member-profile"
      className={`${styles.memberSheet} ${open ? styles.memberSheetOpen : ''}`}
      aria-label="Hồ sơ người thân"
      tabIndex={-1}
    >
      <div className={styles.sheetLabel}>
        <span>HỒ SƠ LIỀN KỀ</span>
        <span>{member.generation.toString().padStart(2, '0')}</span>
        <button className={styles.closeSheet} type="button" onClick={onClose}>
          Đóng hồ sơ
        </button>
      </div>
      <div className={styles.sheetIdentity}>
        <PreviewIdentity member={member} size="large" />
        <div>
          <p>
            THẾ HỆ {member.generation} · {member.relationToViewer.toUpperCase()}
          </p>
          <h2>{member.displayName}</h2>
          <span>
            {member.lifeStatus === 'deceased'
              ? `${member.birthYear}–${member.deathYear} · Hồ sơ tưởng nhớ`
              : (member.currentCity ?? member.hometown ?? 'Chưa ghi nơi ở')}
          </span>
        </div>
      </div>
      <p className={styles.sheetStory}>
        {member.biography ?? 'Câu chuyện về người thân này đang chờ cả nhà cùng bổ sung.'}
      </p>
      <section className={styles.connections} aria-labelledby="connections-heading">
        <h3 id="connections-heading">Những người gắn bó</h3>
        {connections.length ? (
          connections.map((connection) => (
            <button
              key={`${connection.kind}-${connection.member.id}`}
              type="button"
              onClick={() => onSelect(connection.member.id)}
            >
              <span>{connection.label}</span>
              <strong>{connection.member.displayName}</strong>
              <span aria-hidden="true">↗</span>
            </button>
          ))
        ) : (
          <p>Chưa có quan hệ được xác nhận trong bản mẫu.</p>
        )}
      </section>
      <dl className={styles.sheetFacts}>
        <div>
          <dt>Năm sinh</dt>
          <dd>{member.birthYear ?? 'Chưa rõ'}</dd>
        </div>
        <div>
          <dt>Quê quán</dt>
          <dd>{member.hometown ?? 'Chưa ghi'}</dd>
        </div>
      </dl>
      {member.phone || member.email ? (
        <nav className={styles.sheetContacts} aria-label={`Liên hệ ${member.familiarName}`}>
          {member.phone ? (
            <a href={`tel:${member.phone.replaceAll(' ', '')}`}>Gọi {member.familiarName}</a>
          ) : null}
          {member.email ? (
            <a href={`mailto:${member.email}`}>Gửi email cho {member.familiarName}</a>
          ) : null}
        </nav>
      ) : null}
    </aside>
  );
}
