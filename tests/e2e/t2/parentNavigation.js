const { expect } = require('@playwright/test');

const openParentTasks = async (page, webUrl) => {
  const link = page.getByRole('navigation', { name: '家长导航', exact: true })
    .getByRole('link', { name: '任务', exact: true });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', '/app/tasks');
  await link.click();
  await expect(page).toHaveURL(webUrl + '/app/tasks');
};

const finishParentNavigationTest = async ({ page, info, runtime, evidence }) => {
  const failures = [];
  for (const step of [
    () => page.unrouteAll({ behavior: 'wait' }),
    () => info.attach('navigation-events', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' }),
    () => runtime.stop()
  ]) {
    try { await step(); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'Parent navigation test cleanup failed');
};

module.exports = { openParentTasks, finishParentNavigationTest };
