// Local-only browser verification. Creates and removes only this run's synthetic family/users.
import { chromium } from '@playwright/test';
import pg from 'pg';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
const origin = process.env.WEB_ORIGIN;
const database = process.env.DATABASE_URL;
if (process.env.APP_ENV !== 'local' || !origin || !database) throw Error('Local env required');
for (const value of [origin, database])
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(value).hostname))
    throw Error('Loopback only');
const pool = new pg.Pool({ connectionString: database });
const family = randomUUID();
const stamp = Date.now();
const emails = [`flow-admin-${stamp}@example.test`, `flow-member-${stamp}@example.test`];
const password = randomBytes(18).toString('base64url');
const newPassword = randomBytes(18).toString('base64url');
const browser = await chromium.launch();
const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const member = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const page of [admin, member]) {
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
}
const evidence = '.superpowers/ui-preview-evidence';
await mkdir(evidence, { recursive: true });
async function mailLink(email, path) {
  const endpoint = `http://127.0.0.1:${process.env.MAILPIT_PORT ?? 8035}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = await (await fetch(endpoint + '/api/v1/messages?limit=100')).json();
    for (const item of list.messages ?? []) {
      if (!JSON.stringify(item.To).includes(email)) continue;
      const detail = await (await fetch(endpoint + '/api/v1/message/' + item.ID)).json();
      const text = detail.Text ?? '';
      const links = text.match(/https?:\/\/[^\s<>"']+/g) ?? [];
      const link = links.find((value) => value.includes(path));
      if (link && new URL(link).origin === origin) return link.replaceAll('&amp;', '&');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error('Expected local email link was not delivered');
}
async function register(page, email, name) {
  console.log('Stage: register', name);
  await page.goto(origin + '/register');
  await page.screenshot({
    path: evidence + (page === admin ? '/flow-register-desktop.png' : '/flow-register-mobile.png'),
    fullPage: true,
  });
  await page.getByLabel('Tên của bạn', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản →' }).click();
  await page.waitForURL('**/verify-email');
  await page.goto(await mailLink(email, '/verify-email'));
  await page.waitForURL('**/login?verified=1');
  if (page === member)
    await page.screenshot({ path: evidence + '/flow-login-mobile.png', fullPage: true });
}
async function login(page, email, pass = password) {
  console.log('Stage: login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Vào nhà →' }).click();
  await page.waitForURL('**/app');
}
try {
  await register(admin, emails[0], 'Quản trị minh họa');
  const user = await pool.query('SELECT id FROM users WHERE email=$1 AND email_verified=true', [
    emails[0],
  ]);
  if (!user.rows[0]) throw Error('Email not verified');
  await pool.query('INSERT INTO family_spaces(id,name) VALUES($1,$2)', [
    family,
    'Nhà kiểm thử trình duyệt',
  ]);
  await pool.query(
    "INSERT INTO family_memberships(family_id,user_id,role,status) VALUES($1,$2,'admin','active')",
    [family, user.rows[0].id],
  );
  await login(admin, emails[0]);
  await admin.getByRole('button', { name: 'Quản trị nhà', exact: true }).click();
  await admin.getByRole('button', { name: 'Tạo link lời mời', exact: true }).click();
  console.log('Stage: invite');
  await admin.getByLabel('Link lời mời', { exact: true }).waitFor();
  const invite = await admin.getByLabel('Link lời mời', { exact: true }).inputValue();
  await member.goto(invite);
  await member.getByRole('link', { name: 'Chưa có tài khoản? Đăng ký' }).click();
  await register(member, emails[1], 'Người thân minh họa');
  await login(member, emails[1]);
  await member.getByRole('button', { name: 'Nhận lời mời', exact: true }).click();
  await member.getByRole('heading', { name: 'Chờ nhà mình đón bạn.' }).waitFor();
  await member.screenshot({ path: evidence + '/flow-pending-mobile.png', fullPage: true });
  await admin.getByRole('button', { name: 'Tải lại danh sách' }).click();
  await admin.getByRole('button', { name: 'Duyệt vào nhà' }).click();
  await member.getByRole('button', { name: 'Kiểm tra trạng thái' }).click();
  await member.getByRole('heading', { name: 'Nhà mình ở đây.' }).waitFor();
  console.log('Stage: approved');
  await admin.getByLabel('Tên người chưa có trong danh bạ').fill('Người thân minh họa');
  await admin.getByRole('button', { name: 'Thêm hồ sơ mới', exact: true }).click();
  await admin.getByRole('status').filter({ hasText: 'Đã thêm hồ sơ' }).waitFor();
  await admin.screenshot({ path: evidence + '/flow-admin-created.png', fullPage: true });
  console.log('Stage: profile created');
  await admin
    .getByLabel('Tài khoản', { exact: true })
    .selectOption({ label: 'Người thân minh họa' });
  await admin.getByLabel('Hồ sơ tương ứng').selectOption({ label: 'Người thân minh họa' });
  await admin.getByRole('button', { name: 'Gửi hồ sơ để người nhận xác nhận' }).click();
  await admin.getByRole('status').filter({ hasText: 'Đã chỉ định' }).waitFor();
  await member.reload();
  await member.getByRole('button', { name: 'Hồ sơ của tôi', exact: true }).click();
  await member.getByRole('checkbox').check();
  await member.getByRole('button', { name: 'Xác nhận nhận hồ sơ' }).click();
  await member.getByLabel('Quê quán', { exact: true }).fill('Cần Thơ');
  await member.getByRole('button', { name: 'Thêm liên hệ', exact: true }).click();
  await member.getByLabel('Nội dung', { exact: true }).fill('member@example.test');
  await member.getByLabel('Loại', { exact: true }).selectOption('email');
  await member.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await member.getByRole('status').filter({ hasText: 'Đã lưu hồ sơ' }).waitFor();
  await member.screenshot({ path: evidence + '/flow-profile-mobile.png', fullPage: true });
  await member.getByRole('button', { name: 'Nhà mình', exact: true }).click();
  await member.getByRole('link', { name: /Khám phá cây gia phả/ }).click();
  await member.waitForURL('**/design-preview/tree');
  await member.goto(origin + '/app');
  await member.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await member.waitForURL('**/login');
  await member.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await member.getByLabel('Email', { exact: true }).fill(emails[1]);
  await member.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click();
  await member.getByRole('status').waitFor();
  await member.goto(await mailLink(emails[1], '/reset-password'));
  await member.getByLabel('Mật khẩu', { exact: true }).fill(newPassword);
  await member.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(newPassword);
  await member.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await member.getByRole('status').filter({ hasText: 'Đã đặt lại mật khẩu' }).waitFor();
  await member.getByRole('link', { name: 'Về đăng nhập' }).click();
  await login(member, emails[1], newPassword);
  await member.getByRole('heading', { name: 'Nhà mình ở đây.' }).waitFor();
  const memberships = await pool.query(
    'SELECT id,version FROM family_memberships WHERE family_id=$1 AND user_id=(SELECT id FROM users WHERE email=$2)',
    [family, emails[1]],
  );
  const revoke = await admin.request.post(
    origin + `/api/v1/families/${family}/memberships/${memberships.rows[0].id}/revoke`,
    { headers: { Origin: origin }, data: { version: memberships.rows[0].version } },
  );
  if (!revoke.ok()) throw Error('Revoke failed');
  await member.reload();
  await member.getByText('Quyền vào nhà đã được thu hồi.', { exact: false }).waitFor();
  console.log(
    'PASS browser real API: register, verify, invitation, pending, admin approval, claim, profile save, tree demo, logout, password reset, revocation',
  );
} catch (error) {
  await admin.screenshot({ path: evidence + '/flow-failure-admin.png', fullPage: true });
  await member.screenshot({ path: evidence + '/flow-failure-member.png', fullPage: true });
  console.error('Flow failed at:', error.message);
  throw error;
} finally {
  await browser.close();
  for (const table of [
    'audit_entries',
    'member_claims',
    'invitations',
    'member_contacts',
    'member_account_links',
    'members',
    'family_memberships',
  ])
    await pool.query(`DELETE FROM ${table} WHERE family_id=$1`, [family]);
  await pool.query('DELETE FROM family_spaces WHERE id=$1', [family]);
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
  await pool.end();
}
