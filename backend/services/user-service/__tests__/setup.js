require('dotenv').config({ path: './.env.test' });

const mongoose = require('mongoose');

// 确保在尝试 mongoose.model() 之前，相关的 Schema 文件已经被 require
const UserSchema = require('../models/User').schema;
const RoleSchema = require('../models/Role').schema;

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