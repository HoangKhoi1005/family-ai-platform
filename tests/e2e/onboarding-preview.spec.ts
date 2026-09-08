import { test, expect } from '@playwright/test';

test('walks through the fixture-only invite flow into the directory', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/design-preview');
  await page.getByRole('link', { name: 'Thử luồng vào nhà' }).click();
  await expect(page).toHaveURL(/\/design-preview\/join$/);
  await expect(page.getByRole('complementary', { name: 'Thông tin bản mẫu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bạn được mời vào Nhà mình' })).toBeVisible();

  await page.getByRole('button', { name: 'Bắt đầu xem lời mời' }).click();
  await page.getByRole('button', { name: 'Tiếp tục với tài khoản minh họa' }).click();
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản minh họa' })).toBeVisible();
  await expect(page.getByText('Không nhập mật khẩu thật', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận tài khoản minh họa' }).click();
  await expect(page.getByRole('heading', { name: 'Đang chờ quản trị viên duyệt' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem đề nghị nhận hồ sơ' }).click();
  await expect(page.getByRole('heading', { name: 'Bạn muốn chia sẻ điều gì?' })).toBeVisible();
  await page.getByRole('button', { name: 'Hiển thị cho cả nhà' }).click();
  await page.getByRole('button', { name: 'Xác nhận bản mẫu' }).click();
  await expect(page.getByRole('heading', { name: 'Bạn đã sẵn sàng vào danh bạ' })).toBeVisible();
  await page.getByRole('link', { name: 'Mở danh bạ mẫu' }).click();
  await expect(page).toHaveURL(/\/design-preview\/directory$/);
  await expect(page.getByRole('heading', { name: 'Tìm đúng người trong nhà' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('shows explicit fixture error scenarios without network requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });

  await page.goto('/design-preview/join');
  await page.getByRole('button', { name: 'Lời mời hết hạn' }).click();
  await expect(page.getByRole('alert', { name: 'Trạng thái kịch bản' })).toContainText(
    'Lời mời này đã hết hạn',
  );
  await page.getByRole('button', { name: 'Đặt lại kịch bản' }).click();
  await page.getByRole('button', { name: 'Lời mời đã thu hồi' }).click();
  await expect(page.getByRole('alert', { name: 'Trạng thái kịch bản' })).toContainText(
    'Lời mời này đã được thu hồi',
  );
  await page.getByRole('button', { name: 'Đặt lại kịch bản' }).click();
  await page.getByRole('button', { name: 'Lỗi thử lại' }).click();
  await expect(page.getByRole('alert', { name: 'Trạng thái kịch bản' })).toContainText(
    'Có lỗi minh họa',
  );
  expect(requests).toEqual([]);
});

test('searches accent-insensitive names and opens a profile preview', async ({ page }) => {
  await page.goto('/design-preview/directory');
  const search = page.getByRole('searchbox', { name: 'Tìm theo tên hoặc tên thường gọi' });
  await search.fill('huong');
  await expect(page.getByRole('link', { name: 'Mở hồ sơ Dì Hương' })).toBeVisible();
  await expect(page.getByText('Nguyễn Thị Thanh Hương')).toBeVisible();
  await page.getByRole('link', { name: 'Mở hồ sơ Dì Hương' }).click();
  await expect(page.getByRole('heading', { name: 'Dì Hương' })).toBeVisible();
  await expect(page.getByText('Hồ sơ minh họa')).toBeVisible();
});

test('keeps keyboard focus on changing stages and selected profiles', async ({ page }) => {
  await page.goto('/design-preview/join');
  const inviteButton = page.getByRole('button', { name: 'Bắt đầu xem lời mời' });
  await inviteButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Bạn được mời vào Nhà mình' })).toBeFocused();

  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản minh họa' })).toBeFocused();

  await page.goto('/design-preview/directory');
  const search = page.getByRole('searchbox', { name: 'Tìm theo tên hoặc tên thường gọi' });
  await search.fill('huong');
  const profileLink = page.getByRole('link', { name: 'Mở hồ sơ Dì Hương' });
  await profileLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Dì Hương' })).toBeFocused();
  await expect(page.getByRole('status')).toContainText('Đã mở hồ sơ Dì Hương');

  const returnButton = page.getByRole('button', { name: 'Quay lại danh sách kết quả' });
  await returnButton.focus();
  await page.keyboard.press('Enter');
  await expect(profileLink).toBeFocused();
});

test('join and directory remain usable at 200 percent text on a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const route of ['/design-preview/join', '/design-preview/directory']) {
    await page.goto(route);
    const scalingStyle = await page.addStyleTag({
      content: `html { font-size: 200% !important; } body { font-size: 32px !important; }`,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await scalingStyle.evaluate((style) => style.remove());
  }
});
