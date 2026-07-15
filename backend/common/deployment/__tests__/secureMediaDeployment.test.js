const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
const readYaml = (relativePath) => yaml.load(read(relativePath));
const documents = (relativePath) => {
  const result = [];
  yaml.loadAll(read(relativePath), (document) => {
    if (document) result.push(document);
  });
  return result;
};
const environmentMap = (entries) => Object.fromEntries(entries.map((entry) => {
  if (typeof entry !== 'string') return [entry.name, entry.value];
  const separator = entry.indexOf('=');
  return [entry.slice(0, separator), entry.slice(separator + 1)];
}));

describe('secure private-media deployment contracts', () => {
  test.each(['docker-compose.family.yml', 'docker-compose.ubuntu.yml'])(
    'TC-MPA-DEPLOY-001 %s explicitly stays trusted-local without a scanner',
    (composeFile) => {
      const compose = readYaml(composeFile);
      const environment = environmentMap(compose.services['resource-service'].environment);

      expect(environment.MEDIA_SECURITY_PROFILE).toBe('trusted-local');
      expect(environment.CLAMAV_HOST).toBeUndefined();
      expect(compose.services.clamav).toBeUndefined();
    }
  );

  test('TC-MPA-DEPLOY-002 secure Compose overlay is private, pinned, and health ordered', () => {
    const compose = readYaml('docker-compose.security.yml');
    const scanner = compose.services.clamav;
    const resource = compose.services['resource-service'];
    const environment = environmentMap(resource.environment);

    expect(scanner.image).toMatch(/^clamav\/clamav:[^@]+@sha256:[a-f0-9]{64}$/);
    expect(scanner.ports).toBeUndefined();
    expect(scanner.networks).toEqual(['scanner-network']);
    expect(scanner.healthcheck.start_period).toBe('180s');
    expect(compose.networks['scanner-network'].internal).toBe(true);
    expect(resource.networks).toEqual(expect.arrayContaining(['app-network', 'scanner-network']));
    expect(resource.depends_on.clamav.condition).toBe('service_healthy');
    expect(environment).toEqual(expect.objectContaining({
      MEDIA_SECURITY_PROFILE: 'secure-production',
      CLAMAV_HOST: 'clamav',
      CLAMAV_PORT: '3310'
    }));
  });

  test('TC-MPA-DEPLOY-003 Kubernetes scanner is private, pinned, and capacity bounded', () => {
    const kustomization = readYaml('deployment/kubernetes/kustomization.yaml');
    expect(kustomization.resources).toEqual(expect.arrayContaining([
      'clamav-deployment.yaml',
      'clamav-service.yaml',
      'clamav-network-policy.yaml'
    ]));

    const deployment = documents('deployment/kubernetes/clamav-deployment.yaml')
      .find((document) => document.kind === 'Deployment');
    const scanner = deployment.spec.template.spec.containers[0];
    expect(scanner.image).toMatch(/^clamav\/clamav:[^@]+@sha256:[a-f0-9]{64}$/);
    expect(scanner.ports).toEqual([{ containerPort: 3310, name: 'clamd' }]);
    expect(scanner.resources).toEqual({
      requests: { cpu: '250m', memory: '3Gi' },
      limits: { cpu: '1', memory: '4Gi' }
    });
    expect(scanner.startupProbe.periodSeconds * scanner.startupProbe.failureThreshold)
      .toBeGreaterThanOrEqual(180);

    const service = readYaml('deployment/kubernetes/clamav-service.yaml');
    expect(service.spec.type).toBe('ClusterIP');
    expect(service.spec.ports).toEqual([{ name: 'clamd', port: 3310, targetPort: 'clamd' }]);
    expect(JSON.stringify([...documents('deployment/kubernetes/clamav-deployment.yaml'), service]))
      .not.toMatch(/NodePort|LoadBalancer|kind":"Ingress/);

    const policy = readYaml('deployment/kubernetes/clamav-network-policy.yaml');
    expect(policy.kind).toBe('NetworkPolicy');
    expect(policy.spec.ingress[0].from[0].podSelector.matchLabels.app).toBe('resource-service');
  });

  test('TC-MPA-DEPLOY-004 Kubernetes resource service fails closed through the private scanner', () => {
    const deployment = documents('deployment/kubernetes/resource-service-deployment.yaml')
      .find((document) => document.kind === 'Deployment');
    const container = deployment.spec.template.spec.containers[0];
    const environment = environmentMap(container.env);

    expect(environment).toEqual(expect.objectContaining({
      MEDIA_SECURITY_PROFILE: 'secure-production',
      CLAMAV_HOST: 'clamav',
      CLAMAV_PORT: '3310'
    }));
    expect(container.startupProbe.httpGet).toEqual({ path: '/health', port: 3005 });
    expect(container.startupProbe.periodSeconds * container.startupProbe.failureThreshold)
      .toBeGreaterThanOrEqual(180);
  });
});
