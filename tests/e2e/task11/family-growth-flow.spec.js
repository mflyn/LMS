const { test, expect } = require('@playwright/test');
const sharp = require('sharp');

const localDateInShanghai = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

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

const createChild = async (page, name, grade) => {
  await page.getByLabel('孩子姓名').fill(name);
  await page.getByLabel('年级').selectOption(String(grade));
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/children') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: '添加孩子' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const payload = await response.json();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  return payload.data.child;
};

const setPin = async (page, name, pin) => {
  const input = page.getByLabel(`${name}的 PIN`);
  await input.fill(pin);
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/api/children/')
      && response.url().endsWith('/pin')
      && response.request().method() === 'POST'
  ));
  await input.locator('xpath=ancestor::form').getByRole('button', { name: '设置 PIN' }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(input.locator('xpath=ancestor::form').getByRole('status')).toContainText('PIN 已更新');
};

const createTask = async (page, task, dueDate) => {
  await page.getByRole('button', { name: '新建任务' }).click();
  const dialog = page.getByRole('dialog', { name: '新建任务' });
  await dialog.getByLabel('成长维度').selectOption(task.dimension);
  if (task.dimension === 'academic') await dialog.getByLabel('学科').fill('数学');
  await dialog.getByLabel('任务标题').fill(task.title);
  await dialog.getByLabel('活动领域').fill(task.area);
  await dialog.getByLabel('截止日期').fill(dueDate);
  await dialog.getByLabel('任务类型').selectOption(task.taskType);
  await dialog.getByLabel('预计用时（分钟）').fill('20');
  if (task.dimension === 'physical') {
    await dialog.getByLabel('目标数量').fill('500');
    await dialog.getByLabel('单位').fill('个');
  }
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/growth-tasks') && response.request().method() === 'POST'
  ));
  await dialog.getByRole('button', { name: '保存任务' }).click();
  expect((await responsePromise).status()).toBe(201);
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
};

