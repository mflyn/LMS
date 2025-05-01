/**
 * 测试辅助函数
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

/**
 * 生成测试用户ID
 * @returns {Object} 用户ID对象
 */
const generateUserId = () => new mongoose.Types.ObjectId();

/**
 * 生成JWT令牌
 * @param {Object} user 用户信息
 * @returns {String} JWT令牌
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id || user._id.toString(),
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET || 'test-secret-key'
  );
};

/**
 * 创建模拟请求对象
 * @param {Object} headers 请求头
 * @param {Object} user 用户信息
 * @returns {Object} 模拟请求对象
 */
const mockRequest = (headers = {}, user = null) => {
  return {
    headers,
    user,
    body: {},
    params: {},
    query: {}
  };
};

/**
 * 创建模拟响应对象
 * @returns {Object} 模拟响应对象
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * 创建模拟下一个中间件函数
 * @returns {Function} 模拟下一个中间件函数
 */
const mockNext = jest.fn();

module.exports = {
  generateUserId,
  generateToken,
  mockRequest,
  mockResponse,
  mockNext
};
