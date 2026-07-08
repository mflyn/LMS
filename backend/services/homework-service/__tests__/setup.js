process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-service-token-32-bytes';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

const createMongoServer = async () => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await MongoMemoryServer.create();
    } catch (error) {
      lastError = error;
      if (!/Port "\d+" already in use/.test(error.message) || attempt === 3) throw error;
    }
  }
  throw lastError;
};

// 增加测试超时时间
jest.setTimeout(30000);

// 在所有测试开始前启动内存数据库
beforeAll(async () => {
  mongoServer = await createMongoServer();
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
  if (mongoServer) await mongoServer.stop();
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
