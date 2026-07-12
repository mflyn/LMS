const { test, expect } = require('@playwright/test');

const uniqueUsername = () => `secure_${Date.now().toString(36).slice(-8)}`;

const addChild = async (page, name, grade) => {
  await page.getByLabel('孩子姓名').fill(name);
  await page.getByLabel('年级').selectOption(String(grade));
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/children') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: '添加孩子' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  return (await response.json()).data.child;
};

const updatePin = async (page, childName, pin) => {
  const input = page.getByLabel(`${childName}的 PIN`);
  await input.fill(pin);
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/api/children/')
      && response.url().endsWith('/pin')
      && response.request().method() === 'POST'
  ));
  await input.locator('xpath=ancestor::form').getByRole('button', { name: '设置 PIN' }).click();
  expect((await responsePromise).status()).toBe(200);
};

const setupFamily = async (page) => {
  const username = uniqueUsername();
  const password = 'FamilySecurityPass123';
  await page.goto('/register');
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('称呼').fill('安全验收家长');
  await page.getByLabel('邮箱').fill(`${username}@example.com`);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码').fill(password);
  await page.getByRole('button', { name: '注册' }).click();
  await expect(page).toHaveURL(/\/family\/setup$/);

  await page.getByLabel('家庭名称').fill(`安全验收家庭 ${username}`);
  const familyResponsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/families') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: '创建家庭' }).click();
  const family = (await (await familyResponsePromise).json()).data.family;
  await page.getByRole('link', { name: '孩子' }).click();

  const childA = await addChild(page, '安全小明', 3);
  const childB = await addChild(page, '安全小红', 2);
  await updatePin(page, '安全小明', '2468');
  await updatePin(page, '安全小红', '1357');
  return { family, childA, childB };
};

const loginChild = async (page, familyId, childId, pin = '2468') => {
  await page.goto('/child/login');
  await page.getByLabel('家庭 ID').fill(familyId);
  await page.getByLabel('孩子 ID').fill(childId);
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: '进入我的成长空间' }).click();
  await expect(page).toHaveURL(/\/child\/today$/);
};

test('child identity cannot enter parent routes or read a sibling profile', async ({ page, browser }) => {
  const { family, childA, childB } = await setupFamily(page);
  const childContext = await browser.newContext();
  const childPage = await childContext.newPage();
  await loginChild(childPage, family.familyId, childA.childId);

  const siblingResult = await childPage.evaluate(async ({ siblingId }) => {
    const session = JSON.parse(localStorage.getItem('family-growth.child-session.v1'));
    const response = await fetch(`/api/children/${siblingId}`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    return { status: response.status, body: await response.text() };
  }, { siblingId: childB.childId });
  expect(siblingResult.status).toBe(403);
  expect(siblingResult.body).not.toContain('安全小红');
  await expect(childPage.getByText('安全小红')).toHaveCount(0);

  await childPage.goto('/app/today');
  await expect(childPage).toHaveURL(/\/login$/);
  await expect(childPage.getByRole('heading', { name: '家长登录' })).toBeVisible();
  await expect(childPage.getByRole('navigation', { name: '家长导航' })).toHaveCount(0);
  await childContext.close();
});

test('resetting a PIN expires the existing child browser session', async ({ page, browser }) => {
  const { family, childA } = await setupFamily(page);
  const childContext = await browser.newContext();
  const childPage = await childContext.newPage();
  await loginChild(childPage, family.familyId, childA.childId);

  await updatePin(page, '安全小明', '8642');
  await childPage.reload();
  await expect(childPage).toHaveURL(/\/child\/login$/);
  await expect(childPage.getByRole('alert')).toContainText('会话已过期，请重新登录');
  const storedSession = await childPage.evaluate(() => localStorage.getItem('family-growth.child-session.v1'));
  expect(storedSession).toBeNull();
  await childContext.close();
});

test('parent children page and child shell fit a 360px viewport', async ({ page, browser }) => {
  const { family, childA } = await setupFamily(page);
  await expect(page.getByRole('heading', { name: '孩子', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);

  await page.getByRole('button', { name: '打开导航' }).click();
  const parentLayout = await page.evaluate(() => {
    const navigation = document.querySelector('.family-navigation').getBoundingClientRect();
    const content = document.querySelector('.family-content').getBoundingClientRect();
    return { navigationBottom: navigation.bottom, contentTop: content.top };
  });
  expect(parentLayout.navigationBottom).toBeLessThanOrEqual(parentLayout.contentTop + 1);

  const childContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const childPage = await childContext.newPage();
  await loginChild(childPage, family.familyId, childA.childId);
  expect(await childPage.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
  const childLayout = await childPage.evaluate(() => {
    const navigation = document.querySelector('.child-navigation').getBoundingClientRect();
    const content = document.querySelector('.child-content');
    return {
      navigationHeight: navigation.height,
      contentPaddingBottom: Number.parseFloat(getComputedStyle(content).paddingBottom)
    };
  });
  expect(childLayout.contentPaddingBottom).toBeGreaterThanOrEqual(childLayout.navigationHeight);
  await childContext.close();
});
