const request = require('supertest');
const express = require('express');
const longTermTrendsRoutes = require('../../routes/long-term-trends');
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

// 模拟依赖
jest.mock('../../models/StudentPerformanceTrend');
jest.mock('../../utils/visualization-helper', () => ({
  generateLongTermVisualization: jest.fn().mockReturnValue({ type: 'line', data: {} }),
  generateLearningPatternAnalysis: jest.fn().mockReturnValue({ patterns: [] })
}));

describe('Long Term Trends Routes', () => {
  let app;

  beforeEach(() => {
    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api/long-term-trends', longTermTrendsRoutes);

    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/long-term-trends/student/:studentId', () => {
    it('应该返回学生长期学习趋势数据', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 准备测试数据
      const studentId = 'student123';
      const subject = '数学';
      const timeRange = 'year';
      
      // 模拟StudentPerformanceTrend.find
      const mockStudent = {
        _id: 'student123',
        name: '张三',
        grade: '三年级',
        class: '1班'
      };
      
      const mockTrend = {
        academicYear: '2022-2023',
        semester: '第一学期',
        student: mockStudent,
        subjectTrends: [
          {
            subject: '数学',
            scores: [
              { date: '2022-09-01', score: 85, testType: '单元测试' },
              { date: '2022-10-01', score: 90, testType: '月考' }
            ],
            averageScore: 87.5,
            trend: '上升',
            improvementRate: 5.88,
            weakPoints: ['数学知识点1', '数学知识点2'],
            strengths: ['数学优势1', '数学优势2']
          }
        ]
      };
      
      StudentPerformanceTrend.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([mockTrend])
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/long-term-trends/student/${studentId}`)
        .query({ subject, timeRange })
        .set(headers)
        .expect(200);

      // 验证响应包含预期的字段
      expect(response.body).toEqual({
        studentId,
        longTermTrends: expect.any(Array),
        timeRange,
        comparisonData: null,
        visualization: expect.any(Object),
        learningPatterns: expect.any(Object)
      });

      // 验证方法调用
      expect(StudentPerformanceTrend.find).toHaveBeenCalledWith({
        student: studentId,
        'subjectTrends.subject': subject
      });
    });

    it('应该在没有数据时返回模拟数据', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 准备测试数据
      const studentId = 'student123';
      
      // 模拟StudentPerformanceTrend.find返回空数组
      StudentPerformanceTrend.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([])
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/long-term-trends/student/${studentId}`)
        .set(headers)
        .expect(200);

      // 验证响应包含预期的字段
      expect(response.body).toEqual({
        studentId,
        longTermTrends: expect.any(Array),
        timeRange: 'year',
        comparisonData: null,
        visualization: expect.any(Object),
        learningPatterns: expect.any(Object)
      });
      
      // 验证返回的趋势数据包含模拟数据
      expect(response.body.longTermTrends.length).toBeGreaterThan(0);
      expect(response.body.longTermTrends[0]).toEqual(expect.objectContaining({
        subject: expect.any(String),
        semesterData: expect.any(Array),
        yearlyAverages: expect.any(Array),
        overallTrend: expect.any(String),
        improvementRate: expect.any(Number),
        weakPoints: expect.any(Array),
        strongPoints: expect.any(Array)
      }));
    });

    it('应该处理未认证的请求', async () => {
      // 发送请求（没有认证头）
      const response = await request(app)
        .get('/api/long-term-trends/student/student123')
        .expect(401);

      // 验证响应
      expect(response.body).toEqual({
        message: '未认证'
      });
    });

    it('应该处理权限不足的请求', async () => {
      // 准备请求头（学生尝试访问其他学生的数据）
      const headers = {
        'x-user-id': 'student1',
        'x-user-role': 'student'
      };

      // 发送请求
      const response = await request(app)
        .get('/api/long-term-trends/student/student2')
        .set(headers)
        .expect(403);

      // 验证响应
      expect(response.body).toEqual({
        message: '权限不足'
      });
    });
  });

  describe('GET /api/long-term-trends/class/:classId', () => {
    it('应该返回班级长期学习趋势数据', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'teacher123',
        'x-user-role': 'teacher'
      };

      // 准备测试数据
      const classId = 'class123';
      const subject = '数学';
      
      // 模拟fetch API（用于获取班级学生列表）
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          students: [
            { _id: 'student1' },
            { _id: 'student2' }
          ]
        })
      });
      
      // 模拟StudentPerformanceTrend.find
      StudentPerformanceTrend.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/long-term-trends/class/${classId}`)
        .query({ subject })
        .set(headers)
        .expect(200);

      // 验证响应包含预期的字段
      expect(response.body).toEqual({
        classId,
        classTrends: expect.any(Array),
        academicYears: null,
        visualization: expect.any(Object),
        classLearningPatterns: expect.any(Object)
      });
      
      // 验证返回的趋势数据包含模拟数据
      expect(response.body.classTrends.length).toBeGreaterThan(0);
      expect(response.body.classTrends[0]).toEqual(expect.objectContaining({
        subject: expect.any(String),
        semesterData: expect.any(Array),
        yearlyAverages: expect.any(Array),
        overallTrend: expect.any(String),
        improvementRate: expect.any(Number),
        distributionByGrade: expect.any(Object)
      }));
    });

    it('应该处理未认证的请求', async () => {
      // 发送请求（没有认证头）
      const response = await request(app)
        .get('/api/long-term-trends/class/class123')
        .expect(401);

      // 验证响应
      expect(response.body).toEqual({
        message: '未认证'
      });
    });

    it('应该处理权限不足的请求', async () => {
      // 准备请求头（学生尝试访问班级数据）
      const headers = {
        'x-user-id': 'student1',
        'x-user-role': 'student'
      };

      // 发送请求
      const response = await request(app)
        .get('/api/long-term-trends/class/class123')
        .set(headers)
        .expect(403);

      // 验证响应
      expect(response.body).toEqual({
        message: '权限不足'
      });
    });
  });
});
