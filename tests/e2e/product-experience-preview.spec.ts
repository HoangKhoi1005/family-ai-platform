import { expect, test } from '@playwright/test';

const previewRoutes = [
  '/design-preview',
  '/design-preview/moments',
  '/design-preview/tree',
  '/design-preview/chat',
  '/design-preview/me',
];

test('preview routes use synthetic data without family API requests', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiRequests.push(url.pathname);
  });

  for (const route of previewRoutes) {
    await page.goto(route);
    await expect(page.getByLabel('Thông tin bản mẫu')).toContainText('Dữ liệu minh họa');
  }

  expect(apiRequests).toEqual([]);
});

test('primary app navigation reaches five daily-use surfaces', async ({ page }) => {
  await page.goto('/design-preview');

  const destinations = [
    ['Nhà', '/design-preview'],
    ['Khoảnh khắc', '/design-preview/moments'],
    ['Gia phả', '/design-preview/tree'],
    ['Trò chuyện', '/design-preview/chat'],
    ['Tôi', '/design-preview/me'],
  ] as const;

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  for (const [name, href] of destinations) {
    await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
  await expect(navigation.getByRole('link', { name: 'Quản trị', exact: true })).toHaveCount(0);
});

test('admin lives under Tôi instead of primary navigation', async ({ page }) => {
  await page.goto('/design-preview/me');
  await expect(page.getByRole('heading', { name: 'Gia Bảo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Duyệt thành viên' })).toHaveAttribute(
    'href',
    '/design-preview/admin',
  );
});

test('review surfaces fit the supported viewport matrix', async ({ page }) => {
  test.setTimeout(60_000);

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const route of previewRoutes) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${route} should fit a ${width}px viewport`,
      ).toBe(true);
    }
  }
});

test('preview respects the reduced-motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/design-preview');

  const longestTransition = await page.locator('a, button').evaluateAll((elements) =>
    Math.max(
      0,
      ...elements.flatMap((element) =>
        window
          .getComputedStyle(element)
          .transitionDuration.split(',')
          .map((duration) => Number.parseFloat(duration) * (duration.includes('ms') ? 0.001 : 1)),
      ),
    ),
  );

  expect(longestTransition).toBeLessThanOrEqual(0.001);
});

test('admin review state is shareable and survives reload', async ({ page }) => {
  await page.goto('/design-preview/admin');
  await page.getByRole('button', { name: 'Đã xử lý hết' }).click();
  await expect(page).toHaveURL(/state=empty/);
  await expect(page.getByRole('heading', { name: 'Mọi đề nghị đã được xem.' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mọi đề nghị đã được xem.' })).toBeVisible();
});
