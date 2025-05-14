const request = require('supertest');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../../server');
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

// 增加测试超时时间到30秒
jest.setTimeout(30000);

describe('分析服务集成测试', () => {
  let studentId;
  let teacherId;
  let classId;
  let server;

  beforeAll(async () => {
    // 创建测试ID
    studentId = new mongoose.Types.ObjectId();
    teacherId = new mongoose.Types.ObjectId();
    classId = new mongoose.Types.ObjectId();

    // 确保MongoDB连接已建立
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    // 清理测试数据
    await StudentPerformanceTrend.deleteMany({});

    // 创建测试数据 - 使用insertMany来优化性能
    await StudentPerformanceTrend.insertMany([
      {
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
      },
      {
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
      }
    ]);

    // 创建一个独立的服务器实例用于测试
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
  });

  afterAll(async () => {
    // 关闭服务器
    await new Promise(resolve => server.close(resolve));

    // 清理测试数据
    await StudentPerformanceTrend.deleteMany({});

    // 关闭数据库连接
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // 使用beforeEach来设置每个测试的超时时间
  beforeEach(() => {
    jest.setTimeout(10000); // 为每个测试设置10秒超时
  });

  it('应该能够获取学生的进度分析', async () => {
    // 使用server.address().port获取动态分配的端口
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/progress/student/${studentId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('subjects');
    expect(Array.isArray(response.body.data.subjects)).toBe(true);
    expect(response.body.data.subjects.length).toBeGreaterThan(0);
  });

  it('应该能够获取学生的趋势分析', async () => {
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/trends/student/${studentId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('trends');
    expect(Object.keys(response.body.data.trends).length).toBeGreaterThan(0);
    expect(response.body.data.trends).toHaveProperty('数学');
    expect(response.body.data.trends).toHaveProperty('语文');
  });

  it('应该能够获取学生的长期趋势分析', async () => {
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/long-term-trends/student/${studentId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('longTermTrends');
    expect(Object.keys(response.body.data.longTermTrends).length).toBeGreaterThan(0);
  });

  it('应该能够获取学生的报告', async () => {
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/reports/student/${studentId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('strengths');
    expect(response.body.data).toHaveProperty('weaknesses');
    expect(response.body.data).toHaveProperty('recommendations');
  });

  it('应该能够获取学生的行为分析', async () => {
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/behavior/student/${studentId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('behaviorPatterns');
  });

  it('应该能够获取班级的整体分析', async () => {
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/class/${classId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('classPerformance');
    expect(response.body.data).toHaveProperty('subjectBreakdown');
  });

  it('应该能够添加新的性能数据', async () => {
    const port = server.address().port;
    const newData = {
      student: studentId,
      subject: '数学',
      performanceData: {
        date: new Date(),
        score: 95,
        assessmentType: 'quiz'
      }
    };

    const response = await request(`http://localhost:${port}`)
      .post('/api/analytics/performance/add')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
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
