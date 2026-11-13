const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { createT2WebRuntime } = require('./webRuntime');
let runtime;
test.beforeEach(async () => { runtime = await createT2WebRuntime(); });
test.afterEach(async () => { await runtime?.stop(); });

async function fillPin(page, name = 'child') {
  const actor = runtime.fixture.actors[name];
  await page.goto(runtime.webUrl + '/child/login');
  await page.getByLabel('家庭 ID').fill(actor.familyId);
  await page.getByLabel('孩子 ID').fill(actor.childId);
  await page.getByLabel('PIN').fill(actor.pin);
}

for (const exitingActor of ['child', 'sibling']) {
  test(`held real PIN success respects ${exitingActor} logout and permits a fresh explicit login`, async ({ page, context, browserName }, info) => {
    const actor = runtime.fixture.actors.child;
    await fillPin(page, exitingActor);
    await page.getByRole('button', { name: '进入我的成长空间', exact: true }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
    const other = await context.newPage();
    let release, ready;
    const held = new Promise(resolve => { release = resolve; });
    const issued = new Promise(resolve => { ready = resolve; });
    let upstreamStatus, routeError;
    await other.route('**/api/auth/child-pin-login', async route => {
      let response;
      try {
        response = await route.fetch({ maxRetries: 0 });
        upstreamStatus = response.status(); ready();
        await held; await route.fulfill({ response });
      } catch (error) { routeError = error; ready(); throw error; }
      finally { await response?.dispose(); }
    });
    try {
      await fillPin(other);
      await other.getByRole('button', { name: '进入我的成长空间', exact: true }).click();
      await issued;
      if (routeError) throw routeError;
      expect(upstreamStatus).toBe(200);
      expect(await other.evaluate(() => sessionStorage.getItem('family-growth.child-session.v1'))).toBeNull();
      await page.goto(runtime.webUrl + '/child/me');
      await page.getByRole('button', { name: '退出孩子端', exact: true }).click();
      await expect(page).toHaveURL(/\/child\/login$/);
      const markerKey = 'family-growth.session-exit.v1:student:' + runtime.fixture.actors[exitingActor].childId;
      await expect.poll(() => other.evaluate(key => localStorage.getItem(key), markerKey)).not.toBeNull();
      release();
      // Wait for actual response handling, not for an arbitrary delay or a transient missing button.
      await expect.poll(() => other.evaluate(() => {
        const raw = sessionStorage.getItem('family-growth.child-session.v1');
        return raw ? 'authenticated' : (document.querySelector('button[type="submit"]')?.disabled ? 'pending' : 'anonymous');
      })).not.toBe('pending');
      const result = { browserName, exitingActor, upstreamStatus, exitMarkerSeenBeforeRelease: true,
        actorAfterResponse: await other.evaluate(() => {
          const raw = sessionStorage.getItem('family-growth.child-session.v1');
          return raw ? JSON.parse(raw).child.childId : null;
        }), urlAfterResponse: new URL(other.url()).pathname };
      fs.writeFileSync(info.outputPath('pin-race.json'), JSON.stringify(result, null, 2));
      if (exitingActor === 'child') {
        expect(result.actorAfterResponse).toBeNull();
        await expect(other).toHaveURL(/\/child\/login$/);
        await expect(other.getByText('此次登录已失效，请重新输入 PIN。', { exact: true })).toBeVisible();
        await other.unrouteAll({ behavior: 'wait' });
        await other.getByLabel('PIN').fill(actor.pin);
        await other.getByRole('button', { name: '进入我的成长空间', exact: true }).click();
      } else {
        expect(result.actorAfterResponse).toBe(actor.childId);
      }
      await expect(other).toHaveURL(/\/child\/today$/);
      expect(await other.evaluate(() => JSON.parse(sessionStorage.getItem('family-growth.child-session.v1')).child.childId)).toBe(actor.childId);
      if (routeError) throw routeError;
    } finally {
      release();
      try { await other.unrouteAll({ behavior: 'wait' }); }
      finally { await other.close(); }
    }
  });
}
