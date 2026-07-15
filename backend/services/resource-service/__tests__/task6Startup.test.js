process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const express = require('express');
const request = require('supertest');

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockListen = jest.fn((port, callback) => {
  if (callback) callback();
  return { close: jest.fn() };
});
const mockLogger = { info: jest.fn(), error: jest.fn() };
const mockApp = { listen: mockListen, locals: { logger: mockLogger } };
mockApp.createApp = () => mockApp;

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  actual.connect = mockConnect;
  return actual;
});
jest.mock('../../../common/config/logger', () => ({ createLogger: () => mockLogger }));
jest.mock('../../../common/middleware/errorHandler', () => ({
  AppError: class AppError extends Error {},
  catchAsync: (handler) => handler,
  errorHandler: jest.fn((error, req, res, next) => next(error)),
  requestTracker: (req, res, next) => next(),
  requestTimeout: () => (req, res, next) => next()
}));
jest.mock('../app', () => mockApp);

describe('resource-service Task 6 startup contract', () => {
  test('actual app factory constructs without database or listener startup', () => {
    const appModule = jest.requireActual('../app');
    const FamilyUser = jest.requireActual('../models/FamilyUser');
    const actualApp = appModule.createApp({ logger: mockLogger });

    expect(appModule.createApp).toEqual(expect.any(Function));
    expect(actualApp).toEqual(expect.objectContaining({ listen: expect.any(Function) }));
    expect(actualApp.locals.userModel).toBe(FamilyUser);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockListen).not.toHaveBeenCalled();
  });

  test('media router can be injected without database or listener startup', async () => {
    const appModule = jest.requireActual('../app');
    const mediaRouter = express.Router();
    mediaRouter.get('/probe', (req, res) => res.status(200).json({ mounted: true }));

    const actualApp = appModule.createApp({ logger: mockLogger, mediaRouter });
    const response = await request(actualApp).get('/api/media/probe');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockListen).not.toHaveBeenCalled();
  });

  test('internal media reference router can be injected without startup side effects', async () => {
    const appModule = jest.requireActual('../app');
    const internalMediaRouter = express.Router();
    internalMediaRouter.post('/probe', (req, res) => res.status(200).json({ internal: true }));

    const actualApp = appModule.createApp({ logger: mockLogger, internalMediaRouter });
    const response = await request(actualApp).post('/api/internal/media/references/probe');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ internal: true });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockListen).not.toHaveBeenCalled();
  });

  test('TC-MPA-SCAN-002 trusted-local health names the profile without contacting or claiming a scanner', async () => {
    const appModule = jest.requireActual('../app');
    const scanner = { ping: jest.fn(() => { throw new Error('must not be called'); }) };
    const actualApp = appModule.createApp({
      logger: mockLogger,
      mediaSecurity: { profile: 'trusted-local', scanner }
    });

    const response = await request(actualApp).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'resource-service',
      mediaSecurity: { profile: 'trusted-local' }
    });
    expect(scanner.ping).not.toHaveBeenCalled();
  });

  test('TC-MPA-SCAN-006/008 secure health fails closed without changing profile', async () => {
    const appModule = jest.requireActual('../app');
    const scanner = {
      ping: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('private scanner detail'))
    };
    const actualApp = appModule.createApp({
      logger: mockLogger,
      mediaSecurity: { profile: 'secure-production', scanner }
    });

    const healthy = await request(actualApp).get('/health');
    const unhealthy = await request(actualApp).get('/health');

    expect(healthy.status).toBe(200);
    expect(healthy.body.mediaSecurity).toEqual({
      profile: 'secure-production',
      scanner: 'healthy'
    });
    expect(unhealthy.status).toBe(503);
    expect(unhealthy.body).toEqual({
      status: 'unhealthy',
      service: 'resource-service',
      mediaSecurity: { profile: 'secure-production', scanner: 'unavailable' }
    });
    expect(JSON.stringify(unhealthy.body)).not.toContain('private scanner detail');
    expect(actualApp.locals.mediaSecurity.profile).toBe('secure-production');
  });

  test('TC-T6-REG-001 importing resource server has no startup side effects', () => {
    const serverModule = require('../server');

    expect(serverModule.createApp).toEqual(expect.any(Function));
    expect(serverModule.createProductionApp).toEqual(expect.any(Function));
    expect(serverModule.createTask6MediaDependencies).toEqual(expect.any(Function));
    expect(serverModule.connectDatabase).toEqual(expect.any(Function));
    expect(serverModule.startServer).toEqual(expect.any(Function));
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockListen).not.toHaveBeenCalled();
  });

  test('startServer connects before listening', async () => {
    const serverModule = require('../server');
    const order = [];
    const app = {
      listen: jest.fn((port, callback) => {
        order.push(`listen:${port}`);
        if (callback) callback();
        return { close: jest.fn() };
      })
    };

    await serverModule.startServer({
      app,
      port: 3005,
      connect: async () => order.push('connect')
    });

    expect(order).toEqual(['connect', 'listen:3005']);
  });

  test('TC-MPA-SCAN-006 secure startup connects, pings, then listens', async () => {
    const serverModule = require('../server');
    const order = [];
    const app = {
      locals: {
        mediaSecurity: {
          profile: 'secure-production',
          scanner: { ping: async () => order.push('ping') }
        }
      },
      listen: jest.fn((port, callback) => {
        order.push(`listen:${port}`);
        callback();
        return { close: jest.fn() };
      })
    };

    await serverModule.startServer({
      app,
      port: 3005,
      connect: async () => order.push('connect')
    });

    expect(order).toEqual(['connect', 'ping', 'listen:3005']);
  });

  test('TC-MPA-SCAN-006 secure startup does not listen after a failed scanner probe', async () => {
    const serverModule = require('../server');
    const scannerError = new Error('scanner unavailable');
    const app = {
      locals: {
        mediaSecurity: {
          profile: 'secure-production',
          scanner: { ping: jest.fn().mockRejectedValue(scannerError) }
        }
      },
      listen: jest.fn()
    };

    await expect(serverModule.startServer({
      app,
      connect: jest.fn().mockResolvedValue(undefined)
    })).rejects.toBe(scannerError);
    expect(app.listen).not.toHaveBeenCalled();
  });

  test('TC-MPA-SCAN-002 trusted dependency composition never constructs a scanner', () => {
    const serverModule = require('../server');
    const createScanner = jest.fn(() => { throw new Error('must not construct scanner'); });

    expect(() => serverModule.createTask6MediaDependencies({
      env: {
        NODE_ENV: 'development',
        PRIVATE_MEDIA_ROOT: '/tmp/resource-media-test',
        MEDIA_SIGNING_SECRET: 'test-media-signing-secret-at-least-32-characters',
        MEDIA_REFERENCE_SERVICE_TOKEN: 'test-media-reference-token-at-least-32-characters'
      },
      createScanner
    })).not.toThrow();
    expect(createScanner).not.toHaveBeenCalled();
  });

  test('default startServer path composes Task 6 media after connecting', async () => {
    const serverModule = require('../server');
    const order = [];
    const productionApp = {
      listen: jest.fn((port, callback) => {
        order.push(`listen:${port}`);
        callback();
        return { close: jest.fn() };
      })
    };

    await serverModule.startServer({
      port: 3005,
      connect: async () => order.push('connect'),
      createRuntimeApp: () => {
        order.push('media-app');
        return productionApp;
      }
    });

    expect(order).toEqual(['connect', 'media-app', 'listen:3005']);
  });
});
