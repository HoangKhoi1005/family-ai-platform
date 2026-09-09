export type PreviewLifeStatus = 'living' | 'deceased';

export type PreviewMember = {
  id: string;
  synthetic: true;
  displayName: string;
  familiarName: string;
  initials: string;
  generation: 1 | 2 | 3 | 4;
  relationToViewer: string;
  lifeStatus: PreviewLifeStatus;
  birthYear?: number;
  deathYear?: number;
  hometown?: string;
  currentCity?: string;
  biography?: string;
  phone?: string;
  email?: string;
  portraitTone: 'leaf' | 'clay' | 'rice' | 'indigo';
};

export type PreviewRelationship = {
  from: string;
  to: string;
  kind: 'parent' | 'partner' | 'adoptive-parent';
};

export const previewMembers: PreviewMember[] = [
  {
    id: 'van-binh',
    synthetic: true,
    displayName: 'Nguyễn Văn Bình',
    familiarName: 'Ông Bình',
    initials: 'ÔB',
    generation: 1,
    relationToViewer: 'Ông nội',
    lifeStatus: 'deceased',
    birthYear: 1938,
    deathYear: 2019,
    hometown: 'Cần Thơ',
    biography: 'Ông thường kể chuyện bến sông và giữ thói quen uống trà sớm.',
    portraitTone: 'indigo',
  },
  {
    id: 'thi-mai',
    synthetic: true,
    displayName: 'Trần Thị Mai',
    familiarName: 'Bà Mai',
    initials: 'BM',
    generation: 1,
    relationToViewer: 'Bà nội',
    lifeStatus: 'living',
    birthYear: 1943,
    hometown: 'Vĩnh Long',
    currentCity: 'Cần Thơ',
    portraitTone: 'rice',
  },
  {
    id: 'minh-duc',
    synthetic: true,
    displayName: 'Nguyễn Minh Đức',
    familiarName: 'Ba Đức',
    initials: 'MĐ',
    generation: 2,
    relationToViewer: 'Ba',
    lifeStatus: 'living',
    birthYear: 1968,
    hometown: 'Cần Thơ',
    currentCity: 'TP. Hồ Chí Minh',
    phone: '090 000 0001',
    portraitTone: 'leaf',
  },
  {
    id: 'thu-ha',
    synthetic: true,
    displayName: 'Lê Thu Hà',
    familiarName: 'Má Hà',
    initials: 'TH',
    generation: 2,
    relationToViewer: 'Má',
    lifeStatus: 'living',
    birthYear: 1970,
    hometown: 'Bến Tre',
    currentCity: 'TP. Hồ Chí Minh',
    portraitTone: 'clay',
  },
  {
    id: 'thanh-huong',
    synthetic: true,
    displayName: 'Nguyễn Thị Thanh Hương',
    familiarName: 'Dì Hương',
    initials: 'DH',
    generation: 2,
    relationToViewer: 'Dì',
    lifeStatus: 'living',
    birthYear: 1972,
    hometown: 'Cần Thơ',
    currentCity: 'Biên Hòa',
    biography: 'Thích chăm cây, nấu ăn và ghi lại những món ngon của nhà.',
    phone: '090 000 0002',
    email: 'di.huong@example.invalid',
    portraitTone: 'clay',
  },
  {
    id: 'quoc-an',
    synthetic: true,
    displayName: 'Phạm Quốc An',
    familiarName: 'Dượng An',
    initials: 'QA',
    generation: 2,
    relationToViewer: 'Dượng',
    lifeStatus: 'living',
    birthYear: 1970,
    hometown: 'Đồng Nai',
    portraitTone: 'leaf',
  },
  {
    id: 'minh-son',
    synthetic: true,
    displayName: 'Nguyễn Minh Sơn',
    familiarName: 'Chú Sơn',
    initials: 'MS',
    generation: 2,
    relationToViewer: 'Chú',
    lifeStatus: 'living',
    birthYear: 1976,
    hometown: 'Cần Thơ',
    portraitTone: 'indigo',
  },
  {
    id: 'ngoc-lan',
    synthetic: true,
    displayName: 'Đỗ Ngọc Lan',
    familiarName: 'Thím Lan',
    initials: 'NL',
    generation: 2,
    relationToViewer: 'Thím',
    lifeStatus: 'living',
    birthYear: 1978,
    hometown: 'Sóc Trăng',
    portraitTone: 'rice',
  },
  {
    id: 'gia-bao',
    synthetic: true,
    displayName: 'Nguyễn Gia Bảo',
    familiarName: 'Gia Bảo',
    initials: 'GB',
    generation: 3,
    relationToViewer: 'Bạn',
    lifeStatus: 'living',
    birthYear: 1996,
    currentCity: 'TP. Hồ Chí Minh',
    portraitTone: 'leaf',
  },
  {
    id: 'minh-anh',
    synthetic: true,
    displayName: 'Nguyễn Minh Anh',
    familiarName: 'Minh Anh',
    initials: 'MA',
    generation: 3,
    relationToViewer: 'Em gái',
    lifeStatus: 'living',
    birthYear: 2000,
    currentCity: 'Đà Nẵng',
    portraitTone: 'clay',
  },
  {
    id: 'hai-nam',
    synthetic: true,
    displayName: 'Phạm Hải Nam',
    familiarName: 'Hải Nam',
    initials: 'HN',
    generation: 3,
    relationToViewer: 'Anh họ',
    lifeStatus: 'living',
    birthYear: 1994,
    portraitTone: 'indigo',
  },
  {
    id: 'thao-chi',
    synthetic: true,
    displayName: 'Phạm Thảo Chi',
    familiarName: 'Thảo Chi',
    initials: 'TC',
    generation: 3,
    relationToViewer: 'Em họ',
    lifeStatus: 'living',
    birthYear: 1999,
    portraitTone: 'rice',
  },
  {
    id: 'tuan-khang',
    synthetic: true,
    displayName: 'Nguyễn Tuấn Khang',
    familiarName: 'Tuấn Khang',
    initials: 'TK',
    generation: 3,
    relationToViewer: 'Em họ',
    lifeStatus: 'living',
    birthYear: 2002,
    portraitTone: 'leaf',
  },
  {
    id: 'ngoc-vy',
    synthetic: true,
    displayName: 'Nguyễn Ngọc Vy',
    familiarName: 'Ngọc Vy',
    initials: 'NV',
    generation: 3,
    relationToViewer: 'Em họ · con nuôi',
    lifeStatus: 'living',
    birthYear: 2004,
    portraitTone: 'clay',
  },
  {
    id: 'hoang-an',
    synthetic: true,
    displayName: 'Nguyễn Hoàng An',
    familiarName: 'Hoàng An',
    initials: 'HA',
    generation: 3,
    relationToViewer: 'Người thân · chưa rõ nhánh',
    lifeStatus: 'living',
    portraitTone: 'rice',
  },
];

