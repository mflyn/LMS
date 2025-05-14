const nock = require('nock');
const axios = require('axios');

// 模拟服务基础URL
const DATA_SERVICE_URL = 'http://data-service:5002';
const PROGRESS_SERVICE_URL = 'http://progress-service:5003';
const NOTIFICATION_SERVICE_URL = 'http://notification-service:5004';

describe('服务间集成测试（使用模拟）', () => {
  // 在每个测试之前清理所有nock模拟
  beforeEach(() => {
    nock.cleanAll();
  });
  
  // 在所有测试之后清理所有nock模拟
  afterAll(() => {
    nock.cleanAll();
  });
  
  it('应该能够从数据服务获取作业数据', async () => {
    // 模拟学生ID
    const studentId = '123456789012';
    
    // 模拟数据服务的响应
    nock(DATA_SERVICE_URL)
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
    
    // 发送请求
    const response = await axios.get(`${DATA_SERVICE_URL}/api/homework/student/${studentId}`);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('homework');
    expect(response.data.homework).toHaveLength(2);
    expect(response.data.homework[0].title).toBe('数学作业1');
    expect(response.data.homework[1].title).toBe('数学作业2');
  });
  
  it('应该能够从进度服务获取学生进度数据', async () => {
    // 模拟学生ID
    const studentId = '123456789012';
    
    // 模拟进度服务的响应
    nock(PROGRESS_SERVICE_URL)
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
    
    // 发送请求
    const response = await axios.get(`${PROGRESS_SERVICE_URL}/api/progress/${studentId}`);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('progress');
    expect(response.data.progress).toHaveLength(2);
    expect(response.data.progress[0].subject).toBe('数学');
    expect(response.data.progress[1].subject).toBe('语文');
  });
  
  it('应该能够向通知服务发送通知', async () => {
    // 模拟用户ID
    const userId = '123456789012';
    
    // 模拟通知数据
    const notificationData = {
      user: userId,
      message: '您的学习分析报告已更新',
      type: 'info'
    };
    
    // 模拟通知服务的响应
    nock(NOTIFICATION_SERVICE_URL)
      .post('/api/notifications')
      .reply(201, {
        message: '通知已创建',
        notification: {
          _id: 'notif1',
          user: userId,
          message: '您的学习分析报告已更新',
          read: false
        }
      });
    
    // 发送请求
    const response = await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, notificationData);
    
    // 验证响应
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('message', '通知已创建');
    expect(response.data).toHaveProperty('notification');
    expect(response.data.notification.user).toBe(userId);
  });
  
  it('应该能够处理服务不可用的情况', async () => {
    // 模拟学生ID
    const studentId = '123456789012';
    
    // 模拟数据服务返回错误
    nock(DATA_SERVICE_URL)
      .get(`/api/homework/student/${studentId}`)
      .reply(500, {
        message: '服务器内部错误'
      });
    
    // 发送请求并捕获错误
    try {
      await axios.get(`${DATA_SERVICE_URL}/api/homework/student/${studentId}`);
      // 如果没有抛出错误，测试应该失败
      expect(true).toBe(false);
    } catch (error) {
      // 验证错误
      expect(error.response.status).toBe(500);
      expect(error.response.data).toHaveProperty('message', '服务器内部错误');
    }
  });
});
