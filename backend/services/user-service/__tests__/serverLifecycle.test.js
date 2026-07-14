const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

describe('user-service server lifecycle', () => {
  test('exports lifecycle factories without connecting or listening during import', () => {
    const connect = jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose.connection);
    const listen = jest.spyOn(express.application, 'listen').mockReturnValue({ once: jest.fn() });
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined);

    let serverModule;
    jest.isolateModules(() => {
      serverModule = require('../server');
    });

    expect(serverModule).toEqual(expect.objectContaining({
      createApp: expect.any(Function),
      createProductionApp: expect.any(Function),
      createTask6MediaDependencies: expect.any(Function),
      connectDatabase: expect.any(Function),
      startServer: expect.any(Function)
    }));
    expect(connect).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  test('mounts an injected route set under the public api prefix', async () => {
    const routes = express.Router();
    routes.get('/lifecycle-probe', (req, res) => res.json({ success: true }));
    const { createApp } = require('../server');

    const response = await request(createApp({ routes })).get('/api/lifecycle-probe');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  test('default startServer path composes avatar media after connecting', async () => {
    const { startServer } = require('../server');
    const order = [];
    const runtimeApp = {
      listen: jest.fn((port, callback) => {
        order.push(`listen:${port}`);
        callback();
        return { address: () => ({ port }), once: jest.fn() };
      })
    };

    await startServer({
      port: 3001,
      connect: async () => order.push('connect'),
      createRuntimeApp: () => {
        order.push('media-app');
        return runtimeApp;
      },
      appLogger: { info: jest.fn() }
    });

    expect(order).toEqual(['connect', 'media-app', 'listen:3001']);
  });

  test('connectDatabase rejects standalone MongoDB before serving transactional routes', async () => {
    const { connectDatabase } = require('../server');
    const mongooseInstance = {
      connection: {
        readyState: 1,
        db: { admin: () => ({ command: async () => ({ isWritablePrimary: true, maxWireVersion: 13 }) }) }
      },
      connect: jest.fn()
    };

    await expect(connectDatabase({ mongooseInstance, mongoURI: 'mongodb://standalone/test' }))
      .rejects.toThrow('user-service requires a transaction-capable writable replica-set primary');
    expect(mongooseInstance.connect).not.toHaveBeenCalled();
  });
});
