module.exports = {
  displayName: 'resource-family',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/task6Startup.test.js',
    '<rootDir>/__tests__/mediaModels.test.js',
    '<rootDir>/__tests__/privateMediaStore.test.js'
  ],
  clearMocks: true,
  restoreMocks: true
};
