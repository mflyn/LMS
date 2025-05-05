/**
 * 配置文件测试
 */

const config = require('../config');

describe('配置文件测试', () => {
  it('应该导出配置对象', () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('应该包含 mongoURI 配置', () => {
    expect(config).toHaveProperty('mongoURI');
    expect(typeof config.mongoURI).toBe('string');
  });

  it('应该包含 jwtSecret 配置', () => {
    expect(config).toHaveProperty('jwtSecret');
    expect(typeof config.jwtSecret).toBe('string');
  });

  it('应该包含 tokenExpiration 配置', () => {
    expect(config).toHaveProperty('tokenExpiration');
    expect(typeof config.tokenExpiration).toBe('string');
  });

  it('应该使用环境变量覆盖默认值', () => {
    // 保存原始环境变量
    const originalMongoURI = process.env.MONGO_URI;
    const originalJwtSecret = process.env.JWT_SECRET;

    // 设置测试环境变量
    process.env.MONGO_URI = 'mongodb://test-server/test-db';
    process.env.JWT_SECRET = 'test-secret-key';

    // 重新加载配置模块
    jest.resetModules();
    const freshConfig = require('../config');

    // 验证环境变量被正确使用
    expect(freshConfig.mongoURI).toBe('mongodb://test-server/test-db');
    expect(freshConfig.jwtSecret).toBe('test-secret-key');

    // 恢复原始环境变量
    process.env.MONGO_URI = originalMongoURI;
    process.env.JWT_SECRET = originalJwtSecret;
  });
});
