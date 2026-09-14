import { expect, test, type Page } from '@playwright/test';

async function mockActiveFamily(
  page: Page,
  role: 'member' | 'admin' = 'member',
  calendarOccurrences: unknown[] = [],
  notificationResponse: Record<string, unknown> = {
    notifications: [],
    unread_count: 0,
    next_cursor: null,
  },
) {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Nguyễn Gia Bảo', email: 'bao@example.test' },
        memberships: [
          {
            id: 'membership-1',
            family_id: 'family-1',
            name: 'Nhà ông Bình & bà Mai',
            role,
            status: 'active',
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({ json: { member_id: 'member-1', claims: [] } }),
  );
  await page.route('**/api/v1/families/family-1/members?limit=100', (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: 'member-1',
            display_name: 'Nguyễn Gia Bảo',
            familiar_name: 'Gia Bảo',
            hometown: 'Cần Thơ',
            version: 1,
          },
          {
            id: 'member-2',
            display_name: 'Nguyễn Minh Anh',
            familiar_name: 'Minh Anh',
            hometown: 'Đà Nẵng',
            version: 1,
          },
          {
            id: 'member-3',
            display_name: 'Trần Nguyễn Thị Thảo Chi',
            familiar_name: 'Thảo Chi',
            hometown: 'Huế',
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route(
    '**/api/v1/families/family-1/relationships?root_member_id=member-1&depth=2',
    (route) =>
      route.fulfill({
        json: {
          root_member_id: 'member-1',
          depth: 2,
          nodes: [
            {
              id: 'member-1',
              display_name: 'Nguyễn Gia Bảo',
              familiar_name: 'Gia Bảo',
              hometown: 'Cần Thơ',
              birth_date: null,
              birth_year: 1996,
              deceased: false,
              version: 1,
              distance: 0,
            },
            {
              id: 'member-2',
              display_name: 'Nguyễn Minh Anh',
              familiar_name: 'Minh Anh',
              hometown: 'Đà Nẵng',
              birth_date: null,
              birth_year: 1970,
              deceased: false,
              version: 1,
              distance: 1,
            },
            {
              id: 'member-3',
              display_name: 'Trần Nguyễn Thị Thảo Chi',
              familiar_name: 'Thảo Chi',
              hometown: 'Huế',
              birth_date: null,
              birth_year: 1972,
              deceased: false,
              version: 1,
              distance: 2,
            },
          ],
          relationships: [
            {
              id: 'relationship-1',
              from_member_id: 'member-2',
              to_member_id: 'member-1',
              type: 'parent_child',
              subtype: 'biological',
              start_date: null,
              end_date: null,
              version: 1,
            },
            {
              id: 'relationship-2',
              from_member_id: 'member-2',
              to_member_id: 'member-3',
              type: 'partnership',
              subtype: 'married',
              start_date: null,
              end_date: null,
              version: 1,
            },
          ],
        },
      }),
  );
  await page.route('**/api/v1/families/family-1/members/member-1', (route) =>
    route.fulfill({
      json: {
        id: 'member-1',
        display_name: 'Nguyễn Gia Bảo',
        familiar_name: 'Gia Bảo',
        hometown: 'Cần Thơ',
        biography: 'Thích lưu lại chuyện nhà.',
        contacts: [],
        version: 1,
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/members/member-2', (route) =>
    route.fulfill({
      json: {
        id: 'member-2',
        display_name: 'Nguyễn Minh Anh',
        familiar_name: 'Minh Anh',
        hometown: 'Đà Nẵng',
        birth_date: null,
        birth_year: 1970,
        deceased: false,
        biography: 'Người luôn nhắc cả nhà gọi điện cho nhau.',
        contacts: [],
        version: 1,
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/memberships', (route) =>
    route.fulfill({ json: { memberships: [] } }),
  );
  await page.route('**/api/v1/families/family-1/change-requests?status=pending', (route) =>
    route.fulfill({ json: { change_requests: [] } }),
  );
  await page.route(
    '**/api/v1/families/family-1/change-requests?status=pending&scope=mine',
    (route) => route.fulfill({ json: { change_requests: [] } }),
  );
  await page.route('**/api/v1/families/family-1/events?*', (route) =>
    route.fulfill({ json: { occurrences: calendarOccurrences, next_cursor: null } }),
  );
  await page.route('**/api/v1/families/family-1/notifications?*', (route) =>
    route.fulfill({ json: notificationResponse }),
  );
  await page.route('**/api/v1/families/family-1/notification-preferences', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    route.fulfill({
      json: {
        reminder_offsets: body?.reminder_offsets ?? ['seven_days', 'one_day', 'same_day'],
        quiet_hours: body?.quiet_hours ?? {
          starts_at: '21:00',
          ends_at: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        push_enabled: false,
        version: body ? Number(body.version) + 1 : 0,
        updated_at: body ? '2026-09-14T03:00:00.000Z' : null,
      },
    });
  });
  await page.route('**/api/v1/families/family-1/moments?*', (route) =>
    route.fulfill({ json: { moments: [], next_cursor: null } }),
  );
  await page.route('**/api/v1/families/family-1/memories?*', (route) =>
    route.fulfill({ json: { memories: [], next_cursor: null } }),
  );
}

const calendarOccurrences = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    event_id: '20000000-0000-4000-8000-000000000001',
    event_revision: 1,
    local_date: '2026-09-15',
    starts_at: null,
    ends_at: null,
    calendar_conversion_version: 'vn-lunar@1',
    status: 'active',
    my_rsvp: null,
    event: {
      id: '20000000-0000-4000-8000-000000000001',
      kind: 'death_anniversary',
      title: 'Ngày giỗ cụ Nguyễn Văn Bình',
      member_id: 'member-2',
      calendar_type: 'lunar_vietnamese',
      all_day: true,
    },
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    event_id: '20000000-0000-4000-8000-000000000002',
    event_revision: 1,
    local_date: '2026-09-20',
    starts_at: '2026-09-20T11:30:00.000Z',
    ends_at: '2026-09-20T13:30:00.000Z',
    calendar_conversion_version: null,
    status: 'active',
    my_rsvp: 'maybe',
    event: {
      id: '20000000-0000-4000-8000-000000000002',
      kind: 'gathering',
      title: 'Bữa cơm mừng cả nhà sum họp sau chuyến đi rất dài',
      member_id: null,
      calendar_type: 'gregorian',
      all_day: false,
    },
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    event_id: '20000000-0000-4000-8000-000000000003',
    event_revision: 1,
    local_date: '2026-10-02',
    starts_at: null,
    ends_at: null,
    calendar_conversion_version: null,
    status: 'active',
    my_rsvp: null,
    event: {
      id: '20000000-0000-4000-8000-000000000003',
      kind: 'birthday',
      title: 'Sinh nhật Minh Anh',
      member_id: 'member-2',
      calendar_type: 'gregorian',
      all_day: true,
    },
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    event_id: '20000000-0000-4000-8000-000000000004',
    event_revision: 1,
    local_date: '2026-10-10',
    starts_at: null,
    ends_at: null,
    calendar_conversion_version: null,
    status: 'active',
    my_rsvp: null,
    event: {
      id: '20000000-0000-4000-8000-000000000004',
      kind: 'wedding_anniversary',
      title: 'Kỷ niệm ngày cưới ba mẹ',
      member_id: null,
      calendar_type: 'gregorian',
      all_day: true,
    },
  },
];

const notification = {
  id: '40000000-0000-4000-8000-000000000001',
  kind: 'event_reminder',
  channel: 'in_app',
  event_id: '20000000-0000-4000-8000-000000000001',
  occurrence_id: '30000000-0000-4000-8000-000000000001',
  event_revision: 1,
  reminder_offset: 'one_day',
  created_at: '2026-09-14T01:00:00.000Z',
  read_at: null as string | null,
};

test('notification inbox marks a reminder read and opens its calendar occurrence', async ({
  page,
}) => {
  const notificationRow = { ...notification };
  const inbox = { notifications: [notificationRow], unread_count: 1, next_cursor: null };
  await mockActiveFamily(page, 'member', calendarOccurrences, inbox);
  await page.route(
    '**/api/v1/families/family-1/events/20000000-0000-4000-8000-000000000001',
    (route) =>
      route.fulfill({
        json: {
          event: {
            kind: 'death_anniversary',
            title: 'Ngày giỗ cụ Nguyễn Văn Bình',
            calendar_type: 'lunar_vietnamese',
            recurrence: 'yearly',
            timezone: 'Asia/Ho_Chi_Minh',
            date_parts: { year: null, month: 8, day: 5 },
            lunar_policy: { month_mode: 'regular', missing_day: 'last_day' },
            all_day: true,
            reminder_offsets: ['seven_days', 'one_day'],
            id: notification.event_id,
            status: 'active',
            revision: 1,
            version: 1,
            can_edit: false,
            created_at: '2026-09-01T00:00:00.000Z',
            updated_at: '2026-09-01T00:00:00.000Z',
          },
          occurrences: [calendarOccurrences[0]],
        },
      }),
  );
  await page.route(
    '**/api/v1/families/family-1/notifications/40000000-0000-4000-8000-000000000001/read',
    (route) => {
      notificationRow.read_at = '2026-09-14T02:00:00.000Z';
      inbox.unread_count = 0;
      route.fulfill({ json: { id: notificationRow.id, read_at: notificationRow.read_at } });
    },
  );

  await page.goto('/app');
  await page.locator('button[aria-label^="Thông báo"]:visible').click();
  await expect(page.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();
  await page.getByText('Nhà mình có một ngày quan trọng sắp tới.').click();

  await expect(page).toHaveURL(/view=calendar.*occurrence=30000000-0000-4000-8000-000000000001/);
  await expect(page.getByRole('heading', { name: 'Ngày giỗ cụ Nguyễn Văn Bình' })).toBeVisible();
  await expect(page.locator('button[aria-label="Thông báo"]:visible')).toBeVisible();

  await page.reload();
  await expect(page.locator('button[aria-label="Thông báo"]:visible')).toBeVisible();
});

test('notification inbox stays usable on a narrow phone with large text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockActiveFamily(page, 'member', calendarOccurrences, {
    notifications: [{ ...notification }],
    unread_count: 1,
    next_cursor: null,
  });
  await page.goto('/app');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.locator('button[aria-label^="Thông báo"]:visible').click();

  const dialog = page.getByRole('dialog', { name: 'Thông báo' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Đóng thông báo' })).toBeVisible();
  await expect(dialog.getByText('Nhà mình có một ngày quan trọng sắp tới.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('notification preferences save only the three in-app reminder offsets', async ({ page }) => {
  await mockActiveFamily(page, 'member', calendarOccurrences);
  let savedBody: Record<string, unknown> | null = null;
  await page.route('**/api/v1/families/family-1/notification-preferences', (route) => {
    if (route.request().method() === 'PATCH') savedBody = route.request().postDataJSON();
    const body = savedBody;
    route.fulfill({
      json: {
        reminder_offsets: body?.reminder_offsets ?? ['seven_days', 'one_day', 'same_day'],
        quiet_hours: {
          starts_at: '21:00',
          ends_at: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        push_enabled: false,
        version: body ? 1 : 0,
        updated_at: body ? '2026-09-14T03:00:00.000Z' : null,
      },
    });
  });

  await page.goto('/app');
  await page.locator('button[aria-label^="Thông báo"]:visible').click();
  await page.getByRole('button', { name: 'Chọn mốc nhắc' }).click();
  await page.getByLabel('Trước 7 ngày').uncheck();
  await page.getByLabel('Trong ngày').uncheck();
  await page.getByRole('button', { name: 'Lưu mốc nhắc' }).click();

  await expect
    .poll(() => savedBody)
    .toMatchObject({
      reminder_offsets: ['one_day'],
      push_enabled: false,
      version: 0,
    });
  await expect(page.getByRole('button', { name: 'Chọn mốc nhắc' })).toBeVisible();
});

test('notification inbox keeps its last good reminders when refresh loses the network', async ({
  page,
}) => {
  await mockActiveFamily(page, 'member', calendarOccurrences, {
    notifications: [{ ...notification }],
    unread_count: 1,
    next_cursor: null,
  });
  let loseNetwork = false;
  await page.route('**/api/v1/families/family-1/notifications?*', (route) => {
    if (!loseNetwork) {
      return route.fulfill({
        json: { notifications: [{ ...notification }], unread_count: 1, next_cursor: null },
      });
    }
    return route.abort('internetdisconnected');
  });

  await page.goto('/app');
  const unreadButton = page.locator(
    'button[aria-label="Thông báo, có 1 lời nhắc chưa đọc"]:visible',
  );
  await expect(unreadButton).toBeVisible();
  loseNetwork = true;
  await unreadButton.click();

  await expect(page.getByText('Nhà mình có một ngày quan trọng sắp tới.')).toBeVisible();
  await expect(page.getByText('Những lời nhắc đã tải vẫn được giữ lại.')).toBeVisible();
});

test('notification refresh removes cached family data after access is revoked', async ({
  page,
}) => {
  await mockActiveFamily(page, 'member', calendarOccurrences, {
    notifications: [{ ...notification }],
    unread_count: 1,
    next_cursor: null,
  });
  let revokeAccess = false;
  await page.route('**/api/v1/families/family-1/notifications?*', (route) => {
    if (!revokeAccess) {
      return route.fulfill({
        json: { notifications: [{ ...notification }], unread_count: 1, next_cursor: null },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: 'NOT_FOUND', message: 'Not found', request_id: 'test' } },
    });
  });

  await page.goto('/app');
  const unreadButton = page.locator(
    'button[aria-label="Thông báo, có 1 lời nhắc chưa đọc"]:visible',
  );
  await expect(unreadButton).toBeVisible();
  revokeAccess = true;
  await unreadButton.click();

  await expect(page.getByRole('heading', { name: 'Một lời mời là đủ để về nhà.' })).toBeVisible();
  await expect(page.getByText('Nhà mình có một ngày quan trọng sắp tới.')).toHaveCount(0);
});

test('active member gets the living home and five-destination shell without preview data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page, 'member', calendarOccurrences);
  await page.goto('/app');

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  for (const label of ['Nhà', 'Khoảnh khắc', 'Gia phả', 'Trò chuyện', 'Tôi']) {
    await expect(navigation.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole('heading', { name: 'Chào Gia Bảo, nhà mình có gì mới?' }),
  ).toBeVisible();
  await expect(page.getByText('3 người trong nhà')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi Khoảnh khắc đầu tiên' })).toBeVisible();
  await expect(page.getByText('Ngày giỗ cụ Nguyễn Văn Bình')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở Gia phả', exact: true })).toBeVisible();
  await expect(page.getByText('Bữa cơm nhà')).toHaveCount(0);

  await navigation.getByRole('button', { name: 'Khoảnh khắc' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ảnh đầu tiên sẽ bắt đầu câu chuyện.' }),
  ).toBeVisible();
  await navigation.getByRole('button', { name: 'Trò chuyện' }).click();
  await expect(page.getByRole('heading', { name: 'Trò chuyện đang được chuẩn bị.' })).toBeVisible();
  await navigation.getByRole('button', { name: 'Người thân', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gia phả nhà mình.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' })).toBeVisible();

  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi.' })).toBeVisible();
  await expect(page.getByText('Quyền riêng tư của bạn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  await expect(page.getByText('Bữa cơm chủ nhật')).toHaveCount(0);
});

test('home opens the selected real member in the family tree', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let selectedProfileRequests = 0;
  await page.route('**/api/v1/families/family-1/members/member-2', async (route) => {
    selectedProfileRequests++;
    await route.fallback();
  });
  await page.goto('/app');

  await page
    .getByRole('button', { name: 'Mở Gia phả để xem Nguyễn Minh Anh', exact: true })
    .click();

  await expect.poll(() => selectedProfileRequests).toBe(1);
  await expect(page.getByRole('dialog', { name: 'Nguyễn Minh Anh' })).toBeVisible();
  await expect(page.getByText('Người luôn nhắc cả nhà gọi điện cho nhau.')).toBeVisible();
});

test('relationship orbit shows approved direct connections and opens their real profile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  const orbit = page.getByRole('navigation', { name: 'Quanh người thân' });
  await expect(orbit).toBeVisible();
  await expect(
    orbit.getByRole('button', { name: 'Cha / mẹ · Nguyễn Minh Anh', exact: true }),
  ).toBeVisible();
  await expect(orbit.getByText('Thảo Chi', { exact: true })).toHaveCount(0);

  await orbit.getByRole('button', { name: 'Cha / mẹ · Nguyễn Minh Anh', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nguyễn Minh Anh' })).toBeVisible();
});

test('member opens the family timeline, keeps a selected day in the URL and responds once', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page, 'member', calendarOccurrences);
  let rsvpBody: unknown;
  await page.route(
    '**/api/v1/families/family-1/events/20000000-0000-4000-8000-000000000001',
    (route) =>
      route.fulfill({
        json: {
          event: {
            kind: 'death_anniversary',
            title: 'Ngày giỗ cụ Nguyễn Văn Bình',
            calendar_type: 'lunar_vietnamese',
            recurrence: 'yearly',
            timezone: 'Asia/Ho_Chi_Minh',
            date_parts: { year: null, month: 8, day: 5 },
            lunar_policy: { month_mode: 'regular', missing_day: 'last_day' },
            all_day: true,
            reminder_offsets: ['seven_days', 'one_day'],
            id: '20000000-0000-4000-8000-000000000001',
            status: 'active',
            revision: 1,
            version: 1,
            can_edit: false,
            created_at: '2026-09-01T00:00:00.000Z',
            updated_at: '2026-09-01T00:00:00.000Z',
          },
          occurrences: [calendarOccurrences[0]],
        },
      }),
  );
  await page.route(
    '**/api/v1/families/family-1/occurrences/30000000-0000-4000-8000-000000000001/rsvp',
    async (route) => {
      rsvpBody = route.request().postDataJSON();
      await route.fulfill({
        json: {
          occurrence_id: '30000000-0000-4000-8000-000000000001',
          response: 'yes',
          updated_at: '2026-09-13T01:00:00.000Z',
        },
      });
    },
  );

  await page.goto('/app');

  await expect(page.getByRole('heading', { name: 'Ngày gần nhất' })).toBeVisible();
  await expect(page.getByText('Ngày giỗ cụ Nguyễn Văn Bình')).toBeVisible();
  await expect(page.getByText('Kỷ niệm ngày cưới ba mẹ')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem tất cả ngày quan trọng' }).click();

  await expect(page.getByRole('heading', { name: 'Ngày quan trọng của nhà mình.' })).toBeVisible();
  await expect(page.getByText('Kỷ niệm ngày cưới ba mẹ')).toBeVisible();
  await page.getByRole('button', { name: /Mở Ngày giỗ cụ Nguyễn Văn Bình/ }).click();

  await expect(page).toHaveURL(/occurrence=30000000-0000-4000-8000-000000000001/);
  await page.reload();
  const detail = page.getByRole('dialog', { name: 'Ngày giỗ cụ Nguyễn Văn Bình' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Âm lịch')).toBeVisible();
  await detail.getByRole('button', { name: 'Tôi sẽ tham gia' }).click();
  await expect(detail.getByRole('button', { name: 'Tôi sẽ tham gia' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(rsvpBody).toEqual({ response: 'yes' });

  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(page).not.toHaveURL(/occurrence=/);
  await expect(page.getByRole('button', { name: /Mở Ngày giỗ cụ Nguyễn Văn Bình/ })).toBeFocused();
});

test('calendar refresh keeps the last good days when the phone loses its connection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let calendarRequestCount = 0;
  await page.route('**/api/v1/families/family-1/events?*', async (route) => {
    calendarRequestCount++;
    if (calendarRequestCount === 1) {
      await route.fulfill({ json: { occurrences: calendarOccurrences, next_cursor: null } });
      return;
    }
    await route.abort('internetdisconnected');
  });
  await page.goto('/app');
  await expect(page.getByText('Ngày giỗ cụ Nguyễn Văn Bình')).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(
    page.getByText('Lịch chưa cập nhật được. Bạn vẫn đang xem lần tải gần nhất.'),
  ).toBeVisible();
  await expect(page.getByText('Ngày giỗ cụ Nguyễn Văn Bình')).toBeVisible();
});

test('calendar access revocation clears cached family days', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page, 'member', calendarOccurrences);
  await page.route('**/api/v1/families/family-1/events?*', (route) =>
    route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } }),
  );
  await page.goto('/app');

  await expect(page.getByRole('heading', { name: 'Một lời mời là đủ để về nhà.' })).toBeVisible();
  await expect(page.getByText('Ngày giỗ cụ Nguyễn Văn Bình')).toHaveCount(0);
});

test('a late calendar mutation from the previous family cannot block the new family timeline', async ({
  page,
}) => {
  const familyBDay = {
    ...calendarOccurrences[2],
    id: '30000000-0000-4000-8000-0000000000b1',
    event_id: '20000000-0000-4000-8000-0000000000b1',
    event: {
      ...calendarOccurrences[2].event,
      id: '20000000-0000-4000-8000-0000000000b1',
      title: 'Sinh nhật của Nhà B',
    },
  };
  await mockActiveFamily(page, 'member', [calendarOccurrences[0]]);
  let activeFamily = 'family-1';
  let familyBHasDay = false;
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Nguyễn Gia Bảo', email: 'bao@example.test' },
        memberships: [
          {
            id: `membership-${activeFamily}`,
            family_id: activeFamily,
            name: activeFamily === 'family-1' ? 'Nhà A' : 'Nhà B',
            role: 'member',
            status: 'active',
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-b/onboarding', (route) =>
    route.fulfill({ json: { member_id: 'member-b', claims: [] } }),
  );
  await page.route('**/api/v1/families/family-b/members?limit=100', (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: 'member-b',
            display_name: 'Người Nhà B',
            familiar_name: null,
            hometown: null,
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-b/events?*', (route) =>
    route.fulfill({
      json: { occurrences: familyBHasDay ? [familyBDay] : [], next_cursor: null },
    }),
  );
  await page.route(
    '**/api/v1/families/family-1/events/20000000-0000-4000-8000-000000000001',
    (route) =>
      route.fulfill({
        json: {
          event: {
            kind: 'death_anniversary',
            title: 'Ngày giỗ cụ Nguyễn Văn Bình',
            calendar_type: 'lunar_vietnamese',
            recurrence: 'yearly',
            timezone: 'Asia/Ho_Chi_Minh',
            date_parts: { year: null, month: 8, day: 5 },
            lunar_policy: { month_mode: 'regular', missing_day: 'last_day' },
            all_day: true,
            reminder_offsets: ['one_day'],
            id: '20000000-0000-4000-8000-000000000001',
            status: 'active',
            revision: 1,
            version: 1,
            can_edit: false,
            created_at: '2026-09-01T00:00:00.000Z',
            updated_at: '2026-09-01T00:00:00.000Z',
          },
          occurrences: [calendarOccurrences[0]],
        },
      }),
  );
  let rsvpFails = false;
  let releaseRsvp!: () => void;
  let markRsvpStarted!: () => void;
  let rsvpStarted!: Promise<void>;
  let rsvpReleased!: Promise<void>;
  const resetRsvpGate = () => {
    rsvpStarted = new Promise<void>((resolve) => {
      markRsvpStarted = resolve;
    });
    rsvpReleased = new Promise<void>((resolve) => {
      releaseRsvp = resolve;
    });
  };
  resetRsvpGate();
  await page.route(
    '**/api/v1/families/family-1/occurrences/30000000-0000-4000-8000-000000000001/rsvp',
    async (route) => {
      markRsvpStarted();
      await rsvpReleased;
      if (rsvpFails) {
        await route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN' } } });
        return;
      }
      await route.fulfill({
        json: {
          occurrence_id: '30000000-0000-4000-8000-000000000001',
          response: 'yes',
          updated_at: '2026-09-13T01:00:00.000Z',
        },
      });
    },
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Xem tất cả ngày quan trọng' }).click();
  await page.getByRole('button', { name: /Mở Ngày giỗ cụ Nguyễn Văn Bình/ }).click();
  const oldRsvpResponse = page.waitForResponse((response) => response.url().endsWith('/rsvp'));
  await page.getByRole('button', { name: 'Tôi sẽ tham gia' }).click();
  await rsvpStarted;

  activeFamily = 'family-b';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('CHÀO NGƯỜI NHÀ B')).toBeVisible();
  await expect(page).not.toHaveURL(/occurrence=/);

  releaseRsvp();
  await oldRsvpResponse;
  familyBHasDay = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Sinh nhật của Nhà B')).toBeVisible();

  activeFamily = 'family-1';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('CHÀO GIA BẢO')).toBeVisible();
  await page.getByRole('button', { name: 'Xem tất cả ngày quan trọng' }).click();
  await page.getByRole('button', { name: /Mở Ngày giỗ cụ Nguyễn Văn Bình/ }).click();
  resetRsvpGate();
  rsvpFails = true;
  const deniedRsvpResponse = page.waitForResponse((response) => response.url().endsWith('/rsvp'));
  await page.getByRole('button', { name: 'Tôi sẽ tham gia' }).click();
  await rsvpStarted;

  activeFamily = 'family-b';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('CHÀO NGƯỜI NHÀ B')).toBeVisible();
  releaseRsvp();
  await deniedRsvpResponse;
  await expect(page.getByText('Sinh nhật của Nhà B')).toBeVisible();
});

test('empty family calendar offers one clear action on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockActiveFamily(page);
  await page.goto('/app');

  const calendar = page.getByLabel('Ngày gần nhất');
  await expect(calendar.getByRole('heading', { name: 'Nhà mình chưa ghi ngày nào' })).toBeVisible();
  await expect(calendar.getByRole('button', { name: 'Thêm ngày quan trọng' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
});

test('family calendar stays inside mobile, tablet and desktop viewports with large text', async ({
  page,
}) => {
  await mockActiveFamily(page, 'member', calendarOccurrences);
  await page.route(
    '**/api/v1/families/family-1/events/20000000-0000-4000-8000-000000000002',
    (route) =>
      route.fulfill({
        json: {
          event: {
            kind: 'gathering',
            title: 'Bữa cơm chủ nhật',
            note: null,
            location: 'Nhà bà Mai',
            member_id: null,
            calendar_type: 'gregorian',
            recurrence: 'none',
            timezone: 'Asia/Ho_Chi_Minh',
            date_parts: { year: 2026, month: 9, day: 20 },
            all_day: true,
            reminder_offsets: ['one_day'],
            id: '20000000-0000-4000-8000-000000000002',
            status: 'active',
            revision: 1,
            version: 1,
            can_edit: false,
            created_at: '2026-09-01T00:00:00.000Z',
            updated_at: '2026-09-01T00:00:00.000Z',
          },
          occurrences: [calendarOccurrences[1]],
        },
      }),
  );

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 900 ? 900 : 844 });
    await page.goto('/app?view=calendar');
    await expect(
      page.getByRole('heading', { name: 'Ngày quan trọng của nhà mình.' }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: /Mở Bữa cơm mừng cả nhà/ }).click();
    const detail = page.getByRole('dialog', { name: /Bữa cơm mừng cả nhà/ });
    await expect(detail).toBeVisible();
    if (width >= 900) {
      const bounds = await detail.boundingBox();
      expect(bounds?.x).toBeGreaterThan(width / 2);
    }
    await page.keyboard.press('Escape');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app?view=calendar');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { name: 'Ngày quan trọng của nhà mình.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('creator adds, reloads, edits and cancels a family day from the mobile wizard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const occurrences: Array<Record<string, unknown>> = [];
  await mockActiveFamily(page, 'member', occurrences);
  let eventTitle = 'Bữa cơm cuối tháng';
  let eventVersion = 1;
  let eventStatus: 'active' | 'cancelled' = 'active';
  const bodies: unknown[] = [];

  const eventDto = () => ({
    kind: 'gathering',
    title: eventTitle,
    note: null,
    location: 'Nhà bà Mai',
    member_id: null,
    calendar_type: 'gregorian',
    recurrence: 'none',
    timezone: 'Asia/Ho_Chi_Minh',
    date_parts: { year: 2026, month: 10, day: 20 },
    all_day: true,
    reminder_offsets: ['seven_days', 'one_day'],
    id: '20000000-0000-4000-8000-000000000099',
    status: eventStatus,
    revision: eventVersion,
    version: eventVersion,
    can_edit: true,
    created_at: '2026-09-13T01:00:00.000Z',
    updated_at: '2026-09-13T01:00:00.000Z',
  });
  const occurrenceDto = () => ({
    id: `30000000-0000-4000-8000-00000000009${eventVersion}`,
    event_id: '20000000-0000-4000-8000-000000000099',
    event_revision: eventVersion,
    local_date: '2026-10-20',
    starts_at: null,
    ends_at: null,
    calendar_conversion_version: null,
    status: eventStatus,
    my_rsvp: null,
    event: {
      id: '20000000-0000-4000-8000-000000000099',
      kind: 'gathering',
      title: eventTitle,
      member_id: null,
      calendar_type: 'gregorian',
      all_day: true,
    },
  });
  const detail = () => ({ event: eventDto(), occurrences: [occurrenceDto()] });

  await page.route('**/api/v1/families/family-1/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    bodies.push(route.request().postDataJSON());
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    occurrences.splice(0, occurrences.length, occurrenceDto());
    await route.fulfill({ status: 201, json: detail() });
  });
  await page.route(
    '**/api/v1/families/family-1/events/20000000-0000-4000-8000-000000000099',
    async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as {
          version: number;
          event: { title: string };
        };
        bodies.push(body);
        eventTitle = body.event.title;
        eventVersion++;
        occurrences.splice(0, occurrences.length, occurrenceDto());
      }
      await route.fulfill({ json: detail() });
    },
  );
  await page.route(
    '**/api/v1/families/family-1/events/20000000-0000-4000-8000-000000000099/cancel',
    async (route) => {
      bodies.push(route.request().postDataJSON());
      eventVersion++;
      eventStatus = 'cancelled';
      occurrences.splice(0);
      await route.fulfill({ json: detail() });
    },
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Thêm ngày quan trọng' }).click();
  const wizard = page.getByRole('dialog', { name: 'Thêm ngày quan trọng' });
  await expect(wizard).toBeVisible();
  await wizard.getByLabel('Tên ngày').fill('Bữa cơm cuối tháng');
  await wizard.getByRole('button', { name: 'Tiếp: Chọn ngày' }).click();
  await wizard.getByLabel('Ngày diễn ra').fill('2026-10-20');
  await wizard.getByRole('button', { name: 'Tiếp: Nhắc cả nhà' }).click();
  await expect(wizard.getByText('20 tháng 10, 2026')).toBeVisible();
  await wizard.getByLabel('Nơi gặp').fill('Nhà bà Mai');
  await wizard.getByRole('button', { name: 'Lưu ngày quan trọng' }).click();
  await expect(wizard).toBeHidden();
  await expect(page.getByText('Bữa cơm cuối tháng')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Bữa cơm cuối tháng')).toBeVisible();
  await page.getByRole('button', { name: /Mở Bữa cơm cuối tháng/ }).click();
  const detailSheet = page.getByRole('dialog', { name: 'Bữa cơm cuối tháng' });
  await detailSheet.getByRole('button', { name: 'Sửa ngày này' }).click();
  const editor = page.getByRole('dialog', { name: 'Sửa ngày quan trọng' });
  await editor.getByLabel('Tên ngày').fill('Bữa cơm sum họp cuối tháng');
  await editor.getByRole('button', { name: 'Tiếp: Chọn ngày' }).click();
  await editor.getByRole('button', { name: 'Tiếp: Nhắc cả nhà' }).click();
  await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Bữa cơm sum họp cuối tháng')).toBeVisible();

  await page.getByRole('button', { name: /Mở Bữa cơm sum họp cuối tháng/ }).click();
  const updatedDetail = page.getByRole('dialog', { name: 'Bữa cơm sum họp cuối tháng' });
  await updatedDetail.getByRole('button', { name: 'Hủy ngày này' }).click();
  await updatedDetail.getByRole('button', { name: 'Xác nhận hủy ngày này' }).click();
  await expect(page.getByText('Bữa cơm sum họp cuối tháng')).toHaveCount(0);
  expect(bodies).toHaveLength(3);
});

test('calendar wizard blocks an unverified lunar date without sending family data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let createAttempts = 0;
  await page.route('**/api/v1/families/family-1/events', async (route) => {
    if (route.request().method() === 'POST') createAttempts++;
    await route.fulfill({ status: 503, json: { error: { code: 'CALENDAR_UNAVAILABLE' } } });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Thêm ngày quan trọng' }).click();
  const wizard = page.getByRole('dialog', { name: 'Thêm ngày quan trọng' });
  await wizard.getByLabel('Tên ngày').fill('Ngày âm cần kiểm tra');
  await wizard.getByRole('button', { name: 'Tiếp: Chọn ngày' }).click();
  await wizard.getByLabel('Dùng lịch').selectOption('lunar_vietnamese');
  await wizard.getByLabel('Ngày âm').fill('1');
  await wizard.getByLabel('Tháng âm', { exact: true }).fill('6');
  await wizard.getByLabel('Năm nguồn').fill('2026');
  await wizard.getByLabel('Lặp lại').selectOption('yearly');
  await wizard.getByLabel('Nếu có tháng nhuận').selectOption('both');
  await wizard.getByLabel('Lặp lại').selectOption('none');
  await expect(wizard.getByLabel('Nếu có tháng nhuận')).toHaveValue('regular');
  await wizard.getByLabel('Nếu có tháng nhuận').selectOption('leap_only');

  await expect(wizard.getByText('Không thể xác nhận ngày âm này')).toBeVisible();
  await wizard.getByRole('button', { name: 'Tiếp: Nhắc cả nhà' }).click();
  await expect(wizard.getByText('Không thể xác nhận ngày âm này')).toBeVisible();
  expect(createAttempts).toBe(0);
});

test('calendar wizard keeps a verified lunar draft when the calendar service is unavailable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let createAttempts = 0;
  const idempotencyKeys: string[] = [];
  await page.route('**/api/v1/families/family-1/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    createAttempts++;
    idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    await route.fulfill({ status: 503, json: { error: { code: 'CALENDAR_UNAVAILABLE' } } });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Thêm ngày quan trọng' }).click();
  const wizard = page.getByRole('dialog', { name: 'Thêm ngày quan trọng' });
  await wizard.getByLabel('Đây là ngày gì?').selectOption('death_anniversary');
  await wizard.getByLabel('Tên ngày').fill('Ngày giỗ ông cố');
  await wizard.getByRole('button', { name: 'Tiếp: Chọn ngày' }).click();
  await wizard.getByLabel('Dùng lịch').selectOption('lunar_vietnamese');
  await wizard.getByLabel('Ngày âm').fill('5');
  await wizard.getByLabel('Tháng âm', { exact: true }).fill('8');
  await wizard.getByLabel('Năm nguồn').fill('2026');
  await wizard.getByLabel('Lặp lại').selectOption('yearly');
  await wizard.getByRole('button', { name: 'Tiếp: Nhắc cả nhà' }).click();
  await wizard.getByRole('button', { name: 'Lưu ngày quan trọng' }).click();

  await expect(
    wizard.getByText('Chưa thể xác nhận ngày này. Kiểm tra lại ngày và thử sau nhé.'),
  ).toBeVisible();
  await wizard.getByRole('button', { name: 'Quay lại' }).click();
  await wizard.getByRole('button', { name: 'Quay lại' }).click();
  await expect(wizard.getByLabel('Tên ngày')).toHaveValue('Ngày giỗ ông cố');
  await wizard.getByRole('button', { name: 'Tiếp: Chọn ngày' }).click();
  await wizard.getByRole('button', { name: 'Tiếp: Nhắc cả nhà' }).click();
  await wizard.getByRole('button', { name: 'Lưu ngày quan trọng' }).click();
  await expect.poll(() => createAttempts).toBe(2);
  expect(idempotencyKeys[0]).toBeTruthy();
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
});

test('calendar edit conflict presents the newest event before another save', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const original = { ...calendarOccurrences[1] } as Record<string, unknown>;
  original.event = {
    ...(original.event as Record<string, unknown>),
    title: 'Bữa cơm nhà cũ',
  };
  await mockActiveFamily(page, 'member', [original]);
  let conflicted = false;
  const eventResponse = (latest: boolean) => ({
    event: {
      kind: 'gathering',
      title: latest ? 'Bữa cơm đã đổi trên máy khác' : 'Bữa cơm nhà cũ',
      note: null,
      location: null,
      member_id: null,
      calendar_type: 'gregorian',
      recurrence: 'none',
      timezone: 'Asia/Ho_Chi_Minh',
      date_parts: { year: 2026, month: 9, day: 20 },
      all_day: true,
      reminder_offsets: ['one_day'],
      id: '20000000-0000-4000-8000-000000000002',
      status: 'active',
      revision: latest ? 2 : 1,
      version: latest ? 2 : 1,
      can_edit: true,
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-13T01:00:00.000Z',
    },
    occurrences: [original],
  });
  await page.route(
    '**/api/v1/families/family-1/events/20000000-0000-4000-8000-000000000002',
    async (route) => {
      if (route.request().method() === 'PATCH') {
        conflicted = true;
        await route.fulfill({ status: 409, json: { error: { code: 'CONFLICT' } } });
        return;
      }
      await route.fulfill({ json: eventResponse(conflicted) });
    },
  );

  await page.goto('/app');
  await page.getByRole('button', { name: /Mở Bữa cơm nhà cũ/ }).click();
  await page.getByRole('button', { name: 'Sửa ngày này' }).click();
  const editor = page.getByRole('dialog', { name: 'Sửa ngày quan trọng' });
  await editor.getByLabel('Tên ngày').fill('Thay đổi của tôi');
  await editor.getByRole('button', { name: 'Tiếp: Chọn ngày' }).click();
  await editor.getByRole('button', { name: 'Tiếp: Nhắc cả nhà' }).click();
  await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();

  await expect(
    editor.getByText('Ngày này vừa được người khác cập nhật. Xem bản mới trước khi sửa tiếp.'),
  ).toBeVisible();
  await expect(editor.getByText('Bản mới nhất: Bữa cơm đã đổi trên máy khác')).toBeVisible();
  await editor.getByRole('button', { name: 'Dùng bản mới để sửa tiếp' }).click();
  await expect(editor.getByLabel('Tên ngày')).toHaveValue('Bữa cơm đã đổi trên máy khác');
});

test('member explores the approved tree and submits a reviewed relationship proposal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let submitted: unknown;
  await page.route('**/api/v1/families/family-1/change-requests', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        id: 'request-1',
        status: 'pending',
        version: 1,
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Gia phả nhà mình.' })).toBeVisible();
  await expect(page.getByText('Quanh Gia Bảo')).toBeVisible();
  await expect(
    page.locator('[data-tree-node-id="member-2"]').getByText('Cha / mẹ', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-approved-relationship]')).toHaveCount(2);
  await expect(page.getByText('Nguyễn Minh Anh ↔ Trần Nguyễn Thị Thảo Chi')).toBeVisible();
  await page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' }).click();
  await expect(page.getByText('Người luôn nhắc cả nhà gọi điện cho nhau.')).toBeVisible();

  await page.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Minh Anh' }).click();
  await expect(page.getByLabel('Người này là', { exact: true })).toBeFocused();
  await page.getByLabel('Người này là', { exact: true }).selectOption('child');
  await page.getByLabel('Loại quan hệ').selectOption('adoptive');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByLabel('Chọn người thân').selectOption('member-3');
  await page.getByRole('button', { name: 'Xem lại' }).click();
  await expect(page.getByText('Nuôi dưỡng', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi quản trị viên duyệt' }).click();

  await expect(page.getByRole('status')).toContainText('Đã gửi đề xuất');
  expect(submitted).toEqual({
    type: 'relationship_create',
    payload: {
      from_member_id: 'member-2',
      to_member_id: 'member-3',
      type: 'parent_child',
      subtype: 'adoptive',
    },
  });

  await page.getByRole('button', { name: 'Danh bạ' }).click();
  await expect(page.getByPlaceholder('Tìm tên người thân…')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('member creates, cancels and revises tree proposals from a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  const submitted: unknown[] = [];
  let pending: Array<Record<string, unknown>> = [];
  await page.route(
    '**/api/v1/families/family-1/change-requests?status=pending&scope=mine',
    (route) => route.fulfill({ json: { change_requests: pending } }),
  );
  await page.route('**/api/v1/families/family-1/change-requests', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON();
    submitted.push(body);
    pending = [
      {
        id: `request-${submitted.length}`,
        ...body,
        target_id: 'target_id' in body ? body.target_id : null,
        base_version: 'base_version' in body ? body.base_version : null,
        status: 'pending',
        requested_by: 'membership-1',
        reviewer_id: null,
        decision_note: null,
        decided_at: null,
        version: 1,
        created_at: '2026-09-13T00:00:00.000Z',
        updated_at: '2026-09-13T00:00:00.000Z',
      },
    ];
    await route.fulfill({ status: 201, json: pending[0] });
  });
  let cancelled: unknown;
  await page.route(
    '**/api/v1/families/family-1/change-requests/request-1/cancel',
    async (route) => {
      cancelled = route.request().postDataJSON();
      pending = [];
      await route.fulfill({ json: { id: 'request-1', status: 'cancelled', version: 2 } });
    },
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();
  await page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' }).click();
  await page.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Minh Anh' }).click();
  await page.getByLabel('Người này là', { exact: true }).selectOption('child');
  await page.getByLabel('Loại quan hệ').selectOption('adoptive');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Tạo hồ sơ mới' }).click();
  await page.getByLabel('Họ và tên').fill('Nguyễn Minh An');
  await page.getByLabel('Tên thường gọi').fill('Bé An');
  await page.getByLabel('Quê quán').fill('Cà Mau');
  await page.getByLabel('Năm sinh').fill('2018');
  await page.getByRole('button', { name: 'Xem lại' }).click();
  await expect(page.getByText('Nguyễn Minh An', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi quản trị viên duyệt' }).click();

  expect(submitted[0]).toEqual({
    type: 'member_create',
    payload: {
      member: {
        display_name: 'Nguyễn Minh An',
        familiar_name: 'Bé An',
        hometown: 'Cà Mau',
        birth_year: 2018,
        deceased: false,
      },
      relationship: {
        anchor_member_id: 'member-2',
        kind: 'child',
        subtype: 'adoptive',
      },
    },
  });
  await page.getByRole('button', { name: 'Đóng hồ sơ' }).click();
  await expect(page.getByText('1 đề xuất chưa lên cây.')).toBeVisible();
  await page.getByRole('button', { name: 'Hủy đề xuất' }).click();
  expect(cancelled).toEqual({ version: 1 });
  await expect(page.getByText('1 đề xuất chưa lên cây.')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' }).click();
  await page.getByRole('button', { name: 'Sửa quan hệ với Nguyễn Gia Bảo' }).click();
  await page
    .getByRole('region', { name: 'Xem lại thay đổi quan hệ' })
    .getByRole('combobox')
    .selectOption('adoptive');
  await page.getByRole('button', { name: 'Gửi đề xuất sửa' }).click();
  expect(submitted[1]).toEqual({
    type: 'relationship_update',
    target_id: 'relationship-1',
    base_version: 1,
    payload: { subtype: 'adoptive' },
  });
  await page.getByRole('button', { name: 'Sửa quan hệ với Nguyễn Gia Bảo' }).click();
  await page.getByRole('button', { name: 'Gửi đề xuất gỡ' }).click();
  expect(submitted[2]).toEqual({
    type: 'relationship_remove',
    target_id: 'relationship-1',
    base_version: 1,
  });
});

test('member profile ignores a stale response and keeps keyboard focus inside the sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let releaseMemberTwo: (() => void) | undefined;
  const memberTwoReleased = new Promise<void>((resolve) => {
    releaseMemberTwo = resolve;
  });
  await page.route('**/api/v1/families/family-1/members/member-2', async (route) => {
    await memberTwoReleased;
    await route.fulfill({
      json: {
        id: 'member-2',
        display_name: 'Nguyễn Minh Anh',
        familiar_name: 'Minh Anh',
        hometown: 'Đà Nẵng',
        biography: 'Phản hồi cũ không được hiển thị.',
        contacts: [],
        version: 1,
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();
  await page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Đóng hồ sơ' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Minh Anh' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Đóng hồ sơ' })).toBeFocused();

  await dialog.getByRole('button', { name: 'Con Nguyễn Gia Bảo', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Nguyễn Gia Bảo' })).toBeVisible();
  releaseMemberTwo?.();
  await expect(dialog.getByText('Thích lưu lại chuyện nhà.')).toBeVisible();
  await expect(dialog.getByText('Phản hồi cũ không được hiển thị.')).toHaveCount(0);
});

test('interactive family tree supports viewport controls and root-relative branch collapse', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  const canvas = page.getByRole('region', { name: 'Cây gia phả tương tác' });
  await expect(canvas).toBeVisible();
  for (const label of ['Thu nhỏ', 'Phóng to', 'Vừa cây', 'Về tôi']) {
    await expect(canvas.getByRole('button', { name: label, exact: true })).toBeVisible();
  }

  const viewport = canvas.locator('.react-flow__viewport');
  const initialTransform = await viewport.getAttribute('style');
  await canvas.getByRole('button', { name: 'Phóng to', exact: true }).click();
  await expect.poll(() => viewport.getAttribute('style')).not.toBe(initialTransform);
  await canvas.getByRole('button', { name: 'Về tôi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Gia Bảo' })).toBeVisible();

  await page.getByRole('button', { name: 'Thu nhánh Minh Anh' }).click();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Trần Nguyễn Thị Thảo Chi' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Mở nhánh Minh Anh' })).toBeVisible();
  await page.getByRole('button', { name: 'Mở nhánh Minh Anh' }).click();
  await expect(
    page.getByRole('button', { name: 'Mở hồ sơ Trần Nguyễn Thị Thảo Chi' }),
  ).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('dragging a family node changes only its session position and does not open its profile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  const node = page.locator('.react-flow__node:has([data-tree-node-id="member-2"])');
  const handle = node.locator('[data-tree-drag-handle]');
  await handle.evaluate((element) => {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight * 0.45);
    root.style.scrollBehavior = previousBehavior;
  });
  await handle.hover();
  const before = await node.getAttribute('style');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 42,
    handleBox.y + handleBox.height / 2 + 18,
    { steps: 5 },
  );
  await page.mouse.up();

  await expect.poll(() => node.getAttribute('style')).not.toBe(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('interactive family tree keeps a 320px mobile page inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockActiveFamily(page);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  await expect(page.getByRole('region', { name: 'Cây gia phả tương tác' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Danh bạ' }).click();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' })).toBeVisible();
});

test('member without a linked profile keeps directory access without requesting a graph', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let graphRequests = 0;
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({ json: { member_id: null, claims: [] } }),
  );
  await page.route('**/api/v1/families/family-1/relationships**', (route) => {
    graphRequests += 1;
    return route.fulfill({ status: 500, json: { error: { code: 'UNEXPECTED_REQUEST' } } });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Chưa xác định vị trí của bạn.' })).toBeVisible();
  await page.getByRole('button', { name: 'Mở danh bạ' }).click();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Minh Anh' })).toBeVisible();
  expect(graphRequests).toBe(0);
});

test('graph failure stays local and preserves the directory fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.route('**/api/v1/families/family-1/relationships**', (route) =>
    route.fulfill({ status: 503, json: { error: { code: 'GRAPH_UNAVAILABLE' } } }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  const graphAlert = page.getByRole('alert').filter({ hasText: 'Chưa mở được sơ đồ.' });
  await expect(graphAlert).toContainText('Chưa mở được sơ đồ.');
  await expect(graphAlert).toContainText('Nhà mình đang gặp lỗi kết nối.');
  await page.getByRole('button', { name: 'Danh bạ' }).click();
  await expect(page.getByRole('button', { name: 'Mở hồ sơ Nguyễn Gia Bảo' })).toBeVisible();
});

test('one-person graph invites a proposal without inventing an edge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.route('**/api/v1/families/family-1/relationships**', (route) =>
    route.fulfill({
      json: {
        root_member_id: 'member-1',
        depth: 2,
        nodes: [
          {
            id: 'member-1',
            display_name: 'Nguyễn Gia Bảo',
            familiar_name: 'Gia Bảo',
            hometown: 'Cần Thơ',
            birth_date: null,
            birth_year: 1996,
            deceased: false,
            version: 1,
            distance: 0,
          },
        ],
        relationships: [],
      },
    }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Cây đang bắt đầu từ bạn.' })).toBeVisible();
  await expect(page.getByText('Cha / mẹ', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bổ sung quan hệ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Bổ sung quan hệ cho Nguyễn Gia Bảo' }),
  ).toBeVisible();
});

test('active admin reaches administration through Tôi instead of primary navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page, 'admin');
  await page.goto('/app');

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(navigation.getByRole('button', { name: 'Quản trị nhà', exact: true })).toHaveCount(
    0,
  );
  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByRole('button', { name: 'Quản trị nhà', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đón người thân vào nhà.' })).toBeVisible();
  await expect(navigation.getByText('Tôi', { exact: true })).toBeVisible();
});

test('admin reviews a pending family relationship with resolved member names', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page, 'admin');
  let pending = true;
  let decision: unknown;
  await page.route('**/api/v1/families/family-1/change-requests?status=pending', (route) =>
    route.fulfill({
      json: {
        change_requests: pending
          ? [
              {
                id: 'request-relationship-1',
                type: 'relationship_create',
                target_id: null,
                base_version: null,
                payload: {
                  from_member_id: 'member-1',
                  to_member_id: 'member-3',
                  type: 'parent_child',
                  subtype: 'adoptive',
                },
                status: 'pending',
                requested_by: 'user-2',
                reviewer_id: null,
                decision_note: null,
                decided_at: null,
                version: 4,
                created_at: '2026-09-10T00:00:00.000Z',
                updated_at: '2026-09-10T00:00:00.000Z',
              },
            ]
          : [],
      },
    }),
  );
  await page.route(
    '**/api/v1/families/family-1/change-requests/request-relationship-1/decision',
    async (route) => {
      decision = route.request().postDataJSON();
      pending = false;
      await route.fulfill({
        json: { id: 'request-relationship-1', status: 'approved', version: 5 },
      });
    },
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByRole('button', { name: 'Quản trị nhà', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Duyệt thay đổi gia phả.' })).toBeVisible();
  await expect(
    page.getByText('Nguyễn Gia Bảo là cha / mẹ của Trần Nguyễn Thị Thảo Chi', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Quan hệ cha / mẹ nuôi')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Duyệt quan hệ' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Đã duyệt quan hệ' })).toBeVisible();
  expect(decision).toEqual({ decision: 'approved', version: 4 });
  await expect(page.getByText('Chưa có đề xuất quan hệ nào đang chờ.')).toBeVisible();
});

test('profile draft survives switching to another destination and back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  await page.goto('/app');

  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByLabel('Họ và tên').fill('Bản nháp chưa lưu');
  await navigation.getByRole('button', { name: 'Nhà mình', exact: true }).click();
  await navigation.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();

  await expect(page.getByLabel('Họ và tên')).toHaveValue('Bản nháp chưa lưu');
});

test('desktop rail leaves the product content inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockActiveFamily(page);
  await page.goto('/app');

  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();
  await expect(page.getByText('Quanh Gia Bảo')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

for (const width of [320, 390, 768]) {
  test(`connected profile fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockActiveFamily(page, 'admin');
    await page.goto('/app');
    await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  });
}

test('mobile member publishes a private Moment and preserves it as a Memory', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActiveFamily(page);
  let momentCreated = false;
  let lastPurpose: 'moment_image' | 'memory_audio' = 'moment_image';
  const media = {
    id: '40000000-0000-4000-8000-000000000001',
    purpose: 'moment_image',
    status: 'ready',
    mime_type: 'image/jpeg',
    byte_size: 4,
    width: 1200,
    height: 900,
    duration_ms: null,
    rejection_code: null,
    version: 2,
    created_at: '2026-09-14T04:00:00.000Z',
    updated_at: '2026-09-14T04:00:01.000Z',
  };
  const moment = {
    id: '50000000-0000-4000-8000-000000000001',
    caption: 'Bữa cơm chiều ở quê',
    audience: 'family',
    author: {
      id: 'member-1',
      display_name: 'Nguyễn Gia Bảo',
      familiar_name: 'Gia Bảo',
      hometown: 'Cần Thơ',
      birth_date: null,
      birth_year: 1996,
      deceased: false,
      version: 1,
    },
    media,
    my_reaction: null,
    can_delete: true,
    version: 1,
    created_at: '2026-09-14T04:00:02.000Z',
  };
  await page.route('**/api/v1/families/family-1/moments?*', (route) =>
    route.fulfill({ json: { moments: momentCreated ? [moment] : [], next_cursor: null } }),
  );
  await page.route('**/api/v1/families/family-1/media/uploads', (route) => {
    lastPurpose = (route.request().postDataJSON() as { purpose: typeof lastPurpose }).purpose;
    return route.fulfill({
      status: 201,
      json: {
        media: { ...media, purpose: lastPurpose, status: 'pending', version: 1 },
        upload: {
          url: 'http://storage.invalid/upload',
          method: 'PUT',
          headers: { 'content-type': 'image/jpeg' },
          expires_at: '2026-09-14T04:10:00.000Z',
        },
      },
    });
  });
  await page.route('http://storage.invalid/upload', (route) => route.fulfill({ status: 200 }));
  await page.route('**/api/v1/families/family-1/media/*/complete', (route) =>
    route.fulfill({ json: { ...media, purpose: lastPurpose } }),
  );
  await page.route('**/api/v1/families/family-1/moments', (route) => {
    if (route.request().method() === 'POST') {
      momentCreated = true;
      return route.fulfill({ status: 201, json: moment });
    }
    return route.fallback();
  });
  await page.route('**/api/v1/families/family-1/media/*/content', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#8f4b32"/></svg>',
    }),
  );
  await page.route('**/api/v1/families/family-1/memories?*', (route) =>
    route.fulfill({ json: { memories: [], next_cursor: null } }),
  );
  let savedMemory = {
    id: '60000000-0000-4000-8000-000000000001',
    source_moment_id: moment.id,
    title: moment.caption,
    occurred_on: '2026-09-14',
    audience: 'family',
    items: [
      {
        id: '70000000-0000-4000-8000-000000000001',
        kind: 'image',
        position: 0,
        body: null,
        media,
        contributor: moment.author,
        created_at: moment.created_at,
      },
    ],
    can_edit: true,
    version: 1,
    created_at: moment.created_at,
    updated_at: moment.created_at,
  };
  await page.route('**/api/v1/families/family-1/moments/*/memory', (route) =>
    route.fulfill({
      status: 201,
      json: savedMemory,
    }),
  );
  await page.route('**/api/v1/families/family-1/memories/*/items', (route) => {
    const body = route.request().postDataJSON() as {
      kind: 'text' | 'audio';
      body?: string;
      position: number;
    };
    savedMemory = {
      ...savedMemory,
      version: savedMemory.version + 1,
      items: [
        ...savedMemory.items,
        {
          id: `70000000-0000-4000-8000-00000000000${body.position + 1}`,
          kind: body.kind,
          position: body.position,
          body: body.body ?? null,
          media: body.kind === 'audio' ? { ...media, purpose: 'memory_audio' } : null,
          contributor: moment.author,
          created_at: moment.created_at,
        },
      ],
    };
    return route.fulfill({ status: 201, json: savedMemory });
  });

  await page.goto('/app');
  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await navigation.getByRole('button', { name: 'Khoảnh khắc', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ảnh đầu tiên sẽ bắt đầu câu chuyện.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Gửi Khoảnh khắc đầu tiên' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'bua-com.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await page.getByLabel('Kể một câu ngắn').fill('Bữa cơm chiều ở quê');
  await expect(page.getByText('Cả nhà', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi về nhà', exact: true }).click();
  await expect(page.getByText('Bữa cơm chiều ở quê', { exact: true })).toBeVisible();
  await navigation.getByRole('button', { name: 'Nhà mình', exact: true }).click();
  await expect(page.getByAltText('Khoảnh khắc: Bữa cơm chiều ở quê')).toBeVisible();
  await navigation.getByRole('button', { name: 'Khoảnh khắc', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu thành Kỷ niệm' }).click();
  await expect(page.getByRole('heading', { name: 'Kỷ niệm', exact: true })).toBeVisible();
  await expect(page.getByText('Được giữ từ Khoảnh khắc')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm lời kể' }).click();
  await page.getByLabel('Chuyện bạn muốn giữ lại').fill('Bà kể hôm ấy trời vừa tạnh mưa.');
  await page.getByRole('button', { name: 'Lưu lời kể' }).click();
  await expect(page.getByText('Bà kể hôm ấy trời vừa tạnh mưa.')).toBeVisible();

  await page.getByRole('button', { name: 'Thêm lời kể' }).click();
  await page.getByRole('button', { name: 'Gửi giọng nói' }).click();
  await page.locator('input[accept^="audio/webm"]').setInputFiles({
    name: 'loi-ke.webm',
    mimeType: 'audio/webm',
    buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  });
  await page.getByRole('button', { name: 'Lưu lời kể' }).click();
  await expect(page.getByText('Lời kể của Gia Bảo')).toBeVisible();
  await expect(page.locator('audio[autoplay]')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })),
  ).toEqual({ local: [], session: [] });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
