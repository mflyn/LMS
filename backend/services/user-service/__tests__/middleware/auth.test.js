const jwt = require('jsonwebtoken');
const { authenticateToken, checkRole } = require('../../middleware/auth');
const config = require('../../config');

// 模拟请求和响应对象
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

describe('认证中间件测试', () => {
  describe('authenticateToken 中间件', () => {
    it('应该在没有提供令牌时返回401', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未提供认证令牌' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在提供无效令牌时返回403', () => {
      const req = mockRequest({ authorization: 'Bearer invalid_token' });
      const res = mockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '无效的认证令牌' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在令牌过期时返回401', () => {
      // 模拟jwt.verify抛出TokenExpiredError
      jest.spyOn(jwt, 'verify').mockImplementationOnce((token, secret, callback) => {
        const error = new Error('令牌已过期');
        error.name = 'TokenExpiredError';
        callback(error);
      });

      const req = mockRequest({ authorization: 'Bearer expired_token' });
      const res = mockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '认证令牌已过期' });
      expect(next).not.toHaveBeenCalled();

      // 恢复模拟
      jwt.verify.mockRestore();
    });

    it('应该在提供有效令牌时设置req.user并调用next', () => {
      const user = { id: '123', username: 'testuser', role: 'student' };
      
      // 模拟jwt.verify成功
      jest.spyOn(jwt, 'verify').mockImplementationOnce((token, secret, callback) => {
        callback(null, user);
      });

      const req = mockRequest({ authorization: 'Bearer valid_token' });
      const res = mockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();

      // 恢复模拟
      jwt.verify.mockRestore();
    });

    it('应该正确处理不同格式的Authorization头', () => {
      const user = { id: '123', username: 'testuser', role: 'student' };
      
      // 模拟jwt.verify成功
      jest.spyOn(jwt, 'verify').mockImplementationOnce((token, secret, callback) => {
        callback(null, user);
      });

      // 测试没有Bearer前缀的情况
      const req = mockRequest({ authorization: 'valid_token' });
      const res = mockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未提供认证令牌' });
      expect(next).not.toHaveBeenCalled();

      // 恢复模拟
      jwt.verify.mockRestore();
    });
  });

  describe('checkRole 中间件', () => {
    it('应该在用户未认证时返回401', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = jest.fn();
      const middleware = checkRole(['admin', 'teacher']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未认证' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在用户角色不在允许列表中时返回403', () => {
      const req = mockRequest({}, { id: '123', username: 'testuser', role: 'student' });
      const res = mockResponse();
      const next = jest.fn();
      const middleware = checkRole(['admin', 'teacher']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '权限不足' });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该在用户角色在允许列表中时调用next', () => {
      const req = mockRequest({}, { id: '123', username: 'testuser', role: 'teacher' });
      const res = mockResponse();
      const next = jest.fn();
      const middleware = checkRole(['admin', 'teacher']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('应该正确处理空角色列表', () => {
      const req = mockRequest({}, { id: '123', username: 'testuser', role: 'admin' });
      const res = mockResponse();
      const next = jest.fn();
      const middleware = checkRole([]);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '权限不足' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
