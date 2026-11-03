const { indexSnapshot, createToolOwner, createHttpOwner } = require('../fixtures/localProductRestoreSupport');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test.each([null, Object.assign(Error('tool cancelled'), { code: 'ETIMEDOUT', signal: 'SIGKILL' })])(
  'final tool stop waits for delayed callback and records success or failure before report: %s', async error => {
    let callback, stopped = false; const child = { kill: jest.fn() }, record = jest.fn();
    const owner = createToolOwner({ execFile: jest.fn((...args) => { callback = args.at(-1); return child; }), record });
    const work = owner.run('/synthetic/tool', [], {}, 'restore');
    const done = owner.stop().then(() => { stopped = true; });
    await Promise.resolve(); expect(stopped).toBe(false); expect(record).not.toHaveBeenCalled();
    callback(error, 'out', 'err'); await work; await done;
    expect(record).toHaveBeenCalledWith('restore', expect.objectContaining({ error, stdout: 'out', stderr: 'err' }));
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    await expect(owner.run('/synthetic/tool', [], {}, 'late')).rejects.toThrow('DRILL_CANCELLED');
  });
test('record failure is not reported as successful tool cleanup', async () => {
  let callback; const owner = createToolOwner({ execFile: (...args) => { callback = args.at(-1); return { kill() {} }; },
    record: () => { throw Error('record failed'); } });
  const work = owner.run('/synthetic/tool', [], {}, 'restore').catch(error => error);
  const stopped = owner.stop().then(() => null, error => error);
  callback(null, '', ''); expect(await work).toHaveProperty('message', 'record failed');
  expect(await stopped).toHaveProperty('message', 'record failed');
});
test('concurrent final HTTP close waits for original listener close and cannot reopen', async () => {
  const hold = deferred(), harness = { request: jest.fn(), close: jest.fn().mockReturnValueOnce(hold.promise).mockResolvedValue() };
  const make = jest.fn(() => harness), owner = createHttpOwner(make);
  const first = owner.close(); let stopped = false;
  const final = owner.close({ final: true }).then(() => { stopped = true; });
  await Promise.resolve(); await Promise.resolve(); expect(stopped).toBe(false);
  expect(harness.close).toHaveBeenCalledTimes(1); hold.resolve(); await first; await final;
  expect(make).toHaveBeenCalledTimes(1); await expect(owner.request({})).rejects.toThrow('DRILL_CANCELLED');
});
test('failed listener close remains failed and never claims success on the next close', async () => {
  const make = jest.fn(() => ({ close: jest.fn().mockRejectedValueOnce(Error('close failed')).mockResolvedValue() }));
  const owner = createHttpOwner(make); await expect(owner.close()).rejects.toThrow('close failed');
  await expect(owner.close({ final: true })).rejects.toThrow('close failed'); expect(make).toHaveBeenCalledTimes(1);
});
test('successful non-final listener close permits a fresh owned harness', async () => {
  const make = jest.fn(() => ({ close: jest.fn().mockResolvedValue(), request: jest.fn().mockResolvedValue('request') }));
  const owner = createHttpOwner(make); await owner.close(); expect(make).toHaveBeenCalledTimes(2);
  await expect(owner.request({})).resolves.toBe('request'); await owner.close({ final: true });
});
test('index snapshot tolerates enumeration order only, preserving compound key order and options', () => {
  const indexes = [{ name: 'scope', key: { actorId: 1, operationId: 1 }, unique: true }, { name: '_id_', key: { _id: 1 } }];
  expect(indexSnapshot([...indexes].reverse())).toEqual(indexSnapshot(indexes));
  expect(indexSnapshot(indexes.slice(1))).not.toEqual(indexSnapshot(indexes));
  expect(indexSnapshot([{ ...indexes[0], unique: false }, indexes[1]])).not.toEqual(indexSnapshot(indexes));
  expect(indexSnapshot([{ ...indexes[0], key: { operationId: 1, actorId: 1 } }, indexes[1]])).not.toEqual(indexSnapshot(indexes));
});
