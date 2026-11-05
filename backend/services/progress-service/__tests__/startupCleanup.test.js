const mongoose = require('mongoose');
const net = require('net');
const http = require('http');
const { EventEmitter } = require('events');
const { startServer } = require('../server');
let uri;
const environment = () => ({ NODE_ENV: 'test', AI3_MODE: 'off', AI3_STORE_CONTINUOUS: 'true', AI2_STORE_CONTINUOUS: 'true',
  COMPLETION_PROTOCOL_MODE: 'enabled', AI3_EVIDENCE_TOKEN: 'synthetic-cleanup-evidence-token32', MONGO_URI: uri,
  HOMEWORK_SERVICE_URL: 'http://127.0.0.1:1' });
beforeAll(async () => {
  uri = mongoose.connection.getClient().s.url;
  for (const model of Object.values(mongoose.models)) await model.init();
});
afterEach(() => jest.restoreAllMocks());

test.each([true, false])('real EADDRINUSE cleans HTTP and respects Mongo ownership=%s', async ownsConnection => {
  const blocker = net.createServer();
  await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve));
  const closeHttp = jest.spyOn(http.Server.prototype, 'close');
  try {
    if (ownsConnection) await mongoose.disconnect();
    await expect(startServer({ env: environment(), host: '127.0.0.1', port: blocker.address().port }))
      .rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(mongoose.connection.readyState).toBe(ownsConnection ? 0 : 1);
    expect(closeHttp).toHaveBeenCalled();
  } finally {
    closeHttp.mockRestore(); await new Promise(resolve => blocker.close(resolve));
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  }
});
test('a synchronous listen exception releases only the startup-owned Mongo connection', async () => {
  const cause = new Error('Synthetic synchronous listen failure');
  for (const readyState of [0, 1]) {
    const connection = { readyState, close: jest.fn().mockResolvedValue() };
    await expect(startServer({ env: {}, connection, connect: jest.fn().mockResolvedValue(),
      app: { locals: {}, listen: () => { throw cause; } } })).rejects.toBe(cause);
    expect(connection.close).toHaveBeenCalledTimes(readyState === 0 ? 1 : 0);
  }
});
test('HTTP and Mongo cleanup errors cannot mask the original listen error', async () => {
  const cause = Object.assign(new Error('Synthetic occupied port'), { code: 'EADDRINUSE' });
  const cleanupError = new Error('Synthetic cleanup failure');
  const connection = { readyState: 0, close: jest.fn().mockRejectedValue(cleanupError) };
  const server = new EventEmitter(); server.close = jest.fn(done => done(cleanupError));
  const app = { locals: {}, listen: jest.fn(() => { queueMicrotask(() => server.emit('error', cause)); return server; }) };
  await expect(startServer({ env: {}, connection, connect: jest.fn().mockResolvedValue(), app })).rejects.toBe(cause);
  expect(server.close).toHaveBeenCalledTimes(1); expect(connection.close).toHaveBeenCalledTimes(1);
});
