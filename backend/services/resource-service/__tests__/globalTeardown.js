const mongoose = require('mongoose');

module.exports = async () => {
  console.log('[GLOBAL TEARDOWN] Disconnecting Mongoose...');
  await mongoose.disconnect();
  console.log('[GLOBAL TEARDOWN] Mongoose disconnected.');

  if (global.__MONGO_INSTANCE__) {
    console.log('[GLOBAL TEARDOWN] Stopping MongoMemoryServer...');
    await global.__MONGO_INSTANCE__.stop();
    console.log('[GLOBAL TEARDOWN] MongoMemoryServer stopped.');
  }
}; 