const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { validAi2MediaMetadata, isAttemptPurpose, isAttemptType, validPair, purposeFor } = require('../../../common/services/completionMediaProtocol');

const exact = (value, keys) => value != null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = value => typeof value === 'string' && /^[0-9a-f]{24}(?![\s\S])/.test(value);
const uuid = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/.test(value);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validAi2Evidence = evidence => {
  const tombstone = evidence.tombstone;
  return exact(evidence, ['tombstone', 'receipts'])
    && isAttemptPurpose(tombstone.purpose)
    && exact(tombstone, ['mediaId', 'familyId', 'childId', 'actorId', 'role', 'purpose', 'reason', 'deletedAt', 'mimeType', 'sizeBytes'])
    && [tombstone.mediaId, tombstone.familyId, tombstone.childId, tombstone.actorId].every(id)
    && ['parent', 'student'].includes(tombstone.role) && (tombstone.role !== 'student' || tombstone.actorId === tombstone.childId)
    && tombstone.reason === 'user_requested' && timestamp(tombstone.deletedAt) && validAi2MediaMetadata(tombstone)
    && Array.isArray(evidence.receipts) && Array.from(evidence.receipts).every(receipt =>
      exact(receipt, ['mediaId', 'familyId', 'childId', 'resourceType', 'resourceId', 'field', 'bindingOperationId', 'releasedAt'])
      && ['mediaId', 'familyId', 'childId'].every(key => receipt[key] === tombstone[key])
      && isAttemptType(receipt.resourceType) && validPair(receipt.resourceType, receipt.field)
      && purposeFor(receipt.resourceType) === tombstone.purpose && id(receipt.resourceId)
      && uuid(receipt.bindingOperationId) && timestamp(receipt.releasedAt));
};

const createMediaDeletionJournal = ({ root } = {}) => {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('An absolute protected deletion journal root is required');
  const persist = async evidence => {
    const mediaId = evidence?.tombstone?.mediaId;
    if (typeof mediaId !== 'string' || !/^[0-9a-f]{24}$/.test(mediaId)) throw new Error('Invalid deletion journal identity');
    const typed = isAttemptPurpose(evidence.tombstone.purpose) || Object.hasOwn(evidence.tombstone, 'mimeType')
      || Object.hasOwn(evidence.tombstone, 'sizeBytes')
      || Array.isArray(evidence.receipts) && evidence.receipts.some(receipt => isAttemptType(receipt?.resourceType)
        || ['correctionMediaIds', 'practiceMediaIds'].includes(receipt?.field));
    if (typed && !validAi2Evidence(evidence)) throw new Error('Invalid AI2 deletion evidence');
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
