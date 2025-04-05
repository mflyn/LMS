const express = require('express');
const router = express.Router();
const MistakeRecord = require('../models/MistakeRecord');

// 导入错误处理工具
const { 
  catchAsync, 
  handleDatabaseError, 
  requestTracker 
} = require('../../../common/middleware/errorHandler');

// 导入错误类型
const { 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError, 
  BadRequestError 
} = require('../../../common/middleware/errorTypes');

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 从请求头获取用户信息（由API网关添加）
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return next(new UnauthorizedError('未认证'));
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
    if (!req.user) return next(new UnauthorizedError('未认证'));
    
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('权限不足'));
    }
    
    next();
  };
};

// 检查学生权限中间件
const checkStudentPermission = (req, res, next) => {
  if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
    return next(new ForbiddenError('权限不足'));
  }
  next();
};

// 获取学生错题记录
router.get('/student/:studentId', authenticateToken, requestTracker, checkStudentPermission, catchAsync(async (req, res) => {
  // 记录审计日志
  if (req.app.locals.auditLog) {
    req.app.locals.auditLog('查看错题记录', req.user.id, {
      studentId: req.params.studentId
    });
  }
  
  const mistakes = await MistakeRecord.find({ student: req.params.studentId })
    .sort({ date: -1 })
    .populate('subject', 'name');
  
  // 记录详细日志
  if (req.app.locals.logger) {
    req.app.locals.logger.info(`获取学生 ${req.params.studentId} 的错题记录`, {
      requestId: req.requestId,
      count: mistakes.length,
      studentId: req.params.studentId
    });
  }
  
  res.json({ mistakes });
}));

// 按科目获取学生错题记录
router.get('/student/:studentId/subject/:subjectId', authenticateToken, requestTracker, checkStudentPermission, catchAsync(async (req, res) => {
  // 记录审计日志
  if (req.app.locals.auditLog) {
    req.app.locals.auditLog('查看科目错题记录', req.user.id, {
      studentId: req.params.studentId,
      subjectId: req.params.subjectId
    });
  }
  
  const mistakeRecords = await MistakeRecord.find({
    student: req.params.studentId,
    subject: req.params.subjectId
  }).sort({ date: -1 });
  
  // 记录详细日志
  if (req.app.locals.logger) {
    req.app.locals.logger.info(`获取学生 ${req.params.studentId} 的科目 ${req.params.subjectId} 错题记录`, {
      requestId: req.requestId,
      count: mistakeRecords.length,
      studentId: req.params.studentId,
      subjectId: req.params.subjectId
    });
  }
  
  res.json({ mistakeRecords });
}));

// 记录错题
router.post('/', authenticateToken, requestTracker, catchAsync(async (req, res) => {
  const { student, subject, question, answer, correctAnswer, analysis, tags, source } = req.body;
  
  // 检查权限：学生只能记录自己的错题
  if (req.user.role === 'student' && req.user.id !== student) {
    throw new ForbiddenError('权限不足');
  }
  
  // 验证必填字段
  const errors = {};
  if (!student) errors.student = '学生ID不能为空';
  if (!subject) errors.subject = '科目ID不能为空';
  if (!question) errors.question = '题目不能为空';
  if (!correctAnswer) errors.correctAnswer = '正确答案不能为空';
  
  if (Object.keys(errors).length > 0) {
    throw new BadRequestError('缺少必要字段', errors);
  }
  
  try {
    const mistakeRecord = new MistakeRecord({
      student,
      subject,
      question,
      answer,
      correctAnswer,
      analysis,
      tags,
      source,
      date: Date.now(),
      createdBy: req.user.id
    });
    
    await mistakeRecord.save();
    
    // 记录审计日志
    if (req.app.locals.auditLog) {
      req.app.locals.auditLog('创建错题记录', req.user.id, {
        mistakeId: mistakeRecord._id,
        studentId: student,
        subjectId: subject
      });
    }
    
    // 记录详细日志
    if (req.app.locals.logger) {
      req.app.locals.logger.info(`创建错题记录成功`, {
        requestId: req.requestId,
        mistakeId: mistakeRecord._id,
        studentId: student,
        subjectId: subject,
        createdBy: req.user.id
      });
    }
    
    res.status(201).json({ message: '错题记录已创建', mistakeRecord });
  } catch (err) {
    // 处理数据库错误
    throw handleDatabaseError(err);
  }
}));

