const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const repository = path.resolve(__dirname, '../../../..');
const names = ['gateway', 'user-service', 'progress-service', 'homework-service',
  'resource-service', 'analytics-service', 'notification-service'];
const dockerPath = name => name === 'gateway' ? 'backend/gateway/Dockerfile' : `backend/services/${name}/Dockerfile`;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const project = 'family-growth-isolated-t7';
const nonce = 'a1'.repeat(16);
const baseDigest = `node@sha256:${'ab'.repeat(32)}`;
let tmp, root, directory, tracked, ignored, options, git;
const api = () => require('../../../../scripts/release-build-input');

function write(name, data, mode = 0o644) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, { mode });
  return file;
}

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'release-input-')));
  root = path.join(tmp, 'source');
  directory = path.join(tmp, 'input');
  fs.mkdirSync(root);
  tracked = new Map(); ignored = [];
  for (const name of names) {
    const source = fs.readFileSync(path.join(repository, dockerPath(name)));
    write(dockerPath(name), source);
    tracked.set(dockerPath(name), '100644');
  }
  for (const [name, data] of Object.entries({
    '.dockerignore': 'docs\n**/__tests__\n', 'package.json': '{}\n',
    'package-lock.json': '{}\n', 'backend/server.js': 'working edit\n',
    'docs/notes.md': 'tracked but docker-ignored\n', '.gitignore': '*.log\n'
  })) { write(name, data); tracked.set(name, '100644'); }
  write('untracked.txt', 'not a build input');
  write('.git/config', 'not a build input');
  options = { root, directory, project, nonce, baseDigest };
  // No git init/add/commit, even in fixtures. Only the read-only Git transport is stubbed.
  git = jest.spyOn(childProcess, 'execFile').mockImplementation((command, args, opts, done) => {
    if (command !== 'git' || opts.cwd !== root || opts.shell) throw Error('UNEXPECTED_GIT_CALL');
    let output;
    if (args.join(' ') === 'rev-parse --show-toplevel') output = `${root}\n`;
    else if (args.join(' ') === 'ls-files --stage -z') {
      output = [...tracked].map(([name, mode]) => `${mode} ${'0'.repeat(40)} 0\t${name}\0`).join('');
    } else if (args.join(' ') === 'ls-files --cached --ignored --exclude-standard -z') {
      output = ignored.length ? `${ignored.join('\0')}\0` : '';
    } else throw Error(`UNEXPECTED_GIT_ARGS: ${args.join(' ')}`);
    done(null, Buffer.from(output));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('stages working bytes, freezes all context files and puts seven labeled Dockerfiles outside context', async () => {
  const { prepareBuildInput, verifyBuildInput, services } = api();
  const input = await prepareBuildInput(options);
  expect(services).toEqual(names);
  expect(input.files.map(f => f.name)).toEqual(names);
  expect(input.identity).toEqual({ project, nonce, role: 'builder', baseDigest, contextHash: input.contextHash });
  expect(fs.readFileSync(path.join(input.context, 'backend/server.js'), 'utf8')).toBe('working edit\n');
  expect(fs.existsSync(path.join(input.context, '.git'))).toBe(false);
  expect(fs.existsSync(path.join(input.context, 'untracked.txt'))).toBe(false);
  expect(fs.readFileSync(path.join(input.context, '.dockerignore'))).toEqual(fs.readFileSync(path.join(root, '.dockerignore')));
  const directories = new Set();
  for (const name of tracked.keys()) {
    let parent = path.posix.dirname(name);
    while (parent !== '.') { directories.add(parent); parent = path.posix.dirname(parent); }
  }
  const manifest = [
    { name: '.', type: 'directory', mode: 0o700 },
    ...[...directories].map(name => ({ name, type: 'directory', mode: 0o755 })),
    ...[...tracked.keys()].map(name => ({
      name, type: 'file', hash: digest(fs.readFileSync(path.join(root, name))), mode: fs.statSync(path.join(root, name)).mode & 0o777
    }))
  ].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  expect(input.contextHash).toBe(digest(JSON.stringify(manifest)));
  for (const file of input.files) {
    const original = fs.readFileSync(path.join(root, dockerPath(file.name)), 'utf8');
    expect(fs.readFileSync(path.join(input.context, dockerPath(file.name)), 'utf8')).toBe(original);
    expect(path.relative(input.context, file.dockerfile).startsWith('../')).toBe(true);
    const generated = fs.readFileSync(file.dockerfile, 'utf8');
    expect(generated).toBe(`FROM ${baseDigest}\nLABEL lms.isolation.run=${project} lms.isolation.nonce=${nonce} lms.isolation.role=builder lms.isolation.context=${input.contextHash}\n${original.slice(original.indexOf('\n') + 1)}`);
    expect(generated).not.toContain('com.docker.compose');
    expect(file.sourceHash).toBe(digest(original));
    expect(file.generatedHash).toBe(digest(generated));
  }
  expect(await verifyBuildInput(input)).toBe(true);
  expect(Object.isFrozen(input.identity)).toBe(true);
  expect(Object.isFrozen(input.files[0])).toBe(true);
});

test('verification never rereads source or Git and does not reuse mutable source', async () => {
  const input = await api().prepareBuildInput(options);
  fs.rmSync(root, { recursive: true });
  git.mockImplementation(() => { throw Error('SOURCE_REUSED'); });
  expect(await api().verifyBuildInput(input)).toBe(true);
  expect(await api().verifyBuildInput(JSON.parse(JSON.stringify(input)))).toBe(true);
});

test('normalizes context directories to 0755 and root to 0700 even under restrictive umask', async () => {
  fs.chmodSync(path.join(root, 'backend'), 0o700);
  const previous = process.umask(0o077);
  let input;
  try { input = await api().prepareBuildInput(options); }
  finally { process.umask(previous); }
  expect(fs.statSync(input.context).mode & 0o7777).toBe(0o700);
  for (const name of ['backend', 'backend/services', 'backend/services/resource-service', 'docs']) {
    expect(fs.statSync(path.join(input.context, name)).mode & 0o7777).toBe(0o755);
  }
  expect(fs.statSync(path.join(root, 'backend')).mode & 0o7777).toBe(0o700);
  expect(await api().verifyBuildInput(input)).toBe(true);
});

test('source directory modes do not change the explicitly normalized snapshot', async () => {
  const first = await api().prepareBuildInput(options);
  fs.chmodSync(path.join(root, 'backend'), 0o700);
  const second = await api().prepareBuildInput({ ...options, directory: path.join(tmp, 'second') });
  expect(second.contextHash).toBe(first.contextHash);
  expect(fs.statSync(path.join(second.context, 'backend')).mode & 0o7777).toBe(0o755);
});

test.each(['content', 'mode', 'ignored-by-docker'])('full context hash binds %s changes', async kind => {
  const first = await api().prepareBuildInput(options);
  if (kind === 'mode') fs.chmodSync(path.join(root, 'backend/server.js'), 0o755);
  else write(kind === 'content' ? 'backend/server.js' : 'docs/notes.md', 'changed\n');
  const second = await api().prepareBuildInput({ ...options, directory: path.join(tmp, 'second') });
  expect(second.contextHash).not.toBe(first.contextHash);
});

test('identity and digest do not create a context hash cycle', async () => {
  const first = await api().prepareBuildInput(options);
  const second = await api().prepareBuildInput({ ...options, directory: path.join(tmp, 'second'),
    nonce: 'b2'.repeat(16), baseDigest: `node@sha256:${'cd'.repeat(32)}` });
  expect(second.contextHash).toBe(first.contextHash);
  expect(second.files[0].generatedHash).not.toBe(first.files[0].generatedHash);
});

test('excludes tracked env, credential, evidence and ignored runtime paths, not just untracked ones', async () => {
  const excluded = ['.env', 'backend/.env.example', 'backend/.env.test', 'docker-compose.ubuntu.env.example',
    '.npmrc', '.git-credentials', '.envrc', 'config/private.pem', 'config/credentials.json', '.aws/config',
    'docs/development/evidence/run/result.json', 'release-gate-artifacts/run/output',
    'backend/uploads/photo.jpg', 'backend/logs/runtime.log', 'backend/node_modules/pkg/index.js',
    'custom-runtime/data.bin'];
  for (const name of excluded) { write(name, 'do not copy'); tracked.set(name, '100644'); }
  ignored.push('custom-runtime/data.bin');
  const input = await api().prepareBuildInput(options);
  for (const name of excluded) expect(fs.existsSync(path.join(input.context, name))).toBe(false);
});

test('context hash binds the allowed snapshot, not excluded env, evidence or Git-ignored bytes', async () => {
  const excluded = ['backend/.env', 'docs/development/evidence/run/result.json', 'custom-runtime/data.bin'];
  for (const name of excluded) { write(name, 'before'); tracked.set(name, '100644'); }
  ignored.push('custom-runtime/data.bin');
  const first = await api().prepareBuildInput(options);
  for (const name of excluded) write(name, 'after');
  const second = await api().prepareBuildInput({ ...options, directory: path.join(tmp, 'second') });
  expect(second.contextHash).toBe(first.contextHash);
  expect(fs.readFileSync(path.join(second.context, '.dockerignore'))).toEqual(fs.readFileSync(path.join(root, '.dockerignore')));
  for (const name of excluded) expect(fs.existsSync(path.join(second.context, name))).toBe(false);
});

test('rejects a Git-ignored .dockerignore instead of excluding the required policy file', async () => {
  ignored.push('.dockerignore');
  await expect(api().prepareBuildInput(options)).rejects.toThrow('MISSING_BUILD_CONTROL_FILE');
  expect(fs.existsSync(directory)).toBe(false);
});

test.each([
  ['baseDigest', 'node:22-alpine'], ['baseDigest', `alpine@sha256:${'a'.repeat(64)}`],
  ['baseDigest', `node@sha256:${'a'.repeat(63)}`], ['baseDigest', `${baseDigest}\n`],
  ['project', 'family-growth'], ['project', 'family-growth-isolated-'],
  ['project', 'family-growth-isolated-a;touch x'], ['project', 'family-growth-isolated-A'],
  ['nonce', 'a'.repeat(31)], ['nonce', `${nonce}\n`]
])('rejects unsafe %s value %s before creating output', async (key, value) => {
  await expect(api().prepareBuildInput({ ...options, [key]: value })).rejects.toThrow();
  expect(fs.existsSync(directory)).toBe(false);
});

test.each(['inside', 'same', 'parent', 'alias', 'existing'])('rejects non-new or overlapping output: %s', async kind => {
  let target = directory;
  if (kind === 'inside') target = path.join(root, 'input');
  if (kind === 'same') target = root;
  if (kind === 'parent') target = tmp;
  if (kind === 'alias') { fs.symlinkSync(root, path.join(tmp, 'alias')); target = path.join(tmp, 'alias/input'); }
  if (kind === 'existing') { fs.mkdirSync(directory); fs.writeFileSync(path.join(directory, 'retain'), 'retain'); }
  await expect(api().prepareBuildInput({ ...options, directory: target })).rejects.toThrow();
  expect(fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8')).toBe('working edit\n');
  if (kind === 'existing') expect(fs.readFileSync(path.join(directory, 'retain'), 'utf8')).toBe('retain');
});

test.each(['missing', 'symlink', 'ancestor-symlink', 'directory', 'git-symlink', 'submodule', 'unmerged'])('rejects non-regular source: %s', async kind => {
  const file = path.join(root, 'backend/server.js');
  if (['missing', 'symlink', 'directory'].includes(kind)) fs.unlinkSync(file);
  if (kind === 'symlink') fs.symlinkSync(path.join(root, 'package.json'), file);
  if (kind === 'directory') fs.mkdirSync(file);
  if (kind === 'ancestor-symlink') { fs.renameSync(path.join(root, 'backend'), path.join(tmp, 'backend')); fs.symlinkSync(path.join(tmp, 'backend'), path.join(root, 'backend')); }
  if (kind === 'git-symlink') tracked.set('backend/server.js', '120000');
  if (kind === 'submodule') tracked.set('backend/server.js', '160000');
  if (kind === 'unmerged') git.mockImplementation((command, args, opts, done) => done(null,
    Buffer.from(args[0] === 'rev-parse' ? `${root}\n` : `100644 ${'0'.repeat(40)} 2\tbackend/server.js\0`)));
  await expect(api().prepareBuildInput(options)).rejects.toThrow();
  expect(fs.existsSync(directory)).toBe(false);
});

test.each(['../outside', '/absolute', 'a/../b', 'a//b', 'a\\b', 'a\nb', 'a\tb', '.git/config', '-option', 'trailing ', 'trailing\n'])('rejects unsafe tracked name %j', async name => {
  tracked.set(name, '100644');
  await expect(api().prepareBuildInput(options)).rejects.toThrow();
  expect(fs.existsSync(directory)).toBe(false);
});

test('removes only its newly created output after a generated-file write failure', async () => {
  const originalWrite = fs.writeFileSync;
  jest.spyOn(fs, 'writeFileSync').mockImplementation((file, ...args) => {
    if (file === path.join(directory, 'dockerfiles', 'gateway.Dockerfile')) throw Error('SYNTHETIC_DISK_FAILURE');
    return originalWrite(file, ...args);
  });
  await expect(api().prepareBuildInput(options)).rejects.toThrow('SYNTHETIC_DISK_FAILURE');
  expect(fs.existsSync(directory)).toBe(false);
  expect(fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8')).toBe('working edit\n');
});

test('rejects unsafe names even when a matching source file exists', async () => {
  const name = 'trailing\n';
  tracked.set(name, '100644'); write(name, 'must not enter context');
  await expect(api().prepareBuildInput(options)).rejects.toThrow('UNSAFE_BUILD_FILENAME');
  expect(fs.existsSync(directory)).toBe(false);
});

test.each(['.dockerignore', ...names.map(dockerPath)])('requires tracked control file %s', async name => {
  tracked.delete(name);
  await expect(api().prepareBuildInput(options)).rejects.toThrow();
  expect(fs.existsSync(directory)).toBe(false);
});

test.each([
  'ARG BASE=node:22-alpine\n', 'ONBUILD RUN echo x\n', 'FROM node:22-alpine\n',
  'LABEL lms.isolation.run=other\n', 'LABEL com.docker.compose.project=other\n',
  'RUN <<EOF\necho x\nEOF\n', 'RUN echo \\\n hello\n', 'COPY --from=other /x /x\n',
  'RUN npm install\n', 'ADD https://example.invalid/file /app/file\n', '# escape=`\n'
])('rejects unsupported Dockerfile syntax %j without publishing input', async instruction => {
  fs.appendFileSync(path.join(root, dockerPath('gateway')), instruction);
  await expect(api().prepareBuildInput(options)).rejects.toThrow(/DOCKERFILE/);
  expect(fs.existsSync(directory)).toBe(false);
});

test.each(['FROM node:20-alpine', 'FROM --platform=linux/amd64 node:22-alpine',
  'FROM node:22-alpine AS base', 'from node:22-alpine', 'FROM ${BASE}'])('rejects FROM override %s', async from => {
  const name = dockerPath('gateway');
  write(name, fs.readFileSync(path.join(root, name), 'utf8').replace('FROM node:22-alpine', from));
  await expect(api().prepareBuildInput(options)).rejects.toThrow(/DOCKERFILE/);
});

test.each([
  ['FROM', 'FROM node:22-alpine', 'FROM \\\n node:22-alpine'],
  ['LABEL', 'WORKDIR /app\n', 'LABEL lms.isolation.run=other \\\n lms.isolation.role=builder\nWORKDIR /app\n'],
  ['COPY', 'COPY backend ./backend', 'COPY backend \\\n ./backend'],
  ['other RUN', 'RUN npm ci --omit=dev', 'RUN npm ci \\\n --omit=dev'],
  ['WORKDIR', 'WORKDIR /app\n', 'WORKDIR \\\n /app\n'],
  ['CMD', 'CMD ["node", "server.js"]', 'CMD ["node", \\\n "server.js"]'],
  ['changed permission', 'chmod 0700', 'chmod 0777'],
  ['changed indentation', '    && chmod', '  && chmod'],
  ['extra command', '    && chmod 0700 /var/lib/family-growth/completion-journal', '    && chmod 0700 /var/lib/family-growth/completion-journal && echo extra'],
  ['comment in continuation', '    && chmod 0700 /var/lib/family-growth/private-media', '# inserted comment\n    && chmod 0700 /var/lib/family-growth/private-media']
])('rejects resource continuation outside the exact authorized block: %s', async (kind, from, to) => {
  const name = dockerPath('resource-service');
  write(name, fs.readFileSync(path.join(root, name), 'utf8').replace(from, to));
  await expect(api().prepareBuildInput(options)).rejects.toThrow(/DOCKERFILE/);
  expect(fs.existsSync(directory)).toBe(false);
});

test('rejects the resource continuation block copied into another service', async () => {
  const resource = fs.readFileSync(path.join(root, dockerPath('resource-service')), 'utf8');
  const block = resource.slice(resource.indexOf('RUN mkdir'), resource.indexOf('\n\nWORKDIR /app/backend/services/resource-service'));
  const name = dockerPath('gateway');
  write(name, fs.readFileSync(path.join(root, name), 'utf8').replace('COPY backend ./backend', `COPY backend ./backend\n${block}`));
  await expect(api().prepareBuildInput(options)).rejects.toThrow(/DOCKERFILE/);
});

test('rejects a flattened resource RUN instead of accepting alternative syntax', async () => {
  const name = dockerPath('resource-service');
  write(name, fs.readFileSync(path.join(root, name), 'utf8').replace(/ \\\n {4}/g, ' '));
  await expect(api().prepareBuildInput(options)).rejects.toThrow(/DOCKERFILE/);
});

test.each(['content', 'mode', 'directory-mode', 'root-mode', 'empty-directory', 'added', 'removed', 'symlink', 'dockerignore', 'original', 'generated', 'generated-symlink', 'context-alias'])('verification detects %s tampering', async kind => {
  const input = await api().prepareBuildInput(options);
  const file = path.join(input.context, 'backend/server.js');
  if (kind === 'content') fs.appendFileSync(file, 'tampered');
  if (kind === 'mode') fs.chmodSync(file, 0o755);
  if (kind === 'directory-mode') fs.chmodSync(path.join(input.context, 'backend'), 0o700);
  if (kind === 'root-mode') fs.chmodSync(input.context, 0o755);
  if (kind === 'empty-directory') fs.mkdirSync(path.join(input.context, 'extra-empty-directory'));
  if (kind === 'added') fs.writeFileSync(path.join(input.context, 'added'), 'tampered');
  if (kind === 'removed') fs.unlinkSync(file);
  if (kind === 'symlink') { fs.unlinkSync(file); fs.symlinkSync(path.join(root, 'backend/server.js'), file); }
  if (kind === 'dockerignore') fs.appendFileSync(path.join(input.context, '.dockerignore'), '*.js\n');
  if (kind === 'original') fs.appendFileSync(path.join(input.context, dockerPath('gateway')), '# tampered\n');
  if (kind === 'generated') fs.appendFileSync(input.files[0].dockerfile, 'RUN echo tampered\n');
  if (kind === 'generated-symlink') {
    fs.copyFileSync(input.files[0].dockerfile, path.join(tmp, 'other'));
    fs.unlinkSync(input.files[0].dockerfile); fs.symlinkSync(path.join(tmp, 'other'), input.files[0].dockerfile);
  }
  if (kind === 'context-alias') {
    fs.renameSync(input.context, path.join(tmp, 'moved')); fs.symlinkSync(path.join(tmp, 'moved'), input.context);
  }
  await expect(api().verifyBuildInput(input)).rejects.toThrow();
});

test.each(['identity', 'hash', 'missing-service', 'duplicate-service', 'path', 'sourceHash', 'generatedHash'])('verification rejects descriptor tampering: %s', async kind => {
  const input = JSON.parse(JSON.stringify(await api().prepareBuildInput(options)));
  if (kind === 'identity') input.identity.nonce = 'b'.repeat(32);
  if (kind === 'hash') input.contextHash = '0'.repeat(64);
  if (kind === 'missing-service') input.files.pop();
  if (kind === 'duplicate-service') input.files[1] = input.files[0];
  if (kind === 'path') input.files[0].dockerfile = path.join(root, dockerPath('gateway'));
  if (kind === 'sourceHash') input.files[0].sourceHash = '0'.repeat(64);
  if (kind === 'generatedHash') input.files[0].generatedHash = '0'.repeat(64);
  await expect(api().verifyBuildInput(input)).rejects.toThrow();
});

test.each(['file', 'symlink'])('rejects a generated Dockerfile sibling ignore override: %s', async kind => {
  const input = await api().prepareBuildInput(options);
  const override = `${input.files[0].dockerfile}.dockerignore`;
  if (kind === 'file') fs.writeFileSync(override, '!**\n');
  else fs.symlinkSync(path.join(root, '.dockerignore'), override);
  await expect(api().verifyBuildInput(input)).rejects.toThrow();
});

test('real read-only Git snapshot accepts all seven actual Dockerfiles and preserves their remainder byte-for-byte', async () => {
  git.mockRestore();
  const input = await api().prepareBuildInput({ ...options, root: repository });
  expect(input.files.map(file => file.name)).toEqual(names);
  expect(fs.readFileSync(path.join(input.context, '.dockerignore'))).toEqual(fs.readFileSync(path.join(repository, '.dockerignore')));
  for (const file of input.files) {
    const original = fs.readFileSync(path.join(repository, dockerPath(file.name)));
    const generated = fs.readFileSync(file.dockerfile);
    expect(fs.readFileSync(path.join(input.context, dockerPath(file.name)))).toEqual(original);
    const labelEnd = generated.indexOf('\n', generated.indexOf('\n') + 1);
    expect(generated.subarray(labelEnd + 1)).toEqual(original.subarray(original.indexOf('\n') + 1));
    expect(file.sourceHash).toBe(digest(original));
    expect(file.generatedHash).toBe(digest(generated));
  }
  expect(await api().verifyBuildInput(input)).toBe(true);
});
