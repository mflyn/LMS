/**
 * 统一认证中间件
 * 提供JWT认证和角色检查功能
 * 所有微服务应使用此中间件以确保认证机制一致性
 */

const jwt = require('jsonwebtoken');
const { jwtSecret, tokenExpiration, refreshTokenExpiration } = require('../config/auth');
const { UnauthorizedError, ForbiddenError } = require('./errorTypes'); // Assuming errorTypes.js is in the same directory

/**
 * JWT认证中间件
 * 验证请求头中的Authorization Bearer token
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, jwtSecret, (err, decodedUser) => {
      if (err) {
        // Consider more specific errors based on err.name (e.g., TokenExpiredError)
        return next(new ForbiddenError('Invalid or expired token. Please log in again.')); 
      }
      req.user = decodedUser;
      next();
    });
  } else {
    return next(new UnauthorizedError('Access token is missing. Please include it in the Authorization header as a Bearer token.'));
  }
};

/**
 * API网关认证中间件
 * 验证请求头中的x-user-id和x-user-role
 * 适用于通过API网关转发的请求
 */
const authenticateGateway = (req, res, next) => {
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return next(new UnauthorizedError('User identification headers (x-user-id, x-user-role) are missing or incomplete. Ensure API Gateway is configured correctly.'));
  }
  
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role']
    // Potentially include other user details if gateway provides them
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
    if (!req.user || !req.user.role) { // Check for req.user and req.user.role
        // This error should ideally not happen if authenticateJWT/authenticateGateway ran successfully.
        return next(new UnauthorizedError('User not authenticated or role information is missing. Ensure an authentication middleware (authenticateJWT or authenticateGateway) runs before checkRole.'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied. Your role ('${req.user.role}') is not authorized for this resource. Required roles: ${roles.join(', ')}.`));
    }
    
    next();
  };
};

/**
 * 生成JWT令牌
 * @param {Object} payload - 令牌负载
 * @returns {String} - JWT令牌
 */
const generateToken = (user, type = 'access') => {
  const payload = {
    id: user._id || user.id,
    role: user.role,
    username: user.username,
  };
  const secret = jwtSecret;
  const expiresIn = type === 'refresh' ? refreshTokenExpiration : tokenExpiration;

  return jwt.sign(payload, secret, { expiresIn });
};

module.exports = {
  authenticateJWT,
  authenticateGateway,
  checkRole,
  generateToken
};