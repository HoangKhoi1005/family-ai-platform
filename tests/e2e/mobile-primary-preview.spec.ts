import { expect, test } from '@playwright/test';

test('mobile bottom navigation stays visible after scrolling', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'));
  await page.goto('/design-preview');

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(navigation).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const box = await navigation.boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box).not.toBeNull();
  expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - viewportHeight)).toBeLessThan(3);
});

test('moment composer opens and completes locally', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });

  await page.goto('/design-preview/moments');
  await page.getByRole('button', { name: 'Gửi khoảnh khắc' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gửi khoảnh khắc' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Lời nhắn' }).fill('Chiều nay mưa ở Sài Gòn.');
  await dialog.getByRole('button', { name: 'Chia sẻ với cả nhà' }).click();
  await expect(page.getByRole('status')).toContainText('Đã thêm vào bản mẫu');
  expect(apiRequests).toEqual([]);
});

test('chat sends a local message without pretending realtime sync', async ({ page }) => {
  await page.goto('/design-preview/chat');
  await page.getByRole('button', { name: 'Mở trò chuyện Cả nhà' }).click();
  await page.getByRole('textbox', { name: 'Tin nhắn' }).fill('Tối nay con gọi về nhé.');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.getByText('Tối nay con gọi về nhé.')).toBeVisible();
  await expect(page.getByText('Chỉ hiển thị trên thiết bị này')).toBeVisible();
});

test('tree opens a member as a mobile dialog and can close it', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'));
  await page.goto('/design-preview/tree');
  await page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Thị Thanh Hương' }).click();

  const dialog = page.getByRole('dialog', { name: 'Hồ sơ người thân' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng hồ sơ' }).click();
  await expect(dialog).toBeHidden();
});
