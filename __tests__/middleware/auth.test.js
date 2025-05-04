const jwt = require('jsonwebtoken');
const { authenticateToken, checkRole } = require('../../middleware/auth');

// 模拟 Express 的请求和响应对象
const mockRequest = (headers = {}, user = null) => {
  const req = { headers };
  if (user) req.user = user;
  return req;
};

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// 模拟 jwt.verify
jest.mock('jsonwebtoken');

describe('认证中间件测试', () => {
  let req, res, next;

  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    next = jest.fn();
  });

  describe('authenticateToken', () => {
    it('应该在测试环境中跳过认证', () => {
      // 保存原始环境变量
      const originalEnv = process.env.NODE_ENV;
      
      // 设置测试环境
      process.env.NODE_ENV = 'test';
      
      // 创建带有用户信息的请求
      req = mockRequest({}, { id: '123', role: 'teacher' });
      res = mockResponse();
      
      // 调用中间件
      authenticateToken(req, res, next);
      
      // 验证 next 被调用
      expect(next).toHaveBeenCalled();
      
      // 恢复原始环境变量
      process.env.NODE_ENV = originalEnv;
    });

    it('应该在没有令牌时返回 401', () => {
      // 创建没有授权头的请求
      req = mockRequest();
      res = mockResponse();
      
      // 调用中间件
      authenticateToken(req, res, next);
      
      // 验证响应
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未认证' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在令牌无效时返回 403', () => {
      // 创建带有授权头的请求
      req = mockRequest({ authorization: 'Bearer invalid-token' });
      res = mockResponse();
      
      // 模拟 jwt.verify 返回错误
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('令牌无效'), null);
      });
      
      // 调用中间件
      authenticateToken(req, res, next);
      
      // 验证响应
      expect(jwt.verify).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '令牌无效或已过期' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在令牌有效时设置用户信息并调用 next', () => {
      // 创建带有授权头的请求
      req = mockRequest({ authorization: 'Bearer valid-token' });
      res = mockResponse();
      
      // 模拟用户数据
      const mockUser = { id: '123', role: 'teacher' };
      
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
      // 创建没有用户信息的请求
      req = mockRequest();
      res = mockResponse();
      
      // 创建角色检查中间件
      const roleMiddleware = checkRole(['admin', 'teacher']);
      
      // 调用中间件
      roleMiddleware(req, res, next);
      
      // 验证响应
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未认证' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在用户角色不匹配时返回 403', () => {
      // 创建带有学生角色的请求
      req = mockRequest({}, { id: '123', role: 'student' });
      res = mockResponse();
      
      // 创建只允许管理员和教师的角色检查中间件
      const roleMiddleware = checkRole(['admin', 'teacher']);
      
      // 调用中间件
      roleMiddleware(req, res, next);
      
      // 验证响应
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '权限不足' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在用户角色匹配时调用 next', () => {
      // 创建带有教师角色的请求
      req = mockRequest({}, { id: '123', role: 'teacher' });
      res = mockResponse();
      
      // 创建允许教师的角色检查中间件
      const roleMiddleware = checkRole(['admin', 'teacher']);
      
      // 调用中间件
      roleMiddleware(req, res, next);
      
      // 验证 next 被调用
      expect(next).toHaveBeenCalled();
    });
  });
});
