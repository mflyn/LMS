const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkBackupPreflight } = require('../../../../scripts/check-family-backup');

const services = ['frontend', 'gateway', 'user-service', 'homework-service', 'progress-service',
  'resource-service', 'analytics-service', 'notification-service', 'mongo', 'mongo-init'];
const destinations = ['/data/db', '/var/lib/family-growth/private-media', '/var/lib/family-growth/completion-journal'];

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'backup-preflight-')));
  const nas = path.join(root, 'nas'), staging = path.join(root, 'staging');
  fs.mkdirSync(nas, { mode: 0o700 }); fs.mkdirSync(staging, { mode: 0o700 });
  const config = { project: 'lms', nasMount: nas, nasSource: '//nas.example.test/lms',
    stagingRoot: staging, minimumFreeBytes: 1024 };
  const mount = { target: nas, source: config.nasSource, fstype: 'cifs', options: 'rw,relatime' };
  const containers = services.map((service, i) => ({ Id: String(i + 1).padStart(64, '0'),
    Image: 'sha256:' + 'a'.repeat(64), Config: { Labels: {
      'com.docker.compose.project': 'lms', 'com.docker.compose.service': service
    } }, State: { Status: service === 'mongo' ? 'running' : 'exited', ExitCode: 0,
      Running: service === 'mongo', Paused: false, Restarting: false, StartedAt: '2026-10-30T00:00:00Z' },
    Mounts: service === 'mongo' ? [{ Type: 'volume', Name: 'lms_db', Destination: destinations[0], RW: true }]
      : service === 'resource-service' ? destinations.slice(1).map((d, n) => ({ Type: 'volume',
        Name: ['lms_media', 'lms_journal'][n], Destination: d, RW: true })) : [] }));
  const volumes = ['lms_db', 'lms_media', 'lms_journal'].map(Name => ({ Name, Mountpoint: '/var/lib/docker/volumes/' + Name + '/_data',
    Labels: { 'com.docker.compose.project': 'lms' } }));
  const f = { root, config, mount, containers, volumes, running: [containers[8]], calls: [] };
  f.run = jest.fn((file, args) => {
    f.calls.push([file, args]);
    if (file === 'docker') args = args.slice(1);
    if (file === 'findmnt') return JSON.stringify({ filesystems: [mount] });
    if (file === 'docker' && args[0] === 'ps') return (args.includes('--all') ? containers : f.running).map(x => x.Id).join('\n');
    if (file === 'docker' && args[0] === 'inspect') return JSON.stringify(args.slice(1).map(id =>
      [...containers, ...f.running].find(x => x.Id === id)));
    if (file === 'docker' && args[0] === 'volume') return JSON.stringify(volumes);
    throw Error('unexpected command');
  });
  f.io = { ...fs, statfsSync: () => ({ bavail: 1024, bsize: 4096 }) };
  f.check = () => checkBackupPreflight(config, { run: f.run, fs: f.io });
  f.close = () => fs.rmSync(root, { recursive: true, force: true });
  return f;
}

