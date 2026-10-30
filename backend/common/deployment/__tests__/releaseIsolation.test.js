const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../../../..');
const entry = path.join(root, 'scripts/release-family-gate.sh');
const validator = path.join(root, 'scripts/check-release-isolation.js');
const project = 'family-growth-isolated-test123';
const config = () => ({ name: project,
  networks: { 'app-network': { name: `${project}_app-network`, driver: 'bridge' } },
  volumes: Object.fromEntries(['mongo-data', 'mongo-config', 'resource-data', 'completion-journal']
    .map(key => [key, { name: `${project}_${key}` }])),
  services: Object.fromEntries(['gateway', 'user-service', 'progress-service', 'homework-service',
    'resource-service', 'analytics-service', 'notification-service', 'mongo', 'mongo-init'].map(name => [name, {
    cpus: 0.2, mem_limit: 268435456, memswap_limit: 268435456, networks: { 'app-network': null },
    environment: { MONGO_URI: 'mongodb://mongo:27017/learning-tracker?replicaSet=rs0',
      COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_ORPHAN_CLEANUP_ENABLED: 'false' },
    volumes: name === 'mongo' ? [{ type: 'volume', source: 'mongo-data', target: '/data/db' },
      { type: 'volume', source: 'mongo-config', target: '/data/configdb' }]
      : name === 'resource-service' ? [{ type: 'volume', source: 'resource-data', target: '/var/lib/family-growth/private-media' },
        { type: 'volume', source: 'completion-journal', target: '/var/lib/family-growth/completion-journal' }] : [],
    ...(name === 'mongo-init' ? { tmpfs: ['/data/db:size=1048576', '/data/configdb:size=1048576'] } : {}),
    ...(name === 'gateway' ? { ports: [{ host_ip: '127.0.0.1', target: 3000, published: '43123', protocol: 'tcp' }] } : {})
  }])) });
const check = value => spawnSync(process.execPath, [validator, project, '43123'],
  { input: JSON.stringify(value), encoding: 'utf8' });

