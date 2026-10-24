const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const { TextDecoder } = require('util');
const { canonicalize } = require('json-canonicalize');
const { validateEvidence, serializeEvidence, LIMITS } = require('./userDeletionRecoveryEvidence');

const INVALID = 'USER_DELETION_EVIDENCE_INVALID';
const PENDING = 'USER_DELETION_DEPENDENCY_PENDING';
const error = code => Object.assign(new Error(code), { code });
const assert = condition => { if (!condition) throw error(INVALID); };
const classify = cause => error(cause?.code === INVALID || ['ELOOP', 'ENOTDIR'].includes(cause?.code) ? INVALID : PENDING);
const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino;
const privateFile = stat => stat.isFile() && (stat.mode & 0o7777) === 0o600;
const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const fileFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const tombstoneKeys = ['mediaId', 'familyId', 'childId', 'actorId', 'role', 'purpose', 'reason', 'deletedAt'];
const receiptKeys = ['mediaId', 'familyId', 'childId', 'resourceType', 'resourceId', 'field', 'bindingOperationId', 'releasedAt'];
const project = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]));
const exact = (value, keys) => assert(value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
const bindingKey = value => JSON.stringify([value.resourceType, value.resourceId, value.field, value.bindingOperationId]);
const sortedReceipts = values => [...values].sort((a, b) => bindingKey(a) < bindingKey(b) ? -1 : bindingKey(a) > bindingKey(b) ? 1 : 0);
const matches = (pattern, value) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
const validId = value => matches(/^[0-9a-f]{24}$/, value);
const validUuid = value => matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, value);
const validTime = value => typeof value === 'string' && Number.isFinite(new Date(value).getTime())
  && new Date(value).toISOString() === value;
const validateLegacy = (value, mediaId) => {
  exact(value, ['tombstone', 'receipts']); exact(value.tombstone, tombstoneKeys);
  const tomb = value.tombstone;
  assert(['mediaId', 'familyId', 'childId', 'actorId'].every(key => validId(tomb[key]))
    && tomb.mediaId === mediaId && ['parent', 'student'].includes(tomb.role)
    && (tomb.role !== 'student' || tomb.actorId === tomb.childId)
    && tomb.purpose === 'task_completion' && tomb.reason === 'user_requested' && validTime(tomb.deletedAt));
  assert(Array.isArray(value.receipts));
  const bindings = new Set();
  for (const receipt of value.receipts) {
    exact(receipt, receiptKeys);
    assert(['mediaId', 'familyId', 'childId'].every(key => receipt[key] === tomb[key])
      && validId(receipt.resourceId) && receipt.resourceType === 'growth_task' && receipt.field === 'completionMediaIds'
      && validUuid(receipt.bindingOperationId) && validTime(receipt.releasedAt));
    const key = bindingKey(receipt); assert(!bindings.has(key)); bindings.add(key);
  }
};

const decode = (content, mediaId, version, proof) => {
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content));
    if (version === 2) {
      const validated = validateEvidence(value);
      assert(validated.tombstone.mediaId === mediaId && content.equals(Buffer.from(serializeEvidence(validated))));
      return validated;
    }
    assert(content.equals(Buffer.from(JSON.stringify(value) + '\n')));
    assert(version === 1); validateLegacy(value, mediaId);
    if (proof) {
      assert(value.receipts.length === proof.receipts.length);
      const expected = { tombstone: project(proof.tombstone, tombstoneKeys),
        receipts: sortedReceipts(proof.receipts.map(receipt => project(receipt, receiptKeys))) };
      assert(canonicalize({ tombstone: value.tombstone, receipts: sortedReceipts(value.receipts) }) === canonicalize(expected));
    }
    return value;
  } catch (_) { throw error(INVALID); }
};

