/**
 * 测试数据库处理工具
 * 提供MongoDB内存数据库的连接和断开功能
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * 连接到测试数据库
 */
const connect = async () => {
  // 如果已经连接，则直接返回
  if (mongoose.connection.readyState !== 0) {
    return;
  }
  
  // 创建MongoDB内存服务器
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // 设置Mongoose选项
  const mongooseOpts = {
    useNewUrlParser: true,
    useUnifiedTopology: true
  };
  
  // 连接到数据库
  await mongoose.connect(uri, mongooseOpts);
};

/**
 * 断开测试数据库连接
 */
const closeDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
};

/**
 * 清空数据库集合
 */
const clearDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
};

module.exports = {
  connect,
  closeDatabase,
  clearDatabase
};
