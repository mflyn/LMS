module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/integration/**/*.test.js'
  ],
  
  // 超时设置
  testTimeout: 30000,
  
  // 不收集覆盖率信息
  collectCoverage: false,
  
  // 在每个测试文件之前运行的设置文件
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/integration/setup.js'
  ],
  
  // 忽略的路径
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // 详细输出
  verbose: true
};
