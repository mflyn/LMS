const request = require('supertest');
const express = require('express');
const mistakeRecordRoutes = require('../../routes/mistake-record');
const MistakeRecord = require('../../models/MistakeRecord');
const { 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError, 
  BadRequestError 
} = require('../../../../common/middleware/errorTypes');

// 模拟依赖
jest.mock('../../models/MistakeRecord');
jest.mock('../../../../common/middleware/errorHandler', () => ({
  catchAsync: fn => (req, res, next) => fn(req, res, next).catch(next),
  handleDatabaseError: jest.fn(err => err),
  requestTracker: (req, res, next) => {
    req.requestId = 'test-request-id';
    next();
  }
}));

describe('Mistake Record Routes', () => {
  let app;
  let mockLogger;
  let mockAuditLog;

  beforeEach(() => {
    // 创建Express应用
    app = express();
    app.use(express.json());
    
    // 模拟logger和auditLog
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
    
    mockAuditLog = jest.fn();
    
    app.locals.logger = mockLogger;
    app.locals.auditLog = mockAuditLog;
    
    // 添加错误处理中间件
    app.use('/api/mistake-records', mistakeRecordRoutes);
    app.use((err, req, res, next) => {
      if (err instanceof UnauthorizedError) {
        return res.status(401).json({ message: err.message });
      }
      if (err instanceof ForbiddenError) {
        return res.status(403).json({ message: err.message });
      }
      if (err instanceof NotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      if (err instanceof BadRequestError) {
        return res.status(400).json({ message: err.message, errors: err.errors });
      }
      res.status(500).json({ message: err.message });
    });

    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/mistake-records/student/:studentId', () => {
    it('应该返回学生的错题记录', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 模拟MistakeRecord.find
      const mockMistakes = [
        { _id: 'mistake1', student: 'student123', subject: 'subject1', question: '问题1' },
        { _id: 'mistake2', student: 'student123', subject: 'subject2', question: '问题2' }
      ];
      
      MistakeRecord.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockMistakes)
      });

      // 发送请求
      const response = await request(app)
        .get('/api/mistake-records/student/student123')
        .set(headers)
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        mistakes: mockMistakes
      });

      // 验证方法调用
      expect(MistakeRecord.find).toHaveBeenCalledWith({ student: 'student123' });
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockAuditLog).toHaveBeenCalled();
    });

    it('应该处理权限不足的请求', async () => {
      // 准备请求头（学生尝试访问其他学生的错题记录）
      const headers = {
        'x-user-id': 'student1',
        'x-user-role': 'student'
      };

      // 发送请求
      const response = await request(app)
        .get('/api/mistake-records/student/student2')
        .set(headers)
        .expect(403);

      // 验证响应
      expect(response.body).toEqual({
        message: '权限不足'
      });
    });
  });

  describe('POST /api/mistake-records', () => {
    it('应该成功创建错题记录', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'teacher123',
        'x-user-role': 'teacher'
      };

      // 准备测试数据
      const mistakeData = {
        student: 'student123',
        subject: 'subject1',
        question: '1+1=?',
        answer: '3',
        correctAnswer: '2',
        analysis: '加法运算错误',
        tags: ['加法', '基础运算'],
        source: '课堂练习'
      };

      // 模拟MistakeRecord.prototype.save
      const mockMistake = {
        _id: 'mistake123',
        ...mistakeData,
        date: new Date(),
        createdBy: 'teacher123'
      };
      
      MistakeRecord.prototype.save = jest.fn().mockResolvedValue(mockMistake);

      // 发送请求
      const response = await request(app)
        .post('/api/mistake-records')
        .set(headers)
        .send(mistakeData)
        .expect(201);

      // 验证响应
      expect(response.body).toEqual({
        message: '错题记录已创建',
        mistakeRecord: mockMistake
      });

      // 验证构造函数调用
      expect(MistakeRecord).toHaveBeenCalledWith(expect.objectContaining({
        ...mistakeData,
        date: expect.any(Number),
        createdBy: 'teacher123'
      }));
      
      // 验证save方法被调用
      expect(MistakeRecord.prototype.save).toHaveBeenCalled();
      
      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockAuditLog).toHaveBeenCalled();
    });

    it('应该验证必填字段', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'teacher123',
        'x-user-role': 'teacher'
      };

      // 准备测试数据（缺少必填字段）
      const mistakeData = {
        student: 'student123',
        // 缺少subject
        question: '1+1=?',
        // 缺少correctAnswer
      };

      // 发送请求
      const response = await request(app)
        .post('/api/mistake-records')
        .set(headers)
        .send(mistakeData)
        .expect(400);

      // 验证响应
      expect(response.body.message).toBe('缺少必要字段');
      expect(response.body.errors).toEqual(expect.objectContaining({
        subject: expect.any(String),
        correctAnswer: expect.any(String)
      }));
    });
  });

  describe('PUT /api/mistake-records/:id', () => {
    it('应该成功更新错题记录', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'teacher123',
        'x-user-role': 'teacher'
      };

      // 准备测试数据
      const updateData = {
        question: '更新后的问题',
        analysis: '更新后的分析',
        status: 'reviewed'
      };

      // 模拟MistakeRecord.findById
      const mockMistake = {
        _id: 'mistake123',
        student: 'student123',
        subject: 'subject1',
        question: '原问题',
        analysis: '原分析',
        status: 'pending',
        save: jest.fn().mockResolvedValue({
          _id: 'mistake123',
          student: 'student123',
          subject: 'subject1',
          question: '更新后的问题',
          analysis: '更新后的分析',
          status: 'reviewed'
        })
      };
      
      MistakeRecord.findById = jest.fn().mockResolvedValue(mockMistake);

      // 发送请求
      const response = await request(app)
        .put('/api/mistake-records/mistake123')
        .set(headers)
        .send(updateData)
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        message: '错题记录已更新',
        mistakeRecord: expect.objectContaining({
          _id: 'mistake123',
          question: '更新后的问题',
          analysis: '更新后的分析',
          status: 'reviewed'
        })
      });

      // 验证方法调用
      expect(MistakeRecord.findById).toHaveBeenCalledWith('mistake123');
      expect(mockMistake.save).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockAuditLog).toHaveBeenCalled();
    });
  });
});
