import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 自定义指标
const successRate = new Rate('success_rate');
const errorRate = new Rate('error_rate');
const requestDuration = new Trend('request_duration');
const requestsPerSecond = new Counter('requests_per_second');

// 测试配置
export const options = {
  // 基本配置
  vus: 10,           // 虚拟用户数
  duration: '30s',   // 测试持续时间
  
  // 阶段配置 - 可以根据需要启用
  // stages: [
  //   { duration: '1m', target: 10 },   // 1分钟内逐渐增加到10个虚拟用户
  //   { duration: '3m', target: 10 },   // 保持10个虚拟用户3分钟
  //   { duration: '1m', target: 0 },    // 1分钟内逐渐减少到0个虚拟用户
  // ],
  
  // 阈值配置
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95%的请求应该在500ms内完成
    http_req_failed: ['rate<0.1'],     // 请求失败率应该小于10%
    'success_rate': ['rate>0.9'],      // 成功率应该大于90%
    'request_duration': ['p(95)<500'], // 自定义请求持续时间指标
  },
};

// 测试设置
const BASE_URL = 'http://localhost:5000';  // API网关地址
let authToken = '';  // 用于存储认证令牌

// 测试初始化
export function setup() {
  // 登录获取令牌
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'testuser',
    password: 'Test123!@#'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => JSON.parse(r.body).data && JSON.parse(r.body).data.token,
  });
  
  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    if (body.data && body.data.token) {
      authToken = body.data.token;
    }
  }
  
  return { token: authToken };
}

// 主测试函数
export default function(data) {
  const token = data.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  // 测试1: 获取学生成绩
  {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/api/data/grades/student`, { headers });
    const duration = new Date() - startTime;
    
    // 记录指标
    requestDuration.add(duration);
    requestsPerSecond.add(1);
    successRate.add(res.status === 200);
    errorRate.add(res.status !== 200);
    
    // 检查响应
    check(res, {
      'grades request successful': (r) => r.status === 200,
      'grades data received': (r) => JSON.parse(r.body).grades !== undefined,
    });
    
    sleep(1);
  }
  
  // 测试2: 获取学习进度分析
  {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/api/analytics/progress/student`, { headers });
    const duration = new Date() - startTime;
    
    // 记录指标
    requestDuration.add(duration);
    requestsPerSecond.add(1);
    successRate.add(res.status === 200);
    errorRate.add(res.status !== 200);
    
    // 检查响应
    check(res, {
      'progress request successful': (r) => r.status === 200,
      'progress data received': (r) => JSON.parse(r.body).progressData !== undefined,
    });
    
    sleep(1);
  }
  
  // 测试3: 获取作业列表
  {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/api/homework/student`, { headers });
    const duration = new Date() - startTime;
    
    // 记录指标
    requestDuration.add(duration);
    requestsPerSecond.add(1);
    successRate.add(res.status === 200);
    errorRate.add(res.status !== 200);
    
    // 检查响应
    check(res, {
      'homework request successful': (r) => r.status === 200,
      'homework data received': (r) => JSON.parse(r.body).homework !== undefined,
    });
    
    sleep(1);
  }
}

// 测试清理
export function teardown(data) {
  // 可以在这里进行清理工作，如果需要的话
  console.log('测试完成，清理资源...');
}