describe('bounded release preparation', () => {
  const lifecycle = require('../../../../scripts/release-retained-build');
  const names = ['gateway', 'user-service', 'progress-service', 'homework-service', 'resource-service', 'analytics-service', 'notification-service'];
  const candidates = names.map((name, i) => ({ name, tag: `${project}-${name}:candidate`, id: `sha256:${String(i + 1).repeat(64)}` }));
  beforeEach(() => { jest.spyOn(lifecycle, 'requireClosedBuild').mockResolvedValue({ state: 'VERIFIED', candidates }); });
  afterEach(() => { jest.restoreAllMocks(); });
  const settings = () => {
    const value = config();
    for (const [name, service] of Object.entries(value.services)) {
      if (name.startsWith('mongo')) continue;
      service.image = `${project}-${name}:candidate`;
      service.build = { context: root, dockerfile: name === 'gateway' ? 'backend/gateway/Dockerfile' : `backend/services/${name}/Dockerfile` };
    }
    return value;
  };
  const exercise = async (phase, failAt, mutate = () => {}, prepareDirectory = () => {}) => {
    const calls = [], value = settings(); mutate(value);
    const buildDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'release-pinned-'));
    prepareDirectory(buildDirectory);
    const { runIsolated } = require('../../../../scripts/release-isolated-compose');
    let active = 0, peak = 0;
    const run = async (args, options = {}) => {
      active += 1; peak = Math.max(peak, active);
      calls.push({ args, ...options });
      await Promise.resolve(); active -= 1;
      if (calls.length === failAt) throw new Error('synthetic-failure');
      return '';
    };
    let error, pinned;
    try { await runIsolated({ phase, config: value, project, port: '43123', root,
      composeArgs: ['--project-name', project], run, buildDirectory }); } catch (e) { error = e; }
    if (fs.existsSync(path.join(buildDirectory, 'candidate-images.json'))) {
      pinned = JSON.parse(fs.readFileSync(path.join(buildDirectory, 'candidate-images.json'), 'utf8'));
    }
    fs.rmSync(buildDirectory, { recursive: true, force: true });
    return { calls, peak, error, pinned, buildDirectory, value };
  };
  test('build entry delegates all seven images to the retained lifecycle', async () => {
    // Serial commands, actual limits and failure short-circuit remain covered in releaseRetainedBuild.test.js.
    const build = jest.spyOn(lifecycle, 'runRetainedBuild').mockResolvedValue({ state: 'CLOSED' });
    const { calls, error } = await exercise('build');
    expect(error).toBeUndefined(); expect(calls).toHaveLength(0);
    expect(build).toHaveBeenCalledTimes(1);
    expect(build.mock.calls[0][0].config).toEqual(settings());
    expect(build.mock.calls[0][0].candidateOnly).toBe(true);
  });
  test('build failure propagates without an ordinary Compose fallback', async () => {
    jest.spyOn(lifecycle, 'runRetainedBuild').mockRejectedValue(Error('synthetic-failure'));
    const { calls, error } = await exercise('build');
    expect(error.message).toBe('synthetic-failure'); expect(calls).toHaveLength(0);
  });
  test('unknown build termination blocks every preparation and startup mutation', async () => {
    lifecycle.requireClosedBuild.mockRejectedValue(Error('UNKNOWN'));
    const { calls, error } = await exercise('start');
    expect(error.message).toBe('UNKNOWN'); expect(calls).toHaveLength(0);
  });
  test('fresh check, all model indexes, storage and both preflights precede formal startup', async () => {
    const { calls, peak, error } = await exercise('start');
    expect(error).toBeUndefined(); expect(peak).toBe(1);
    const jobs = calls.filter(c => c.args[0] === 'run');
    expect(jobs.map(c => c.job)).toEqual(['fresh', 'user', 'progress', 'homework', 'resource',
      'analytics', 'notification', 'storage', 'preflight-homework', 'preflight-resource']);
    for (const c of jobs) {
      expect(c.args).toEqual(expect.arrayContaining(['--cpus=0.4', '--memory=256m', '--memory-swap=256m']));
      expect(c.input).toContain('runPreparation');
      expect(c.args[c.args.indexOf('--entrypoint') + 1]).toBe('sh');
      expect(c.args).toContain(require('crypto').createHash('sha256').update(c.input).digest('hex'));
      expect(c.args.join(' ')).not.toContain('JWT_SECRET');
    }
    expect(calls.at(-1).args.slice(-6)).toEqual(['up', '-d', '--no-build', '--wait', '--wait-timeout', '240']);
  });
  test('preparation and formal startup use all seven verified IDs without altering input config', async () => {
    const { calls, error, pinned, buildDirectory, value } = await exercise('start');
    expect(error).toBeUndefined(); expect(value).toEqual(settings());
    expect(lifecycle.requireClosedBuild).toHaveBeenCalledWith(expect.objectContaining({ candidateOnly: true }));
    expect(pinned).toEqual({ services: Object.fromEntries(candidates.map(c => [c.name, { image: c.id, pull_policy: 'never' }])) });
    for (const c of calls.filter(c => c.args[0] === 'compose')) {
      expect(c.args.slice(3, 5)).toEqual(['--file', path.join(buildDirectory, 'candidate-images.json')]);
    }
    for (const c of calls.filter(c => c.job)) {
      const name = c.job === 'fresh' ? 'gateway' : c.job.startsWith('preflight-') ? `${c.job.slice(10)}-service`
        : c.job === 'storage' ? 'resource-service' : `${c.job}-service`;
      expect(c.args[c.args.indexOf('--pull=never') + 1]).toBe(candidates.find(row => row.name === name).id);
      expect(c.args.some(arg => arg.endsWith(':candidate'))).toBe(false);
    }
  });
  test.each(['changed', 'symlink'])('rejects a %s pinned override before Docker mutations', async kind => {
    const { calls, error } = await exercise('start', undefined, undefined, directory => {
      const file = path.join(directory, 'candidate-images.json');
      if (kind === 'changed') fs.writeFileSync(file, '{}');
      else { fs.writeFileSync(path.join(directory, 'other'), '{}'); fs.symlinkSync('other', file); }
    });
    expect(error.message).toBe('UNSAFE_PINNED_BUILD_CONFIG'); expect(calls).toHaveLength(0);
  });
  test.each([3, 5, 9, 12, 14])('preparation failure at command %i cannot reach formal startup', async failAt => {
    const { calls, error } = await exercise('start', failAt);
    expect(error).toBeDefined(); expect(calls).toHaveLength(failAt);
    expect(calls.some(c => c.args.slice(-6).join(' ') === 'up -d --no-build --wait --wait-timeout 240')).toBe(false);
  });
  test.each([
    c => { c.services.gateway.image = 'existing-service:latest'; },
    c => { c.services.gateway.build.context = '/other'; },
    c => { c.services.mongo.cpus = 1.9; },
    c => { c.services.mongo.mem_limit = 3 * 1024 ** 3; },
    c => { c.services.gateway.environment.MONGO_URI = 'mongodb://real/data'; }
  ])('unsafe configuration is rejected before any Docker mutation (%#)', async mutate => {
    const { calls, error } = await exercise('start', undefined, mutate);
    expect(error).toBeDefined(); expect(calls).toHaveLength(0);
  });
});

