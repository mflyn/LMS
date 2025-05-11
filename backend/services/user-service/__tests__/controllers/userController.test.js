const userController = require('../../controllers/userController');
const UserService = require('../../services/userService');
const { logger } = require('../../../../common/config/logger');

// 模拟依赖
jest.mock('../../services/userService');
jest.mock('../../../../common/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('UserController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 模拟请求对象
    req = {
      body: {},
      user: { id: 'user123' },
      params: {}
    };

    // 模拟响应对象
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };

    // 模拟next函数
    next = jest.fn();
  });

  describe('register', () => {
    it('应该成功注册用户并返回201状态码', async () => {
      // 准备测试数据
      req.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!'
      };

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser'
      };

      // 模拟UserService.createUser的返回值
      UserService.createUser.mockResolvedValue(mockUser);

      // 调用控制器方法
      await userController.register(req, res, next);

      // 验证结果
      expect(UserService.createUser).toHaveBeenCalledWith(req.body);
      expect(logger.info).toHaveBeenCalledWith('开始用户注册', expect.any(Object));
      expect(logger.info).toHaveBeenCalledWith('用户注册成功', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('应该处理注册过程中的错误', async () => {
      // 准备测试数据
      req.body = {
        email: 'test@example.com',
        username: 'testuser'
      };

      // 模拟UserService.createUser抛出错误
      const error = new Error('注册失败');
      UserService.createUser.mockRejectedValue(error);

      // 调用控制器方法
      await userController.register(req, res, next);

      // 验证结果
      expect(UserService.createUser).toHaveBeenCalledWith(req.body);
      expect(logger.error).toHaveBeenCalledWith('用户注册失败', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器错误',
        data: null
      });
    });
  });

  describe('login', () => {
    it('应该成功登录用户并返回token和用户信息', async () => {
      // 准备测试数据
      req.body = {
        email: 'test@example.com',
        password: 'Password123!'
      };

      const mockResponse = {
        token: 'jwt-token',
        user: {
          id: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      };

      // 模拟UserService.login的返回值
      UserService.login.mockResolvedValue(mockResponse);

      // 调用控制器方法
      await userController.login(req, res, next);

      // 验证结果
      expect(UserService.login).toHaveBeenCalledWith(req.body);
      expect(logger.info).toHaveBeenCalledWith('用户登录尝试', expect.any(Object));
      expect(logger.info).toHaveBeenCalledWith('用户登录成功', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: 'success',
        data: mockResponse
      });
    });

    it('应该处理登录过程中的错误', async () => {
      // 准备测试数据
      req.body = {
        email: 'test@example.com',
        password: 'WrongPassword'
      };

      // 模拟UserService.login抛出错误
      const error = new Error('登录失败');
      UserService.login.mockRejectedValue(error);

      // 调用控制器方法
      await userController.login(req, res, next);

      // 验证结果
      expect(UserService.login).toHaveBeenCalledWith(req.body);
      expect(logger.error).toHaveBeenCalledWith('用户登录失败', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器错误',
        data: null
      });
    });
  });

  describe('updateProfile', () => {
    it('应该成功更新用户资料', async () => {
      // 准备测试数据
      req.user = { id: 'user123' };
      req.body = {
        name: '新名字',
        bio: '个人简介'
      };

      const mockUser = {
        id: 'user123',
        name: '新名字',
        bio: '个人简介',
        email: 'test@example.com'
      };

      // 模拟UserService.updateUser的返回值
      UserService.updateUser.mockResolvedValue(mockUser);

      // 调用控制器方法
      await userController.updateProfile(req, res, next);

      // 验证结果
      expect(UserService.updateUser).toHaveBeenCalledWith('user123', req.body);
      expect(logger.info).toHaveBeenCalledWith('开始更新用户资料', expect.any(Object));
      expect(logger.info).toHaveBeenCalledWith('用户资料更新成功', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: 'success',
        data: mockUser
      });
    });

    it('应该处理更新过程中的错误', async () => {
      // 准备测试数据
      req.user = { id: 'user123' };
      req.body = {
        name: '新名字'
      };

      // 模拟UserService.updateUser抛出错误
      const error = new Error('更新失败');
      UserService.updateUser.mockRejectedValue(error);

      // 调用控制器方法
      await userController.updateProfile(req, res, next);

      // 验证结果
      expect(UserService.updateUser).toHaveBeenCalledWith('user123', req.body);
      expect(logger.error).toHaveBeenCalledWith('用户资料更新失败', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器错误',
        data: null
      });
    });
  });

  describe('getProfile', () => {
    it('应该成功获取用户资料', async () => {
      // 准备测试数据
      req.user = { id: 'user123' };

      const mockUser = {
        id: 'user123',
        name: '测试用户',
        email: 'test@example.com',
        username: 'testuser'
      };

      // 模拟UserService.getUserById的返回值
      UserService.getUserById.mockResolvedValue(mockUser);

      // 调用控制器方法
      await userController.getProfile(req, res, next);

      // 验证结果
      expect(UserService.getUserById).toHaveBeenCalledWith('user123');
      expect(logger.info).toHaveBeenCalledWith('用户资料获取成功', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: 'success',
        data: mockUser
      });
    });

    it('应该记录性能警告当查询时间超过500ms', async () => {
      // 准备测试数据
      req.user = { id: 'user123' };

      const mockUser = {
        id: 'user123',
        name: '测试用户',
        email: 'test@example.com'
      };

      // 模拟Date.now以模拟长时间查询
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1600; // 第一次调用返回1000，第二次返回1600，差值为600ms
      });

      // 模拟UserService.getUserById的返回值
      UserService.getUserById.mockResolvedValue(mockUser);

      // 调用控制器方法
      await userController.getProfile(req, res, next);

      // 验证结果
      expect(UserService.getUserById).toHaveBeenCalledWith('user123');
      expect(logger.warn).toHaveBeenCalledWith('用户资料查询性能警告', expect.any(Object));
      expect(logger.info).toHaveBeenCalledWith('用户资料获取成功', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: 'success',
        data: mockUser
      });

      // 恢复原始Date.now
      Date.now = originalDateNow;
    });

    it('应该处理获取资料过程中的错误', async () => {
      // 准备测试数据
      req.user = { id: 'user123' };

      // 模拟UserService.getUserById抛出错误
      const error = new Error('获取失败');
      UserService.getUserById.mockRejectedValue(error);

      // 调用控制器方法
      await userController.getProfile(req, res, next);

      // 验证结果
      expect(UserService.getUserById).toHaveBeenCalledWith('user123');
      expect(logger.error).toHaveBeenCalledWith('用户资料获取失败', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器错误',
        data: null
      });
    });
  });

  describe('deleteAccount', () => {
    it('应该成功删除用户账号', async () => {
      // 准备测试数据
      req.user = { id: 'user123' };
      req.body = { reason: '不再使用' };

      // 模拟UserService.deleteUser的返回值
      UserService.deleteUser.mockResolvedValue(true);

      // 调用控制器方法
      await userController.deleteAccount(req, res, next);

      // 验证结果
      expect(UserService.deleteUser).toHaveBeenCalledWith('user123');
      expect(logger.warn).toHaveBeenCalledWith('用户请求删除账号', expect.any(Object));
      expect(logger.info).toHaveBeenCalledWith('用户账号删除成功', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('应该处理删除账号过程中的错误', async () => {
      // 准备测试数据
      req.user = { id: 'user123' };
      req.body = { reason: '不再使用' };

      // 模拟UserService.deleteUser抛出错误
      const error = new Error('删除失败');
      UserService.deleteUser.mockRejectedValue(error);

      // 调用控制器方法
      await userController.deleteAccount(req, res, next);

      // 验证结果
      expect(UserService.deleteUser).toHaveBeenCalledWith('user123');
      expect(logger.error).toHaveBeenCalledWith('用户账号删除失败', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器错误',
        data: null
      });
    });
  });
});