describe('read-only family backup preflight', () => {
  let f;
  beforeEach(() => { f = fixture(); });
  afterEach(() => f.close());

  test('passes observations, never claims backup, restore or external-writer exclusion', () => {
    expect(f.check()).toEqual({ status: 'OBSERVED_PRECONDITIONS_PASS', observedServices: 10,
      backupCreated: false, restoreVerified: false,
      remaining: ['EXTERNAL_WRITERS_AND_INFLIGHT_NOT_VERIFIED', 'MAINTENANCE_WINDOW_MUST_REMAIN_HELD',
        'CAPTURE_UPLOAD_AND_RESTORE_NOT_EXECUTED'] });
    expect(new Set(f.calls.map(([file]) => file))).toEqual(new Set(['findmnt', 'docker']));
    for (const [file, args] of f.calls) {
      if (file === 'docker') {
        expect(args[0]).toBe('--host=unix:///var/run/docker.sock');
        expect(['ps', 'inspect', 'volume']).toContain(args[1]);
        if (args[1] === 'volume') expect(args[2]).toBe('inspect');
      }
    }
  });

  test.each(['local', 'autofs', 'wrong-source', 'wrong-target', 'readonly', 'nested'])('rejects NAS %s', kind => {
    if (kind === 'local') f.mount.fstype = 'ext4';
    if (kind === 'autofs') f.mount.fstype = 'autofs';
    if (kind === 'wrong-source') f.mount.source = '//other.example.test/share';
    if (kind === 'wrong-target') f.mount.target = f.root;
    if (kind === 'readonly') f.mount.options = 'ro,relatime';
    if (kind === 'nested') f.mount.children = [{ target: f.config.nasMount + '/nested' }];
    expect(f.check).toThrow('NAS_MOUNT_INVALID');
    expect(f.calls.every(([file]) => file === 'findmnt')).toBe(true);
  });

  test.each(['nas', 'staging'])('rejects insufficient %s capacity before Docker queries', which => {
    f.io.statfsSync = p => ({ bavail: p === f.config[which === 'nas' ? 'nasMount' : 'stagingRoot'] ? 0 : 1024, bsize: 4096 });
    expect(f.check).toThrow('CAPACITY_INSUFFICIENT');
    expect(f.calls.some(([file]) => file === 'docker')).toBe(false);
  });

  test.each(['negative', 'nan', 'overflow', 'missing'])('rejects invalid free-space metadata: %s', kind => {
    f.io.statfsSync = () => ({ bavail: { negative: -1, nan: NaN, overflow: Number.MAX_SAFE_INTEGER }[kind], bsize: 4096 });
    expect(f.check).toThrow('CAPACITY_UNVERIFIABLE');
  });

  test.each(['symlink', 'shared', 'nested', 'same'])('rejects unsafe staging: %s', kind => {
    if (kind === 'symlink') {
      fs.rmdirSync(f.config.stagingRoot); fs.symlinkSync(f.root, f.config.stagingRoot);
    }
    if (kind === 'shared') fs.chmodSync(f.config.stagingRoot, 0o755);
    if (kind === 'nested') f.config.stagingRoot = path.join(f.config.nasMount, 'stage');
    if (kind === 'same') f.config.stagingRoot = f.config.nasMount;
    expect(f.check).toThrow('PATH_INVALID');
  });

  test.each(['running', 'paused', 'restarting', 'created', 'dead'])('rejects application state %s even if completion writes are paused', state => {
    f.containers[0].State.Status = state;
    f.containers[0].Config.Env = ['COMPLETION_WRITES_PAUSED=true'];
    expect(f.check).toThrow('WRITERS_NOT_STOPPED');
  });

  test.each(['missing', 'duplicate', 'unknown', 'wrong-project', 'oneoff'])('rejects service inventory %s', kind => {
    if (kind === 'missing') f.containers.pop();
    if (kind === 'duplicate') f.containers[0].Config.Labels['com.docker.compose.service'] = 'gateway';
    if (kind === 'unknown') f.containers[0].Config.Labels['com.docker.compose.service'] = 'worker';
    if (kind === 'wrong-project') f.containers[0].Config.Labels['com.docker.compose.project'] = 'other';
    if (kind === 'oneoff') f.containers[0].Config.Labels['com.docker.compose.oneoff'] = 'True';
    expect(f.check).toThrow('SERVICE_INVENTORY_INVALID');
  });

  test('Mongo must remain running; init must have exited successfully', () => {
    f.containers[8].State.Status = 'exited'; expect(f.check).toThrow('MONGO_NOT_RUNNING');
    f.containers[8].State.Status = 'running'; f.containers[9].State.ExitCode = 1;
    expect(f.check).toThrow('WRITERS_NOT_STOPPED');
  });

  test.each(['journal-missing', 'media-missing', 'database-missing', 'shared-volume', 'bind', 'duplicate-target', 'foreign-volume'])('rejects incomplete backup sources: %s', kind => {
    const resource = f.containers[5];
    if (kind === 'journal-missing') resource.Mounts.pop();
    if (kind === 'media-missing') resource.Mounts.shift();
    if (kind === 'database-missing') f.containers[8].Mounts = [];
    if (kind === 'shared-volume') resource.Mounts[1].Name = resource.Mounts[0].Name;
    if (kind === 'bind') resource.Mounts[1].Type = 'bind';
    if (kind === 'duplicate-target') resource.Mounts.push({ ...resource.Mounts[1] });
    if (kind === 'foreign-volume') f.volumes[0].Labels['com.docker.compose.project'] = 'other';
    expect(f.check).toThrow('VOLUME_INVENTORY_INVALID');
  });

  test('rejects running container sharing protected data even if marked read-only', () => {
    f.running.push({ ...f.containers[0], Id: 'b'.repeat(64), Config: { Labels: {} }, State: { Status: 'running' },
      Mounts: [{ Type: 'volume', Name: 'lms_journal', RW: false }] });
    expect(f.check).toThrow('PROTECTED_VOLUME_IN_USE');
  });

  test('unrelated running services are observed but never stopped', () => {
    f.running.push({ ...f.containers[0], Id: 'b'.repeat(64), Config: { Labels: {} }, State: { Status: 'running' }, Mounts: [] });
    expect(f.check().status).toBe('OBSERVED_PRECONDITIONS_PASS');
  });

  test('rejects an application restarting between project inspection and running-container inspection', () => {
    f.running.push({ ...f.containers[0], State: { Status: 'running', Running: true }, Mounts: [] });
    expect(f.check).toThrow('WRITERS_NOT_STOPPED');
  });

  test('rejects a new same-project writer absent from the earlier inventory', () => {
    f.running.push({ ...f.containers[0], Id: 'b'.repeat(64), State: { Status: 'running', Running: true }, Mounts: [] });
    expect(f.check).toThrow('WRITERS_NOT_STOPPED');
  });

  test.each(['exact', 'parent', 'child'])('rejects protected volume accessed through a bind alias: %s', kind => {
    const source = f.volumes[2].Mountpoint;
    f.running.push({ ...f.containers[0], Id: 'b'.repeat(64), Config: { Labels: {} }, State: { Status: 'running' }, Mounts: [{
      Type: 'bind', Source: kind === 'parent' ? path.dirname(source) : kind === 'child' ? source + '/entries' : source,
      Destination: '/other', RW: false
    }] });
    expect(f.check).toThrow('PROTECTED_VOLUME_IN_USE');
  });

  test('a running Mongo container cannot also mount the private media volume', () => {
    f.containers[8].Mounts.push({ Type: 'volume', Name: 'lms_media', Destination: '/other' });
    expect(f.check).toThrow('PROTECTED_VOLUME_IN_USE');
  });

  test.each(destinations.flatMap(destination => ['bind', 'volume', 'tmpfs'].map(type => [destination, type])))(
    'rejects child mount inside protected root %s (%s)', (destination, type) => {
    const container = destination === '/data/db' ? f.containers[8] : f.containers[5];
    container.Mounts.push({ Type: type, Name: 'nested', Source: '/srv/other-data',
      Destination: destination + '/user-deletions-v2', RW: true });
    expect(f.check).toThrow('VOLUME_INVENTORY_INVALID');
    });

  test('rejects nested tmpfs declared only in HostConfig', () => {
    f.containers[5].HostConfig = { Tmpfs: { [destinations[2] + '/user-deletions-v2']: 'rw' } };
    expect(f.check).toThrow('VOLUME_INVENTORY_INVALID');
  });

  test.each(['stopped', 'paused', 'restarted', 'image'])('rejects last global Mongo observation: %s', kind => {
    const original = f.run; let globals = 0;
    f.run = (file, args) => {
      const output = original(file, args);
      if (file === 'docker' && args[1] === 'inspect' && args.length === 3 && ++globals === 2) {
        const rows = JSON.parse(output);
        if (kind === 'stopped') Object.assign(rows[0].State, { Status: 'exited', Running: false, ExitCode: 137 });
        if (kind === 'paused') rows[0].State.Paused = true;
        if (kind === 'restarted') rows[0].State.StartedAt = '2026-10-30T01:00:00Z';
        if (kind === 'image') rows[0].Image = 'sha256:' + 'b'.repeat(64);
        return JSON.stringify(rows);
      }
      return output;
    };
    expect(() => checkBackupPreflight(f.config, { run: f.run, fs: f.io })).toThrow();
    expect(globals).toBe(2);
  });

  test('normal healthcheck timestamps do not invalidate stable identity', () => {
    const original = f.run; let reads = 0;
    f.run = (file, args) => {
      if (file === 'findmnt' && ++reads === 2) f.containers[8].State.Health = { Status: 'healthy', Log: [{ End: 'later' }] };
      return original(file, args);
    };
    expect(checkBackupPreflight(f.config, { run: f.run, fs: f.io }).status).toBe('OBSERVED_PRECONDITIONS_PASS');
  });

  test.each(['positive', 'command-failure', 'malformed'])('real CLI executes read-only observations: %s', kind => {
    const configFile = path.join(f.root, 'config.json'), fixtureFile = path.join(f.root, 'fixture.json');
    const preload = path.join(f.root, 'preload.cjs'), trace = path.join(f.root, 'trace');
    fs.writeFileSync(configFile, JSON.stringify(f.config), { mode: 0o600 });
    fs.writeFileSync(fixtureFile, JSON.stringify({ mount: f.mount, containers: f.containers, volumes: f.volumes }));
    fs.writeFileSync(preload, `const fs=require('fs');const data=JSON.parse(fs.readFileSync(process.env.BACKUP_FIXTURE));
      Object.defineProperty(process,'platform',{value:'linux'});
      fs.statfsSync=()=>({bavail:1024,bsize:4096});
      require('child_process').execFileSync=(command,args,options)=>{
        fs.appendFileSync(process.env.BACKUP_TRACE,JSON.stringify([command,args])+'\\n');
        for(const key of ['DOCKER_CONTEXT','DOCKER_HOST','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) {
          if(key in options.env)throw Error('unexpected Docker environment');
        }
        if(command==='docker')args=args.slice(1);
        if(process.env.BACKUP_CASE==='command-failure')throw Error('sensitive server address or password');
        if(process.env.BACKUP_CASE==='malformed')return 'invalid data';
        if(command==='findmnt')return JSON.stringify({filesystems:[data.mount]});
        if(command==='docker'&&args[0]==='ps')return (args.includes('--all')?data.containers:[data.containers[8]]).map(x=>x.Id).join('\\n');
        if(command==='docker'&&args[0]==='inspect')return JSON.stringify(args.slice(1).map(id=>data.containers.find(x=>x.Id===id)));
        if(command==='docker'&&args[0]==='volume')return JSON.stringify(data.volumes);
        throw Error('unexpected command');
      };`);
    const run = spawnSync(process.execPath, ['--require', preload,
      path.resolve(__dirname, '../../../../scripts/check-family-backup.js'), '--config', configFile], {
      encoding: 'utf8', env: { ...process.env, BACKUP_FIXTURE: fixtureFile, BACKUP_TRACE: trace, BACKUP_CASE: kind,
        DOCKER_HOST: 'tcp://remote.invalid:2376', DOCKER_CONTEXT: 'other', DOCKER_TLS_VERIFY: '1', DOCKER_CERT_PATH: '/no-certs' }
    });
    const calls = fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
    expect(calls[0][0]).toBe('findmnt');
    if (kind === 'positive') {
      expect(run.status).toBe(0); expect(run.stderr).toBe('');
      expect(JSON.parse(run.stdout)).toMatchObject({ backupCreated: false, restoreVerified: false });
      expect(calls.filter(([command]) => command === 'findmnt')).toHaveLength(2);
      expect(calls.filter(([command]) => command === 'docker').length).toBeGreaterThan(0);
      expect(calls.filter(([command]) => command === 'docker')
        .every(([, args]) => args[0] === '--host=unix:///var/run/docker.sock')).toBe(true);
    } else {
      expect(run.status).not.toBe(0); expect(run.stdout).toBe('');
      expect(run.stderr).not.toMatch(/sensitive|password|server|nas\.example/);
    }
    for (const [command, args] of calls) {
      expect(['findmnt', 'docker']).toContain(command);
      if (command === 'docker') expect(['ps', 'inspect', 'volume']).toContain(args[1]);
    }
  });

  test.each(['state', 'image', 'mount', 'volume-source', 'new-container', 'nas', 'capacity'])('rejects changed observation at final recheck: %s', kind => {
    const original = f.run;
    let nasReads = 0;
    f.run = (file, args) => {
      if (file === 'findmnt' && ++nasReads === 2) {
        if (kind === 'state') f.containers[0].State.Status = 'running';
        if (kind === 'image') f.containers[0].Image = 'sha256:' + 'b'.repeat(64);
        if (kind === 'mount') f.containers[5].Mounts[1].Name = 'other';
        if (kind === 'volume-source') f.volumes[1].Mountpoint = '/var/lib/docker/volumes/changed/_data';
        if (kind === 'new-container') f.containers.push({ ...f.containers[0], Id: 'c'.repeat(64) });
        if (kind === 'nas') f.mount.source = '//other.example.test/share';
        if (kind === 'capacity') f.io.statfsSync = () => ({ bavail: 0, bsize: 4096 });
      }
      return original(file, args);
    };
    // Rebind the injected runner: this is not a mutation of an already captured closure.
    expect(() => checkBackupPreflight(f.config, { run: f.run, fs: f.io })).toThrow();
  });

  test('mount return ordering and unrelated inspect fields do not create false failures', () => {
    const original = f.run; let reads = 0;
    f.run = (file, args) => {
      if (file === 'findmnt' && ++reads === 2) f.containers[5].Mounts.reverse();
      return original(file, args);
    };
    expect(checkBackupPreflight(f.config, { run: f.run, fs: f.io }).status).toBe('OBSERVED_PRECONDITIONS_PASS');
  });

  test('command failures and malformed output redact raw data', () => {
    for (const run of [() => { throw Error('secret-password //private/volume'); }, () => 'not json']) {
      let error; try { checkBackupPreflight(f.config, { run, fs: f.io }); } catch (e) { error = e; }
      expect(error.message).toMatch(/^(OBSERVATION_FAILED|OBSERVATION_INVALID)$/);
      expect(JSON.stringify(error)).not.toMatch(/secret|private/);
    }
  });

  test.each([{}, { ...fixtureConfig(), minimumFreeBytes: 0 }, { ...fixtureConfig(), project: '-all' }])('invalid config fails before commands', config => {
    expect(() => checkBackupPreflight(config, { run: f.run, fs: f.io })).toThrow('CONFIG_INVALID');
    expect(f.run).not.toHaveBeenCalled();
  });

  test('real CLI rejects bad arguments without success or sensitive output', () => {
    const run = spawnSync(process.execPath, [path.resolve(__dirname, '../../../../scripts/check-family-backup.js'), '--execute'], { encoding: 'utf8' });
    expect(run.status).not.toBe(0); expect(run.stdout).toBe('');
    expect(run.stderr).toBe('BACKUP_PREFLIGHT_FAILED: ARGUMENTS_INVALID\n');
  });

  test('guide distinguishes observations from backup success and preserves restoration boundaries', () => {
    const guide = fs.readFileSync(path.resolve(__dirname, '../../../../docs/deployment/local-ubuntu-deployment.md'), 'utf8');
    const backup = guide.slice(guide.indexOf('### 7.4 数据备份'), guide.indexOf('### 7.5 '));
    for (const required of ['completion-journal', 'COMPLETION_WRITES_PAUSED=true', 'OBSERVED_PRECONDITIONS_PASS',
      'backupCreated:false', 'restoreVerified:false', '全站', '精确 snapshot ID', '最新受保护删除日志',
      '不执行 `forget`/`prune`', '不安装 timer', '失败', 'T4 OPEN', 'DEVICE_PENDING', 'REMAINDER_DEFERRED']) {
      expect(backup.includes(required)).toBe(true);
    }
    expect(backup).not.toMatch(/restic restore latest|restic forget --|trap ['"]rm|rm -rf|enable --now lms-backup/);
  });
});

function fixtureConfig() {
  return { project: 'lms', nasMount: '/mnt/nas', nasSource: '//nas.example.test/lms',
    stagingRoot: '/var/backups/lms', minimumFreeBytes: 1024 };
}
