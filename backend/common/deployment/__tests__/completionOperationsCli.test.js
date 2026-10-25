const { runCompletionOperations } = require('../../../../scripts/completion-operations');

test.each([
  [], ['check', 'unknown', '--writes-paused'], ['cleanup', 'homework', '--writes-paused', '--execute'],
  ['check', 'homework'], ['check', 'resource', '--writes-paused', '--execute'],
  ['cleanup', 'resource', '--writes-paused'], ['cleanup', 'resource', '--writes-paused', '--execute', '--limit=0'],
  ['check', 'homework', '--writes-paused', '--unknown']
].map(args => [args]))('invalid CLI invocation %j never connects', async args => {
  const connect = jest.fn();
  const result = await runCompletionOperations({ args, env: { MONGO_URI: 'synthetic-unused' }, connect });
  expect(result).toEqual({ success: false, code: 'INVALID_OPERATIONS_ARGUMENTS' });
  expect(connect).not.toHaveBeenCalled();
});
test('connection failures close partial connections and never expose URI or stack', async () => {
  const disconnect = jest.fn().mockResolvedValue();
  const result = await runCompletionOperations({ args: ['check', 'homework', '--writes-paused'],
    env: { MONGO_URI: 'mongodb://private-secret' },
    connect: async () => { throw Error('mongodb://private-secret'); }, disconnect });
  expect(result).toEqual({ success: false, code: 'COMPLETION_OPERATIONS_FAILED' });
  expect(disconnect).toHaveBeenCalledTimes(1);
});
test('missing URI fails without connecting or falling back to a default database', async () => {
  const connect = jest.fn();
  expect(await runCompletionOperations({ args: ['check', 'homework', '--writes-paused'], env: {}, connect }))
    .toEqual({ success: false, code: 'COMPLETION_CONFIGURATION_REQUIRED' });
  expect(connect).not.toHaveBeenCalled();
});
test('disconnect failure is not reported as successful readiness', async () => {
  const result = await runCompletionOperations({ args: ['check', 'homework', '--writes-paused'],
    env: { MONGO_URI: 'synthetic-unused' }, connect: async () => { throw Error('private-secret'); },
    disconnect: async () => { throw Error('private-secret-close'); } });
  expect(result).toEqual({ success: false, code: 'COMPLETION_DISCONNECT_FAILED' });
});
test('cold import does not load mongoose, models, servers or protocol writers', () => {
  const { spawnSync } = require('child_process');
  const file = require.resolve('../../../../scripts/completion-operations');
  const script = `const Module=require('module'),load=Module._load;Module._load=function(request,parent){
    const file=Module._resolveFilename(request,parent);if(request==='mongoose'||/models|server.js|completionMediaCleanupService/.test(file))throw Error('forbidden import');
    return load.apply(this,arguments);};require(${JSON.stringify(file)});`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
});
test.each([
  ['orphan-cleanup', '--writes-paused'], ['orphan-cleanup', '--apply'],
  ['orphan-cleanup', '--writes-paused', '--apply', '--limit=101'],
  ['orphan-cleanup', '--writes-paused', '--apply', '--limit', '0'],
  ['orphan-inventory', '--writes-paused', '--apply']
])('T2-G-008 invalid retirement CLI %j never connects', async (...args) => {
  const connect = jest.fn();
  expect(await runCompletionOperations({ args, env: { MONGO_URI: 'synthetic-unused' }, connect }))
    .toEqual({ success: false, code: 'INVALID_OPERATIONS_ARGUMENTS' });
  expect(connect).not.toHaveBeenCalled();
});
test.each([['orphan-cleanup', '--writes-paused', '--apply'],
  ['orphan-cleanup', 'resource', '--writes-paused', '--apply', '--limit', '50'],
  ['orphan-inventory', '--writes-paused']])('T2-G-008 valid retirement CLI %j is parsed and closes failed connections', async (...args) => {
  const disconnect = jest.fn(); const connect = jest.fn(async () => { throw Error('synthetic secret'); });
  expect(await runCompletionOperations({ args, env: { MONGO_URI: 'synthetic-unused' }, connect, disconnect }))
    .toEqual({ success: false, code: 'COMPLETION_OPERATIONS_FAILED' });
  expect(connect).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1);
});
