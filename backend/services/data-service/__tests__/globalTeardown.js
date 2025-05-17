const mongoose = require('mongoose');

module.exports = async () => {
  console.log('[DATA-SERVICE GLOBAL TEARDOWN] Disconnecting Mongoose...');
  await mongoose.disconnect();
  console.log('[DATA-SERVICE GLOBAL TEARDOWN] Mongoose disconnected.');

  if (global.__MONGO_INSTANCE_DATA__) {
    console.log('[DATA-SERVICE GLOBAL TEARDOWN] Stopping MongoMemoryServer...');
    await global.__MONGO_INSTANCE_DATA__.stop();
    console.log('[DATA-SERVICE GLOBAL TEARDOWN] MongoMemoryServer stopped.');
  }
}; 