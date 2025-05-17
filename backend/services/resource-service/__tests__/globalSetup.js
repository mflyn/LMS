require('dotenv').config({ path: '.env.test' }); // 确保环境变量在 globalSetup 中也可用

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  console.log('[GLOBAL SETUP] Initializing MongoMemoryServer...');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  global.__MONGO_INSTANCE__ = mongoServer;
  global.__MONGO_URI__ = mongoUri;

  console.log(`[GLOBAL SETUP] MongoMemoryServer URI: ${mongoUri}`);

  try {
    console.log('[GLOBAL SETUP] Connecting Mongoose to MongoMemoryServer...');
    await mongoose.connect(mongoUri, {
      // useNewUrlParser: true, // 已弃用
      // useUnifiedTopology: true, // 已弃用
      // connectTimeoutMS: 10000, // 可选：连接超时
      // socketTimeoutMS: 45000,  // 可选：socket 超时
    });
    console.log('[GLOBAL SETUP] Mongoose connected successfully to MongoMemoryServer.');
  } catch (err) {
    console.error('[GLOBAL SETUP] Mongoose connection error:', err);
    process.exit(1); // 连接失败则退出
  }
}; 