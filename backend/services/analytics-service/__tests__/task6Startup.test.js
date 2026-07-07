process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const express = require('express');
const request = require('supertest');

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockListen = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  actual.connect = mockConnect;
  return actual;
});
jest.mock('socket.io', () => jest.fn(() => ({ on: jest.fn() })), { virtual: true });
jest.mock('../../../common/config/logger', () => ({ createLogger: jest.fn(() => mockLogger) }));

describe('analytics-service Task 6 startup contract', () => {
  test('TC-T6-REG-001 mounts injected Task 6 routers without import-time IO', async () => {
    const appModule = jest.requireActual('../app');
    const familyMistakesRouter = express.Router();
    const weeklyReportsRouter = express.Router();
    familyMistakesRouter.get('/probe', (req, res) => res.json({ ok: 'mistakes' }));
    weeklyReportsRouter.get('/probe', (req, res) => res.json({ ok: 'reports' }));

    const app = appModule.createApp({
      logger: mockLogger,
      familyMistakesRouter,
      weeklyReportsRouter
    });

    await request(app).get('/api/mistakes/probe').expect(200, { ok: 'mistakes' });
    await request(app).get('/api/reports/weekly/probe').expect(200, { ok: 'reports' });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockListen).not.toHaveBeenCalled();
  });

  test('actual app factory constructs without database, socket, or listener startup', () => {
    const appModule = jest.requireActual('../app');

    expect(appModule.createApp).toEqual(expect.any(Function));
    expect(appModule.createApp({ logger: mockLogger })).toEqual(expect.objectContaining({ listen: expect.any(Function) }));
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockListen).not.toHaveBeenCalled();
  });

  test('TC-T6-REG-001 importing analytics server has no startup side effects', () => {
    const serverModule = require('../server');

    expect(serverModule.createApp).toEqual(expect.any(Function));
    expect(serverModule.connectDatabase).toEqual(expect.any(Function));
    expect(serverModule.startServer).toEqual(expect.any(Function));
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockListen).not.toHaveBeenCalled();
  });

  test('rejects standalone MongoDB before listening', async () => {
    const serverModule = require('../server');
    const connection = {
      db: {
        admin: () => ({
          command: async () => ({ isWritablePrimary: true, maxWireVersion: 13 })
        })
      }
    };

    await expect(serverModule.assertTransactionCapability(connection))
      .rejects.toThrow('transaction-capable writable replica-set primary');
  });
});
