module.exports = {
  displayName: 'legacy',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/test/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/common/',
    '<rootDir>/gateway/',
    '<rootDir>/services/user-service/',
    '<rootDir>/services/homework-service/',
    '<rootDir>/services/progress-service/'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/services/user-service/test/setup.js'
  ],
  moduleNameMapper: {
    '^express-session$': '<rootDir>/services/user-service/test/mocks/express-session.js',
    '^connect-mongo$': '<rootDir>/services/user-service/test/mocks/connect-mongo.js',
    '^jsonwebtoken$': '<rootDir>/services/user-service/test/mocks/jsonwebtoken.js',
    '^bcrypt$': '<rootDir>/services/user-service/test/mocks/bcrypt.js'
  }
};
