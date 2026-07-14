require('dotenv').config({ path: './.env.test' });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-user-service-route-tests';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/user-service-test';
process.env.USER_SERVICE_MONGO_URI = process.env.USER_SERVICE_MONGO_URI || process.env.MONGO_URI;

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// 确保在尝试 mongoose.model() 之前，相关的 Schema 文件已经被 require
const UserSchema = require('../../../common/models/User').schema;
const RoleSchema = require('../../../common/models/Role').schema;

let mongoServer;

// 注册模型
try {
  mongoose.model('User');
} catch (e) {
  mongoose.model('User', UserSchema);
}

try {
  mongoose.model('Role');
} catch (e) {
  mongoose.model('Role', RoleSchema);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  const mongoUri = mongoServer.getUri();
  process.env.USER_SERVICE_MONGO_URI = mongoUri;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(mongoUri);
});

beforeEach(async () => {
  // console.log('[USER-SERVICE TEST SETUP - beforeEach] Cleaning database collections...');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    try {
      await collection.deleteMany({});
    } catch (err) {
      console.warn(`[USER-SERVICE TEST SETUP - beforeEach] Error cleaning collection ${key}:`, err.message);
    }
  }
  // console.log('[USER-SERVICE TEST SETUP - beforeEach] Database collections cleaned.');
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});
