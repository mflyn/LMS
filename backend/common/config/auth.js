/**
 * 统一认证配置文件
 * 所有微服务共享此配置以确保认证机制一致性
 * 现在使用统一配置管理器
 */

const { configManager } = require('./index');

// 验证必需的认证配置
configManager.validateRequiredConfig(['JWT_SECRET']);

module.exports = {
  get jwtSecret() {
    return configManager.get('JWT_SECRET');
  },
  
  get tokenExpiration() {
    return configManager.get('JWT_TOKEN_EXPIRATION', '1d');
  },
  
  get refreshTokenExpiration() {
    return configManager.get('JWT_REFRESH_TOKEN_EXPIRATION', '7d');
  },
  
  // 认证中间件
  // getAuthMiddleware: (jwt) => {
  //   return (req, res, next) => {
  //     // 从请求头获取用户信息（由API网关添加）
  //     if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
  //       return res.status(401).json({ message: '未认证' });
  //     }
      
  //     req.user = {
  //       id: req.headers['x-user-id'],
  //       role: req.headers['x-user-role']
  //     };
      
  //     next();
  //   };
  // },
  
  // // 角色检查中间件
  // getRoleCheckMiddleware: () => {
  //   return (roles) => {
  //     return (req, res, next) => {
  //       if (!req.user) return res.status(401).json({ message: '未认证' });
        
  //       if (!roles.includes(req.user.role)) {
  //         return res.status(403).json({ message: '权限不足' });
  //       }
        
  //       next();
  //     };
  //   };
  // }
};