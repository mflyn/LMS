const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 这个中间件已经在server.js中应用，这里只是为了代码的完整性
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

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json({ user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取所有用户（仅管理员）
router.get('/', checkRole(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ users });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新用户信息
router.put('/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // 只允许用户更新自己的信息，或者管理员可以更新任何用户
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;