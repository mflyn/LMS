const express = require('express');
const router = express.Router();
const Homework = require('../models/Homework');

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

// 获取学生作业
router.get('/student/:studentId', async (req, res) => {
  try {
    // 检查权限：只有学生本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    const homework = await Homework.find({ student: req.params.studentId })
      .sort({ dueDate: -1 })
      .populate('subject', 'name');
    
    res.json({ homework });
  } catch (error) {
    console.error('获取作业错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 布置作业
router.post('/', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { title, description, subject, class: classId, dueDate, attachments } = req.body;
    
    // 获取班级所有学生
    const students = await mongoose.model('User').find({ class: classId, role: 'student' }).select('_id');
    
    // 为每个学生创建作业记录
    const homeworkRecords = students.map(student => ({
      title,
      description,
      subject,
      class: classId,
      student: student._id,
      dueDate,
      attachments,
      status: 'assigned',
      assignedBy: req.user.id,
      assignedDate: Date.now()
    }));
    
    const result = await Homework.insertMany(homeworkRecords);
    
    res.status(201).json({ message: `成功为${result.length}名学生布置作业` });
  } catch (error) {
    console.error('布置作业错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 提交作业
router.put('/:id/submit', checkRole(['student']), async (req, res) => {
  try {
    const { content, attachments } = req.body;
    
    const homework = await Homework.findById(req.params.id);
    
    if (!homework) {
      return res.status(404).json({ message: '作业不存在' });
    }
    
    // 检查是否是学生本人的作业
    if (homework.student.toString() !== req.user.id) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    homework.content = content;
    homework.attachments = attachments;
    homework.status = 'submitted';
    homework.submittedDate = Date.now();
    
    await homework.save();
    
    res.json({ message: '作业提交成功', homework });
  } catch (error) {
    console.error('提交作业错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 评分作业
router.put('/:id/grade', checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { score, feedback } = req.body;
    
    const homework = await Homework.findById(req.params.id);
    
    if (!homework) {
      return res.status(404).json({ message: '作业不存在' });
    }
    
    homework.score = score;
    homework.feedback = feedback;
    homework.status = 'graded';
    homework.gradedDate = Date.now();
    homework.gradedBy = req.user.id;
    
    await homework.save();
    
    res.json({ message: '作业评分成功', homework });
  } catch (error) {
    console.error('评分作业错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;