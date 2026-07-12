// Backend regression test matrix. Family projects are the active family-growth
// baseline; legacy projects remain only to guard locked school-version behavior.
module.exports = {
  projects: [
    '<rootDir>/jest.family-common.config.js',
    '<rootDir>/services/user-service/jest.config.js',
    '<rootDir>/services/homework-service/jest.config.js',
    '<rootDir>/services/progress-service/jest.config.js',
    '<rootDir>/services/resource-service/jest.family.config.js',
    '<rootDir>/services/analytics-service/jest.family.config.js',
    '<rootDir>/services/notification-service/jest.family.config.js',
    '<rootDir>/services/progress-service/jest.legacy.config.js',
    '<rootDir>/jest.legacy.config.js'
  ]
};
