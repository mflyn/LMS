const { randomUUID } = require('crypto');
const { AppError } = require('../../../common/middleware/errorTypes');
const Asset = require('../models/MediaAsset');
const Retirement = require('../models/MediaOrphanRetirement');
const Reference = require('../models/MediaReference');
const Tombstone = require('../models/MediaDeletionTombstone');
const UploadGuard = require('../models/CompletionUploadGuard');
const { retireUploadGuard } = require('./completionUploadGuardService');
const { canonicalMetadata, hash } = require('./completionUploadRecord');
const { authorizeDeletion } = require('./completionMediaPrivacyService');
const { inspectOrphanReferences, retirementSnapshot, same, scopeMatches, inconsistent } = require('./orphanRetirementEvidence');
const error = (status, code) => new AppError(code, status, code, true, []);
const pending = () => error(503, 'MEDIA_RETIREMENT_PENDING');
const validId = value => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
const matchingAsset = (a, r) => a && String(a._id) === String(r.mediaId) && scopeMatches(a, r)
  && a.purpose === 'task_completion' && a.storageKey === r.storageKey
  && hash(canonicalMetadata(a)) === r.uploadMetadataHash
  && a.retentionPolicyVersion === r.retentionPolicyVersion && a.orphanEligibleAt?.getTime() === r.orphanEligibleAt.getTime();
const bodyFor = r => ({ familyId: String(r.familyId), childId: String(r.childId), mediaId: String(r.mediaId), retirementId: r.retirementId });

