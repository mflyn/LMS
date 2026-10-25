const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const createMediaDeletionJournal = ({ root } = {}) => {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('An absolute protected deletion journal root is required');
  const persist = async evidence => {
    const mediaId = evidence?.tombstone?.mediaId;
    if (typeof mediaId !== 'string' || !/^[0-9a-f]{24}$/.test(mediaId)) throw new Error('Invalid deletion journal identity');
    const content = `${JSON.stringify(evidence)}\n`;
    // The operator supplies an existing protected parent (for example a backup mount).
    try { await fs.mkdir(root, { mode: 0o700 }); } catch (err) { if (err.code !== 'EEXIST') throw err; }
    await fs.chmod(root, 0o700);
    const parent = await fs.open(path.dirname(root), 'r');
    try { await parent.sync(); } finally { await parent.close(); }
    const destination = path.join(root, `${mediaId}.json`);
    const temporary = path.join(root, `.${mediaId}.${randomUUID()}.tmp`);
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
      try { await fs.link(temporary, destination); } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        if (await fs.readFile(destination, 'utf8') !== content) throw new Error('Deletion journal evidence conflict');
      }
      await fs.unlink(temporary);
      const directory = await fs.open(root, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await fs.rm(temporary, { force: true }); }
  };
  return { persist };
};
module.exports = { createMediaDeletionJournal };
