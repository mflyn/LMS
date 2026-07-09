const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const mongoose = require('mongoose');
const commonMongoose = require(require.resolve('mongoose', {
  paths: [path.resolve(__dirname, '../../common')]
}));

let mongoServer;
const mongooseInstances = commonMongoose === mongoose ? [mongoose] : [mongoose, commonMongoose];

// 增加测试超时时间
jest.setTimeout(30000);

// 在所有测试开始前启动内存数据库
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await Promise.all(mongooseInstances.map((mongooseInstance) => mongooseInstance.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })));
});

// 在所有测试结束后关闭连接
afterAll(async () => {
  await Promise.all(mongooseInstances.map((mongooseInstance) => mongooseInstance.disconnect()));
  await mongoServer.stop();
});

// 在每个测试前清理数据库
beforeEach(async () => {
  const deleted = new Set();
  for (const mongooseInstance of mongooseInstances) {
    const collections = mongooseInstance.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      if (deleted.has(collection.collectionName)) continue;
      deleted.add(collection.collectionName);
      await collection.deleteMany({});
    }
  }
});
