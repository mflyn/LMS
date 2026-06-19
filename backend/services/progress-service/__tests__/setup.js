process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-service-token-32-bytes';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// 增加测试超时时间
jest.setTimeout(30000);

// 在所有测试开始前启动内存数据库
beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
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
