// Shared family-growth project for common middleware, utilities, deployment
// contracts, and gateway routing tests. Keep it independently runnable.
module.exports = {
  displayName: 'family-common',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/common/**/__tests__/**/*.test.js',
    '<rootDir>/gateway/**/__tests__/**/*.test.js'
  ],
  setupFiles: ['<rootDir>/jest.family.setup.js'],
  coverageThreshold: {
    'backend/common/middleware/errorHandler.js': {
      statements: 85,
      branches: 75,
      functions: 85,
      lines: 85
    },
    'backend/common/middleware/gatewayIdentity.js': {
      statements: 95,
      branches: 80,
      functions: 100,
      lines: 95
    },
    'backend/common/repositories/familyReadRepository.js': {
      statements: 90,
      branches: 70,
      functions: 100,
      lines: 95
    },
    'backend/common/services/mediaReferenceClient.js': {
      statements: 95,
      branches: 80,
      functions: 100,
      lines: 95
    },
    'backend/common/utils/familyAccess.js': {
      statements: 95,
      branches: 85,
      functions: 100,
      lines: 95
    }
  }
};
