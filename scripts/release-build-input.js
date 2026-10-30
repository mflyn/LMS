const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const childProcess = require('child_process');

const services = Object.freeze(['gateway', 'user-service', 'progress-service', 'homework-service',
  'resource-service', 'analytics-service', 'notification-service']);
const dockerPath = name => name === 'gateway' ? 'backend/gateway/Dockerfile' : `backend/services/${name}/Dockerfile`;
const resourceRun = [
  'RUN mkdir -p /var/lib/family-growth/private-media /var/lib/family-growth/completion-journal \\',
  '    && chmod 0700 /var/lib/family-growth/private-media \\',
  '    && chmod 0700 /var/lib/family-growth/completion-journal'
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);

function validateIdentity({ project, nonce, baseDigest }) {
  if (!matches(/^family-growth-isolated-[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/, project)
    || project.length > 63 || !matches(/^[a-f0-9]{32}(?![\s\S])/, nonce)
    || !matches(/^node@sha256:[a-f0-9]{64}(?![\s\S])/, baseDigest)) throw Error('INVALID_BUILD_IDENTITY');
}

function safeName(name) {
  if (!name || name.split('/').some(part => !/^[-@().+_\p{L}\p{N}]+$/u.test(part)
    || ['.', '..', '.git'].includes(part.toLowerCase()) || part.startsWith('-'))) {
    throw Error('UNSAFE_BUILD_FILENAME');
  }
}

// Exclude even tracked environment/evidence/runtime files. Git ignores are an additional boundary.
function excluded(name) {
  return name.toLowerCase().split('/').some(part =>
    /(?:^|\.)env(?:\.|$)/.test(part)
    || /^(?:\.aws|\.ssh|\.docker|\.npmrc|\.netrc|\.pypirc|\.git-credentials|\.envrc|credentials?(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519)$/.test(part)
    || /\.(?:pem|key|p12|p8|jks|log|pid|sqlite|db)$/.test(part)
    || /^(?:evidence|release-gate-artifacts|node_modules|uploads|private-media|completion-journal|logs|coverage|test-results|playwright-report|\.cache|\.worktrees)$/.test(part));
}

function assertDirectory(directory) {
  if (!fs.lstatSync(directory).isDirectory() || fs.realpathSync(directory) !== directory) {
    throw Error('UNSAFE_BUILD_DIRECTORY');
  }
}

function readRegular(root, name) {
  safeName(name);
  let parent = root;
  assertDirectory(parent);
  for (const part of name.split('/').slice(0, -1)) {
    parent = path.join(parent, part);
    assertDirectory(parent);
  }
  const file = path.join(root, name);
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.nlink !== 1 || (before.mode & 0o7000) || before.size > 64 * 1024 ** 2) {
    throw Error('NOT_REGULAR_BUILD_FILE');
  }
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (opened.ino !== before.ino || opened.dev !== before.dev) throw Error('BUILD_FILE_CHANGED');
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
      throw Error('BUILD_FILE_CHANGED');
    }
    return { bytes, mode: before.mode & 0o777 };
  } finally { fs.closeSync(fd); }
}

function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return new Promise((resolve, reject) => childProcess.execFile('git', args,
    { cwd: root, env: { ...env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'buffer', maxBuffer: 16 * 1024 ** 2 },
    (error, stdout) => error ? reject(Error('BUILD_GIT_READ_FAILED')) : resolve(stdout)));
}

function nulRecords(bytes) {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes) || (text && !text.endsWith('\0'))) throw Error('INVALID_GIT_FILE_LIST');
  return text ? text.slice(0, -1).split('\0') : [];
}

