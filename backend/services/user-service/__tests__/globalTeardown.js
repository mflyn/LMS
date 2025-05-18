const mongoose = require('mongoose');

module.exports = async () => {
  console.log('[USER-SERVICE GLOBAL TEARDOWN] Disconnecting Mongoose...');
  await mongoose.disconnect();
  console.log('[USER-SERVICE GLOBAL TEARDOWN] Mongoose disconnected.');

  if (global.__MONGO_INSTANCE_USER__) {
    console.log('[USER-SERVICE GLOBAL TEARDOWN] Stopping MongoMemoryServer...');
    await global.__MONGO_INSTANCE_USER__.stop();
    console.log('[USER-SERVICE GLOBAL TEARDOWN] MongoMemoryServer stopped.');
  }
}; 