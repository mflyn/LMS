const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

describe('stage 6 reproducible release gate', () => {
  test('exposes one clean-install command covering every release stage', () => {
    const packageJson = require('../../../../package.json');
    const script = read('scripts/release-family-gate.sh');

    expect(packageJson.scripts['release:family']).toBe('bash scripts/release-family-gate.sh');
    for (const command of [
      'npm ci',
      'npm run lint',
      'npm run test:family-regression',
      'npm run test:family-flow:integration',
      'npm run test:family-flow:e2e',
      'npm ci --prefix frontend/web',
      'npm run test:ci --prefix frontend/web',
      'npm run build --prefix frontend/web',
      'compose_family build',
      'compose_family up -d --wait',
      'node scripts/compose-family-smoke.js'
    ]) {
      expect(script).toContain(command);
    }
    expect(packageJson.dependencies.sharp).toBeDefined();
    expect(packageJson.devDependencies.sharp).toBeUndefined();
  });

  test('always captures diagnostics and tears down without deleting volumes', () => {
    const script = read('scripts/release-family-gate.sh');

    expect(script).toMatch(/trap\s+['"]?cleanup/);
    expect(script).toContain('compose-family-ps.txt');
    expect(script).toContain('compose-family.log');
    expect(script).toContain('compose_family down --remove-orphans');
    expect(script).not.toMatch(/compose_family down[^\n]*(?:--volumes|-v(?:\s|$))/);
  });

  test('the family stack has health checks and seeds public family roles', () => {
    const compose = yaml.load(read('docker-compose.family.yml'));
    const services = compose.services;

    for (const serviceName of [
      'gateway',
      'user-service',
      'progress-service',
      'homework-service',
      'resource-service',
      'analytics-service',
      'notification-service',
      'mongo'
    ]) {
      expect(services[serviceName].healthcheck).toBeDefined();
    }
    for (const serviceName of [
      'gateway',
      'user-service',
      'progress-service',
      'homework-service',
      'resource-service',
      'analytics-service',
      'notification-service'
    ]) {
      expect(services[serviceName].environment).toContain(
        'JWT_SECRET=${JWT_SECRET:-dev-jwt-secret-32-characters-minimum}'
      );
    }
    const mongoHealthCommand = services.mongo.healthcheck.test.join(' ');
    expect(mongoHealthCommand).toContain("db.adminCommand('ping').ok");
    expect(mongoHealthCommand).not.toContain('isWritablePrimary');
    expect(services['mongo-init'].depends_on.mongo.condition).toBe('service_healthy');
    const mongoInitCommand = services['mongo-init'].command.join('\n');
    expect(mongoInitCommand).toContain('if (!rs.status().ok)');
    expect(mongoInitCommand).toContain('rs.initiate');
    expect(mongoInitCommand).toContain('db.roles.updateOne');
    expect(services.gateway.ports).toContain('${FAMILY_GATEWAY_HOST_PORT:-3000}:3000');
  });

  test('CI runs the same release command on Node 22 and uploads diagnostics', () => {
    const workflow = read('.github/workflows/ci-cd.yml');

    expect(workflow).toContain("NODE_VERSION: '22'");
    expect(workflow).toContain('npm run release:family');
    expect(workflow).toContain('release-gate-artifacts');
    expect(workflow).toContain('if: always()');
  });
});
