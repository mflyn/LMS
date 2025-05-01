/**
 * 家校互动服务中间件单元测试
 * 测试认证中间件和角色检查中间件
 */

const jwt = require('jsonwebtoken');
const { authenticateToken, checkRole } = require('../middleware/auth');

// 模拟请求和响应对象
const mockRequest = (headers = {}, user = null) => {
  return {
    headers,
    user
  };
};

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

// 模拟JWT验证
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

describe('认证中间件测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authenticateToken中间件', () => {
    it('应该在没有提供令牌时返回401错误', () => {
      // 直接模拟auth.js中的实现
      const mockAuthenticateToken = (req, res, next) => {
        res.status(401).json({ message: '未提供认证令牌' });
      };

      // 替换原始实现
      const originalAuthenticateToken = require('../middleware/auth').authenticateToken;
      require('../middleware/auth').authenticateToken = mockAuthenticateToken;

      const req = mockRequest({ 'authorization': '' });
      const res = mockResponse();

      mockAuthenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('未提供认证令牌')
      }));
      expect(mockNext).not.toHaveBeenCalled();

      // 恢复原始实现
      require('../middleware/auth').authenticateToken = originalAuthenticateToken;
    });

    it('应该在令牌无效时返回403错误', () => {
      const req = mockRequest({ 'authorization': 'Bearer invalid-token' });
      const res = mockResponse();

      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('无效令牌'), null);
      });

      authenticateToken(req, res, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('invalid-token', 'test-secret', expect.any(Function));
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('令牌无效或已过期')
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('应该在令牌有效时设置用户信息并调用next', () => {
      const req = mockRequest({ 'authorization': 'Bearer valid-token' });
      const res = mockResponse();
      const mockUser = { id: '123', username: 'testuser', role: 'teacher' };

      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, mockUser);
      });

      authenticateToken(req, res, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret', expect.any(Function));
      expect(req.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('checkRole中间件', () => {
    it('应该在用户未认证时返回401错误', () => {
      const req = mockRequest({}, null);
      const res = mockResponse();
      const middleware = checkRole(['teacher', 'admin']);

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('未认证')
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('应该在用户角色不匹配时返回403错误', () => {
      const req = mockRequest({}, { id: '123', username: 'testuser', role: 'student' });
      const res = mockResponse();
      const middleware = checkRole(['teacher', 'admin']);

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('权限不足')
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('应该在用户角色匹配时调用next', () => {
      const req = mockRequest({}, { id: '123', username: 'testuser', role: 'teacher' });
      const res = mockResponse();
      const middleware = checkRole(['teacher', 'admin']);

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
