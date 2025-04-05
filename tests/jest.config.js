module.exports = {
  // 基础配置
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // 测试报告配置
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results/jest',
      outputName: 'results.xml',
    }]
  ],

  // 模块配置
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 测试超时设置
  testTimeout: 30000,

  // 并行执行
  maxWorkers: '50%',

  // 测试环境设置
  setupFiles: ['<rootDir>/tests/setup.js']
} 