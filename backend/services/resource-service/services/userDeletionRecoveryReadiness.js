const { ObjectId } = require('bson');
const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const { validateEvidence, LIMITS } = require('./userDeletionRecoveryEvidence');
const { createUserDeletionProofCache, sameOperationIdentity, proveOperationVersionChain } = require('./userDeletionRestoreProof');
const { assertCompletionPrivacyReadiness } = require('./completionPrivacyReadiness');
const { READ, oid, uuid, hash, storageKey, date, revision, scan, one, assertPrerequisites } =
  require('../../../common/services/completionRetentionReadinessHelpers');

const INVALID = 'USER_DELETION_EVIDENCE_INVALID';
const PENDING = 'USER_DELETION_DEPENDENCY_PENDING';
const NOT_READY = 'USER_DELETION_READINESS_NOT_READY';
const LEGACY = 'LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT';
const SAFE = new Set([INVALID, PENDING, NOT_READY, LEGACY]);
const fail = (code = INVALID) => { throw Object.assign(new Error(code), { code }); };
const assert = (condition, code = INVALID) => { if (!condition) fail(code); };
const equal = (a, b) => canonicalize(a) === canonicalize(b);
const FIELD = 'completionMediaIds';
const SCOPE = { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1 };
const SPECS = {
  mediaassets: { unique: [{ familyId: 1, storageKey: 1 }], indexes: [
    { purpose: 1, status: 1, retentionPolicyVersion: 1, orphanEligibleAt: 1 },
    { purpose: 1, status: 1, retentionPolicyVersion: 1, orphanLastCheckedAt: 1, _id: 1, orphanEligibleAt: 1 }
  ] },
  mediareferences: { unique: [{ familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 }] },
  mediareferenceoperations: { unique: [{ ...SCOPE, operationId: 1 }], indexes: [{ 'references.mediaId': 1, _id: 1 }] },
  mediadeletiontombstones: { unique: [{ mediaId: 1 }] },
  mediadeletionreceipts: { unique: [{ familyId: 1, childId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1, bindingOperationId: 1 }] },
  completionuploadguards: { unique: [{ mediaId: 1 }] },
  mediaorphanretirements: { unique: [{ mediaId: 1 }] },
  mediauserdeletionrecoveries: { unique: [{ mediaId: 1 }] }
};
const PROJECTIONS = {
  mediaassets: { _id: 1, familyId: 1, childId: 1, uploadedBy: 1, purpose: 1, mimeType: 1, sizeBytes: 1,
    pageCount: 1, storageKey: 1, malwareScanStatus: 1, malwareScannedAt: 1, status: 1, privacyDeletionRecorded: 1,
    deletedAt: 1, orphanRetirementId: 1, createdAt: 1, updatedAt: 1, __v: 1 },
  completionuploadguards: { _id: 1, mediaId: 1, familyId: 1, childId: 1, storageKey: 1, metadataHash: 1,
    state: 1, revision: 1, createdAt: 1, updatedAt: 1 },
  mediadeletiontombstones: { _id: 1, mediaId: 1, familyId: 1, childId: 1, actorId: 1, role: 1, purpose: 1, reason: 1, deletedAt: 1 },
  mediadeletionreceipts: { _id: 1, ...SCOPE, mediaId: 1, bindingOperationId: 1, releasedAt: 1 },
  // Keep the full outbox to detect unexpected persisted fields, not just its projection.
  mediauserdeletionrecoveries: undefined,
  mediareferenceoperations: { _id: 1, ...SCOPE, operationId: 1, references: 1, state: 1, version: 1,
    commandHash: 1, referenceSetHash: 1, leaseExpiresAt: 1, terminalAt: 1, failureCode: 1, createdAt: 1, updatedAt: 1 },
  mediareferences: { _id: 1, ...SCOPE, mediaId: 1, operationId: 1, state: 1, leaseExpiresAt: 1,
    releasedAt: 1, releaseOperationId: 1, createdAt: 1, updatedAt: 1 },
  mediaorphanretirements: { _id: 1, mediaId: 1, familyId: 1, childId: 1, storageKey: 1, uploadMetadataHash: 1,
    retirementId: 1, state: 1, revision: 1, createdAt: 1, orphanEligibleAt: 1, deletedAt: 1, purgedAt: 1, evidence: 1,
    retentionPolicyVersion: 1, actorType: 1 }
};
const id = value => { assert(oid(value)); return value.toHexString(); };
const time = value => { assert(date(value)); return value.toISOString(); };
const queryId = value => {
  assert(typeof value === 'string' && /^[0-9a-f]{24}(?![\s\S])/.test(value)); return new ObjectId(value);
};
const aliases = value => ({ $in: [queryId(value), value] });
const scope = row => ({ familyId: id(row.familyId), childId: id(row.childId), resourceType: row.resourceType,
  resourceId: id(row.resourceId), field: row.field });
