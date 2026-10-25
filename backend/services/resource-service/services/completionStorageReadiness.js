const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const storageError = () => Object.assign(new Error('Completion storage readiness check failed'), {
  code: 'COMPLETION_STORAGE_NOT_READY'
});
const contains = (parent, child) => child === parent || child.startsWith(parent + path.sep);

const assertDirectory = async root => {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) !== root
    || await fs.realpath(root) !== root) throw storageError();
  const directory = await fs.lstat(root);
  if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700
    || directory.uid !== process.getuid()) throw storageError();
  // A private immediate parent is insufficient if someone else can rename its ancestor.
  // Sticky ancestors are safe only with trusted ownership throughout the child chain.
  for (let current = path.dirname(root); ; current = path.dirname(current)) {
    const ancestor = await fs.lstat(current);
    if (!ancestor.isDirectory() || ancestor.isSymbolicLink()
      || ![0, process.getuid()].includes(ancestor.uid)
      || ((ancestor.mode & 0o022) !== 0 && (ancestor.mode & 0o1000) === 0)) throw storageError();
    if (current === path.dirname(current)) break;
  }
};

// Probe only owned synthetic files. Never create/chmod operator directories or touch audit files.
const probePublication = async root => {
  const source = path.join(root, `.completion-probe-${randomUUID()}.tmp`);
  const published = source + '.published';
  let created = false, linked = false;
  try {
    const handle = await fs.open(source, 'wx', 0o600);
    created = true;
    try { await handle.writeFile('completion-storage-probe\n'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.link(source, published); linked = true;
    const directory = await fs.open(root, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    // Try both removals even if one fails; failure prevents a ready result.
    const removed = await Promise.allSettled([
      ...(linked ? [fs.unlink(published)] : []), ...(created ? [fs.unlink(source)] : [])
    ]);
    if (removed.some(result => result.status === 'rejected')) throw storageError();
  }
  const directory = await fs.open(root, 'r');
  try { await directory.sync(); } finally { await directory.close(); }
};

const inspectStorage = async ({ env = process.env, userDeletionRecovery = false } = {}) => {
  try {
    if (typeof userDeletionRecovery !== 'boolean'
      || userDeletionRecovery && env.COMPLETION_PROTOCOL_MODE !== 'enabled') throw storageError();
    // This is an operator declaration, not proof of backup durability or mount identity.
    if (env.COMPLETION_STORAGE_CONFIRMED !== 'true') throw storageError();
    const mediaRoot = env.PRIVATE_MEDIA_ROOT, journalRoot = env.COMPLETION_DELETION_JOURNAL_ROOT;
    await assertDirectory(mediaRoot); await assertDirectory(journalRoot);
    if (contains(mediaRoot, journalRoot) || contains(journalRoot, mediaRoot)) throw storageError();
    const namespaces = [];
    const names = [...(env.COMPLETION_PROTOCOL_MODE === 'enabled' ? ['uploads-v1', 'orphan-retirements-v1'] : []),
      'user-deletions-v2'];
    for (const name of names) {
      const namespace = path.join(journalRoot, name);
      try { await fs.lstat(namespace); }
      catch (cause) {
        if (cause.code === 'ENOENT' && !(userDeletionRecovery && name === 'user-deletions-v2')) continue;
        throw cause;
      }
      await assertDirectory(namespace);
      namespaces.push(namespace);
    }
    return { mediaRoot, journalRoot, namespaces };
  } catch (_cause) { throw storageError(); }
};

const assertCompletionStorageStructure = async options => {
  const { mediaRoot, journalRoot } = await inspectStorage(options);
  return { mediaRoot, journalRoot };
};

const assertCompletionStorageReadiness = async options => {
  try {
    const { mediaRoot, journalRoot, namespaces } = await inspectStorage(options);
    // All structural checks finish before any temporary publication probe is allowed.
    for (const root of [mediaRoot, journalRoot, ...namespaces]) await probePublication(root);
    return { mediaRoot, journalRoot };
  } catch (_cause) { throw storageError(); }
};

module.exports = { assertCompletionStorageReadiness, assertCompletionStorageStructure };
