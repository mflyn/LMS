const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { TextDecoder } = require('util');
const { validateEvidence, serializeEvidence, LIMITS } = require('./userDeletionRecoveryEvidence');

const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const fileFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const unsafe = () => Error('USER_DELETION_JOURNAL_UNSAFE_PATH');
const invalid = () => Error('USER_DELETION_JOURNAL_INVALID');
const sameIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino;
const mediaIdentifier = value => typeof value === 'string' && /^[0-9a-f]{24}$/.exec(value)?.[0] === value;
const privateFile = stat => stat.isFile() && (stat.mode & 0o7777) === 0o600;
const assertFileIdentity = async (name, expected) => {
  const current = await fs.lstat(name);
  if (!privateFile(current) || !sameIdentity(expected, current)
    || current.size !== expected.size || current.mtimeMs !== expected.mtimeMs) throw unsafe();
};

const closeAll = async entries => {
  let failure;
  for (const entry of [...entries].reverse()) {
    try { await entry.handle.close(); } catch (cause) { failure ||= cause; }
  }
  if (failure) throw failure;
};

const createUserDeletionRecoveryJournal = ({ root } = {}) => {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) !== root
    || root === path.parse(root).root) throw unsafe();

  const withDirectories = async (create, work) => {
    const entries = [];
    const openDirectory = async (name, protectedRoot = false) => {
      const stat = await fs.lstat(name);
      if (!stat.isDirectory() || (protectedRoot && (stat.mode & 0o7777) !== 0o700)) throw unsafe();
      const handle = await fs.open(name, directoryFlags);
      const entry = { path: name, handle, stat, protectedRoot };
      entries.push(entry);
      const opened = await handle.stat();
      if (!opened.isDirectory() || !sameIdentity(stat, opened)
        || (protectedRoot && (opened.mode & 0o7777) !== 0o700)) throw unsafe();
      return entry;
    };
    const verify = async () => {
      for (const entry of entries) {
        const current = await fs.lstat(entry.path), opened = await entry.handle.stat();
        if (!current.isDirectory() || !opened.isDirectory() || !sameIdentity(entry.stat, current)
          || !sameIdentity(entry.stat, opened) || (entry.protectedRoot
            && ((current.mode & 0o7777) !== 0o700 || (opened.mode & 0o7777) !== 0o700))) throw unsafe();
      }
    };
    try {
      // Never create ancestors or accept a symlink anywhere in the configured chain.
      let current = path.parse(root).root;
      await openDirectory(current);
      for (const component of path.dirname(root).slice(current.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, component);
        await openDirectory(current);
      }
      const parent = entries.at(-1);
      await verify();
      if (create) {
        try { await fs.mkdir(root, { mode: 0o700 }); } catch (cause) { if (cause.code !== 'EEXIST') throw cause; }
      } else {
        try { await fs.lstat(root); } catch (cause) {
          if (cause.code !== 'ENOENT') throw cause;
          await verify();
          return null;
        }
      }
      const directory = await openDirectory(root, true);
      await verify();
      return await work({ parent, directory, verify });
    } finally { await closeAll(entries); }
  };

  const readDestination = async (mediaId, verify, sync = false) => {
    const destination = path.join(root, mediaId + '.json');
    await verify();
    let stat;
    try { stat = await fs.lstat(destination); } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
      await verify();
      return null;
    }
    if (!privateFile(stat) || stat.size > LIMITS.MAX_BYTES) throw unsafe();
    const existingHandle = await fs.open(destination, fileFlags);
    try {
      const opened = await existingHandle.stat();
      if (!privateFile(opened) || !sameIdentity(stat, opened) || opened.size > LIMITS.MAX_BYTES) throw unsafe();
      // Read at most the checked size plus one byte, detecting concurrent growth without readFile allocation.
      const buffer = Buffer.alloc(opened.size + 1);
      let length = 0;
      for (;;) {
        const { bytesRead } = await existingHandle.read(buffer, length, buffer.length - length, length);
        length += bytesRead;
        if (length > opened.size || length > LIMITS.MAX_BYTES) throw invalid();
        if (bytesRead === 0) break;
      }
      const current = await existingHandle.stat(), named = await fs.lstat(destination);
      if (!privateFile(current) || !privateFile(named) || !sameIdentity(opened, current)
        || !sameIdentity(opened, named) || length !== opened.size || current.size !== opened.size
        || current.mtimeMs !== opened.mtimeMs) throw unsafe();
      const content = buffer.subarray(0, length);
      const value = validateEvidence(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content)));
      if (value.tombstone.mediaId !== mediaId || !content.equals(Buffer.from(serializeEvidence(value)))) throw invalid();
      if (sync) await existingHandle.sync();
      await verify();
      await assertFileIdentity(destination, opened);
      return { value, stat: opened };
    } finally { await existingHandle.close(); }
  };

  const read = async mediaId => {
    if (!mediaIdentifier(mediaId)) throw invalid();
    return withDirectories(false, async ({ verify }) => (await readDestination(mediaId, verify))?.value ?? null);
  };

  const persist = async evidence => {
    // Complete the detached snapshot before any I/O yields to caller mutations.
    const snapshot = validateEvidence(evidence);
    const content = serializeEvidence(snapshot), mediaId = snapshot.tombstone.mediaId;
    await withDirectories(true, async ({ parent, directory, verify }) => {
      // Also sync on retry: an earlier mkdir may have succeeded without an acknowledged parent sync.
      await parent.handle.sync();
      await verify();
      const destination = path.join(root, mediaId + '.json');
      const temporary = path.join(root, '.' + mediaId + '.' + randomUUID() + '.tmp');
      let temporaryStat, publishedStat;
      try {
        const temporaryHandle = await fs.open(temporary,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try {
          temporaryStat = await temporaryHandle.stat();
          await temporaryHandle.chmod(0o600);
          if (!temporaryStat.isFile() || !sameIdentity(temporaryStat, await fs.lstat(temporary))) throw unsafe();
          await temporaryHandle.writeFile(content);
          await temporaryHandle.sync();
        } finally { await temporaryHandle.close(); }
        await verify();
        const named = await fs.lstat(temporary);
        if (!privateFile(named) || !sameIdentity(temporaryStat, named)) throw unsafe();
        try {
          await fs.link(temporary, destination);
          publishedStat = named;
        } catch (cause) {
          if (cause.code !== 'EEXIST') throw cause;
          const existing = await readDestination(mediaId, verify, true);
          if (!existing || serializeEvidence(existing.value) !== content) throw Error('USER_DELETION_JOURNAL_CONFLICT');
          publishedStat = existing.stat;
        }
        await verify();
        await assertFileIdentity(destination, publishedStat);
        await directory.handle.sync(); // Published entry
      } finally {
        if (temporaryStat) {
          await verify();
          const named = await fs.lstat(temporary);
          if (!named.isFile() || !sameIdentity(temporaryStat, named)) throw unsafe();
          await fs.unlink(temporary);
          await directory.handle.sync(); // Removed temporary entry
        }
      }
      await verify();
      await assertFileIdentity(destination, publishedStat);
    });
  };

  return { persist, read };
};

module.exports = { createUserDeletionRecoveryJournal };
