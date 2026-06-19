module.exports = {
  displayName: 'homework-service',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/homework.test.js',
    '<rootDir>/__tests__/integration/homework-flow.simple.test.js',
    '<rootDir>/__tests__/integration/homework-flow.test.js',
    '<rootDir>/__tests__/routes/homework.test.js',
    '<rootDir>/__tests__/server.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js']
};
