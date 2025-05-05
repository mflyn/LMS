import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 自定义指标
const successRate = new Rate('success_rate');
const errorRate = new Rate('error_rate');
const requestDuration = new Trend('request_duration');
const requestsPerSecond = new Counter('requests_per_second');

// 基准测试配置
export const options = {
  // 基本配置
  vus: 5,            // 虚拟用户数
  duration: '1m',    // 测试持续时间
  
  // 阈值配置
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95%的请求应该在200ms内完成
    http_req_failed: ['rate<0.05'],    // 请求失败率应该小于5%
    'success_rate': ['rate>0.95'],     // 成功率应该大于95%
  },
};

// 测试设置
const BASE_URL = 'http://localhost:5000';  // API网关地址

// 主测试函数
export default function() {
  // 测试1: 健康检查端点
  {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/health`);
    const duration = new Date() - startTime;
    
    // 记录指标
    requestDuration.add(duration);
    requestsPerSecond.add(1);
    successRate.add(res.status === 200);
    errorRate.add(res.status !== 200);
    
    // 检查响应
    check(res, {
      'health check successful': (r) => r.status === 200,
      'health status is ok': (r) => JSON.parse(r.body).status === 'ok',
    });
    
    sleep(1);
  }
  
  // 测试2: 静态资源加载
  {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/static/css/main.css`);
    const duration = new Date() - startTime;
    
    // 记录指标
    requestDuration.add(duration);
    requestsPerSecond.add(1);
    successRate.add(res.status === 200);
    errorRate.add(res.status !== 200);
    
    // 检查响应
    check(res, {
      'static resource loaded': (r) => r.status === 200,
    });
    
    sleep(1);
  }
  
  // 测试3: 公共API端点
  {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/api/public/subjects`);
    const duration = new Date() - startTime;
    
    // 记录指标
    requestDuration.add(duration);
    requestsPerSecond.add(1);
    successRate.add(res.status === 200);
    errorRate.add(res.status !== 200);
    
    // 检查响应
    check(res, {
      'public API successful': (r) => r.status === 200,
    });
    
    sleep(1);
  }
}
