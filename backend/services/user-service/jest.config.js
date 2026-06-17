module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./__tests__/setup.js'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    'models/index.js', // 如果有
  ],
  collectCoverage: true,
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
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 30000, 
  moduleNameMapper: {
    '^mongoose$': '<rootDir>/../../../node_modules/mongoose',
    // '^(../../../common/(.*))$': '<rootDir>/../../common/$1',
  },
};
