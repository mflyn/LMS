module.exports = {
  displayName: 'analytics-family',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/task6Startup.test.js',
    '<rootDir>/__tests__/server.test.js'
  ],
  moduleNameMapper: {
    '^axios$': '<rootDir>/node_modules/axios/index.js',
    '^joi$': '<rootDir>/node_modules/joi/lib/index.js',
    '^uuid$': '<rootDir>/../../../node_modules/uuid/dist/cjs/index.js'
  },
  clearMocks: true,
  restoreMocks: true
};
