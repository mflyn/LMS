const { isDeepStrictEqual: same } = require('util');
const { AppError } = require('../../../common/middleware/errorTypes');
const Asset = require('../models/MediaAsset');
const Operation = require('../models/MediaReferenceOperation');
const Reference = require('../models/MediaReference');
const Retirement = require('../models/MediaOrphanRetirement');
const Guard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const { canonicalMetadata, hash } = require('./completionUploadRecord');
const { operationSnapshot, referenceSnapshot, retirementSnapshot, scopeMatches, inconsistent } = require('./orphanRetirementEvidence');

// Operator-only synthetic recovery. Overflow rejects the WHOLE history, never a truncated replay.
const MAX_OPERATIONS = 100, MAX_REFERENCES = 1000;
const ID = /^[0-9a-f]{24}$/;
const error = (status, code) => new AppError(code, status, code, true, []);
const pending = () => error(503, 'MEDIA_RETIREMENT_PENDING');
const bounded = (values, limit) => {
  if (!Array.isArray(values) || values.length > limit) throw inconsistent();
  return values;
};
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && same(Object.keys(value).sort(), [...names].sort());
const isoDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const date = value => value instanceof Date && Number.isFinite(value.getTime());
const scope = value => ({ familyId: value.familyId, childId: value.childId,
  resourceType: value.resourceType, resourceId: value.resourceId, field: value.field });
const opKey = value => ({ ...scope(value), operationId: value.operationId });
const slot = value => ({ ...scope(value), mediaId: value.mediaId });
const textKey = value => JSON.stringify(Object.values(opKey(value)).map(String));
const slotKey = value => JSON.stringify(Object.values(slot(value)).map(String));
const identity = value => ({ ...Object.fromEntries(Object.entries(opKey(value)).map(([k, v]) => [k, String(v)])),
  _id: String(value._id), commandHash: value.commandHash, referenceSetHash: value.referenceSetHash,
  references: value.references.map(r => ({ mediaId: String(r.mediaId), field: r.field })) });
const validate = async (Model, row) => {
  try { await Model.hydrate(row).validate(); } catch (_cause) { throw inconsistent(); }
};
const validateOperation = async op => {
  await validate(Operation, op);
  const refs = identity(op).references;
  if (!same(refs, [...refs].sort((a, b) => a.mediaId.localeCompare(b.mediaId)))
    || hash(refs) !== op.referenceSetHash) throw inconsistent();
};
const released = op => ({ state: 'released', leaseExpiresAt: null, releaseOperationId: op.operationId,
  releasedAt: new Date(op.terminalAt) });
const checkedUpdate = async (Model, filter, patch, session) => {
  const result = await Model.updateOne(filter, patch, { session, timestamps: false });
  if (result.matchedCount !== 1) throw inconsistent();
};

