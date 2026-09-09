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
            display_name: 'Trần Thảo Chi',
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
  await page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' }).click();
  await expect(page.getByText('Người luôn nhắc cả nhà gọi điện cho nhau.')).toBeVisible();

  await page.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Minh Anh' }).click();
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