function validateDockerfile(bytes, name) {
  const text = bytes.toString('utf8');
  // Only this exact, contiguous resource RUN may contain continuations. Never normalize output bytes.
  const otherSyntax = name === 'resource-service' ? text.replace(resourceRun.join('\n'), '') : text;
  if (!Buffer.from(text).equals(bytes) || !text.startsWith('FROM node:22-alpine\n')
    || /[\\\r\0]|<<|^\s*#\s*(?:syntax|escape|check)\s*=/im.test(otherSyntax)) throw Error('UNSUPPORTED_DOCKERFILE');
  const actual = text.split('\n').filter(line => line !== '' && !line.startsWith('#'));
  const expected = ['FROM node:22-alpine', 'WORKDIR /app', 'COPY package*.json ./',
    'RUN npm ci --omit=dev', 'COPY backend ./backend'];
  if (name === 'resource-service') expected.push(...resourceRun);
  expected.push(`WORKDIR /app/${path.posix.dirname(dockerPath(name))}`,
    `EXPOSE ${[3000, 3001, 3002, 3003, 3005, 3006, 3007][services.indexOf(name)]}`);
  if (name === 'resource-service') expected.push('VOLUME ["/var/lib/family-growth/private-media"]');
  expected.push('CMD ["node", "server.js"]');
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('UNSUPPORTED_DOCKERFILE');
  return text;
}

function generate(source, identity) {
  const { project, nonce, baseDigest, contextHash } = identity;
  return `FROM ${baseDigest}\nLABEL lms.isolation.run=${project} lms.isolation.nonce=${nonce} lms.isolation.role=builder lms.isolation.context=${contextHash}\n${source.slice(source.indexOf('\n') + 1)}`;
}

// Binds every file and directory in the allowed snapshot, not excluded env/evidence/runtime or Git-ignored source.
// .dockerignore and original Dockerfiles are mandatory tracked inputs and remain in this binding.
function snapshotHash(context) {
  const manifest = [];
  function visit(relative) {
    const directory = path.join(context, relative);
    assertDirectory(directory);
    manifest.push({ name: relative || '.', type: 'directory', mode: fs.lstatSync(directory).mode & 0o7777 });
    for (const part of fs.readdirSync(directory)) {
      const name = relative ? `${relative}/${part}` : part;
      safeName(name);
      if (fs.lstatSync(path.join(context, name)).isDirectory()) visit(name);
      else {
        const { bytes, mode } = readRegular(context, name);
        if (excluded(name)) throw Error('EXCLUDED_BUILD_FILE');
        manifest.push({ name, type: 'file', hash: hash(bytes), mode });
      }
    }
  }
  visit('');
  manifest.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return hash(JSON.stringify(manifest));
}

// directory must be new and outside the checkout, including artifact directories. Overlap fails closed.
// Preserve file modes; normalize context root to 0700 and all internal directories to 0755, independent of umask.
async function prepareBuildInput({ root, directory, project, nonce, baseDigest }) {
  validateIdentity({ project, nonce, baseDigest });
  if (!path.isAbsolute(root) || !path.isAbsolute(directory)) throw Error('ABSOLUTE_BUILD_PATH_REQUIRED');
  root = fs.realpathSync(root);
  directory = path.join(fs.realpathSync(path.dirname(directory)), path.basename(directory));
  if (inside(root, directory) || inside(directory, root)) throw Error('OVERLAPPING_BUILD_DIRECTORY');
  if (fs.existsSync(directory)) throw Error('BUILD_DIRECTORY_EXISTS');
  if ((await git(root, ['rev-parse', '--show-toplevel'])).toString('utf8') !== `${root}\n`) {
    throw Error('BUILD_ROOT_NOT_REPOSITORY');
  }
  const records = nulRecords(await git(root, ['ls-files', '--stage', '-z']));
  const ignored = new Set(nulRecords(await git(root, ['ls-files', '--cached', '--ignored', '--exclude-standard', '-z'])));
  const names = new Set();
  for (const record of records) {
    const match = /^(100644|100755) [a-f0-9]{40,64} 0\t([^\0]+)$/.exec(record);
    if (!match) throw Error('UNMERGED_OR_NON_REGULAR_GIT_FILE');
    const name = match[2];
    safeName(name);
    if (names.has(name)) throw Error('DUPLICATE_GIT_FILE');
    names.add(name);
  }
  const controls = ['.dockerignore', ...services.map(dockerPath)];
  if (controls.some(name => !names.has(name) || ignored.has(name))) throw Error('MISSING_BUILD_CONTROL_FILE');
  for (const name of services) validateDockerfile(readRegular(root, dockerPath(name)).bytes, name);
  const staged = [];
  let size = 0;
  for (const name of [...names].sort()) {
    const file = readRegular(root, name);
    if (excluded(name) || ignored.has(name)) continue;
    size += file.bytes.length;
    if (size > 256 * 1024 ** 2) throw Error('BUILD_SNAPSHOT_TOO_LARGE');
    staged.push({ name, ...file });
  }
  // mkdir is exclusive; never clean up a pre-existing directory on failure.
  fs.mkdirSync(directory, { mode: 0o700 });
  try {
    const context = path.join(directory, 'context');
    fs.mkdirSync(context, { mode: 0o700 });
    fs.chmodSync(context, 0o700);
    fs.mkdirSync(path.join(directory, 'dockerfiles'), { mode: 0o700 });
    const directories = new Set([context]);
    for (const { name, bytes, mode } of staged) {
      const destination = path.join(context, name);
      let parent = context;
      for (const part of name.split('/').slice(0, -1)) {
        parent = path.join(parent, part);
        if (!directories.has(parent)) {
          fs.mkdirSync(parent, { mode: 0o755 });
          fs.chmodSync(parent, 0o755);
          directories.add(parent);
        }
      }
      fs.writeFileSync(destination, bytes, { flag: 'wx', mode });
      fs.chmodSync(destination, mode);
    }
    const contextHash = snapshotHash(context);
    const identity = Object.freeze({ project, nonce, role: 'builder', baseDigest, contextHash });
    const files = services.map(name => {
      const original = readRegular(context, dockerPath(name)).bytes;
      const generated = generate(validateDockerfile(original, name), identity);
      const dockerfile = path.join(directory, 'dockerfiles', `${name}.Dockerfile`);
      fs.writeFileSync(dockerfile, generated, { flag: 'wx', mode: 0o600 });
      return Object.freeze({ name, dockerfile, sourceHash: hash(original), generatedHash: hash(generated) });
    });
    const input = Object.freeze({ context, contextHash, files: Object.freeze(files), identity });
    await verifyBuildInput(input);
    return input;
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

// Call immediately before each build with the trusted descriptor returned by prepareBuildInput.
// No Git or mutable source access. This detects changes, not a concurrent hostile filesystem writer.
async function verifyBuildInput(input) {
  const { context, contextHash, identity, files } = input;
  validateIdentity(identity);
  if (!path.isAbsolute(context) || path.basename(context) !== 'context'
    || identity.role !== 'builder' || identity.contextHash !== contextHash
    || snapshotHash(context) !== contextHash || !Array.isArray(files)
    || files.length !== services.length) throw Error('BUILD_INPUT_CHANGED');
  readRegular(context, '.dockerignore');
  const generatedDirectory = path.join(path.dirname(context), 'dockerfiles');
  assertDirectory(generatedDirectory);
  // A sibling <Dockerfile>.dockerignore overrides the frozen context policy in Docker.
  if (JSON.stringify(fs.readdirSync(generatedDirectory).sort())
    !== JSON.stringify(services.map(name => `${name}.Dockerfile`).sort())) throw Error('BUILD_DOCKERFILE_DIRECTORY_CHANGED');
  for (const [index, name] of services.entries()) {
    const file = files[index];
    const directory = path.dirname(context);
    if (file.name !== name || file.dockerfile !== path.join(directory, 'dockerfiles', `${name}.Dockerfile`)) {
      throw Error('BUILD_DOCKERFILE_PATH_CHANGED');
    }
    const source = readRegular(context, dockerPath(name)).bytes;
    const generated = readRegular(directory, `dockerfiles/${name}.Dockerfile`).bytes;
    if (hash(source) !== file.sourceHash || hash(generated) !== file.generatedHash
      || !generated.equals(Buffer.from(generate(validateDockerfile(source, name), identity)))) {
      throw Error('BUILD_DOCKERFILE_CHANGED');
    }
  }
  return true;
}

module.exports = { services, prepareBuildInput, verifyBuildInput };
