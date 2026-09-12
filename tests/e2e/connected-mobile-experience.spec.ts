import { expect, test, type Page } from '@playwright/test';

async function mockActiveFamily(page: Page, role: 'member' | 'admin' = 'member') {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Nguyễn Gia Bảo', email: 'bao@example.test' },
        memberships: [
          {
            id: 'membership-1',
            family_id: 'family-1',
            name: 'Nhà ông Bình & bà Mai',
            role,
            status: 'active',
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({ json: { member_id: 'member-1', claims: [] } }),
  );
  await page.route('**/api/v1/families/family-1/members?limit=100', (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: 'member-1',
            display_name: 'Nguyễn Gia Bảo',
            familiar_name: 'Gia Bảo',
            hometown: 'Cần Thơ',
            version: 1,
          },
          {
            id: 'member-2',
            display_name: 'Nguyễn Minh Anh',
            familiar_name: 'Minh Anh',
            hometown: 'Đà Nẵng',
            version: 1,
          },
          {
            id: 'member-3',
            display_name: 'Trần Nguyễn Thị Thảo Chi',
            familiar_name: 'Thảo Chi',
            hometown: 'Huế',
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route(
    '**/api/v1/families/family-1/relationships?root_member_id=member-1&depth=2',
    (route) =>
      route.fulfill({
        json: {
          root_member_id: 'member-1',
          depth: 2,
          nodes: [
            {
              id: 'member-1',
              display_name: 'Nguyễn Gia Bảo',
              familiar_name: 'Gia Bảo',
              hometown: 'Cần Thơ',
              birth_date: null,
              birth_year: 1996,
              deceased: false,
              version: 1,
              distance: 0,
            },
            {
              id: 'member-2',
              display_name: 'Nguyễn Minh Anh',
              familiar_name: 'Minh Anh',
              hometown: 'Đà Nẵng',
              birth_date: null,
              birth_year: 1970,
              deceased: false,
              version: 1,
              distance: 1,
            },
            {
              id: 'member-3',
              display_name: 'Trần Nguyễn Thị Thảo Chi',
              familiar_name: 'Thảo Chi',
              hometown: 'Huế',
              birth_date: null,
              birth_year: 1972,
              deceased: false,
              version: 1,
              distance: 2,
            },
          ],
          relationships: [
            {
              id: 'relationship-1',
              from_member_id: 'member-2',
              to_member_id: 'member-1',
              type: 'parent_child',
              subtype: 'biological',
              start_date: null,
              end_date: null,
              version: 1,
            },
            {
              id: 'relationship-2',
              from_member_id: 'member-2',
              to_member_id: 'member-3',
              type: 'partnership',
              subtype: 'married',
              start_date: null,
              end_date: null,
              version: 1,
            },
          ],
        },
      }),
  );
  await page.route('**/api/v1/families/family-1/members/member-1', (route) =>
    route.fulfill({
      json: {
        id: 'member-1',
        display_name: 'Nguyễn Gia Bảo',
        familiar_name: 'Gia Bảo',
        hometown: 'Cần Thơ',
        biography: 'Thích lưu lại chuyện nhà.',
        contacts: [],
        version: 1,
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/members/member-2', (route) =>
    route.fulfill({
      json: {
        id: 'member-2',
        display_name: 'Nguyễn Minh Anh',
        familiar_name: 'Minh Anh',
        hometown: 'Đà Nẵng',
        birth_date: null,
        birth_year: 1970,
        deceased: false,
        biography: 'Người luôn nhắc cả nhà gọi điện cho nhau.',
        contacts: [],
        version: 1,
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/memberships', (route) =>
    route.fulfill({ json: { memberships: [] } }),
  );
  await page.route('**/api/v1/families/family-1/change-requests?status=pending', (route) =>
    route.fulfill({ json: { change_requests: [] } }),
  );
}

test('active member gets the five-destination mobile shell without preview data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.goto('/app');

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  for (const label of ['Nhà', 'Khoảnh khắc', 'Gia phả', 'Trò chuyện', 'Tôi']) {
    await expect(navigation.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Nhà mình ở đây.' })).toBeVisible();
  await expect(page.getByText('3 người trong nhà')).toBeVisible();

  await navigation.getByRole('button', { name: 'Khoảnh khắc' }).click();
  await expect(
    page.getByRole('heading', { name: 'Khoảnh khắc đang được chuẩn bị.' }),
  ).toBeVisible();
  await navigation.getByRole('button', { name: 'Trò chuyện' }).click();
  await expect(page.getByRole('heading', { name: 'Trò chuyện đang được chuẩn bị.' })).toBeVisible();
  await navigation.getByRole('button', { name: 'Người thân', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gia phả nhà mình.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' })).toBeVisible();

  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi.' })).toBeVisible();
  await expect(page.getByText('Quyền riêng tư của bạn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  await expect(page.getByText('Bữa cơm chủ nhật')).toHaveCount(0);
});

test('member explores the approved tree and submits a reviewed relationship proposal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let submitted: unknown;
  await page.route('**/api/v1/families/family-1/change-requests', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        id: 'request-1',
        status: 'pending',
        version: 1,
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Gia phả nhà mình.' })).toBeVisible();
  await expect(page.getByText('Quanh Gia Bảo')).toBeVisible();
  await expect(page.getByText('Cha / mẹ', { exact: true })).toBeVisible();
  await expect(page.locator('[data-approved-relationship]')).toHaveCount(2);
  await expect(page.getByText('Nguyễn Minh Anh ↔ Trần Nguyễn Thị Thảo Chi')).toBeVisible();
  await page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' }).click();
  await expect(page.getByText('Người luôn nhắc cả nhà gọi điện cho nhau.')).toBeVisible();

  await page.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Minh Anh' }).click();
  await expect(page.getByLabel('Người này là')).toBeFocused();
  await page.getByLabel('Người này là').selectOption('child');
  await page.getByLabel('Chọn người thân').selectOption('member-3');
  await page.getByLabel('Loại quan hệ').selectOption('adoptive');
  await page.getByRole('button', { name: 'Gửi đề xuất' }).click();

  await expect(page.getByRole('status')).toContainText('Đã gửi đề xuất');
  expect(submitted).toEqual({
    type: 'relationship_create',
    payload: {
      from_member_id: 'member-2',
      to_member_id: 'member-3',
      type: 'parent_child',
      subtype: 'adoptive',
    },
  });

  await page.getByRole('button', { name: 'Danh bạ' }).click();
  await expect(page.getByPlaceholder('Tìm tên người thân…')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('member profile ignores a stale response and keeps keyboard focus inside the sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let releaseMemberTwo: (() => void) | undefined;
  const memberTwoReleased = new Promise<void>((resolve) => {
    releaseMemberTwo = resolve;
  });
  await page.route('**/api/v1/families/family-1/members/member-2', async (route) => {
    await memberTwoReleased;
    await route.fulfill({
      json: {
        id: 'member-2',
        display_name: 'Nguyễn Minh Anh',
        familiar_name: 'Minh Anh',
        hometown: 'Đà Nẵng',
        biography: 'Phản hồi cũ không được hiển thị.',
        contacts: [],
        version: 1,
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();
  await page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Đóng hồ sơ' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Minh Anh' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Đóng hồ sơ' })).toBeFocused();

  await dialog.getByRole('button', { name: /Nguyễn Gia Bảo/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Nguyễn Gia Bảo' })).toBeVisible();
  releaseMemberTwo?.();
  await expect(dialog.getByText('Thích lưu lại chuyện nhà.')).toBeVisible();
  await expect(dialog.getByText('Phản hồi cũ không được hiển thị.')).toHaveCount(0);
});

test('member without a linked profile keeps directory access without requesting a graph', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let graphRequests = 0;
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({ json: { member_id: null, claims: [] } }),
  );
  await page.route('**/api/v1/families/family-1/relationships**', (route) => {
    graphRequests += 1;
    return route.fulfill({ status: 500, json: { error: { code: 'UNEXPECTED_REQUEST' } } });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Chưa xác định vị trí của bạn.' })).toBeVisible();
  await page.getByRole('button', { name: 'Mở danh bạ' }).click();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' })).toBeVisible();
  expect(graphRequests).toBe(0);
});

test('graph failure stays local and preserves the directory fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.route('**/api/v1/families/family-1/relationships**', (route) =>
    route.fulfill({ status: 503, json: { error: { code: 'GRAPH_UNAVAILABLE' } } }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  const graphAlert = page.getByRole('alert').filter({ hasText: 'Chưa mở được sơ đồ.' });
  await expect(graphAlert).toContainText('Chưa mở được sơ đồ.');
  await expect(graphAlert).toContainText('Nhà mình đang gặp lỗi kết nối.');
  await page.getByRole('button', { name: 'Danh bạ' }).click();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Gia Bảo' })).toBeVisible();
});

test('one-person graph invites a proposal without inventing an edge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.route('**/api/v1/families/family-1/relationships**', (route) =>
    route.fulfill({
      json: {
        root_member_id: 'member-1',
        depth: 2,
        nodes: [
          {
            id: 'member-1',
            display_name: 'Nguyễn Gia Bảo',
            familiar_name: 'Gia Bảo',
            hometown: 'Cần Thơ',
            birth_date: null,
            birth_year: 1996,
            deceased: false,
            version: 1,
            distance: 0,
          },
        ],
        relationships: [],
      },
    }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Cây đang bắt đầu từ bạn.' })).toBeVisible();
  await expect(page.getByText('Cha / mẹ', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bổ sung quan hệ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Gia Bảo' }),
  ).toBeVisible();
});

test('active admin reaches administration through Tôi instead of primary navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page, 'admin');
  await page.goto('/app');

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(navigation.getByRole('button', { name: 'Quản trị nhà', exact: true })).toHaveCount(
    0,
  );
  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByRole('button', { name: 'Quản trị nhà', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đón người thân vào nhà.' })).toBeVisible();
  await expect(navigation.getByText('Tôi', { exact: true })).toBeVisible();
});

test('admin reviews a pending family relationship with resolved member names', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page, 'admin');
  let pending = true;
  let decision: unknown;
  await page.route('**/api/v1/families/family-1/change-requests?status=pending', (route) =>
    route.fulfill({
      json: {
        change_requests: pending
          ? [
              {
                id: 'request-relationship-1',
                type: 'relationship_create',
                target_id: null,
                base_version: null,
                payload: {
                  from_member_id: 'member-1',
                  to_member_id: 'member-3',
                  type: 'parent_child',
                  subtype: 'adoptive',
                },
                status: 'pending',
                requested_by: 'user-2',
                reviewer_id: null,
                decision_note: null,
                decided_at: null,
                version: 4,
                created_at: '2026-09-10T00:00:00.000Z',
                updated_at: '2026-09-10T00:00:00.000Z',
              },
            ]
          : [],
      },
    }),
  );
  await page.route(
    '**/api/v1/families/family-1/change-requests/request-relationship-1/decision',
    async (route) => {
      decision = route.request().postDataJSON();
      pending = false;
      await route.fulfill({
        json: { id: 'request-relationship-1', status: 'approved', version: 5 },
      });
    },
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByRole('button', { name: 'Quản trị nhà', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Duyệt thay đổi gia phả.' })).toBeVisible();
  await expect(
    page.getByText('Nguyễn Gia Bảo là cha / mẹ của Trần Nguyễn Thị Thảo Chi', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Quan hệ cha / mẹ nuôi')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Duyệt quan hệ' }).click();

  await expect(page.getByRole('status')).toContainText('Đã duyệt quan hệ');
  expect(decision).toEqual({ decision: 'approved', version: 4 });
  await expect(page.getByText('Chưa có đề xuất quan hệ nào đang chờ.')).toBeVisible();
});

test('profile draft survives switching to another destination and back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.goto('/app');

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByLabel('Họ và tên').fill('Bản nháp chưa lưu');
  await navigation.getByRole('button', { name: 'Nhà mình', exact: true }).click();
  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();

  await expect(page.getByLabel('Họ và tên')).toHaveValue('Bản nháp chưa lưu');
});

test('desktop rail leaves the product content inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockActiveFamily(page);
  await page.goto('/app');

  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();
  await expect(page.getByText('Quanh Gia Bảo')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

for (const width of [320, 390, 768]) {
  test(`connected profile fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockActiveFamily(page, 'admin');
    await page.goto('/app');
    await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  });
}
