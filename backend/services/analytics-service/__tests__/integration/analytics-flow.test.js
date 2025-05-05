const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

describe('分析服务集成测试', () => {
  let studentId;
  let teacherId;
  let classId;
  
  beforeAll(async () => {
    // 创建测试ID
    studentId = new mongoose.Types.ObjectId();
    teacherId = new mongoose.Types.ObjectId();
    classId = new mongoose.Types.ObjectId();
    
    // 清理测试数据
    await StudentPerformanceTrend.deleteMany({});
    
    // 创建测试数据
    await StudentPerformanceTrend.create({
      student: studentId,
      subject: '数学',
      performanceData: [
        {
          date: new Date('2023-01-01'),
          score: 85,
          assessmentType: 'quiz'
        },
        {
          date: new Date('2023-01-15'),
          score: 90,
          assessmentType: 'homework'
        },
        {
          date: new Date('2023-02-01'),
          score: 88,
          assessmentType: 'exam'
        }
      ]
    });
    
    await StudentPerformanceTrend.create({
      student: studentId,
      subject: '语文',
      performanceData: [
        {
          date: new Date('2023-01-01'),
          score: 80,
          assessmentType: 'quiz'
        },
        {
          date: new Date('2023-01-15'),
          score: 82,
          assessmentType: 'homework'
        },
        {
          date: new Date('2023-02-01'),
          score: 85,
          assessmentType: 'exam'
        }
      ]
    });
  });
  
  afterAll(async () => {
    await mongoose.connection.close();
  });
  
  it('应该能够获取学生的进度分析', async () => {
    const response = await request(app)
      .get(`/api/analytics/progress/student/${studentId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('subjects');
    expect(Array.isArray(response.body.data.subjects)).toBe(true);
    expect(response.body.data.subjects.length).toBeGreaterThan(0);
  });
  
  it('应该能够获取学生的趋势分析', async () => {
    const response = await request(app)
      .get(`/api/analytics/trends/student/${studentId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('trends');
    expect(Object.keys(response.body.data.trends).length).toBeGreaterThan(0);
    expect(response.body.data.trends).toHaveProperty('数学');
    expect(response.body.data.trends).toHaveProperty('语文');
  });
  
  it('应该能够获取学生的长期趋势分析', async () => {
    const response = await request(app)
      .get(`/api/analytics/long-term-trends/student/${studentId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('longTermTrends');
    expect(Object.keys(response.body.data.longTermTrends).length).toBeGreaterThan(0);
  });
  
  it('应该能够获取学生的报告', async () => {
    const response = await request(app)
      .get(`/api/analytics/reports/student/${studentId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('strengths');
    expect(response.body.data).toHaveProperty('weaknesses');
    expect(response.body.data).toHaveProperty('recommendations');
  });
  
  it('应该能够获取学生的行为分析', async () => {
    const response = await request(app)
      .get(`/api/analytics/behavior/student/${studentId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('behaviorPatterns');
  });
  
  it('应该能够获取班级的整体分析', async () => {
    const response = await request(app)
      .get(`/api/analytics/class/${classId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('classPerformance');
    expect(response.body.data).toHaveProperty('subjectBreakdown');
  });
  
  it('应该能够添加新的性能数据', async () => {
    const newData = {
      student: studentId,
      subject: '数学',
      performanceData: {
        date: new Date(),
        score: 95,
        assessmentType: 'quiz'
      }
    };
    
    const response = await request(app)
      .post('/api/analytics/performance/add')
      .send(newData);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '性能数据已添加');
    
    // 验证数据已添加
    const trend = await StudentPerformanceTrend.findOne({
      student: studentId,
      subject: '数学'
    });
    
    expect(trend).toBeDefined();
    expect(trend.performanceData.length).toBe(4); // 原来3条 + 新增1条
    expect(trend.performanceData[3].score).toBe(95);
  });
});
