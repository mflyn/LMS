/**
 * 数据模型索引文件
 * 用于统一导出所有数据模型
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 导入所有模型文件
const modelFiles = fs.readdirSync(__dirname)
  .filter(file => 
    file.endsWith('.js') && 
    file !== 'index.js' && 
    !file.startsWith('.')
  );

// 导出所有模型
modelFiles.forEach(file => {
  const modelName = path.basename(file, '.js');
  module.exports[modelName] = require(`./${file}`);
});

// 导出mongoose实例，方便在其他地方使用
module.exports.mongoose = mongoose;

// 导出连接数据库的方法
module.exports.connectDB = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB连接成功');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB连接失败:', error);
    throw error;
  }
};

// 导出关闭数据库连接的方法
module.exports.closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB连接已关闭');
  } catch (error) {
    console.error('关闭MongoDB连接失败:', error);
    throw error;
  }
};