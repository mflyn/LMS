const { withRecurringBarrier } = require('./recurringBarrier');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('recurring barrier awaits rollback and full session cleanup without requiring a success record', async () => {
  const end = deferred(), createReached = deferred(), rollback = new Error('Synthetic rollback');
  const Command = { create: async () => { createReached.resolve(); throw rollback; } };
  let ended = false, finished = false;
  const service = { execute: async () => {
    try { return await Command.create([{ state: 'succeeded', operationId: 'synthetic' }]); }
    finally { await end.promise; ended = true; }
  } };
  const execute = service.execute, create = Command.create;
  const run = withRecurringBarrier({ service, Command }, async () => { void service.execute().catch(() => {}); });
  const outcome = run.then(() => null, error => error).finally(() => { finished = true; });
  try {
    await createReached.promise;
    expect(finished).toBe(false); expect(ended).toBe(false);
    expect(service.execute).not.toBe(execute); expect(Command.create).not.toBe(create);
  } finally { end.resolve(); await outcome; }
  expect(await outcome).toBe(rollback); expect(ended).toBe(true);
  expect(service.execute).toBe(execute); expect(Command.create).toBe(create);
});

test('recurring barrier preserves body and execution failures and waits even before the insert hook is reached', async () => {
  const entered = deferred(), end = deferred(), primary = new Error('Synthetic assertion'), rollback = new Error('Synthetic pre-insert rollback');
  const create = jest.fn(), Command = { create };
  const service = { execute: async () => { entered.resolve(); await end.promise; throw rollback; } };
  const execute = service.execute; let finished = false;
  const run = withRecurringBarrier({ service, Command }, async state => {
    void service.execute().catch(() => {}); await entered.promise;
    expect(state.entered).toBe(false); throw primary;
  });
  const outcome = run.then(() => null, error => error).finally(() => { finished = true; });
  try {
    await entered.promise; await Promise.resolve();
    expect(finished).toBe(false); expect(create).not.toHaveBeenCalled();
  } finally { end.resolve(); await outcome; }
  expect(await outcome).toBeInstanceOf(AggregateError);
  expect((await outcome).errors).toEqual([primary, rollback]); expect(service.execute).toBe(execute);
});

test('recurring barrier lawful success returns the body result only after full execution cleanup', async () => {
  const end = deferred(), created = deferred(), Command = { create: async () => { created.resolve(); return 'record'; } };
  const service = { execute: async () => { const value = await Command.create([{ state: 'succeeded', operationId: 'synthetic' }]); await end.promise; return value; } };
  let finished = false;
  const run = withRecurringBarrier({ service, Command }, async () => { void service.execute(); return 'body'; });
  const outcome = run.finally(() => { finished = true; });
  try { await created.promise; expect(finished).toBe(false); }
  finally { end.resolve(); await outcome; }
  expect(await outcome).toBe('body');
});
