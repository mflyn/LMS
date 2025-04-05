const request = require('supertest');
const app = require('../../app');

describe('API Security Tests', () => {
  // 测试SQL注入防护
  test('should prevent SQL injection attacks', async () => {
    const maliciousInput = "' OR '1'='1";
    
    const response = await request(app)
      .get('/api/students')
      .query({ id: maliciousInput })
      .expect(400);
    
    expect(response.body.error).toBe('Invalid input');
  });

  // 测试XSS防护
  test('should prevent XSS attacks', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    
    const response = await request(app)
      .post('/api/comments')
      .send({ content: xssPayload })
      .expect(400);
    
    expect(response.body.error).toBe('Invalid input');
  });

  // 测试CSRF防护
  test('should require CSRF token for POST requests', async () => {
    const response = await request(app)
      .post('/api/students')
      .send({ name: 'test' })
      .expect(403);
    
    expect(response.body.error).toBe('CSRF token required');
  });

  // 测试认证中间件
  test('should require authentication for protected routes', async () => {
    const response = await request(app)
      .get('/api/protected')
      .expect(401);
    
    expect(response.body.error).toBe('Authentication required');
  });

  // 测试权限控制
  test('should enforce role-based access control', async () => {
    // 使用学生token
    const studentToken = 'student_token';
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
    
    expect(response.body.error).toBe('Insufficient permissions');
  });

  // 测试输入验证
  test('should validate input data', async () => {
    const invalidData = {
      username: 'a', // 太短
      password: '123', // 太弱
      email: 'invalid-email'
    };
    
    const response = await request(app)
      .post('/api/users')
      .send(invalidData)
      .expect(400);
    
    expect(response.body.errors).toHaveLength(3);
  });

  // 测试文件上传安全
  test('should validate file uploads', async () => {
    const maliciousFile = Buffer.from('malicious content');
    
    const response = await request(app)
      .post('/api/resources/upload')
      .attach('file', maliciousFile, 'test.exe')
      .expect(400);
    
    expect(response.body.error).toBe('Invalid file type');
  });

  // 测试速率限制
  test('should enforce rate limiting', async () => {
    const requests = Array(101).fill().map(() => 
      request(app).get('/api/public')
    );
    
    const responses = await Promise.all(requests);
    const lastResponse = responses[responses.length - 1];
    
    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body.error).toBe('Too many requests');
  });

  // 测试敏感数据保护
  test('should not expose sensitive data', async () => {
    const response = await request(app)
      .get('/api/users/1')
      .expect(200);
    
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('salt');
  });

  // 测试会话安全
  test('should implement secure session handling', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'Test123!'
      })
      .expect(200);
    
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(cookie => cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.some(cookie => cookie.includes('Secure'))).toBe(true);
  });
}); 