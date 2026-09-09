import { expect, test } from '@playwright/test';

test('selected relative is reflected in the URL and restored after reload', async ({ page }) => {
  await page.goto('/design-preview/tree');
  await expect(page.getByText('Quanh Gia Bảo', { exact: true })).toBeVisible();

  const parent = page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Minh Đức', exact: true });
  await parent.click();
  await expect(page).toHaveURL(/\/design-preview\/tree\?person=minh-duc$/);
  await expect(page.getByRole('heading', { name: 'Nguyễn Minh Đức', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nguyễn Minh Đức', exact: true })).toBeVisible();
  await expect(parent).toHaveAttribute('aria-pressed', 'true');
});

test('directory fallback finds Vietnamese names without accents', async ({ page }) => {
  await page.goto('/design-preview/tree');
  await page.getByRole('link', { name: 'Mở danh bạ' }).click();
  await expect(page).toHaveURL(/view=directory/);

  await page.getByRole('searchbox', { name: 'Tìm người thân' }).fill('ngoc lan');
  await page.getByRole('link', { name: /Đỗ Ngọc Lan/ }).click();

  await expect(page).toHaveURL(/person=ngoc-lan/);
  await expect(page.getByRole('heading', { name: 'Đỗ Ngọc Lan', exact: true })).toBeVisible();
});

test('mobile profile opens with focus and can return to the tree', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design-preview/tree');
  await page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Minh Đức' }).click();

  const profile = page.getByRole('complementary', { name: 'Hồ sơ người thân' });
  await expect(profile).toBeFocused();
  await page.getByRole('button', { name: 'Đóng hồ sơ' }).click();

  await expect(page).not.toHaveURL(/person=/);
  await expect(page.getByRole('button', { name: 'Đóng hồ sơ' })).toBeHidden();
});
