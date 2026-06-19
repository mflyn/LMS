module.exports = {
  displayName: 'user-service',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./__tests__/setup.js'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    'models/index.js', // 如果有
  ],
  collectCoverageFrom: [
    // 'app.js',
    'server.js',
    'models/**/*.js',
    'routes/**/*.js',
    'controllers/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 0, 
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/routes/auth.test.js',
    '<rootDir>/__tests__/controllers/userController.test.js',
    '<rootDir>/__tests__/validators/userValidators.test.js',
    '<rootDir>/__tests__/routes/student.direct.test.js',
    '<rootDir>/__tests__/models/User.direct.test.js',
    '<rootDir>/__tests__/models/Role.test.js',
    '<rootDir>/__tests__/controllers/studentController.test.js',
    '<rootDir>/__tests__/user.test.js',
    '<rootDir>/__tests__/student.test.js'
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^mongoose$': '<rootDir>/../../../node_modules/mongoose',
    // '^(../../../common/(.*))$': '<rootDir>/../../common/$1',
  },
};
