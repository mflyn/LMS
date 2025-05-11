const { AuthService } = require('../../../common/services/authService');
const User = require('../../../common/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createMockLogger } = require('../../../common/test/testUtils');

// 模拟依赖
jest.mock('../../../common/models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService;
  const mockLogger = createMockLogger();

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService({ logger: mockLogger });
  });

  describe('register', () => {
    test('应成功注册新用户', async () => {
      // 准备
      const userData = {
        username: 'testuser',
        password: 'Password123!',
        email: 'test@example.com',
        role: 'student'
      };

      const hashedPassword = 'hashed_password';
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const savedUser = {
        _id: 'user_id',
        username: userData.username,
        email: userData.email,
        role: userData.role,
        save: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(null); // 用户不存在
      User.mockImplementation(() => savedUser);

      // 执行
      const result = await authService.register(userData);

      // 验证
      expect(User.findOne).toHaveBeenCalledWith({ username: userData.username });
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(User).toHaveBeenCalledWith({
        username: userData.username,
        password: hashedPassword,
        email: userData.email,
        role: userData.role
      });
      expect(savedUser.save).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        user: savedUser
      });
    });

    test('用户名已存在时应返回错误', async () => {
      // 准备
      const userData = {
        username: 'existinguser',
        password: 'Password123!',
        email: 'test@example.com'
      };

      User.findOne.mockResolvedValue({ username: userData.username }); // 用户已存在

      // 执行与验证
      await expect(authService.register(userData))
        .rejects
        .toThrow('用户名已存在');

      expect(User.findOne).toHaveBeenCalledWith({ username: userData.username });
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    test('应成功登录并返回token', async () => {
      // 准备
      const credentials = {
        username: 'testuser',
        password: 'Password123!'
      };

      const foundUser = {
        _id: 'user_id',
        username: credentials.username,
        password: 'hashed_password',
        role: 'student'
      };

      User.findOne.mockResolvedValue(foundUser);
      bcrypt.compare.mockResolvedValue(true); // 密码匹配

      const mockToken = 'jwt_token';
      jwt.sign.mockReturnValue(mockToken);

      // 执行
      const result = await authService.login(credentials);

      // 验证
      expect(User.findOne).toHaveBeenCalledWith({ username: credentials.username });
      expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, foundUser.password);
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: foundUser._id, role: foundUser.role },
        expect.any(String),
        { expiresIn: expect.any(String) }
      );
      expect(result).toEqual({
        token: mockToken,
        user: {
          id: foundUser._id,
          username: foundUser.username,
          role: foundUser.role
        }
      });
    });

    test('用户不存在时应返回错误', async () => {
      // 准备
      const credentials = {
        username: 'nonexistentuser',
        password: 'Password123!'
      };

      User.findOne.mockResolvedValue(null); // 用户不存在

      // 执行与验证
      await expect(authService.login(credentials))
        .rejects
        .toThrow('用户名或密码不正确');

      expect(User.findOne).toHaveBeenCalledWith({ username: credentials.username });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test('密码不正确时应返回错误', async () => {
      // 准备
      const credentials = {
        username: 'testuser',
        password: 'WrongPassword!'
      };

      const foundUser = {
        _id: 'user_id',
        username: credentials.username,
        password: 'hashed_password'
      };

      User.findOne.mockResolvedValue(foundUser);
      bcrypt.compare.mockResolvedValue(false); // 密码不匹配

      // 执行与验证
      await expect(authService.login(credentials))
        .rejects
        .toThrow('用户名或密码不正确');

      expect(User.findOne).toHaveBeenCalledWith({ username: credentials.username });
      expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, foundUser.password);
    });
  });
});