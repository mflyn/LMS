/**
 * 通用Jest测试配置文件
 * 可被各个微服务继承和扩展
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  
  // 测试覆盖率收集
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'routes/**/*.js',
    'models/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**'
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
  
  // 测试超时设置
  testTimeout: 10000,
  
  // 在每个测试文件执行前运行的设置文件
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // 忽略的路径
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  
  // 模块名映射，用于简化导入
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // 是否显示每个测试的详细信息
  verbose: true
};