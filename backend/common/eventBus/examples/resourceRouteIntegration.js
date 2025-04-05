/**
 * 资源服务路由事件总线集成示例
 * 展示如何在资源服务的路由中集成事件总线
 */

const express = require('express');
const { eventTypes } = require('../../eventBus');
const { publishResourceViewedEvent, publishResourceDownloadedEvent } = require('./resourceRecommendationEvents');

/**
 * 创建集成了事件总线的资源路由
 * @param {Object} Resource - 资源模型
 * @param {Object} ResourceReview - 资源评论模型
 * @param {Object} eventPublisher - 事件发布器
 * @param {Object} logger - 日志记录器
 * @returns {express.Router} Express路由实例
 */
function createResourceRouter(Resource, ResourceReview, eventPublisher, logger) {
  const router = express.Router();
  
  // 获取资源列表
  router.get('/', async (req, res) => {
    try {
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
      
      res.json({
        data: resources,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
        }
      });
    } catch (err) {
      logger.error('获取资源列表失败:', err);
      res.status(500).json({ message: '获取资源列表失败', error: err.message });
    }
  });

  // 获取单个资源
  router.get('/:id', async (req, res) => {
    try {
      const resource = await Resource.findById(req.params.id)
        .populate('uploader', 'name role');
      
      if (!resource) {
        return res.status(404).json({ message: '资源不存在' });
      }
      
      // 如果用户已登录，发布资源查看事件
      if (req.user && req.user.id) {
        publishResourceViewedEvent(
          req.user.id,
          resource._id.toString(),
          eventPublisher,
          logger
        ).catch(err => {
          logger.error('发布资源查看事件失败:', err);
        });
      }
      
      res.json(resource);
    } catch (err) {
      logger.error('获取资源失败:', err);
      res.status(500).json({ message: '获取资源失败', error: err.message });
    }
  });

  // 创建新资源
  router.post('/', async (req, res) => {
    try {
      const { title, description, subject, grade, type, tags, file, uploaderId } = req.body;
      
      if (!title || !subject || !grade || !type || !file) {
        return res.status(400).json({ message: '标题、学科、年级、类型和文件信息不能为空' });
      }
      
      const resource = new Resource({
        title,
        description,
        subject,
        grade,
        type,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        file,
        uploader: uploaderId,
        downloads: 0
      });
      
      await resource.save();
      
      // 发布资源创建事件
      if (eventPublisher) {
        const eventData = {
          resourceId: resource._id.toString(),
          title: resource.title,
          subject: resource.subject,
          grade: resource.grade,
          type: resource.type,
          uploaderId: uploaderId
        };
        
        eventPublisher.publish(
          eventTypes.RESOURCE_EVENTS.CREATED,
          eventData
        ).catch(err => {
          logger.error('发布资源创建事件失败:', err);
        });
      }
      
      res.status(201).json(resource);
    } catch (err) {
      logger.error('创建资源失败:', err);
      res.status(500).json({ message: '创建资源失败', error: err.message });
    }
  });

  // 下载资源
  router.get('/:id/download', async (req, res) => {
    try {
      const resource = await Resource.findById(req.params.id);
      
      if (!resource) {
        return res.status(404).json({ message: '资源不存在' });
      }
      
      // 更新下载次数
      resource.downloads += 1;
      await resource.save();
      
      // 如果用户已登录，发布资源下载事件
      if (req.user && req.user.id) {
        publishResourceDownloadedEvent(
          req.user.id,
          resource._id.toString(),
          eventPublisher,
          logger
        ).catch(err => {
          logger.error('发布资源下载事件失败:', err);
        });
      }
      
      // 返回文件下载链接或文件内容
      res.json({
        downloadUrl: resource.file.path,
        fileName: resource.file.name
      });
    } catch (err) {
      logger.error('下载资源失败:', err);
      res.status(500).json({ message: '下载资源失败', error: err.message });
    }
  });

  // 评价资源
  router.post('/:id/reviews', async (req, res) => {
    try {
      const { rating, comment, userId } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: '评分必须在1-5之间' });
      }
      
      const resource = await Resource.findById(req.params.id);
      
      if (!resource) {
        return res.status(404).json({ message: '资源不存在' });
      }
      
      // 检查用户是否已经评价过该资源
      const existingReview = await ResourceReview.findOne({
        resource: req.params.id,
        user: userId
      });
      
      if (existingReview) {
        // 更新现有评价
        existingReview.rating = rating;
        existingReview.comment = comment;
        await existingReview.save();
        
        // 发布资源评价更新事件
        if (eventPublisher) {
          const eventData = {
            resourceId: resource._id.toString(),
            userId: userId,
            rating: rating,
            comment: comment,
            updated: true
          };
          
          eventPublisher.publish(
            eventTypes.RESOURCE_EVENTS.RATED,
            eventData
          ).catch(err => {
            logger.error('发布资源评价更新事件失败:', err);
          });
        }
        
        res.json(existingReview);
      } else {
        // 创建新评价
        const review = new ResourceReview({
          resource: req.params.id,
          user: userId,
          rating,
          comment
        });
        
        await review.save();
        
        // 更新资源的平均评分
        const reviews = await ResourceReview.find({ resource: req.params.id });
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        resource.averageRating = totalRating / reviews.length;
        resource.reviewCount = reviews.length;
        await resource.save();
        
        // 发布资源评价事件
        if (eventPublisher) {
          const eventData = {
            resourceId: resource._id.toString(),
            userId: userId,
            rating: rating,
            comment: comment,
            updated: false
          };
          
          eventPublisher.publish(
            eventTypes.RESOURCE_EVENTS.RATED,
            eventData
          ).catch(err => {
            logger.error('发布资源评价事件失败:', err);
          });
        }
        
        res.status(201).json(review);
      }
    } catch (err) {
      logger.error('评价资源失败:', err);
      res.status(500).json({ message: '评价资源失败', error: err.message });
    }
  });

  return router;
}

module.exports = createResourceRouter;