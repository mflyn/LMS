const TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' }
});

const assertTransactionCapability = async (connection, serviceName = 'service') => {
  const hello = await connection.db.admin().command({ hello: 1 });
  const transactionReady = Boolean(hello.setName)
    && hello.isWritablePrimary === true
    && Number.isInteger(hello.maxWireVersion)
    && hello.maxWireVersion >= 7
    && Number.isFinite(hello.logicalSessionTimeoutMinutes);

  if (!transactionReady) {
    throw new Error(`${serviceName} requires a transaction-capable writable replica-set primary`);
  }

  return hello;
};

const runMongoTransaction = async ({ mongooseInstance, work, options = TRANSACTION_OPTIONS }) => {
  if (!mongooseInstance || typeof mongooseInstance.startSession !== 'function') {
    throw new TypeError('mongooseInstance with startSession is required');
  }
  if (typeof work !== 'function') {
    throw new TypeError('transaction work callback is required');
  }

  const session = await mongooseInstance.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, options);
    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  TRANSACTION_OPTIONS,
  assertTransactionCapability,
  runMongoTransaction
};
