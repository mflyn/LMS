require('dotenv').config({ path: './.env.test' }); 

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  console.log('[USER-SERVICE GLOBAL SETUP] Initializing MongoMemoryServer...');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  global.__MONGO_INSTANCE_USER__ = mongoServer; 
  global.__MONGO_URI_USER__ = mongoUri;

  // 如果 user-service 的 config.js 从环境变量读取 MONGO_URI，则设置它
  process.env.USER_SERVICE_MONGO_URI = mongoUri; 

  console.log(`[USER-SERVICE GLOBAL SETUP] MongoMemoryServer URI: ${mongoUri}`);

  try {
    console.log('[USER-SERVICE GLOBAL SETUP] Connecting Mongoose to MongoMemoryServer...');
    await mongoose.connect(mongoUri);
    console.log('[USER-SERVICE GLOBAL SETUP] Mongoose connected successfully to MongoMemoryServer.');
  } catch (err) {
    console.error('[USER-SERVICE GLOBAL SETUP] Mongoose connection error:', err);
    process.exit(1);
  }
}; 