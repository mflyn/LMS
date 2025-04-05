const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const winston = require('winston');

// 获取日志记录器实例
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

// 获取公告列表
router.get('/', async (req, res) => {
  try {
    const { classId, startDate, endDate, limit = 10, skip = 0 } = req.query;
    
    const query = {};
    
    if (classId) query.class = classId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('author', 'name role')
      .populate('class', 'name grade');
    
    const total = await Announcement.countDocuments(query);
    
    res.json({
      data: announcements,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      }
    });
  } catch (err) {
    logger.error('获取公告列表失败:', err);
    res.status(500).json({ message: '获取公告列表失败', error: err.message });
  }
});

// 获取单个公告
router.get('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('author', 'name role')
      .populate('class', 'name grade');
    
    if (!announcement) {
      return res.status(404).json({ message: '公告不存在' });
    }
    
    res.json(announcement);
  } catch (err) {
    logger.error('获取公告失败:', err);
    res.status(500).json({ message: '获取公告失败', error: err.message });
  }
});

// 创建公告
router.post('/', async (req, res) => {
  try {
    const { title, content, author, classId, attachments } = req.body;
    
    if (!title || !content || !author || !classId) {
      return res.status(400).json({ message: '标题、内容、作者和班级不能为空' });
    }
    
    const announcement = new Announcement({
      title,
      content,
      author,
      class: classId,
      attachments: attachments || [],
    });
    
    await announcement.save();
    
    res.status(201).json(announcement);
  } catch (err) {
    logger.error('创建公告失败:', err);
    res.status(500).json({ message: '创建公告失败', error: err.message });
  }
});

// 更新公告
router.put('/:id', async (req, res) => {
  try {
    const { title, content, attachments } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' });
    }
    
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { 
        title, 
        content, 
        attachments: attachments || [],
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!announcement) {
      return res.status(404).json({ message: '公告不存在' });
    }
    
    res.json(announcement);
  } catch (err) {
    logger.error('更新公告失败:', err);
    res.status(500).json({ message: '更新公告失败', error: err.message });
  }
});

// 删除公告
router.delete('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: '公告不存在' });
    }
    
    res.json({ message: '公告已删除' });
  } catch (err) {
    logger.error('删除公告失败:', err);
    res.status(500).json({ message: '删除公告失败', error: err.message });
  }
});

// 获取班级最新公告
router.get('/class/:classId/latest', async (req, res) => {
  try {
    const { classId } = req.params;
    const { limit = 5 } = req.query;
    
    const announcements = await Announcement.find({ class: classId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('author', 'name role');
    
    res.json(announcements);
  } catch (err) {
    logger.error('获取班级最新公告失败:', err);
    res.status(500).json({ message: '获取班级最新公告失败', error: err.message });
  }
});

module.exports = router;