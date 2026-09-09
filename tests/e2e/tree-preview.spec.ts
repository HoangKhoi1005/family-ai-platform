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
  await page.getByRole('link', { name: 'Tìm người' }).click();
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

  const profile = page.getByRole('dialog', { name: 'Hồ sơ người thân' });
  await expect(profile).toBeFocused();
  await page.getByRole('button', { name: 'Đóng hồ sơ', exact: true }).click();

  await expect(page).not.toHaveURL(/person=/);
  await expect(page.getByRole('button', { name: 'Đóng hồ sơ', exact: true })).toBeHidden();
});

test('tree renders every confirmed relationship as a data edge', async ({ page }) => {
  await page.goto('/design-preview/tree');

  await expect(page.locator('[data-relationship-kind]')).toHaveCount(22);
  await expect(page.locator('[data-relationship-kind="partner"]')).toHaveCount(4);
  await expect(page.locator('[data-relationship-kind="adoptive-parent"]')).toHaveCount(2);
  await expect(page.locator('[data-from="minh-duc"][data-to="gia-bao"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Hoàng An' })).toHaveCount(0);
});

test('mobile member sheet traps focus while moving between connected people', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design-preview/tree');
  await page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Thị Thanh Hương' }).click();

  const dialog = page.getByRole('dialog', { name: 'Hồ sơ người thân' });
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'Gửi email cho Dì Hương' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Đóng hồ sơ' })).toBeFocused();

  await dialog.getByRole('button', { name: /Phạm Quốc An/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Phạm Quốc An' })).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
});

test('mobile directory sheet restores focus to each link that opened it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design-preview/tree?view=directory');

  for (const name of ['Nguyễn Minh Đức', 'Đỗ Ngọc Lan']) {
    const opener = page.getByRole('link', { name, exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Hồ sơ người thân' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng hồ sơ' }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  }
});
