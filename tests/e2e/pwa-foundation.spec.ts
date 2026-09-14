import { expect, test, type Page } from '@playwright/test';

test('serves an installable manifest, launcher icons and a no-store worker', async ({
  request,
}) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(await manifestResponse.json()).toMatchObject({
    name: 'Nhà mình · Không gian riêng của gia đình',
    short_name: 'Nhà mình',
    lang: 'vi',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
  });

  for (const icon of [
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/apple-touch-icon.png',
  ]) {
    const response = await request.get(icon);
    expect(response.ok(), `${icon} should be available`).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  const worker = await request.get('/sw.js');
  expect(worker.ok()).toBe(true);
  expect(worker.headers()['content-type']).toContain('application/javascript');
  expect(worker.headers()['cache-control']).toBe('no-cache, no-store, must-revalidate');
  expect(worker.headers()['content-security-policy']).toBe("default-src 'self'; script-src 'self'");
});

test('registers the lifecycle-only worker without creating browser caches', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      script: registration.active?.scriptURL ?? '',
      cacheKeys: await caches.keys(),
    };
  });

  expect(result.script).toMatch(/\/sw\.js$/);
  expect(result.cacheKeys).toEqual([]);
});

async function mockConnectedProfile(page: Page) {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-pwa', name: 'Nguyễn Gia Bảo', email: 'bao@example.test' },
        memberships: [
          {
            id: 'membership-pwa',
            family_id: 'family-pwa',
            name: 'Nhà ông Bình & bà Mai',
            role: 'member',
            status: 'active',
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-pwa/onboarding', (route) =>
    route.fulfill({ json: { member_id: 'member-pwa', claims: [] } }),
  );
  await page.route('**/api/v1/families/family-pwa/members?limit=100', (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: 'member-pwa',
            display_name: 'Nguyễn Gia Bảo',
            familiar_name: 'Gia Bảo',
            hometown: 'Cần Thơ',
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-pwa/members/member-pwa', (route) =>
    route.fulfill({
      json: {
        id: 'member-pwa',
        display_name: 'Nguyễn Gia Bảo',
        familiar_name: 'Gia Bảo',
        hometown: 'Cần Thơ',
        biography: '',
        contacts: [],
        version: 1,
      },
    }),
  );
  await page.route('**/api/v1/families/family-pwa/events?*', (route) =>
    route.fulfill({ json: { occurrences: [], next_cursor: null } }),
  );
  await page.route('**/api/v1/families/family-pwa/notifications?*', (route) =>
    route.fulfill({ json: { notifications: [], unread_count: 0, next_cursor: null } }),
  );
  await page.route('**/api/v1/families/family-pwa/notification-preferences', (route) =>
    route.fulfill({
      json: {
        reminder_offsets: ['seven_days', 'one_day', 'same_day'],
        quiet_hours: {
          starts_at: '21:00',
          ends_at: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        push_enabled: false,
        version: 0,
        updated_at: null,
      },
    }),
  );
}

async function openInstallPanel(page: Page) {
  await mockConnectedProfile(page);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi' }).click();
  await expect(page.getByRole('heading', { name: 'Cài Nhà mình trên điện thoại' })).toBeVisible();
}

test('offers the Chromium install prompt only after a deliberate tap', async ({
  page,
}, testInfo) => {
  await mockConnectedProfile(page);
  await page.goto('/app');
  await page.evaluate(() => {
    const host = window as Window & { __pwaPromptCalls?: number };
    host.__pwaPromptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        host.__pwaPromptCalls = (host.__pwaPromptCalls ?? 0) + 1;
      },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Hồ sơ của tôi' }).click();
  await expect(page.getByRole('heading', { name: 'Cài Nhà mình trên điện thoại' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Cài ứng dụng' })).toBeVisible();
  const screenshot = testInfo.outputPath('install-guidance.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('install-guidance', {
    path: screenshot,
    contentType: 'image/png',
  });
  expect(
    await page.evaluate(() => (window as Window & { __pwaPromptCalls?: number }).__pwaPromptCalls),
  ).toBe(0);

  await page.getByRole('button', { name: 'Cài ứng dụng' }).click();
  expect(
    await page.evaluate(() => (window as Window & { __pwaPromptCalls?: number }).__pwaPromptCalls),
  ).toBe(1);
});

test('shows manual Add to Home Screen steps on an iPhone browser', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone)' });
    Object.defineProperty(navigator, 'platform', { value: 'iPhone' });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
  });
  await openInstallPanel(page);

  await expect(page.getByText('Chia sẻ', { exact: true })).toBeVisible();
  await expect(page.getByText('Thêm vào Màn hình chính', { exact: true })).toBeVisible();
});

test('keeps a usable fallback when the browser install prompt fails', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockConnectedProfile(page);
  await page.goto('/app');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        throw new Error('browser prompt unavailable');
      },
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Hồ sơ của tôi' }).click();

  await page.getByRole('button', { name: 'Cài ứng dụng' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Không mở được yêu cầu cài đặt' }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('confirms standalone mode without showing another install action', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      if (query === '(display-mode: standalone)') {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => true,
        };
      }
      return original(query);
    };
  });
  await openInstallPanel(page);

  await expect(page.getByText('Đã có trên thiết bị này')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cài ứng dụng' })).toHaveCount(0);
});

test('keeps the install guidance readable at 320px with 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openInstallPanel(page);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

  const panel = page.getByRole('heading', { name: 'Cài Nhà mình trên điện thoại' });
  await expect(panel).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
