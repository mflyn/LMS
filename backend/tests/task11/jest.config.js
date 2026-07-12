module.exports = {
  displayName: 'task11-family-flow',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.integration.test.js'],
  setupFiles: ['<rootDir>/testEnvironment.js'],
  testTimeout: 90000,
  clearMocks: true,
  restoreMocks: true
};
