const { test, expect } = require('@playwright/test');

const monitorPage = (page) => {
  const failures = [];
  let expectedFamilyProbeErrors = 0;
  page.on('response', (response) => {
    if (response.status() !== 404) return;
    const url = new URL(response.url());
    if (url.pathname === '/api/families/me') expectedFamilyProbeErrors += 1;
  });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('status of 404') && expectedFamilyProbeErrors > 0) {
      expectedFamilyProbeErrors -= 1;
      return;
    }
    failures.push(`console: ${message.text()}`);
  });
  return () => expect(failures, failures.join('\n')).toEqual([]);
};

const register = async (page, { username, name, password }) => {
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: '注册家长账号' })).toBeVisible();
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('称呼').fill(name);
  await page.getByLabel('邮箱').fill(`${username}@example.com`);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码').fill(password);
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/auth/register') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: '注册' }).click();
  expect((await responsePromise).status()).toBe(201);
};

test('TC-T12-UX-001 completes private invitation and ownership governance at desktop and mobile', async ({ page, browser }) => {
  const assertOwnerConsole = monitorPage(page);
  const suffix = Date.now().toString(36).slice(-8);
  const password = 'FamilyBrowserPass123';
  const ownerUsername = `t12o_${suffix}`;
  const memberUsername = `t12m_${suffix}`;

  await page.goto('/register');
  await register(page, { username: ownerUsername, name: '浏览器所有者', password });
  await expect(page).toHaveURL(/\/family\/setup$/);
  await page.getByLabel('家庭名称').fill('浏览器共管家庭');
  await page.getByRole('button', { name: '创建家庭' }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
  await page.getByRole('link', { name: '家庭成员' }).click();
  await expect(page.getByRole('heading', { name: '家庭成员' })).toBeVisible();

  const createResponsePromise = page.waitForResponse((response) => (
    response.url().includes('/parent-invitations') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: '邀请第二家长' }).click();
  expect((await createResponsePromise).status()).toBe(201);
  const invitationUrl = await page.getByLabel('本次邀请链接').inputValue();
  const invitationToken = new URL(invitationUrl).hash.slice('#token='.length);
  expect(invitationToken.length).toBeGreaterThan(30);

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  const assertMemberConsole = monitorPage(memberPage);
  const requestedUrls = [];
  memberPage.on('request', (request) => requestedUrls.push(request.url()));
  await memberPage.goto(invitationUrl);
  await expect(memberPage).toHaveURL(/\/login$/);
  await memberPage.getByRole('link', { name: '注册家长账号' }).click();
  await register(memberPage, { username: memberUsername, name: '浏览器第二家长', password });

  await expect(memberPage).toHaveURL(/\/family\/invitations#token=/);
  await expect(memberPage.getByRole('heading', { name: '加入家庭' })).toBeVisible();
  await expect(memberPage.getByText('浏览器共管家庭')).toBeVisible();
  await memberPage.getByLabel('家庭身份').selectOption('guardian');
  const acceptResponsePromise = memberPage.waitForResponse((response) => (
    response.url().endsWith('/api/parent-invitations/accept')
      && response.request().method() === 'POST'
  ));
  await memberPage.getByRole('button', { name: '接受邀请' }).click();
  expect((await acceptResponsePromise).status()).toBe(200);
  await expect(memberPage).toHaveURL(/\/app\/family-members$/);
  await expect(memberPage.getByRole('heading', { name: '浏览器所有者' })).toBeVisible();
  await expect(memberPage.getByRole('heading', { name: '浏览器第二家长' })).toBeVisible();
  await expect(memberPage.getByRole('button', { name: '退出家庭' })).toBeVisible();
  expect(requestedUrls.some((url) => url.includes(invitationToken))).toBe(false);
  const memberStorage = await memberPage.evaluate(() => JSON.stringify(localStorage));
  expect(memberStorage).not.toContain(invitationToken);

  await memberPage.goBack();
  await expect(memberPage).not.toHaveURL(/\/family\/invitations/);
  expect(new URL(memberPage.url()).hash).toBe('');
  await memberPage.goto('/app/family-members');
  await expect(memberPage).toHaveURL(/\/app\/family-members$/);
  await expect(memberPage.getByRole('heading', { name: '家庭成员' })).toBeVisible();

  await memberPage.setViewportSize({ width: 360, height: 800 });
  expect(await memberPage.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
  await expect(memberPage.getByTestId('parent-slot')).toHaveCount(2);

  await page.reload();
  await page.getByRole('button', { name: '转移给浏览器第二家长' }).click();
  await page.getByRole('button', { name: '确认转移' }).click();
  await expect(page.getByText('家庭所有权已转移。')).toBeVisible();

  await memberPage.reload();
  await expect(memberPage.getByRole('button', { name: '移除浏览器所有者' })).toBeVisible();
  await memberPage.getByRole('button', { name: '移除浏览器所有者' }).click();
  await memberPage.getByRole('button', { name: '确认移除' }).click();
  await expect(memberPage.getByText(/历史成长记录仍会保留/)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/family\/setup$/);
  await expect(page.getByRole('heading', { name: '创建家庭' })).toBeVisible();

  assertOwnerConsole();
  assertMemberConsole();
  await memberContext.close();
});
