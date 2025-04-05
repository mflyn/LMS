const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// 允许的文件类型
const allowedMimeTypes = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

// 文件大小限制（字节）
const fileSizeLimits = {
  'image': 5 * 1024 * 1024, // 5MB
  'video': 100 * 1024 * 1024, // 100MB
  'document': 10 * 1024 * 1024 // 10MB
};

// 文件存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成随机文件名
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = allowedMimeTypes[file.mimetype] || path.extname(file.originalname);
    cb(null, `${randomName}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 检查文件类型
  if (!allowedMimeTypes[file.mimetype]) {
    return cb(new Error('不支持的文件类型'), false);
  }

  // 检查文件大小
  const fileType = file.mimetype.split('/')[0];
  const sizeLimit = fileSizeLimits[fileType] || fileSizeLimits.document;
  
  if (file.size > sizeLimit) {
    return cb(new Error(`文件大小超过限制（最大${sizeLimit / (1024 * 1024)}MB）`), false);
  }

  cb(null, true);
};

// 创建multer实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: Math.max(...Object.values(fileSizeLimits))
  }
});

// 文件上传安全中间件
const fileUploadSecurity = (req, res, next) => {
  // 检查请求头
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    return res.status(400).json({
      status: 'error',
      message: '无效的请求格式'
    });
  }

  // 检查文件数量
  if (req.files && req.files.length > 5) {
    return res.status(400).json({
      status: 'error',
      message: '一次最多上传5个文件'
    });
  }

  next();
};

module.exports = {
  upload,
  fileUploadSecurity
}; 