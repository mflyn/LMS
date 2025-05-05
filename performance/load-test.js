import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 自定义指标
const successRate = new Rate('success_rate');
const errorRate = new Rate('error_rate');
const requestDuration = new Trend('request_duration');
const requestsPerSecond = new Counter('requests_per_second');

// 负载测试配置
export const options = {
  // 阶段配置 - 逐步增加负载
  stages: [
    { duration: '1m', target: 10 },   // 1分钟内逐渐增加到10个虚拟用户
    { duration: '3m', target: 50 },   // 3分钟内逐渐增加到50个虚拟用户
    { duration: '2m', target: 50 },   // 保持50个虚拟用户2分钟
    { duration: '1m', target: 0 },    // 1分钟内逐渐减少到0个虚拟用户
  ],
  
  // 阈值配置
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95%的请求应该在1000ms内完成
    http_req_failed: ['rate<0.1'],      // 请求失败率应该小于10%
    'success_rate': ['rate>0.9'],       // 成功率应该大于90%
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
  
  // 随机选择一个测试场景
  const scenario = Math.floor(Math.random() * 5);
  
  switch (scenario) {
    case 0:
      // 场景1: 获取学生成绩
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
        });
      }
      break;
      
    case 1:
      // 场景2: 获取学习进度分析
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
        });
      }
      break;
      
    case 2:
      // 场景3: 获取作业列表
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
        });
      }
      break;
      
    case 3:
      // 场景4: 获取错题记录
      {
        const startTime = new Date();
        const res = http.get(`${BASE_URL}/api/data/mistake-record`, { headers });
        const duration = new Date() - startTime;
        
        // 记录指标
        requestDuration.add(duration);
        requestsPerSecond.add(1);
        successRate.add(res.status === 200);
        errorRate.add(res.status !== 200);
        
        // 检查响应
        check(res, {
          'mistake record request successful': (r) => r.status === 200,
        });
      }
      break;
      
    case 4:
      // 场景5: 获取通知
      {
        const startTime = new Date();
        const res = http.get(`${BASE_URL}/api/notifications`, { headers });
        const duration = new Date() - startTime;
        
        // 记录指标
        requestDuration.add(duration);
        requestsPerSecond.add(1);
        successRate.add(res.status === 200);
        errorRate.add(res.status !== 200);
        
        // 检查响应
        check(res, {
          'notifications request successful': (r) => r.status === 200,
        });
      }
      break;
  }
  
  // 随机休眠1-3秒，模拟真实用户行为
  sleep(Math.random() * 2 + 1);
}
