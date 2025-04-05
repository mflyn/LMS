const express = require('express');
const router = express.Router();
const Grade = require('../models/Grade');

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

// 获取学生成绩
router.get('/student/:studentId', async (req, res) => {
  try {
    // 检查权限：只有学生本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    const grades = await Grade.find({ student: req.params.studentId })
      .sort({ date: -1 })
      .populate('subject', 'name');
    
    res.json({ grades });
  } catch (error) {
    console.error('获取成绩错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取班级成绩
router.get('/class/:classId', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const grades = await Grade.find({ class: req.params.classId })
      .populate('student', 'name')
      .populate('subject', 'name');
    
    res.json({ grades });
  } catch (error) {
    console.error('获取班级成绩错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 录入成绩
router.post('/', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { student, subject, class: classId, type, score, totalScore, date, comments } = req.body;
    
    const newGrade = new Grade({
      student,
      subject,
      class: classId,
      type,
      score,
      totalScore,
      date: date || Date.now(),
      comments,
      recordedBy: req.user.id
    });
    
    await newGrade.save();
    
    res.status(201).json({ message: '成绩录入成功', grade: newGrade });
  } catch (error) {
    console.error('录入成绩错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量录入成绩
router.post('/batch', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { grades } = req.body;
    
    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ message: '无效的数据格式' });
    }
    
    // 为每条记录添加录入者信息
    const gradesToInsert = grades.map(grade => ({
      ...grade,
      recordedBy: req.user.id,
      date: grade.date || Date.now()
    }));
    
    const result = await Grade.insertMany(gradesToInsert);
    
    res.status(201).json({ message: `成功录入${result.length}条成绩记录` });
  } catch (error) {
    console.error('批量录入成绩错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;