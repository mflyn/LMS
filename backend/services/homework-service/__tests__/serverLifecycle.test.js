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
});
