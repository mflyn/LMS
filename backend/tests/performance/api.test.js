const request = require('supertest');
const app = require('../../app');
const loadtest = require('loadtest');

describe('API Performance Tests', () => {
  // 测试单个请求的响应时间
  test('should respond within 200ms for single request', async () => {
    const start = Date.now();
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(200);
    console.log(`Single request response time: ${duration}ms`);
  });

  // 测试并发请求处理能力
  test('should handle 50 concurrent requests', async () => {
    const concurrentRequests = 50;
    const requests = Array(concurrentRequests).fill().map(() => 
      request(app).get('/api/health')
    );
    
    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;
    
    // 验证所有请求都成功
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    console.log(`Handled ${concurrentRequests} concurrent requests in ${duration}ms`);
    expect(duration).toBeLessThan(5000); // 5秒内完成
  });

  // 测试持续负载下的性能
  test('should maintain performance under sustained load', async () => {
    const options = {
      url: 'http://localhost:3000/api/health',
      maxRequests: 1000,
      concurrency: 10,
      method: 'GET'
    };

    return new Promise((resolve, reject) => {
      loadtest.loadTest(options, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        console.log('Load test results:', {
          totalRequests: result.totalRequests,
          totalErrors: result.totalErrors,
          meanLatency: result.meanLatency,
          maxLatency: result.maxLatency,
          minLatency: result.minLatency
        });

        // 验证性能指标
        expect(result.totalErrors).toBe(0);
        expect(result.meanLatency).toBeLessThan(500); // 平均延迟小于500ms
        expect(result.maxLatency).toBeLessThan(2000); // 最大延迟小于2s
        
        resolve();
      });
    });
  });

  // 测试数据库查询性能
  test('should handle database queries efficiently', async () => {
    const start = Date.now();
    const response = await request(app)
      .get('/api/students')
      .query({ page: 1, limit: 50 })
      .expect(200);
    
    const duration = Date.now() - start;
    console.log(`Database query response time: ${duration}ms`);
    
    expect(duration).toBeLessThan(1000); // 1秒内完成
    expect(response.body.data).toHaveLength(50);
  });

  // 测试文件上传性能
  test('should handle file uploads efficiently', async () => {
    const testFile = Buffer.from('test file content');
    
    const start = Date.now();
    const response = await request(app)
      .post('/api/resources/upload')
      .attach('file', testFile, 'test.txt')
      .expect(200);
    
    const duration = Date.now() - start;
    console.log(`File upload response time: ${duration}ms`);
    
    expect(duration).toBeLessThan(2000); // 2秒内完成
    expect(response.body).toHaveProperty('fileId');
  });

  // 测试认证请求性能
  test('should handle authentication requests efficiently', async () => {
    const authData = {
      username: 'testuser',
      password: 'Test123!'
    };
    
    const start = Date.now();
    const response = await request(app)
      .post('/api/auth/login')
      .send(authData)
      .expect(200);
    
    const duration = Date.now() - start;
    console.log(`Authentication response time: ${duration}ms`);
    
    expect(duration).toBeLessThan(500); // 500ms内完成
    expect(response.body).toHaveProperty('token');
  });
}); 