process.env.JWT_SECRET = process.env.JWT_SECRET || 'synthetic-cleanup-jwt-secret-at-least32';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'synthetic-cleanup-gateway-secret32';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:1/synthetic-unused';

const mongoose = require('mongoose');
const net = require('net');
const http = require('http');
const { EventEmitter } = require('events');
const { Server: SocketServer } = require('socket.io');
const { startServer } = require('../server');
let uri;
const environment = () => ({ NODE_ENV: 'test', AI3_MODE: 'off', AI3_STORE_CONTINUOUS: 'true', AI2_STORE_CONTINUOUS: 'true',
  COMPLETION_PROTOCOL_MODE: 'enabled', AI3_EVIDENCE_TOKEN: 'synthetic-cleanup-evidence-token32', MONGO_URI: uri,
  HOMEWORK_SERVICE_URL: 'http://127.0.0.1:1', RESOURCE_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-cleanup-media-reference32' });
beforeAll(async () => {
  uri = mongoose.connection.getClient().s.url;
  for (const model of Object.values(mongoose.models)) await model.init();
});
afterEach(() => jest.restoreAllMocks());

test.each([true, false])('real EADDRINUSE cleans HTTP/Socket.IO and respects Mongo ownership=%s', async ownsConnection => {
  const blocker = net.createServer();
  await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve));
  const closeHttp = jest.spyOn(http.Server.prototype, 'close'), closeIo = jest.spyOn(SocketServer.prototype, 'close');
  try {
    if (ownsConnection) await mongoose.disconnect();
    await expect(startServer({ env: environment(), host: '127.0.0.1', port: blocker.address().port }))
      .rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(mongoose.connection.readyState).toBe(ownsConnection ? 0 : 1);
    expect(closeIo).toHaveBeenCalled(); expect(closeHttp).toHaveBeenCalled();
  } finally {
    closeIo.mockRestore(); closeHttp.mockRestore();
    await new Promise(resolve => blocker.close(resolve));
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  }
});
test.each(['http-factory', 'socket-factory', 'listen'])('startup %s failure releases every acquired resource', async stage => {
  const cause = new Error(`Synthetic ${stage} failure`), connection = { readyState: 0, close: jest.fn().mockResolvedValue() };
  const server = new EventEmitter(); server.close = jest.fn(done => done());
  server.listen = jest.fn(() => queueMicrotask(() => server.emit('error', cause)));
  const io = { close: jest.fn().mockResolvedValue() };
  await expect(startServer({ env: {}, connection, connect: jest.fn().mockResolvedValue(), createTask6Dependencies: () => ({}),
    createHttpServer: () => { if (stage === 'http-factory') throw cause; return server; },
    createIo: () => { if (stage === 'socket-factory') throw cause; return io; } })).rejects.toBe(cause);
  expect(connection.close).toHaveBeenCalledTimes(1);
  expect(server.close).toHaveBeenCalledTimes(stage === 'http-factory' ? 0 : 1);
  expect(io.close).toHaveBeenCalledTimes(stage === 'listen' ? 1 : 0);
});
test('cleanup failures cannot skip remaining resources or mask original listen error', async () => {
  const cause = Object.assign(new Error('Synthetic occupied port'), { code: 'EADDRINUSE' });
  const cleanupError = new Error('Synthetic cleanup failure');
  const connection = { readyState: 0, close: jest.fn().mockRejectedValue(cleanupError) };
  const server = new EventEmitter(); server.listen = jest.fn(() => queueMicrotask(() => server.emit('error', cause)));
  server.close = jest.fn(done => done(cleanupError));
  const io = { close: jest.fn().mockRejectedValue(cleanupError) };
  await expect(startServer({ env: {}, connection, connect: jest.fn().mockResolvedValue(), createTask6Dependencies: () => ({}),
    createHttpServer: () => server, createIo: () => io })).rejects.toBe(cause);
  expect(io.close).toHaveBeenCalledTimes(1); expect(server.close).toHaveBeenCalledTimes(1);
  expect(connection.close).toHaveBeenCalledTimes(1);
});
