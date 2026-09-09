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

test('Tôi opens and edits the viewer profile instead of another relative', async ({ page }) => {
  await page.goto('/design-preview/me');
  await page.getByRole('link', { name: 'Hồ sơ cá nhân' }).click();

  await expect(page).toHaveURL(/\/design-preview\/profile\?person=gia-bao$/);
  await expect(page.getByRole('heading', { name: 'Nguyễn Gia Bảo' })).toBeVisible();
  await expect(page.getByText('Dì Hương')).toHaveCount(0);

  await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ' }).click();
  await expect(page).toHaveURL(/person=gia-bao/);
  await expect(page).toHaveURL(/mode=edit/);
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Nguyễn Gia Bảo');
});

test('moment audience changes the action and the shared item appears locally', async ({ page }) => {
  await page.goto('/design-preview/moments');
  await page.getByRole('button', { name: 'Gửi khoảnh khắc' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gửi khoảnh khắc' });
  await dialog.getByRole('textbox', { name: 'Lời nhắn' }).fill('Bữa cơm chiều nay đã sẵn sàng.');
  await dialog.getByLabel('Ai được xem?').selectOption('household');
  await expect(dialog.getByRole('button', { name: 'Chia sẻ với gia đình gần' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Chia sẻ với gia đình gần' }).click();

  await expect(page.getByRole('status')).toContainText('Gia đình gần');
  await expect(page.getByText('Bữa cơm chiều nay đã sẵn sàng.')).toBeVisible();
});

test('moment reactions have a visible local state', async ({ page }) => {
  await page.goto('/design-preview/moments');
  const firstMoment = page.getByRole('article').first();
  const reaction = firstMoment.getByRole('button', { name: 'Thương' });
  await reaction.click();
  await expect(reaction).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText('Đã gửi lời thương');
});

test('every visible chat thread opens a conversation', async ({ page }) => {
  await page.goto('/design-preview/chat');
  await page.getByRole('button', { name: 'Mở trò chuyện Minh Anh' }).click();
  await expect(page.getByRole('heading', { name: 'Minh Anh' })).toBeVisible();
  await expect(page.getByText('Con gửi bà chút gió biển.')).toBeVisible();
});

test('privacy entry opens an actionable explanation', async ({ page }) => {
  await page.goto('/design-preview/me');
  await page.getByRole('link', { name: 'Quyền riêng tư' }).click();
  await expect(page.getByRole('heading', { name: 'Ai được xem thông tin của bạn?' })).toBeVisible();
  await expect(page.getByText('Số điện thoại')).toBeVisible();
  await expect(page.getByText('Chỉ người trong nhà đã được duyệt')).toBeVisible();
});

test('moment composer closes with Escape and restores focus', async ({ page }) => {
  await page.goto('/design-preview/moments');
  const opener = page.getByRole('button', { name: 'Gửi khoảnh khắc' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Gửi khoảnh khắc' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('mobile member sheet closes with Escape and restores the selected node focus', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'));
  await page.goto('/design-preview/tree');
  const opener = page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Thị Thanh Hương' });
  await opener.click();
  await expect(page.getByRole('dialog', { name: 'Hồ sơ người thân' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Hồ sơ người thân' })).toBeHidden();
  await expect(opener).toBeFocused();
});