const verifyJournal = async (input, mediaId, time) => {
  if (!keys(input, ['version', 'retirement', 'operations', 'references']) || input.version !== 1) throw inconsistent();
  bounded(input.operations, MAX_OPERATIONS); bounded(input.references, MAX_REFERENCES);
  // Detach from the reader before awaiting, so subsequent caller mutations cannot change the proof.
  const proof = JSON.parse(JSON.stringify(input)), r = proof.retirement;
  if (!r || r.mediaId !== mediaId || ![r.createdAt, r.deletedAt, r.orphanEligibleAt].every(isoDate)
    || Date.parse(r.orphanEligibleAt) > Date.parse(r.createdAt) || Date.parse(r.createdAt) > Date.parse(r.deletedAt)
    || Date.parse(r.deletedAt) > time.getTime()) throw inconsistent();
  const retirement = Retirement.hydrate({ ...r, state: 'DELETED', revision: 1, evidence: proof });
  await validate(Retirement, retirement.toObject());
  if (!same(retirementSnapshot(retirement), r)) throw inconsistent();
  const byKey = new Map(), ids = new Set();
  for (const op of proof.operations) {
    if (!isoDate(op.terminalAt) || Date.parse(op.terminalAt) > Date.parse(r.deletedAt)
      || op.state !== 'ABORTED' || op.leaseExpiresAt !== null || !scopeMatches(op, r)) throw inconsistent();
    const hydrated = Operation.hydrate(op);
    await validateOperation(hydrated);
    if (!same(operationSnapshot(hydrated), op) || !op.references.some(ref => ref.mediaId === mediaId)
      || byKey.has(textKey(op)) || ids.has(op._id)) throw inconsistent();
    byKey.set(textKey(op), op); ids.add(op._id);
  }
  const slots = new Set(), rowIds = new Set();
  for (const ref of proof.references) {
    const op = byKey.get(textKey(ref));
    await validate(Reference, ref);
    if (!op || ref.mediaId !== mediaId || !isoDate(ref.releasedAt)
      || !same(referenceSnapshot(Reference.hydrate(ref)), ref)
      || ref.state !== 'released' || ref.leaseExpiresAt !== null || ref.releaseOperationId !== op.operationId
      || ref.releasedAt !== op.terminalAt || op.version === 0 || slots.has(slotKey(ref)) || rowIds.has(ref._id)) throw inconsistent();
    slots.add(slotKey(ref)); rowIds.add(ref._id);
  }
  for (const op of proof.operations.filter(value => value.version > 0)) {
    const final = proof.references.find(ref => slotKey(ref) === slotKey({ ...op, mediaId }));
    if (!final || Date.parse(final.releasedAt) < Date.parse(op.terminalAt)) throw inconsistent();
  }
  // Online evidence is emitted in immutable _id order, including all historical generations.
  for (const rows of [proof.operations, proof.references]) {
    if (!same(rows.map(v => v._id), rows.map(v => v._id).sort())) throw inconsistent();
  }
  // The immutable file uses sorted keys; the existing cleanup compares snapshot JSON order.
  return { version: 1, retirement: retirementSnapshot(retirement),
    operations: proof.operations.map(op => operationSnapshot(Operation.hydrate(op))),
    references: proof.references.map(ref => referenceSnapshot(Reference.hydrate(ref))) };
};

