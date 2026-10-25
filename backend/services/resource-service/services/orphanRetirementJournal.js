const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const ID = /^[0-9a-f]{24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const matches = pattern => value => typeof value === 'string' && pattern.test(value);
const identifier = matches(ID), uuid = matches(UUID), hash = matches(/^[0-9a-f]{64}$/);
const storageKey = matches(new RegExp(UUID.source, 'i'));
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const exact = expected => value => value === expected;
const nullableUuid = value => value === null || uuid(value);
const failureCode = matches(/^[A-Z][A-Z0-9_]{0,79}$/);
const invalid = () => Error('Invalid orphan retirement journal evidence');
const unsafe = () => Error('Unsafe orphan retirement journal path');
const shape = (value, schema) => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  && Reflect.ownKeys(value).length === Object.keys(schema).length
  && Object.entries(schema).every(([key, validate]) => Object.hasOwn(value, key)
    && Object.getOwnPropertyDescriptor(value, key).enumerable
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value') && validate(value[key]));
const arrayOf = validate => value => {
  if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !validate(descriptor.value)) return false;
  }
  return true;
};
const scope = { familyId: identifier, childId: identifier };
const resource = { resourceId: identifier, resourceType: exact('growth_task'), field: exact('completionMediaIds') };
const groupReference = value => shape(value, { mediaId: identifier, field: exact('completionMediaIds') });
const operation = value => shape(value, {
  _id: identifier, ...scope, ...resource, operationId: uuid, commandHash: hash, referenceSetHash: hash,
  references: refs => arrayOf(groupReference)(refs) && refs.length >= 1 && refs.length <= 10
    && new Set(refs.map(ref => ref.mediaId)).size === refs.length,
  state: exact('ABORTED'), version: number => Number.isSafeInteger(number) && number >= 0,
  leaseExpiresAt: exact(null), terminalAt: timestamp, failureCode
});
const reference = value => shape(value, {
  _id: identifier, ...scope, mediaId: identifier, ...resource, operationId: uuid, releaseOperationId: nullableUuid,
  state: exact('released'), leaseExpiresAt: exact(null), releasedAt: timestamp
});
const validate = value => {
  if (!shape(value, {
    version: exact(1), retirement: retirement => shape(retirement, {
      mediaId: identifier, ...scope, retirementId: uuid, storageKey, uploadMetadataHash: hash, retentionPolicyVersion: exact(1),
      orphanEligibleAt: timestamp, actorType: exact('system'), createdAt: timestamp, deletedAt: timestamp
    }), operations: arrayOf(operation), references: arrayOf(reference)
  })) throw invalid();
  return value;
};
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const serialize = value => JSON.stringify(canonical(validate(value))) + '\n';
const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const fileFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

const assertAncestors = async directory => {
  let current = path.parse(directory).root;
  for (const component of directory.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!(await fs.lstat(current)).isDirectory()) throw unsafe();
  }
};
const syncDirectory = async directory => {
  const handle = await fs.open(directory, directoryFlags);
  try { await handle.sync(); } finally { await handle.close(); }
};

const createOrphanRetirementJournal = ({ root } = {}) => {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) !== root || root === path.parse(root).root) {
    throw Error('Absolute protected orphan retirement journal root required');
  }
  const parent = path.dirname(root);
  const prepareRoot = async create => {
    // The existing parent is operator-controlled; never create or traverse a symlink ancestor.
    await assertAncestors(parent);
    if (create) {
      try { await fs.mkdir(root, { mode: 0o700 }); } catch (cause) { if (cause.code !== 'EEXIST') throw cause; }
    }
    let stat;
    try { stat = await fs.lstat(root); } catch (cause) { if (!create && cause.code === 'ENOENT') return false; throw cause; }
    if (!stat.isDirectory()) throw unsafe();
    const handle = await fs.open(root, directoryFlags);
    try {
      const opened = await handle.stat();
      if (opened.dev !== stat.dev || opened.ino !== stat.ino) throw unsafe();
      if (create) await handle.chmod(0o700);
      else if ((opened.mode & 0o777) !== 0o700) throw unsafe();
    } finally { await handle.close(); }
    if (create) await syncDirectory(parent);
    return true;
  };
  const readDestination = async (mediaId, sync = false) => {
    const destination = path.join(root, mediaId + '.json');
    let stat;
    try { stat = await fs.lstat(destination); } catch (cause) { if (cause.code === 'ENOENT') return null; throw cause; }
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) throw unsafe();
    const handle = await fs.open(destination, fileFlags);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || (opened.mode & 0o777) !== 0o600 || opened.dev !== stat.dev || opened.ino !== stat.ino) throw unsafe();
      const value = validate(JSON.parse(await handle.readFile('utf8')));
      if (value.retirement.mediaId !== mediaId) throw invalid();
      if (sync) await handle.sync();
      return value;
    } finally { await handle.close(); }
  };
  const read = async mediaId => {
    if (!identifier(mediaId)) throw invalid();
    if (!await prepareRoot(false)) return null;
    return readDestination(mediaId);
  };
  const persist = async evidence => {
    // Snapshot before the first await; caller mutations cannot alter the persisted proof.
    const content = serialize(evidence), mediaId = evidence.retirement.mediaId;
    await prepareRoot(true);
    const destination = path.join(root, mediaId + '.json');
    const temporary = path.join(root, '.' + mediaId + '.' + randomUUID() + '.tmp');
    try {
      const handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await handle.chmod(0o600); await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
      try { await fs.link(temporary, destination); } catch (cause) {
        if (cause.code !== 'EEXIST') throw cause;
        // Re-sync existing evidence too: an earlier publish may have lost its durability acknowledgement.
        const existing = await readDestination(mediaId, true);
        if (!existing || serialize(existing) !== content) throw Error('Orphan retirement journal evidence conflict');
      }
      await fs.unlink(temporary);
      await syncDirectory(root);
    } finally { await fs.rm(temporary, { force: true }); }
  };
  return { persist, read };
};

module.exports = { createOrphanRetirementJournal };
