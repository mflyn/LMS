process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
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
mockApp.createApp = jest.fn(() => mockApp);

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  actual.connect = mockConnect;
  return actual;
});
jest.mock('../../../common/config/logger', () => ({ createLogger: jest.fn(() => mockLogger) }));
jest.mock('../../../common/middleware/errorHandler', () => ({
  AppError: class AppError extends Error {},
  catchAsync: (handler) => handler,
  errorHandler: jest.fn((error, req, res, next) => next(error)),
  requestTracker: jest.fn((req, res, next) => next())
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

  test('TC-T6-REG-001 importing resource server has no startup side effects', () => {
    const serverModule = require('../server');

    expect(serverModule.createApp).toEqual(expect.any(Function));
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
});
