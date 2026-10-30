const fs = require('fs');

// Validate Compose's resolved JSON, never print credentials or the supplied document.
function validate(config, project, port) {
  const fail = () => { throw new Error('UNSAFE_RELEASE_ISOLATION_CONFIG'); };
  const requireThat = value => { if (!value) fail(); };
  requireThat(/^family-growth-isolated-[a-z0-9-]+$/.test(project) && config.name === project);
  requireThat(/^\d+$/.test(port) && Number(port) > 1024 && Number(port) <= 65535);
  const names = ['gateway', 'user-service', 'progress-service', 'homework-service', 'resource-service',
    'analytics-service', 'notification-service', 'mongo', 'mongo-init'];
  requireThat(JSON.stringify(Object.keys(config.services).sort()) === JSON.stringify(names.sort()));
  requireThat(Object.keys(config.networks).length === 1);
  for (const [key, network] of Object.entries(config.networks)) {
    requireThat(key === 'app-network' && network.name === `${project}_${key}` && !network.external
      && network.driver === 'bridge' && !network.driver_opts
      && (!network.ipam || (typeof network.ipam === 'object' && !Array.isArray(network.ipam)
        && Object.keys(network.ipam).length === 0)));
  }
  const volumes = ['mongo-data', 'mongo-config', 'resource-data', 'completion-journal'];
  requireThat(JSON.stringify(Object.keys(config.volumes).sort()) === JSON.stringify(volumes.sort()));
  for (const [key, volume] of Object.entries(config.volumes)) {
    requireThat(volume.name === `${project}_${key}` && !volume.external && !volume.driver_opts
      && (!volume.driver || volume.driver === 'local'));
  }
  let cpu = 0, memory = 0;
  for (const [name, service] of Object.entries(config.services)) {
    requireThat(!service.container_name && !service.network_mode && !service.privileged && !service.devices
      && !service.cap_add && !service.pid && !service.ipc && !service.volumes_from && !service.external_links
      && !service.env_file && !service.secrets && !service.configs && !service.deploy
      && !service.cpu_quota && !service.cpu_period && !service.cgroup_parent);
    requireThat(Object.keys(service.networks || {}).join() === 'app-network');
    const cpus = Number(service.cpus), bytes = Number(service.mem_limit);
    requireThat(Number.isFinite(cpus) && cpus > 0 && Number.isSafeInteger(bytes) && bytes > 0
      && Number(service.memswap_limit) === bytes);
    cpu += cpus; memory += bytes;
    const ports = service.ports || [];
    requireThat(name === 'gateway' ? ports.length === 1 && ports[0].host_ip === '127.0.0.1'
      && Number(ports[0].target) === 3000 && String(ports[0].published) === port && ports[0].protocol === 'tcp'
      : ports.length === 0);
    const expectedMounts = name === 'mongo' ? { 'mongo-data': '/data/db', 'mongo-config': '/data/configdb' }
      : name === 'resource-service' ? { 'resource-data': '/var/lib/family-growth/private-media',
        'completion-journal': '/var/lib/family-growth/completion-journal' } : {};
    requireThat((service.volumes || []).length === Object.keys(expectedMounts).length);
    const seen = new Set();
    for (const mount of service.volumes || []) {
      requireThat(mount.type === 'volume' && expectedMounts[mount.source] === mount.target && !seen.has(mount.source));
      seen.add(mount.source);
    }
    const expectedTmpfs = name === 'mongo-init' ? ['/data/configdb:size=1048576', '/data/db:size=1048576'] : [];
    requireThat(JSON.stringify([...(service.tmpfs || [])].sort()) === JSON.stringify(expectedTmpfs));
    const env = service.environment || {};
    if (env.MONGO_URI) requireThat(env.MONGO_URI === 'mongodb://mongo:27017/learning-tracker?replicaSet=rs0');
    for (const [key, value] of Object.entries(env)) {
      if (key.endsWith('_SERVICE_URL')) requireThat(/^http:\/\/(user|progress|homework|resource|analytics|notification)-service:30\d\d$/.test(value));
    }
    if (['homework-service', 'resource-service'].includes(name)) requireThat(env.COMPLETION_PROTOCOL_MODE === 'enabled');
    if (name === 'resource-service') requireThat(env.COMPLETION_ORPHAN_CLEANUP_ENABLED === 'false');
  }
  requireThat(cpu <= 2.000001 && memory <= 3 * 1024 ** 3);
  return { scope: 'isolated-compose-configuration-only', services: names.length, cpu, memory };
}

if (require.main === module) {
  try {
    const result = validate(JSON.parse(fs.readFileSync(0, 'utf8')), process.argv[2], process.argv[3]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write('UNSAFE_RELEASE_ISOLATION_CONFIG\n'); process.exitCode = 1;
  }
}
module.exports = { validate };
