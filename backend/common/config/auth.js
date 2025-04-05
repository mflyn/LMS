/**
 * 统一认证配置文件
 * 所有微服务共享此配置以确保认证机制一致性
 */

module.exports = {
  // JWT密钥，生产环境应使用环境变量
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-here',
  
  // Token过期时间
  tokenExpiration: '24h',
  
  // 刷新Token过期时间
  refreshTokenExpiration: '7d',
  
  // 认证中间件
  getAuthMiddleware: (jwt) => {
    return (req, res, next) => {
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
  },
  
  // 角色检查中间件
  getRoleCheckMiddleware: () => {
    return (roles) => {
      return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: '未认证' });
        
        if (!roles.includes(req.user.role)) {
          return res.status(403).json({ message: '权限不足' });
        }
        
        next();
      };
    };
  }
};