const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// 增加测试超时时间
jest.setTimeout(30000);

// 在所有测试开始前启动内存数据库
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
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

// 模拟 RabbitMQ 连接
jest.mock('amqplib', () => ({
  connect: jest.fn().mockImplementation(() => Promise.resolve({
    createChannel: jest.fn().mockImplementation(() => Promise.resolve({
      assertExchange: jest.fn().mockImplementation(() => Promise.resolve()),
      publish: jest.fn()
    }))
  }))
}));
