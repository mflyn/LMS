/**
 * 数据库配置
 */

module.exports = {
  // MongoDB连接URI
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker',
  
  // 数据库连接选项
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
    poolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};