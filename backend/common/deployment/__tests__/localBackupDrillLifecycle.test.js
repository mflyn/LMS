const { createLifecycle } = require('../fixtures/localBackupDrillLifecycle');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const fixture = () => {
  const instance = { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue(true), getUri: () => 'mongodb://127.0.0.1:40001/' };
  const client = { connect: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() };
  const makeInstance = jest.fn(() => instance), makeClient = jest.fn(() => client);
  return { instance, client, makeInstance, makeClient, life: createLifecycle({ makeInstance, makeClient }) };
};
test('false stop retains ownership, blocks next start, and allows final cleanup retry', async () => {
  const f = fixture(); await f.life.start({}); f.instance.stop.mockResolvedValueOnce(false);
  await expect(f.life.stop()).rejects.toThrow('INSTANCE_STOP_FAILED');
  await expect(f.life.start({})).rejects.toThrow('INSTANCE_STILL_OWNED');
  expect(f.makeInstance).toHaveBeenCalledTimes(1);
  await f.life.stop({ final: true }); expect(f.instance.stop).toHaveBeenCalledTimes(2);
});
test('cleanup waits for delayed startup and forbids connecting after cancellation', async () => {
  const f = fixture(), hold = deferred(); f.instance.start.mockReturnValue(hold.promise);
  const started = f.life.start({}).then(value => ({ value }), error => ({ error }));
  let finished = false; const cleanup = f.life.stop({ final: true }).then(() => { finished = true; });
  await Promise.resolve(); expect(finished).toBe(false); expect(f.instance.stop).not.toHaveBeenCalled();
  hold.resolve(); expect(await started).toHaveProperty('error.message', 'DRILL_CANCELLED'); await cleanup;
  expect(f.makeClient).not.toHaveBeenCalled(); expect(f.instance.stop).toHaveBeenCalledTimes(1);
  expect(() => f.life.assertActive()).toThrow('DRILL_CANCELLED');
  await expect(f.life.start({})).rejects.toThrow('DRILL_CANCELLED');
});
test('cleanup during connection waits, closes the client and rejects late continuation', async () => {
  const f = fixture(), hold = deferred(); f.client.connect.mockReturnValue(hold.promise);
  const started = f.life.start({}).then(value => ({ value }), error => ({ error }));
  await Promise.resolve(); expect(f.client.connect).toHaveBeenCalledTimes(1);
  const cleanup = f.life.stop({ final: true }); hold.resolve(); expect(await started).toHaveProperty('error.message', 'DRILL_CANCELLED'); await cleanup;
  expect(f.client.close).toHaveBeenCalledTimes(1); expect(f.instance.stop).toHaveBeenCalledTimes(1);
});
test('failed startup remains owned and is stopped by cleanup', async () => {
  const f = fixture(); f.instance.start.mockRejectedValue(Error('startup failure'));
  await expect(f.life.start({})).rejects.toThrow('startup failure'); await f.life.stop({ final: true });
  expect(f.instance.stop).toHaveBeenCalledTimes(1); expect(f.makeClient).not.toHaveBeenCalled();
});
test('client close rejection cannot prevent instance stop or become success', async () => {
  const f = fixture(); await f.life.start({}); f.client.close.mockRejectedValue(Error('close failure'));
  await expect(f.life.stop({ final: true })).rejects.toThrow('close failure'); expect(f.instance.stop).toHaveBeenCalledTimes(1);
});
test('stop rejection blocks next start and is retried only on the same owned instance', async () => {
  const f = fixture(); await f.life.start({}); f.instance.stop.mockRejectedValueOnce(Error('stop failure'));
  await expect(f.life.stop()).rejects.toThrow('stop failure'); await expect(f.life.start({})).rejects.toThrow('INSTANCE_STILL_OWNED');
  await f.life.stop({ final: true }); expect(f.makeInstance).toHaveBeenCalledTimes(1);
});
test('successful sequential lifecycle never cleans retained files', async () => {
  const f = fixture(); await f.life.start({}); await f.life.stop(); await f.life.start({}); await f.life.stop({ final: true });
  expect(f.instance.stop).toHaveBeenCalledTimes(2);
  expect(f.instance.stop).toHaveBeenCalledWith({ doCleanup: false, force: false });
});
