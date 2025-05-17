module.exports = {
  testEnvironment: 'node',
  globalSetup: './__tests__/globalSetup.js',
  globalTeardown: './__tests__/globalTeardown.js',
  setupFilesAfterEnv: ['./__tests__/setup.js'], // 在测试环境建立后，但在测试文件执行前运行
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    'models/index.js', // 如果有模型导出入口文件，可以忽略
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    // 'app.js', // 如果 data-service 有 app.js
    'server.js', // 如果 data-service 有 server.js
    'models/**/*.js',
    'routes/**/*.js',
    'controllers/**/*.js',
    'services/**/*.js',
    'utils/**/*.js', // 如果 data-service 有自己的 utils
    'middleware/**/*.js' // 如果 data-service 有自己的 middleware
  ],
  coverageThreshold: {
    global: {
      branches: 0, // 根据您的覆盖率目标设置
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testMatch: [
    '**/__tests__/**/*.test.js', // 匹配 __tests__ 目录下的 .test.js 文件
    '**/__tests__/**/*.spec.js', // 也匹配 .spec.js 文件
  ],
  verbose: true,
  forceExit: false, // 通常不推荐，除非有特殊原因，globalTeardown 应能正常退出
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 30000, // 测试超时时间，例如 30 秒
  moduleNameMapper: {
    // 如果需要路径映射，例如映射到 common 目录
    // '^(../../../common/(.*))$': '<rootDir>/../../common/$1',
    // 示例：如果 data-service 内部有更深层级的引用需要简化
    // '^@models/(.*)$': '<rootDir>/models/$1',
    // '^@utils/(.*)$': '<rootDir>/utils/$1',
  },
}; 