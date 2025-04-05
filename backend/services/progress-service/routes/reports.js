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

// 获取班级学习进度报告
router.get('/class/:classId', authenticateToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { classId } = req.params;
    const { subject } = req.query;
    
    // 获取班级所有学生的进度
    const query = { class: classId };
    if (subject) query.subject = subject;
    
    // 聚合查询获取班级整体进度统计
    const progressStats = await Progress.aggregate([
      { $match: query },
      { $group: {
        _id: '$subject',
        avgCompletionRate: { $avg: '$completionRate' },
        studentCount: { $sum: 1 },
        completedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      classId,
      progressStats
    });
  } catch (error) {
    console.error('获取班级进度报告错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取学生进度对比报告
router.get('/comparison', authenticateToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { students, subject } = req.query;
    
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ message: '请提供有效的学生ID列表' });
    }
    
    const query = { student: { $in: students } };
    if (subject) query.subject = subject;
    
    const progressData = await Progress.find(query)
      .populate('student', 'name')
      .populate('subject', 'name');
    
    res.json({ progressData });
  } catch (error) {
    console.error('获取学生进度对比错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;