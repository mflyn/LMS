const { AppError } = require('../../../common/middleware/errorTypes');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Receipt = require('../models/MediaDeletionReceipt');
const Retirement = require('../models/MediaOrphanRetirement');
const { loadDeletionEvidence, assertRecoveryProtocolAvailable } = require('./mediaDeletionEvidence');
const DAY_MS = 86400000;
const inconsistent = () => new AppError('MEDIA_OPERATION_INCONSISTENT', 409, 'MEDIA_OPERATION_INCONSISTENT', true, []);

const createCompletionMediaCleanupService = ({ transactionRunner, journal, recoveryJournal, mediaStore, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof journal?.persist !== 'function'
    || typeof mediaStore?.remove !== 'function' || typeof now !== 'function') throw new Error('Cleanup dependencies are required');
  if (recoveryJournal !== undefined && (typeof recoveryJournal?.persist !== 'function'
    || typeof recoveryJournal?.read !== 'function')) throw Error('Recovery journal is required');
  if (recoveryJournal !== undefined && typeof mediaStore.syncDirectory !== 'function') {
    throw Error('Media directory durability capability is required');
  }
  const recovery = recoveryJournal === undefined ? null : require('./userDeletionRecoveryCapture');
  const inspect = async (mediaId, session) => {
    if (!session?.inTransaction()) throw new Error('Active MongoDB transaction is required');
    const cutoff = new Date(Number(now()) - 30 * DAY_MS);
    if (!Number.isFinite(cutoff.getTime())) throw new Error('Invalid cleanup clock');
    const asset = await Asset.findOne({ _id: mediaId, purpose: 'task_completion', status: 'deleted',
      privacyDeletionRecorded: true }).session(session).lean();
    if (!asset || !asset.deletedAt || asset.deletedAt > cutoff) return null;
    await assertRecoveryProtocolAvailable(mediaId, session, Boolean(recovery));
    const retirement = await Retirement.findOne({ mediaId }).session(session).lean();
    if (asset.orphanRetirementId || retirement && retirement.state !== 'SUPERSEDED') throw inconsistent();
    const evidence = await loadDeletionEvidence(mediaId, session);
    if (!evidence || evidence.tombstone.familyId !== String(asset.familyId) || evidence.tombstone.childId !== String(asset.childId)
      || evidence.tombstone.deletedAt !== asset.deletedAt.toISOString()) throw inconsistent();
    const references = await Reference.find({ mediaId }).session(session).lean();
    if (references.some(r => r.state === 'prepared' || r.state === 'bound')) return null;
    if (references.some(r => String(r.familyId) !== String(asset.familyId) || String(r.childId) !== String(asset.childId)
      || r.resourceType !== 'growth_task' || r.field !== 'completionMediaIds' || r.state !== 'released' || !r.releasedAt)) throw inconsistent();
    if (references.some(r => r.releasedAt > cutoff)
      || evidence.receipts.some(r => new Date(r.releasedAt) > cutoff)) return null;
    if (await Receipt.countDocuments({ mediaId }).session(session) !== evidence.receipts.length) throw inconsistent();
    const frozen = recovery ? await recovery.loadUserDeletionRecovery({ mediaId, asset, session }) : null;
    return { asset, evidence, frozen };
  };
  const cleanupDeletedMedia = async ({ limit = 100 } = {}) => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new AppError('Invalid cleanup limit', 400, 'VALIDATION_ERROR', true, []);
    }
    const candidates = await Asset.find({ purpose: 'task_completion', status: 'deleted', privacyDeletionRecorded: true,
      deletedAt: { $lte: new Date(Number(now()) - 30 * DAY_MS) } }).sort({ deletedAt: 1, _id: 1 }).limit(limit).select('_id').lean();
    const mediaIds = [];
    for (const candidate of candidates) {
      const eligible = await transactionRunner(session => inspect(candidate._id, session));
      if (!eligible) continue;
      if (recovery && !eligible.frozen && await recoveryJournal.read(String(candidate._id))) {
        throw Error('Missing user deletion recovery evidence');
      }
      await journal.persist(eligible.evidence);
      if (eligible.frozen) await recoveryJournal.persist(eligible.frozen);
      // Only deleted assets qualify; the operation protocol cannot bind them again.
      // Filesystem deletion is idempotent and outside retryable transaction callbacks.
      await mediaStore.remove(eligible.asset.storageKey);
      if (recovery) await mediaStore.syncDirectory();
      const removed = await transactionRunner(async session => {
        const current = await inspect(candidate._id, session);
        if (!current) return false;
        if (current.asset.storageKey !== eligible.asset.storageKey
          || JSON.stringify(current.frozen) !== JSON.stringify(eligible.frozen)
          || JSON.stringify(current.evidence) !== JSON.stringify(eligible.evidence)) throw inconsistent();
        const result = await Asset.deleteOne({ _id: current.asset._id, status: 'deleted', __v: current.asset.__v }, { session });
        if (result.deletedCount !== 1) throw inconsistent();
        await Reference.deleteMany({ mediaId: candidate._id, state: 'released' }, { session });
        return true;
      });
      if (removed) mediaIds.push(String(candidate._id));
    }
    return { cleaned: mediaIds.length, mediaIds };
  };
  return { cleanupDeletedMedia };
};
module.exports = { createCompletionMediaCleanupService };
