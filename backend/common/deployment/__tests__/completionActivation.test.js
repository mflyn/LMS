const { EventEmitter } = require('events');
const express = require('express');
const { createHttpTestHarness } = require('../../test/httpTestHarness');
const { createIdentityHeaders } = require('../../middleware/gatewayIdentity');
const { request, close } = createHttpTestHarness();
const TOKEN = 'synthetic-activation-service-token-32chars';
const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
const servers = {
  homework: require('../../../services/homework-service/server'),
  resource: require('../../../services/resource-service/server')
};
afterEach(async () => { await close(); jest.restoreAllMocks(); });

const fixture = () => {
  const connection = { readyState: 0, db: { collection: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue(null) })) },
    close: jest.fn().mockResolvedValue() };
  const listener = new EventEmitter();
  listener.listening = false;
  listener.address = () => ({ port: 1234 });
  listener.close = jest.fn(callback => { listener.listening = false; callback(); });
  const app = { locals: {}, listen: jest.fn((port, host, callback) => {
    if (typeof host === 'function') callback = host;
    queueMicrotask(() => { listener.listening = true; callback(); });
    return listener;
  }) };
  const options = { app, connection, env: {}, port: 0, host: '127.0.0.1',
    connect: jest.fn(async () => { connection.readyState = 1; return connection; }),
    validateEnvironment: jest.fn(), initializeQueue: jest.fn().mockResolvedValue(), appLogger: logger };
  return { options, app, connection, listener };
};