const createOrphanRetirementService = ({ transactionRunner, retirementClient, journal, mediaStore, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof retirementClient?.retire !== 'function'
    || typeof journal?.persist !== 'function' || typeof mediaStore?.remove !== 'function'
    || typeof mediaStore?.syncDirectory !== 'function' || typeof now !== 'function') throw new TypeError('Orphan retirement dependencies required');
  const time = () => { const date = new Date(Number(now())); if (!Number.isFinite(date.getTime())) throw pending(); return date; };
  const transact = async work => {
    for (let i = 0; i < 5; i += 1) {
      try { return await transactionRunner(session => { if (!session?.inTransaction()) throw pending(); return work(session); }); }
      catch (cause) { if (!(cause.code === 11000 && cause.keyPattern?.mediaId)) throw cause; }
    }
    throw pending();
  };
  const transition = async (record, patch, session) => {
    const candidate = { ...record, ...patch, revision: record.revision + 1 };
    await Retirement.hydrate(candidate).validate();
    const changed = await Retirement.findOneAndUpdate({ _id: record._id, state: record.state, revision: record.revision },
      { $set: patch, $inc: { revision: 1 } }, { session, new: true }).lean();
    if (!changed) throw pending();
    return changed;
  };
  const find = (mediaId, session) => Retirement.findOne({ mediaId }).session(session).lean();
  const superseded = async (record, asset, tombstone, session) => {
    if (!tombstone) return null;
    if (['DELETED', 'PURGED'].includes(record.state) || !scopeMatches(tombstone, record)
      || tombstone.purpose !== 'task_completion' || tombstone.reason !== 'user_requested'
      || asset && (!matchingAsset(asset, record) || asset.status !== 'deleted' || asset.privacyDeletionRecorded !== true
        || asset.orphanRetirementId || asset.deletedAt?.getTime() !== tombstone.deletedAt?.getTime())) throw inconsistent();
    if (record.state === 'SUPERSEDED') return record;
    return transition(record, { state: 'SUPERSEDED' }, session);
  };
  const begin = mediaId => transact(async session => {
    let record = await find(mediaId, session);
    if (record) {
      await Retirement.hydrate(record).validate();
      if (['CANDIDATE', 'FENCED', 'SUPERSEDED'].includes(record.state)) {
        const a = await Asset.findById(mediaId).session(session).lean();
        const tombstone = await Tombstone.findOne({ mediaId }).session(session).lean();
        const prior = await superseded(record, a, tombstone, session);
        if (prior) return prior;
        if (record.state === 'SUPERSEDED') throw inconsistent();
      }
      return record;
    }
    const a = await Asset.findById(mediaId).session(session).lean();
    if (!a || a.purpose !== 'task_completion' || a.status !== 'active' || a.retentionPolicyVersion !== 1
      || !(a.orphanEligibleAt instanceof Date) || a.orphanEligibleAt > time()) return null;
    if (a.orphanRetirementId || a.privacyDeletionRecorded || await Tombstone.exists({ mediaId }).session(session)) throw inconsistent();
    if (!await inspectOrphanReferences(a, session)) return null;
    [record] = await Retirement.create([{ mediaId, familyId: a.familyId, childId: a.childId, storageKey: a.storageKey,
      uploadMetadataHash: hash(canonicalMetadata(a)),
      retentionPolicyVersion: 1, orphanEligibleAt: a.orphanEligibleAt, retirementId: randomUUID(),
      actorType: 'system', state: 'CANDIDATE', revision: 1, createdAt: time() }], { session });
    return record.toObject();
  });
  const fence = async record => {
    const command = bodyFor(record), result = await retirementClient.retire(command);
    if (!result || Object.keys(result).length !== 5 || !['granted', 'in_use'].includes(result.state)
      || Object.keys(command).some(k => result[k] !== command[k])) throw pending();
    if (result.state === 'in_use') return null;
    return transact(async session => {
      const current = await find(record.mediaId, session);
      if (!current || !same(bodyFor(current), command)) throw inconsistent();
      if (current.state !== 'CANDIDATE') return current;
      return transition(current, { state: 'FENCED' }, session);
    });
  };
  const deleteMetadata = record => transact(async session => {
    const r = await find(record.mediaId, session);
    if (!r) throw inconsistent();
    if (r.state !== 'FENCED') return r;
    const a = await Asset.findById(r.mediaId).session(session).lean();
    const tombstone = await Tombstone.findOne({ mediaId: r.mediaId }).session(session).lean();
    const prior = await superseded(r, a, tombstone, session); if (prior) return prior;
    if (!matchingAsset(a, r) || a.status !== 'active' || a.orphanRetirementId || a.privacyDeletionRecorded
      || a.orphanEligibleAt > time()) throw inconsistent();
    const proof = await inspectOrphanReferences(a, session); if (!proof) throw inconsistent();
    const deletedAt = time();
    await retireUploadGuard(a, session);
    const updated = await Asset.updateOne({ _id: a._id, familyId: r.familyId, childId: r.childId, status: 'active', __v: a.__v },
      { $set: { status: 'deleted', deletedAt, orphanRetirementId: r.retirementId }, $inc: { __v: 1 } }, { session });
    if (updated.matchedCount !== 1) throw inconsistent();
    const evidence = { version: 1, retirement: retirementSnapshot({ ...r, deletedAt }), ...proof };
    return transition(r, { state: 'DELETED', deletedAt, evidence }, session);
  });
  const verifyDeleted = async (r, session) => {
    await Retirement.hydrate(r).validate().catch(() => { throw inconsistent(); });
    if (!['DELETED', 'PURGED'].includes(r.state) || !r.evidence || !same(r.evidence.retirement, retirementSnapshot(r))) throw inconsistent();
    const guard = await UploadGuard.findOne({ mediaId: r.mediaId }).session(session);
    if (!guard || guard.state !== 'RETIRED' || !scopeMatches(guard, r) || guard.storageKey !== r.storageKey
      || guard.metadataHash !== r.uploadMetadataHash) throw inconsistent();
    await guard.validate().catch(() => { throw inconsistent(); });
    if (await Tombstone.exists({ mediaId: r.mediaId }).session(session)) throw inconsistent();
    const a = await Asset.findById(r.mediaId).session(session).lean();
    const proof = await inspectOrphanReferences(r, session);
    if (!proof || !Array.isArray(r.evidence.operations)) throw inconsistent();
    const recorded = new Map(r.evidence.operations.map(o => [o._id, o]));
    if (recorded.size !== r.evidence.operations.length
      || r.evidence.operations.some(o => !same(o, proof.operations.find(current => current._id === o._id)))) throw inconsistent();
    for (const op of proof.operations.filter(o => !recorded.has(o._id))) {
      // A late command may be born ABORTED without ever owning a reference. It is not
      // evidence for any deleted generation and must never replace the frozen history.
      if (op.version !== 0 || !['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(op.failureCode)
        || new Date(op.terminalAt) < r.deletedAt
        || await Reference.exists({ familyId: op.familyId, childId: op.childId, resourceType: op.resourceType,
          resourceId: op.resourceId, field: op.field, operationId: op.operationId }).session(session)) throw inconsistent();
    }
    if (r.state === 'PURGED') { if (a || proof.references.length) throw inconsistent(); }
    else if (!matchingAsset(a, r) || a.status !== 'deleted' || a.privacyDeletionRecorded
      || a.orphanRetirementId !== r.retirementId || a.deletedAt?.getTime() !== r.deletedAt.getTime()
      || !same(proof.references, r.evidence.references)) throw inconsistent();
    return a;
  };
  const purge = async record => {
    await transact(async session => { const r = await find(record.mediaId, session); if (!r) throw inconsistent(); await verifyDeleted(r, session); });
    await journal.persist(record.evidence);
    // Both unlink and the directory durability acknowledgement precede metadata removal.
    await mediaStore.remove(record.storageKey);
    await mediaStore.syncDirectory();
    return transact(async session => {
      const r = await find(record.mediaId, session); if (!r) throw inconsistent();
      const a = await verifyDeleted(r, session);
      if (!same(r.evidence, record.evidence)) throw inconsistent();
      if (r.state === 'PURGED') return r;
      for (const ref of r.evidence.references) {
        const removed = await Reference.deleteOne({ ...ref, releasedAt: new Date(ref.releasedAt) }, { session });
        if (removed.deletedCount !== 1) throw inconsistent();
      }
      const removed = await Asset.deleteOne({ _id: a._id, __v: a.__v, status: 'deleted', orphanRetirementId: r.retirementId }, { session });
      if (removed.deletedCount !== 1) throw inconsistent();
      return transition(r, { state: 'PURGED', purgedAt: time() }, session);
    });
  };
  const retire = async ({ mediaId } = {}) => {
    if (!validId(mediaId)) throw error(400, 'VALIDATION_ERROR');
    try {
      let record = await begin(mediaId);
      if (!record) return { state: 'skipped' };
      if (record.state === 'CANDIDATE') { record = await fence(record); if (!record) return { state: 'in_use' }; }
      if (record.state === 'FENCED') record = await deleteMetadata(record);
      if (['DELETED', 'PURGED'].includes(record.state)) record = await purge(record);
      if (record.state === 'INCONSISTENT') throw inconsistent();
      return { state: record.state };
    } catch (cause) {
      if (cause.code === 'MEDIA_RETIREMENT_INCONSISTENT') {
        await transact(async session => {
          const r = await find(mediaId, session);
          if (r && ['FENCED', 'DELETED'].includes(r.state)) await transition(r, { state: 'INCONSISTENT' }, session);
        }).catch(() => {});
        throw cause;
      }
      if (cause instanceof AppError && cause.statusCode < 500) throw cause;
      throw pending();
    }
  };
  const deleteMedia = async ({ identity, mediaId }) => {
    await transact(async session => {
      const record = await find(mediaId, session);
      if (!record) throw error(404, 'RESOURCE_NOT_FOUND');
      await authorizeDeletion(identity, record, session);
      await verifyDeleted(record, session);
    });
    return retire({ mediaId });
  };
  return { retire, deleteMedia };
};
module.exports = { createOrphanRetirementService };
