/**
 * 测试服务器处理工具
 * 提供Express应用的模拟功能
 */

const express = require('express');
const request = require('supertest');

/**
 * 创建一个模拟的Express应用
 * @param {Object} routes 路由配置
 * @returns {Object} Express应用
 */
const createMockApp = (routes = {}) => {
  const app = express();
  
  // 添加JSON解析中间件
  app.use(express.json());
  
  // 添加路由
  for (const [path, handlers] of Object.entries(routes)) {
    for (const [method, handler] of Object.entries(handlers)) {
      app[method.toLowerCase()](path, handler);
    }
  }
  
  // 添加404处理
  app.use((req, res) => {
    res.status(404).json({ message: '未找到路由' });
  });
  
  return app;
};

/**
 * 创建一个测试请求
 * @param {Object} app Express应用
 * @returns {Object} Supertest请求对象
 */
const createTestRequest = (app) => {
  return request(app);
};

module.exports = {
  createMockApp,
  createTestRequest
};
