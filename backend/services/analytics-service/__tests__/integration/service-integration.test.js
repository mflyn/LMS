const request = require('supertest');
const mongoose = require('mongoose');
const http = require('http');
const nock = require('nock');
const app = require('../../server');
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

// 增加测试超时时间到30秒
jest.setTimeout(30000);

describe('分析服务与其他服务集成测试', () => {
  let studentId;
  let teacherId;
  let classId;
  let server;
  
  beforeAll(async () => {
    // 创建测试ID
    studentId = new mongoose.Types.ObjectId().toString();
    teacherId = new mongoose.Types.ObjectId().toString();
    classId = new mongoose.Types.ObjectId().toString();
    
    // 确保MongoDB连接已建立
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
    
    // 清理测试数据
    await StudentPerformanceTrend.deleteMany({});
    
    // 创建测试数据
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
    
    // 清理所有nock模拟
    nock.cleanAll();
  });
  
  // 使用beforeEach来设置每个测试的超时时间
  beforeEach(() => {
    jest.setTimeout(10000); // 为每个测试设置10秒超时
    // 重置所有nock模拟
    nock.cleanAll();
  });
  
  it('应该能够从数据服务获取学生作业数据并进行分析', async () => {
    // 模拟数据服务的响应
    const dataServiceUrl = 'http://data-service:5002';
    
    // 模拟数据服务的作业接口
    nock(dataServiceUrl)
      .get(`/api/homework/student/${studentId}`)
      .reply(200, {
        homework: [
          {
            _id: 'hw1',
            title: '数学作业1',
            subject: '数学',
            score: 90,
            submittedDate: '2023-01-10T00:00:00.000Z'
          },
          {
            _id: 'hw2',
            title: '数学作业2',
            subject: '数学',
            score: 85,
            submittedDate: '2023-01-20T00:00:00.000Z'
          }
        ]
      });
    
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/performance/homework/${studentId}`)
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('homeworkPerformance');
    expect(response.body.data.homeworkPerformance).toHaveProperty('averageScore');
    expect(response.body.data.homeworkPerformance.averageScore).toBe(87.5); // (90+85)/2
  });
  
  it('应该能够从进度服务获取学生进度数据并进行分析', async () => {
    // 模拟进度服务的响应
    const progressServiceUrl = 'http://progress-service:5003';
    
    // 模拟进度服务的进度接口
    nock(progressServiceUrl)
      .get(`/api/progress/${studentId}`)
      .reply(200, {
        progress: [
          {
            _id: 'prog1',
            subject: '数学',
            chapter: '第一章',
            completionRate: 80
          },
          {
            _id: 'prog2',
            subject: '语文',
            chapter: '第一章',
            completionRate: 70
          }
        ]
      });
    
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/progress/overview/${studentId}`)
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('overallProgress');
    expect(response.body.data.overallProgress).toBe(75); // (80+70)/2
  });
  
  it('应该能够向通知服务发送分析结果通知', async () => {
    // 模拟通知服务的响应
    const notificationServiceUrl = 'http://notification-service:5004';
    
    // 模拟通知服务的创建通知接口
    const notificationMock = nock(notificationServiceUrl)
      .post('/api/notifications')
      .reply(201, {
        message: '通知已创建',
        notification: {
          _id: 'notif1',
          user: studentId,
          message: '您的学习分析报告已更新',
          read: false
        }
      });
    
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .post(`/api/analytics/notify/${studentId}`)
      .send({
        message: '您的学习分析报告已更新',
        type: 'info'
      })
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '通知已发送');
    
    // 验证通知服务的接口被调用
    expect(notificationMock.isDone()).toBe(true);
  });
  
  it('应该能够处理其他服务不可用的情况', async () => {
    // 模拟数据服务不可用
    const dataServiceUrl = 'http://data-service:5002';
    
    // 模拟数据服务的作业接口返回错误
    nock(dataServiceUrl)
      .get(`/api/homework/student/${studentId}`)
      .reply(500, {
        message: '服务器内部错误'
      });
    
    const port = server.address().port;
    const response = await request(`http://localhost:${port}`)
      .get(`/api/analytics/performance/homework/${studentId}`)
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('message', '数据服务暂时不可用');
  });
});
