const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');
const path = require('path');
const fs = require('fs');
const Resource = require('./models/Resource');
const ResourceReview = require('./models/ResourceReview');

// 加载环境变量
dotenv.config();

// 获取日志记录器
const logger = app.locals.logger;

// 连接到MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker', {
  // useNewUrlParser: true, // Consider removing for mongoose v6+
  // useUnifiedTopology: true // Consider removing for mongoose v6+
})
.then(() => {
  logger.info('MongoDB连接成功 from server.js');
})
.catch((err) => {
  logger.error('MongoDB连接失败 from server.js:', err.message);
});

// 旧的路由处理方式已被移除，新的路由在 app.js 中处理

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  logger.info(`资源服务运行在端口 ${PORT}`);
});