// 更新错题记录
router.put('/:id', authenticateToken, requestTracker, catchAsync(async (req, res) => {
  const { question, answer, correctAnswer, analysis, tags, status } = req.body;
  
  try {
    const mistakeRecord = await MistakeRecord.findById(req.params.id);
    
    if (!mistakeRecord) {
      throw new NotFoundError('错题记录不存在');
    }
    
    // 检查权限：只有创建者、教师或管理员可以更新
    if (req.user.role === 'student' && req.user.id !== mistakeRecord.student.toString()) {
      throw new ForbiddenError('权限不足');
    }
    
    // 更新字段
    if (question) mistakeRecord.question = question;
    if (answer) mistakeRecord.answer = answer;
    if (correctAnswer) mistakeRecord.correctAnswer = correctAnswer;
    if (analysis) mistakeRecord.analysis = analysis;
    if (tags) mistakeRecord.tags = tags;
    if (status) mistakeRecord.status = status;
    
    mistakeRecord.updatedAt = Date.now();
    mistakeRecord.updatedBy = req.user.id;
    
    await mistakeRecord.save();
    
    // 记录审计日志
    if (req.app.locals.auditLog) {
      req.app.locals.auditLog('更新错题记录', req.user.id, {
        mistakeId: mistakeRecord._id,
        studentId: mistakeRecord.student,
        changes: req.body
      });
    }
    
    // 记录详细日志
    if (req.app.locals.logger) {
      req.app.locals.logger.info(`更新错题记录成功`, {
        requestId: req.requestId,
        mistakeId: mistakeRecord._id,
        updatedBy: req.user.id
      });
    }
    
    res.json({ message: '错题记录已更新', mistakeRecord });
  } catch (err) {
    // 处理数据库错误
    if (err.name === 'CastError') {
      throw new NotFoundError(`无效的错题记录ID: ${req.params.id}`);
    }
    throw handleDatabaseError(err);
  }
}));

// 删除错题记录
router.delete('/:id', authenticateToken, requestTracker, catchAsync(async (req, res) => {
  try {
    const mistakeRecord = await MistakeRecord.findById(req.params.id);
    
    if (!mistakeRecord) {
      throw new NotFoundError('错题记录不存在');
    }
    
    // 检查权限：只有创建者、教师或管理员可以删除
    if (req.user.role === 'student' && req.user.id !== mistakeRecord.student.toString()) {
      throw new ForbiddenError('权限不足');
    }
    
    // 保存记录信息用于日志
    const recordInfo = {
      id: mistakeRecord._id,
      student: mistakeRecord.student,
      subject: mistakeRecord.subject
    };
    
    await MistakeRecord.findByIdAndDelete(req.params.id);
    
    // 记录审计日志
    if (req.app.locals.auditLog) {
      req.app.locals.auditLog('删除错题记录', req.user.id, {
        mistakeId: recordInfo.id,
        studentId: recordInfo.student,
        subjectId: recordInfo.subject
      });
    }
    
    // 记录详细日志
    if (req.app.locals.logger) {
      req.app.locals.logger.info(`删除错题记录成功`, {
        requestId: req.requestId,
        mistakeId: recordInfo.id,
        deletedBy: req.user.id
      });
    }
    
    res.json({ message: '错题记录已删除' });
  } catch (err) {
    // 处理数据库错误
    if (err.name === 'CastError') {
      throw new NotFoundError(`无效的错题记录ID: ${req.params.id}`);
    }
    throw handleDatabaseError(err);
  }
}));

module.exports = router;