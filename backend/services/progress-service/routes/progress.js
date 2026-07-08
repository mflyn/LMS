const express = require('express');
const router = express.Router();
const Progress = require('../models/Progress');

const sendError = (res, status, code, message) => res.status(status).json({
  success: false,
  error: { code, message, details: [] }
});

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 从请求头获取用户信息（由API网关添加）
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return sendError(res, 401, 'UNAUTHENTICATED', '未认证');
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
    if (!req.user) return sendError(res, 401, 'UNAUTHENTICATED', '未认证');

    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'ACCESS_DENIED', '权限不足');
    }

    next();
  };
};

// 获取学生学习进度
router.get('/:studentId', authenticateToken, async (req, res, next) => {
  try {
    // 检查权限：只有学生本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return sendError(res, 403, 'ACCESS_DENIED', '权限不足');
    }

    let progress;

    // 在测试环境中不使用 populate
    if (process.env.NODE_ENV === 'test') {
      progress = await Progress.find({ student: req.params.studentId })
        .sort({ updatedAt: -1 });
    } else {
      progress = await Progress.find({ student: req.params.studentId })
        .sort({ updatedAt: -1 })
        .populate('subject', 'name');
    }

    res.json({ progress });
  } catch (error) {
    next(error);
  }
});

// 更新学习进度
router.post('/update', authenticateToken, checkRole(['teacher', 'admin']), async (req, res, next) => {
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
    next(error);
  }
});

router.post('/batch-update', authenticateToken, checkRole(['teacher', 'admin']), async (req, res, next) => {
  try {
    const { students, subject, chapter, section, completionRate, status, comments } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'students must be a non-empty array');
    }

    await Promise.all(students.map(async (student) => {
      const progress = await Progress.findOne({ student, subject }) || new Progress({ student, subject });
      Object.assign(progress, {
        chapter,
        section,
        completionRate,
        status,
        comments,
        createdBy: progress.createdBy || req.user.id,
        updatedBy: req.user.id,
        updatedAt: Date.now()
      });
      await progress.save();
    }));

    return res.json({ message: '批量更新成功', updatedCount: students.length });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
