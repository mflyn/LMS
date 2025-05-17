require('dotenv').config({ path: './.env.test' }); // 确保环境变量在 globalSetup 中也可用

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  console.log('[DATA-SERVICE GLOBAL SETUP] Initializing MongoMemoryServer...');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  global.__MONGO_INSTANCE_DATA__ = mongoServer; // 使用特定于服务的全局变量名
  global.__MONGO_URI_DATA__ = mongoUri;

  process.env.DATA_SERVICE_MONGO_URI = mongoUri; // 也设置为环境变量，以防万一配置中读取

  console.log(`[DATA-SERVICE GLOBAL SETUP] MongoMemoryServer URI: ${mongoUri}`);

  try {
    console.log('[DATA-SERVICE GLOBAL SETUP] Connecting Mongoose to MongoMemoryServer...');
    await mongoose.connect(mongoUri, {
      // Mongoose 6+ 默认选项，无需显式设置
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    console.log('[DATA-SERVICE GLOBAL SETUP] Mongoose connected successfully to MongoMemoryServer.');
  } catch (err) {
    console.error('[DATA-SERVICE GLOBAL SETUP] Mongoose connection error:', err);
    process.exit(1); // 连接失败则退出
  }
}; 