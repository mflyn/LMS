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
    '<rootDir>/services/progress-service/',
    '<rootDir>/services/resource-service/__tests__/task6Startup.test.js',
    '<rootDir>/services/resource-service/__tests__/familyMedia.test.js',
    '<rootDir>/services/resource-service/__tests__/familyMediaPrivacy.test.js',
    '<rootDir>/services/resource-service/__tests__/mediaReferences.test.js',
    '<rootDir>/services/resource-service/__tests__/mediaCleanup.test.js',
    '<rootDir>/services/resource-service/__tests__/privateMediaStore.test.js',
    '<rootDir>/services/resource-service/__tests__/mediaCapability.test.js',
    '<rootDir>/services/resource-service/__tests__/mediaModels.test.js',
    '<rootDir>/services/analytics-service/__tests__/task6Startup.test.js',
    '<rootDir>/services/analytics-service/__tests__/server.test.js',
    '<rootDir>/services/analytics-service/__tests__/familyMistakes.test.js',
    '<rootDir>/services/analytics-service/__tests__/familyMistakeMediaSaga.test.js',
    '<rootDir>/services/analytics-service/__tests__/weeklyReports.test.js'
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
