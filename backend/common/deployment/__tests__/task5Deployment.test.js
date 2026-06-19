const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const yaml = require('js-yaml');

const repositoryRoot = path.resolve(__dirname, '../../../..');

const readYaml = (relativePath) => yaml.load(
  fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
);

const environmentMap = (entries) => Object.fromEntries(
  entries.map((entry) => {
    const separator = entry.indexOf('=');
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  })
);

describe('Task 5 deployment contracts', () => {
  test.each(['docker-compose.yml', 'docker-compose.china.yml'])(
    '%s uses the same externally supplied JWT secret for signing and verification',
    (composePath) => {
      const compose = readYaml(composePath);
      const gatewayEnvironment = environmentMap(compose.services.gateway.environment);
      const userEnvironment = environmentMap(compose.services['user-service'].environment);

      expect(userEnvironment.JWT_SECRET).toBe('${JWT_SECRET:?set JWT_SECRET}');
      expect(userEnvironment.JWT_SECRET).toBe(gatewayEnvironment.JWT_SECRET);
    }
  );

  test('external family growth Secret workflow renders every required key without writing a file', () => {
    const script = path.join(repositoryRoot, 'deployment/kubernetes/create-family-growth-secrets.sh');
    const output = execFileSync(script, ['--dry-run'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        JWT_SECRET: 'j'.repeat(32),
        GATEWAY_IDENTITY_SECRET: 'g'.repeat(32),
        INTERNAL_SERVICE_TOKEN: 'i'.repeat(32)
      }
    });
    const secret = yaml.load(output);

    expect(secret).toMatchObject({
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'family-growth-secrets' }
    });
    expect(Object.keys(secret.data).sort()).toEqual([
      'gateway-identity-secret',
      'internal-service-token',
      'jwt-secret'
    ]);
    expect(fs.existsSync(path.join(repositoryRoot, 'deployment/kubernetes/family-growth-secrets.yaml')))
      .toBe(false);
  });
});
