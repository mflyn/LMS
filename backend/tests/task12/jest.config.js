module.exports = {
  displayName: 'task12-co-parent-flow',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.integration.test.js'],
  setupFiles: ['<rootDir>/../task11/testEnvironment.js'],
  testTimeout: 90000,
  clearMocks: true,
  restoreMocks: true
};
