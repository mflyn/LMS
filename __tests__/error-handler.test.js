/**
 * 错误处理中间件测试
 */

const express = require('express');
const request = require('supertest');

describe('错误处理中间件测试', () => {
  let app;
  
  beforeEach(() => {
    // 创建一个新的Express应用
    app = express();
    
    // 添加一个会抛出错误的路由
    app.get('/error', (req, res, next) => {
      const error = new Error('测试错误');
      next(error);
    });
    
    // 添加错误处理中间件
    app.use((err, req, res, next) => {
      res.status(500).json({
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'production' ? {} : err.message
      });
    });
  });
  
  it('在开发环境中应该返回错误详情', async () => {
    // 设置为非生产环境
    process.env.NODE_ENV = 'development';
    
    const response = await request(app).get('/error');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '服务器内部错误');
    expect(response.body).toHaveProperty('error', '测试错误');
  });
  
  it('在生产环境中应该隐藏错误详情', async () => {
    // 设置为生产环境
    process.env.NODE_ENV = 'production';
    
    const response = await request(app).get('/error');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '服务器内部错误');
    expect(response.body.error).toEqual({});
  });
  
  afterEach(() => {
    // 清理环境变量
    delete process.env.NODE_ENV;
  });
});
