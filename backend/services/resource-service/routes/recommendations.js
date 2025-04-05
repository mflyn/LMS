const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const ResourceReview = require('../models/ResourceReview');
const { catchAsync, AppError } = require('../../../common/middleware/errorHandler');

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 从请求头获取用户信息（由API网关添加）
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return res.status(401).json({ message: '未认证' });
  }
  
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role']
  };
  
  next();
};

// 角色检查中间件
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未认证' });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    next();
  };
};

// 获取资源评分
router.get('/reviews/:resourceId', authenticateToken, catchAsync(async (req, res) => {
  const { resourceId } = req.params;
  
  const reviews = await ResourceReview.find({ resource: resourceId })
    .populate('reviewer', 'name role');
  
  // 计算平均评分
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
  
  res.json({
    reviews,
    stats: {
      count: reviews.length,
      averageRating: parseFloat(averageRating.toFixed(1))
    }
  });
}));

// 提交资源评分
router.post('/reviews', authenticateToken, catchAsync(async (req, res) => {
  const { resource, rating, comment, isRecommended } = req.body;
  
  if (!resource || !rating) {
    throw new AppError('资源ID和评分不能为空', 400);
  }
  
  // 检查用户是否已经评价过该资源
  const existingReview = await ResourceReview.findOne({
    resource,
    reviewer: req.user.id
  });
  
  if (existingReview) {
    // 更新现有评价
    existingReview.rating = rating;
    existingReview.comment = comment;
    existingReview.isRecommended = isRecommended !== undefined ? isRecommended : true;
    existingReview.updatedAt = Date.now();
    
    await existingReview.save();
    
    req.app.locals.logger.info(`用户 ${req.user.id} 更新了资源 ${resource} 的评价`);
    res.json({ message: '评价已更新', review: existingReview });
  } else {
    // 创建新评价
    const newReview = new ResourceReview({
      resource,
      reviewer: req.user.id,
      rating,
      comment,
      isRecommended: isRecommended !== undefined ? isRecommended : true,
      createdAt: Date.now()
    });
    
    await newReview.save();
    
    req.app.locals.logger.info(`用户 ${req.user.id} 提交了资源 ${resource} 的新评价`);
    res.status(201).json({ message: '评价已提交', review: newReview });
  }
}));

// 获取推荐资源
router.get('/recommended', authenticateToken, catchAsync(async (req, res) => {
  const { subject, grade, limit = 10 } = req.query;
  
  // 基于用户角色和历史行为的推荐算法
  let recommendedResources = [];
  
  req.app.locals.logger.info(`用户 ${req.user.id} 请求推荐资源`, { subject, grade, limit });
  
  // 1. 获取高评分资源
  const highRatedResources = await ResourceReview.aggregate([
    { $group: {
      _id: '$resource',
      averageRating: { $avg: '$rating' },
      reviewCount: { $sum: 1 },
      recommendCount: { $sum: { $cond: [{ $eq: ['$isRecommended', true] }, 1, 0] } }
    }},
    { $match: { 
      averageRating: { $gte: 4.0 },
      reviewCount: { $gte: 3 }
    }},
    { $sort: { averageRating: -1, recommendCount: -1 } },
    { $limit: parseInt(limit) }
  ]);
  
  // 2. 获取资源详情
  if (highRatedResources.length > 0) {
    const resourceIds = highRatedResources.map(item => item._id);
    
    const query = { _id: { $in: resourceIds } };
    if (subject) query.subject = subject;
    if (grade) query.grade = grade;
    
    recommendedResources = await Resource.find(query)
      .populate('uploader', 'name role');
    
    // 添加评分信息
    recommendedResources = recommendedResources.map(resource => {
      const ratingInfo = highRatedResources.find(r => r._id.equals(resource._id));
      return {
        ...resource.toObject(),
        rating: ratingInfo ? ratingInfo.averageRating : 0,
        reviewCount: ratingInfo ? ratingInfo.reviewCount : 0
      };
    });
    
    // 按评分排序
    recommendedResources.sort((a, b) => b.rating - a.rating);
  }
  
  // 3. 如果推荐资源不足，补充最新资源
  if (recommendedResources.length < parseInt(limit)) {
    const additionalLimit = parseInt(limit) - recommendedResources.length;
    
    const query = {};
    if (subject) query.subject = subject;
    if (grade) query.grade = grade;
    
    // 排除已推荐的资源
    if (recommendedResources.length > 0) {
      query._id = { $nin: recommendedResources.map(r => r._id) };
    }
    
    const newResources = await Resource.find(query)
      .sort({ createdAt: -1 })
      .limit(additionalLimit)
      .populate('uploader', 'name role');
    
    recommendedResources = [...recommendedResources, ...newResources];
  }
  
  req.app.locals.logger.info(`为用户 ${req.user.id} 返回 ${recommendedResources.length} 个推荐资源`);
  
  res.json({
    recommendedResources,
    count: recommendedResources.length
  });
}));

