import { test, expect } from '@playwright/test';
test('Vietnamese entry page works on desktop and mobile without fake login', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Những điều thân thương');
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.getByRole('link', { name: 'Khám phá nhà mình' }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect(page.getByRole('heading', { name: 'Nhà mình đang được chuẩn bị.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
