const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const yaml = require('js-yaml');

const repositoryRoot = path.resolve(__dirname, '../../../..');

const kubectlAvailable = (() => {
  try {
    execSync('kubectl version --client', { encoding: 'utf8', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

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
      '--selectProjects family-common user-service homework-service progress-service resource-family analytics-family analytics-attachments notification-family --runInBand'
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
      expect(gatewayEnvironment.DATA_SERVICE_URL).toBe('http://data-service:3008');
      expect(compose.services.gateway.depends_on).toContain('data-service');
    }
  );

  test.each(['docker-compose.yml', 'docker-compose.china.yml'])(
    'TC-CONFIG-001 %s configures gateway with GATEWAY_PORT instead of legacy PORT',
    (composePath) => {
      const compose = readYaml(composePath);
      const gatewayEnvironment = environmentMap(compose.services.gateway.environment);

      expect(gatewayEnvironment.GATEWAY_PORT).toBe('3000');
      expect(gatewayEnvironment.PORT).toBeUndefined();
    }
  );

  test('TC-CONFIG-001 Kubernetes gateway configures GATEWAY_PORT and omits paused service URLs', () => {
    const deployment = readDeployment('deployment/kubernetes/gateway-deployment.yaml');
    const environment = Object.fromEntries(
      deployment.spec.template.spec.containers[0].env.map((entry) => [entry.name, entry])
    );

    expect(environment.GATEWAY_PORT.value).toBe('3000');
    expect(environment.PORT).toBeUndefined();
    expect(environment.INTERACTION_SERVICE_URL).toBeUndefined();
  });

  test('TC-CONFIG-002 keeps only the canonical backend environment template in the workspace', () => {
    expect(fs.existsSync(path.join(repositoryRoot, 'backend/.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(repositoryRoot, 'backend/.env.backup'))).toBe(false);
    expect(fs.existsSync(path.join(repositoryRoot, 'backend/.env.new'))).toBe(false);
  });

  test('TC-CONFIG-003 family compose contains only family MVP services and disables RabbitMQ', () => {
    const compose = readYaml('docker-compose.family.yml');
    const serviceNames = Object.keys(compose.services).sort();

    expect(serviceNames).toEqual([
      'analytics-service',
      'gateway',
      'homework-service',
      'mongo',
      'mongo-init',
      'notification-service',
      'progress-service',
      'resource-service',
      'user-service'
    ]);
    expect(compose.services['notification-service'].environment)
      .toContain('ENABLE_RABBITMQ=false');
    expect(compose.services.gateway.environment.some((entry) => entry.startsWith('DATA_SERVICE_URL=')))
      .toBe(false);
    for (const pausedService of ['data-service', 'interaction-service', 'rabbitmq', 'redis', 'minio']) {
      expect(compose.services[pausedService]).toBeUndefined();
    }
  });

  test('TC-CONFIG-004 family docker scripts and Makefile use docker-compose.family.yml', () => {
    const packageJson = require('../../../../package.json');
    const makefile = fs.readFileSync(path.join(repositoryRoot, 'backend/Makefile'), 'utf8');

    expect(packageJson.scripts['docker:family']).toBe('docker compose -f docker-compose.family.yml up -d');
    expect(packageJson.scripts['docker:family:down']).toBe('docker compose -f docker-compose.family.yml down');
    expect(packageJson.scripts['docker:family:logs']).toBe('docker compose -f docker-compose.family.yml logs -f');
    expect(makefile).toContain('docker compose -f ../docker-compose.family.yml up -d');
    expect(makefile).toContain('npm run test:family-regression');
  });

  test('TC-CONFIG-005 Kubernetes family baseline excludes paused school services', () => {
    const kustomization = readYaml('deployment/kubernetes/kustomization.yaml');

    expect(kustomization.resources).not.toContain('interaction-service-deployment.yaml');
    expect(kustomization.resources).not.toContain('data-service-deployment.yaml');
  });

  test('TC-CONFIG-006 deprecated duplicate security middleware has been removed', () => {
    expect(fs.existsSync(path.join(repositoryRoot, 'backend/common/middleware/security.js')))
      .toBe(false);
  });

  const testDeploySecret = kubectlAvailable ? test : test.skip;

  testDeploySecret('TC-T5-DEPLOY-002 Secret dry-run validates without exposing credentials', () => {
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
