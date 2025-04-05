const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Resource = require('../models/Resource');
const ResourceReview = require('../models/ResourceReview');
const { catchAsync, AppError } = require('../../../common/middleware/errorHandler');


// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads');
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

// 获取资源列表
router.get('/', catchAsync(async (req, res) => {
  const { subject, grade, type, keyword, limit = 20, skip = 0 } = req.query;
  
  const query = {};
  
  if (subject) query.subject = subject;
  if (grade) query.grade = grade;
  if (type) query.type = type;
  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
      { tags: { $regex: keyword, $options: 'i' } }
    ];
  }
  
  const resources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .populate('uploader', 'name role');
  
  const total = await Resource.countDocuments(query);
  
  res.status(200).json({
    resources,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    }
  });
}));

// 获取单个资源
router.get('/:id', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id)
    .populate('uploader', 'name role');
  
  if (!resource) {
    throw new AppError('资源不存在', 404);
  }
  
  res.status(200).json(resource);
}));

// 上传资源
router.post('/', upload.single('file'), catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('请上传文件', 400);
  }
  
  const { title, description, subject, grade, type, tags } = req.body;
  
  if (!title || !subject || !grade || !type) {
    throw new AppError('标题、学科、年级和类型不能为空', 400);
  }
  
  const resource = new Resource({
    title,
    description,
    subject,
    grade,
    type,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    file: {
      name: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      type: req.file.mimetype,
      size: req.file.size
    },
    uploader: req.body.uploaderId,
    downloads: 0
  });
  
  await resource.save();
  
  res.status(201).json(resource);
}));

// 下载资源
router.get('/:id/download', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id);
  
  if (!resource) {
    throw new AppError('资源不存在', 404);
  }
  
  // 更新下载次数
  resource.downloads += 1;
  await resource.save();
  
  // 获取文件路径
  const filePath = path.join(__dirname, '..', resource.file.path);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    throw new AppError('文件不存在', 404);
  }
  
  // 设置响应头
  res.setHeader('Content-Type', resource.file.type);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resource.file.name)}"`);
  
  // 发送文件
  res.sendFile(filePath);
}));

// 更新资源信息
router.put('/:id', catchAsync(async (req, res) => {
  const { title, description, subject, grade, type, tags } = req.body;
  
  const resource = await Resource.findById(req.params.id);
  
  if (!resource) {
    throw new AppError('资源不存在', 404);
  }
  
  // 更新资源信息
  resource.title = title || resource.title;
  resource.description = description || resource.description;
  resource.subject = subject || resource.subject;
  resource.grade = grade || resource.grade;
  resource.type = type || resource.type;
  resource.tags = tags ? tags.split(',').map(tag => tag.trim()) : resource.tags;
  
  await resource.save();
  
  res.status(200).json(resource);
}));

// 删除资源
router.delete('/:id', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id);
  
  if (!resource) {
    throw new AppError('资源不存在', 404);
  }
  
  // 删除文件
  if (resource.file && resource.file.path) {
    const filePath = path.join(__dirname, '..', resource.file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  // 删除资源记录
  await Resource.findByIdAndDelete(req.params.id);
  
  res.json({ message: '资源已删除' });
}))
});

// 获取热门资源
router.get('/stats/popular', catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const resources = await Resource.find()
    .sort({ downloads: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .populate('uploader', 'name role');
  
  res.json(resources);
}));

// 搜索资源
router.get('/search/advanced', catchAsync(async (req, res) => {
  const { keyword, subject, grade, type, tags, limit = 20, skip = 0 } = req.query;
  
  const query = {};
  
  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } }
    ];
  }
  
  if (subject) query.subject = subject;
  if (grade) query.grade = grade;
  if (type) query.type = type;
  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    query.tags = { $in: tagArray };
  }
  
  const resources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .populate('uploader', 'name role');
  
  const total = await Resource.countDocuments(query);
  
  res.json({
    data: resources,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    }
  });
}));

module.exports = router;