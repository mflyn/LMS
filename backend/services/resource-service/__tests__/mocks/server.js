const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// 创建 Express 应用
const app = express();

// 创建日志记录器
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug
};

app.locals.logger = logger;

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

// 模拟 Resource 模型
const Resource = {
  find: () => ({
    sort: () => ({
      skip: () => ({
        limit: () => [],
        populate: () => []
      }),
      populate: () => []
    }),
    populate: () => []
  }),
  findById: () => null,
  countDocuments: () => 0
};

// 模拟 ResourceReview 模型
const ResourceReview = {
  find: () => ({
    sort: () => ({
      skip: () => ({
        limit: () => [],
        populate: () => []
      }),
      populate: () => []
    }),
    populate: () => []
  }),
  countDocuments: () => 0,
  aggregate: () => []
};

// 模拟 ResourceCollection 模型
const ResourceCollection = {
  find: () => ({
    sort: () => ({
      skip: () => ({
        limit: () => [],
        populate: () => []
      }),
      populate: () => []
    }),
    populate: () => []
  }),
  countDocuments: () => 0,
  distinct: () => []
};

// 路由
app.get('/api/resources', (req, res) => {
  res.json({
    data: [],
    pagination: {
      total: 0,
      limit: 20,
      skip: 0
    }
  });
});

app.get('/api/recommendations', (req, res) => {
  res.json({
    data: [],
    pagination: {
      total: 0,
      limit: 20,
      skip: 0
    }
  });
});

// 上传资源
app.post('/api/resources', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请上传文件' });
  }

  if (!req.body.title || !req.body.subject || !req.body.grade || !req.body.type) {
    return res.status(400).json({ message: '标题、学科、年级和类型不能为空' });
  }

  res.status(201).json({
    title: req.body.title,
    description: req.body.description,
    subject: req.body.subject,
    grade: req.body.grade,
    type: req.body.type,
    file: {
      name: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      type: req.file.mimetype,
      size: req.file.size
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ message: '路由不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ message: err.message });
});

module.exports = app;
