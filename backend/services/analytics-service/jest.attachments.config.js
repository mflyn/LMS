module.exports = {
  displayName: 'analytics-attachments',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/familyMistakes.test.js',
    '<rootDir>/__tests__/familyMistakeMediaSaga.test.js'
  ],
  moduleNameMapper: {
    '^axios$': '<rootDir>/../../../node_modules/axios/dist/node/axios.cjs',
    '^joi$': '<rootDir>/../../../node_modules/joi/lib/index.js',
    '^uuid$': '<rootDir>/../../../node_modules/uuid/dist/cjs/index.js'
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
