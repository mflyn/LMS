const fs = require('fs');
const path = require('path');
const os = require('os');
const subject = require('../../../../scripts/release-retained-build');
const names = ['gateway', 'user-service', 'progress-service', 'homework-service', 'resource-service', 'analytics-service', 'notification-service'];
const project = 'family-growth-isolated-lifecycle';
const digest = `node@sha256:${'1'.repeat(64)}`;
const base = { Id: `sha256:${'2'.repeat(64)}`, Parent: '', RepoTags: ['node:22-alpine'], Config: { Labels: {}, OnBuild: [] },
  RepoDigests: [digest], Os: 'linux', Architecture: 'amd64', Created: '2026-10-29T00:00:00Z' };
describe('retained build lifecycle', () => {
  let directory;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'retained-build-')); });
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });
  function setup({ failAt, badBase, corruptInventory, lateObject, noProvenance } = {}) {
    const current = { containers: [], images: [base], volumes: [] }, calls = [];
    const config = { services: Object.fromEntries(names.map(name => [name, { image: `${project}-${name}:candidate` }])) };
    let input, builds = 0, active = 0, peak = 0, reads = 0;
    const prepare = jest.fn(({ nonce }) => {
      input = { context: path.join(directory, 'snapshot'), contextHash: '3'.repeat(64),
        identity: { project, nonce, contextHash: '3'.repeat(64), baseDigest: digest, role: 'builder' }, files: names.map(name => ({ name, dockerfile: `/frozen/${name}` })) };
      return input;
    });
    const run = jest.fn(async (args, options) => {
      calls.push({ args, options });
      if (args[0] === 'info') return JSON.stringify(base.Created);
      if (args[0] === 'image') {
        const candidate = current.images.find(i => i.Id === args[2] || i.RepoTags?.includes(args[2]));
        return JSON.stringify([candidate && candidate.Id !== base.Id ? candidate : { ...base, ...(badBase || {}) }]);
      }
      active++; peak = Math.max(peak, active); await Promise.resolve(); active--; builds++;
      if (builds === failAt) throw Error('transport-unknown');
      const labels = { 'lms.isolation.run': project, 'lms.isolation.nonce': input.identity.nonce,
        'lms.isolation.context': input.contextHash, 'lms.isolation.role': 'builder' };
      current.images.push({ Id: `sha256:${(builds + 3).toString(16).repeat(64)}`, Parent: base.Id, Created: base.Created,
        Container: String(builds).repeat(64),
        RepoTags: [args[args.indexOf('-t') + 1]], Config: { Labels: labels }, Os: 'linux', Architecture: 'amd64' });
      if (noProvenance) { delete current.images.at(-1).Container; delete current.images.at(-1).Parent; }
      current.containers.push({ Id: String(builds).repeat(64), Created: base.Created, Image: base.Id,
        Config: { Labels: labels }, State: { Running: false, Status: 'created', ExitCode: 0 }, Mounts: [],
        HostConfig: { CpuPeriod: 100000, CpuQuota: 180000, Memory: 2816 * 1024 ** 2, MemorySwap: 2816 * 1024 ** 2, NetworkMode: 'bridge' } });
      if (corruptInventory) current.containers.at(-1).HostConfig.Memory = 0;
      return 'Running in ignored-output-never-used';
    });
    return { calls, run, prepare, peak: () => peak,
      options: { directory, root: '/source', config, project, run, prepare, verify: jest.fn(),
        readInventory: async () => {
          reads++;
          if (lateObject && reads === 9) current.containers.push({ ...current.containers[0], Id: 'f'.repeat(64), Config: { Labels: {} } });
          return JSON.parse(JSON.stringify(current));
        } } };
  }
  test('seven serial builds retain intermediates, bind immutable input and verify actual limits', async () => {
    const f = setup(); await subject.runRetainedBuild(f.options);
    const commands = f.calls.filter(c => c.args[0] === 'build');
    expect(commands).toHaveLength(7); expect(f.peak()).toBe(1);
    for (const [index, c] of commands.entries()) {
      expect(c.args).toEqual(expect.arrayContaining(['--pull=false', '--platform=linux/amd64', '--rm=false', '--force-rm=false',
        '--cpu-period=100000', '--cpu-quota=180000', '--memory=2816m', '--memory-swap=2816m', '-f', `/frozen/${names[index]}`]));
      expect(c.args.at(-1)).toBe(path.join(directory, 'snapshot'));
      expect(c.options.env.DOCKER_BUILDKIT).toBe('0');
    }
    const ledger = JSON.parse(fs.readFileSync(path.join(directory, 'build-ledger.json')));
    expect(ledger.state).toBe('CLOSED'); expect(ledger.owned.containers).toHaveLength(7);
    expect(f.options.verify).toHaveBeenCalledTimes(8);
  });
  test('transport failure stays UNKNOWN, stops the next image, never performs cleanup', async () => {
    const f = setup({ failAt: 2 });
    await expect(subject.runRetainedBuild(f.options)).rejects.toThrow();
    expect(f.calls.filter(c => c.args[0] === 'build')).toHaveLength(2);
    expect(f.calls.some(c => ['rm', 'prune', 'stop'].includes(c.args[1]))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'build-ledger.json'))).state).toBe('UNKNOWN');
  });
  test.each([{ Architecture: 'arm64' }, { Config: { OnBuild: ['RUN unsafe'] } }, { RepoDigests: [] }])('base assumptions fail before build (%#)', async badBase => {
    const f = setup({ badBase }); await expect(subject.runRetainedBuild(f.options)).rejects.toThrow();
    expect(f.calls.some(c => c.args[0] === 'build')).toBe(false);
  });
  test.each([{ corruptInventory: true }, { lateObject: true }])('bad limits or final reconciliation failure cannot close (%#)', async options => {
    const f = setup(options); await expect(subject.runRetainedBuild(f.options)).rejects.toThrow();
    const evidence = JSON.parse(fs.readFileSync(path.join(directory, 'build-ledger.json')));
    expect(evidence.state).not.toBe('CLOSED');
    expect(evidence.lastObservation.containers.length).toBeGreaterThan(0);
  });
  test('closed build is rechecked before startup; matching labels cannot register a new late container', async () => {
    const f = setup(); const ledger = await subject.runRetainedBuild(f.options);
    await expect(subject.requireClosedBuild({ ...f.options })).resolves.toMatchObject({ state: 'CLOSED' });
    const current = await f.options.readInventory();
    current.containers.push({ ...current.containers[0], Id: 'e'.repeat(64) });
    await expect(subject.requireClosedBuild({ ...f.options, readInventory: async () => current })).rejects.toThrow();
    expect(ledger.owned.containers).toHaveLength(7);
  });
  test('input mutation aborts before the next build and cannot reuse UNKNOWN evidence', async () => {
    const f = setup(); f.options.verify.mockImplementationOnce(() => { throw Error('input changed'); });
    await expect(subject.runRetainedBuild(f.options)).rejects.toThrow('input changed');
    expect(f.calls.some(c => c.args[0] === 'build')).toBe(false);
    await expect(subject.requireClosedBuild(f.options)).rejects.toThrow();
    await expect(subject.runRetainedBuild(f.options)).rejects.toThrow();
  });
  test('base digest identity mismatch is rejected before any build mutation', async () => {
    const f = setup(), original = f.options.run;
    f.options.run = async (args, options) => {
      if (args[0] === 'image' && args[2] === digest) return JSON.stringify([{ ...base, Id: `sha256:${'9'.repeat(64)}` }]);
      return original(args, options);
    };
    await expect(subject.runRetainedBuild(f.options)).rejects.toThrow();
    expect(f.calls.some(c => c.args[0] === 'build')).toBe(false);
  });
  test('pre-existing candidate image is never adopted or retagged', async () => {
    const f = setup(), original = f.options.readInventory;
    f.options.readInventory = async () => {
      const value = await original(); value.images.push({ ...base, Id: `sha256:${'f'.repeat(64)}`,
        RepoTags: [`${project}-gateway:candidate`] }); return value;
    };
    await expect(subject.runRetainedBuild(f.options)).rejects.toThrow();
    expect(f.calls.some(c => c.args[0] === 'build')).toBe(false);
  });
  test('candidate acceptance needs no legacy provenance, never closes cleanup ledger', async () => {
    const f = setup({ noProvenance: true });
    const options = { ...f.options, candidateOnly: true };
    const receipt = await subject.runRetainedBuild(options);
    expect(receipt).toMatchObject({ schema: 2, state: 'VERIFIED', cacheCleanup: 'RETAINED_NOT_AUTHORIZED' });
    expect(receipt.candidates).toHaveLength(7);
    expect(receipt.owned).toBeUndefined();
    expect(fs.existsSync(path.join(directory, 'build-ledger.json'))).toBe(false);
    await expect(subject.requireClosedBuild(options)).resolves.toMatchObject({ state: 'VERIFIED' });
    await expect(subject.cleanupRetainedBuild({ ...options, monitorStopped: true })).rejects.toThrow();
    expect(f.calls.some(c => ['rm', 'prune', 'stop'].includes(c.args[1]))).toBe(false);
  });
  test.each(['unknown-running', 'limits', 'retag', 'input', 'transport'])('candidate path refuses %s and never cleans caches', async fault => {
    const f = setup({ noProvenance: true, failAt: fault === 'transport' ? 2 : undefined,
      corruptInventory: fault === 'limits' });
    const options = { ...f.options, candidateOnly: true };
    if (fault === 'limits' || fault === 'transport') {
      await expect(subject.runRetainedBuild(options)).rejects.toThrow();
      const r = JSON.parse(fs.readFileSync(path.join(directory, 'candidate-build.json')));
      expect(r.state).toBe(fault === 'transport' ? 'UNKNOWN' : 'FAILED');
    } else {
      await subject.runRetainedBuild(options);
      const current = await options.readInventory();
      if (fault === 'unknown-running') current.containers.push({ Id: 'f'.repeat(64), Config: { Labels: {} }, State: { Running: true } });
      if (fault === 'retag') current.images[1].Id = `sha256:${'e'.repeat(64)}`;
      if (fault === 'input') options.verify.mockImplementation(() => { throw Error('input changed'); });
      await expect(subject.requireClosedBuild({ ...options, readInventory: async () => current })).rejects.toThrow();
    }
    expect(f.calls.some(c => ['rm', 'prune', 'stop'].includes(c.args[1]))).toBe(false);
  });
  test.each(['identity', 'platform', 'onbuild', 'id'])('startup rejects candidate inspect %s drift even with an unchanged inventory', async fault => {
    const f = setup({ noProvenance: true }), options = { ...f.options, candidateOnly: true };
    await subject.runRetainedBuild(options);
    const run = async (args, extra) => {
      const output = await f.run(args, extra);
      if (args[0] !== 'image' || !args[2].endsWith(':candidate')) return output;
      const rows = JSON.parse(output);
      if (fault === 'identity') rows[0].Config.Labels['lms.isolation.nonce'] = 'f'.repeat(32);
      if (fault === 'platform') rows[0].Architecture = 'arm64';
      if (fault === 'onbuild') rows[0].Config.OnBuild = ['RUN forbidden'];
      if (fault === 'id') rows[0].Id = `sha256:${'e'.repeat(64)}`;
      return JSON.stringify(rows);
    };
    await expect(subject.requireClosedBuild({ ...options, run })).rejects.toThrow('UNSAFE_RETAINED_BUILD');
    expect(f.calls.some(c => c.args.includes('rm') || c.args.includes('prune'))).toBe(false);
  });
  test.each(['original', 'running-owned', 'stopped-unknown', 'missing-intermediate'])('candidate verification rejects %s changes', async fault => {
    const f = setup({ noProvenance: true }), options = { ...f.options, candidateOnly: true };
    await subject.runRetainedBuild(options);
    const current = await options.readInventory();
    if (fault === 'original') current.images[0].RepoTags.push('changed:tag');
    if (fault === 'running-owned') current.containers[0].State.Running = true;
    if (fault === 'stopped-unknown') current.containers.push({ ...current.containers[0], Id: 'f'.repeat(64), Config: { Labels: {} } });
    if (fault === 'missing-intermediate') current.containers.pop();
    await expect(subject.requireClosedBuild({ ...options, readInventory: async () => current })).rejects.toThrow();
    expect(f.calls.some(c => c.args.includes('rm') || c.args.includes('prune'))).toBe(false);
  });
  test('an incomplete candidate receipt cannot authorize startup or legacy cleanup', async () => {
    const f = setup({ noProvenance: true }), options = { ...f.options, candidateOnly: true };
    const receipt = await subject.runRetainedBuild(options);
    receipt.candidates.pop();
    fs.writeFileSync(path.join(directory, 'candidate-build.json'), JSON.stringify(receipt));
    await expect(subject.requireClosedBuild(options)).rejects.toThrow();
    await expect(subject.requireClosedBuild(f.options)).rejects.toThrow();
    await expect(subject.cleanupRetainedBuild({ ...options, monitorStopped: true })).rejects.toThrow();
    expect(f.calls.some(c => c.args.includes('rm') || c.args.includes('prune'))).toBe(false);
  });
});
