const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Resource = require('../models/Resource');
const ResourceReview = require('../models/ResourceReview');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const { validate, createResourceValidationRules, updateResourceValidationRules, mongoIdParamValidation, createResourceReviewValidationRules } = require('../../../common/middleware/requestValidator');
// 根据环境选择正确的模块
let catchAsync, AppError;
if (process.env.NODE_ENV === 'test') {
  const errorHandler = require('../__tests__/mocks/errorHandler');
  catchAsync = errorHandler.catchAsync;
  AppError = errorHandler.AppError;
} else {
  const errorHandler = require('../../../common/middleware/errorHandler');
  catchAsync = errorHandler.catchAsync;
  AppError = errorHandler.AppError;
}

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
router.get('/:id', 
    ...mongoIdParamValidation('id'), 
    validate, 
    catchAsync(async (req, res) => {
      const resource = await Resource.findById(req.params.id)
        .populate('uploader', 'name role');

      if (!resource) {
        throw new AppError('资源不存在', 404);
      }

      res.status(200).json(resource);
    })
);

// 上传资源
router.post('/', 
    authenticateGateway, 
    checkRole(['teacher', 'admin', 'superadmin']), 
    (req, res, next) => req.app.locals.upload.single('file')(req, res, next), 
    createResourceValidationRules(), 
    validate, 
    catchAsync(async (req, res) => {
      if (!req.file) {
        throw new AppError('请上传文件', 400);
      }

      const resource = new Resource({
        title: req.body.title,
        description: req.body.description,
        subject: req.body.subject,
        grade: req.body.grade,
        type: req.body.type,
        tags: req.body.tags,
        file: {
          name: req.file.originalname,
          path: `/uploads/${req.file.filename}`, // 保持前导斜杠以兼容客户端 URL 拼接
          type: req.file.mimetype,
          size: req.file.size
        },
        uploader: req.user.id,
        downloads: 0
      });

      await resource.save();
      res.status(201).json(resource);
    })
);

// 下载资源
router.get('/:id/download', 
    ...mongoIdParamValidation('id'), 
    validate, 
    catchAsync(async (req, res) => {
      const resource = await Resource.findById(req.params.id);

      if (!resource) {
        throw new AppError('资源不存在', 404);
      }

      // 更新下载次数
      resource.downloads += 1;
      await resource.save();

      // 获取文件路径 - 移除前导斜杠以确保 path.join 正确工作
      const relativePath = resource.file.path.replace(/^\/+/, '');
      const filePath = path.join(__dirname, '..', relativePath);

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new AppError('文件不存在', 404);
      }

      // 设置响应头
      res.setHeader('Content-Type', resource.file.type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resource.file.name)}"`);

      // 发送文件
      res.sendFile(filePath);
    })
);

// 更新资源信息
router.put('/:id', 
    authenticateGateway, 
    checkRole(['teacher', 'admin', 'superadmin']), 
    updateResourceValidationRules(), 
    validate, 
    catchAsync(async (req, res) => {
      const resourceToUpdate = await Resource.findById(req.params.id);
      if (!resourceToUpdate) {
        throw new AppError('资源不存在', 404);
      }

      if (resourceToUpdate.uploader.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
          throw new AppError('您没有权限修改此资源', 403);
      }
      
      const updatableFields = ['title', 'description', 'subject', 'grade', 'type', 'tags'];
      updatableFields.forEach(field => {
        if (req.body[field] !== undefined) {
          resourceToUpdate[field] = req.body[field];
        }
      });

      await resourceToUpdate.save();
      res.status(200).json(resourceToUpdate);
    })
);

// 删除资源
router.delete('/:id', 
    authenticateGateway, 
    checkRole(['teacher', 'admin', 'superadmin']), 
    ...mongoIdParamValidation('id'), 
    validate, 
    catchAsync(async (req, res) => {
      const resource = await Resource.findById(req.params.id);
      if (!resource) {
        throw new AppError('资源不存在', 404);
      }

      if (resource.uploader.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        throw new AppError('您没有权限删除此资源', 403);
      }

      // 删除文件 - 移除前导斜杠以确保 path.join 正确工作
      if (resource.file && resource.file.path) {
        const relativePath = resource.file.path.replace(/^\/+/, '');
        const filePath = path.join(__dirname, '..', relativePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      await Resource.findByIdAndDelete(req.params.id);
      
      await ResourceReview.deleteMany({ resource: req.params.id });

      res.status(200).json({ message: '资源已删除，相关评论也已清除' });
    })
);

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

// --- Resource Reviews Routes ---

// GET reviews for a resource
router.get('/:resourceId/reviews',
    mongoIdParamValidation('resourceId'), 
    validate,
    catchAsync(async (req, res) => {
        const { resourceId } = req.params;
        const { limit = 10, skip = 0 } = req.query;

        const resourceExists = await Resource.findById(resourceId);
        if (!resourceExists) {
            throw new AppError('资源不存在', 404);
        }

        const reviews = await ResourceReview.find({ resource: resourceId })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .populate('reviewer', 'name role');

        const total = await ResourceReview.countDocuments({ resource: resourceId });
        
        res.status(200).json({
            data: reviews,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
            }
        });
    })
);

// POST a new review for a resource
router.post('/:resourceId/reviews',
    authenticateGateway,
    checkRole(['student', 'teacher', 'parent', 'admin', 'superadmin']), 
    createResourceReviewValidationRules(),
    validate,
    catchAsync(async (req, res) => {
        const { resourceId } = req.params;
        const { rating, comment, isRecommended } = req.body;

        const resource = await Resource.findById(resourceId);
        if (!resource) {
            throw new AppError('资源不存在', 404);
        }

        const existingReview = await ResourceReview.findOne({
            resource: resourceId,
            reviewer: req.user.id 
        });

        if (existingReview) {
            throw new AppError('您已经评论过该资源', 400);
        }

        const review = new ResourceReview({
            resource: resourceId,
            reviewer: req.user.id, 
            rating,
            comment: comment, // req.body.comment will be undefined if not sent, model handles default
            isRecommended: isRecommended // req.body.isRecommended will be undefined if not sent, model handles default
        });

        await review.save(); 
        
        const populatedReview = await ResourceReview.findById(review._id).populate('reviewer', 'name role');

        res.status(201).json(populatedReview);
    })
);

module.exports = router;