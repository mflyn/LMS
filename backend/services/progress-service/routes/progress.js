const express = require('express');
const router = express.Router();
const Progress = require('../models/Progress');

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

// 获取学生学习进度
router.get('/:studentId', authenticateToken, async (req, res) => {
  try {
    // 检查权限：只有学生本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    const progress = await Progress.find({ student: req.params.studentId })
      .sort({ updatedAt: -1 })
      .populate('subject', 'name');
    
    res.json({ progress });
  } catch (error) {
    console.error('获取学习进度错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新学习进度
router.post('/update', authenticateToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { student, subject, chapter, section, completionRate, status, comments } = req.body;
    
    // 查找是否已存在该学生该科目的进度记录
    let progress = await Progress.findOne({ student, subject });
    
    if (progress) {
      // 更新现有记录
      progress.chapter = chapter;
      progress.section = section;
      progress.completionRate = completionRate;
      progress.status = status;
      progress.comments = comments;
      progress.updatedBy = req.user.id;
      progress.updatedAt = Date.now();
    } else {
      // 创建新记录
      progress = new Progress({
        student,
        subject,
        chapter,
        section,
        completionRate,
        status,
        comments,
        createdBy: req.user.id,
        updatedBy: req.user.id
      });
    }
    
    await progress.save();
    
    res.json({ message: '学习进度已更新', progress });
  } catch (error) {
    console.error('更新学习进度错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;