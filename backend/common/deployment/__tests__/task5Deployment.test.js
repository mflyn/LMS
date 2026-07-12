const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const yaml = require('js-yaml');

const repositoryRoot = path.resolve(__dirname, '../../../..');

const readYaml = (relativePath) => yaml.load(
  fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
);

const readDeployment = (relativePath) => {
  const documents = [];
  yaml.loadAll(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'), (document) => {
    if (document) documents.push(document);
  });
  return documents.find((document) => document.kind === 'Deployment');
};

const environmentMap = (entries) => Object.fromEntries(
  entries.map((entry) => {
    const separator = entry.indexOf('=');
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  })
);

describe('Task 5 deployment contracts', () => {
  test('TC-T5-REG-003 root regression isolates family Mongo suites from legacy projects', () => {
    const packageJson = require('../../../../package.json');

    expect(packageJson.scripts['test:nocoverage'])
      .toBe('npm run test:family-regression && npm run test:legacy-regression');
    expect(packageJson.scripts['test:family-regression']).toContain(
      '--selectProjects family-common user-service homework-service progress-service resource-family analytics-family notification-family --runInBand'
    );
    expect(packageJson.scripts['test:legacy-regression']).toContain(
      '--selectProjects progress-legacy legacy'
    );
  });

  test.each(['docker-compose.yml', 'docker-compose.china.yml'])(
    'TC-T5-DEPLOY-001 %s uses the same externally supplied JWT secret for signing and verification',
    (composePath) => {
      const compose = readYaml(composePath);
      const gatewayEnvironment = environmentMap(compose.services.gateway.environment);
      const userEnvironment = environmentMap(compose.services['user-service'].environment);

      expect(userEnvironment.JWT_SECRET).toBe('${JWT_SECRET:?set JWT_SECRET}');
      expect(userEnvironment.JWT_SECRET).toBe(gatewayEnvironment.JWT_SECRET);
    }
  );

  test('TC-T5-DEPLOY-002 Secret dry-run validates without exposing credentials', () => {
    const script = path.join(repositoryRoot, 'deployment/kubernetes/create-family-growth-secrets.sh');
    const credentials = {
      JWT_SECRET: 'dry-run-jwt-secret-value-123456789',
      GATEWAY_IDENTITY_SECRET: 'dry-run-gateway-secret-value-12345',
      INTERNAL_SERVICE_TOKEN: 'dry-run-internal-token-value-123456',
      MEDIA_REFERENCE_SERVICE_TOKEN: 'dry-run-media-reference-token-123456'
    };
    const output = execFileSync(script, ['--dry-run'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...credentials
      }
    });

    expect(output).toBe('family-growth-secrets validation passed for namespace default\n');
    for (const credential of Object.values(credentials)) {
      expect(output).not.toContain(credential);
      expect(output).not.toContain(Buffer.from(credential).toString('base64'));
    }
    expect(fs.existsSync(path.join(repositoryRoot, 'deployment/kubernetes/family-growth-secrets.yaml')))
      .toBe(false);
  });

  test.each([
    ['gateway-deployment.yaml', ['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET']],
    ['user-service-deployment.yaml', ['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET']],
    ['progress-service-deployment.yaml', ['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET', 'INTERNAL_SERVICE_TOKEN']],
    ['homework-service-deployment.yaml', ['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET', 'INTERNAL_SERVICE_TOKEN']],
    ['interaction-service-deployment.yaml', ['GATEWAY_IDENTITY_SECRET']],
    ['resource-service-deployment.yaml', ['GATEWAY_IDENTITY_SECRET']]
  ])('TC-T5-DEPLOY-002 %s resolves required external Secret keys', (file, names) => {
    const deployment = readDeployment(`deployment/kubernetes/${file}`);
    const environment = Object.fromEntries(
      deployment.spec.template.spec.containers[0].env.map((entry) => [entry.name, entry])
    );

    for (const name of names) {
      expect(environment[name].valueFrom.secretKeyRef.name).toBe('family-growth-secrets');
    }
  });
});
