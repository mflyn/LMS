const assert = require('node:assert/strict');
const { expect } = require('@playwright/test');
const { randomUUID } = require('crypto');
const { openParentTasks } = require('./parentNavigation');

async function openTutorSource(page, webUrl, entry = 'tasks') {
  assert(['tasks', 'mistakes'].includes(entry));
  const marker = randomUUID();
  await page.evaluate(value => { window.ai1NavigationMarker = value; }, marker);
  if (entry === 'tasks') await openParentTasks(page, webUrl);
  else {
    const link = page.getByRole('navigation', { name: '家长导航', exact: true })
      .getByRole('link', { name: '错题', exact: true });
    await expect(link).toHaveAttribute('href', '/app/mistakes');
    await link.click(); await expect(page).toHaveURL(webUrl + '/app/mistakes');
  }
  expect(await page.evaluate(() => window.ai1NavigationMarker)).toBe(marker);
}

async function openTutorCycle(page, webUrl, detailUrl) {
  const target = new URL(detailUrl);
  assert.equal(target.origin, webUrl); assert.equal(target.pathname, '/app/tutor');
  assert.match(target.searchParams.get('cycleId'), /^[a-f0-9]{24}$/);
  await openTutorSource(page, webUrl);
  const marker = await page.evaluate(() => window.ai1NavigationMarker);
  await page.getByLabel('当前孩子').selectOption(target.searchParams.get('childId'));
  const link = page.getByRole('link', { name: '讲解记录', exact: true });
  await expect(link).toHaveAttribute('href', '/app/tutor'); await link.click();
  // This isolated fixture contains exactly one cycle; never choose an arbitrary row.
  const view = page.getByRole('region', { name: '讲解记录', exact: true })
    .getByRole('button', { name: '查看讲解', exact: true });
  await expect(view).toHaveCount(1); await view.click(); await expect(page).toHaveURL(detailUrl);
  expect(await page.evaluate(() => window.ai1NavigationMarker)).toBe(marker);
}

const transportErrors = {
  chromium: { cancelled: ['net::ERR_ABORTED'], injected: ['net::ERR_FAILED'],
    dropped: ['net::ERR_EMPTY_RESPONSE', 'net::ERR_CONNECTION_RESET'] },
  webkit: { cancelled: ['cancelled'], injected: ['Blocked by Web Inspector'],
    dropped: ['The network connection was lost.'] }
};

function assertFailureRecord(record, { browserName, kind, url, method }) {
  const allowed = transportErrors[browserName]?.[kind];
  assert(allowed, 'Unsupported engine or fault');
  assert.equal(record.url, url); assert.equal(record.method, method);
  assert.equal(record.response, null);
  assert(allowed.includes(record.errorText), `Unexpected ${kind}: ${record.errorText}`);
}

async function assertRequestFailure(request, options) {
  assertFailureRecord({ url: request.url(), method: request.method(), response: await request.response(),
    errorText: request.failure()?.errorText }, options);
}

function assertFaultConsole(events, { browserName, kind, url }) {
  assert(['chromium', 'webkit'].includes(browserName)); assert(['injected', 'dropped'].includes(kind));
  if (browserName === 'webkit' && kind === 'injected') {
    assert.deepEqual(events, [{ level: 'info', text: `Web Inspector blocked ${url} from loading`, url: '' }]);
  } else {
    assert.equal(events.length, 1);
    assert.equal(events[0].level, 'error'); assert.equal(events[0].url, url);
    const messages = transportErrors[browserName][kind].map(text => `Failed to load resource: ${text}`);
    assert(messages.includes(events[0].text), `Unexpected console: ${events[0].text}`);
  }
}

module.exports = { openTutorSource, openTutorCycle, assertFailureRecord, assertRequestFailure, assertFaultConsole };
