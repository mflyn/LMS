const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// 设置环境变量
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

// 在所有测试之前运行
beforeAll(async () => {
  // 创建内存数据库
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // 设置环境变量
  process.env.MONGODB_URI = uri;
  
  // 连接到数据库
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// 在每个测试之后运行
afterEach(async () => {
  // 清理数据库中的所有集合
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// 在所有测试之后运行
afterAll(async () => {
  // 断开数据库连接并停止内存数据库
  await mongoose.disconnect();
  await mongod.stop();
});

// 全局模拟
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};
