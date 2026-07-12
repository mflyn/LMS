const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { redactRuntimeError } = require('./testEnvironment');

const userServer = require('../../services/user-service/server');
const homeworkServer = require('../../services/homework-service/server');
const progressServer = require('../../services/progress-service/server');
const resourceApp = require('../../services/resource-service/app');
const analyticsApp = require('../../services/analytics-service/app');
const notificationApp = require('../../services/notification-service/app');
const gatewayServer = require('../../gateway/server');

const listen = (name, app) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => {
    resolve({ name, server, url: `http://127.0.0.1:${server.address().port}` });
  });
  server.once('error', reject);
});

const closeServer = (server) => new Promise((resolve, reject) => {
  if (!server || !server.listening) {
    resolve();
    return;
  }
  server.close((error) => (error ? reject(error) : resolve()));
});

const createFamilyRuntime = async () => {
  const state = {
    mongoServer: null,
    privateRoot: null,
    servers: [],
    stopped: false
  };

  const stop = async () => {
    if (state.stopped) return;
    state.stopped = true;

    const errors = [];
    for (const { server } of [...state.servers].reverse()) {
      try {
        await closeServer(server);
      } catch (error) {
        errors.push(error);
      }
    }
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch (error) {
        errors.push(error);
      }
    }
    if (state.mongoServer) {
      try {
        await state.mongoServer.stop();
      } catch (error) {
        errors.push(error);
      }
    }
    if (state.privateRoot) {
      try {
        await fs.rm(state.privateRoot, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Task 11 runtime teardown failed');
    }
  };

  try {
    state.mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    const mongoUri = state.mongoServer.getUri(`task11_${Date.now()}`);
    process.env.MONGO_URI = mongoUri;
    process.env.USER_SERVICE_MONGO_URI = mongoUri;
    await mongoose.connect(mongoUri);
    const mongoHello = await mongoose.connection.db.admin().command({ hello: 1 });

    state.privateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'family-growth-task11-'));
    await fs.chmod(state.privateRoot, 0o700);

    const serviceApps = [
      ['user-service', userServer.createApp()],
      ['homework-service', homeworkServer.createApp()],
      ['progress-service', progressServer.createApp()],
      ['resource-service', resourceApp.createApp()],
      ['analytics-service', analyticsApp.createApp()],
      ['notification-service', notificationApp.createApp()]
    ];
    for (const [name, app] of serviceApps) {
      state.servers.push(await listen(name, app));
    }

    const serviceUrl = (name) => state.servers.find((entry) => entry.name === name).url;
    const gatewayApp = gatewayServer.createApp({
      serviceHosts: {
        user: serviceUrl('user-service'),
        data: serviceUrl('user-service'),
        homework: serviceUrl('homework-service'),
        progress: serviceUrl('progress-service'),
        resource: serviceUrl('resource-service'),
        analytics: serviceUrl('analytics-service'),
        notification: serviceUrl('notification-service')
      },
      jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET
    });
    state.servers.push(await listen('api-gateway', gatewayApp));

    const urls = Object.fromEntries(state.servers.map(({ name, url }) => [name, url]));
    return {
      mongoHello,
      privateRoot: state.privateRoot,
      servers: state.servers,
      stop,
      urls,
      gatewayUrl: urls['api-gateway']
    };
  } catch (error) {
    await stop();
    throw redactRuntimeError(error, { privateRoot: state.privateRoot });
  }
};

module.exports = {
  createFamilyRuntime,
  listen
};
