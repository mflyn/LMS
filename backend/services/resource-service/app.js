const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// 根据环境选择正确的模块
let createLogger, errorHandler;
if (process.env.NODE_ENV === 'test') {
  createLogger = require('./__tests__/mocks/logger').createLogger;
  errorHandler = require('./__tests__/mocks/errorHandler').errorHandler;
} else {
  createLogger = require('../../../common/config/logger').createLogger;
  errorHandler = require('../../../common/middleware/errorHandler').errorHandler;
}

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 创建日志记录器
const { logger, httpLogger } = createLogger('resource-service');
app.locals.logger = logger;

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 限制文件大小为50MB
  fileFilter: function (req, file, cb) {
    // 允许的文件类型
    const allowedTypes = [
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mpeg'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

app.locals.upload = upload;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// 请求日志中间件
app.use(httpLogger);

// 导入路由
const resourcesRouter = require('./routes/resources');
const recommendationsRouter = require('./routes/recommendations');
const collectionsRouter = require('./routes/collections');

// 使用路由模块
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/resources/collections', collectionsRouter);
app.use('/api/resources', resourcesRouter);

// 错误处理中间件
app.use(errorHandler);

module.exports = app;
