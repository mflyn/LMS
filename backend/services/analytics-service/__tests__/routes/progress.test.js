const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const progressRouter = require('../../routes/progress');
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/analytics/progress', progressRouter);

describe('进度分析路由测试', () => {
  beforeEach(async () => {
    await StudentPerformanceTrend.deleteMany({});
  });

  describe('GET /api/analytics/progress/student/:studentId', () => {
    it('应该返回学生学习进度分析数据', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const performanceTrend = new StudentPerformanceTrend({
        student: mockStudentId,
        academicYear: '2023-2024',
        semester: '第一学期',
        subjectTrends: [
          {
            subject: '数学',
            scores: [
              {
                date: new Date('2023-09-15'),
                score: 85,
                testType: '单元测试'
              },
              {
                date: new Date('2023-10-20'),
                score: 90,
                testType: '月考'
              }
            ],
            averageScore: 87.5,
            trend: '上升',
            improvementRate: 5.88,
            weakPoints: ['分数运算', '几何证明'],
            strengths: ['代数运算', '方程求解']
          }
        ]
      });

      await performanceTrend.save();

      // 发送请求
      const response = await request(app)
        .get(`/api/analytics/progress/student/${mockStudentId}`)
        .query({ subject: '数学', period: 'semester' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('studentId', mockStudentId.toString());
      expect(response.body).toHaveProperty('period', 'semester');
      expect(response.body).toHaveProperty('progressData');
      expect(response.body.progressData).toHaveProperty('数学');
      expect(response.body.progressData['数学']).toHaveProperty('scores');
      expect(response.body.progressData['数学']).toHaveProperty('averageScore', 87.5);
      expect(response.body.progressData['数学']).toHaveProperty('trend', '上升');
      expect(response.body.progressData['数学']).toHaveProperty('improvementRate', 5.88);
      expect(response.body.progressData['数学']).toHaveProperty('weakPoints');
      expect(response.body.progressData['数学']).toHaveProperty('strengths');
    });

    it('当没有数据时应该返回模拟数据', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .get(`/api/analytics/progress/student/${mockStudentId}`)
        .query({ subject: '数学', period: 'semester' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('studentId', mockStudentId.toString());
      expect(response.body).toHaveProperty('period', 'semester');
      expect(response.body).toHaveProperty('progressData');
      expect(response.body.progressData).toHaveProperty('数学');
      expect(response.body.progressData['数学']).toHaveProperty('scores');
      expect(response.body.progressData['数学'].scores.length).toBeGreaterThan(0);
      expect(response.body.progressData['数学']).toHaveProperty('averageScore');
      expect(response.body.progressData['数学']).toHaveProperty('trend');
      expect(response.body.progressData['数学']).toHaveProperty('improvementRate');
      expect(response.body.progressData['数学']).toHaveProperty('weakPoints');
      expect(response.body.progressData['数学']).toHaveProperty('strengths');
    });

    it('应该根据时间段筛选数据', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const performanceTrend = new StudentPerformanceTrend({
        student: mockStudentId,
        academicYear: '2023-2024',
        semester: '第一学期',
        subjectTrends: [
          {
            subject: '数学',
            scores: [
              {
                date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
                score: 85,
                testType: '单元测试'
              },
              {
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5天前
                score: 90,
                testType: '月考'
              }
            ],
            averageScore: 87.5,
            trend: '上升',
            improvementRate: 5.88
          }
        ]
      });

      await performanceTrend.save();

      // 发送请求 - 周期为一周
      const response = await request(app)
        .get(`/api/analytics/progress/student/${mockStudentId}`)
        .query({ subject: '数学', period: 'week' });

      // 验证响应 - 应该只包含5天前的数据
      expect(response.status).toBe(200);
      expect(response.body.progressData['数学'].scores.length).toBe(1);
      expect(new Date(response.body.progressData['数学'].scores[0].date).getTime())
        .toBeGreaterThan(Date.now() - 7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('GET /api/analytics/progress/class/:classId/comparison', () => {
    it('应该返回班级学习进度对比数据', async () => {
      const mockClassId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .get(`/api/analytics/progress/class/${mockClassId}/comparison`)
        .query({ subject: '数学', period: 'semester' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classId', mockClassId.toString());
      expect(response.body).toHaveProperty('subject', '数学');
      expect(response.body).toHaveProperty('period', 'semester');
      expect(response.body).toHaveProperty('studentCount');
      expect(response.body).toHaveProperty('classAverage');
      expect(response.body).toHaveProperty('scoreDistribution');
      expect(response.body).toHaveProperty('knowledgePoints');
      expect(response.body).toHaveProperty('trendData');
      expect(response.body).toHaveProperty('improvementRate');

      // 验证分数分布
      expect(response.body.scoreDistribution).toHaveProperty('90-100');
      expect(response.body.scoreDistribution).toHaveProperty('80-89');
      expect(response.body.scoreDistribution).toHaveProperty('70-79');
      expect(response.body.scoreDistribution).toHaveProperty('60-69');
      expect(response.body.scoreDistribution).toHaveProperty('0-59');

      // 验证知识点数据
      expect(response.body.knowledgePoints.length).toBeGreaterThan(0);
      expect(response.body.knowledgePoints[0]).toHaveProperty('name');
      expect(response.body.knowledgePoints[0]).toHaveProperty('masteryRate');
      expect(response.body.knowledgePoints[0]).toHaveProperty('difficulty');

      // 验证趋势数据
      expect(response.body.trendData.length).toBeGreaterThan(0);
      expect(response.body.trendData[0]).toHaveProperty('date');
      expect(response.body.trendData[0]).toHaveProperty('averageScore');
    });

    it('缺少学科参数时应该返回400错误', async () => {
      const mockClassId = new mongoose.Types.ObjectId();

      // 发送请求，不提供subject参数
      const response = await request(app)
        .get(`/api/analytics/progress/class/${mockClassId}/comparison`)
        .query({ period: 'semester' });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '学科参数不能为空');
    });
  });
});
