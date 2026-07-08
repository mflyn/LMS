const express = require('express');
const mongoose = require('mongoose');

describe('progress-service startup boundary', () => {
  test('uses standard deployment database and port variables', () => {
    const config = require('../config');

    expect(config.db.uri).toBe(process.env.MONGO_URI);
    expect(config.server.port).toBe(3002);
  });

  test('TC-T5-STAR-002 validates the internal service token before startup', () => {
    const { validateInternalServiceToken } = require('../config');

    expect(() => validateInternalServiceToken('')).toThrow('INTERNAL_SERVICE_TOKEN');
    expect(() => validateInternalServiceToken('short')).toThrow('INTERNAL_SERVICE_TOKEN');
    expect(validateInternalServiceToken('t'.repeat(32))).toBe('t'.repeat(32));
  });

  test('importing the server does not connect to MongoDB or listen on a port', () => {
    const connectSpy = jest.spyOn(mongoose, 'connect');
    const listenSpy = jest.spyOn(express.application, 'listen');

    const service = require('../server');

    expect(service.createApp).toEqual(expect.any(Function));
    expect(service.startServer).toEqual(expect.any(Function));
    expect(connectSpy).not.toHaveBeenCalled();
    expect(listenSpy).not.toHaveBeenCalled();

    connectSpy.mockRestore();
    listenSpy.mockRestore();
  });

  test('startServer connects before listening', async () => {
    const calls = [];
    const server = { close: jest.fn() };
    const app = {
      listen: jest.fn((port, callback) => {
        calls.push(`listen:${port}`);
        callback();
        return server;
      })
    };
    const connect = jest.fn(async () => calls.push('connect'));
    const { startServer } = require('../server');

    await expect(startServer({ app, port: 4321, connect })).resolves.toBe(server);
    expect(calls).toEqual(['connect', 'listen:4321']);
  });

  test.each([
    ['standalone', { isWritablePrimary: true, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 }],
    ['secondary', {
      setName: 'rs0', isWritablePrimary: false, secondary: true,
      maxWireVersion: 17, logicalSessionTimeoutMinutes: 30
    }],
    ['old replica set', {
      setName: 'rs0', isWritablePrimary: true,
      maxWireVersion: 6, logicalSessionTimeoutMinutes: 30
    }]
  ])('TC-T5-DEPLOY-003 rejects a %s topology before startup', async (_name, hello) => {
    const { assertTransactionCapability } = require('../server');
    const connection = {
      db: { admin: () => ({ command: jest.fn().mockResolvedValue(hello) }) }
    };

    await expect(assertTransactionCapability(connection))
      .rejects.toThrow('transaction-capable writable replica-set primary');
  });

  test('TC-T5-DEPLOY-003 accepts a transaction-capable writable replica-set primary', async () => {
    const { assertTransactionCapability } = require('../server');
    const command = jest.fn().mockResolvedValue({
      setName: 'rs0', isWritablePrimary: true,
      maxWireVersion: 17, logicalSessionTimeoutMinutes: 30
    });

    await expect(assertTransactionCapability({ db: { admin: () => ({ command }) } }))
      .resolves.toMatchObject({ setName: 'rs0', isWritablePrimary: true });
    expect(command).toHaveBeenCalledWith({ hello: 1 });
  });

  test('TC-T5-DEPLOY-003 connectDatabase verifies transaction capability after connecting', async () => {
    const command = jest.fn().mockResolvedValue({
      setName: 'rs0', isWritablePrimary: true,
      maxWireVersion: 17, logicalSessionTimeoutMinutes: 30
    });
    const connection = { readyState: 0, db: { admin: () => ({ command }) } };
    const mongooseInstance = {
      connection,
      connect: jest.fn().mockImplementation(async () => {
        connection.readyState = 1;
      })
    };
    const { connectDatabase } = require('../server');

    await expect(connectDatabase({ mongooseInstance, mongoURI: 'mongodb://example/test' }))
      .resolves.toBe(connection);
    expect(command).toHaveBeenCalledWith({ hello: 1 });
  });
});
