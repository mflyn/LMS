const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// 增加超时时间
jest.setTimeout(60000);

// 设置测试环境
process.env.NODE_ENV = 'test';

// 模拟 RabbitMQ 连接
jest.mock('amqplib', () => ({
  connect: jest.fn().mockImplementation(() => Promise.resolve({
    createChannel: jest.fn().mockImplementation(() => Promise.resolve({
      assertExchange: jest.fn().mockImplementation(() => Promise.resolve()),
      publish: jest.fn()
    }))
  }))
}));

describe('Homework Service 服务器测试', () => {
  let mongoServer;

  beforeAll(async () => {
    // 创建内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  // 测试路由是否正确挂载
  describe('路由挂载', () => {
    it('应该正确挂载作业路由', async () => {
      const response = await request(app).get('/api/homework');

      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });
  });

  // 测试错误处理中间件
  describe('错误处理中间件', () => {
    it('应该处理路由错误', async () => {
      // 创建一个会导致错误的请求
      const response = await request(app)
        .post('/api/homework')
        .send({
          // 缺少必要字段
          title: '测试作业'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', '服务器内部错误');
    });
  });

  // 测试CORS配置
  describe('CORS配置', () => {
    it('应该允许跨域请求', async () => {
      const response = await request(app)
        .options('/api/homework')
        .set('Origin', 'http://example.com');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  // 测试请求日志中间件
  describe('请求日志中间件', () => {
    it('应该记录请求日志', async () => {
      // 模拟 logger
      const originalLogger = app.locals.logger;
      app.locals.logger = {
        info: jest.fn(),
        error: jest.fn()
      };

      await request(app).get('/api/homework');

      expect(app.locals.logger.info).toHaveBeenCalled();

      // 恢复原始 logger
      app.locals.logger = originalLogger;
    });
  });
});
