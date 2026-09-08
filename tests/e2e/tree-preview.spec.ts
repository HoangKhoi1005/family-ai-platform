import { test, expect } from '@playwright/test';

test('explore relatives and return to the previous tree context', async ({ page }) => {
  await page.goto('/design-preview/tree');
  await expect(page.getByText('Quanh Gia Bảo', { exact: true })).toBeVisible();
  const parent = page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Minh Đức', exact: true });
  await parent.click();
  await expect(page.getByRole('heading', { name: 'Nguyễn Minh Đức', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mở hồ sơ ↗' }).click();
  await page.getByRole('button', { name: 'Xem nhánh của Minh Đức →' }).click();
  await expect(page.getByText('Quanh Minh Đức', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Văn Bình' })).toBeVisible();
  await page.getByRole('button', { name: 'Về nhánh trước' }).click();
  await expect(page.getByText('Quanh Gia Bảo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mở hồ sơ ↗' }).click();
  await page.getByRole('button', { name: 'Thu gọn −' }).press('Escape');
  await expect(page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Gia Bảo' })).toBeFocused();
  await page.getByRole('searchbox').fill('ngoc lan');
  await page.getByRole('button', { name: 'Đỗ Ngọc Lan Thế hệ 2 ↗' }).click();
  await expect(page.getByText('Quanh Ngọc Lan', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Về tôi', exact: true }).click();
  await expect(page.getByText('Quanh Gia Bảo', { exact: true })).toBeVisible();
});
