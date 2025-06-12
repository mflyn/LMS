const { validationResult } = require('express-validator');
const {
  registerValidation,
  loginValidation,
  emailPhoneLoginValidation
} = require('../requestValidator');

// 模拟 express 请求和响应对象
const mockRequest = (body = {}) => ({
  body
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

// 辅助函数：运行验证并获取错误
const runValidation = async (validations, req) => {
  for (let validation of validations) {
    await validation.run(req);
  }
  return validationResult(req);
};

describe('请求验证器测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerValidation 注册验证', () => {
    it('应该通过有效的邮箱注册数据', async () => {
      const req = mockRequest({
        username: 'testuser',
        password: 'Test123!@#',
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(true);
    });

    it('应该通过有效的手机号注册数据', async () => {
      const req = mockRequest({
        username: 'phoneuser',
        password: 'Test123!@#',
        phone: '13800138000',
        role: 'student',
        name: '手机号用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(true);
    });

    it('应该通过有效的混合注册数据', async () => {
      const req = mockRequest({
        username: 'mixeduser',
        password: 'Test123!@#',
        email: 'mixed@example.com',
        phone: '13900139000',
        role: 'student',
        name: '混合用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(true);
    });

    it('应该拒绝既没有邮箱也没有手机号的数据', async () => {
      const req = mockRequest({
        username: 'invaliduser',
        password: 'Test123!@#',
        role: 'student',
        name: '无效用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.msg.includes('至少提供一种联系方式'))).toBe(true);
    });

    it('应该拒绝无效的邮箱格式', async () => {
      const req = mockRequest({
        username: 'testuser',
        password: 'Test123!@#',
        email: 'invalid-email',
        role: 'student',
        name: '测试用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'email')).toBe(true);
    });

    it('应该拒绝无效的手机号格式', async () => {
      const req = mockRequest({
        username: 'phoneuser',
        password: 'Test123!@#',
        phone: '12345678901', // 无效格式
        role: 'student',
        name: '手机号用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'phone')).toBe(true);
    });

    it('应该拒绝缺少必填字段的数据', async () => {
      const req = mockRequest({
        // 缺少 username
        password: 'Test123!@#',
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'username')).toBe(true);
    });

    it('应该验证密码强度', async () => {
      const req = mockRequest({
        username: 'testuser',
        password: 'weak', // 弱密码
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'password')).toBe(true);
    });

    it('应该验证角色枚举值', async () => {
      const req = mockRequest({
        username: 'testuser',
        password: 'Test123!@#',
        email: 'test@example.com',
        role: 'invalid_role', // 无效角色
        name: '测试用户'
      });

      const result = await runValidation(registerValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'role')).toBe(true);
    });
  });

  describe('loginValidation 用户名登录验证', () => {
    it('应该通过有效的登录数据', async () => {
      const req = mockRequest({
        username: 'testuser',
        password: 'Test123!@#'
      });

      const result = await runValidation(loginValidation, req);
      expect(result.isEmpty()).toBe(true);
    });

    it('应该拒绝缺少用户名的数据', async () => {
      const req = mockRequest({
        password: 'Test123!@#'
      });

      const result = await runValidation(loginValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'username')).toBe(true);
    });

    it('应该拒绝缺少密码的数据', async () => {
      const req = mockRequest({
        username: 'testuser'
      });

      const result = await runValidation(loginValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'password')).toBe(true);
    });
  });

  describe('emailPhoneLoginValidation 邮箱/手机号登录验证', () => {
    it('应该通过有效的邮箱登录数据', async () => {
      const req = mockRequest({
        identifier: 'test@example.com',
        password: 'Test123!@#'
      });

      const result = await runValidation(emailPhoneLoginValidation, req);
      expect(result.isEmpty()).toBe(true);
    });

    it('应该通过有效的手机号登录数据', async () => {
      const req = mockRequest({
        identifier: '13800138000',
        password: 'Test123!@#'
      });

      const result = await runValidation(emailPhoneLoginValidation, req);
      expect(result.isEmpty()).toBe(true);
    });

    it('应该拒绝无效格式的标识符', async () => {
      const req = mockRequest({
        identifier: 'invalid-identifier',
        password: 'Test123!@#'
      });

      const result = await runValidation(emailPhoneLoginValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'identifier')).toBe(true);
    });

    it('应该拒绝缺少标识符的数据', async () => {
      const req = mockRequest({
        password: 'Test123!@#'
      });

      const result = await runValidation(emailPhoneLoginValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'identifier')).toBe(true);
    });

    it('应该拒绝缺少密码的数据', async () => {
      const req = mockRequest({
        identifier: 'test@example.com'
      });

      const result = await runValidation(emailPhoneLoginValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'password')).toBe(true);
    });

    it('应该拒绝空的标识符', async () => {
      const req = mockRequest({
        identifier: '',
        password: 'Test123!@#'
      });

      const result = await runValidation(emailPhoneLoginValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'identifier')).toBe(true);
    });

    it('应该拒绝空的密码', async () => {
      const req = mockRequest({
        identifier: 'test@example.com',
        password: ''
      });

      const result = await runValidation(emailPhoneLoginValidation, req);
      expect(result.isEmpty()).toBe(false);
      
      const errors = result.array();
      expect(errors.some(error => error.path === 'password')).toBe(true);
    });
  });

  describe('手机号格式验证', () => {
    const validPhones = [
      '13800138000',
      '15912345678',
      '18888888888',
      '17700177000',
      '19900199000'
    ];

    const invalidPhones = [
      '12800138000', // 不是1[3-9]开头
      '1380013800',  // 少一位
      '138001380001', // 多一位
      'abcdefghijk',  // 非数字
      '10800138000', // 第二位不是3-9
      '11800138000'  // 第二位不是3-9
    ];

    it('应该接受有效的中国手机号格式', async () => {
      for (const phone of validPhones) {
        const req = mockRequest({
          username: 'phoneuser',
          password: 'Test123!@#',
          phone: phone,
          role: 'student',
          name: '手机号用户'
        });

        const result = await runValidation(registerValidation, req);
        expect(result.isEmpty()).toBe(true);
      }
    });

    it('应该拒绝无效的手机号格式', async () => {
      for (const phone of invalidPhones) {
        const req = mockRequest({
          username: 'phoneuser',
          password: 'Test123!@#',
          phone: phone,
          role: 'student',
          name: '手机号用户'
        });

        const result = await runValidation(registerValidation, req);
        expect(result.isEmpty()).toBe(false);
        
        const errors = result.array();
        expect(errors.some(error => error.path === 'phone')).toBe(true);
      }
    });
  });
}); 