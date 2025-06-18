/**
 * 统一认证中间件
 * 提供JWT认证和角色检查功能
 * 所有微服务应使用此中间件以确保认证机制一致性
 */

const jwt = require('jsonwebtoken');
const { configManager } = require('../config');
const { UnauthorizedError, ForbiddenError } = require('./errorTypes');
const { logger } = require('../config/logger');

/**
 * JWT认证中间件
 * 验证请求头中的Authorization Bearer token
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const jwtSecret = configManager.get('JWT_SECRET');
    
    jwt.verify(token, jwtSecret, (err, decodedUser) => {
      if (err) {
        // 记录认证失败日志
        logger.warn('JWT认证失败', {
          error: err.name,
          message: err.message,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          url: req.originalUrl
        });
        
        // Consider more specific errors based on err.name (e.g., TokenExpiredError)
        return next(new ForbiddenError('Invalid or expired token. Please log in again.')); 
      }
      req.user = decodedUser;
      
      // 记录认证成功日志
      logger.debug('JWT认证成功', {
        userId: decodedUser.id,
        role: decodedUser.role,
        ip: req.ip,
        url: req.originalUrl
      });
      
      next();
    });
  } else {
    logger.warn('JWT令牌缺失', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      url: req.originalUrl
    });
    
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
    logger.warn('网关认证失败 - 缺少用户标识头', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      url: req.originalUrl,
      headers: {
        'x-user-id': req.headers['x-user-id'],
        'x-user-role': req.headers['x-user-role']
      }
    });
    
    return next(new UnauthorizedError('User identification headers (x-user-id, x-user-role) are missing or incomplete. Ensure API Gateway is configured correctly.'));
  }
  
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role']
    // Potentially include other user details if gateway provides them
  };
  
  // 记录网关认证成功日志
  logger.debug('网关认证成功', {
    userId: req.user.id,
    role: req.user.role,
    ip: req.ip,
    url: req.originalUrl
  });
  
  next();
};

/**
 * 角色检查中间件
 * 检查用户是否具有所需角色
 * @param {Array|String} roles - 允许访问的角色数组或单个角色字符串
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) { // Check for req.user and req.user.role
        // This error should ideally not happen if authenticateJWT/authenticateGateway ran successfully.
        logger.error('角色检查失败 - 用户信息缺失', {
          ip: req.ip,
          url: req.originalUrl,
          user: req.user
        });
        
        return next(new UnauthorizedError('User not authenticated or role information is missing. Ensure an authentication middleware (authenticateJWT or authenticateGateway) runs before checkRole.'));
    }
    
    // 将单个角色字符串转换为数组
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('角色权限不足', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        ip: req.ip,
        url: req.originalUrl
      });
      
      return next(new ForbiddenError(`Access denied. Your role ('${req.user.role}') is not authorized for this resource. Required roles: ${allowedRoles.join(', ')}.`));
    }
    
    // 记录权限检查通过日志
    logger.debug('角色权限检查通过', {
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: allowedRoles,
      url: req.originalUrl
    });
    
    next();
  };
};

/**
 * 生成JWT令牌
 * @param {Object} user - 用户对象
 * @param {String} type - 令牌类型 ('access' | 'refresh')
 * @returns {String} - JWT令牌
 */
const generateToken = (user, type = 'access') => {
  const payload = {
    id: user._id || user.id,
    role: user.role,
    username: user.username,
  };
  
  const jwtSecret = configManager.get('JWT_SECRET');
  const tokenExpiration = type === 'refresh' 
    ? configManager.get('JWT_REFRESH_TOKEN_EXPIRATION') 
    : configManager.get('JWT_TOKEN_EXPIRATION');

  const token = jwt.sign(payload, jwtSecret, { expiresIn: tokenExpiration });
  
  // 记录令牌生成日志
  logger.debug('JWT令牌生成', {
    userId: payload.id,
    role: payload.role,
    type: type,
    expiresIn: tokenExpiration
  });
  
  return token;
};

/**
 * 验证JWT令牌（不通过中间件）
 * @param {String} token - JWT令牌
 * @returns {Object} - 解码后的用户信息
 */
const verifyToken = (token) => {
  const jwtSecret = configManager.get('JWT_SECRET');
  return jwt.verify(token, jwtSecret);
};

module.exports = {
  authenticateJWT,
  authenticateGateway,
  checkRole,
  generateToken,
  verifyToken
};