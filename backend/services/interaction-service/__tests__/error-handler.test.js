/**
 * 错误处理中间件测试
 */

const request = require('supertest');
const express = require('express');
const winston = require('winston');

// 创建一个测试应用
const createTestApp = () => {
  const app = express();

  // 配置日志记录器（静默模式，避免测试输出）
  const logger = winston.createLogger({
    level: 'error',
    silent: true
  });

  // 添加一个会抛出错误的路由
  app.get('/error', (req, res, next) => {
    const error = new Error('测试错误');
    next(error);
  });

  // 错误处理中间件
  app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'production' ? {} : err.message
    });
  });

  return app;
};

describe('错误处理中间件测试', () => {
  let app;
  let originalNodeEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalNodeEnv = process.env.NODE_ENV;
    app = createTestApp();
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('在开发环境中应该返回详细错误信息', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(app).get('/error');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '服务器内部错误');
    expect(response.body).toHaveProperty('error', '测试错误');
  });

  it('在生产环境中应该隐藏详细错误信息', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app).get('/error');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '服务器内部错误');
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toEqual({});
  });

  it('应该处理不同类型的错误', async () => {
    process.env.NODE_ENV = 'development';

    // 创建一个新的应用，添加一个会抛出不同类型错误的路由
    const testApp = express();

    // 配置日志记录器（静默模式）
    const logger = winston.createLogger({
      level: 'error',
      silent: true
    });

    // 添加一个会抛出类型错误的路由
    testApp.get('/type-error', (req, res, next) => {
      const error = new TypeError('类型错误');
      next(error);
    });

    // 错误处理中间件
    testApp.use((err, req, res, next) => {
      logger.error(err.stack);
      res.status(500).json({
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'production' ? {} : err.message
      });
    });

    const response = await request(testApp).get('/type-error');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '服务器内部错误');
    expect(response.body).toHaveProperty('error', '类型错误');
  });

  it('应该处理没有消息的错误', async () => {
    process.env.NODE_ENV = 'development';

    // 创建一个新的应用，添加一个会抛出没有消息的错误的路由
    const testApp = express();

    // 配置日志记录器（静默模式）
    const logger = winston.createLogger({
      level: 'error',
      silent: true
    });

    // 添加一个会抛出没有消息的错误的路由
    testApp.get('/empty-error', (req, res, next) => {
      const error = new Error();
      next(error);
    });

    // 错误处理中间件
    testApp.use((err, req, res, next) => {
      logger.error(err.stack);
      res.status(500).json({
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'production' ? {} : err.message
      });
    });

    const response = await request(testApp).get('/empty-error');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '服务器内部错误');
  });
});
