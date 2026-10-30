const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { validate } = require('../../../../scripts/check-family-docs');
const dotenv = require('dotenv');
const os = require('os');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../../../..');
const templates = ['backend/.env.example', 'docker-compose.ubuntu.env.example'];
const defaults = { COMPLETION_PROTOCOL_MODE: 'legacy', COMPLETION_WRITES_PAUSED: 'false', COMPLETION_STORAGE_CONFIRMED: 'false' };
const read = file => yaml.load(fs.readFileSync(path.join(root, file), 'utf8'));
const environment = service => Object.fromEntries(service.environment.map(item => {
  const separator = item.indexOf('=');
  return [item.slice(0, separator), item.slice(separator + 1)];
}));

const imageDirectories = ['private-media', 'completion-journal'];
const checkImageDirectorySetup = source => {
  const command = source.replace(/\\\r?\n\s*/g, ' ').split('\n')
    .find(line => line.startsWith('RUN mkdir -p /var/lib/family-growth/'))?.slice(4);
  if (!command) throw Error('Missing image directory preparation');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-image-directories-'));
  try {
    // Keep mutation results independent of the developer or CI process umask.
    execFileSync('/bin/sh', ['-ec', 'umask 022; ' + command.replaceAll('/var/lib/family-growth', temporary)]);
    for (const name of imageDirectories) {
      const stat = fs.statSync(path.join(temporary, name));
      if (!stat.isDirectory() || (stat.mode & 0o777) !== 0o700 || stat.uid !== process.getuid()) {
        throw Error('Unsafe image directory: ' + name);
      }
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
};

test('resource image prepares both private empty-volume roots with owner-only permissions', () => {
  checkImageDirectorySetup(fs.readFileSync(path.join(root, 'backend/services/resource-service/Dockerfile'), 'utf8'));
});

test.each(imageDirectories)('image preparation gate rejects removing the %s permission assignment', name => {
  const source = fs.readFileSync(path.join(root, 'backend/services/resource-service/Dockerfile'), 'utf8');
  const mutation = source.replace(`chmod 0700 /var/lib/family-growth/${name}`, 'true');
  expect(mutation).not.toBe(source);
  expect(() => checkImageDirectorySetup(mutation)).toThrow('Unsafe image directory: ' + name);
});

test.each(['docker-compose.family.yml', 'docker-compose.ubuntu.yml'])('%s keeps completion opt-in with a separate journal', file => {
  const config = read(file);
  for (const name of ['homework-service', 'resource-service']) {
    const env = environment(config.services[name]);
    expect(env.COMPLETION_PROTOCOL_MODE).toBe('${COMPLETION_PROTOCOL_MODE:-legacy}');
    expect(env.COMPLETION_WRITES_PAUSED).toBe('${COMPLETION_WRITES_PAUSED:-false}');
  }
  const resource = config.services['resource-service'];
  expect(environment(resource).COMPLETION_STORAGE_CONFIRMED).toBe('${COMPLETION_STORAGE_CONFIRMED:-false}');
  expect(environment(resource).COMPLETION_DELETION_JOURNAL_ROOT).toBe('/var/lib/family-growth/completion-journal');
  expect(resource.volumes).toContain('completion-journal:/var/lib/family-growth/completion-journal');
  const mediaMount = resource.volumes.find(mount => mount.split(':')[1] === environment(resource).PRIVATE_MEDIA_ROOT);
  expect(mediaMount).toBeDefined();
  expect(mediaMount.split(':')[0]).not.toBe('completion-journal');
  expect(config.volumes).toHaveProperty('completion-journal');
  for (const [name, service] of Object.entries(config.services)) {
    if (name === 'resource-service') continue;
    expect((service.volumes || []).some(mount => mount.split(':')[0] === 'completion-journal')).toBe(false);
  }
  expect(resource.ports).toBeUndefined();
  expect(config.services['homework-service'].ports).toBeUndefined();
});

test.each(templates)('%s defaults completion controls to off', file => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  expect(dotenv.parse(source)).toMatchObject(defaults);
  for (const key of Object.keys(defaults)) {
    expect(source.split(/\r\n?|\n/).filter(line => Object.hasOwn(dotenv.parse(line), key))).toHaveLength(1);
  }
});

const withTemplate = (file, mutate, assertion) => {
  const original = fs.readFileSync;
  const template = path.join(root, file);
  const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((target, ...args) => {
    const value = original(target, ...args);
    return target === template ? mutate(value) : value;
  });
  try { assertion(); } finally { spy.mockRestore(); }
};

const negativeCases = templates.flatMap(file => Object.entries(defaults).flatMap(([key, value]) => {
  const unsafe = key === 'COMPLETION_PROTOCOL_MODE' ? 'enabled' : 'true';
  return [
    ['append conflicting', source => source + `\n${key}=${unsafe}\n`],
    ['prepend conflicting', source => `${key}=${unsafe}\n` + source],
    ['append identical', source => source + `\n${key}=${value}\n`],
    ['prepend identical', source => `${key}=${value}\n` + source],
    ['exported conflicting', source => source + `\n export ${key}='${unsafe}' # override\n`],
    ['prepend exported conflicting CR', source => `export ${key}='${unsafe}'\r` + source.replace(/\r\n?|\n/g, '\r')],
    ['missing', source => source.replace(new RegExp(`^${key}=.*\\n`, 'm'), '')],
    ['unsafe sole value', source => source.replace(`${key}=${value}`, `${key}=${unsafe}`)]
  ].map(([name, mutate]) => [file, key, name, mutate]);
}));

test.each(negativeCases)('%s rejects %s %s declarations', (file, _key, _name, mutate) => {
  withTemplate(file, mutate, () => expect(() => validate()).toThrow());
});

test.each(templates.flatMap(file => ['quoted-export-crlf', 'quoted-comment-cr'].map(style => [file, style])))('%s accepts unique safe controls with %s', (file, style) => {
    withTemplate(file, source => {
      for (const [key, value] of Object.entries(defaults)) {
        source = source.replace(`${key}=${value}`, `${style === 'quoted-export-crlf' ? 'export ' : ''}${key} = '${value}' # safe default`);
      }
      return source.replace(/\r\n?|\n/g, style === 'quoted-export-crlf' ? '\r\n' : '\r');
    }, () => expect(() => validate()).not.toThrow());
  });

test.each([
  ['enabled default', source => source.replace('COMPLETION_PROTOCOL_MODE=legacy', 'COMPLETION_PROTOCOL_MODE=enabled'), 'must default COMPLETION_PROTOCOL_MODE=legacy'],
  ['paused default', source => source.replace('COMPLETION_WRITES_PAUSED=false', 'COMPLETION_WRITES_PAUSED=true'), 'must default COMPLETION_WRITES_PAUSED=false'],
  ['storage default', source => source.replace('COMPLETION_STORAGE_CONFIRMED=false', 'COMPLETION_STORAGE_CONFIRMED=true'), 'must default COMPLETION_STORAGE_CONFIRMED=false'],
  ['missing control', source => source.replace(/^COMPLETION_PROTOCOL_MODE=.*\n/m, ''), 'keys differ'],
  ['missing secret', source => source.replace(/^JWT_SECRET=.*\n/m, ''), 'keys differ'],
  ['unknown key', source => source + '\nUNKNOWN_SECRET=placeholder\n', 'keys differ']
])('documentation gate rejects %s without editing template files', (_name, mutate, message) => {
  const original = fs.readFileSync;
  const template = path.join(root, 'docker-compose.ubuntu.env.example');
  const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
    const value = original(file, ...args);
    return file === template ? mutate(value) : value;
  });
  try { expect(() => validate()).toThrow(message); }
  finally { spy.mockRestore(); }
});
