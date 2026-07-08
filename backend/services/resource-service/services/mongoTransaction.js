const createMongoTransactionRunner = (connection) => {
  if (!connection || typeof connection.startSession !== 'function') {
    throw new Error('A transaction-capable Mongo connection is required');
  }

  return async (work) => {
    const session = await connection.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  };
};

module.exports = {
  createMongoTransactionRunner
};
