process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'gateway-lifecycle-jwt-secret-at-least-32-chars';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gateway-lifecycle-test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'gateway-lifecycle-identity-secret-at-least-32-chars';

const express = require('express');
const request = require('supertest');

const serviceHosts = {
  user: 'http://127.0.0.1:31001',
  data: 'http://127.0.0.1:31002',
  progress: 'http://127.0.0.1:31003',
  notification: 'http://127.0.0.1:31004',
  resource: 'http://127.0.0.1:31005',
  analytics: 'http://127.0.0.1:31006',
  homework: 'http://127.0.0.1:31007'
};

describe('gateway server lifecycle', () => {
  test('exports an app factory without listening during import', () => {
    const listen = jest.spyOn(express.application, 'listen').mockReturnValue({ once: jest.fn() });
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined);

    let serverModule;
    jest.isolateModules(() => {
      serverModule = require('../server');
    });

    expect(serverModule).toEqual(expect.objectContaining({
      createApp: expect.any(Function),
      startServer: expect.any(Function)
    }));
    expect(listen).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  test('builds a healthy gateway from injected service hosts', async () => {
    const { createApp } = require('../server');
    const app = createApp({
      serviceHosts,
      jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'api-gateway' });
  });

  test('applies injected rate-limit options', async () => {
    const { createApp } = require('../server');
    const app = createApp({
      serviceHosts,
      jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
      rateLimitOptions: {
        windowMs: 60000,
        max: 1,
        standardHeaders: true,
        legacyHeaders: false
      }
    });

    await request(app).get('/health').expect(200);
    await request(app).get('/health').expect(429);
  });

  test('requires the user service but allows the legacy data service to be absent', () => {
    const { createApp } = require('../server');

    expect(() => createApp({
      serviceHosts: { ...serviceHosts, user: undefined },
      jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET
    })).toThrow('Missing gateway service host: user');

    expect(() => createApp({
      serviceHosts: { ...serviceHosts, data: undefined },
      jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
      enableLegacyDataProxy: false
    })).not.toThrow();
  });
});
