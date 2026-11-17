const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Exercise the real registered navigation callback, including its setup boundary.
function navigationCase() {
  const filename = path.join(__dirname, 'ai1BrowserContracts.spec.js');
  const localRequire = createRequire(filename), cases = [];
  let runtime;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    URL,
    require(id) {
      if (id === '@playwright/test') return { test: (name, run) => cases.push({ name, run }), expect };
      if (id === './webRuntime') return { createT2WebRuntime: async () => runtime };
      return localRequire(id);
    }
  }, { filename });
  const selected = cases.find(item => item.name === 'AI1 tasks entry during pending real plan read keeps document and data');
  expect(selected).toBeDefined();
  return (page, info, value) => { runtime = value; return selected.run({ page, browserName: 'webkit' }, info); };
}

function fixture(stage, stop = async () => {}) {
  const calls = [], original = new Error(`Synthetic ${stage} failure`);
  const page = {
    on() { if (stage === 'listener') throw original; },
    async route() { calls.push('route'); if (stage === 'route') throw original; },
    async goto() { calls.push('goto'); throw original; },
    async unrouteAll() { calls.push('unroute'); }
  };
  const info = { async attach() { calls.push('attach'); } };
  const runtime = { servers: [], webUrl: 'http://127.0.0.1:12345', async stop() { calls.push('stop'); await stop(); } };
  return { calls, original, page, info, runtime };
}

for (const stage of ['listener', 'route', 'goto']) test(`AI1 navigation cleanup stops runtime after ${stage} failure`, async () => {
  const f = fixture(stage);
  const result = await navigationCase()(f.page, f.info, f.runtime).catch(error => error);
  expect(result).toBe(f.original);
  expect(f.calls.filter(call => ['unroute', 'attach', 'stop'].includes(call))).toEqual(['unroute', 'attach', 'stop']);
});

test('AI1 navigation cleanup waits for stop after route registration failure', async () => {
  let release, settled = false;
  const held = new Promise(resolve => { release = resolve; });
  const f = fixture('route', () => held);
  const result = navigationCase()(f.page, f.info, f.runtime).then(
    value => { settled = true; return value; }, error => { settled = true; return error; }
  );
  try {
    // A later event-loop turn must not settle the case while stop is held.
    await new Promise(resolve => setImmediate(resolve));
    expect(f.calls).toEqual(['route', 'unroute', 'attach', 'stop']);
    expect(settled).toBe(false);
  } finally { release(); await result; }
  expect(await result).toBe(f.original);
  expect(settled).toBe(true);
});

test('AI1 navigation cleanup retains original and all cleanup failures', async () => {
  const stop = new Error('Synthetic stop failure'), unroute = new Error('Synthetic unroute failure');
  const attach = new Error('Synthetic attach failure');
  const f = fixture('route', async () => { throw stop; });
  f.page.unrouteAll = async () => { f.calls.push('unroute'); throw unroute; };
  f.info.attach = async () => { f.calls.push('attach'); throw attach; };
  const result = await navigationCase()(f.page, f.info, f.runtime).catch(error => error);
  const leaves = error => error?.errors ? Array.from(error.errors).flatMap(leaves) : [error];
  expect(result?.name).toBe('AggregateError');
  expect(leaves(result)).toEqual([f.original, unroute, attach, stop]);
  expect(f.calls).toEqual(['route', 'unroute', 'attach', 'stop']);
});