export const previewRelationships: PreviewRelationship[] = [
  { from: 'van-binh', to: 'thi-mai', kind: 'partner' },
  { from: 'van-binh', to: 'minh-duc', kind: 'parent' },
  { from: 'thi-mai', to: 'minh-duc', kind: 'parent' },
  { from: 'van-binh', to: 'thanh-huong', kind: 'parent' },
  { from: 'thi-mai', to: 'thanh-huong', kind: 'parent' },
  { from: 'van-binh', to: 'minh-son', kind: 'parent' },
  { from: 'thi-mai', to: 'minh-son', kind: 'parent' },
  { from: 'minh-duc', to: 'thu-ha', kind: 'partner' },
  { from: 'thanh-huong', to: 'quoc-an', kind: 'partner' },
  { from: 'minh-son', to: 'ngoc-lan', kind: 'partner' },
  { from: 'minh-duc', to: 'gia-bao', kind: 'parent' },
  { from: 'thu-ha', to: 'gia-bao', kind: 'parent' },
  { from: 'minh-duc', to: 'minh-anh', kind: 'parent' },
  { from: 'thu-ha', to: 'minh-anh', kind: 'parent' },
  { from: 'thanh-huong', to: 'hai-nam', kind: 'parent' },
  { from: 'quoc-an', to: 'hai-nam', kind: 'parent' },
  { from: 'thanh-huong', to: 'thao-chi', kind: 'parent' },
  { from: 'quoc-an', to: 'thao-chi', kind: 'parent' },
  { from: 'minh-son', to: 'tuan-khang', kind: 'parent' },
  { from: 'ngoc-lan', to: 'tuan-khang', kind: 'parent' },
  { from: 'minh-son', to: 'ngoc-vy', kind: 'adoptive-parent' },
  { from: 'ngoc-lan', to: 'ngoc-vy', kind: 'adoptive-parent' },
];

export const previewMember = previewMembers.find((member) => member.id === 'thanh-huong')!;
export const previewDirectory = previewMembers.slice(4, 10);

export const previewGathering = {
  synthetic: true,
  date: '2026-09-27',
  day: '27',
  month: 'THÁNG 9',
  time: '11:30',
  title: 'Bữa cơm chủ nhật',
  location: 'Nhà bà Mai · Cần Thơ',
  description: 'Cả nhà gặp nhau, ăn cơm và nghe bà kể lại chuyện cũ.',
} as const;

export function getPreviewMember(id: string | null | undefined) {
  return previewMembers.find((member) => member.id === id) ?? previewMembers[8]!;
}

export function normalizeVietnamese(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}
