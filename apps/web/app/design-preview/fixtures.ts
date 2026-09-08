export const previewMember = {
  synthetic: true,
  displayName: 'Nguyễn Thị Thanh Hương',
  familiarName: 'Dì Hương',
  birthYear: 1972,
  hometown: 'Cần Thơ',
  biography: 'Thích chăm cây, nấu ăn và ghi lại những món ngon của nhà.',
} as const;

export const previewGathering = {
  synthetic: true,
  date: '2026-09-27',
  dateLabel: '27 tháng 9 · 11:30',
  title: 'Bữa cơm chủ nhật',
  description: 'Một lịch hẹn minh họa để xem cách hiển thị dịp sum họp trong nhà.',
} as const;

export const previewDirectory = [
  previewMember,
  {
    synthetic: true,
    displayName: 'Lê Gia Bảo',
    familiarName: 'Gia Bảo',
  },
] as const;
