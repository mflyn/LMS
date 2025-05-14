const request = require('supertest');
const app = require('../../server');

// 增加测试超时时间
jest.setTimeout(10000);

// 简化版集成测试，只测试健康检查和基本路由
describe('分析服务集成测试 (简化版)', () => {
  // 健康检查测试
  it('应该能够通过健康检查', async () => {
    const response = await request(app)
      .get('/health')
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'analytics-service');
  });

  // 测试路由是否正确注册
  it('应该能够访问进度分析路由', async () => {
    const response = await request(app)
      .get('/api/analytics/progress/student/123456789012')
      .set('Accept', 'application/json');

    // 即使没有数据，路由应该能够正常响应
    expect(response.status).not.toBe(404);
  });

  it('应该能够访问趋势分析路由', async () => {
    const response = await request(app)
      .get('/api/analytics/trends/student/123456789012')
      .set('Accept', 'application/json');

    expect(response.status).not.toBe(404);
  });

  it('应该能够访问报告路由', async () => {
    const response = await request(app)
      .get('/api/analytics/reports/student/123456789012')
      .set('Accept', 'application/json');

    expect(response.status).not.toBe(404);
  });

  it('应该能够访问班级分析路由', async () => {
    const response = await request(app)
      .get('/api/analytics/class/123456789012')
      .set('Accept', 'application/json');

    expect(response.status).not.toBe(404);
  });

  it('应该能够访问行为分析路由', async () => {
    const response = await request(app)
      .get('/api/analytics/behavior/student/123456789012')
      .set('Accept', 'application/json');

    expect(response.status).not.toBe(404);
  });

  it('应该能够访问性能数据路由', async () => {
    const response = await request(app)
      .get('/api/analytics/performance/service/user-service')
      .set('x-user-id', 'admin123')
      .set('x-user-role', 'admin')
      .set('Accept', 'application/json');

    expect(response.status).not.toBe(404);
  });

  it('应该能够记录性能数据', async () => {
    const performanceData = {
      requestId: 'req123',
      serviceName: 'user-service',
      method: 'GET',
      url: '/api/users',
      route: '/users',
      statusCode: 200,
      duration: 150,
      slow: false,
      userAgent: 'Mozilla/5.0',
      userId: 'user123',
      userRole: 'student',
      memoryUsage: { rss: 50000000 },
      performanceLevel: 'good'
    };

    const response = await request(app)
      .post('/api/analytics/performance/record')
      .send(performanceData)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json');

    expect(response.status).not.toBe(404);
  });
});
