'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import styles from './tree.module.css';

const people = [
  { name: 'Nguyễn Văn Bình', short: 'Ông Bình', generation: 1, parents: [] },
  { name: 'Trần Thị Mai', short: 'Bà Mai', generation: 1, parents: [] },
  { name: 'Nguyễn Minh Đức', short: 'Minh Đức', generation: 2, parents: [0, 1] },
  { name: 'Lê Thu Hà', short: 'Thu Hà', generation: 2, parents: [] },
  { name: 'Nguyễn Thanh Hương', short: 'Thanh Hương', generation: 2, parents: [0, 1] },
  { name: 'Phạm Quốc An', short: 'Quốc An', generation: 2, parents: [] },
  { name: 'Nguyễn Minh Sơn', short: 'Minh Sơn', generation: 2, parents: [0, 1] },
  { name: 'Đỗ Ngọc Lan', short: 'Ngọc Lan', generation: 2, parents: [] },
  { name: 'Nguyễn Gia Bảo', short: 'Gia Bảo', generation: 3, parents: [2, 3] },
  { name: 'Nguyễn Minh Anh', short: 'Minh Anh', generation: 3, parents: [2, 3] },
  { name: 'Phạm Hải Nam', short: 'Hải Nam', generation: 3, parents: [4, 5] },
  { name: 'Phạm Thảo Chi', short: 'Thảo Chi', generation: 3, parents: [4, 5] },
  { name: 'Nguyễn Tuấn Khang', short: 'Tuấn Khang', generation: 3, parents: [6, 7] },
  { name: 'Nguyễn Ngọc Vy', short: 'Ngọc Vy', generation: 3, parents: [6, 7] },
  { name: 'Nguyễn Hoàng An', short: 'Hoàng An', generation: 3, parents: [6, 7] },
];
const couples = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
];
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
function Portrait({ id, large = false }: { id: number; large?: boolean }) {
  return (
    <span className={`${styles.portrait} ${large ? styles.largePortrait : ''}`} aria-hidden="true">
      <svg viewBox="0 0 64 72" fill="none">
        <circle cx="32" cy="23" r="12" />
        <path d="M9 67V58C9 44 55 44 55 58V67" />
      </svg>
      <span>
        {people[id]?.short
          .split(' ')
          .map((part) => part[0])
          .join('')}
      </span>
    </span>
  );
}
export default function TreePreview() {
  const [root, setRoot] = useState(8);
  const [selected, setSelected] = useState(8);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<number[]>([]);
  const nodeRefs = useRef(new Map<number, HTMLButtonElement>());
  const person = people[selected]!;
  const focal = people[root]!;
  const partner = couples.find((pair) => pair.includes(root))?.find((id) => id !== root);
  const children = people.flatMap((person, id) => (person.parents.includes(root) ? [id] : []));
  const middle = partner === undefined ? [root] : [root, partner];
  const rows = [focal.parents, middle, children];
  const x = (index: number, count: number) => 180 + (index - (count - 1) / 2) * 116;
  const related = people.flatMap((other, id) => {
    if (id === selected) return [];
    const label = person.parents.includes(id)
      ? 'Cha / mẹ'
      : other.parents.includes(selected)
        ? 'Con'
        : couples.some((pair) => pair.includes(id) && pair.includes(selected))
          ? 'Bạn đời'
          : person.parents.length && person.parents.some((parent) => other.parents.includes(parent))
            ? 'Anh chị em'
            : null;
    return label ? [{ id, label }] : [];
  });
  function focusPerson(id: number) {
    if (root !== id) setHistory((previous) => [...previous, root]);
    setRoot(id);
    setSelected(id);
    setQuery('');
    setExpanded(false);
  }
  function returnToTree() {
    setExpanded(false);
    nodeRefs.current.get(selected)?.focus({ preventScroll: true });
  }
  return (
    <main id="main" className={styles.lab}>
      <div className={styles.notice}>
        BẢN THỬ THIẾT KẾ <span>15 người hư cấu · Không lưu dữ liệu</span>
        <Link href="/app">← Trở về ứng dụng</Link>
      </div>
      <div className={styles.app}>
        <header className={styles.header}>
          <Link href="/design-preview" aria-label="Về Nhà mình" className={styles.brand}>
            nhà<span>mình.</span>
          </Link>
          <span className={styles.familyName}>Nhà ông Bình & bà Mai</span>
          <button
            className={styles.me}
            onClick={() => focusPerson(8)}
            aria-label="Về vị trí của tôi"
          >
            GB
          </button>
        </header>
        <div className={styles.titleRow}>
          <div>
            <p>NGƯỜI THÂN / GIA PHẢ</p>
            <h1>Gia phả nhà mình.</h1>
          </div>
          <span className={styles.edition}>
            01 — 03
            <br />
            Ba thế hệ
          </span>
        </div>
        <div className={styles.workspace}>
          <section className={styles.treeSection} aria-label="Cây gia phả">
            <div className={styles.toolbar}>
              <label>
                <span className={styles.searchIcon} aria-hidden="true">
                  ⌕
                </span>
                <input
                  type="search"
                  aria-label="Tìm người trong nhà"
                  placeholder="Tìm người trong nhà"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button onClick={() => focusPerson(8)}>Về tôi</button>
            </div>
            {query && (
              <div className={styles.results} aria-label="Kết quả tìm kiếm">
                {people.flatMap((person, id) =>
                  normalize(person.name).includes(normalize(query))
                    ? [
                        <button key={id} onClick={() => focusPerson(id)}>
                          {person.name}
                          <span>Thế hệ {person.generation} ↗</span>
                        </button>,
                      ]
                    : [],
                )}
                {!people.some((person) => normalize(person.name).includes(normalize(query))) && (
                  <p>Không tìm thấy tên này. Thử tên ngắn hơn nhé.</p>
                )}
              </div>
            )}
            <div className={styles.context}>
              <button
                disabled={!history.length}
                aria-label="Về nhánh trước"
                onClick={() => {
                  const previous = history.at(-1);
                  if (previous !== undefined) {
                    setRoot(previous);
                    setSelected(previous);
                    setExpanded(false);
                    setHistory(history.slice(0, -1));
                  }
                }}
              >
                ←
              </button>
              <div>
                <strong>Quanh {focal.short}</strong>
                <span>{root === 8 ? 'Bạn đang ở đây' : 'Đang xem nhánh người thân'}</span>
              </div>
              <span className={styles.contextMark}>THẾ HỆ {focal.generation}</span>
            </div>
            <div
              className={styles.treeViewport}
              tabIndex={0}
              aria-label="Sơ đồ quanh người được chọn"
            >
              <div className={styles.canvas} style={{ height: children.length ? 465 : 285 }}>
                {!focal.parents.length && (
                  <p className={styles.unknownParents}>Chưa có thông tin cha mẹ trong bản mẫu.</p>
                )}
                <svg
                  viewBox={`0 0 360 ${children.length ? 465 : 285}`}
                  className={styles.lines}
                  aria-hidden="true"
                >
                  {focal.parents.length > 0 && (
                    <path
                      d={`M${x(0, focal.parents.length)} 122V145H${x(focal.parents.length - 1, focal.parents.length)}V122 M180 145V158H${x(0, middle.length)}V168`}
                    />
                  )}
                  {partner !== undefined && <path d="M122 203H238" />}
                  {children.length > 0 && (
                    <path
                      d={`M180 203V303 M${x(0, children.length)} 318V303H${x(children.length - 1, children.length)}V318 ${children.map((_, index) => `M${x(index, children.length)} 303V318`).join(' ')}`}
                    />
                  )}
                </svg>
                {rows.map((ids, row) =>
                  ids.map((id, index) => (
                    <button
                      key={id}
                      ref={(element) => {
                        if (element) nodeRefs.current.set(id, element);
                        else nodeRefs.current.delete(id);
                      }}
                      className={`${styles.node} ${id === selected ? styles.selectedNode : ''}`}
                      style={{ left: x(index, ids.length) - 53, top: 18 + row * 150 }}
                      aria-label={`Xem hồ sơ ${people[id]!.name}`}
                      aria-pressed={selected === id}
                      onClick={() => {
                        setSelected(id);
                        setExpanded(false);
                      }}
                    >
                      <Portrait id={id} />
                      <strong>{people[id]!.short}</strong>
                      <small>
                        {id === 8
                          ? 'Bạn'
                          : row === 0
                            ? 'Cha / mẹ'
                            : row === 2
                              ? 'Con'
                              : id === root
                                ? 'Tâm nhánh'
                                : 'Bạn đời'}
                      </small>
                    </button>
                  )),
                )}
              </div>
            </div>
            <div className={styles.treeFoot}>
              <span>
                <i /> Quan hệ trong dữ liệu minh họa
              </span>
              <span>Chạm người để xem hồ sơ</span>
            </div>
          </section>
          <aside
            className={`${styles.profile} ${expanded ? styles.expanded : ''}`}
            aria-label="Hồ sơ người thân"
            onKeyDown={(event) => {
              if (event.key === 'Escape') returnToTree();
            }}
          >
            <div className={styles.profileTop}>
              <span>TRANG GIA ĐÌNH / {String(selected + 1).padStart(2, '0')}</span>
              <button
                onClick={() => (expanded ? returnToTree() : setExpanded(true))}
                aria-expanded={expanded}
              >
                {expanded ? 'Thu gọn −' : 'Mở hồ sơ ↗'}
              </button>
            </div>
            <div className={styles.identity}>
              <Portrait id={selected} large />
              <div>
                <p>
                  THẾ HỆ {person.generation}
                  {selected === 8 ? ' · BẠN' : ''}
                </p>
                <h2>{person.name}</h2>
                <span>Chưa có ảnh chân dung</span>
              </div>
            </div>
            <div className={styles.profileBody}>
              <div className={styles.profileRule}>
                <span>01</span>
                <h3>Những người gắn bó</h3>
              </div>
              <div className={styles.related}>
                {related.map(({ id, label }) => (
                  <button key={id} onClick={() => focusPerson(id)}>
                    <span>{label}</span>
                    <strong>{people[id]!.name}</strong>
                    <span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
              {expanded && (
                <div className={styles.story}>
                  <div className={styles.profileRule}>
                    <span>02</span>
                    <h3>Chuyện về {person.short}</h3>
                  </div>
                  <p>Một nơi dành cho câu chuyện, những điều yêu thích và ký ức về người thân.</p>
                  <span>Chưa có câu chuyện hoặc thông tin liên hệ trong bản mẫu.</span>
                </div>
              )}
              {selected !== root && (
                <button className={styles.primary} onClick={() => focusPerson(selected)}>
                  Xem nhánh của {person.short} →
                </button>
              )}
            </div>
          </aside>
        </div>
        <nav className={styles.footer} aria-label="Điều hướng bản mẫu">
          <Link href="/design-preview">Nhà mình</Link>
          <strong aria-current="page">Gia phả</strong>
          <span>
            Lịch nhà <small>Sắp có</small>
          </span>
          <span>
            Trò chuyện <small>Sắp có</small>
          </span>
        </nav>
      </div>
    </main>
  );
}
