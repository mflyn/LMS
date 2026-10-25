const { canonicalize } = require('json-canonicalize');
const { createHash } = require('crypto');
const { AppError } = require('../../../common/middleware/errorTypes');
const Asset = require('../models/MediaAsset');
const Operation = require('../models/MediaReferenceOperation');
const Reference = require('../models/MediaReference');
const Guard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Recovery = require('../models/MediaUserDeletionRecovery');
const Retirement = require('../models/MediaOrphanRetirement');
const { identityFor, matchesGuard } = require('./completionUploadGuardService');
const { validateEvidence, LIMITS } = require('./userDeletionRecoveryEvidence');
const { sameOperationIdentity, proveOperationVersionChain, createUserDeletionProofCache } = require('./userDeletionRestoreProof');

const error = (status, code) => new AppError(code, status, code, true, []);
const invalid = () => error(409, 'USER_DELETION_EVIDENCE_INVALID');
const pending = () => error(503, 'USER_DELETION_DEPENDENCY_PENDING');
const assert = condition => { if (!condition) throw invalid(); };
const equal = (a, b) => canonicalize(a) === canonicalize(b);
const id = value => {
  assert(value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function');
  return value.toHexString();
};
const date = value => { assert(value instanceof Date && Number.isFinite(value.getTime())); return value.toISOString(); };
const scope = row => ({ familyId: id(row.familyId), childId: id(row.childId), resourceType: row.resourceType,
  resourceId: id(row.resourceId), field: row.field });
const opKey = row => ({ familyId: row.familyId, childId: row.childId, resourceType: row.resourceType,
  resourceId: row.resourceId, field: row.field, operationId: row.operationId });
const slot = row => ({ familyId: row.familyId, resourceType: row.resourceType, resourceId: row.resourceId,
  field: row.field, mediaId: row.mediaId });
const key = row => canonicalize(opKey(row));
const slotKey = row => canonicalize(slot(row));
const opSnapshot = row => ({ _id: id(row._id), ...scope(row), operationId: row.operationId,
  commandHash: row.commandHash, referenceSetHash: row.referenceSetHash,
  references: row.references.map(ref => ({ mediaId: id(ref.mediaId), field: ref.field })),
  state: row.state, version: row.version, leaseExpiresAt: row.leaseExpiresAt === null ? null : date(row.leaseExpiresAt),
  terminalAt: row.terminalAt === null ? null : date(row.terminalAt), failureCode: row.failureCode,
  createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) });
const refSnapshot = row => ({ _id: id(row._id), ...scope(row), mediaId: id(row.mediaId), operationId: row.operationId,
  state: row.state, leaseExpiresAt: row.leaseExpiresAt === null ? null : date(row.leaseExpiresAt),
  releasedAt: row.releasedAt === null ? null : date(row.releasedAt), releaseOperationId: row.releaseOperationId ?? null,
  createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) });
const assertReferenceChronology = (ref, terminalAt = null) => {
  assert(ref.createdAt <= ref.updatedAt && (ref.releasedAt === null
    || ref.releasedAt >= ref.createdAt && ref.releasedAt <= ref.updatedAt));
  if (terminalAt !== null) assert(ref.updatedAt >= terminalAt && (ref.releasedAt === null || ref.releasedAt >= terminalAt));
};
const tombSnapshot = row => ({ _id: id(row._id), mediaId: id(row.mediaId), familyId: id(row.familyId), childId: id(row.childId),
  actorId: id(row.actorId), role: row.role, purpose: row.purpose, reason: row.reason, deletedAt: date(row.deletedAt) });
const receiptSnapshot = row => ({ _id: id(row._id), ...scope(row), mediaId: id(row.mediaId),
  bindingOperationId: row.bindingOperationId, releasedAt: date(row.releasedAt) });
const schemaValid = async (Model, row) => {
  for (const [name, field] of Object.entries(Model.schema.paths)) {
    const value = row[name]; if (value == null) continue;
    if (field.instance === 'ObjectId') id(value);
    if (field.instance === 'Date') date(value);
    if (field.instance === 'Number') assert(typeof value === 'number' && Number.isFinite(value));
    if (field.instance === 'String') assert(typeof value === 'string');
    if (field.instance === 'Boolean') assert(typeof value === 'boolean');
  }
  try { await Model.hydrate(row).validate(); } catch (_cause) { throw invalid(); }
};
const bounded = async (query, max, session) => {
  const rows = await query.limit(max + 1).session(session).lean(); assert(rows.length <= max); return rows;
};
const patchOperation = after => ({ state: after.state, version: after.version, leaseExpiresAt: after.leaseExpiresAt,
  terminalAt: after.terminalAt, failureCode: after.failureCode, updatedAt: after.updatedAt });
