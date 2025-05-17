require('dotenv').config({ path: '.env.test' }); // 加载测试环境变量

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

// beforeEach 用于在每个测试用例运行前清理数据
beforeEach(async () => {
  // console.log('[TEST SETUP - beforeEach] Cleaning database collections...');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  // console.log('[TEST SETUP - beforeEach] Database collections cleaned.');
});
