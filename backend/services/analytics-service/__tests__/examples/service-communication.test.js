/**
 * 服务间通信测试
 */

const nock = require('nock');
const {
  getHomeworkFromDataService,
  getProgressFromProgressService,
  sendNotificationToNotificationService,
  simulateServiceUnavailable
} = require('./service-communication-example');

// 在所有测试之前清理所有nock模拟
beforeEach(() => {
  nock.cleanAll();
});

// 在所有测试之后清理所有nock模拟
afterAll(() => {
  nock.cleanAll();
});

describe('服务间通信测试', () => {
  it('应该能够从数据服务获取作业数据', async () => {
    const studentId = '123456789012';
    const response = await getHomeworkFromDataService(studentId);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('homework');
    expect(response.data.homework).toHaveLength(2);
    expect(response.data.homework[0].title).toBe('数学作业1');
    expect(response.data.homework[1].title).toBe('数学作业2');
  });
  
  it('应该能够从进度服务获取进度数据', async () => {
    const studentId = '123456789012';
    const response = await getProgressFromProgressService(studentId);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('progress');
    expect(response.data.progress).toHaveLength(2);
    expect(response.data.progress[0].subject).toBe('数学');
    expect(response.data.progress[1].subject).toBe('语文');
  });
  
  it('应该能够向通知服务发送通知', async () => {
    const userId = '123456789012';
    const message = '您的学习分析报告已更新';
    const response = await sendNotificationToNotificationService(userId, message);
    
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('message', '通知已创建');
    expect(response.data).toHaveProperty('notification');
    expect(response.data.notification.user).toBe(userId);
    expect(response.data.notification.message).toBe(message);
  });
  
  it('应该能够处理服务不可用的情况', async () => {
    const studentId = '123456789012';
    const response = await simulateServiceUnavailable(studentId);
    
    expect(response.status).toBe(500);
    expect(response.data).toHaveProperty('message', '服务器内部错误');
  });
});
