module.exports = {
  displayName: 'family-common',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/common/**/__tests__/**/*.test.js',
    '<rootDir>/gateway/**/__tests__/**/*.test.js'
  ],
  setupFiles: ['<rootDir>/jest.family.setup.js']
};
