require('dotenv').config({ path: './.env.test' }); // 确保测试环境变量加载

const mongoose = require('mongoose');

// 尝试加载模型定义。路径可能需要根据您的实际结构调整
// 确保在尝试 mongoose.model() 之前，相关的 Schema 文件已经被 require
const HomeworkSchema = require('../models/Homework').schema;
const ClassPerformanceSchema = require('../models/ClassPerformance').schema;
const MistakeRecordSchema = require('../models/MistakeRecord').schema;
// 如果还有 Grade 模型等，也在此处引入
// const GradeSchema = require('../models/Grade').schema;

// 注册所有 data-service 的模型
// 使用 try-catch 避免在 watch 模式下重复注册模型导致错误
try {
  mongoose.model('Homework');
} catch (e) {
  mongoose.model('Homework', HomeworkSchema);
}

try {
  mongoose.model('ClassPerformance');
} catch (e) {
  mongoose.model('ClassPerformance', ClassPerformanceSchema);
}

try {
  mongoose.model('MistakeRecord');
} catch (e) {
  mongoose.model('MistakeRecord', MistakeRecordSchema);
}

// try {
//   mongoose.model('Grade');
// } catch (e) {
//   mongoose.model('Grade', GradeSchema);
// }


// beforeEach 用于在每个测试用例运行前清理数据
// 注意：globalSetup 中的 mongoose.connect 已经建立了连接
// 这个 beforeEach 会在每个 describe 块中的测试用例执行前运行
beforeEach(async () => {
  // console.log('[DATA-SERVICE TEST SETUP - beforeEach] Cleaning database collections...');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    // try-catch 以防集合不存在时出错，尽管通常 deleteMany 对空集合是安全的
    try {
      await collection.deleteMany({});
    } catch (err) {
      console.warn(`[DATA-SERVICE TEST SETUP - beforeEach] Error cleaning collection ${key}:`, err.message);
    }
  }
  // console.log('[DATA-SERVICE TEST SETUP - beforeEach] Database collections cleaned.');
});

// afterEach(async () => {
//   // 可选：如果需要在每个测试用例后执行特定清理
// });

// afterAll(async () => {
//   // 可选：如果需要在每个测试文件执行完毕后执行特定清理
//   // 但全局的 mongoose.disconnect() 由 globalTeardown.js 处理
// }); 