const { AppError } = require('../../../common/middleware/errorTypes');
const Asset = require('../models/MediaAsset');
const Tombstone = require('../models/MediaDeletionTombstone');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createMediaReferenceOperationService } = require('./mediaReferenceOperationService');
const { loadDeletionEvidence, assertRecoveryProtocolAvailable } = require('./mediaDeletionEvidence');
const { retireUploadGuard } = require('./completionUploadGuardService');
const { randomUUID } = require('crypto');

const error = (status, code) => new AppError(code, status, code, true, []);
const objectId = value => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
const denied = () => error(403, 'CHILD_ACCESS_DENIED');
const inconsistent = () => error(409, 'MEDIA_OPERATION_INCONSISTENT');

const authorizeDeletion = async (identity, asset, session) => {
  if (!identity || !objectId(identity.id) || !['parent', 'student'].includes(identity.role)) throw denied();
  const familyQuery = { _id: asset.familyId, childIds: asset.childId };
  if (identity.role === 'parent') familyQuery.$or = [{ ownerParentId: identity.id }, { memberParentIds: identity.id }];
  else if (String(asset.childId) !== identity.id.toLowerCase()
    || String(asset.childId) !== String(identity.childId || identity.id).toLowerCase()
    || String(asset.familyId) !== String(identity.familyId).toLowerCase()) throw denied();
  const user = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
  if (!user || !await Family.exists(familyQuery).session(session)) throw denied();
  if (identity.role === 'student' && (String(user.familyId) !== String(asset.familyId)
    || !Number.isInteger(identity.tokenVersion) || user.childProfile?.tokenVersion !== identity.tokenVersion)) throw denied();
};

const createCompletionMediaPrivacyService = ({ transactionRunner, journal, recoveryJournal, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof journal?.persist !== 'function' || typeof now !== 'function') {
    throw new Error('Transaction runner, durable deletion journal and clock are required');
  }
  if (recoveryJournal !== undefined && (typeof recoveryJournal?.persist !== 'function'
    || typeof recoveryJournal?.read !== 'function')) throw Error('Recovery journal is required');
  const recovery = recoveryJournal === undefined ? null : require('./userDeletionRecoveryCapture');
  const operations = createMediaReferenceOperationService({ transactionRunner, now });
  const deleteMedia = async ({ identity, mediaId } = {}) => {
    if (!objectId(mediaId)) throw error(400, 'VALIDATION_ERROR');
    if (!identity || !objectId(identity.id) || !['parent', 'student'].includes(identity.role)) throw denied();
    let result;
    const evidenceId = recovery ? randomUUID() : null;
    let external, externalError;
    // Filesystem reads stay outside retryable transactions; authorization still wins
    // over a journal failure before any database write is allowed.
    if (recovery) {
      try { external = await recoveryJournal.read(mediaId.toLowerCase()); }
      catch (cause) { externalError = cause; }
    }
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          result = await transactionRunner(async session => {
            if (!session?.inTransaction()) throw new Error('Active MongoDB transaction is required');
            const asset = await Asset.findById(mediaId).session(session).lean();
            const tombstone = await Tombstone.findOne({ mediaId }).session(session).lean();
            if (!asset && !tombstone) throw error(404, 'RESOURCE_NOT_FOUND');
            await authorizeDeletion(identity, tombstone || asset, session);
            if (externalError) throw externalError;
            await assertRecoveryProtocolAvailable(mediaId, session, Boolean(recovery));
            if (external && !tombstone) throw Error('Missing user deletion recovery evidence');
            if (tombstone) {
              if (asset && (asset.status !== 'deleted' || asset.purpose !== 'task_completion' || asset.privacyDeletionRecorded !== true
                || String(asset.familyId) !== String(tombstone.familyId) || String(asset.childId) !== String(tombstone.childId)
                || asset.deletedAt?.getTime() !== tombstone.deletedAt.getTime())) throw inconsistent();
              const frozen = recovery ? await recovery.loadUserDeletionRecovery({ mediaId, asset, session }) : null;
              if (external) recovery.validateExternalUserDeletionRecovery(external, frozen);
              if (asset) await retireUploadGuard(asset, session);
              return { evidence: await loadDeletionEvidence(mediaId, session), frozen };
            }
            if (asset.purpose !== 'task_completion') throw error(400, 'MEDIA_PURPOSE_MISMATCH');
            if (asset.status !== 'active') throw inconsistent();
            const before = recovery ? await recovery.readUserDeletionSnapshot({ asset, session }) : null;
            await retireUploadGuard(asset, session);
            const deletedAt = new Date(Number(now()));
            if (!Number.isFinite(deletedAt.getTime())) throw new Error('Invalid deletion clock');
            // Conflicts with prepare/commit's real asset write; not a snapshot-only authorization.
            const changed = await Asset.updateOne({ _id: mediaId, status: 'active', familyId: asset.familyId,
              childId: asset.childId, purpose: 'task_completion' },
            { $set: { status: 'deleted', deletedAt, privacyDeletionRecorded: true }, $inc: { __v: 1 } }, { session });
            if (changed.matchedCount !== 1) throw inconsistent();
            await Tombstone.create([{ mediaId, familyId: asset.familyId, childId: asset.childId, actorId: identity.id,
              role: identity.role, purpose: 'task_completion', reason: 'user_requested', deletedAt }], { session });
            await operations.releaseForPrivacyDeletion({ asset, session });
            const frozen = recovery ? await recovery.captureUserDeletionEvidence({ asset, ...before, session,
              evidenceId, evidenceCreatedAt: new Date(Number(now())) }) : null;
            return { evidence: await loadDeletionEvidence(mediaId, session), frozen };
          });
          break;
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
      }
      if (!result?.evidence) throw new Error('Deletion race did not converge');
    } catch (err) {
      if (err instanceof AppError && err.statusCode < 500) throw err;
      throw error(503, 'MEDIA_REFERENCE_PENDING');
    }
    // A failed durable journal acknowledgement is an unknown result, never deletion success.
    try {
      if (recovery && !result.frozen && await recoveryJournal.read(mediaId.toLowerCase())) {
        throw Error('Missing user deletion recovery evidence');
      }
      await journal.persist(result.evidence);
      if (result.frozen) await recoveryJournal.persist(result.frozen);
    } catch (_err) { throw error(503, 'MEDIA_REFERENCE_PENDING'); }
  };
  return { deleteMedia };
};
module.exports = { createCompletionMediaPrivacyService, authorizeDeletion };
