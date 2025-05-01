/**
 * 认证和授权中间件
 */

const jwt = require('jsonwebtoken');

/**
 * JWT认证中间件
 * 验证请求头中的令牌，并将用户信息添加到请求对象
 */
const authenticateToken = (req, res, next) => {
  // 如果是测试环境，并且已经设置了用户信息，则跳过认证
  if (process.env.NODE_ENV === 'test' && req.user) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ message: '未认证' });

  jwt.verify(token, process.env.JWT_SECRET || 'test-secret', (err, user) => {
    if (err) return res.status(403).json({ message: '令牌无效或已过期' });
    req.user = user;
    next();
  });
};

/**
 * 角色检查中间件
 * 验证用户是否具有所需角色
 * @param {Array} roles 允许的角色列表
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

module.exports = {
  authenticateToken,
  checkRole
};