const createOrphanRetirementRestore = ({ transactionRunner, journal, retirementClient, mediaStore, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof journal?.read !== 'function'
    || typeof retirementClient?.retire !== 'function' || typeof mediaStore?.resolveStoragePath !== 'function'
    || typeof now !== 'function') throw new TypeError('Explicit restoration dependencies required');

  const replay = async (proof, session, reconstructionTime) => {
    if (!session?.inTransaction()) throw pending();
    const r = proof.retirement, writes = [], byKey = new Map(proof.operations.map(op => [textKey(op), op]));
    const asset = await Asset.findById(r.mediaId).session(session).lean();
    const retirement = await Retirement.findOne({ mediaId: r.mediaId }).session(session).lean();
    const guard = await Guard.findOne({ mediaId: r.mediaId }).session(session).lean();
    if (await Tombstone.exists({ mediaId: r.mediaId }).session(session)
      || await Receipt.exists({ mediaId: r.mediaId }).session(session)) throw inconsistent();
    const purged = retirement?.state === 'PURGED';
    if (retirement) {
      await validate(Retirement, retirement);
      if (!same(retirementSnapshot({ ...retirement, deletedAt: retirement.deletedAt || new Date(r.deletedAt) }), r)
        || !['CANDIDATE', 'FENCED', 'DELETED', 'PURGED'].includes(retirement.state)
        || (['DELETED', 'PURGED'].includes(retirement.state) ? !same(retirement.evidence, proof)
          : retirement.evidence != null || retirement.deletedAt != null || retirement.purgedAt != null)
        || retirement.state === 'DELETED' && retirement.purgedAt != null
        || purged && (!date(retirement.purgedAt) || retirement.purgedAt < retirement.deletedAt)) throw inconsistent();
    }
    if (asset) {
      await validate(Asset, asset);
      if (purged || !scopeMatches(asset, r) || asset.purpose !== 'task_completion'
        || asset.storageKey !== r.storageKey || hash(canonicalMetadata(asset)) !== r.uploadMetadataHash
        || asset.retentionPolicyVersion !== r.retentionPolicyVersion
        || asset.orphanEligibleAt?.toISOString() !== r.orphanEligibleAt || asset.privacyDeletionRecorded
        || !date(asset.createdAt) || asset.orphanEligibleAt.getTime() - asset.createdAt.getTime() < 86400000
        || !Number.isSafeInteger(asset.__v) || asset.__v < 0
        || (asset.status === 'deleted' ? asset.orphanRetirementId !== r.retirementId
          || asset.deletedAt?.toISOString() !== r.deletedAt : asset.orphanRetirementId || asset.deletedAt != null)) throw inconsistent();
    } else if (!purged) {
      // The journal intentionally lacks upload metadata; never invent it from its hash.
      throw inconsistent();
    }
    const uploadIdentity = { mediaId: r.mediaId, familyId: r.familyId, childId: r.childId,
      storageKey: r.storageKey, metadataHash: r.uploadMetadataHash };
    if (guard) {
      await validate(Guard, guard);
      if (Object.entries(uploadIdentity).some(([k, v]) => String(guard[k]) !== v)) throw inconsistent();
    }
    const currentOps = bounded(await Operation.find({ $or: [
      { 'references.mediaId': r.mediaId }, ...proof.operations.map(opKey),
      { _id: { $in: proof.operations.map(op => op._id) } }
    ] }).limit(MAX_OPERATIONS + 1).session(session).lean(), MAX_OPERATIONS);
    const currentByKey = new Map(currentOps.map(op => [textKey(op), op]));
    for (const current of currentOps) {
      await validateOperation(current);
      const expected = byKey.get(textKey(current));
      if (!expected) {
        // Same exception as online cleanup: a genuinely late, never-PREPARED terminal.
        if (!scopeMatches(current, r) || current.state !== 'ABORTED' || current.version !== 0
          || !['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(current.failureCode)
          || current.terminalAt < new Date(r.deletedAt)
          || !current.references.some(ref => String(ref.mediaId) === r.mediaId)
          || proof.operations.some(op => op._id === String(current._id))
          || await Reference.exists(opKey(current)).session(session)) throw inconsistent();
        continue;
      }
      if (!same(identity(current), identity(expected)) || current.state === 'COMMITTED'
        || (current.state === 'ABORTED' ? !same(operationSnapshot(current), expected)
          : current.state !== 'PREPARED' || current.version + 1 !== expected.version)) throw inconsistent();
    }
    const members = [...new Set(proof.operations.flatMap(op => op.references.map(ref => ref.mediaId)))];
    const assets = await Asset.find({ _id: { $in: members } }).session(session).lean();
    for (const member of assets) {
      await validate(Asset, member);
      if (!scopeMatches(member, r) || member.purpose !== 'task_completion') throw inconsistent();
    }
    // Include full group rows (not just target rows), unique slots without childId to detect scope corruption,
    // and journal row identities to detect collisions before the first write.
    const rows = bounded(await Reference.find({ $or: [
      { mediaId: r.mediaId }, { _id: { $in: proof.references.map(ref => ref._id) } },
      ...proof.operations.map(op => ({ familyId: op.familyId, resourceType: op.resourceType,
        resourceId: op.resourceId, field: op.field, $or: [
          { operationId: op.operationId }, { mediaId: { $in: op.references.map(ref => ref.mediaId) } }
        ] }))
    ] }).limit(MAX_REFERENCES + 1).session(session).lean(), MAX_REFERENCES);
    for (const original of currentOps.filter(op => op.state === 'PREPARED')) {
      for (const ref of original.references) {
        if (!rows.some(row => slotKey(row) === slotKey({ ...original, mediaId: ref.mediaId }))
          || !assets.some(member => String(member._id) === String(ref.mediaId))) throw inconsistent();
      }
    }
    const checkedOther = new Set();
    for (const row of rows) {
      await validate(Reference, row);
      if (!scopeMatches(row, r) || row.resourceType !== 'growth_task' || row.field !== 'completionMediaIds') throw inconsistent();
      const op = byKey.get(textKey(row));
      if (op) {
        if (!op.references.some(ref => ref.mediaId === String(row.mediaId)) || op.version === 0) throw inconsistent();
        if (row.state === 'prepared') {
          const original = currentByKey.get(textKey(row));
          if (!original || original.state !== 'PREPARED' || !date(row.leaseExpiresAt)
            || row.leaseExpiresAt.getTime() !== original.leaseExpiresAt.getTime()) throw inconsistent();
        } else if (row.state !== 'released' || row.leaseExpiresAt != null || row.releaseOperationId !== op.operationId
          || row.releasedAt?.toISOString() !== op.terminalAt) throw inconsistent();
        if (row.state === 'prepared' && String(row.mediaId) !== r.mediaId) {
          const patch = released(op);
          writes.push(() => checkedUpdate(Reference, { _id: row._id, ...opKey(row), mediaId: row.mediaId,
            state: row.state, leaseExpiresAt: row.leaseExpiresAt }, { $set: patch }, session));
        }
      } else {
        if (String(row.mediaId) === r.mediaId) throw inconsistent();
        if (!checkedOther.has(textKey(row))) {
          const other = await Operation.findOne(opKey(row)).session(session).lean();
          if (!other) throw inconsistent();
          await validateOperation(other);
          const otherRows = bounded(await Reference.find(opKey(row)).limit(11).session(session).lean(), 10);
          for (const current of otherRows) {
            await validate(Reference, current);
            if (!other.references.some(ref => String(ref.mediaId) === String(current.mediaId))
              || (other.state === 'PREPARED' ? current.state !== 'prepared'
                || current.leaseExpiresAt?.getTime() !== other.leaseExpiresAt.getTime()
                : other.state === 'ABORTED' ? current.state !== 'released'
                  || current.releaseOperationId !== other.operationId || current.releasedAt?.getTime() !== other.terminalAt.getTime()
                  : !['bound', 'released'].includes(current.state))
              || current.state !== 'prepared' && current.leaseExpiresAt != null) throw inconsistent();
          }
          if (!otherRows.some(ref => String(ref._id) === String(row._id))
            || other.state === 'PREPARED' && otherRows.length !== other.references.length
            || other.references.some(ref => String(ref.mediaId) === r.mediaId)) throw inconsistent();
          checkedOther.add(textKey(row));
        }
      }
    }
    for (const row of rows.filter(ref => String(ref.mediaId) === r.mediaId)) {
      const final = proof.references.find(ref => slotKey(ref) === slotKey(row));
      if (purged || !final || String(row._id) !== final._id) throw inconsistent();
      // Replay the last durable projection only after independently verifying EVERY original generation.
      const original = byKey.get(textKey(row)), last = byKey.get(textKey(final));
      if (!original || Date.parse(original.terminalAt) > Date.parse(last.terminalAt)) throw inconsistent();
    }
    for (const ref of proof.references) {
      const collision = rows.find(row => String(row._id) === ref._id);
      if (collision && slotKey(collision) !== slotKey(ref)) throw inconsistent();
      if (purged) continue;
      const row = rows.find(current => slotKey(current) === slotKey(ref));
      if (!row) writes.push(() => new Reference(ref).save({ session, timestamps: false }));
      else if (row.state !== 'released' || !same(referenceSnapshot(row), ref)) {
        writes.push(() => checkedUpdate(Reference, { _id: row._id, ...opKey(row), mediaId: row.mediaId,
          state: row.state, leaseExpiresAt: row.leaseExpiresAt },
        { $set: { state: 'released', leaseExpiresAt: null, operationId: ref.operationId,
          releaseOperationId: ref.releaseOperationId, releasedAt: new Date(ref.releasedAt) } }, session));
      }
    }
    for (const op of proof.operations) {
      const current = currentByKey.get(textKey(op));
      if (!current) writes.push(() => new Operation(op).save({ session, timestamps: false }));
      else if (current.state === 'PREPARED') writes.push(() => checkedUpdate(Operation,
        { _id: current._id, ...opKey(current), state: 'PREPARED', version: current.version },
        { $set: { state: 'ABORTED', version: op.version, failureCode: op.failureCode,
          leaseExpiresAt: null, terminalAt: new Date(op.terminalAt) } }, session));
    }
    // These are guard reconstruction times, not the original deletion audit retained in the journal.
    if (!guard) writes.push(() => new Guard({ ...uploadIdentity, state: 'RETIRED', revision: 1,
      createdAt: reconstructionTime, updatedAt: reconstructionTime })
      .save({ session, timestamps: false }));
    else if (guard.state !== 'RETIRED') writes.push(() => checkedUpdate(Guard,
      { _id: guard._id, state: guard.state, revision: guard.revision },
      { $set: { state: 'RETIRED' }, $inc: { revision: 1 } }, session));
    if (asset?.status === 'active') writes.push(() => checkedUpdate(Asset,
      { _id: asset._id, familyId: r.familyId, childId: r.childId, storageKey: r.storageKey, status: 'active', __v: asset.__v },
      { $set: { status: 'deleted', deletedAt: new Date(r.deletedAt), orphanRetirementId: r.retirementId }, $inc: { __v: 1 } }, session));
    if (!retirement) writes.push(() => new Retirement({ ...r, state: 'DELETED', revision: 1, evidence: proof }).save({ session }));
    else if (['CANDIDATE', 'FENCED'].includes(retirement.state)) writes.push(() => checkedUpdate(Retirement,
      { _id: retirement._id, state: retirement.state, revision: retirement.revision },
      { $set: { state: 'DELETED', deletedAt: new Date(r.deletedAt), evidence: proof }, $inc: { revision: 1 } }, session));

    // Validation and write planning are complete. Any CAS/unique conflict rolls back the entire transaction.
    for (const write of writes) await write();
  };

  // writesPaused includes automatic cleanup, and must remain true across external actor recovery.
  // DELETED is the restored local audit, not proof of a current remote grant. This helper never purges.
  const restore = async ({ mediaId, writesPaused, execute } = {}) => {
    if (writesPaused !== true || execute !== true) throw error(400, 'MEDIA_RESTORE_CONFIRMATION_REQUIRED');
    if (typeof mediaId !== 'string' || !ID.test(mediaId)) throw error(400, 'VALIDATION_ERROR');
    let proof;
    try {
      const time = new Date(Number(now()));
      if (!date(time)) throw pending();
      const input = await journal.read(mediaId);
      try { proof = await verifyJournal(input, mediaId, time); }
      catch (_cause) { throw inconsistent(); }
      mediaStore.resolveStoragePath(proof.retirement.storageKey);
      await transactionRunner(session => replay(proof, session, time));
    } catch (cause) {
      if (cause.code === 'MEDIA_RETIREMENT_INCONSISTENT') throw cause;
      throw pending();
    }
    const { familyId, childId, retirementId } = proof.retirement;
    const command = { familyId, childId, mediaId, retirementId };
    let result;
    try { result = await retirementClient.retire({ ...command }); } catch (_cause) { /* Retry the same durable identity. */ }
    const confirmed = keys(result, ['familyId', 'childId', 'mediaId', 'retirementId', 'state'])
      && Object.entries(command).every(([key, value]) => result[key] === value)
      && ['granted', 'in_use'].includes(result.state);
    // This is not readiness, not actor recovery, and never permission to reopen writes.
    return { mediaId, retirementId, ready: false,
      state: confirmed && result.state === 'granted' ? 'RESOURCE_RESTORED_HOMEWORK_RETIRED' : 'RESOURCE_RESTORED_PENDING_HOMEWORK',
      nextAction: confirmed ? result.state === 'granted' ? 'VERIFY_RECOVERY_READINESS' : 'RECOVER_HOMEWORK_ORIGINAL_ACTOR'
        : 'RETRY_RETIREMENT' };
  };
  return { restore };
};

module.exports = { createOrphanRetirementRestore };
