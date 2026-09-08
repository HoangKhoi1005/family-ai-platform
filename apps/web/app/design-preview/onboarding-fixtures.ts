export type JoinScenario = 'ready' | 'expired' | 'revoked' | 'error';

export const onboardingInvite = {
  synthetic: true,
  houseName: 'Nhà mình',
  inviterName: 'Người tạo lời mời minh họa',
  note: 'Một không gian riêng để gia đình nhận ra nhau và giữ lại chuyện của nhà.',
} as const;

export const directoryFixtures = [
  {
    id: 'huong',
    familiarName: 'Dì Hương',
    displayName: 'Nguyễn Thị Thanh Hương',
    hometown: 'Cần Thơ',
    birthYear: 1972,
    biography: 'Thích chăm cây, nấu ăn và ghi lại những món ngon của nhà.',
  },
  {
    id: 'bao',
    familiarName: 'Gia Bảo',
    displayName: 'Lê Gia Bảo',
    hometown: 'Đà Nẵng',
    birthYear: 1991,
    biography: 'Lưu lại những chuyến đi và câu chuyện bên hiên nhà.',
  },
  {
    id: 'an',
    familiarName: 'Minh An',
    displayName: 'Trần Minh An',
    hometown: 'Hà Nội',
    birthYear: 1988,
    biography: 'Thích nghe mọi người kể chuyện và sắp xếp những tấm ảnh cũ.',
  },
] as const;
