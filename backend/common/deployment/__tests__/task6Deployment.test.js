const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const repositoryRoot = path.resolve(__dirname, '../../../..');

const readYaml = (relativePath) => yaml.load(
  fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
);

const readDocuments = (relativePath) => {
  const documents = [];
  yaml.loadAll(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'), (document) => {
    if (document) documents.push(document);
  });
  return documents;
};

const readDeployment = (relativePath) => (
  readDocuments(relativePath).find((document) => document.kind === 'Deployment')
);

const readKind = (relativePath, kind) => (
  readDocuments(relativePath).find((document) => document.kind === kind)
);

const environmentMap = (entries) => Object.fromEntries(
  entries.map((entry) => {
    if (typeof entry === 'string') {
      const separator = entry.indexOf('=');
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }
    return [entry.name, entry];
  })
);

const composeEnvironment = (serviceName) => (
  environmentMap(readYaml('docker-compose.yml').services[serviceName].environment)
);

const deploymentEnvironment = (file) => (
  environmentMap(readDeployment(`deployment/kubernetes/${file}`).spec.template.spec.containers[0].env)
);

const secretKey = (entry) => entry.valueFrom && entry.valueFrom.secretKeyRef;

describe('Task 6 deployment contracts', () => {
  test('TC-T6-REG-004 legacy regression excludes Task 6 family suites', () => {
    const legacyJestConfig = require('../../../jest.legacy.config');
    const ignoredPaths = legacyJestConfig.testPathIgnorePatterns.join('\n');

    for (const familySuitePath of [
      'services/resource-service/__tests__/task6Startup.test.js',
      'services/resource-service/__tests__/familyMedia.test.js',
      'services/resource-service/__tests__/familyMediaPrivacy.test.js',
      'services/resource-service/__tests__/mediaReferences.test.js',
      'services/resource-service/__tests__/mediaCleanup.test.js',
      'services/resource-service/__tests__/privateMediaStore.test.js',
      'services/resource-service/__tests__/mediaCapability.test.js',
      'services/resource-service/__tests__/mediaModels.test.js',
      'services/analytics-service/__tests__/task6Startup.test.js',
      'services/analytics-service/__tests__/server.test.js',
      'services/analytics-service/__tests__/familyMistakes.test.js',
      'services/analytics-service/__tests__/familyMistakeMediaSaga.test.js',
      'services/analytics-service/__tests__/weeklyReports.test.js'
    ]) {
      expect(ignoredPaths).toContain(familySuitePath);
    }
  });

  test('TC-T6-REG-002 docker compose wires Task 6 media and report configuration without literal secrets', () => {
    const resourceEnvironment = composeEnvironment('resource-service');
    const userEnvironment = composeEnvironment('user-service');
    const homeworkEnvironment = composeEnvironment('homework-service');
    const analyticsEnvironment = composeEnvironment('analytics-service');
    const gatewayEnvironment = composeEnvironment('gateway');

    expect(resourceEnvironment.PRIVATE_MEDIA_ROOT).toBe('/var/lib/family-growth/private-media');
    expect(resourceEnvironment.PRIVATE_MEDIA_ROOT).not.toMatch(/\/app\/(public|uploads)\b/);
    expect(analyticsEnvironment.REPORT_HISTORY_AVAILABLE_FROM).toBe('2026-06-01');

    for (const environment of [resourceEnvironment, userEnvironment, homeworkEnvironment, analyticsEnvironment]) {
      expect(environment.MEDIA_REFERENCE_SERVICE_TOKEN)
        .toBe('${MEDIA_REFERENCE_SERVICE_TOKEN:?set MEDIA_REFERENCE_SERVICE_TOKEN}');
      expect(environment.MEDIA_REFERENCE_SERVICE_TOKEN).not.toContain('dry-run');
      expect(environment.RESOURCE_SERVICE_URL || 'http://resource-service:3005')
        .toBe('http://resource-service:3005');
    }
    expect(gatewayEnvironment.MEDIA_REFERENCE_SERVICE_TOKEN).toBeUndefined();
  });

  test('TC-T6-REG-002 Kubernetes references external family-growth secrets without committed values', () => {
    const kustomization = readYaml('deployment/kubernetes/kustomization.yaml');
    expect(kustomization.resources).toContain('family-growth-external-secret.yaml');

    const externalSecret = readYaml('deployment/kubernetes/family-growth-external-secret.yaml');
    expect(externalSecret.kind).toBe('ExternalSecret');
    expect(externalSecret.spec.target.name).toBe('family-growth-secrets');
    expect(JSON.stringify(externalSecret)).not.toMatch(/dry-run|test-media|jwt-secret-value/);

    const resourceEnvironment = deploymentEnvironment('resource-service-deployment.yaml');
    const userEnvironment = deploymentEnvironment('user-service-deployment.yaml');
    const homeworkEnvironment = deploymentEnvironment('homework-service-deployment.yaml');
    const analyticsEnvironment = deploymentEnvironment('analytics-service-deployment.yaml');
    const gatewayEnvironment = deploymentEnvironment('gateway-deployment.yaml');

    expect(resourceEnvironment.PRIVATE_MEDIA_ROOT.value).toBe('/var/lib/family-growth/private-media');
    expect(resourceEnvironment.PRIVATE_MEDIA_ROOT.value).not.toMatch(/\/app\/(public|uploads)\b/);
    expect(readDeployment('deployment/kubernetes/resource-service-deployment.yaml')
      .spec.template.spec.volumes).toContainEqual({
      name: 'private-media',
      persistentVolumeClaim: { claimName: 'resource-private-media' }
    });
    expect(readKind('deployment/kubernetes/resource-service-deployment.yaml', 'PersistentVolumeClaim')
      .metadata.name).toBe('resource-private-media');
    expect(analyticsEnvironment.REPORT_HISTORY_AVAILABLE_FROM.value).toBe('2026-06-01');

    for (const environment of [resourceEnvironment, userEnvironment, homeworkEnvironment, analyticsEnvironment]) {
      expect(secretKey(environment.MEDIA_REFERENCE_SERVICE_TOKEN)).toEqual({
        name: 'family-growth-secrets',
        key: 'media-reference-service-token'
      });
    }
    expect(gatewayEnvironment.MEDIA_REFERENCE_SERVICE_TOKEN).toBeUndefined();
  });
});
