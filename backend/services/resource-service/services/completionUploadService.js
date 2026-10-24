const mongoose = require('mongoose');
const Asset = require('../models/MediaAsset');
const Guard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Retirement = require('../models/MediaOrphanRetirement');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { AppError } = require('../../../common/middleware/errorTypes');
const { canonicalMetadata, hash, validateRecord } = require('./completionUploadRecord');
const { identityFor, matchesGuard } = require('./completionUploadGuardService');
const error = (status, code) => new AppError(code, status, code, true, []);
const pending = () => error(503, 'MEDIA_UPLOAD_PENDING');

const authorize = async (record, session) => {
  const { identity, metadata: m } = record;
  const actor = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
  const child = await User.findOne({ _id: m.childId, familyId: m.familyId, role: 'student' }).session(session).lean();
  const query = { _id: m.familyId, childIds: m.childId };
  if (identity.role === 'parent') query.$or = [{ ownerParentId: identity.id }, { memberParentIds: identity.id }];
  else if (identity.id !== m.childId || actor?.childProfile?.tokenVersion !== identity.tokenVersion) throw error(403, 'CHILD_ACCESS_DENIED');
  if (!actor || !child || !await Family.exists(query).session(session)) throw error(403, 'CHILD_ACCESS_DENIED');
};

const createCompletionUploadService = ({ transactionRunner, mediaStore, journal, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof journal?.persist !== 'function'
    || typeof mediaStore?.read !== 'function' || typeof mediaStore?.remove !== 'function') throw new TypeError('Upload dependencies required');
  const readState = async (record, session) => {
    if (!session?.inTransaction()) throw pending();
    await authorize(record, session);
    const asset = await Asset.findById(record.mediaId).session(session).lean();
    const guard = await Guard.findOne({ mediaId: record.mediaId }).session(session);
    const tombstone = await Tombstone.findOne({ mediaId: record.mediaId }).session(session).lean();
    const retirement = await Retirement.findOne({ mediaId: record.mediaId }).session(session);
    if (retirement) {
      await retirement.validate();
      if (String(retirement.familyId) !== record.metadata.familyId || String(retirement.childId) !== record.metadata.childId
        || retirement.storageKey !== record.metadata.storageKey || retirement.state === 'INCONSISTENT'
        || ['DELETED', 'PURGED'].includes(retirement.state) && (tombstone || guard?.state !== 'RETIRED')) throw pending();
    }
    if (guard) await guard.validate();
    const identity = identityFor(record.metadata, record.mediaId);
    if (guard && !matchesGuard(guard, identity) || asset && hash(canonicalMetadata(asset)) !== record.metadataHash
      || tombstone && (String(tombstone.familyId) !== record.metadata.familyId
        || String(tombstone.childId) !== record.metadata.childId)) throw pending();
    if (tombstone || guard?.state === 'RETIRED' || asset?.status === 'deleted'
      || ['DELETED', 'PURGED'].includes(retirement?.state)) throw error(404, 'RESOURCE_NOT_FOUND');
    if (retirement && !asset) throw pending();
    if (guard && !asset) throw pending();
    if (asset && (!guard || asset.retentionPolicyVersion !== 1 || !(asset.orphanEligibleAt instanceof Date))) throw pending();
    return { asset, guard, identity };
  };
  const resume = async record => {
    try {
      await validateRecord(record);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await transactionRunner(async session => {
            const { asset, identity } = await readState(record, session);
            // Only after deletion evidence: missing bytes must not obscure a known terminal.
            const bytes = await mediaStore.read(record.metadata.storageKey);
            if (bytes.length !== record.metadata.sizeBytes) throw pending();
            if (asset) return asset;
            const registered = await Guard.findOneAndUpdate({ mediaId: record.mediaId },
              { $setOnInsert: { ...identity, state: 'REGISTERED' }, $inc: { revision: 1 } },
              { session, upsert: true, new: true, runValidators: true });
            await registered.validate();
            if (registered.state !== 'REGISTERED') throw error(404, 'RESOURCE_NOT_FOUND');
            const createdAt = new Date(Number(now())), orphanEligibleAt = new Date(createdAt.getTime() + 86400000);
            if (!Number.isFinite(orphanEligibleAt.getTime())) throw pending();
            const [created] = await Asset.create([{ _id: record.mediaId, ...record.metadata,
              status: 'active', retentionPolicyVersion: 1, orphanEligibleAt, createdAt }], { session });
            return created.toObject();
          });
          // A delayed successful create acknowledgement is not a fresh active-asset fact.
          return await transactionRunner(async session => {
            const { asset } = await readState(record, session);
            if (!asset) throw pending();
            return asset;
          });
        } catch (cause) {
          if (cause.code === 11000 && (cause.keyPattern?.mediaId || cause.keyPattern?._id)) continue;
          throw cause;
        }
      }
      throw pending();
    } catch (cause) {
      if (cause instanceof AppError && cause.statusCode < 500) throw cause;
      throw pending();
    }
  };
  const upload = async ({ identity, metadata }) => {
    let record;
    try {
      const canonical = canonicalMetadata(metadata);
      record = { version: 1, mediaId: String(new mongoose.Types.ObjectId()),
        identity: { id: String(identity.id).toLowerCase(), role: identity.role,
          ...(identity.role === 'student' ? { tokenVersion: identity.tokenVersion } : {}) },
        metadata: canonical, metadataHash: hash(canonical) };
      await validateRecord(record);
      await journal.persist(record);
    } catch (_cause) {
      // No metadata attempt was dispatched; only this pre-write failure permits compensation.
      try { await mediaStore.remove(metadata.storageKey); } catch (_cleanup) { /* Quarantined for operator inspection. */ }
      throw pending();
    }
    return resume(record);
  };
  return { upload, resume };
};
module.exports = { createCompletionUploadService };
