/**
 * Jest配置文件
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: ['**/__tests__/**/*.test.js'],

  // 测试覆盖率收集
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/jest.config.js',
    '!**/jest.setup.js'
  ],

  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'clover', 'html'],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // 测试超时设置 - 增加超时时间以处理集成测试
  testTimeout: 30000,

  // 在每个测试文件执行前运行的设置文件
  setupFilesAfterEnv: ['./jest.setup.js'],

  // 忽略的路径
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // 模块名映射，用于简化导入
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },

  // 是否显示每个测试的详细信息
  verbose: true
};
