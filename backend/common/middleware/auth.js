/**
 * 统一认证中间件
 * 提供JWT认证和角色检查功能
 * 所有微服务应使用此中间件以确保认证机制一致性
 */

const jwt = require('jsonwebtoken');
const config = require('../config/auth');

/**
 * JWT认证中间件
 * 验证请求头中的Authorization Bearer token
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.status(401).json({ message: '未提供认证令牌' });
  
  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ message: '令牌无效或已过期' });
    req.user = user;
    next();
  });
};

/**
 * API网关认证中间件
 * 验证请求头中的x-user-id和x-user-role
 * 适用于通过API网关转发的请求
 */
const authenticateGateway = (req, res, next) => {
  // 从请求头获取用户信息（由API网关添加）
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return res.status(401).json({ message: '未认证' });
  }
  
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role']
  };
  
  next();
};

/**
 * 角色检查中间件
 * 检查用户是否具有所需角色
 * @param {Array} roles - 允许访问的角色数组
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未认证' });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    next();
  };
};

/**
 * 生成JWT令牌
 * @param {Object} payload - 令牌负载
 * @returns {String} - JWT令牌
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.tokenExpiration });
};

module.exports = {
  authenticateJWT,
  authenticateGateway,
  checkRole,
  generateToken
};