const jwt = require('jsonwebtoken');
const { authenticateToken, checkRole } = require('../../middleware/auth');

// 模拟 jwt 模块
jest.mock('jsonwebtoken');

describe('认证中间件测试', () => {
  let req, res, next;
  
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 模拟请求、响应和下一个中间件
    req = {
      headers: {},
      user: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });
  
  describe('authenticateToken', () => {
    it('应该在测试环境中跳过认证', () => {
      // 设置测试环境
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      // 设置用户信息
      req.user = { id: '123', role: 'admin' };
      
      // 调用中间件
      authenticateToken(req, res, next);
      
      // 验证结果
      expect(next).toHaveBeenCalled();
      expect(jwt.verify).not.toHaveBeenCalled();
      
      // 恢复环境
      process.env.NODE_ENV = originalEnv;
    });
    
    it('应该在没有令牌时返回 401', () => {
      // 调用中间件
      authenticateToken(req, res, next);
      
      // 验证结果
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未认证' });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('应该在令牌无效时返回 403', () => {
      // 设置请求头
      req.headers['authorization'] = 'Bearer invalid-token';
      
      // 模拟 jwt.verify 返回错误
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('令牌无效'), null);
      });
      
      // 调用中间件
      authenticateToken(req, res, next);
      
      // 验证结果
      expect(jwt.verify).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '令牌无效或已过期' });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('应该在令牌有效时设置用户信息并调用 next', () => {
      // 设置请求头
      req.headers['authorization'] = 'Bearer valid-token';
      
      // 模拟用户数据
      const mockUser = { id: '123', role: 'admin' };
      
      // 模拟 jwt.verify 返回用户数据
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, mockUser);
      });
      
      // 调用中间件
      authenticateToken(req, res, next);
      
      // 验证结果
      expect(jwt.verify).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('checkRole', () => {
    it('应该在没有用户信息时返回 401', () => {
      // 创建中间件
      const middleware = checkRole(['admin']);
      
      // 调用中间件
      middleware(req, res, next);
      
      // 验证结果
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未认证' });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('应该在用户角色不匹配时返回 403', () => {
      // 设置用户信息
      req.user = { id: '123', role: 'user' };
      
      // 创建中间件
      const middleware = checkRole(['admin']);
      
      // 调用中间件
      middleware(req, res, next);
      
      // 验证结果
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '权限不足' });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('应该在用户角色匹配时调用 next', () => {
      // 设置用户信息
      req.user = { id: '123', role: 'admin' };
      
      // 创建中间件
      const middleware = checkRole(['admin', 'superadmin']);
      
      // 调用中间件
      middleware(req, res, next);
      
      // 验证结果
      expect(next).toHaveBeenCalled();
    });
  });
});
