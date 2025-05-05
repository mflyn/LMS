const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// 注册所有模型
const ResourceSchema = require('../models/Resource').schema;
const ResourceReviewSchema = require('../models/ResourceReview').schema;
const ResourceCollectionSchema = require('../models/ResourceCollection').schema;

// 注册 User 模型，因为路由中使用了它
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String
});

// 确保模型只注册一次
try {
  mongoose.model('Resource');
} catch (e) {
  mongoose.model('Resource', ResourceSchema);
}

try {
  mongoose.model('ResourceReview');
} catch (e) {
  mongoose.model('ResourceReview', ResourceReviewSchema);
}

try {
  mongoose.model('ResourceCollection');
} catch (e) {
  mongoose.model('ResourceCollection', ResourceCollectionSchema);
}

try {
  mongoose.model('User');
} catch (e) {
  mongoose.model('User', UserSchema);
}

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
