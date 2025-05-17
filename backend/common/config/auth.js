/**
 * 统一认证配置文件
 * 所有微服务共享此配置以确保认证机制一致性
 */

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

const jwtSecret = process.env.JWT_SECRET;

// 建议使用更标准的时间格式或者ms库进行转换
const tokenExpiration = process.env.JWT_TOKEN_EXPIRATION || '1d'; // 例如: 1d, 2h, 30m
const refreshTokenExpiration = process.env.JWT_REFRESH_TOKEN_EXPIRATION || '7d';

module.exports = {
  jwtSecret,
  tokenExpiration,
  refreshTokenExpiration,
  
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