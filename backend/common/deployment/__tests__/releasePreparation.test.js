const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runPreparation } = require('../../../../scripts/release-isolated-prepare');

const uri = 'mongodb://mongo:27017/learning-tracker?replicaSet=rs0';
function fixture(service) {
  const calls = [];
  const collections = [{ name: 'roles' }], roles = [{ name: 'parent' }, { name: 'student' }];
  const mongoose = { set: jest.fn(), connect: jest.fn(async () => { calls.push('connect'); }),
    disconnect: jest.fn(async () => { calls.push('disconnect'); }),
    connection: { db: { listCollections: () => ({ toArray: async () => collections }),
      collection: () => ({ find: () => ({ toArray: async () => roles }) }) } } };
  const model = { db: mongoose.connection, collection: { name: 'users', countDocuments: jest.fn(async () => 0) },
    createCollection: jest.fn(async () => { calls.push('collection'); }),
    createIndexes: jest.fn(async () => { calls.push('indexes'); }) };
  const load = jest.fn(() => model);
  return { env: { MONGO_URI: uri, SYNTHETIC_PREPARATION: service }, mongoose, load, model, calls, collections, roles };
}

describe('fresh synthetic preparation guards', () => {
  test('real file entry performs the fresh read and emits completion only after disconnect', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-entry-'));
    try {
      const preload = path.join(dir, 'dependency.cjs'), trace = path.join(dir, 'trace');
      fs.writeFileSync(preload, `const fs=require('fs'),Module=require('module'),original=Module._load;
        const record=s=>fs.appendFileSync(process.env.PREPARE_TRACE,s+'\\n');
        const db={
          listCollections(){record('list');return {async toArray(){return [{name:'roles'}]}}},
          collection(){return {find(){record('roles');return {async toArray(){return [{name:'parent'},{name:'student'}]}}}}}
        };
        Module._load=function(name,...args){
          if(name==='/app/node_modules/mongoose') return {
            set(){},async connect(){record('connect')},async disconnect(){record('disconnect')},connection:{db}
          };
          return original.call(this,name,...args);
        };`);
      const source = fs.readFileSync(path.resolve(__dirname, '../../../../scripts/release-isolated-prepare.js'));
      const hash = require('crypto').createHash('sha256').update(source).digest('hex');
      const run = spawnSync('sh', [path.resolve(__dirname, '../../../../scripts/run-isolated-prepare.sh'), hash, 'fresh'],
        { input: source, encoding: 'utf8', env: { ...process.env, MONGO_URI: uri, SYNTHETIC_PREPARATION: 'fresh',
          NODE_OPTIONS: `--require=${preload}`, PREPARE_TRACE: trace } });
      expect({ status: run.status, stderr: run.stderr }).toEqual({ status: 0, stderr: '' });
      expect(run.stdout).toBe('Synthetic preparation passed: fresh\n');
      expect(fs.readFileSync(trace, 'utf8')).toBe('connect\nlist\nroles\ndisconnect\n');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test.each(['', 'console.log("unrelated output")', 'process.exit(17)', 'console.log("Synthetic preparation passed: fresh\\nSynthetic preparation passed: fresh")'])('no execution or incorrect completion cannot pass: %s', source => {
    const hash = require('crypto').createHash('sha256').update(source).digest('hex');
    const run = spawnSync('sh', [path.resolve(__dirname, '../../../../scripts/run-isolated-prepare.sh'), hash, 'fresh'],
      { input: source, encoding: 'utf8' });
    expect(run.status).not.toBe(0);
    if (source === 'process.exit(17)') expect(run.status).toBe(17);
  });
  test('real stdin transport executes the file and propagates invalid URI failure', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../../scripts/release-isolated-prepare.js'));
    const hash = require('crypto').createHash('sha256').update(source).digest('hex');
    const run = spawnSync('sh', [path.resolve(__dirname, '../../../../scripts/run-isolated-prepare.sh'), hash, 'fresh'],
      { input: source, encoding: 'utf8', env: { ...process.env, MONGO_URI: 'invalid', SYNTHETIC_PREPARATION: 'fresh' } });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('SYNTHETIC_PREPARATION_FAILED');
    expect(run.stdout).not.toContain('Synthetic preparation passed');
  });
  test.each(['mongodb://real/data', '', undefined])('rejects URI %s before connecting or loading models', async value => {
    const f = fixture('user'); f.env.MONGO_URI = value;
    await expect(runPreparation(f)).rejects.toThrow('WRONG_SYNTHETIC_URI');
    expect(f.calls).toEqual([]); expect(f.load).not.toHaveBeenCalled();
  });
  test('fresh roles-only database is accepted without writes', async () => {
    const f = fixture('fresh'); await runPreparation(f);
    expect(f.calls).toEqual(['connect', 'disconnect']); expect(f.load).not.toHaveBeenCalled();
  });
  test.each(['other-collection', 'wrong-role', 'extra-role'])('refuses non-fresh state: %s', async kind => {
    const f = fixture('fresh');
    if (kind === 'other-collection') f.collections.push({ name: 'mediaassets' });
    if (kind === 'wrong-role') f.roles[0].name = 'admin';
    if (kind === 'extra-role') f.roles.push({ name: 'admin' });
    await expect(runPreparation(f)).rejects.toThrow();
    expect(f.calls).toEqual(['connect', 'disconnect']); expect(f.load).not.toHaveBeenCalled();
  });
  test.each(['nonempty', 'wrong-connection', 'index-error', 'connect-error'])('fails closed and disconnects on %s', async kind => {
    const f = fixture('user');
    if (kind === 'nonempty') f.model.collection.countDocuments.mockResolvedValue(1);
    if (kind === 'wrong-connection') f.model.db = {};
    if (kind === 'index-error') f.model.createIndexes.mockRejectedValue(Error('index failure'));
    if (kind === 'connect-error') f.mongoose.connect.mockRejectedValue(Error('connect failure'));
    await expect(runPreparation(f)).rejects.toThrow();
    expect(f.mongoose.disconnect).toHaveBeenCalledTimes(1);
    if (kind !== 'index-error') expect(f.model.createCollection).not.toHaveBeenCalled();
    expect(f.load.mock.calls.length).toBeLessThanOrEqual(1);
  });
  test.each(['user', 'progress', 'homework', 'resource', 'analytics', 'notification'])('uses own models and awaits every index: %s', async service => {
    const f = fixture(service); await runPreparation(f);
    expect(f.load).toHaveBeenCalled();
    expect(f.calls).toEqual(['connect', ...f.load.mock.calls.flatMap(() => ['collection', 'indexes']), 'disconnect']);
  });
  test.each(['preflight-homework', 'preflight-resource'])('preflight rejection propagates with disconnect: %s', async service => {
    const f = fixture(service), fail = jest.fn(async () => { throw Error('readiness failed'); });
    f.load.mockReturnValue({ assertGrowthTaskCompletionReadiness: fail, checkCompletionOperations: fail });
    await expect(runPreparation(f)).rejects.toThrow('readiness failed');
    expect(fail).toHaveBeenCalledWith({ connection: f.mongoose.connection, writesPaused: true, env: f.env });
    expect(f.mongoose.disconnect).toHaveBeenCalledTimes(1);
  });
  test.each(['permissions', 'nonempty', 'symlink', 'probe'])('storage refuses %s without chmod or DB writes', async kind => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-storage-'));
    try {
      const media = path.join(dir, 'media'), journal = path.join(dir, 'journal');
      fs.mkdirSync(media, { mode: 0o700 }); fs.mkdirSync(journal, { mode: 0o700 });
      if (kind === 'permissions') fs.chmodSync(media, 0o755);
      if (kind === 'nonempty') fs.writeFileSync(path.join(media, 'existing'), 'retain');
      if (kind === 'symlink') { fs.rmdirSync(media); fs.symlinkSync(journal, media); }
      const f = fixture('storage');
      f.env.PRIVATE_MEDIA_ROOT = media; f.env.COMPLETION_DELETION_JOURNAL_ROOT = journal;
      const probe = jest.fn(async () => { throw Error('probe failed'); });
      f.load.mockReturnValue({ assertCompletionStorageReadiness: probe });
      await expect(runPreparation({ ...f, fs: fs.promises })).rejects.toThrow();
      expect(f.calls).toEqual([]);
      expect(probe).toHaveBeenCalledTimes(kind === 'probe' ? 1 : 0);
      if (kind === 'permissions') expect(fs.statSync(media).mode & 0o777).toBe(0o755);
      if (kind === 'nonempty') expect(fs.readFileSync(path.join(media, 'existing'), 'utf8')).toBe('retain');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
