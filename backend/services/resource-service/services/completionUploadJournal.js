const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { validateRecord } = require('./completionUploadRecord');

const createCompletionUploadJournal = ({ root } = {}) => {
  if (!path.isAbsolute(root || '')) throw new TypeError('Absolute protected upload journal root required');
  const persist = async record => {
    await validateRecord(record);
    try { await fs.mkdir(root, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (!(await fs.lstat(root)).isDirectory() || (await fs.realpath(root)) !== root) throw Error('Unsafe upload journal root');
    await fs.chmod(root, 0o700);
    const parent = await fs.open(path.dirname(root), 'r');
    try { await parent.sync(); } finally { await parent.close(); }
    const content = JSON.stringify(record) + '\n';
    const destination = path.join(root, record.mediaId + '.json');
    const temporary = path.join(root, '.' + record.mediaId + '.' + randomUUID() + '.tmp');
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
      try { await fs.link(temporary, destination); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const stat = await fs.lstat(destination);
        if (!stat.isFile() || await fs.readFile(destination, 'utf8') !== content) throw Error('Upload journal identity conflict');
      }
      await fs.unlink(temporary);
      const directory = await fs.open(root, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await fs.rm(temporary, { force: true }); }
  };
  return { persist };
};
module.exports = { createCompletionUploadJournal };
