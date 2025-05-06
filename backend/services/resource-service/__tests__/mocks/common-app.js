const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 创建 Express 应用
const app = express();

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 限制文件大小为10MB
  fileFilter: function (req, file, cb) {
    // 允许的文件类型
    const allowedTypes = [
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mpeg'
    ];

    if (file.originalname.endsWith('.exe')) {
      const error = new Error('不支持的文件类型');
      error.status = 400;
      return cb(error, false);
    }

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('不支持的文件类型');
      error.status = 400;
      return cb(error, false);
    }
  }
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

// 添加上传中间件到 app.locals
app.locals.upload = upload;

// 模拟会话中间件
app.use((req, res, next) => {
  req.session = {
    user: {
      id: '123456789',
      username: 'testuser',
      role: 'teacher'
    }
  };
  next();
});

// 模拟认证中间件
app.use((req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    if (token) {
      req.user = {
        id: '123456789',
        username: 'testuser',
        role: 'teacher'
      };
    }
  }
  next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: '文件大小超过限制'
      });
    }
  }

  if (err.status === 400) {
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }

  next(err);
});

// 模拟资源路由
app.post('/api/resources', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: '文件大小超过限制'
          });
        }
      }

      if (err.message === '不支持的文件类型') {
        return res.status(400).json({
          status: 'error',
          message: '不支持的文件类型'
        });
      }

      return next(err);
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: '请上传文件'
      });
    }

    if (!req.body.title || !req.body.type) {
      return res.status(400).json({
        status: 'error',
        message: '标题和类型不能为空'
      });
    }

    // 模拟创建资源
    const resource = {
      _id: Date.now().toString(),
      title: req.body.title,
      type: req.body.type,
      description: req.body.description || '',
      url: `/uploads/${req.file.filename}`,
      status: 'active',
      createdAt: new Date()
    };

    res.status(201).json({
      status: 'success',
      data: {
        resource
      }
    });
  });
});

app.get('/api/resources', (req, res) => {
  // 模拟资源列表
  const resources = [
    {
      _id: '1',
      title: '资源1',
      type: 'textbook',
      description: '测试资源1',
      url: '/resources/test1.pdf',
      status: 'active'
    },
    {
      _id: '2',
      title: '资源2',
      type: 'exercise',
      description: '测试资源2',
      url: '/resources/test2.pdf',
      status: 'active'
    }
  ];

  // 应用过滤
  let filteredResources = [...resources];
  if (req.query.type) {
    filteredResources = filteredResources.filter(r => r.type === req.query.type);
  }

  res.status(200).json({
    status: 'success',
    data: {
      resources: filteredResources
    }
  });
});

app.get('/api/resources/:id', (req, res) => {
  // 模拟单个资源
  if (req.params.id === '000000000000000000000000') {
    return res.status(404).json({
      status: 'error',
      message: '资源不存在'
    });
  }

  const resource = {
    _id: req.params.id,
    title: '测试资源',
    type: 'textbook',
    description: '测试资源描述',
    url: '/resources/test.pdf',
    status: 'active'
  };

  res.status(200).json({
    status: 'success',
    data: {
      resource
    }
  });
});

app.delete('/api/resources/:id', (req, res) => {
  // 模拟删除资源
  if (req.params.id === '000000000000000000000000') {
    return res.status(404).json({
      status: 'error',
      message: '资源不存在'
    });
  }

  res.status(200).json({
    status: 'success',
    message: '资源删除成功'
  });
});

// 模拟认证路由
app.post('/api/auth/login', (req, res) => {
  if (req.body.username === 'testuser' && req.body.password === 'Test123!@#') {
    res.status(200).json({
      status: 'success',
      data: {
        token: 'test-token',
        user: {
          id: '123456789',
          username: 'testuser',
          role: 'teacher'
        }
      }
    });
  } else {
    res.status(401).json({
      status: 'error',
      message: '用户名或密码错误'
    });
  }
});

module.exports = app;
