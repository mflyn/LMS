const express = require('express');
const router = express.Router();
const ClassPerformance = require('../models/ClassPerformance');

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

// 获取学生的班级表现记录
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  try {
    // 检查权限：只有学生本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    const performances = await ClassPerformance.find({ student: req.params.studentId })
      .sort({ date: -1 })
      .populate('recordedBy', 'name');
    
    res.json({ performances });
  } catch (error) {
    console.error('获取班级表现记录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取班级的表现记录
router.get('/class/:classId', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const performances = await ClassPerformance.find({ class: req.params.classId })
      .sort({ date: -1 })
      .populate('student', 'name')
      .populate('recordedBy', 'name');
    
    res.json({ performances });
  } catch (error) {
    console.error('获取班级表现记录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 记录班级表现
router.post('/', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { student, class: classId, type, description, date } = req.body;
    
    const newPerformance = new ClassPerformance({
      student,
      class: classId,
      type,
      description,
      date: date || Date.now(),
      recordedBy: req.user.id
    });
    
    await newPerformance.save();
    
    res.status(201).json({ message: '班级表现记录成功', performance: newPerformance });
  } catch (error) {
    console.error('记录班级表现错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新班级表现记录
router.put('/:id', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { type, description } = req.body;
    
    const performance = await ClassPerformance.findById(req.params.id);
    
    if (!performance) {
      return res.status(404).json({ message: '记录不存在' });
    }
    
    performance.type = type || performance.type;
    performance.description = description || performance.description;
    
    await performance.save();
    
    res.json({ message: '更新成功', performance });
  } catch (error) {
    console.error('更新班级表现记录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除班级表现记录
router.delete('/:id', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const performance = await ClassPerformance.findByIdAndDelete(req.params.id);
    
    if (!performance) {
      return res.status(404).json({ message: '记录不存在' });
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除班级表现记录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;