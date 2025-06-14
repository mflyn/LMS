const jwt = require('jsonwebtoken');
const { AppError } = require('../../../common/middleware/errorTypes');

/**
 * JWT认证中间件
 * 验证请求中的JWT token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: '访问令牌缺失'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        status: 'error',
        message: '无效的访问令牌'
      });
    }
    req.user = user;
    next();
  });
};

/**
 * 角色检查中间件
 * 检查用户是否具有所需的角色权限
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: '用户未认证'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: '权限不足'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  checkRole
}; 