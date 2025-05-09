module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/test/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    '**/services/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!**/mocks/**'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/test/',
    '/mocks/'
  ],
  setupFilesAfterEnv: [
    './jest.setup.js',
    './services/user-service/test/setup.js'
  ],
  moduleNameMapper: {
    '^express-session$': '<rootDir>/services/user-service/test/mocks/express-session.js',
    '^connect-mongo$': '<rootDir>/services/user-service/test/mocks/connect-mongo.js',
    '^jsonwebtoken$': '<rootDir>/services/user-service/test/mocks/jsonwebtoken.js',
    '^bcrypt$': '<rootDir>/services/user-service/test/mocks/bcrypt.js'
  },
  verbose: true
};