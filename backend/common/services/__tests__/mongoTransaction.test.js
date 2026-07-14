const {
  TRANSACTION_OPTIONS,
  assertTransactionCapability,
  runMongoTransaction
} = require('../mongoTransaction');

describe('Mongo transaction utilities', () => {
  test('runs work with majority snapshot semantics and always ends the session', async () => {
    const session = {
      withTransaction: jest.fn(async (callback, options) => {
        expect(options).toEqual(TRANSACTION_OPTIONS);
        await callback();
      }),
      endSession: jest.fn()
    };
    const work = jest.fn(async (receivedSession) => {
      expect(receivedSession).toBe(session);
      return 'committed';
    });

    await expect(runMongoTransaction({
      mongooseInstance: { startSession: jest.fn().mockResolvedValue(session) },
      work
    })).resolves.toBe('committed');
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('propagates transaction failures after ending the session', async () => {
    const failure = new Error('write failed');
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn()
    };

    await expect(runMongoTransaction({
      mongooseInstance: { startSession: jest.fn().mockResolvedValue(session) },
      work: async () => { throw failure; }
    })).rejects.toBe(failure);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('requires a writable replica-set primary with logical sessions', async () => {
    const command = jest.fn()
      .mockResolvedValueOnce({ isWritablePrimary: true, maxWireVersion: 13 })
      .mockResolvedValueOnce({
        setName: 'rs0',
        isWritablePrimary: true,
        maxWireVersion: 13,
        logicalSessionTimeoutMinutes: 30
      });
    const connection = { db: { admin: () => ({ command }) } };

    await expect(assertTransactionCapability(connection, 'test-service'))
      .rejects.toThrow('test-service requires a transaction-capable writable replica-set primary');
    await expect(assertTransactionCapability(connection, 'test-service'))
      .resolves.toEqual(expect.objectContaining({ setName: 'rs0' }));
  });
});
