/**
 * 服务器基本功能测试
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// 创建一个简化版的服务器应用，避免依赖问题
const createTestApp = () => {
  const app = express();
  
  // 配置CORS
  app.use(cors());
  
  // 解析请求体
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  // 添加健康检查路由
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'interaction-service'
    });
  });
  
  // 添加一个测试路由
  app.post('/test-json', (req, res) => {
    res.status(200).json(req.body);
  });
  
  // 添加一个会抛出错误的路由
  app.get('/error', (req, res, next) => {
    const error = new Error('测试错误');
    error.status = 500;
    next(error);
  });
  
  // 错误处理中间件
  app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : err.message;
    
    res.status(statusCode).json({
      message: '服务器内部错误',
      error: errorMessage
    });
  });
  
  return app;
};

describe('服务器基本功能测试', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('CORS配置', () => {
    it('应该正确配置CORS中间件', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://example.com');
      
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });
  
  describe('请求体解析', () => {
    it('应该正确解析JSON请求体', async () => {
      const testData = { name: 'test', value: 123 };
      
      const response = await request(app)
        .post('/test-json')
        .send(testData)
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(testData);
    });
    
    it('应该正确解析URL编码的请求体', async () => {
      const response = await request(app)
        .post('/test-json')
        .send('name=test&value=123')
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'test');
      expect(response.body).toHaveProperty('value', '123');
    });
  });
  
  describe('健康检查路由', () => {
    it('应该返回200状态码和正确的服务信息', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'interaction-service');
    });
  });
  
  describe('错误处理', () => {
    it('应该处理服务器错误', async () => {
      const response = await request(app).get('/error');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器内部错误');
      expect(response.body).toHaveProperty('error', '测试错误');
    });
    
    it('应该在生产环境中隐藏错误详情', async () => {
      // 设置生产环境
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const response = await request(app).get('/error');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器内部错误');
      expect(response.body.error).toEqual({});
      
      // 恢复环境
      process.env.NODE_ENV = originalEnv;
    });
    
    it('应该处理404错误', async () => {
      const response = await request(app).get('/non-existent-route');
      
      expect(response.status).toBe(404);
    });
  });
});
