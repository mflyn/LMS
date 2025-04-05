const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const { responseTimeMiddleware, progressMiddleware } = require('./common/middleware/responseTime');
const errorHandler = require('./common/middleware/errorHandler');

const app = express();

// 安全中间件
app.use(helmet());
app.use(cors());
app.use(xss());
app.use(hpp());

// 请求限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 100个请求
});
app.use('/api', limiter);

// 压缩响应
app.use(compression());

// 响应时间监控和进度提示
app.use(responseTimeMiddleware);
app.use(progressMiddleware);

// 解析请求体
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 静态文件
app.use(express.static('public'));

// 路由
app.use('/api', require('./routes'));

// 错误处理
app.use(errorHandler);

module.exports = app; 