// 获取个性化推荐资源（基于用户历史行为）
router.get('/personalized', authenticateToken, catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;
  
  req.app.locals.logger.info(`用户 ${userId} 请求个性化推荐资源`, { limit, subject: req.query.subject, grade: req.query.grade });
  
  // 1. 获取用户历史评价
  const userReviews = await ResourceReview.find({ reviewer: userId });
  
  // 如果用户没有评价记录，返回普通推荐
  if (userReviews.length === 0) {
    req.app.locals.logger.info(`用户 ${userId} 没有评价记录，重定向到普通推荐`);
    return res.redirect('/api/resource/recommendations/recommended' + 
      (req.query.subject ? `?subject=${req.query.subject}` : '') + 
      (req.query.grade ? `&grade=${req.query.grade}` : '') + 
      `&limit=${limit}`);
  }
  
  // 2. 分析用户偏好
  const userPreferences = {
    subjects: {},
    types: {},
    grades: {}
  };
  
  // 获取用户评价过的资源详情
  const reviewedResourceIds = userReviews.map(review => review.resource);
  const reviewedResources = await Resource.find({ _id: { $in: reviewedResourceIds } });
  
  // 建立评价ID到评分的映射
  const reviewMap = {};
  userReviews.forEach(review => {
    reviewMap[review.resource.toString()] = review.rating;
  });
  
  // 分析用户偏好
  reviewedResources.forEach(resource => {
    const rating = reviewMap[resource._id.toString()] || 3;
    const weight = rating / 5; // 评分权重
    
    // 科目偏好
    if (resource.subject) {
      userPreferences.subjects[resource.subject] = 
        (userPreferences.subjects[resource.subject] || 0) + weight;
    }
    
    // 资源类型偏好
    if (resource.type) {
      userPreferences.types[resource.type] = 
        (userPreferences.types[resource.type] || 0) + weight;
    }
    
    // 年级偏好
    if (resource.grade) {
      userPreferences.grades[resource.grade] = 
        (userPreferences.grades[resource.grade] || 0) + weight;
    }
  });
  
  // 3. 获取推荐资源
  // 找出用户最喜欢的科目、类型和年级
  const favoriteSubject = Object.entries(userPreferences.subjects)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  const favoriteType = Object.entries(userPreferences.types)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  const favoriteGrade = Object.entries(userPreferences.grades)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  req.app.locals.logger.info(`用户 ${userId} 的偏好分析结果`, { 
    favoriteSubject, 
    favoriteType, 
    favoriteGrade 
  });
  
  // 构建查询条件
  const query = {
    _id: { $nin: reviewedResourceIds } // 排除用户已评价的资源
  };
  
  // 添加偏好条件
  if (favoriteSubject) query.subject = favoriteSubject;
  if (favoriteType) query.type = favoriteType;
  if (favoriteGrade) query.grade = favoriteGrade;
  
  // 如果有查询参数，优先使用查询参数
  if (req.query.subject) query.subject = req.query.subject;
  if (req.query.grade) query.grade = req.query.grade;
  
  // 获取推荐资源
  let personalizedResources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('uploader', 'name role');
  
  // 如果推荐资源不足，放宽条件
  if (personalizedResources.length < parseInt(limit)) {
    req.app.locals.logger.info(`用户 ${userId} 的推荐资源不足，放宽条件查询`);
    
    const additionalLimit = parseInt(limit) - personalizedResources.length;
    
    // 放宽条件，只保留必要条件
    const relaxedQuery = {
      _id: { $nin: [...reviewedResourceIds, ...personalizedResources.map(r => r._id)] }
    };
    
    if (req.query.subject) relaxedQuery.subject = req.query.subject;
    if (req.query.grade) relaxedQuery.grade = req.query.grade;
    
    const additionalResources = await Resource.find(relaxedQuery)
      .sort({ createdAt: -1 })
      .limit(additionalLimit)
      .populate('uploader', 'name role');
    
    personalizedResources = [...personalizedResources, ...additionalResources];
  }
  
  req.app.locals.logger.info(`为用户 ${userId} 返回 ${personalizedResources.length} 个个性化推荐资源`);
  
  res.json({
    personalizedResources,
    count: personalizedResources.length,
    userPreferences: {
      favoriteSubject,
      favoriteType,
      favoriteGrade
    }
  });
}));

module.exports = router;