module.exports = {
  displayName: 'resource-family',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/task6Startup.test.js',
    '<rootDir>/__tests__/mediaModels.test.js',
    '<rootDir>/__tests__/privateMediaStore.test.js',
    '<rootDir>/__tests__/mediaCapability.test.js',
    '<rootDir>/__tests__/familyMedia.test.js'
  ],
  clearMocks: true,
  restoreMocks: true
};
