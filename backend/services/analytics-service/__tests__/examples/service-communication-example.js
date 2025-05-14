/**
 * 服务间通信示例
 * 
 * 这个文件展示了如何使用 nock 模拟服务间通信，
 * 可以作为编写集成测试的参考。
 */

const nock = require('nock');
const axios = require('axios');

// 模拟服务基础URL
const DATA_SERVICE_URL = 'http://data-service:5002';
const PROGRESS_SERVICE_URL = 'http://progress-service:5003';
const NOTIFICATION_SERVICE_URL = 'http://notification-service:5004';

/**
 * 模拟从数据服务获取作业数据
 * @param {string} studentId - 学生ID
 * @returns {Promise<Object>} - 作业数据
 */
async function getHomeworkFromDataService(studentId) {
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
  return await axios.get(`${DATA_SERVICE_URL}/api/homework/student/${studentId}`);
}

/**
 * 模拟从进度服务获取进度数据
 * @param {string} studentId - 学生ID
 * @returns {Promise<Object>} - 进度数据
 */
async function getProgressFromProgressService(studentId) {
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
  return await axios.get(`${PROGRESS_SERVICE_URL}/api/progress/${studentId}`);
}

/**
 * 模拟向通知服务发送通知
 * @param {string} userId - 用户ID
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型
 * @returns {Promise<Object>} - 通知响应
 */
async function sendNotificationToNotificationService(userId, message, type = 'info') {
  // 模拟通知数据
  const notificationData = {
    user: userId,
    message,
    type
  };
  
  // 模拟通知服务的响应
  nock(NOTIFICATION_SERVICE_URL)
    .post('/api/notifications')
    .reply(201, {
      message: '通知已创建',
      notification: {
        _id: 'notif1',
        user: userId,
        message,
        read: false
      }
    });
  
  // 发送请求
  return await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, notificationData);
}

/**
 * 模拟服务不可用的情况
 * @param {string} studentId - 学生ID
 * @returns {Promise<Object>} - 错误响应
 */
async function simulateServiceUnavailable(studentId) {
  // 模拟数据服务返回错误
  nock(DATA_SERVICE_URL)
    .get(`/api/homework/student/${studentId}`)
    .reply(500, {
      message: '服务器内部错误'
    });
  
  try {
    // 发送请求
    return await axios.get(`${DATA_SERVICE_URL}/api/homework/student/${studentId}`);
  } catch (error) {
    return error.response;
  }
}

/**
 * 使用示例
 */
async function example() {
  const studentId = '123456789012';
  
  try {
    // 获取作业数据
    const homeworkResponse = await getHomeworkFromDataService(studentId);
    console.log('作业数据:', homeworkResponse.data);
    
    // 获取进度数据
    const progressResponse = await getProgressFromProgressService(studentId);
    console.log('进度数据:', progressResponse.data);
    
    // 发送通知
    const notificationResponse = await sendNotificationToNotificationService(
      studentId,
      '您的学习分析报告已更新'
    );
    console.log('通知响应:', notificationResponse.data);
    
    // 模拟服务不可用
    const errorResponse = await simulateServiceUnavailable(studentId);
    console.log('错误响应:', errorResponse.data);
  } catch (error) {
    console.error('示例运行失败:', error.message);
  } finally {
    // 清理所有nock模拟
    nock.cleanAll();
  }
}

// 导出函数供测试使用
module.exports = {
  getHomeworkFromDataService,
  getProgressFromProgressService,
  sendNotificationToNotificationService,
  simulateServiceUnavailable,
  example
};
