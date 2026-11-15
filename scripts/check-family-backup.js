const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SERVICES = ['frontend', 'gateway', 'user-service', 'homework-service', 'progress-service',
  'resource-service', 'analytics-service', 'notification-service', 'mongo', 'mongo-init'];
const MEDIA = '/var/lib/family-growth/private-media';
const JOURNAL = '/var/lib/family-growth/completion-journal';
const fail = code => { throw new Error(code); };
const id = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
const execute = (command, args) => {
  const env = { ...process.env };
  // Never mix the local mount table with a remote or rootless Docker context.
  for (const key of ['DOCKER_CONTEXT', 'DOCKER_HOST', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key];
  return execFileSync(command, args, { env,
    encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
};

const mongoRunning = state => state?.Status === 'running' && state.Running === true && !state.Paused && !state.Restarting;
const containerSnapshot = c => {
  if (!Array.isArray(c.Mounts)) fail('OBSERVATION_INVALID');
  return { id: c.Id, image: c.Image, restartCount: c.RestartCount,
    state: Object.fromEntries(['Status', 'Running', 'Paused', 'Restarting', 'OOMKilled', 'Dead',
      'ExitCode', 'StartedAt', 'FinishedAt'].map(key => [key, c.State?.[key]])),
    tmpfs: Object.entries(c.HostConfig?.Tmpfs || {}).sort(([a], [b]) => a.localeCompare(b)),
    mounts: [...c.Mounts].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
};

function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || Object.keys(config).sort().join(',') !== 'minimumFreeBytes,nasMount,nasSource,project,stagingRoot'
    || typeof config.project !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,62}(?![\s\S])/.test(config.project)
    || !Number.isSafeInteger(config.minimumFreeBytes) || config.minimumFreeBytes <= 0
    || typeof config.nasSource !== 'string' || config.nasSource.length > 512
    || !/^(?:\/\/[^/\s@]+\/[^\s@]+|[^/\s@]+:\/[^\s@]+)(?![\s\S])/.test(config.nasSource)
    || [config.nasMount, config.stagingRoot].some(p => typeof p !== 'string'
      || !path.isAbsolute(p) || p === '/' || path.normalize(p) !== p || [...p].some(c => c.charCodeAt(0) < 32))) {
    fail('CONFIG_INVALID');
  }
}

function checkBackupPreflight(config, { run = execute, fs: io = fs } = {}) {
  validateConfig(config);
  const { project, nasMount, nasSource, stagingRoot, minimumFreeBytes } = config;
  if (nasMount === stagingRoot || stagingRoot.startsWith(nasMount + '/')
    || nasMount.startsWith(stagingRoot + '/')) fail('PATH_INVALID');
  const command = (name, args) => {
    let output;
    try { output = run(name, name === 'docker' ? ['--host=unix:///var/run/docker.sock', ...args] : args); }
    catch (_error) { fail('OBSERVATION_FAILED'); }
    if (typeof output !== 'string' || output.length > 2 * 1024 * 1024) fail('OBSERVATION_INVALID');
    return output;
  };
  const json = (name, args) => {
    const raw = command(name, args);
    try { return JSON.parse(raw); } catch (_error) { fail('OBSERVATION_INVALID'); }
  };
  const checkPathsAndMount = () => {
    // Query the mount table before stat/realpath: do not intentionally trigger autofs traversal.
    const result = json('findmnt', ['--json', '--mountpoint', nasMount, '--output', 'TARGET,SOURCE,FSTYPE,OPTIONS']);
    const rows = result?.filesystems;
    if (!Array.isArray(rows) || rows.length !== 1) fail('NAS_MOUNT_INVALID');
    const mount = rows[0];
    const options = typeof mount?.options === 'string' ? mount.options.split(',') : [];
    if (mount?.target !== nasMount || mount.source !== nasSource || !['cifs', 'nfs', 'nfs4'].includes(mount.fstype)
      || !options.includes('rw') || options.includes('ro') || (mount.children?.length ?? 0) > 0) fail('NAS_MOUNT_INVALID');
    for (const target of [nasMount, stagingRoot]) {
      let stat;
      try {
        stat = io.lstatSync(target);
        if (io.realpathSync(target) !== target) fail('PATH_INVALID');
      } catch (_error) { fail('PATH_INVALID'); }
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('PATH_INVALID');
      if (target === stagingRoot && ((stat.mode & 0o777) !== 0o700
        || stat.uid !== process.getuid())) fail('PATH_INVALID');
      let available;
      try {
        const { bavail, bsize } = io.statfsSync(target);
        if (!Number.isSafeInteger(bavail) || bavail < 0 || !Number.isSafeInteger(bsize) || bsize <= 0) {
          fail('CAPACITY_UNVERIFIABLE');
        }
        available = bavail * bsize;
      } catch (_error) { fail('CAPACITY_UNVERIFIABLE'); }
      if (!Number.isSafeInteger(available)) fail('CAPACITY_UNVERIFIABLE');
      if (available < minimumFreeBytes) fail('CAPACITY_INSUFFICIENT');
    }
    return { target: mount.target, source: mount.source, fstype: mount.fstype,
      options: [...options].sort() };
  };
  const inspect = args => {
    const output = command('docker', ['ps', ...args, '--quiet', '--no-trunc']);
    const ids = output.trim() ? output.trim().split(/\s+/) : [];
    if (ids.length > 256 || ids.some(value => !id(value)) || new Set(ids).size !== ids.length) fail('OBSERVATION_INVALID');
    if (!ids.length) return [];
    const rows = json('docker', ['inspect', ...ids]);
    if (!Array.isArray(rows) || rows.length !== ids.length || rows.some(row => !row || !ids.includes(row.Id))
      || new Set(rows.map(row => row.Id)).size !== ids.length) fail('OBSERVATION_INVALID');
    return rows;
  };
  const observe = () => {
    const mount = checkPathsAndMount();
    const containers = inspect(['--all', '--filter', `label=com.docker.compose.project=${project}`]);
    const byService = new Map();
    for (const container of containers) {
      const labels = container.Config?.Labels || {};
      const service = labels['com.docker.compose.service'];
      if (labels['com.docker.compose.project'] !== project || !SERVICES.includes(service)
        || byService.has(service) || String(labels['com.docker.compose.oneoff']).toLowerCase() === 'true') {
        fail('SERVICE_INVENTORY_INVALID');
      }
      byService.set(service, container);
    }
    if (byService.size !== SERVICES.length) fail('SERVICE_INVENTORY_INVALID');
    for (const [service, container] of byService) {
      const state = container.State;
      if (service === 'mongo') {
        if (!mongoRunning(state)) fail('MONGO_NOT_RUNNING');
      } else if (state?.Status !== 'exited' || state.ExitCode !== 0 || state.Running || state.Paused || state.Restarting) {
        fail('WRITERS_NOT_STOPPED');
      }
    }
    const volumeNames = [];
    for (const [service, destination] of [['mongo', '/data/db'], ['resource-service', MEDIA], ['resource-service', JOURNAL]]) {
      const mounts = byService.get(service).Mounts;
      if (!Array.isArray(mounts)) fail('VOLUME_INVENTORY_INVALID');
      const tmpfsTargets = Object.keys(byService.get(service).HostConfig?.Tmpfs || {});
      if (mounts.some(m => typeof m.Destination !== 'string' || !path.isAbsolute(m.Destination)
        || path.normalize(m.Destination) !== m.Destination || m.Destination.startsWith(destination + '/'))
        || tmpfsTargets.some(p => p === destination || p.startsWith(destination + '/'))) fail('VOLUME_INVENTORY_INVALID');
      const found = mounts.filter(m => m.Destination === destination);
      if (found.length !== 1 || found[0].Type !== 'volume' || typeof found[0].Name !== 'string'
        || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(found[0].Name)) fail('VOLUME_INVENTORY_INVALID');
      volumeNames.push(found[0].Name);
    }
    if (new Set(volumeNames).size !== 3) fail('VOLUME_INVENTORY_INVALID');
    const volumes = json('docker', ['volume', 'inspect', ...volumeNames]);
    if (!Array.isArray(volumes) || volumes.length !== 3 || new Set(volumes.map(v => v?.Name)).size !== 3
      || volumes.some(v => !volumeNames.includes(v?.Name) || v.Labels?.['com.docker.compose.project'] !== project
        || typeof v.Mountpoint !== 'string' || !path.isAbsolute(v.Mountpoint) || v.Mountpoint === '/'
        || path.normalize(v.Mountpoint) !== v.Mountpoint)) {
      fail('VOLUME_INVENTORY_INVALID');
    }
    const running = inspect([]);
    for (const container of running) {
      if (container.Id !== byService.get('mongo').Id && (containers.some(c => c.Id === container.Id)
        || container.Config?.Labels?.['com.docker.compose.project'] === project)) fail('WRITERS_NOT_STOPPED');
      if (!Array.isArray(container.Mounts)) fail('OBSERVATION_INVALID');
      for (const m of container.Mounts) {
        const overlaps = volumes.filter(v => (m.Type === 'volume' && m.Name === v.Name)
          || (typeof m.Source === 'string' && (m.Source === v.Mountpoint
            || m.Source.startsWith(v.Mountpoint + '/') || v.Mountpoint.startsWith(m.Source.replace(/\/$/, '') + '/'))));
        if (overlaps.length && !(container.Id === byService.get('mongo').Id
          && overlaps.length === 1 && overlaps[0].Name === volumeNames[0]
          && m.Type === 'volume' && m.Name === volumeNames[0] && m.Destination === '/data/db')) {
          fail('PROTECTED_VOLUME_IN_USE');
        }
      }
    }
    const currentMongo = running.find(c => c.Id === byService.get('mongo').Id);
    if (!currentMongo || !mongoRunning(currentMongo.State)) fail('MONGO_NOT_RUNNING');
    if (JSON.stringify(containerSnapshot(currentMongo)) !== JSON.stringify(containerSnapshot(byService.get('mongo')))) {
      fail('OBSERVATION_CHANGED');
    }
    // Canonicalize only unordered collections. Preserve identity, state, image and every mount field.
    const snapshot = containers.map(containerSnapshot)
      .sort((a, b) => a.id.localeCompare(b.id));
    const volumeMetadata = volumes.map(v => ({ name: v.Name, mountpoint: v.Mountpoint,
      driver: v.Driver, options: v.Options, labels: v.Labels })).sort((a, b) => a.name.localeCompare(b.name));
    return JSON.stringify({ mount, snapshot, volumeMetadata });
  };
  const before = observe();
  if (observe() !== before) fail('OBSERVATION_CHANGED');
  return { status: 'OBSERVED_PRECONDITIONS_PASS', observedServices: SERVICES.length,
    backupCreated: false, restoreVerified: false,
    remaining: ['EXTERNAL_WRITERS_AND_INFLIGHT_NOT_VERIFIED', 'MAINTENANCE_WINDOW_MUST_REMAIN_HELD',
      'CAPTURE_UPLOAD_AND_RESTORE_NOT_EXECUTED'] };
}

function main(args) {
  if (args.length !== 2 || args[0] !== '--config') fail('ARGUMENTS_INVALID');
  if (process.platform !== 'linux') fail('LINUX_REQUIRED');
  const filename = path.resolve(args[1]);
  let config;
  try {
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(filename) !== filename
      || stat.nlink !== 1 || stat.size > 16384 || (stat.mode & 0o777) !== 0o600
      || stat.uid !== process.getuid()) fail('CONFIG_INVALID');
    config = JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (_error) { fail('CONFIG_INVALID'); }
  return checkBackupPreflight(config);
}

if (require.main === module) {
  try { process.stdout.write(JSON.stringify(main(process.argv.slice(2))) + '\n'); }
  catch (error) {
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'OBSERVATION_FAILED';
    process.stderr.write(`BACKUP_PREFLIGHT_FAILED: ${code}\n`); process.exitCode = 1;
  }
}

module.exports = { checkBackupPreflight };
