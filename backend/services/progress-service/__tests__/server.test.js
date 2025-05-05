const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');

describe('Progress Service 服务器测试', () => {
  // 测试健康检查端点
  describe('GET /health', () => {
    it('应该返回服务健康状态', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'progress-service');
    });
  });
  
  // 测试认证中间件
  describe('认证中间件', () => {
    it('没有用户信息时应该返回401', async () => {
      const response = await request(app).get('/api/progress/123');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
    
    it('有用户信息时应该通过认证', async () => {
      const response = await request(app)
        .get('/api/progress/123')
        .set('x-user-id', '123')
        .set('x-user-role', 'student');
      
      // 即使可能因为权限或其他原因失败，也不应该是401未认证
      expect(response.status).not.toBe(401);
    });
  });
  
  // 测试角色检查中间件
  describe('角色检查中间件', () => {
    it('角色不匹配时应该返回403', async () => {
      const response = await request(app)
        .post('/api/progress/update')
        .set('x-user-id', '123')
        .set('x-user-role', 'student')
        .send({
          student: '123',
          subject: '456',
          chapter: '第一章',
          section: '1.1',
          completionRate: 75
        });
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
    
    it('角色匹配时应该通过检查', async () => {
      const response = await request(app)
        .post('/api/progress/update')
        .set('x-user-id', '123')
        .set('x-user-role', 'teacher')
        .send({
          student: '123',
          subject: '456',
          chapter: '第一章',
          section: '1.1',
          completionRate: 75
        });
      
      // 即使可能因为其他原因失败，也不应该是403权限不足
      expect(response.status).not.toBe(403);
    });
  });
  
  // 测试错误处理中间件
  describe('错误处理中间件', () => {
    it('应该处理路由错误', async () => {
      // 创建一个会导致错误的请求
      const response = await request(app)
        .post('/api/progress/update')
        .set('x-user-id', '123')
        .set('x-user-role', 'teacher')
        .send({
          // 缺少必要字段
        });
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器内部错误');
    });
  });
  
  // 测试路由是否正确挂载
  describe('路由挂载', () => {
    it('应该正确挂载进度路由', async () => {
      const response = await request(app)
        .get('/api/progress/123')
        .set('x-user-id', '123')
        .set('x-user-role', 'teacher');
      
      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });
  });
});