const patchReference = after => ({ state: after.state, leaseExpiresAt: after.leaseExpiresAt,
  releasedAt: after.releasedAt, releaseOperationId: after.releaseOperationId, updatedAt: after.updatedAt });
const checkScope = (row, proof) => assert(id(row.familyId) === proof.tombstone.familyId && id(row.childId) === proof.tombstone.childId);

const createUserDeletionRestore = ({ transactionRunner, journal, mediaStore, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof journal?.read !== 'function'
    || typeof mediaStore?.resolveStoragePath !== 'function' || typeof now !== 'function') throw TypeError('Explicit restoration dependencies required');

  const plan = async (proof, session, time, cache) => {
    if (!session?.inTransaction()) throw pending();
    const mediaId = proof.tombstone.mediaId, writes = [], projectedLedgers = new Map(), dependencyChecks = [];
    const update = (Model, before, patch) => writes.push(async () => {
      const result = await Model.updateOne(before, { $set: patch }, { session, timestamps: false });
      if (result.matchedCount !== 1) throw pending();
    });
    const insert = (Model, row) => writes.push(() => new Model(row).save({ session, timestamps: false }));
    const dependencyProofs = async operation => {
      const rows = await bounded(Recovery.find({ 'evidence.operations.after._id': operation._id }), LIMITS.MAX_DEPENDENCIES, session);
      const known = new Map(cache.values().map(item => [item.tombstone.mediaId, item]));
      const missing = [];
      for (const row of rows) {
        const dependencyId = id(row.mediaId);
        if (!known.has(dependencyId)) missing.push(dependencyId);
        else assert(equal(validateEvidence(row.evidence), known.get(dependencyId)));
      }
      if (missing.length) throw Object.assign(pending(), { neededProofs: missing });
      return cache.values();
    };
    // Dependency files prove a prior deletion, but never authorize restoring another media here.
    const assertApplied = async (dependency, proofs) => {
      const target = dependency.tombstone.mediaId;
      const row = await Asset.findById(target).session(session).lean();
      if (row) {
        id(row._id); id(row.uploadedBy); checkScope(row, dependency); await schemaValid(Asset, row);
        assert(matchesGuard(dependency.uploadIdentity, identityFor(row)));
        if (row.status !== 'deleted' || row.privacyDeletionRecorded !== true
          || date(row.deletedAt) !== dependency.tombstone.deletedAt) throw pending();
      }
      const fence = await Guard.findOne({ mediaId: target }).session(session).lean();
      const tomb = await Tombstone.findOne({ mediaId: target }).session(session).lean();
      const outbox = await Recovery.findOne({ mediaId: target }).session(session).lean();
      if (!fence || !tomb || !outbox) throw pending();
      id(fence._id); id(fence.mediaId); checkScope(fence, dependency); await schemaValid(Guard, fence);
      assert(fence.state === 'RETIRED' && matchesGuard(fence, dependency.uploadIdentity)
        && equal(tombSnapshot(tomb), dependency.tombstone));
      await schemaValid(Recovery, outbox); checkScope(outbox, dependency);
      assert(outbox._id === dependency.evidenceId && id(outbox.mediaId) === target
        && date(outbox.createdAt) === dependency.evidenceCreatedAt && outbox.evidenceHash === dependency.evidenceHash
        && equal(validateEvidence(outbox.evidence), dependency));
      const receipts = await bounded(Receipt.find({ mediaId: target }), LIMITS.MAX_OPERATIONS, session);
      assert(equal(receipts.map(receiptSnapshot).sort((a, b) => a._id.localeCompare(b._id)), dependency.receipts));
      for (const pair of dependency.operations) {
        const ledger = await Operation.findOne(opKey(pair.after)).session(session).lean();
        if (ledger) await schemaValid(Operation, ledger);
        const state = ledger ? opSnapshot(ledger) : projectedLedgers.get(key(pair.after));
        if (!state) throw pending();
        proveOperationVersionChain({ from: pair.after, to: state, proofs });
      }
      for (const effect of dependency.referenceEffects) {
        const ref = await Reference.findOne(slot(effect.after)).session(session).lean();
        if (!ref && effect.after.mediaId === target && !row) continue;
        if (!ref || !equal(refSnapshot(ref), effect.after)) throw pending();
      }
    };
    const asset = await Asset.findById(mediaId).session(session).lean();
    const guard = await Guard.findOne({ mediaId }).session(session).lean();
    const retirement = await Retirement.findOne({ mediaId }).session(session).lean();
    if (retirement) {
      await schemaValid(Retirement, retirement); checkScope(retirement, proof);
      assert(['CANDIDATE', 'FENCED', 'SUPERSEDED'].includes(retirement.state)
        && retirement.storageKey === proof.uploadIdentity.storageKey
        && retirement.uploadMetadataHash === proof.uploadIdentity.metadataHash);
    }
    if (asset) {
      id(asset._id); id(asset.uploadedBy); checkScope(asset, proof); date(asset.createdAt); date(asset.updatedAt);
      await schemaValid(Asset, asset);
      assert(asset.purpose === 'task_completion' && Number.isSafeInteger(asset.__v) && asset.__v >= 0
        && matchesGuard(proof.uploadIdentity, identityFor(asset)) && !asset.orphanRetirementId);
      if (asset.status === 'active') {
        assert(!asset.privacyDeletionRecorded && asset.deletedAt == null && asset.__v < Number.MAX_SAFE_INTEGER);
        update(Asset, asset, { status: 'deleted', privacyDeletionRecorded: true,
          deletedAt: proof.tombstone.deletedAt, __v: asset.__v + 1, updatedAt: proof.tombstone.deletedAt });
      } else assert(asset.status === 'deleted' && asset.privacyDeletionRecorded === true
        && date(asset.deletedAt) === proof.tombstone.deletedAt);
    }
    if (guard) {
      id(guard._id); id(guard.mediaId); checkScope(guard, proof); date(guard.createdAt); date(guard.updatedAt);
      await schemaValid(Guard, guard); assert(matchesGuard(guard, proof.uploadIdentity));
      if (guard.state !== 'RETIRED') {
        assert(guard.revision < Number.MAX_SAFE_INTEGER);
        update(Guard, guard, { state: 'RETIRED', revision: guard.revision + 1 });
      }
    } else insert(Guard, { ...proof.uploadIdentity, state: 'RETIRED', revision: 1, createdAt: time, updatedAt: time });

    const tombstones = await bounded(Tombstone.find({ $or: [{ mediaId }, { _id: proof.tombstone._id }] }), 2, session);
    assert(tombstones.length <= 1);
    if (tombstones.length) assert(equal(tombSnapshot(tombstones[0]), proof.tombstone));
    else insert(Tombstone, proof.tombstone);
    const receipts = await bounded(Receipt.find({ $or: [{ mediaId }, { _id: { $in: proof.receipts.map(row => row._id) } }] }), LIMITS.MAX_OPERATIONS, session);
    for (const receipt of receipts) assert(proof.receipts.some(row => equal(row, receiptSnapshot(receipt))));
    for (const receipt of proof.receipts) if (!receipts.some(row => id(row._id) === receipt._id)) insert(Receipt, receipt);
    const recoveries = await bounded(Recovery.find({ $or: [{ mediaId }, { _id: proof.evidenceId }] }), 2, session);
    assert(recoveries.length <= 1);
    if (recoveries.length) {
      const recovery = recoveries[0];
      await schemaValid(Recovery, recovery); checkScope(recovery, proof);
      assert(id(recovery.mediaId) === mediaId && recovery._id === proof.evidenceId
        && date(recovery.createdAt) === proof.evidenceCreatedAt && equal(validateEvidence(recovery.evidence), proof)
        && recovery.evidenceHash === proof.evidenceHash && recovery.version === 2);
    } else insert(Recovery, { _id: proof.evidenceId, ...Object.fromEntries(['mediaId', 'familyId', 'childId'].map(k => [k, proof.tombstone[k]])),
      version: 2, evidence: proof, evidenceHash: proof.evidenceHash, createdAt: proof.evidenceCreatedAt, restoredAt: time });

    const groups = proof.operations.map(pair => pair.after), byKey = new Map(proof.operations.map(pair => [key(pair.after), pair]));
    const foreign = await Operation.exists({ 'references.mediaId': mediaId, $and: [
      { $or: [{ familyId: { $ne: proof.tombstone.familyId } }, { childId: { $ne: proof.tombstone.childId } }] },
      { $or: [{ state: { $ne: 'ABORTED' } }, { version: { $ne: 0 } }] }
    ] }).session(session);
    assert(!foreign);
    const existing = await bounded(Operation.find({ $or: [
      { familyId: proof.tombstone.familyId, childId: proof.tombstone.childId, 'references.mediaId': mediaId },
      ...groups.map(opKey), { _id: { $in: groups.map(row => row._id) } }
    ] }), LIMITS.MAX_OPERATIONS, session);
    const current = new Map(), historical = new Map();
    for (const row of existing) {
      const value = opSnapshot(row); await schemaValid(Operation, row);
      assert(!current.has(key(value))); current.set(key(value), { row, value });
      const expected = byKey.get(key(value));
      if (!expected) {
        assert(value.state === 'ABORTED' && value.version === 0 && value.leaseExpiresAt === null
          && ['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(value.failureCode)
          && value.terminalAt >= proof.tombstone.deletedAt && value.createdAt >= proof.tombstone.deletedAt
          && value.references.some(ref => ref.mediaId === mediaId));
        const { childId: _childId, ...ownerScope } = opKey(value);
        assert(await Reference.countDocuments(ownerScope).session(session) === 0);
        const hash = createHash('sha256').update(JSON.stringify(value.references)).digest('hex');
        assert(hash === value.referenceSetHash); continue;
      }
      assert(value._id === expected.after._id);
      assert(['_id', ...Object.keys(opKey(value)), 'commandHash', 'referenceSetHash', 'references', 'createdAt']
        .every(field => equal(value[field], expected.after[field])));
      if (value.state !== 'PREPARED') assert(['state', 'terminalAt', 'failureCode', 'leaseExpiresAt']
        .every(field => equal(value[field], expected.after[field])));
      const hash = createHash('sha256').update(JSON.stringify(value.references)).digest('hex');
      assert(hash === value.referenceSetHash);
    }
    for (const pair of proof.operations) {
      const found = current.get(key(pair.after));
      let projected = found?.value || pair.after;
      if (!found) {
        const proofs = await dependencyProofs(pair.after);
        if (pair.before?.state === 'COMMITTED' && pair.before.version > 1) {
          const first = proofs.flatMap(item => item.operations).find(item => sameOperationIdentity(item.after, pair.after)
            && item.before?.state === 'COMMITTED' && item.before.version === 1)?.before;
          if (!first) throw pending();
          const edges = proveOperationVersionChain({ from: first, to: pair.before, proofs });
          for (const edge of edges) dependencyChecks.push(() => assertApplied(proofs.find(item => item.evidenceId === edge.evidenceId), proofs));
        }
        const candidates = proofs.flatMap(item => item.operations).map(item => item.after)
          .filter(item => item._id === pair.after._id || key(item) === key(pair.after));
        projected = candidates.reduce((latest, item) => item.version > latest.version ? item : latest, pair.after);
        const edges = proveOperationVersionChain({ from: pair.after, to: projected, proofs });
        for (const edge of edges) dependencyChecks.push(() => assertApplied(proofs.find(item => item.evidenceId === edge.evidenceId), proofs));
        insert(Operation, projected);
      } else if (!equal(found.value, pair.after)) {
        if (found.value.version > pair.after.version) {
          const proofs = await dependencyProofs(pair.after);
          const edges = proveOperationVersionChain({ from: pair.after, to: found.value, proofs });
          for (const edge of edges) dependencyChecks.push(() => assertApplied(proofs.find(item => item.evidenceId === edge.evidenceId), proofs));
        } else {
          if (!pair.before && pair.after.state === 'ABORTED' && pair.after.version > 0 && found.value.state === 'PREPARED') {
            const before = found.value, after = pair.after;
            assert(before.version + 1 === after.version && before.terminalAt === null && before.failureCode === null
              && before.leaseExpiresAt > before.createdAt && after.terminalAt >= before.createdAt);
            assert(after.failureCode === 'MEDIA_OPERATION_EXPIRED' ? after.terminalAt >= before.leaseExpiresAt
              : ['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(after.failureCode) && after.terminalAt < before.leaseExpiresAt);
            historical.set(key(after), before);
          } else if (!pair.before || !equal(found.value, pair.before)) throw pending();
          update(Operation, found.row, patchOperation(pair.after));
          projected = pair.after;
        }
      }
      projectedLedgers.set(key(pair.after), projected);
    }
    // Projected ledgers are candidates only until every predecessor's actual deletion facts pass.
    for (const check of dependencyChecks) await check();

    const references = await bounded(Reference.find({ $or: [
      { mediaId }, { _id: { $in: proof.referenceEffects.map(pair => pair.after._id) } },
      ...groups.map(group => ({ familyId: group.familyId, resourceType: group.resourceType,
        resourceId: group.resourceId, field: group.field, $or: [{ operationId: group.operationId },
          { mediaId: { $in: group.references.map(ref => ref.mediaId) } }] }))
    ] }), LIMITS.MAX_EFFECTS, session);
    const external = new Map();
    const validateLaterGroup = async ref => {
      if (external.has(key(ref))) return external.get(key(ref));
      const row = await Operation.findOne(opKey(ref)).session(session).lean();
      if (!row) throw pending();
      const group = opSnapshot(row); await schemaValid(Operation, row); checkScope(row, proof);
      assert(group.version > 0 && ['ABORTED', 'COMMITTED'].includes(group.state)
        && group.leaseExpiresAt === null && group.terminalAt >= group.createdAt && sameOperationIdentity(group, group));
      const rows = await bounded(Reference.find({ $or: [opKey(group), ...group.references.map(item => slot({ ...group, mediaId: item.mediaId }))] }), LIMITS.MAX_EFFECTS, session);
      assert(rows.length === group.references.length);
      for (const item of group.references) {
        const memberRef = rows.find(candidate => String(candidate.mediaId) === item.mediaId);
        assert(memberRef); const value = refSnapshot(memberRef); await schemaValid(Reference, memberRef);
        assertReferenceChronology(value, group.terminalAt);
        assert(key(value) === key(group) && value.leaseExpiresAt === null && value.createdAt <= value.updatedAt);
        if (group.state === 'COMMITTED') assert(group.failureCode === null && value.state === 'bound'
          && value.releasedAt === null && value.releaseOperationId === null);
        else assert(value.state === 'released' && value.releaseOperationId === group.operationId && value.releasedAt === group.terminalAt);
        const member = await Asset.findById(item.mediaId).session(session).lean();
        if (!member) throw pending();
        checkScope(member, proof); await schemaValid(Asset, member);
        assert(member.status === 'active' && member.purpose === 'task_completion' && !member.privacyDeletionRecorded);
      }
      external.set(key(ref), group); return group;
    };
    const refBySlot = new Map();
    for (const row of references) {
      let ref = refSnapshot(row); await schemaValid(Reference, row); checkScope(row, proof);
      assertReferenceChronology(ref);
      assert(!refBySlot.has(slotKey(ref)));
      const pair = byKey.get(key(ref));
      if (!pair) {
        const later = await validateLaterGroup(ref);
        for (const group of groups.filter(group => slotKey({ ...group, mediaId: ref.mediaId }) === slotKey(ref)
          && group.references.some(item => item.mediaId === ref.mediaId))) {
          const effect = proof.referenceEffects.find(item => key(item.after) === key(group) && item.after.mediaId === ref.mediaId);
          assert((effect?.after.releasedAt || group.terminalAt) <= later.createdAt);
        }
        refBySlot.set(slotKey(ref), { row, value: ref }); continue;
      }
      assert(pair.after.references.some(item => item.mediaId === ref.mediaId && item.field === ref.field));
      const effect = proof.referenceEffects.find(item => item.after._id === ref._id && key(item.after) === key(ref));
      if (effect) {
        if (!equal(ref, effect.after)) {
          assert(equal(ref, effect.before)); update(Reference, row, patchReference(effect.after)); ref = effect.after;
        }
      } else if (historical.has(key(ref)) && ref.state === 'prepared') {
        assert(ref.leaseExpiresAt === historical.get(key(ref)).leaseExpiresAt && ref.releasedAt === null && ref.releaseOperationId === null);
        const after = { ...ref, state: 'released', leaseExpiresAt: null, releasedAt: pair.after.terminalAt,
          releaseOperationId: pair.after.operationId, updatedAt: pair.after.terminalAt };
        update(Reference, row, patchReference(after)); ref = after;
      } else {
        assert(ref.leaseExpiresAt === null);
        if (pair.after.state === 'ABORTED') assert(pair.after.version > 0 && ref.state === 'released'
          && ref.releaseOperationId === pair.after.operationId && ref.releasedAt === pair.after.terminalAt);
        else {
          assertReferenceChronology(ref, pair.after.terminalAt);
          assert(pair.after.state === 'COMMITTED' && ['bound', 'released'].includes(ref.state)
            && (ref.mediaId !== mediaId || ref.state === 'released'));
        }
      }
      refBySlot.set(slotKey(ref), { row, value: ref });
    }
    const members = [...new Set(groups.flatMap(group => group.references.map(ref => ref.mediaId)))];
    const assets = await bounded(Asset.find({ _id: { $in: members } }), LIMITS.MAX_EFFECTS, session);
    for (const member of assets) { id(member._id); checkScope(member, proof); assert(member.purpose === 'task_completion'); }
    const deletedMembers = new Set();
    for (const group of groups) {
      for (const ref of group.references) {
        const found = refBySlot.get(slotKey({ ...group, mediaId: ref.mediaId }));
        const member = assets.find(row => id(row._id) === ref.mediaId);
        const targetAbsent = ref.mediaId === mediaId && !asset;
        if (group.version === 0 && group.state === 'ABORTED') { assert(!found || found.value.operationId !== group.operationId); continue; }
        if (targetAbsent) continue;
        if (!member || !found) {
          const proofs = await dependencyProofs(group);
          const dependency = proofs.find(item => item.tombstone.mediaId === ref.mediaId);
          if (!dependency || !dependency.operations.some(pair => sameOperationIdentity(pair.after, group))) throw pending();
          await assertApplied(dependency, proofs);
          assert(!member && !found); deletedMembers.add(ref.mediaId);
        }
      }
    }
    for (const effect of proof.referenceEffects) {
      const found = refBySlot.get(slotKey(effect.after));
      if (!found) assert(effect.after.mediaId === mediaId && !asset || deletedMembers.has(effect.after.mediaId));
      else if (key(found.value) === key(effect.after)) assert(found.value._id === effect.after._id);
      else {
        const previous = byKey.get(key(found.value))?.after;
        if (previous) assert(previous.state === 'ABORTED' && found.value.state === 'released'
          && byKey.get(key(effect.after)).after.state === 'ABORTED'
          && previous.terminalAt <= byKey.get(key(effect.after)).after.createdAt);
        else assert(external.has(key(found.value)));
      }
    }
    return writes;
  };

  const restore = async ({ mediaId, execute, writesPaused } = {}) => {
    if (execute !== true || writesPaused !== true) throw error(400, 'MEDIA_RESTORE_CONFIRMATION_REQUIRED');
    if (typeof mediaId !== 'string' || !/^[0-9a-f]{24}$/.test(mediaId)) throw error(400, 'VALIDATION_ERROR');
    let proof, time;
    const cache = createUserDeletionProofCache({ journal });
    try {
      time = new Date(Number(now())); date(time);
      const value = await cache.read(mediaId); if (!value) throw pending();
      proof = validateEvidence(value); assert(proof.tombstone.mediaId === mediaId && new Date(proof.evidenceCreatedAt) <= time);
      mediaStore.resolveStoragePath(proof.uploadIdentity.storageKey);
      for (;;) {
        try {
          await transactionRunner(async session => {
            const writes = await plan(proof, session, time, cache);
            for (const write of writes) await write();
          });
          break;
        } catch (cause) {
          if (!cause.neededProofs) throw cause;
          // Read protected files outside retryable transaction callbacks, then revalidate a fresh snapshot.
          for (const dependencyId of cause.neededProofs) await cache.read(dependencyId);
        }
      }
    } catch (cause) {
      if (cause.code === 'USER_DELETION_EVIDENCE_INVALID') throw invalid();
      if (cause.code === 'USER_DELETION_DEPENDENCY_PENDING') throw pending();
      // Unknown commit can be acknowledged only by a new, entirely read-only proof check.
      if (proof) {
        try {
          await transactionRunner(async session => { if ((await plan(proof, session, time, cache)).length) throw pending(); });
          return { ready: false, state: 'USER_DELETION_RESTORED' };
        } catch (_confirmation) { /* Keep maintenance isolation; never compensate to active. */ }
      }
      throw pending();
    }
    return { ready: false, state: 'USER_DELETION_RESTORED' };
  };
  return { restore };
};

module.exports = { createUserDeletionRestore };
