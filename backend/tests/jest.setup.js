const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// 增加测试超时时间
jest.setTimeout(60000);

// 在所有测试开始前启动内存数据库
beforeAll(async () => {
  // 使用特定版本的MongoDB，避免下载最新版本可能导致的问题
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '4.0.3', // 使用较稳定的版本
      skipMD5: true,    // 跳过MD5检查
    },
  });
  const mongoUri = mongoServer.getUri();
  
  // 添加更多连接选项
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,     // 如果使用索引
    useFindAndModify: false,  // 使用新的findOneAndUpdate()
    connectTimeoutMS: 30000,  // 连接超时
    socketTimeoutMS: 30000,   // Socket超时
  });
  
  console.log(`MongoDB successfully connected to ${mongoUri}`);
});

// 在所有测试结束后关闭连接
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 在每个测试前清理数据库
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
