const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 验证JWT令牌的中间件
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const authenticateToken = (req, res, next) => {
  // 从请求头获取Authorization头
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN格式
  
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  
  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '认证令牌已过期' });
      }
      return res.status(403).json({ message: '无效的认证令牌' });
    }
    
    req.user = user;
    next();
  });
};

/**
 * 检查用户角色的中间件
 * @param {Array} roles - 允许的角色数组
 * @returns {Function} - Express中间件函数
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: '未认证' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  checkRole
};
