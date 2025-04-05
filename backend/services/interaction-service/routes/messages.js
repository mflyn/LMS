const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
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

// 获取消息列表
router.get('/', async (req, res) => {
  try {
    const { sender, receiver, startDate, endDate, limit = 20, skip = 0 } = req.query;
    
    const query = {};
    
    if (sender) query.sender = sender;
    if (receiver) query.receiver = receiver;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('sender', 'name role')
      .populate('receiver', 'name role');
    
    const total = await Message.countDocuments(query);
    
    res.json({
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      }
    });
  } catch (err) {
    logger.error('获取消息列表失败:', err);
    res.status(500).json({ message: '获取消息列表失败', error: err.message });
  }
});

// 获取单个消息
router.get('/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('sender', 'name role')
      .populate('receiver', 'name role');
    
    if (!message) {
      return res.status(404).json({ message: '消息不存在' });
    }
    
    res.json(message);
  } catch (err) {
    logger.error('获取消息失败:', err);
    res.status(500).json({ message: '获取消息失败', error: err.message });
  }
});

// 发送消息
router.post('/', async (req, res) => {
  try {
    const { sender, receiver, content, attachments } = req.body;
    
    if (!sender || !receiver || !content) {
      return res.status(400).json({ message: '发送者、接收者和内容不能为空' });
    }
    
    const message = new Message({
      sender,
      receiver,
      content,
      attachments: attachments || [],
      read: false,
    });
    
    await message.save();
    
    // 如果有WebSocket连接，可以在这里发送实时通知
    
    res.status(201).json(message);
  } catch (err) {
    logger.error('发送消息失败:', err);
    res.status(500).json({ message: '发送消息失败', error: err.message });
  }
});

// 标记消息为已读
router.put('/:id/read', async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({ message: '消息不存在' });
    }
    
    res.json(message);
  } catch (err) {
    logger.error('标记消息已读失败:', err);
    res.status(500).json({ message: '标记消息已读失败', error: err.message });
  }
});

// 删除消息
router.delete('/:id', async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: '消息不存在' });
    }
    
    res.json({ message: '消息已删除' });
  } catch (err) {
    logger.error('删除消息失败:', err);
    res.status(500).json({ message: '删除消息失败', error: err.message });
  }
});

// 获取未读消息数量
router.get('/stats/unread', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: '用户ID不能为空' });
    }
    
    const unreadCount = await Message.countDocuments({
      receiver: userId,
      read: false
    });
    
    res.json({ unreadCount });
  } catch (err) {
    logger.error('获取未读消息数量失败:', err);
    res.status(500).json({ message: '获取未读消息数量失败', error: err.message });
  }
});

module.exports = router;