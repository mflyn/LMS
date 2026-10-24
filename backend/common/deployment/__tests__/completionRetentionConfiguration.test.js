const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dotenv = require('dotenv');
const { validate } = require('../../../../scripts/check-family-docs');

const root = path.resolve(__dirname, '../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const token = 'COMPLETION_RETIREMENT_SERVICE_TOKEN';
const cleanup = 'COMPLETION_ORPHAN_CLEANUP_ENABLED';
const participants = ['homework-service', 'resource-service'];
const templates = ['backend/.env.example', 'docker-compose.ubuntu.env.example'];
const controls = {
  COMPLETION_PROTOCOL_MODE: 'legacy',
  COMPLETION_WRITES_PAUSED: 'false',
  COMPLETION_STORAGE_CONFIRMED: 'false'
};

// Keep list entries until after assertions so duplicate keys cannot be hidden.
const values = (service, key) => {
  const environment = service.environment || [];
  if (!Array.isArray(environment)) {
    return Object.hasOwn(environment, key) ? [environment[key]] : [];
  }
  return environment.filter(entry => entry === key || entry.startsWith(`${key}=`))
    .map(entry => entry === key ? undefined : entry.slice(key.length + 1));
};

describe.each(['docker-compose.family.yml', 'docker-compose.ubuntu.yml'])('%s retention configuration', file => {
  const config = yaml.load(read(file));

  test('only homework and resource receive one dedicated token with an empty default', () => {
    for (const [name, service] of Object.entries(config.services)) {
      expect(values(service, token)).toEqual(participants.includes(name) ? ['${COMPLETION_RETIREMENT_SERVICE_TOKEN:-}'] : []);
      // Also reject forwarding the credential under another environment/build key.
      if (!participants.includes(name)) expect(yaml.dump(service)).not.toContain(token);
    }
  });

  test('only resource receives the cleanup opt-in and its homework endpoint is unique', () => {
    for (const [name, service] of Object.entries(config.services)) {
      expect(values(service, cleanup)).toEqual(name === 'resource-service' ? ['${COMPLETION_ORPHAN_CLEANUP_ENABLED:-false}'] : []);
    }
    expect(values(config.services['resource-service'], 'HOMEWORK_SERVICE_URL')).toEqual(['http://homework-service:3003']);
  });

  test('existing completion controls remain unique, scoped and disabled by default', () => {
    for (const [name, service] of Object.entries(config.services)) {
      for (const [key, fallback] of Object.entries(controls)) {
        const expected = key === 'COMPLETION_STORAGE_CONFIRMED' ? name === 'resource-service' : participants.includes(name);
        expect(values(service, key)).toEqual(expected ? [`\${${key}:-${fallback}}`] : []);
      }
    }
  });
});

test.each(templates)('%s has unique safe defaults and no usable retirement credential', file => {
  const source = read(file);
  const expected = { ...controls, [token]: '', [cleanup]: 'false' };
  expect(dotenv.parse(source)).toMatchObject(expected);
  for (const key of Object.keys(expected)) {
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

const negativeCases = templates.flatMap(file => [[token, '', 'synthetic-not-an-empty-default'], [cleanup, 'false', 'true']]
  .flatMap(([key, fallback, unsafe]) => {
    const unique = `${file} must declare ${key} exactly once`;
    const safe = `${file} must default ${key}=${fallback}`;
    return [
      ['append identical', source => source + `\n${key}=${fallback}\n`, unique],
      ['prepend identical', source => `${key}=${fallback}\n` + source, unique],
      ['append conflicting', source => source + `\n${key}=${unsafe}\n`, unique],
      ['prepend conflicting', source => `${key}=${unsafe}\n` + source, unique],
      ['quoted exported duplicate CRLF', source => source.replace(/\r\n?|\n/g, '\r\n')
        + `\r\n export ${key} = '${fallback}' # duplicate\r\n`, unique],
      ['quoted exported conflicting CR', source => `export ${key}='${unsafe}'\r` + source.replace(/\r\n?|\n/g, '\r'), unique],
      ['missing', source => source.replace(new RegExp(`^${key}=.*\\n`, 'm'), ''), unique],
      ['unsafe sole value', source => source.replace(`${key}=${fallback}`, `${key}=${unsafe}`), safe]
    ].map(([name, mutate, message]) => [file, key, name, mutate, message]);
  }));

test.each(negativeCases)('%s gate rejects %s %s', (file, _key, _name, mutate, message) => {
  // Match the specific new rule: an unrelated documentation failure is not proof.
  withTemplate(file, mutate, () => expect(() => validate()).toThrow(message));
});

test.each(templates)('%s gate rejects swapped credential and cleanup defaults', file => {
  withTemplate(file, source => source.replace(`${token}=`, `${token}=false`)
    .replace(`${cleanup}=false`, `${cleanup}=`), () => {
    let failure;
    try { validate(); } catch (cause) { failure = cause; }
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toContain(`${file} must default ${token}=`);
    expect(failure.message).toContain(`${file} must default ${cleanup}=false`);
  });
});

test.each(templates.flatMap(file => ['quoted-export-crlf', 'quoted-comment-cr'].map(style => [file, style])))
  ('%s gate accepts all five unique defaults with %s', (file, style) => {
    withTemplate(file, source => {
      for (const [key, value] of Object.entries({ ...controls, [token]: '', [cleanup]: 'false' })) {
        source = source.replace(`${key}=${value}`, `${style === 'quoted-export-crlf' ? 'export ' : ''}${key} = '${value}' # safe default`);
      }
      return source.replace(/\r\n?|\n/g, style === 'quoted-export-crlf' ? '\r\n' : '\r');
    }, () => expect(() => validate()).not.toThrow());
  });
