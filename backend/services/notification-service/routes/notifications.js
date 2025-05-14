const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

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

// 获取用户的所有通知
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    // 检查权限：只有用户本人或管理员可以查看
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ message: '权限不足' });
    }

    const notifications = await Notification.find({ user: req.params.userId })
      .sort({ createdAt: -1 });

    res.json({ notifications });
  } catch (error) {
    console.error('获取通知错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 标记通知为已读
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ message: '通知不存在' });
    }

    // 检查权限：只有通知的接收者可以标记为已读
    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: '权限不足' });
    }

    notification.read = true;
    notification.readAt = Date.now();
    await notification.save();

    res.json({ message: '通知已标记为已读', notification });
  } catch (error) {
    console.error('标记通知错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除通知
router.delete('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ message: '通知不存在' });
    }

    // 检查权限：只有通知的接收者或管理员可以删除
    if (req.user.role !== 'admin' && notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: '权限不足' });
    }

    await Notification.findByIdAndDelete(req.params.notificationId);

    res.json({ message: '通知已删除' });
  } catch (error) {
    console.error('删除通知错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;