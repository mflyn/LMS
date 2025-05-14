const request = require('supertest');
const express = require('express');
const trendsRoutes = require('../../routes/trends');
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

// 模拟依赖
jest.mock('../../models/StudentPerformanceTrend');

describe('Trends Routes', () => {
  let app;

  beforeEach(() => {
    // 创建Express应用
    app = express();
    app.use(express.json());
    
    // 模拟Socket.IO实例
    app.locals.io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
    
    app.use('/api/trends', trendsRoutes);

    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/trends/student/:studentId', () => {
    it('应该返回学生成绩趋势分析数据', async () => {
      // 准备测试数据
      const studentId = 'student123';
      const subject = '数学';
      const period = 'semester';
      
      // 模拟StudentPerformanceTrend.findOne
      const mockStudent = {
        _id: 'student123',
        name: '张三',
        grade: '三年级',
        class: '1班'
      };
      
      const mockSubjectTrend = {
        subject: '数学',
        scores: [
          { date: '2023-01-01', score: 85, testType: '单元测试' },
          { date: '2023-02-01', score: 90, testType: '月考' }
        ],
        averageScore: 87.5,
        trend: '上升',
        improvementRate: 5.88,
        weakPoints: ['数学知识点1', '数学知识点2'],
        strengths: ['数学优势1', '数学优势2']
      };
      
      const mockPerformanceTrend = {
        student: mockStudent,
        subjectTrends: [mockSubjectTrend],
        populate: jest.fn().mockResolvedValue({
          student: mockStudent,
          subjectTrends: [mockSubjectTrend]
        })
      };
      
      StudentPerformanceTrend.findOne = jest.fn().mockReturnValue(mockPerformanceTrend);

      // 发送请求
      const response = await request(app)
        .get(`/api/trends/student/${studentId}`)
        .query({ subject, period })
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        studentId,
        period,
        trendsData: {
          '数学': {
            scores: mockSubjectTrend.scores,
            averageScore: mockSubjectTrend.averageScore,
            trend: mockSubjectTrend.trend,
            improvementRate: mockSubjectTrend.improvementRate,
            weakPoints: mockSubjectTrend.weakPoints,
            strengths: mockSubjectTrend.strengths
          }
        }
      });

      // 验证方法调用
      expect(StudentPerformanceTrend.findOne).toHaveBeenCalledWith({
        student: studentId,
        'subjectTrends.subject': subject
      });
      expect(mockPerformanceTrend.populate).toHaveBeenCalledWith('student', 'name grade class');
      
      // 验证WebSocket通知
      expect(app.locals.io.to).toHaveBeenCalledWith(studentId);
      expect(app.locals.io.emit).toHaveBeenCalledWith('student-trends-update', response.body);
    });

    it('应该在没有数据时返回模拟数据', async () => {
      // 准备测试数据
      const studentId = 'student123';
      const subject = '数学';
      
      // 模拟StudentPerformanceTrend.findOne返回null
      StudentPerformanceTrend.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/trends/student/${studentId}`)
        .query({ subject })
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        studentId,
        period: 'semester', // 默认值
        trendsData: expect.objectContaining({
          '数学': expect.objectContaining({
            scores: expect.any(Array),
            averageScore: expect.any(String),
            trend: expect.any(String),
            improvementRate: expect.any(Number),
            weakPoints: expect.any(Array),
            strengths: expect.any(Array)
          })
        })
      });
    });

    it('应该处理获取趋势分析时的错误', async () => {
      // 准备测试数据
      const studentId = 'student123';
      
      // 模拟StudentPerformanceTrend.findOne抛出错误
      const error = new Error('数据库错误');
      StudentPerformanceTrend.findOne = jest.fn().mockImplementation(() => {
        throw error;
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/trends/student/${studentId}`)
        .expect(500);

      // 验证响应
      expect(response.body).toEqual({
        message: '获取学生成绩趋势分析失败',
        error: '数据库错误'
      });
    });
  });

  describe('GET /api/trends/class/:classId', () => {
    it('应该返回班级成绩趋势分析数据', async () => {
      // 准备测试数据
      const classId = 'class123';
      const subject = '数学';
      const period = 'semester';
      
      // 发送请求
      const response = await request(app)
        .get(`/api/trends/class/${classId}`)
        .query({ subject, period })
        .expect(200);

      // 验证响应包含预期的字段
      expect(response.body).toEqual({
        classId,
        subject,
        period,
        trendData: expect.any(Array),
        averageScore: expect.any(String),
        trend: expect.any(String),
        improvementRate: expect.any(Number),
        weakPoints: expect.any(Array)
      });
      
      // 验证WebSocket通知
      expect(app.locals.io.to).toHaveBeenCalledWith(classId);
      expect(app.locals.io.emit).toHaveBeenCalledWith('class-trends-update', response.body);
    });

    it('应该在缺少学科参数时返回400错误', async () => {
      // 准备测试数据
      const classId = 'class123';
      
      // 发送请求（没有subject参数）
      const response = await request(app)
        .get(`/api/trends/class/${classId}`)
        .expect(400);

      // 验证响应
      expect(response.body).toEqual({
        message: '学科参数不能为空'
      });
    });

    it('应该处理获取班级趋势分析时的错误', async () => {
      // 准备测试数据
      const classId = 'class123';
      const subject = '数学';
      
      // 模拟错误
      app.locals.io.to = jest.fn().mockImplementation(() => {
        throw new Error('Socket错误');
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/trends/class/${classId}`)
        .query({ subject })
        .expect(500);

      // 验证响应
      expect(response.body).toEqual({
        message: '获取班级成绩趋势分析失败',
        error: 'Socket错误'
      });
    });
  });
});
