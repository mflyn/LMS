const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

describe('homework-service server lifecycle', () => {
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

  test('mounts an injected growth task router', async () => {
    const growthTaskRouter = express.Router();
    growthTaskRouter.get('/lifecycle-probe', (req, res) => res.json({ success: true }));
    const { createApp } = require('../server');

    const response = await request(createApp({ growthTaskRouter })).get('/api/growth-tasks/lifecycle-probe');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  test('default startServer path composes attachment media after connecting', async () => {
    const { startServer } = require('../server');
    const order = [];
    const runtimeApp = {
      locals: {},
      listen: jest.fn((port, callback) => {
        order.push(`listen:${port}`);
        callback();
        return { address: () => ({ port }), once: jest.fn(), close: jest.fn() };
      })
    };

    await startServer({
      port: 3003,
      connect: async () => order.push('connect'),
      createRuntimeApp: () => {
        order.push('media-app');
        return runtimeApp;
      },
      initializeQueue: async () => order.push('queue'),
      validateEnvironment: () => order.push('validate'),
      appLogger: { info: jest.fn() }
    });

    expect(order).toEqual(['validate', 'connect', 'media-app', 'listen:3003', 'queue']);
  });

  test('ENABLE_RABBITMQ=false disables the optional broker in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousEnableRabbit = process.env.ENABLE_RABBITMQ;
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_RABBITMQ = 'false';
    const { initializeMessageQueue } = require('../server');
    const connect = jest.fn();
    const app = { locals: {} };

    try {
      const queue = await initializeMessageQueue({ app, connect });
      expect(connect).not.toHaveBeenCalled();
      expect(queue.exchange).toBe('homework.events');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousEnableRabbit === undefined) delete process.env.ENABLE_RABBITMQ;
      else process.env.ENABLE_RABBITMQ = previousEnableRabbit;
    }
  });
});
