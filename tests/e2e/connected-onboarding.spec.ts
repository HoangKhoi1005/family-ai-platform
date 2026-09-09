import { expect, test } from '@playwright/test';

test('guest app redirects to login and preserves the invitation only in its originating tab', async ({
  page,
  context,
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
  expect(await page.evaluate(() => localStorage.getItem('family.pending-invitation'))).toBeNull();

  const otherTab = await context.newPage();
  await otherTab.goto('/login');
  expect(
    await otherTab.evaluate(() => sessionStorage.getItem('family.pending-invitation')),
  ).toBeNull();
  await otherTab.close();
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

test('keeps an in-progress profile draft when a background refresh loses the network', async ({
  page,
}) => {
  let failNetwork = false;
  await page.route('**/api/v1/me', async (route) => {
    if (failNetwork) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Người minh họa', email: 'person@example.test' },
        memberships: [
          {
            id: 'membership-1',
            family_id: 'family-1',
            name: 'Nhà kiểm thử',
            role: 'member',
            status: 'active',
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({ json: { member_id: 'member-1', claims: [] } }),
  );
  await page.route('**/api/v1/families/family-1/members?limit=100', (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: 'member-1',
            display_name: 'Tên ban đầu',
            familiar_name: null,
            hometown: null,
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
        display_name: 'Tên ban đầu',
        familiar_name: null,
        hometown: null,
        biography: null,
        contacts: [],
        version: 1,
      },
    }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByLabel('Họ và tên').fill('Tên đang nhập dở');
  failNetwork = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.locator('main').getByRole('alert')).toContainText('Chưa kết nối được');
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Tên đang nhập dở');
});

test('clears the previous family when switching families fails mid-refresh', async ({ page }) => {
  let switched = false;
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Người minh họa', email: 'person@example.test' },
        memberships: [
          switched
            ? {
                id: 'membership-b',
                family_id: 'family-b',
                name: 'Nhà B',
                role: 'member',
                status: 'active',
              }
            : {
                id: 'membership-a',
                family_id: 'family-a',
                name: 'Nhà A',
                role: 'member',
                status: 'active',
              },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-a/onboarding', (route) =>
    route.fulfill({ json: { member_id: null, claims: [] } }),
  );
  await page.route('**/api/v1/families/family-a/members?limit=100', (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: 'member-a',
            display_name: 'Dữ liệu riêng của Nhà A',
            familiar_name: null,
            hometown: null,
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-b/**', (route) =>
    route.abort('internetdisconnected'),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();
  await expect(page.getByText('Dữ liệu riêng của Nhà A')).toBeVisible();
  switched = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByText('Dữ liệu riêng của Nhà A')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Người thân', exact: true })).toHaveCount(0);
});

test('hides an opened directory contact when the app regains focus', async ({ page }) => {
  await mockActiveMember(page, { memberId: null, claims: [] });
  await page.route('**/api/v1/families/family-1/members/member-2', (route) =>
    route.fulfill({
      json: {
        id: 'member-2',
        display_name: 'Người có liên hệ',
        familiar_name: null,
        hometown: null,
        biography: null,
        contacts: [{ id: 'contact-1', kind: 'phone', value: '0900000000', visibility: 'family' }],
        version: 1,
      },
    }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Người thân', exact: true }).click();
  await page.getByRole('button', { name: /Người có liên hệ/ }).click();
  await expect(page.getByText('0900000000')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByText('0900000000')).toHaveCount(0);
});

test('reloads a claim preview when the server reports a newer claim version', async ({ page }) => {
  let onboardingCalls = 0;
  let previewCalls = 0;
  await mockActiveMember(page, {
    memberId: null,
    claims: () => [{ id: 'claim-1', version: ++onboardingCalls }],
  });
  await page.route('**/api/v1/families/family-1/member-claims/claim-1/preview', (route) => {
    previewCalls++;
    return route.fulfill({
      json: {
        id: 'claim-1',
        version: previewCalls,
        member_version: 1,
        member: {
          id: 'member-1',
          display_name: 'Hồ sơ được chỉ định',
          familiar_name: null,
          hometown: null,
          biography: null,
          version: 1,
        },
        contacts: [
          {
            id: 'contact-1',
            kind: 'email',
            value: previewCalls === 1 ? 'old@example.test' : 'new@example.test',
            visibility: 'self',
          },
        ],
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await expect(page.getByText('old@example.test')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByText('new@example.test')).toBeVisible();
});

test('reloads a claim preview on focus when its summary version is unchanged', async ({ page }) => {
  let previewCalls = 0;
  await mockActiveMember(page, {
    memberId: null,
    claims: [{ id: 'claim-1', version: 1 }],
  });
  await page.route('**/api/v1/families/family-1/member-claims/claim-1/preview', (route) => {
    previewCalls++;
    return route.fulfill({
      json: {
        id: 'claim-1',
        version: 1,
        member_version: previewCalls,
        member: {
          id: 'member-1',
          display_name: 'Hồ sơ được chỉ định',
          familiar_name: null,
          hometown: null,
          biography: null,
          version: previewCalls,
        },
        contacts: [
          {
            id: 'contact-1',
            kind: 'email',
            value: previewCalls === 1 ? 'old@example.test' : 'new@example.test',
            visibility: 'self',
          },
        ],
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await expect(page.getByText('old@example.test')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByText('new@example.test')).toBeVisible();
});

test('removes a stale claim after confirmation reports a conflict', async ({ page }) => {
  await mockActiveMember(page, {
    memberId: null,
    claims: [{ id: 'claim-1', version: 1 }],
  });
  await page.route('**/api/v1/families/family-1/member-claims/claim-1/preview', (route) =>
    route.fulfill({
      json: {
        id: 'claim-1',
        version: 1,
        member_version: 1,
        member: {
          id: 'member-1',
          display_name: 'Hồ sơ không còn hiệu lực',
          familiar_name: null,
          hometown: null,
          biography: null,
          version: 1,
        },
        contacts: [
          {
            id: 'contact-1',
            kind: 'phone',
            value: '0900000000',
            visibility: 'self',
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/member-claims/claim-1/confirm', (route) =>
    route.fulfill({ status: 409, json: { error: { code: 'CONFLICT' } } }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Xác nhận nhận hồ sơ' }).click();

  await expect(page.getByRole('button', { name: 'Xác nhận nhận hồ sơ' })).toHaveCount(0);
  await expect(page.getByText('0900000000')).toHaveCount(0);
});

test('removes a consumed claim even when the following refresh loses the network', async ({
  page,
}) => {
  let failRefresh = false;
  await page.route('**/api/v1/me', (route) =>
    failRefresh
      ? route.abort('internetdisconnected')
      : route.fulfill({
          json: {
            user: { id: 'user-1', name: 'Người minh họa', email: 'person@example.test' },
            memberships: [
              {
                id: 'membership-1',
                family_id: 'family-1',
                name: 'Nhà kiểm thử',
                role: 'member',
                status: 'active',
              },
            ],
          },
        }),
  );
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({ json: { member_id: null, claims: [{ id: 'claim-1', version: 1 }] } }),
  );
  await page.route('**/api/v1/families/family-1/members?limit=100', (route) =>
    route.fulfill({ json: { members: [] } }),
  );
  await page.route('**/api/v1/families/family-1/member-claims/claim-1/preview', (route) =>
    route.fulfill({
      json: {
        id: 'claim-1',
        version: 1,
        member_version: 1,
        member: {
          id: 'member-1',
          display_name: 'Hồ sơ vừa nhận',
          familiar_name: null,
          hometown: null,
          biography: null,
          version: 1,
        },
        contacts: [],
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/member-claims/claim-1/confirm', (route) =>
    route.fulfill({ json: { status: 'consumed' } }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByRole('checkbox').check();
  failRefresh = true;
  await page.getByRole('button', { name: 'Xác nhận nhận hồ sơ' }).click();

  await expect(page.getByRole('button', { name: 'Xác nhận nhận hồ sơ' })).toHaveCount(0);
});

test('ignores an older profile response that arrives after a successful save', async ({ page }) => {
  let getCalls = 0;
  let releaseOldGet!: () => void;
  let markOldGetStarted!: () => void;
  const oldGetStarted = new Promise<void>((resolve) => (markOldGetStarted = resolve));
  const oldGetReleased = new Promise<void>((resolve) => (releaseOldGet = resolve));
  await mockActiveMember(page, { memberId: 'member-1', claims: [] });
  await page.route('**/api/v1/families/family-1/members/member-1', async (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        json: {
          id: 'member-1',
          display_name: 'Tên đã lưu',
          familiar_name: null,
          hometown: null,
          biography: null,
          contacts: [],
          version: 2,
        },
      });
    }
    getCalls++;
    if (getCalls > 1) {
      markOldGetStarted();
      await oldGetReleased;
    }
    return route.fulfill({
      json: {
        id: 'member-1',
        display_name: 'Tên cũ',
        familiar_name: null,
        hometown: null,
        biography: null,
        contacts: [],
        version: 1,
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await oldGetStarted;
  await page.getByLabel('Họ và tên').fill('Tên đã lưu');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu hồ sơ');
  releaseOldGet();

  await expect(page.getByLabel('Họ và tên')).toHaveValue('Tên đã lưu');
});

test('removes a claim that expires while its preview request is still pending', async ({
  page,
}) => {
  let claimAvailable = true;
  let releasePreview!: () => void;
  let markPreviewStarted!: () => void;
  const previewStarted = new Promise<void>((resolve) => (markPreviewStarted = resolve));
  const previewReleased = new Promise<void>((resolve) => (releasePreview = resolve));
  await mockActiveMember(page, {
    memberId: null,
    claims: () => (claimAvailable ? [{ id: 'claim-1', version: 1 }] : []),
  });
  await page.route('**/api/v1/families/family-1/member-claims/claim-1/preview', async (route) => {
    markPreviewStarted();
    await previewReleased;
    return route.fulfill({
      json: {
        id: 'claim-1',
        version: 1,
        member_version: 1,
        member: {
          id: 'member-1',
          display_name: 'Hồ sơ đã hết hạn',
          familiar_name: null,
          hometown: null,
          biography: null,
          version: 1,
        },
        contacts: [],
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await previewStarted;
  claimAvailable = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  releasePreview();

  await expect(page.getByRole('button', { name: 'Xác nhận nhận hồ sơ' })).toHaveCount(0);
  await expect(
    page.getByText('Chưa có hồ sơ được chỉ định cho bạn.', { exact: false }),
  ).toBeVisible();
});

test('removes family data when membership is revoked during a profile edit', async ({ page }) => {
  let revoked = false;
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Người minh họa', email: 'person@example.test' },
        memberships: [
          revoked
            ? { id: 'membership-1', status: 'revoked' }
            : {
                id: 'membership-1',
                family_id: 'family-1',
                name: 'Nhà kiểm thử',
                role: 'member',
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
    route.fulfill({ json: { members: [] } }),
  );
  await page.route('**/api/v1/families/family-1/members/member-1', (route) =>
    route.fulfill({
      json: {
        id: 'member-1',
        display_name: 'Tên ban đầu',
        familiar_name: null,
        hometown: null,
        biography: null,
        contacts: [],
        version: 1,
      },
    }),
  );

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByLabel('Họ và tên').fill('Dữ liệu không được giữ lại');
  await page.getByRole('button', { name: 'Nhà mình', exact: true }).click();
  revoked = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByText('Quyền vào nhà đã được thu hồi.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Họ và tên')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Người thân', exact: true })).toHaveCount(0);
});

test('removes family data when a profile mutation reports revoked access', async ({ page }) => {
  await mockActiveMember(page, { memberId: 'member-1', claims: [] });
  await page.route('**/api/v1/families/family-1/members/member-1', (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN' } } });
    }
    return route.fulfill({
      json: {
        id: 'member-1',
        display_name: 'Tên ban đầu',
        familiar_name: null,
        hometown: null,
        biography: null,
        contacts: [],
        version: 1,
      },
    });
  });

  await page.goto('/app');
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.getByLabel('Họ và tên').fill('Không giữ sau khi quyền bị từ chối');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Người thân', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Họ và tên')).toHaveCount(0);
});

test('ignores an older refresh response after logout', async ({ page }) => {
  let meCalls = 0;
  let releaseRefresh!: () => void;
  let markRefreshStarted!: () => void;
  const refreshStarted = new Promise<void>((resolve) => (markRefreshStarted = resolve));
  const refreshReleased = new Promise<void>((resolve) => (releaseRefresh = resolve));
  const activeMe = {
    user: { id: 'user-1', name: 'Người minh họa', email: 'person@example.test' },
    memberships: [
      {
        id: 'membership-1',
        family_id: 'family-1',
        name: 'Nhà kiểm thử',
        role: 'member',
        status: 'active',
      },
    ],
  };
  await page.route('**/api/v1/me', async (route) => {
    meCalls++;
    if (meCalls > 1) {
      markRefreshStarted();
      await refreshReleased;
    }
    return route.fulfill({ json: activeMe });
  });
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({ json: { member_id: null, claims: [] } }),
  );
  await page.route('**/api/v1/families/family-1/members?limit=100', (route) =>
    route.fulfill({ json: { members: [] } }),
  );
  await page.route('**/api/auth/sign-out', (route) => route.fulfill({ json: { ok: true } }));

  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Nhà mình ở đây.' })).toBeVisible();
  await page.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await refreshStarted;
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL('**/login');
  releaseRefresh();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Mừng bạn về nhà.' })).toBeVisible();
});

test('keeps an expired invitation for retry while showing a non-disclosing error', async ({
  page,
}) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Người minh họa', email: 'person@example.test' },
        memberships: [],
      },
    }),
  );
  await page.route('**/api/v1/invitations/accept', (route) =>
    route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } }),
  );

  await page.goto('/app#invite=expired-invitation');
  await page.getByRole('button', { name: 'Nhận lời mời', exact: true }).click();

  await expect(page.locator('main').getByRole('alert')).toContainText('Không tìm thấy thông tin');
  expect(await page.evaluate(() => sessionStorage.getItem('family.pending-invitation'))).toBe(
    'expired-invitation',
  );
});

async function mockActiveMember(
  page: import('@playwright/test').Page,
  onboarding: {
    memberId: string | null;
    claims: { id: string; version: number }[] | (() => { id: string; version: number }[]);
  },
) {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', name: 'Người minh họa', email: 'person@example.test' },
        memberships: [
          {
            id: 'membership-1',
            family_id: 'family-1',
            name: 'Nhà kiểm thử',
            role: 'member',
            status: 'active',
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/onboarding', (route) =>
    route.fulfill({
      json: {
        member_id: onboarding.memberId,
        claims: typeof onboarding.claims === 'function' ? onboarding.claims() : onboarding.claims,
      },
    }),
  );
  await page.route('**/api/v1/families/family-1/members?limit=100', (route) =>
    route.fulfill({
      json: {
        members: [
          {
            id: 'member-2',
            display_name: 'Người có liên hệ',
            familiar_name: null,
            hometown: null,
            version: 1,
          },
        ],
      },
    }),
  );
}
