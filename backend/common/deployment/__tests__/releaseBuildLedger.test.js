const subject = require('../../../../scripts/release-build-ledger');
const fs = require('fs');
const os = require('os');
const path = require('path');

const id = c => c.repeat(64);
const image = c => `sha256:${id(c)}`;
const identity = { project: 'family-growth-isolated-ledger', nonce: 'a'.repeat(32), contextHash: id('b') };
const labels = { 'lms.isolation.run': identity.project, 'lms.isolation.nonce': identity.nonce,
  'lms.isolation.context': identity.contextHash, 'lms.isolation.role': 'builder' };
const stamp = '2026-10-29T00:00:01.000Z';
function fixture() {
  const base = { Id: image('0'), Parent: '', Config: { Labels: {} }, Created: stamp, RepoTags: ['node:22-alpine'] };
  const before = { containers: [], images: [base], volumes: [] };
  const current = { containers: [{ Id: id('1'), Created: stamp, Image: base.Id,
    Config: { Labels: { ...labels } }, HostConfig: { CpuPeriod: 100000, CpuQuota: 180000,
      Memory: 2816 * 1024 ** 2, MemorySwap: 2816 * 1024 ** 2, NanoCpus: 0, Privileged: false,
      Binds: null, NetworkMode: 'bridge' },
    State: { Running: false, Status: 'exited', ExitCode: 0 }, Mounts: [] }],
  images: [base, { Id: image('2'), Parent: base.Id, Container: id('1'), Created: stamp, Config: { Labels: { ...labels } }, RepoTags: [`${identity.project}-gateway:candidate`] }], volumes: [] };
  return { before, current, identity, baseId: base.Id, tags: [`${identity.project}-gateway:candidate`],
    candidateIds: [image('2')],
    window: { start: stamp, end: '2026-10-29T00:01:00Z' } };
}
describe('retained legacy build ownership ledger', () => {
  test('registers only full daemon identities and actual limits', () => {
    const result = subject.validateInventory(fixture());
    expect(result.containers.map(x => x.Id)).toEqual([id('1')]);
    expect(result.images.map(x => x.Id)).toEqual([image('2')]);
    expect(result.containers[0].HostConfig.MemorySwap).toBe(2816 * 1024 ** 2);
  });
  test('retains never-started metadata containers without inventing a RUN execution', () => {
    const f = fixture(); f.current.containers[0].State.Status = 'created';
    expect(subject.validateInventory(f).containers).toHaveLength(1);
  });
  test('ordinary non-Compose container with inherited labels is not a committed build container', () => {
    const f = fixture();
    f.current.containers.push({ ...f.current.containers[0], Id: id('5'), Image: image('2') });
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test('rejects a committed diagnostic descendant outside the completed candidate ancestry', () => {
    const f = fixture();
    f.current.containers.push({ ...f.current.containers[0], Id: id('5'), Image: image('2') });
    f.current.images.push({ ...f.current.images[1], Id: image('6'), Parent: image('2'), Container: id('5'), RepoTags: [] });
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test('accepts the Linux daemon normalized bridge network, not CLI default or host networking', () => {
    const f = fixture(); f.current.containers[0].HostConfig.NetworkMode = 'bridge';
    expect(subject.validateInventory(f).containers).toHaveLength(1);
    for (const network of ['default', 'host', 'none', 'foreign-network']) {
      f.current.containers[0].HostConfig.NetworkMode = network;
      expect(() => subject.validateInventory(f)).toThrow();
    }
  });
  test.each(['containers', 'images'])('preserves nanosecond lower bound for %s', kind => {
    const f = fixture(); f.window.start = '2026-10-29T00:00:01.900000002Z';
    f.current.containers[0].Created = '2026-10-29T00:00:01.950000000Z';
    f.current.images[1].Created = '2026-10-29T00:00:01.950000000Z';
    f.current[kind][kind === 'images' ? 1 : 0].Created = '2026-10-29T00:00:01.900000001Z';
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test.each(['containers', 'images', 'volumes'])('rejects %s outside the daemon build window', kind => {
    const f = fixture();
    f.window = { start: stamp, end: '2026-10-29T00:01:00Z' };
    if (kind === 'containers') f.current.containers[0].Created = '2026-10-28T00:00:00Z';
    if (kind === 'images') f.current.images[1].Created = '2026-10-30T00:00:00Z';
    if (kind === 'volumes') {
      f.current.containers[0].Mounts = [{ Type: 'volume', Name: id('3'), Destination: '/var/lib/family-growth/private-media', RW: true }];
      f.current.volumes = [{ Name: id('3'), Driver: 'local', CreatedAt: '2026-10-28T00:00:00Z', Labels: { 'com.docker.volume.anonymous': '' }, Options: null }];
    }
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test.each([
    f => { f.current.containers[0].Config.Labels = {}; },
    f => { f.current.containers[0].Config.Labels['lms.isolation.nonce'] = 'c'.repeat(32); },
    f => { f.current.containers[0].Config.Labels['com.docker.compose.project'] = identity.project; },
    f => { f.current.containers[0].HostConfig.Memory = 0; },
    f => { f.current.containers[0].HostConfig.Memory = 0; f.current.containers[0].HostConfig.MemorySwap = 0; },
    f => { f.current.containers[0].HostConfig.Memory = 4 * 1024 ** 3; f.current.containers[0].HostConfig.MemorySwap = 4 * 1024 ** 3; },
    f => { f.current.containers[0].HostConfig.MemorySwap += 1; },
    f => { f.current.containers[0].HostConfig.CpuQuota += 1; },
    f => { f.current.containers[0].State.Running = true; },
    f => { f.current.containers[0].State.ExitCode = 1; },
    f => { f.current.containers[0].Image = image('9'); },
    f => { f.current.containers[0].Id = 'short'; },
    f => { f.current.images[1].Parent = image('9'); },
    f => { delete f.current.images[1].Container; },
    f => { f.current.images[1].Container = id('9'); },
    f => { f.current.images[1].Container = ''; f.current.images[1].BuildCommand = ['sh', '-c', 'unknown']; },
    f => { f.current.images[1].RepoTags.push('foreign:latest'); },
    f => { f.current.images[1].Config.Labels = {}; },
    f => { f.current.images.splice(0, 1); },
    f => { f.current.containers.push({ ...f.current.containers[0] }); }
  ])('rejects incomplete, foreign, running or inconsistent objects (%#)', mutate => {
    const f = fixture(); mutate(f);
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test('rejects changes to original containers and missing registered containers', () => {
    const f = fixture();
    f.before.containers = [structuredClone(f.current.containers[0])];
    f.current.containers[0].State.Running = true;
    expect(() => subject.validateInventory(f)).toThrow();
    const g = fixture(); g.previous = subject.validateInventory(g); g.current.containers = [];
    expect(() => subject.validateInventory(g)).toThrow();
  });
  test('records a new exclusive anonymous volume before removing its owning container', () => {
    const f = fixture();
    f.current.containers[0].Mounts = [{ Type: 'volume', Name: id('3'), Destination: '/var/lib/family-growth/private-media', RW: true }];
    f.current.volumes = [{ Name: id('3'), Driver: 'local', CreatedAt: stamp, Labels: { 'com.docker.volume.anonymous': '' }, Options: null }];
    expect(subject.validateInventory(f).volumes.map(v => v.Name)).toEqual([id('3')]);
    f.before.volumes = structuredClone(f.current.volumes);
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test.each(['unreferenced', 'named', 'bind', 'driver', 'options', 'missing-marker', 'bad-marker', 'extra-label'])('rejects unsafe volume %s', mode => {
    const f = fixture();
    f.current.containers[0].Mounts = [{ Type: 'volume', Name: id('3'), Destination: '/var/lib/family-growth/private-media', RW: true }];
    f.current.volumes = [{ Name: id('3'), Driver: 'local', CreatedAt: stamp, Labels: { 'com.docker.volume.anonymous': '' }, Options: null }];
    expect(subject.validateInventory(f).volumes).toHaveLength(1);
    if (mode === 'unreferenced') f.current.containers[0].Mounts = [];
    if (mode === 'named') { f.current.volumes[0].Name = 'foreign'; f.current.containers[0].Mounts[0].Name = 'foreign'; }
    if (mode === 'bind') f.current.containers[0].Mounts[0].Type = 'bind';
    if (mode === 'driver') f.current.volumes[0].Driver = 'nfs';
    if (mode === 'options') f.current.volumes[0].Options = { device: '/real' };
    if (mode === 'missing-marker') f.current.volumes[0].Labels = {};
    if (mode === 'bad-marker') f.current.volumes[0].Labels['com.docker.volume.anonymous'] = 'true';
    if (mode === 'extra-label') f.current.volumes[0].Labels.foreign = 'value';
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test('refuses a volume referenced by an original container even with a matching anonymous name', () => {
    const f = fixture();
    const original = { ...structuredClone(f.current.containers[0]), Id: id('9'), Mounts: [{ Type: 'volume', Name: id('3'), Destination: '/var/lib/family-growth/private-media', RW: true }] };
    f.before.containers.push(original); f.current.containers.push(original);
    f.current.containers[0].Mounts = [{ Type: 'volume', Name: id('3'), Destination: '/var/lib/family-growth/private-media', RW: true }];
    f.current.volumes = [{ Name: id('3'), Driver: 'local', CreatedAt: stamp, Labels: { 'com.docker.volume.anonymous': '' }, Options: null }];
    expect(() => subject.validateInventory(f)).toThrow();
  });
  test('inspect failure is fatal rather than inferred from Running/Removed log lines', async () => {
    const run = jest.fn(async args => {
      if (args[1] === 'ls') return `${id('1')}\n`;
      throw Error('No such object');
    });
    await expect(subject.inventory(run)).rejects.toThrow('No such object');
    expect(run).toHaveBeenCalledTimes(2);
  });
  test('persists no arbitrary labels, bind paths, volume options or legacy build environment', async () => {
    const f = fixture(), secret = 'synthetic-do-not-log-private-value';
    f.current.containers[0].Config.Labels.private = secret;
    f.current.containers[0].Config.Env = [`SECRET=${secret}`];
    f.current.containers[0].HostConfig.Binds = [`/${secret}:/private`];
    f.current.images[1].ContainerConfig = { Cmd: ['sh', '-c', secret], Env: [`SECRET=${secret}`] };
    f.current.volumes = [{ Name: id('3'), Driver: 'local', CreatedAt: stamp, Options: { password: secret }, Labels: { private: secret } }];
    const calls = [], run = async (args, options) => {
      calls.push({ args, options });
      const kind = { container: 'containers', image: 'images', volume: 'volumes' }[args[0]];
      const key = kind === 'volumes' ? 'Name' : 'Id';
      if (args[1] === 'ls') return f.current[kind].map(row => row[key]).join('\n');
      return JSON.stringify(f.current[kind].filter(row => row[key] === args[2]));
    };
    const saved = await subject.inventory(run);
    expect(JSON.stringify(saved)).not.toContain(secret);
    expect(saved.images[1].Container).toBe(id('1'));
    expect(calls.filter(c => c.args[0] === 'image' && c.args[1] === 'inspect')
      .every(c => c.options.env.DOCKER_API_VERSION === '1.44' && !c.args.includes('--format'))).toBe(true);
  });
});

describe('mount order in safe inventory projection', () => {
  const read = rows => subject.inventory(async args => {
    const kind = { container: 'containers', image: 'images', volume: 'volumes' }[args[0]];
    const key = kind === 'volumes' ? 'Name' : 'Id';
    if (args[1] === 'ls') return rows[kind].map(row => row[key]).join('\n');
    return JSON.stringify(rows[kind].filter(row => row[key] === args[2]));
  });
  function mountedFixture() {
    const f = fixture();
    const original = { ...structuredClone(f.current.containers[0]), Id: id('9'), Mounts: [
      { Type: 'volume', Name: 'synthetic-media', Destination: '/var/lib/family-growth/private-media', RW: true },
      { Type: 'volume', Name: 'synthetic-journal', Destination: '/synthetic-private-journal', RW: true }
    ] };
    f.before.containers.push(original);
    f.current.containers.push(structuredClone(original));
    return f;
  }
  test('accepts reversed inspect mount order without mutating or exposing the raw inventory', async () => {
    const f = mountedFixture();
    f.current.containers[1].Mounts.reverse();
    const raw = structuredClone(f);
    const before = await read(f.before), current = await read(f.current);
    expect(current.containers[1].Mounts).toEqual(before.containers[0].Mounts);
    expect(current.containers[1].Mounts).toHaveLength(2);
    expect(subject.validateInventory({ ...f, before, current }).containers.map(c => c.Id)).toEqual([id('1')]);
    expect(f).toEqual(raw);
    expect(JSON.stringify({ before, current })).not.toContain('/synthetic-private-journal');
  });
  test.each([
    ['Type', mounts => { mounts[0].Type = 'bind'; }],
    ['Name', mounts => { mounts[0].Name = 'different-volume'; }],
    ['Destination', mounts => { mounts[1].Destination = '/different-private-journal'; }],
    ['RW', mounts => { mounts[0].RW = false; }],
    ['removed', mounts => { mounts.pop(); }],
    ['added', mounts => { mounts.push({ ...mounts[0], Name: 'another-volume' }); }],
    ['duplicate', mounts => { mounts.push({ ...mounts[0] }); }],
    ['same-count replacement', mounts => { mounts[1] = { ...mounts[0] }; }]
  ])('rejects an actual %s change even when inspect also reverses mounts', async (_name, mutate) => {
    const f = mountedFixture();
    mutate(f.current.containers[1].Mounts);
    f.current.containers[1].Mounts.reverse();
    const before = await read(f.before), current = await read(f.current);
    expect(() => subject.validateInventory({ ...f, before, current })).toThrow('BUILD_OBJECT_CHANGED');
  });
  test('keeps duplicate multiplicity when canonicalizing order', async () => {
    const f = mountedFixture();
    f.before.containers[0].Mounts.push({ ...f.before.containers[0].Mounts[0] });
    const mounts = f.before.containers[0].Mounts;
    f.current.containers[1].Mounts = [...mounts.slice(1), mounts[0]];
    const before = await read(f.before), current = await read(f.current);
    expect(current.containers[1].Mounts).toEqual(before.containers[0].Mounts);
    expect(current.containers[1].Mounts).toHaveLength(3);
    expect(subject.validateInventory({ ...f, before, current }).containers).toHaveLength(1);
  });
});

describe('exact retained-object cleanup', () => {
  let directory;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'build-ledger-')); });
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });
  const ledger = () => {
    const f = fixture(); return { ...f, owned: subject.validateInventory(f), state: 'CLOSED', schema: 1 };
  };
  test.each(['IN_FLIGHT', 'UNKNOWN', 'REGISTERING', 'FAILED'])('cannot clean or enable after %s', async state => {
    const value = ledger(); value.state = state;
    const run = jest.fn();
    await expect(subject.cleanupOwned({ ledger: value, run, readInventory: async () => value.current,
      file: path.join(directory, 'state.json'), monitorStopped: true })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
  test('requires outer monitor shutdown, never deletes concurrently with the monitor', async () => {
    const value = ledger(), run = jest.fn();
    await expect(subject.cleanupOwned({ ledger: value, run, readInventory: async () => value.current,
      file: path.join(directory, 'state.json') })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
  test('removes exact registered stopped containers then images without force or prune', async () => {
    const value = ledger(), current = structuredClone(value.current), calls = [];
    await subject.cleanupOwned({ ledger: value, file: path.join(directory, 'state.json'), monitorStopped: true,
      readInventory: async () => structuredClone(current), run: async args => {
        calls.push(args); if (args[0] === 'container') current.containers = [];
        if (args[0] === 'image') current.images = current.images.filter(i => i.Id !== args.at(-1));
      } });
    expect(calls).toEqual([['container', 'rm', id('1')], ['image', 'rm', '--no-prune', image('2')]]);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'state.json'))).state).toBe('CLEANED');
  });
  test('a runtime container inheriting the labels is never added to cleanup registry', async () => {
    const value = ledger(); value.current.containers.push({ ...value.current.containers[0], Id: id('4') });
    const run = jest.fn();
    await expect(subject.cleanupOwned({ ledger: value, run, readInventory: async () => value.current,
      file: path.join(directory, 'state.json'), monitorStopped: true })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
  test('deletion error stops without broad fallback and preserves incomplete evidence', async () => {
    const value = ledger(), run = jest.fn().mockRejectedValue(Error('in-use'));
    await expect(subject.cleanupOwned({ ledger: value, run, readInventory: async () => value.current,
      file: path.join(directory, 'state.json'), monitorStopped: true })).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'state.json'))).state).toBe('CLEANUP_INCOMPLETE');
  });
  test('keeps mount evidence through container removal and removes volumes before child-first images', async () => {
    const f = fixture();
    f.current.containers[0].Mounts = [{ Type: 'volume', Name: id('3'), Destination: '/var/lib/family-growth/private-media', RW: true }];
    f.current.volumes = [{ Name: id('3'), Driver: 'local', CreatedAt: stamp, Labels: { 'com.docker.volume.anonymous': '' }, Options: null }];
    f.current.images.push({ ...f.current.images[1], Id: image('4'), Parent: image('2'), RepoTags: [],
      Container: '', BuildCommand: ['/bin/sh', '-c', '#(nop) COPY dir:synthetic in ./backend '] });
    f.current.images[2].RepoTags = f.current.images[1].RepoTags;
    f.current.images[1].RepoTags = []; f.candidateIds = [image('4')];
    const value = { ...f, owned: subject.validateInventory(f), state: 'CLOSED', schema: 1 };
    const current = structuredClone(f.current), calls = [];
    const file = path.join(directory, 'state.json');
    await subject.cleanupOwned({ ledger: value, file, monitorStopped: true,
      readInventory: async () => structuredClone(current), run: async args => {
        calls.push(args);
        expect(JSON.parse(fs.readFileSync(file)).owned.volumes[0].Name).toBe(id('3'));
        if (args[0] === 'container') current.containers = [];
        if (args[0] === 'volume') current.volumes = [];
        if (args[0] === 'image') current.images = current.images.filter(i => i.Id !== args.at(-1));
      } });
    expect(calls).toEqual([['container', 'rm', id('1')], ['volume', 'rm', id('3')],
      ['image', 'rm', '--no-prune', image('4')], ['image', 'rm', '--no-prune', image('2')]]);
  });
});
