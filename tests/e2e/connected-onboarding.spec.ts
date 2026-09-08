import { expect, test } from '@playwright/test';

test('guest app redirects to login and preserves the invitation only in tab storage', async ({
  page,
}) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }),
  );
  await page.goto('/app#invite=synthetic-invite');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Mừng bạn về nhà.' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('family.pending-invitation'))).toBe(
    'synthetic-invite',
  );
  await page.getByRole('link', { name: 'Chưa có tài khoản? Đăng ký' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('minlength', '12');
});

test('pending user sees only waiting state and no family data calls', async ({ page }) => {
  const familyCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/families/')) familyCalls.push(request.url());
  });
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'synthetic-user', name: 'Người minh họa', email: 'person@example.test' },
        memberships: [{ id: 'synthetic-membership', status: 'pending' }],
      },
    }),
  );
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Chờ nhà mình đón bạn.' })).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra trạng thái' }).click();
  await expect(page.getByRole('button', { name: 'Quản trị nhà', exact: true })).toHaveCount(0);
  expect(familyCalls).toEqual([]);
});

test('password reset without token is disabled and offers a fresh link', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('button', { name: 'Lưu mật khẩu mới' })).toBeDisabled();
  await page.getByRole('link', { name: 'Yêu cầu liên kết mới' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});
