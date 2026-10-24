const manifest = require('../../../../package.json');
const lock = require('../../../../package-lock.json');

test('native deletion readiness declares the existing BSON version as a direct production dependency', () => {
  expect(manifest.dependencies.bson).toBe('6.10.3');
  expect(manifest.devDependencies.bson).toBeUndefined();
  expect(lock.packages[''].dependencies.bson).toBe('6.10.3');
  expect(lock.packages[''].devDependencies.bson).toBeUndefined();
  expect(lock.packages['node_modules/bson'].version).toBe('6.10.3');
  expect(lock.packages['node_modules/bson'].dev).not.toBe(true);
});