describe.each(Object.keys(servers))('%s activation lifecycle', service => {
  const server = servers[service];
  test.each(['', 'Enabled', 'unknown', true])('rejects invalid mode %p before connecting', async mode => {
    const { options, app } = fixture(); options.env.COMPLETION_PROTOCOL_MODE = mode;
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'INVALID_COMPLETION_MODE' });
    expect(options.connect).not.toHaveBeenCalled(); expect(app.listen).not.toHaveBeenCalled();
  });
  test('legacy scans before listening, keeps external connections on successful startup', async () => {
    const { options, app, connection, listener } = fixture();
    connection.readyState = 1;
    expect(await server.startServer(options)).toBe(listener);
    expect(connection.db.collection).toHaveBeenCalled(); expect(app.listen).toHaveBeenCalledTimes(1);
    expect(connection.close).not.toHaveBeenCalled();
    listener.close(() => {});
  });
  test('legacy refuses persisted completion state even with an injected app', async () => {
    const { options, connection, app } = fixture();
    connection.db.collection.mockReturnValue({ findOne: jest.fn().mockResolvedValue({ _id: 'private-identity' }) });
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_LEGACY_UNSAFE' });
    expect(app.listen).not.toHaveBeenCalled(); expect(connection.close).toHaveBeenCalledTimes(1);
  });
  test('unknown database result fails closed with sanitized error and closes owned connection', async () => {
    const { options, connection, app } = fixture();
    connection.db.collection.mockImplementation(() => { throw Error('mongodb://private-secret'); });
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_PROTOCOL_NOT_READY',
      message: 'COMPLETION_PROTOCOL_NOT_READY' });
    expect(app.listen).not.toHaveBeenCalled(); expect(connection.close).toHaveBeenCalledTimes(1);
  });
  test('connect failure closes partial owned connection but never an external connection', async () => {
    for (const readyState of [0, 1]) {
      const { options, connection, app } = fixture(); connection.readyState = readyState;
      options.connect.mockRejectedValue(Error('mongodb://private-secret'));
      await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED', message: 'COMPLETION_STARTUP_FAILED' });
      expect(connection.close).toHaveBeenCalledTimes(readyState === 0 ? 1 : 0);
      expect(app.listen).not.toHaveBeenCalled();
    }
  });
  test('enabled requires actual paused declaration before any connect, injected app cannot bypass', async () => {
    const { options, app } = fixture(); options.env.COMPLETION_PROTOCOL_MODE = 'enabled';
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_WRITES_NOT_PAUSED' });
    expect(options.connect).not.toHaveBeenCalled(); expect(app.listen).not.toHaveBeenCalled();
  });
  test('enabled requires an explicit database URI before connecting', async () => {
    const { options, app } = fixture();
    options.env = { COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true' };
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_CONFIGURATION_REQUIRED' });
    expect(options.connect).not.toHaveBeenCalled(); expect(app.listen).not.toHaveBeenCalled();
  });
  test('invalid media credentials are rejected before database connection', async () => {
    const { options, app } = fixture();
    options.validateEnvironment = undefined;
    options.env = { INTERNAL_SERVICE_TOKEN: TOKEN, PROGRESS_SERVICE_URL: 'http://synthetic-progress:3002',
      RESOURCE_SERVICE_URL: 'http://synthetic-resource:3005', MEDIA_REFERENCE_SERVICE_TOKEN: 'short',
      MEDIA_SECURITY_PROFILE: 'trusted-local', PRIVATE_MEDIA_ROOT: '/tmp/synthetic-unused',
      MEDIA_SIGNING_SECRET: TOKEN };
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
    expect(options.connect).not.toHaveBeenCalled(); expect(app.listen).not.toHaveBeenCalled();
  });
  test('real occupied loopback port rejects and releases only acquired startup resources', async () => {
    const { options, connection } = fixture();
    const blocker = await new Promise(resolve => {
      const value = require('http').createServer().listen(0, '127.0.0.1', () => resolve(value));
    });
    const app = express(), listen = jest.spyOn(app, 'listen');
    const queue = { connection: { close: jest.fn().mockResolvedValue() } };
    options.initializeQueue.mockImplementation(async ({ app: runtime }) => { runtime.locals.mq = queue; });
    try {
      await expect(server.startServer({ ...options, app, port: blocker.address().port }))
        .rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED', message: 'COMPLETION_STARTUP_FAILED' });
      expect(listen.mock.results[0].value.listening).toBe(false);
      expect(blocker.listening).toBe(true);
      expect(connection.close).toHaveBeenCalledTimes(1);
      expect(queue.connection.close).toHaveBeenCalledTimes(service === 'homework' ? 1 : 0);
    } finally { await new Promise(resolve => blocker.close(resolve)); }
  });
  test('enabled invokes only its service precheck but cannot listen before later assembly batches', async () => {
    const { options, connection, app } = fixture();
    options.env = { COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true', MONGO_URI: 'mongodb://synthetic-unused' };
    const module = service === 'homework'
      ? require('../../../services/homework-service/services/growthTaskCompletionReadiness')
      : require('../../../services/resource-service/services/completionOperations');
    const check = jest.spyOn(module, service === 'homework' ? 'assertGrowthTaskCompletionReadiness' : 'checkCompletionOperations')
      .mockResolvedValue({ ready: true });
    const guardCheck = service === 'homework' ? jest.spyOn(
      require('../../../services/homework-service/services/completionMediaGuardReadiness'), 'assertCompletionMediaGuardReadiness')
      .mockResolvedValue({ ready: true }) : null;
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_ASSEMBLY_NOT_READY' });
    expect(check).toHaveBeenCalledWith(expect.objectContaining({ connection, writesPaused: true }));
    if (guardCheck) expect(guardCheck).toHaveBeenCalledWith(expect.objectContaining({ connection, writesPaused: true }));
    expect(app.listen).not.toHaveBeenCalled(); expect(connection.close).toHaveBeenCalledTimes(1);
  });
  test('production factory also rejects enabled rather than constructing legacy writers', () => {
    const factory = jest.fn();
    expect(() => server.createProductionApp({ env: { COMPLETION_PROTOCOL_MODE: 'enabled' }, createMediaDependencies: factory }))
      .toThrow('COMPLETION_ASSEMBLY_NOT_READY');
    expect(factory).not.toHaveBeenCalled();
  });
  test('enabled rejects a custom startup factory before connection or precheck', async () => {
    const { options } = fixture();
    options.env = { COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true', MONGO_URI: 'mongodb://synthetic-unused' };
    const module = service === 'homework'
      ? require('../../../services/homework-service/services/growthTaskCompletionReadiness')
      : require('../../../services/resource-service/services/completionOperations');
    const check = jest.spyOn(module, service === 'homework' ? 'assertGrowthTaskCompletionReadiness' : 'checkCompletionOperations')
      .mockResolvedValue({ ready: true });
    const factory = jest.fn(() => express());
    await expect(server.startServer({ ...options, app: null, createRuntimeApp: factory }))
      .rejects.toMatchObject({ code: 'COMPLETION_ASSEMBLY_NOT_READY' });
    expect(factory).not.toHaveBeenCalled(); expect(options.connect).not.toHaveBeenCalled(); expect(check).not.toHaveBeenCalled();
  });
  test('production factory rejects a connection not owned by its models', () => {
    const factory = jest.fn();
    expect(() => server.createProductionApp({ connection: fixture().connection, env: {}, createMediaDependencies: factory }))
      .toThrow('COMPLETION_CONNECTION_MISMATCH');
    expect(factory).not.toHaveBeenCalled();
  });
  test('listener error rejects and closes owned database and queue', async () => {
    const { options, app, connection, listener } = fixture();
    const queue = { channel: { close: jest.fn().mockResolvedValue() }, connection: { close: jest.fn().mockResolvedValue() } };
    options.initializeQueue.mockImplementation(async ({ app: runtime }) => { runtime.locals.mq = queue; return queue; });
    app.listen.mockImplementation(() => { queueMicrotask(() => listener.emit('error', Error('private-bind-detail'))); return listener; });
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
    expect(connection.close).toHaveBeenCalledTimes(1);
    if (service === 'homework') {
      expect(queue.channel.close).toHaveBeenCalledTimes(1); expect(queue.connection.close).toHaveBeenCalledTimes(1);
    }
  });
  test('failure after listen closes the real acquired listener before the database', async () => {
    const { options, connection, listener } = fixture();
    options.appLogger = { info: () => { throw Error('private-log-detail'); } };
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
    expect(listener.close).toHaveBeenCalledTimes(1); expect(listener.listening).toBe(false);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });
  test('database cleanup failure replaces the startup error without exposing either detail', async () => {
    const { options, connection } = fixture();
    options.connect.mockRejectedValue(Error('private-connect'));
    connection.close.mockRejectedValue(Error('private-close'));
    await expect(server.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_CLEANUP_FAILED',
      message: 'COMPLETION_STARTUP_CLEANUP_FAILED' });
  });
  test('connection setup disables automatic DDL and uses the supplied connection', async () => {
    const foreign = { readyState: 0, openUri: jest.fn().mockResolvedValue() };
    const mongooseInstance = { connection: { readyState: 0 }, connect: jest.fn() };
    expect(await server.connectDatabase({ connection: foreign, mongooseInstance, mongoURI: 'mongodb://synthetic-only' })).toBe(foreign);
    expect(foreign.openUri).toHaveBeenCalledWith('mongodb://synthetic-only', expect.objectContaining({ autoIndex: false, autoCreate: false }));
    expect(mongooseInstance.connect).not.toHaveBeenCalled();
    await server.connectDatabase({ mongooseInstance, mongoURI: 'mongodb://synthetic-default' });
    expect(mongooseInstance.connect).toHaveBeenCalledWith('mongodb://synthetic-default', expect.objectContaining({ autoIndex: false, autoCreate: false }));
  });
});