test('parent and child complete the five-dimension growth task loop', async ({ page, browser }) => {
  const assertParentConsole = monitorPage(page);
  const unique = Date.now().toString(36).slice(-8);
  const username = `task11_${unique}`;
  const password = 'FamilyBrowserPass123';

  await page.goto('/register');
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('称呼').fill('浏览器验收家长');
  await page.getByLabel('邮箱').fill(`${username}@example.com`);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码').fill(password);
  const registrationResponsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/auth/register') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: '注册' }).click();
  expect((await registrationResponsePromise).status()).toBe(201);
  await expect(page).toHaveURL(/\/family\/setup$/);

  await page.getByLabel('家庭名称').fill('浏览器验收家庭');
  const familyResponsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/families') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: '创建家庭' }).click();
  const familyPayload = await (await familyResponsePromise).json();
  const family = familyPayload.data.family;
  await expect(page).toHaveURL(/\/app\/today$/);

  await page.getByRole('link', { name: '孩子' }).click();
  await expect(page.getByText(family.familyId, { exact: true })).toBeVisible();
  const childA = await createChild(page, '小明', 3);
  await expect(page.getByText(childA.childId, { exact: true })).toBeVisible();
  await createChild(page, '小红', 2);
  await setPin(page, '小明', '2468');
  await setPin(page, '小红', '1357');

  await page.getByRole('link', { name: '任务' }).click();
  const tasks = [
    { dimension: 'moral', title: '帮助同学', area: '友善', taskType: 'habit' },
    { dimension: 'academic', title: '完成数学练习', area: '数学', taskType: 'practice' },
    { dimension: 'physical', title: '跳绳 500 个', area: '体能', taskType: 'exercise' },
    { dimension: 'artistic', title: '练习钢琴', area: '音乐', taskType: 'practice' },
    { dimension: 'labor', title: '整理房间', area: '家务', taskType: 'chore' }
  ];
  for (const task of tasks) await createTask(page, task, localDateInShanghai());

  const childContext = await browser.newContext();
  const childPage = await childContext.newPage();
  const assertChildConsole = monitorPage(childPage);
  await childPage.goto('/child/login');
  await childPage.getByLabel('家庭 ID').fill(family.familyId);
  await childPage.getByLabel('孩子 ID').fill(childA.childId);
  await childPage.getByLabel('PIN').fill('2468');
  await childPage.getByRole('button', { name: '进入我的成长空间' }).click();
  await expect(childPage).toHaveURL(/\/child\/today$/);
  await childPage.getByRole('link', { name: /跳绳 500 个/ }).click();
  await childPage.getByLabel('实际用时（分钟）').fill('18');
  await childPage.getByLabel('实际完成数量').fill('500');
  await childPage.getByLabel('我的一句话').fill('我按计划完成了。');
  await childPage.getByRole('button', { name: '提交完成情况' }).click();
  await expect(childPage.getByRole('status')).toContainText('等待家长确认');

  await page.reload();
  await page.getByRole('button', { name: '确认 跳绳 500 个' }).click();
  const dialog = page.getByRole('dialog', { name: '家长确认' });
  await dialog.getByLabel('家长反馈').fill('完成得很认真。');
  await dialog.getByRole('button', { name: '确认并发放星星' }).click();
  await expect(page.getByRole('heading', { name: '跳绳 500 个' }).locator('xpath=ancestor::article'))
    .toContainText('已确认');

  await page.getByRole('link', { name: '记录' }).click();
  await page.getByRole('button', { name: '记录成长' }).click();
  const logDialog = page.getByRole('dialog', { name: '记录成长' });
  await logDialog.getByLabel('日期').fill(localDateInShanghai());
  await logDialog.getByLabel('成长维度').selectOption('physical');
  await logDialog.getByLabel('领域').fill('体能');
  await logDialog.getByLabel('时长（分钟）').fill('18');
  await logDialog.getByLabel('记录内容').fill('跳绳训练完成');
  await logDialog.getByRole('button', { name: '保存成长记录' }).click();
  await expect(page.getByRole('status')).toContainText('成长记录已保存');

  await page.getByRole('link', { name: '错题' }).click();
  await page.getByRole('button', { name: '记录错题' }).click();
  const mistakeDialog = page.getByRole('dialog', { name: '记录错题' });
  await mistakeDialog.getByLabel('学科').fill('数学');
  await mistakeDialog.getByLabel('知识点').fill('两位数乘法');
  await mistakeDialog.getByLabel('错误原因').selectOption('calculation');
  await mistakeDialog.getByLabel('正确答案').fill('84');
  await mistakeDialog.getByLabel('家长备注').fill('复习进位步骤');
  const questionImage = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 40, g: 120, b: 180 }
    }
  }).png().toBuffer();
  const uploadResponsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/api/media') && response.request().method() === 'POST'
  ));
  await mistakeDialog.getByLabel('题目图片').setInputFiles({
    name: 'question.png',
    mimeType: 'image/png',
    buffer: questionImage
  });
  expect((await uploadResponsePromise).status()).toBe(201);
  await mistakeDialog.getByRole('button', { name: '查看题目图片' }).click();
  await expect(mistakeDialog.getByRole('img', { name: '题目图片预览' })).toBeVisible();
  await mistakeDialog.getByRole('button', { name: '保存错题' }).click();
  await expect(page.getByRole('status')).toContainText('错题已记录');

  await page.getByRole('link', { name: '周报' }).click();
  await expect(page.getByText('记录天数').locator('..')).toContainText('1');
  await expect(page.getByText('成长投入').locator('..')).toContainText('18 分钟');
  await expect(page.getByText('新增错题').locator('..')).toContainText('1');

  await page.getByRole('link', { name: '提醒' }).click();
  await expect(page.getByRole('heading', { name: '提醒设置' })).toBeVisible();
  await page.getByRole('checkbox', { name: '周报提醒', exact: true }).check();
  await page.getByRole('combobox', { name: /^周报提醒日/ }).selectOption('7');
  await page.getByRole('button', { name: '保存提醒设置' }).click();
  await expect(page.getByRole('status')).toContainText('提醒设置已保存');

  await page.getByRole('link', { name: '星星与奖励' }).click();
  await expect(page.getByText('当前星星').locator('..')).toContainText('1');
  await expect(page.getByText('成长获得').locator('..')).toContainText('+1');
  await page.getByRole('button', { name: '新建奖励' }).click();
  const rewardDialog = page.getByRole('dialog', { name: '新建奖励' });
  await rewardDialog.getByLabel('奖励名称').fill('选择周末家庭活动');
  await rewardDialog.getByLabel('所需星星').fill('1');
  await rewardDialog.getByRole('button', { name: '保存奖励' }).click();
  await page.getByRole('button', { name: '兑换 选择周末家庭活动' }).click();
  await page.getByRole('dialog', { name: '确认兑换' })
    .getByRole('button', { name: '确认兑换' }).click();
  await expect(page.getByRole('status')).toContainText('已兑换，使用 1 颗星');
  await expect(page.getByText('当前星星').locator('..')).toContainText('0');

  assertParentConsole();
  assertChildConsole();
  await childContext.close();
});
