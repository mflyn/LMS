/**
 * 配置文件单元测试
 */

describe('配置文件测试', () => {
  // 保存原始环境变量
  const originalEnv = process.env;

  beforeEach(() => {
    // 清除环境变量缓存
    jest.resetModules();
    // 清除环境变量
    process.env = { ...originalEnv };
    delete process.env.MONGO_URI;
    delete process.env.JWT_SECRET;
  });

  afterAll(() => {
    // 恢复环境变量
    process.env = originalEnv;
  });

  it('应该使用默认的MongoDB连接字符串', () => {
    const config = require('../config');
    expect(config.mongoURI).toBe('mongodb://localhost:27017/student-tracking-system');
  });

  it('应该使用环境变量中的MongoDB连接字符串', () => {
    process.env.MONGO_URI = 'mongodb://testdb:27017/test-db';
    const config = require('../config');
    expect(config.mongoURI).toBe('mongodb://testdb:27017/test-db');
  });

  it('应该使用默认的JWT密钥', () => {
    const config = require('../config');
    expect(config.jwtSecret).toBe('your-secret-key-here');
  });

  it('应该使用环境变量中的JWT密钥', () => {
    process.env.JWT_SECRET = 'test-secret-key';
    const config = require('../config');
    expect(config.jwtSecret).toBe('test-secret-key');
  });

  it('应该有正确的令牌过期时间', () => {
    const config = require('../config');
    expect(config.tokenExpiration).toBe('24h');
  });
});
