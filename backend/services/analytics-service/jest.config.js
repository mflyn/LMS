module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^axios$': '<rootDir>/node_modules/axios/index.js',
    '^joi$': '<rootDir>/node_modules/joi/lib/index.js'
  },
  setupFilesAfterEnv: ['./jest.setup.js']
};
