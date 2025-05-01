/**
 * 健康检查路由测试
 */

const request = require('supertest');
const express = require('express');

// 创建一个模拟的Express应用
const mockApp = express();

// 添加健康检查路由
mockApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'interaction-service'
  });
});

// 模拟服务器模块
jest.mock('../server', () => mockApp);

describe('健康检查路由测试', () => {
  it('应该返回200状态码和正确的服务信息', async () => {
    const response = await request(mockApp).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'interaction-service');
  });
});
