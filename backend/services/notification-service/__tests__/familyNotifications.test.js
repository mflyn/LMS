const express = require('express');
const request = require('supertest');

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('Task 7 family notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-T7-REG-001 createApp mounts injected routes without opening external resources', async () => {
    const { createApp } = require('../app');
    const familyNotificationsRouter = express.Router();
    familyNotificationsRouter.get('/probe', (req, res) => res.json({ ok: true }));

    const app = createApp({ familyNotificationsRouter, logger: silentLogger });

    await request(app)
      .get('/api/notifications/family/probe')
      .expect(200, { ok: true });
  });

  test('TC-T7-REG-001 importing server does not connect or listen before startServer', () => {
    jest.isolateModules(() => {
      const connect = jest.fn(() => Promise.resolve());
      const listen = jest.fn();
      const createServer = jest.fn(() => ({ listen }));
      const socketServer = jest.fn(() => ({ on: jest.fn() }));
      const amqpConnect = jest.fn(() => Promise.resolve());

      jest.doMock('mongoose', () => ({
        connect
      }));
      jest.doMock('http', () => ({
        createServer
      }));
      jest.doMock('socket.io', () => socketServer, { virtual: true });
      jest.doMock('amqplib', () => ({
        connect: amqpConnect
      }));
      jest.doMock('../routes', () => express.Router());

      const serverModule = require('../server');

      expect(serverModule.startServer).toEqual(expect.any(Function));
      expect(connect).not.toHaveBeenCalled();
      expect(amqpConnect).not.toHaveBeenCalled();
      expect(listen).not.toHaveBeenCalled();
    });
  });
});