test('queue initialization failure attempts channel and connection cleanup before database cleanup', async () => {
  const { options, connection, app } = fixture(), order = [];
  const queue = { channel: { close: jest.fn(async () => { order.push('channel'); throw Error('private-channel'); }) },
    connection: { close: jest.fn(async () => { order.push('queue'); }) } };
  connection.close.mockImplementation(async () => { order.push('database'); });
  options.initializeQueue.mockImplementation(async ({ app: runtime }) => { runtime.locals.mq = queue; throw Error('private-init'); });
  await expect(servers.homework.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_CLEANUP_FAILED' });
  expect(order).toEqual(['channel', 'queue', 'database']); expect(app.listen).not.toHaveBeenCalled();
});
test.each(['createChannel', 'assertExchange'])('partial RabbitMQ %s failure closes acquired resources', async phase => {
  const channel = { assertExchange: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  if (phase === 'createChannel') connection.createChannel.mockRejectedValue(Error('private-amqp'));
  else channel.assertExchange.mockRejectedValue(Error('private-amqp'));
  await expect(servers.homework.connectRabbitMQ({ amqpClient: { connect: async () => connection }, appLogger: logger })).rejects.toThrow();
  expect(connection.close).toHaveBeenCalledTimes(1);
  expect(channel.close).toHaveBeenCalledTimes(phase === 'createChannel' ? 0 : 1);
});
test('external queue and connection survive an injected initializer failure', async () => {
  const { options, connection, app } = fixture(); connection.readyState = 1;
  const queue = { connection: { close: jest.fn() }, channel: { close: jest.fn() } }; app.locals.mq = queue;
  options.initializeQueue.mockRejectedValue(Error('private-init'));
  await expect(servers.homework.startServer(options)).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
  expect(queue.connection.close).not.toHaveBeenCalled(); expect(queue.channel.close).not.toHaveBeenCalled();
  expect(connection.close).not.toHaveBeenCalled(); expect(app.listen).not.toHaveBeenCalled();
});

test('partial RabbitMQ cleanup failure keeps its fixed code through startup and still closes database', async () => {
  const { options, connection, app } = fixture();
  const queue = { createChannel: jest.fn().mockRejectedValue(Error('private-initialize')),
    close: jest.fn().mockRejectedValue(Error('private-close')) };
  jest.spyOn(require('amqplib'), 'connect').mockResolvedValue(queue);
  options.initializeQueue = undefined;
  options.env = { ENABLE_RABBITMQ: 'true', NODE_ENV: 'production' };
  await expect(servers.homework.startServer(options)).rejects.toMatchObject({
    code: 'COMPLETION_STARTUP_CLEANUP_FAILED', message: 'COMPLETION_STARTUP_CLEANUP_FAILED' });
  expect(queue.close).toHaveBeenCalledTimes(1); expect(connection.close).toHaveBeenCalledTimes(1);
  expect(app.listen).not.toHaveBeenCalled();
});

test.each(['homework', 'resource'])('%s maintenance blocks injected handler and preserves identity checks', async service => {
  const inner = express(), reached = jest.fn();
  inner.use((req, res) => { reached(); res.json({ legacy: true }); });
  const env = { COMPLETION_PROTOCOL_MODE: 'maintenance', MEDIA_REFERENCE_SERVICE_TOKEN: TOKEN };
  // Production factory must apply guards even with injected dependencies.
  const app = servers[service].createProductionApp({ env, growthTaskRouterFactory: () => inner,
    createMediaDependencies: () => ({ mediaRouter: inner, internalMediaRouter: inner }) });
  const url = service === 'homework' ? '/api/growth-tasks' : '/api/media';
  expect((await (await request(app)).get(url)).status).toBe(401);
  const headers = createIdentityHeaders({ method: 'GET', originalUrl: url,
    user: { id: 'a'.repeat(24), role: 'parent' }, secret: process.env.GATEWAY_IDENTITY_SECRET });
  const response = await (await request(app)).get(url).set(headers);
  expect(response.status).toBe(503); expect(response.body.error.code).toBe('COMPLETION_MAINTENANCE');
  if (service === 'resource') {
    expect((await (await request(app)).get('/api/media/id/content?signature=private')).status).toBe(503);
    expect((await (await request(app)).post('/api/internal/media/references/commit')).status).toBe(401);
    expect((await (await request(app)).post('/api/internal/media/references/commit').set('x-service-token', TOKEN)).status).toBe(503);
  }
  expect(reached).not.toHaveBeenCalled();
});

test('maintenance startup shares initialized runtime locals with unblocked legacy routes', async () => {
  const { options } = fixture();
  const app = express(), reached = jest.fn(), queue = { exchange: 'synthetic-only' };
  app.get('/api/homework', (req, res) => res.json({ exchange: req.app.locals.mq?.exchange }));
  app.use('/api/growth-tasks', (req, res) => { reached(); res.sendStatus(200); });
  options.initializeQueue.mockImplementation(async ({ app: runtime }) => { runtime.locals.mq = queue; });
  const listener = await servers.homework.startServer({ ...options, app,
    env: { COMPLETION_PROTOCOL_MODE: 'maintenance' } });
  try {
    const client = require('supertest')(listener);
    expect((await client.get('/api/homework')).body).toEqual({ exchange: 'synthetic-only' });
    const health = await client.get('/health');
    expect(health.body.completion).toEqual({ mode: 'maintenance', ready: false });
    const url = '/api/growth-tasks';
    const headers = createIdentityHeaders({ method: 'GET', originalUrl: url,
      user: { id: 'a'.repeat(24), role: 'parent' }, secret: process.env.GATEWAY_IDENTITY_SECRET });
    expect((await client.get(url).set(headers)).status).toBe(503);
    expect(reached).not.toHaveBeenCalled();
  } finally { await new Promise(resolve => listener.close(resolve)); }
});
