module.exports = {
  displayName: 'resource-family',
  rootDir: '.',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^uuid$': '<rootDir>/../../../node_modules/uuid/dist/cjs/index.js'
  },
  testMatch: [
    '<rootDir>/__tests__/task6Startup.test.js',
    '<rootDir>/__tests__/mediaModels.test.js',
    '<rootDir>/__tests__/mediaSecurity.test.js',
    '<rootDir>/__tests__/clamAvScanner.test.js',
    '<rootDir>/__tests__/privateMediaProcessor.test.js',
    '<rootDir>/__tests__/privateMediaStore.test.js',
    '<rootDir>/__tests__/mediaCapability.test.js',
    '<rootDir>/__tests__/familyMedia.test.js',
    '<rootDir>/__tests__/mediaReferences.test.js',
    '<rootDir>/__tests__/mediaCleanup.test.js',
    '<rootDir>/__tests__/familyMediaPrivacy.test.js'
  ],
  clearMocks: true,
  restoreMocks: true
};
