const request = require('supertest');
const express = require('express');

// 创建一个简单的Express应用
const app = express();

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'analytics-service' });
});

// 测试
describe('健康检查测试', () => {
  it('应该返回200状态码和正确的响应', async () => {
    const response = await request(app)
      .get('/health')
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'analytics-service');
  });
});
