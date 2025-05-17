module.exports = {
  testEnvironment: 'node',
  globalSetup: './__tests__/globalSetup.js',
  globalTeardown: './__tests__/globalTeardown.js',
  setupFilesAfterEnv: ['./__tests__/setup.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
  collectCoverage: true,
  collectCoverageFrom: [
    'app.js',
    'server.js',
    'models/**/*.js',
    'routes/**/*.js',
    'controllers/**/*.js',
    'services/**/*.js',
    'utils/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  verbose: true,
  forceExit: false,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 30000,
  moduleNameMapper: {
    '^../../../common/(.*)$': '<rootDir>/../../common/$1',
    '^../../user-service/(.*)$': '<rootDir>/../user-service/$1'
  }
};
