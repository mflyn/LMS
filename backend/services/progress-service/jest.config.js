module.exports = {
  displayName: 'progress-service',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['<rootDir>/__tests__/progress.test.js'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js']
};