const tombSnapshot = row => {
  const result = { _id: id(row._id), mediaId: id(row.mediaId), familyId: id(row.familyId), childId: id(row.childId),
    actorId: id(row.actorId), role: row.role, purpose: row.purpose, reason: row.reason, deletedAt: time(row.deletedAt) };
  assert(['parent', 'student'].includes(result.role) && result.purpose === 'task_completion' && result.reason === 'user_requested'
    && (result.role !== 'student' || result.actorId === result.childId)); return result;
};
const receiptSnapshot = row => {
  assert(uuid(row.bindingOperationId) && row.resourceType === 'growth_task' && row.field === FIELD);
  return { _id: id(row._id), ...scope(row), mediaId: id(row.mediaId), bindingOperationId: row.bindingOperationId, releasedAt: time(row.releasedAt) };
};
const sortIds = rows => [...rows].sort((a, b) => a._id.localeCompare(b._id));
const outboxProof = row => {
  const keys = ['_id', 'mediaId', 'familyId', 'childId', 'version', 'evidence', 'evidenceHash', 'createdAt', 'restoredAt'];
  assert(row && Object.keys(row).every(key => keys.includes(key)) && uuid(row._id) && row.version === 2 && hash(row.evidenceHash));
  const proof = validateEvidence(row.evidence);
  assert(row._id === proof.evidenceId && row.evidenceHash === proof.evidenceHash
    && ['mediaId', 'familyId', 'childId'].every(key => id(row[key]) === proof.tombstone[key])
    && time(row.createdAt) === proof.evidenceCreatedAt
    && (row.restoredAt === undefined || date(row.restoredAt) && row.restoredAt >= row.createdAt));
  return proof;
};
const assetIdentity = row => {
  id(row._id); id(row.uploadedBy);
  assert(row.purpose === 'task_completion' && ['image/jpeg', 'image/png', 'image/webp'].includes(row.mimeType)
    && Number.isSafeInteger(row.sizeBytes) && row.sizeBytes >= 1 && row.sizeBytes <= 10 * 1024 * 1024
    && row.pageCount == null && storageKey(row.storageKey)
    && ['legacy_unscanned', 'skipped_trusted_local', 'clean'].includes(row.malwareScanStatus)
    && (row.malwareScanStatus === 'clean' ? date(row.malwareScannedAt) : row.malwareScannedAt == null)
    && date(row.createdAt) && date(row.updatedAt) && row.createdAt <= row.updatedAt
    && Number.isSafeInteger(row.__v) && row.__v >= 0);
  const metadata = { familyId: id(row.familyId), childId: id(row.childId), uploadedBy: id(row.uploadedBy), purpose: row.purpose,
    mimeType: row.mimeType, displayName: 'task-completion', sizeBytes: row.sizeBytes, pageCount: row.pageCount ?? null,
    storageKey: row.storageKey, malwareScanStatus: row.malwareScanStatus,
    malwareScannedAt: row.malwareScannedAt == null ? null : time(row.malwareScannedAt) };
  return { mediaId: id(row._id), familyId: metadata.familyId, childId: metadata.childId, storageKey: row.storageKey,
    metadataHash: createHash('sha256').update(JSON.stringify(metadata)).digest('hex') };
};
const readers = db => {
  const read = (name, filter) => one(db, name, filter, PROJECTIONS[name]);
  const bounded = async (name, filter, max) => {
    const cursor = db.collection(name).find(filter, { ...READ, projection: PROJECTIONS[name], batchSize: 100 }).limit(max + 1);
    try { const rows = await cursor.toArray(); assert(rows.length <= max); return rows; }
    finally { await cursor.close(); }
  };
  return { read, bounded };
};