const createUserDeletionRecoveryReader = ({ root } = {}) => {
  assert(typeof root === 'string' && path.isAbsolute(root) && path.resolve(root) === root && root !== path.parse(root).root);
  const v2root = path.join(root, 'user-deletions-v2');

  const createDirectoryScope = (stable = false) => {
    const entries = [], directories = [];
    const verify = async () => {
      for (const entry of directories) {
        const named = await fs.lstat(entry.name), opened = await entry.handle.stat();
        assert(named.isDirectory() && opened.isDirectory() && sameIdentity(entry.stat, named)
          && sameIdentity(entry.stat, opened) && (!entry.protectedRoot
            || (named.mode & 0o7777) === 0o700 && (opened.mode & 0o7777) === 0o700));
        if (stable && entry.protectedRoot) {
          assert([named, opened].every(stat => stat.mtimeMs === entry.stat.mtimeMs && stat.ctimeMs === entry.stat.ctimeMs));
        }
      }
    };
    const openDirectory = async (name, optional = false) => {
      let stat;
      try { stat = await fs.lstat(name); } catch (cause) {
        if (!optional || cause.code !== 'ENOENT') throw cause;
        await verify(); return false;
      }
      const protectedRoot = name === root || name === v2root;
      assert(stat.isDirectory() && (!protectedRoot || (stat.mode & 0o7777) === 0o700));
      const handle = await fs.open(name, directoryFlags);
      const entry = { name, handle, stat, protectedRoot }; entries.push(entry); directories.push(entry);
      const opened = await handle.stat();
      assert(opened.isDirectory() && sameIdentity(stat, opened)
        && (!protectedRoot || (opened.mode & 0o7777) === 0o700));
      if (stable && protectedRoot) assert(opened.mtimeMs === stat.mtimeMs && opened.ctimeMs === stat.ctimeMs);
      return true;
    };
    const openParents = async () => {
      let current = path.parse(root).root;
      await openDirectory(current);
      for (const component of path.dirname(root).slice(current.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, component); await openDirectory(current);
      }
      await verify();
    };
    const close = async failure => {
      for (const entry of [...entries].reverse()) {
        try { await entry.handle.close(); } catch (cause) { failure ||= classify(cause); }
      }
      return failure;
    };
    return { entries, verify, openDirectory, openParents, close };
  };

  // Both namespaces use this kernel: reservation and reading share the verified opened handle.
  const readProtected = async (mediaId, version, reserve, proof) => {
    const scope = createDirectoryScope();
    const { entries, verify, openDirectory, openParents } = scope;
    let result, failure;
    const work = async () => {
      await openParents();
      if (!await openDirectory(root, version === 2 || !proof)) return null;
      if (version === 2 && !await openDirectory(v2root, true)) return null;
      await verify();
      const destination = path.join(version === 2 ? v2root : root, mediaId + '.json');
      let named;
      try { named = await fs.lstat(destination); } catch (cause) {
        if (cause.code !== 'ENOENT') throw cause;
        await verify(); return null;
      }
      assert(privateFile(named));
      const handle = await fs.open(destination, fileFlags); entries.push({ handle });
      const opened = await handle.stat();
      assert(privateFile(opened) && sameIdentity(named, opened)
        && Number.isSafeInteger(opened.size) && opened.size >= 0 && opened.size <= LIMITS.MAX_BYTES);
      reserve(opened.size);
      // The extra byte is only a growth detector, never accepted evidence or refunded budget.
      const buffer = Buffer.alloc(opened.size + 1);
      let length = 0;
      for (;;) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        length += bytesRead; assert(length <= opened.size);
        if (bytesRead === 0) break;
      }
      assert(length === opened.size);
      const checkFile = async () => {
        const currentStat = await handle.stat(), currentName = await fs.lstat(destination);
        for (const stat of [currentStat, currentName]) {
          assert(privateFile(stat) && sameIdentity(opened, stat)
            && stat.size === opened.size && stat.mtimeMs === opened.mtimeMs);
        }
      };
      await checkFile();
      const value = decode(buffer.subarray(0, length), mediaId, version, proof);
      await verify(); await checkFile();
      return value;
    };
    try { result = await work(); } catch (cause) { failure = classify(cause); }
    failure = await scope.close(failure);
    if (failure) throw failure;
    return result;
  };

  const readLegacy = async mediaId => {
    assert(validId(mediaId));
    return readProtected(mediaId, 1, () => {});
  };

  const inventory = async function* () {
    const scope = createDirectoryScope(true);
    let cursor, failure, v2Present;
    const verify = async () => {
      await scope.verify();
      if (v2Present === false) {
        let missing = false;
        try { await fs.lstat(v2root); } catch (cause) { if (cause.code !== 'ENOENT') throw cause; missing = true; }
        assert(missing);
      }
    };
    const closeCursor = async () => {
      if (!cursor) return;
      const closing = cursor; cursor = null; await closing.close();
    };
    try {
      await scope.openParents(); await scope.openDirectory(root);
      v2Present = await scope.openDirectory(v2root, true);
      await verify();
      for (const version of v2Present ? [1, 2] : [1]) {
        const directory = version === 1 ? root : v2root;
        await verify(); cursor = await fs.opendir(directory, { bufferSize: 32 }); await verify();
        for (;;) {
          await verify();
          const entry = await cursor.read();
          await verify();
          if (entry === null) break;
          const stat = await fs.lstat(path.join(directory, entry.name));
          if (version === 1 && ['uploads-v1', 'orphan-retirements-v1', 'user-deletions-v2'].includes(entry.name)) {
            assert(stat.isDirectory() && (stat.mode & 0o7777) === 0o700); continue;
          }
          assert(matches(/^[0-9a-f]{24}\.json$/, entry.name) && privateFile(stat));
          await verify();
          yield { version, mediaId: entry.name.slice(0, 24) };
          await verify();
        }
        await closeCursor(); await verify();
      }
    } catch (cause) { failure = classify(cause); }
    finally {
      // Early return also verifies and closes; only the consumer reaching EOF has a complete inventory.
      try { await verify(); } catch (cause) { failure ||= classify(cause); }
      try { await closeCursor(); } catch (cause) { failure ||= classify(cause); }
      failure = await scope.close(failure);
      if (failure) throw failure;
    }
  };

  const createReadSession = () => {
    let fileCount = 0, byteCount = 0;
    const entries = new Map();
    const reserve = size => {
      assert(fileCount < LIMITS.MAX_DEPENDENCIES && byteCount + size <= LIMITS.MAX_DEPENDENCY_BYTES);
      fileCount++; byteCount += size;
    };
    const read = async mediaId => {
      assert(typeof mediaId === 'string' && /^[0-9a-f]{24}$/.exec(mediaId)?.[0] === mediaId);
      if (!entries.has(mediaId)) {
        // Install before yielding; rejected and absent results also remain charged/deduplicated.
        const loading = Promise.resolve().then(async () => {
          const proof = await readProtected(mediaId, 2, reserve);
          if (proof === null) return null;
          await readProtected(mediaId, 1, reserve, proof);
          return serializeEvidence(proof);
        }).catch(cause => { throw classify(cause); });
        entries.set(mediaId, loading);
      }
      const encoded = await entries.get(mediaId);
      return encoded === null ? null : JSON.parse(encoded);
    };
    return { read };
  };
  return { read: mediaId => createReadSession().read(mediaId), createReadSession, readLegacy, inventory };
};

module.exports = { createUserDeletionRecoveryReader };
