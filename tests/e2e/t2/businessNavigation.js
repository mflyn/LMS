const { expect } = require('@playwright/test');

async function openParentChildren(page, webUrl) {
  const link = page.getByRole('navigation', { name: '家长导航', exact: true })
    .getByRole('link', { name: '孩子', exact: true });
  await expect(link).toHaveAttribute('href', '/app/children');
  await link.click();
  await expect(page).toHaveURL(webUrl + '/app/children');
}

async function openChildTask(page, webUrl, taskId) {
  await expect(page).toHaveURL(webUrl + '/child/today');
  const link = page.getByRole('region', { name: '今天的任务', exact: true })
    .locator(`a[href="/child/tasks/${taskId}"]`);
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(webUrl + `/child/tasks/${taskId}`);
}

module.exports = { openParentChildren, openChildTask };