const opKey = value => canonicalize(Object.fromEntries([...Object.keys(SCOPE), 'operationId'].map(key => [key, value[key]])));
const slotKey = value => canonicalize(Object.fromEntries(['familyId', 'resourceType', 'resourceId', 'field', 'mediaId'].map(key => [key, value[key]])));
const groupQuery = value => ({ familyId: aliases(value.familyId), resourceId: aliases(value.resourceId),
  resourceType: value.resourceType, field: value.field, operationId: value.operationId });
// Factor the shared scope instead of expanding one OR branch per media slot.
// Keep both the whole generation and every slot, including corrupt/rebound rows.
const groupReferenceQuery = group => {
  const { operationId, ...shared } = groupQuery(group);
  return { ...shared, $or: [{ operationId }, {
    mediaId: { $in: group.references.flatMap(ref => [queryId(ref.mediaId), ref.mediaId]) }
  }] };
};
const nullableTime = value => value === null ? null : time(value);
const operationSnapshot = row => {
  assert(Array.isArray(row.references) && row.references.length >= 1 && row.references.length <= 10);
  const value = { _id: id(row._id), ...scope(row), operationId: row.operationId,
    commandHash: row.commandHash, referenceSetHash: row.referenceSetHash,
    references: row.references.map(ref => {
      assert(ref && Object.keys(ref).length === 2 && ref.field === FIELD); return { mediaId: id(ref.mediaId), field: ref.field };
    }), state: row.state, version: row.version, leaseExpiresAt: nullableTime(row.leaseExpiresAt),
    terminalAt: nullableTime(row.terminalAt), failureCode: row.failureCode,
    createdAt: time(row.createdAt), updatedAt: time(row.updatedAt) };
  proveOperationVersionChain({ from: value, to: value, proofs: [] });
  return value;
};
const referenceSnapshot = row => {
  const value = { _id: id(row._id), ...scope(row), mediaId: id(row.mediaId), operationId: row.operationId,
    state: row.state, leaseExpiresAt: nullableTime(row.leaseExpiresAt), releasedAt: nullableTime(row.releasedAt),
    releaseOperationId: row.releaseOperationId, createdAt: time(row.createdAt), updatedAt: time(row.updatedAt) };
  assert(value.resourceType === 'growth_task' && value.field === FIELD && uuid(value.operationId)
    && value.createdAt <= value.updatedAt && ['prepared', 'bound', 'released'].includes(value.state));
  if (value.state === 'released') assert(value.leaseExpiresAt === null && value.releasedAt !== null
    && value.createdAt <= value.releasedAt && value.releasedAt <= value.updatedAt
    && (value.releaseOperationId === null || uuid(value.releaseOperationId)));
  else assert(value.releasedAt === null && value.releaseOperationId === null
    && (value.state === 'prepared' ? value.leaseExpiresAt !== null && value.leaseExpiresAt > value.createdAt : value.leaseExpiresAt === null));
  return value;
};
const ownerScope = (value, proof) => assert(value.familyId === proof.tombstone.familyId && value.childId === proof.tombstone.childId);
const loadCurrent = async (proof, r) => {
  const target = proof.tombstone.mediaId, groups = proof.operations.map(pair => pair.after);
  const foreign = await r.read('mediareferenceoperations', { 'references.mediaId': aliases(target), $and: [
    { $or: [{ familyId: { $ne: queryId(proof.tombstone.familyId) } }, { childId: { $ne: queryId(proof.tombstone.childId) } }] },
    { $or: [{ state: { $ne: 'ABORTED' } }, { version: { $ne: 0 } }] }
  ] });
  assert(!foreign);
  const rows = await r.bounded('mediareferenceoperations', { $or: [
    { familyId: aliases(proof.tombstone.familyId), childId: aliases(proof.tombstone.childId), 'references.mediaId': aliases(target) },
    ...groups.map(groupQuery), { _id: { $in: groups.flatMap(group => [queryId(group._id), group._id]) } }
  ] }, LIMITS.MAX_OPERATIONS);
  const ledgers = new Map();
  for (const row of rows) {
    const value = operationSnapshot(row); ownerScope(value, proof);
    assert(!ledgers.has(opKey(value))); ledgers.set(opKey(value), value);
    const expected = groups.find(group => opKey(group) === opKey(value));
    if (!expected) {
      assert(value.state === 'ABORTED' && value.version === 0 && value.leaseExpiresAt === null
        && ['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(value.failureCode)
        && value.terminalAt >= proof.tombstone.deletedAt && value.createdAt >= proof.tombstone.deletedAt
        && value.references.some(ref => ref.mediaId === target));
      assert(!await r.read('mediareferences', groupQuery(value)));
    } else {
      assert(sameOperationIdentity(expected, value));
      assert(value.state !== 'PREPARED' && value.version >= expected.version, PENDING);
    }
  }
  for (const group of groups) assert(ledgers.has(opKey(group)), PENDING);
  const references = await r.bounded('mediareferences', { $or: [
    { mediaId: aliases(target) },
    { _id: { $in: proof.referenceEffects.flatMap(pair => [queryId(pair.after._id), pair.after._id]) } },
    ...groups.map(groupReferenceQuery)
  ] }, LIMITS.MAX_EFFECTS);
  const slots = new Map();
  for (const row of references) {
    const ref = referenceSnapshot(row); ownerScope(ref, proof); assert(!slots.has(slotKey(ref)));
    slots.set(slotKey(ref), ref);
  }
  return { groups, ledgers, slots };
};
const assertAppliedClosure = async (root, r, cache) => {
  const records = new Map(), queued = new Set([root.tombstone.mediaId]), queue = [root.tombstone.mediaId], laterGroups = new Map();
  const assetRows = new Map();
  const assetFor = async mediaId => {
    if (!assetRows.has(mediaId)) {
      const rows = await r.bounded('mediaassets', { _id: aliases(mediaId) }, 2); assert(rows.length <= 1);
      if (rows[0]) assetIdentity(rows[0]);
      assetRows.set(mediaId, rows[0] || null);
    }
    return assetRows.get(mediaId);
  };
  const laterFor = async (ref, proof) => {
    const key = opKey(ref);
    if (!laterGroups.has(key)) {
      const rows = await r.bounded('mediareferenceoperations', groupQuery(ref), 2);
      assert(rows.length, PENDING); assert(rows.length === 1);
      const group = operationSnapshot(rows[0]); ownerScope(group, proof);
      assert(opKey(group) === key && group.version > 0 && ['COMMITTED', 'ABORTED'].includes(group.state), PENDING);
      const refs = await r.bounded('mediareferences', groupReferenceQuery(group), LIMITS.MAX_EFFECTS);
      const slots = new Map();
      for (const row of refs) {
        const value = referenceSnapshot(row); ownerScope(value, proof);
        assert(opKey(value) === key && group.references.some(item => item.mediaId === value.mediaId));
        assert(!slots.has(slotKey(value))); slots.set(slotKey(value), value);
      }
      laterGroups.set(key, { group, slots, proof });
    }
    return laterGroups.get(key);
  };
  // Loading a node never declares it applied. All concrete predicates run after discovery.
  for (let index = 0; index < queue.length; index++) {
    const proof = await cache.read(queue[index]);
    const audit = await assertAudit(proof, r), current = await loadCurrent(proof, r);
    records.set(proof.tombstone.mediaId, { proof, audit, current });
    const groups = [...current.groups];
    for (const ref of current.slots.values()) if (!current.groups.some(group => opKey(group) === opKey(ref))) {
      groups.push((await laterFor(ref, proof)).group);
    }
    const members = new Set(groups.flatMap(group => group.references.map(item => item.mediaId)));
    for (const mediaId of members) {
      const rows = await r.bounded('mediauserdeletionrecoveries', { mediaId: aliases(mediaId) }, 2);
      assert(rows.length <= 1);
      if (rows.length) {
        const expected = outboxProof(rows[0]);
        const external = await cache.read(mediaId); assert(equal(expected, external));
        if (!queued.has(mediaId)) { queued.add(mediaId); queue.push(mediaId); }
      }
    }
  }
  const proofs = cache.values();
  const deletionFor = (mediaId, group) => {
    const record = records.get(mediaId); assert(record, PENDING);
    assert(record.proof.operations.some(pair => sameOperationIdentity(pair.after, group)), PENDING);
    return record;
  };
  const memberApplied = async (group, ref, mediaId, proof) => {
    const asset = await assetFor(mediaId);
    if (!asset || !ref) {
      assert(!asset && !ref, PENDING); deletionFor(mediaId, group); return;
    }
    ownerScope(assetIdentity(asset), proof);
    assert(opKey(ref) === opKey(group) && ref.leaseExpiresAt === null && ref.updatedAt >= group.terminalAt
      && (ref.releasedAt === null || ref.releasedAt >= group.terminalAt));
    if (group.state === 'ABORTED') assert(ref.state === 'released' && ref.releaseOperationId === group.operationId && ref.releasedAt === group.terminalAt);
    else assert(group.state === 'COMMITTED' && (ref.state === 'bound' || ref.state === 'released' && group.version >= 2));
    if (asset.status === 'deleted') {
      deletionFor(mediaId, group); assert(ref.state === 'released');
    } else assert(asset.status === 'active' && !asset.privacyDeletionRecorded && asset.deletedAt == null && !asset.orphanRetirementId);
    if (ref.state === 'bound') assert(asset.status === 'active');
    if (group.state === 'COMMITTED' && ref.state === 'released' && ref.releaseOperationId === null) {
      const record = deletionFor(mediaId, group);
      assert(record.proof.receipts.some(receipt => receipt.bindingOperationId === group.operationId
        && receipt.resourceId === group.resourceId && receipt.releasedAt === ref.releasedAt));
    }
  };
  for (const { proof, current } of records.values()) {
    for (const group of current.groups) proveOperationVersionChain({ from: group, to: current.ledgers.get(opKey(group)), proofs });
    for (const ref of current.slots.values()) {
      const group = current.groups.find(value => opKey(value) === opKey(ref));
      if (group) {
        assert(group.references.some(item => item.mediaId === ref.mediaId));
        const effect = proof.referenceEffects.find(pair => slotKey(pair.after) === slotKey(ref) && opKey(pair.after) === opKey(ref));
        if (effect) assert(equal(effect.after, ref));
      } else assert(laterGroups.has(opKey(ref)), PENDING);
    }
    for (const group of current.groups) for (const item of group.references) {
      const ref = current.slots.get(slotKey({ ...group, ...item }));
      if (group.state === 'ABORTED' && group.version === 0) { assert(!ref || opKey(ref) !== opKey(group)); continue; }
      if (ref && opKey(ref) !== opKey(group)) {
        const captured = current.ledgers.get(opKey(ref));
        // C may retain a released historical A slot while reconstructing aborted B.
        // The captured A member is independently checked by its own group iteration.
        if (captured && captured.state === 'ABORTED' && group.state === 'ABORTED'
          && captured.terminalAt <= group.createdAt) {
          assert(ref.state === 'released');
          continue;
        }
        const later = captured || laterGroups.get(opKey(ref))?.group; assert(later, PENDING);
        const effect = proof.referenceEffects.find(pair => slotKey(pair.after) === slotKey(ref) && opKey(pair.after) === opKey(group));
        assert((effect?.after.releasedAt || group.terminalAt) <= later.createdAt);
      } else await memberApplied(current.ledgers.get(opKey(group)), ref, item.mediaId, proof);
    }
  }
  for (const { group, slots, proof } of laterGroups.values()) {
    for (const item of group.references) await memberApplied(group, slots.get(slotKey({ ...group, ...item })), item.mediaId, proof);
  }
};

const assertAudit = async (proof, r) => {
  const target = proof.tombstone.mediaId;
  const outboxes = await r.bounded('mediauserdeletionrecoveries', { $or: [{ mediaId: aliases(target) }, { _id: proof.evidenceId }] }, 2);
  assert(outboxes.length, PENDING); assert(outboxes.length === 1 && equal(outboxProof(outboxes[0]), proof));
  const tombstones = await r.bounded('mediadeletiontombstones', { $or: [{ mediaId: aliases(target) }, { _id: aliases(proof.tombstone._id) }] }, 2);
  assert(tombstones.length, PENDING); assert(tombstones.length === 1 && equal(tombSnapshot(tombstones[0]), proof.tombstone));
  const receipts = await r.bounded('mediadeletionreceipts', { $or: [{ mediaId: aliases(target) },
    { _id: { $in: proof.receipts.flatMap(row => [queryId(row._id), row._id]) } }] }, LIMITS.MAX_OPERATIONS);
  assert(equal(sortIds(receipts.map(receiptSnapshot)), proof.receipts));
  const guards = await r.bounded('completionuploadguards', { mediaId: aliases(target) }, 2);
  assert(guards.length, PENDING); assert(guards.length === 1);
  const guard = guards[0]; id(guard._id);
  assert(guard.state === 'RETIRED' && revision(guard.revision) && date(guard.createdAt) && date(guard.updatedAt) && guard.createdAt <= guard.updatedAt);
  assert(equal({ mediaId: id(guard.mediaId), familyId: id(guard.familyId), childId: id(guard.childId),
    storageKey: guard.storageKey, metadataHash: guard.metadataHash }, proof.uploadIdentity));
  const assets = await r.bounded('mediaassets', { _id: aliases(target) }, 2); assert(assets.length <= 1);
  const asset = assets[0];
  if (asset) assert(equal(assetIdentity(asset), proof.uploadIdentity) && asset.status === 'deleted' && asset.privacyDeletionRecorded === true
    && time(asset.deletedAt) === proof.tombstone.deletedAt && asset.createdAt <= asset.deletedAt
    && asset.deletedAt <= asset.updatedAt && !asset.orphanRetirementId);
  const retirements = await r.bounded('mediaorphanretirements', { mediaId: aliases(target) }, 2); assert(retirements.length <= 1);
  if (retirements.length) {
    const retirement = retirements[0]; id(retirement._id);
    assert(['CANDIDATE', 'FENCED', 'SUPERSEDED'].includes(retirement.state) && retirement.actorType === 'system'
      && retirement.retentionPolicyVersion === 1 && uuid(retirement.retirementId) && revision(retirement.revision)
      && date(retirement.createdAt) && date(retirement.orphanEligibleAt) && retirement.createdAt >= retirement.orphanEligibleAt
      && retirement.deletedAt == null && retirement.purgedAt == null && retirement.evidence == null
      && equal({ mediaId: id(retirement.mediaId), familyId: id(retirement.familyId), childId: id(retirement.childId),
        storageKey: retirement.storageKey, metadataHash: retirement.uploadMetadataHash }, proof.uploadIdentity));
  }
  return { asset };
};

const inspectRoot = async (mediaId, knownV2, journal, r) => {
  const session = journal.createReadSession(); assert(typeof session?.read === 'function', NOT_READY);
  const cache = createUserDeletionProofCache({ journal: { read: value => session.read(value) } });
  const candidate = await session.read(mediaId);
  const outboxes = await r.bounded('mediauserdeletionrecoveries', { mediaId: aliases(mediaId) }, 2);
  for (const row of outboxes) outboxProof(row);
  if (candidate === null) {
    assert(!knownV2 && outboxes.length === 0, PENDING);
    const legacy = await journal.readLegacy(mediaId); assert(legacy, PENDING);
    const tombs = await r.bounded('mediadeletiontombstones', { mediaId: aliases(mediaId) }, 2);
    assert(tombs.length, PENDING); assert(tombs.length === 1);
    const { _id, ...tombstone } = tombSnapshot(tombs[0]);
    const receipts = await r.bounded('mediadeletionreceipts', { mediaId: aliases(mediaId) }, legacy.receipts.length);
    const projected = receipts.map(receiptSnapshot).map(({ _id: ignored, ...row }) => row);
    const order = rows => [...rows].sort((a, b) => canonicalize(a).localeCompare(canonicalize(b)));
    assert(equal(legacy.tombstone, tombstone) && equal(order(legacy.receipts), order(projected)));
    return true;
  }
  const proof = await cache.read(mediaId);
  await assertAppliedClosure(proof, r, cache);
  return false;
};

const scanReadiness = async (options = {}) => {
  const counts = { v1Files: 0, v2Files: 0, outboxes: 0, tombstones: 0, legacyOnly: 0 }, reasons = new Set();
  let complete = false;
  try {
    const { connection, journal, writesPaused, mode = 'enabled' } = options;
    assert(writesPaused === true && ['enabled', 'recovery'].includes(mode), NOT_READY);
    assert(['read', 'createReadSession', 'inventory', 'readLegacy'].every(key => typeof journal?.[key] === 'function'), NOT_READY);
    const increment = key => { assert(counts[key] < Number.MAX_SAFE_INTEGER, NOT_READY); counts[key]++; };
    await assertPrerequisites({ connection, writesPaused }, SPECS);
    await assertCompletionPrivacyReadiness({ connection, writesPaused });
    const r = readers(connection.db);
    const inspectOne = async (mediaId, knownV2 = false, countLegacy = false) => {
      queryId(mediaId);
      if (await inspectRoot(mediaId, knownV2, journal, r)) {
        if (countLegacy) increment('legacyOnly');
        if (mode === 'recovery') reasons.add(LEGACY);
      }
    };
    for await (const entry of journal.inventory()) {
      assert(entry && Object.keys(entry).length === 2 && [1, 2].includes(entry.version)); queryId(entry.mediaId);
      increment(entry.version === 1 ? 'v1Files' : 'v2Files');
      await inspectOne(entry.mediaId, entry.version === 2, entry.version === 1);
    }
    await scan(connection.db, 'mediauserdeletionrecoveries', {}, undefined, async row => {
      increment('outboxes'); const proof = outboxProof(row); await inspectOne(proof.tombstone.mediaId, true);
    });
    await scan(connection.db, 'mediadeletiontombstones', {}, PROJECTIONS.mediadeletiontombstones, async row => {
      increment('tombstones'); const tomb = tombSnapshot(row); await inspectOne(tomb.mediaId);
    });
    complete = true;
  } catch (cause) { reasons.add(SAFE.has(cause?.code) ? cause.code : NOT_READY); }
  return { ready: false, complete, reasons: [...reasons].sort(), counts };
};
const assertUserDeletionRecoveryReadiness = async options => {
  const result = await scanReadiness(options);
  if (!result.complete || result.reasons.length) {
    const code = result.reasons.find(reason => reason !== LEGACY) || LEGACY;
    throw Object.assign(new Error(code), { code, complete: result.complete, reasons: result.reasons, counts: result.counts });
  }
  return { checked: true, scope: 'user-deletion-recovery', counts: result.counts };
};
const inspectUserDeletionRecovery = options => scanReadiness({ ...options, mode: 'recovery' });

module.exports = { assertUserDeletionRecoveryReadiness, inspectUserDeletionRecovery };