describe('isolated release entry', () => {
  test('build directory survives the run_step pipeline and reaches stage16', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-directory-'));
    try {
      const result = spawnSync('bash', ['-c', `source "$1"
        docker() { :; }; node() { echo "$RELEASE_GATE_BUILD_DIRECTORY"; }
        release_gate_init
        run_step 15-test build_compose_family
        start_compose_family
      `, '_', entry], { encoding: 'utf8', env: { ...process.env,
        RELEASE_GATE_BUILD_DIRECTORY: '', RELEASE_GATE_COMPOSE_PROJECT: project,
        RELEASE_GATE_COMPOSE_OVERRIDE: entry, RELEASE_GATE_ENV_FILE: entry,
        RELEASE_GATE_ARTIFACT_DIR: dir, FAMILY_GATEWAY_HOST_PORT: '43123', FAMILY_MONGO_HOST_PORT: '43124' } });
      expect(result.status).toBe(0);
      expect(result.stdout.trim().split('\n').slice(-2)).toEqual([`${dir}/retained-build`, `${dir}/retained-build`]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test('rejects an in-checkout build evidence directory before stage15', () => {
    const result = spawnSync('bash', ['-c', 'source "$1"; docker() { :; }; release_gate_init', '_', entry],
      { encoding: 'utf8', env: { ...process.env, RELEASE_GATE_COMPOSE_PROJECT: project,
        RELEASE_GATE_COMPOSE_OVERRIDE: entry, RELEASE_GATE_ENV_FILE: entry, RELEASE_GATE_ARTIFACT_DIR: os.tmpdir(),
        RELEASE_GATE_BUILD_DIRECTORY: path.join(root, 'release-gate-artifacts/unsafe-build'),
        FAMILY_GATEWAY_HOST_PORT: '43123', FAMILY_MONGO_HOST_PORT: '43124' } });
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('outside the checkout');
  });
  test.each([false, true])('interrupted preparation is explicitly stopped, removed and checked (residual=%s)', residual => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cleanup-'));
    try {
      const run = spawnSync('bash', ['-c', `source "$1"
        artifact_dir="$TEST_DIR"; compose_touched=1; compose_project="$PROJECT"; compose_args=()
        docker() {
          printf '%s\\n' "$*" >> "$TEST_DIR/trace"
          if [[ "$1" == container && "$*" == *lms.isolation.run* && ! -f "$TEST_DIR/removed" ]]; then echo owned-job; fi
          if [[ "$1" == rm && "$2" == owned-job ]]; then touch "$TEST_DIR/removed"; fi
          if [[ "$1" == network && "$RESIDUAL" == true ]]; then echo owned-network; fi
        }
        trap cleanup EXIT
        exit 0
      `, '_', entry], { encoding: 'utf8', env: { ...process.env, TEST_DIR: dir, PROJECT: project,
        RELEASE_GATE_COMPOSE_OVERRIDE: 'synthetic', RESIDUAL: String(residual) } });
      expect(run.status).toBe(residual ? 1 : 0);
      const trace = fs.readFileSync(path.join(dir, 'trace'), 'utf8');
      expect(trace).toContain(`--filter label=com.docker.compose.project=${project} --filter label=lms.isolation.run=${project}`);
      expect(trace).toContain('stop owned-job\n'); expect(trace).toContain('rm owned-job\n');
      expect(trace.indexOf('rm owned-job')).toBeLessThan(trace.indexOf('down --remove-orphans'));
      if (residual) expect(run.stderr).toContain('remaining network resources');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test.each(['volume', 'network', 'container', 'image'])('rejects same-prefix unlabelled %s before any mutation', kind => {
    const run = spawnSync('bash', ['-c', `source "$1"; docker() {
      if [[ "$1" == compose ]]; then echo UNEXPECTED_COMPOSE >&2; return 99; fi
      if [[ "$1" == "$KIND" && "$*" != *--filter* ]]; then echo "$RELEASE_GATE_COMPOSE_PROJECT"_existing; fi
    }; release_gate_init`, '_', entry], { encoding: 'utf8', env: { ...process.env,
      KIND: kind, RELEASE_GATE_COMPOSE_PROJECT: project, RELEASE_GATE_COMPOSE_OVERRIDE: entry,
      RELEASE_GATE_ENV_FILE: entry, RELEASE_GATE_ARTIFACT_DIR: os.tmpdir() } });
    expect(run.status).not.toBe(0); expect(run.stderr).toContain('resource name already exists');
    expect(run.stderr).not.toContain('UNEXPECTED_COMPOSE');
  });
  test('isolated smoke cannot inherit a foreign base URL', () => {
    const run = spawnSync('bash', ['-c', 'source "$1"; docker() { :; }; release_gate_init; echo "$FAMILY_GATEWAY_BASE_URL"', '_', entry],
      { encoding: 'utf8', env: { ...process.env, RELEASE_GATE_COMPOSE_PROJECT: project,
        RELEASE_GATE_COMPOSE_OVERRIDE: entry, RELEASE_GATE_ENV_FILE: entry, RELEASE_GATE_ARTIFACT_DIR: os.tmpdir(),
        FAMILY_GATEWAY_HOST_PORT: '43123', FAMILY_MONGO_HOST_PORT: '43124', FAMILY_GATEWAY_BASE_URL: 'https://unrelated.invalid' } });
    expect(run.status).toBe(0); expect(run.stdout.trim()).toBe('http://127.0.0.1:43123');
  });
  test('isolated build and start invoke bounded preparation, ordinary release keeps Compose behavior', () => {
    for (const isolated of [false, true]) {
      const run = spawnSync('bash', ['-c', `source "$1"
        repository_root="$2"; compose_args=(--project-name test)
        node() { printf 'NODE %s\\n' "$*"; }
        compose_family() { printf 'COMPOSE %s\\n' "$*"; }
        build_compose_family
        start_compose_family
      `, '_', entry, root], { encoding: 'utf8', env: { ...process.env,
        RELEASE_GATE_COMPOSE_OVERRIDE: isolated ? '/synthetic/override.yml' : '' } });
      expect(run.status).toBe(0);
      if (isolated) {
        expect(run.stdout).toContain('release-isolated-compose.js build --project-name test');
        expect(run.stdout).toContain('release-isolated-compose.js start --project-name test');
        expect(run.stdout).not.toContain('COMPOSE');
      } else {
        expect(run.stdout).toBe('COMPOSE build\nCOMPOSE up -d --wait --wait-timeout 240\n');
      }
    }
  });
  test('sourcing the entry has no commands, traps, cwd changes or artifacts', () => {
    const run = spawnSync('bash', ['-c', 'npm() { return 91; }; before=$PWD; source "$1"; test "$before" = "$PWD"; test -z "$(trap -p EXIT)"', '_', entry],
      { cwd: os.tmpdir(), encoding: 'utf8', timeout: 1500 });
    expect(run.status).toBe(0); expect(run.stdout).toBe(''); expect(run.stderr).toBe('');
  });

  test('all compose commands including failed-run teardown use the exact override and env paths', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release isolation '));
    try {
      const override = path.join(dir, 'override.yml'), envFile = path.join(dir, 'test.env');
      fs.writeFileSync(override, 'services: {}\n'); fs.writeFileSync(envFile, '', { mode: 0o600 });
      const run = spawnSync('bash', ['-c', `
        npm() { return 91; }
        source "$1"
        docker() { if [[ "$1" == compose ]]; then printf '%s\\n' "$*" >> "$TRACE"; fi; }
        release_gate_init
        compose_family config --quiet
        compose_touched=1
        trap cleanup EXIT
        exit 23
      `, '_', entry], { encoding: 'utf8', env: { ...process.env,
        RELEASE_GATE_COMPOSE_PROJECT: project, RELEASE_GATE_COMPOSE_OVERRIDE: override,
        RELEASE_GATE_ENV_FILE: envFile, RELEASE_GATE_ARTIFACT_DIR: dir,
        FAMILY_GATEWAY_HOST_PORT: '43123', FAMILY_MONGO_HOST_PORT: '43124', TRACE: path.join(dir, 'trace') } });
      expect(run.status).toBe(23);
      const lines = fs.readFileSync(path.join(dir, 'trace'), 'utf8').trim().split('\n');
      expect(lines).toHaveLength(4);
      for (const line of lines) {
        expect(line).toContain(`--project-name ${project} --file ${root}/docker-compose.family.yml --file ${override} --env-file ${envFile}`);
      }
      expect(lines.at(-1)).toContain('down --remove-orphans');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('accepts only the bounded effective configuration', () => { expect(check(config()).status).toBe(0); });
  test('accepts the empty ipam object emitted by Ubuntu Compose 2.27, not custom IPAM', () => {
    const value = config(); value.networks['app-network'].ipam = {};
    expect(check(value).status).toBe(0);
    value.networks['app-network'].ipam = { config: [{ subnet: '10.0.0.0/24' }] };
    expect(check(value).status).toBe(1);
  });
  test.each([
    c => { c.services.gateway.ports.push({ target: 3000, published: '3000' }); },
    c => { c.services.mongo.ports = [{ host_ip: '127.0.0.1', target: 27017, published: '27017' }]; },
    c => { c.services.mongo.volumes = [{ type: 'bind', source: '/real-data', target: '/data/db' }]; },
    c => { c.volumes['mongo-data'].name = 'lms_mongo-data'; },
    c => { c.volumes['mongo-data'].external = true; },
    c => { c.services.gateway.network_mode = 'host'; },
    c => { c.services.mongo.cpus = 2; },
    c => { c.services.mongo.mem_limit = 3 * 1024 ** 3; },
    c => { c.services.mongo.memswap_limit = -1; },
    c => { c.services.mongo.privileged = true; },
    c => { c.services.mongo.volumes.pop(); },
    c => { c.services.mongo.volumes[0].target = '/wrong'; },
    c => { c.services['mongo-init'].tmpfs = []; },
    c => { c.services.gateway.deploy = { resources: { limits: { cpus: '4' } } }; },
    c => { c.services.gateway.environment.MONGO_URI = 'mongodb://production/database'; },
    c => { c.services['homework-service'].environment.COMPLETION_PROTOCOL_MODE = 'legacy'; },
    c => { c.services['resource-service'].environment.COMPLETION_ORPHAN_CLEANUP_ENABLED = 'true'; }
  ])('rejects unsafe effective config without leaking its environment (%#)', mutate => {
    const value = config(); mutate(value); value.services.gateway.environment.JWT_SECRET = 'sensitive-marker';
    const result = check(value);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toBe('UNSAFE_RELEASE_ISOLATION_CONFIG\n');
    expect(result.stdout + result.stderr).not.toContain('sensitive-marker');
  });

  test('refuses an existing isolated project before compose or teardown', () => {
    const run = spawnSync('bash', ['-c', `source "$1"; docker() {
      if [[ "$1" == compose ]]; then echo UNEXPECTED_COMPOSE >&2; return 99; fi
      echo existing-resource;
    }; release_gate_init`, '_', entry], { encoding: 'utf8', env: { ...process.env,
      RELEASE_GATE_COMPOSE_PROJECT: project, RELEASE_GATE_COMPOSE_OVERRIDE: entry, RELEASE_GATE_ENV_FILE: entry,
      RELEASE_GATE_ARTIFACT_DIR: os.tmpdir() } });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('refusing reuse'); expect(run.stderr).not.toContain('UNEXPECTED_COMPOSE');
  });
});
