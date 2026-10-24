const { createHash } = require('crypto');
const { isDeepStrictEqual } = require('util');
const { assertCompletionPrivacyReadiness } = require('./completionPrivacyReadiness');
const { oid, uuid, storageKey, hash, date, sameId, sameDate, revision, sameScope,
  fail, scan, one, assertPrerequisites } = require('../../../common/services/completionRetentionReadinessHelpers');

const FIELD = 'completionMediaIds';
const SCOPE = { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1 };
const SPECS = {
  completionuploadguards: { unique: [{ mediaId: 1 }] },
  mediaorphanretirements: { unique: [{ mediaId: 1 }] },
  mediaassets: { unique: [{ familyId: 1, storageKey: 1 }],
    indexes: [{ purpose: 1, status: 1, retentionPolicyVersion: 1, orphanEligibleAt: 1 },
      { purpose: 1, status: 1, retentionPolicyVersion: 1, orphanLastCheckedAt: 1, _id: 1, orphanEligibleAt: 1 }] },
  mediareferenceoperations: { unique: [{ ...SCOPE, operationId: 1 }], indexes: [{ 'references.mediaId': 1, _id: 1 }] },
  mediareferences: { unique: [{ familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 }] },
  mediadeletiontombstones: { unique: [{ mediaId: 1 }] },
  mediadeletionreceipts: { unique: [{ familyId: 1, childId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1, bindingOperationId: 1 }] }
};
const PROJECTIONS = {
  completionuploadguards: { _id: 1, familyId: 1, childId: 1, mediaId: 1, storageKey: 1, metadataHash: 1,
    state: 1, revision: 1, createdAt: 1, updatedAt: 1 },
  mediaorphanretirements: { _id: 1, mediaId: 1, familyId: 1, childId: 1, storageKey: 1, uploadMetadataHash: 1,
    retirementId: 1, retentionPolicyVersion: 1, orphanEligibleAt: 1, actorType: 1, state: 1, revision: 1,
    createdAt: 1, deletedAt: 1, purgedAt: 1, evidence: 1 },
  mediaassets: { _id: 1, familyId: 1, childId: 1, uploadedBy: 1, purpose: 1, mimeType: 1, sizeBytes: 1, pageCount: 1,
    storageKey: 1, malwareScanStatus: 1, malwareScannedAt: 1, status: 1, privacyDeletionRecorded: 1,
    retentionPolicyVersion: 1, orphanEligibleAt: 1, orphanLastCheckedAt: 1, orphanRetirementId: 1, deletedAt: 1 },
  mediareferenceoperations: { _id: 1, ...SCOPE, operationId: 1, commandHash: 1, referenceSetHash: 1,
    references: 1, state: 1, version: 1, leaseExpiresAt: 1, terminalAt: 1, failureCode: 1 },
  mediareferences: { _id: 1, ...SCOPE, mediaId: 1, operationId: 1, releaseOperationId: 1,
    state: 1, leaseExpiresAt: 1, releasedAt: 1 },
  mediadeletiontombstones: { _id: 1, mediaId: 1, familyId: 1, childId: 1, purpose: 1, reason: 1, deletedAt: 1 },
  mediadeletionreceipts: { _id: 1 }
};
const read = (db, name, filter) => one(db, name, filter, PROJECTIONS[name]);
const visit = (db, name, filter, callback) => scan(db, name, filter, PROJECTIONS[name], callback);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const scope = row => Object.fromEntries(Object.keys(SCOPE).map(key => [key, row[key]]));
const validUploadGuard = row => row && [row._id, row.mediaId, row.familyId, row.childId].every(oid)
  && storageKey(row.storageKey) && hash(row.metadataHash) && revision(row.revision)
  && ['REGISTERED', 'RETIRED'].includes(row.state) && date(row.createdAt) && date(row.updatedAt)
  && row.updatedAt >= row.createdAt;
const validRetirement = row => row && [row._id, row.mediaId, row.familyId, row.childId].every(oid)
  && uuid(row.retirementId) && storageKey(row.storageKey) && hash(row.uploadMetadataHash)
  && row.retentionPolicyVersion === 1 && row.actorType === 'system' && revision(row.revision)
  && date(row.orphanEligibleAt) && date(row.createdAt) && row.createdAt >= row.orphanEligibleAt
  && ['CANDIDATE', 'FENCED', 'DELETED', 'PURGED', 'SUPERSEDED'].includes(row.state)
  && (['DELETED', 'PURGED'].includes(row.state)
    ? date(row.deletedAt) && row.deletedAt >= row.createdAt && row.evidence != null
    : row.deletedAt == null && row.evidence == null)
  && (row.state === 'PURGED' ? date(row.purgedAt) && row.purgedAt >= row.deletedAt : row.purgedAt == null);
const metadataHash = asset => {
  if (![asset._id, asset.familyId, asset.childId, asset.uploadedBy].every(oid)
    || asset.purpose !== 'task_completion' || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
    || !Number.isFinite(asset.sizeBytes) || asset.sizeBytes < 1 || asset.sizeBytes > 10 * 1024 * 1024
    || asset.pageCount != null || !storageKey(asset.storageKey)
    || !['legacy_unscanned', 'skipped_trusted_local', 'clean'].includes(asset.malwareScanStatus)
    || (asset.malwareScanStatus === 'clean' ? !date(asset.malwareScannedAt) : asset.malwareScannedAt != null)) return null;
  return digest({ familyId: String(asset.familyId), childId: String(asset.childId), uploadedBy: String(asset.uploadedBy),
    purpose: asset.purpose, mimeType: asset.mimeType, displayName: 'task-completion', sizeBytes: asset.sizeBytes,
    pageCount: asset.pageCount ?? null, storageKey: asset.storageKey, malwareScanStatus: asset.malwareScanStatus,
    malwareScannedAt: asset.malwareScannedAt == null ? null : asset.malwareScannedAt.toISOString() });
};
const matchingAsset = (asset, record) => asset && sameId(asset._id, record.mediaId) && sameScope(asset, record)
  && (asset.orphanLastCheckedAt == null || date(asset.orphanLastCheckedAt))
  && asset.storageKey === record.storageKey && metadataHash(asset) === record.uploadMetadataHash
  && asset.retentionPolicyVersion === 1 && sameDate(asset.orphanEligibleAt, record.orphanEligibleAt);
const retirementSnapshot = r => ({ mediaId: String(r.mediaId), familyId: String(r.familyId), childId: String(r.childId),
  retirementId: r.retirementId, storageKey: r.storageKey, retentionPolicyVersion: r.retentionPolicyVersion,
  uploadMetadataHash: r.uploadMetadataHash, orphanEligibleAt: r.orphanEligibleAt.toISOString(), actorType: r.actorType,
  createdAt: r.createdAt.toISOString(), deletedAt: r.deletedAt.toISOString() });
const operationSnapshot = op => ({ _id: String(op._id), familyId: String(op.familyId), childId: String(op.childId),
  resourceId: String(op.resourceId), resourceType: op.resourceType, field: op.field, operationId: op.operationId,
  commandHash: op.commandHash, referenceSetHash: op.referenceSetHash,
  references: op.references.map(ref => ({ mediaId: String(ref.mediaId), field: ref.field })), state: op.state,
  version: op.version, leaseExpiresAt: null, terminalAt: op.terminalAt.toISOString(), failureCode: op.failureCode });
const referenceSnapshot = ref => ({ _id: String(ref._id), familyId: String(ref.familyId), childId: String(ref.childId),
  mediaId: String(ref.mediaId), resourceType: ref.resourceType, resourceId: String(ref.resourceId), field: ref.field,
  operationId: ref.operationId, releaseOperationId: ref.releaseOperationId, state: ref.state,
  leaseExpiresAt: null, releasedAt: ref.releasedAt.toISOString() });
const validOperation = (op, record) => {
  if (![op._id, op.familyId, op.childId, op.resourceId].every(oid) || !sameScope(op, record)
    || op.resourceType !== 'growth_task' || op.field !== FIELD || !uuid(op.operationId)
    || !hash(op.commandHash) || !hash(op.referenceSetHash) || op.state !== 'ABORTED'
    || !Number.isSafeInteger(op.version) || op.version < 0 || op.leaseExpiresAt !== null || !date(op.terminalAt)
    || typeof op.failureCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}(?![\s\S])/.test(op.failureCode)
    || !Array.isArray(op.references) || op.references.length < 1 || op.references.length > 10
    || !op.references.every(ref => exactKeys(ref, ['mediaId', 'field']) && oid(ref.mediaId) && ref.field === FIELD)) return false;
  const refs = op.references.map(ref => ({ mediaId: String(ref.mediaId), field: FIELD }));
  return refs.some(ref => ref.mediaId === String(record.mediaId)) && new Set(refs.map(ref => ref.mediaId)).size === refs.length
    && isDeepStrictEqual(refs, [...refs].sort((a, b) => a.mediaId.localeCompare(b.mediaId))) && digest(refs) === op.referenceSetHash;
};
const validReference = (row, record, operations) => {
  if (![row._id, row.familyId, row.childId, row.mediaId, row.resourceId].every(oid) || !sameScope(row, record)
    || !sameId(row.mediaId, record.mediaId) || row.resourceType !== 'growth_task' || row.field !== FIELD
    || row.state !== 'released' || row.leaseExpiresAt !== null || !date(row.releasedAt) || !uuid(row.operationId)
    || row.releaseOperationId !== row.operationId) return false;
  const op = operations.find(item => item.operationId === row.operationId && sameId(item.resourceId, row.resourceId));
  return Boolean(op && sameDate(row.releasedAt, op.terminalAt));
};
const assertStatus = async (record, retirementClient) => {
  const body = { familyId: String(record.familyId), childId: String(record.childId), mediaId: String(record.mediaId), retirementId: record.retirementId };
  try {
    if (typeof retirementClient?.status !== 'function') throw Error();
    const result = await retirementClient.status(body);
    if (!exactKeys(result, [...Object.keys(body), 'state']) || result.state !== 'retired'
      || Object.keys(body).some(key => result[key] !== body[key])) throw Error();
  } catch (_cause) { fail(['RETIREMENT_STATUS_UNAVAILABLE']); }
};
const inspectReferences = async (db, record) => {
  const operations = [], references = [];
  // Include the textual alias only to detect corrupt native identities, never to accept/cast them.
  const mediaIdentity = { $in: [record.mediaId, String(record.mediaId)] };
  await visit(db, 'mediareferenceoperations', { 'references.mediaId': mediaIdentity }, async op => {
    if (!validOperation(op, record)) fail(['SYSTEM_EVIDENCE_INVALID']); operations.push(op);
  });
  operations.sort((a, b) => String(a._id).localeCompare(String(b._id)));
  await visit(db, 'mediareferences', { mediaId: mediaIdentity }, async row => {
    if (!validReference(row, record, operations)) fail(['SYSTEM_EVIDENCE_INVALID']); references.push(row);
  });
  references.sort((a, b) => String(a._id).localeCompare(String(b._id)));
  if (await read(db, 'mediadeletionreceipts', { mediaId: mediaIdentity })) fail(['SYSTEM_EVIDENCE_INVALID']);
  return { operations, references };
};
const assertFrozenEvidence = async (db, record, proof) => {
  const evidence = record.evidence;
  if (!exactKeys(evidence, ['version', 'retirement', 'operations', 'references']) || evidence.version !== 1
    || !isDeepStrictEqual(evidence.retirement, retirementSnapshot(record))
    || !Array.isArray(evidence.operations) || !Array.isArray(evidence.references)) fail(['SYSTEM_EVIDENCE_INVALID']);
  const recorded = new Map(evidence.operations.map(op => [op?._id, op]));
  const current = new Map(proof.operations.map(op => [String(op._id), op]));
  if (recorded.size !== evidence.operations.length || evidence.operations.some(op => !op || !current.has(op._id)
    || !isDeepStrictEqual(op, operationSnapshot(current.get(op._id))) || current.get(op._id).terminalAt > record.deletedAt)
    || !isDeepStrictEqual(evidence.operations.map(op => op._id), [...recorded.keys()].sort())) fail(['SYSTEM_EVIDENCE_INVALID']);
  for (const op of proof.operations.filter(item => !recorded.has(String(item._id)))) {
    if (op.version !== 0 || !['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(op.failureCode)
      || op.terminalAt < record.deletedAt || await read(db, 'mediareferences', { ...scope(op), operationId: op.operationId })) {
      fail(['SYSTEM_EVIDENCE_INVALID']);
    }
  }
  // PURGED no longer has current rows: independently validate the entire frozen released set.
  const ids = new Set(), slots = new Set();
  for (const ref of evidence.references) {
    const op = evidence.operations.find(item => item.operationId === ref?.operationId && item.resourceId === ref?.resourceId);
    if (!exactKeys(ref, ['_id', 'familyId', 'childId', 'mediaId', 'resourceType', 'resourceId', 'field', 'operationId',
      'releaseOperationId', 'state', 'leaseExpiresAt', 'releasedAt']) || !op || typeof ref._id !== 'string'
      || !/^[0-9a-f]{24}(?![\s\S])/.test(ref._id) || ids.has(ref._id)
      || ref.familyId !== String(record.familyId) || ref.childId !== String(record.childId) || ref.mediaId !== String(record.mediaId)
      || ref.resourceType !== 'growth_task' || ref.field !== FIELD || ref.state !== 'released' || ref.leaseExpiresAt !== null
      || ref.releaseOperationId !== op.operationId || ref.releasedAt !== op.terminalAt || slots.has(ref.resourceId)) fail(['SYSTEM_EVIDENCE_INVALID']);
    ids.add(ref._id); slots.add(ref.resourceId);
  }
  if (!isDeepStrictEqual([...ids], [...ids].sort())) fail(['SYSTEM_EVIDENCE_INVALID']);
  for (const op of evidence.operations.filter(item => item.version > 0)) {
    const last = evidence.references.find(ref => ref.resourceId === op.resourceId);
    if (!last || Date.parse(last.releasedAt) < Date.parse(op.terminalAt)) fail(['SYSTEM_EVIDENCE_INVALID']);
  }
};

// Shared by T1's narrow system-deleted exception; never calls T1 or imports runtime models.
// Invalid evidence throws a sanitized readiness error; only a completely verified record returns true.
const validateSystemRetirement = async ({ connection, writesPaused, mediaId, journal, retirementClient,
  allowMissingDeletedJournal = false } = {}) => {
  if (writesPaused !== true) fail(['WRITES_NOT_PAUSED']);
  try {
    if (!oid(mediaId)) fail(['SYSTEM_EVIDENCE_INVALID']);
    const db = connection.db, record = await read(db, 'mediaorphanretirements', { mediaId });
    if (!validRetirement(record) || !['DELETED', 'PURGED'].includes(record.state)) fail(['SYSTEM_EVIDENCE_INVALID']);
    const guard = await read(db, 'completionuploadguards', { mediaId });
    if (!validUploadGuard(guard) || guard.state !== 'RETIRED' || !sameScope(guard, record)
      || guard.storageKey !== record.storageKey || guard.metadataHash !== record.uploadMetadataHash
      || await read(db, 'mediadeletiontombstones', { mediaId: { $in: [mediaId, String(mediaId)] } })) fail(['SYSTEM_EVIDENCE_INVALID']);
    const asset = await read(db, 'mediaassets', { _id: mediaId }), proof = await inspectReferences(db, record);
    await assertFrozenEvidence(db, record, proof);
    if (record.state === 'PURGED') {
      if (asset || proof.references.length) fail(['SYSTEM_EVIDENCE_INVALID']);
    } else if (!matchingAsset(asset, record) || asset.status !== 'deleted'
      || (asset.privacyDeletionRecorded != null && asset.privacyDeletionRecorded !== false)
      || asset.orphanRetirementId !== record.retirementId || !sameDate(asset.deletedAt, record.deletedAt)
      || !isDeepStrictEqual(proof.references.map(referenceSnapshot), record.evidence.references)) fail(['SYSTEM_EVIDENCE_INVALID']);
    try {
      if (typeof journal?.read !== 'function') throw Error();
      const durableEvidence = await journal.read(String(mediaId));
      // Only an explicit cleanup recovery probe may proceed to retry journal persistence.
      // An unavailable/corrupt reader never proves absence, and PURGED always needs durable proof.
      const recoverableGap = allowMissingDeletedJournal === true && record.state === 'DELETED' && durableEvidence === null;
      if (!recoverableGap && !isDeepStrictEqual(durableEvidence, record.evidence)) throw Error();
    } catch (_cause) { fail(['SYSTEM_JOURNAL_INVALID']); }
    await assertStatus(record, retirementClient);
    return true;
  } catch (cause) {
    if (cause?.code === 'COMPLETION_RETENTION_NOT_READY') throw cause;
    fail(['READINESS_QUERY_FAILED']);
  }
};

const assertCompletionRetentionReadiness = async ({ connection, writesPaused, journal, retirementClient,
  allowMissingDeletedJournal = false, allowSupersededRetirementRecovery = false } = {}) => {
  await assertPrerequisites({ connection, writesPaused }, SPECS);
  const db = connection.db, issues = new Set();
  try {
    await visit(db, 'completionuploadguards', {}, async guard => {
      if (!validUploadGuard(guard)) { issues.add('UPLOAD_GUARD_INVALID'); return; }
      const asset = await read(db, 'mediaassets', { _id: guard.mediaId });
      if (guard.state === 'REGISTERED' && !asset
        || asset && (!sameScope(asset, guard) || asset.storageKey !== guard.storageKey || metadataHash(asset) !== guard.metadataHash
          || !['active', 'deleted'].includes(asset.status) || (asset.status === 'deleted') !== (guard.state === 'RETIRED'))) {
        issues.add('UPLOAD_GUARD_INVALID');
      }
      if (guard.state === 'RETIRED') {
        const record = await read(db, 'mediaorphanretirements', { mediaId: guard.mediaId });
        const tombstone = await read(db, 'mediadeletiontombstones', { mediaId: guard.mediaId });
        const system = validRetirement(record) && ['DELETED', 'PURGED'].includes(record.state) && sameScope(record, guard)
          && record.storageKey === guard.storageKey && record.uploadMetadataHash === guard.metadataHash;
        const user = tombstone && oid(tombstone._id) && sameId(tombstone.mediaId, guard.mediaId) && sameScope(tombstone, guard)
          && tombstone.purpose === 'task_completion' && tombstone.reason === 'user_requested' && date(tombstone.deletedAt);
        if (!system && !user) issues.add('UPLOAD_GUARD_INVALID');
      }
    });
    await visit(db, 'mediaorphanretirements', {}, async record => {
      if (!validRetirement(record)) { issues.add('RETIREMENT_INVALID'); return; }
      if (['DELETED', 'PURGED'].includes(record.state)) {
        await validateSystemRetirement({ connection, writesPaused, mediaId: record.mediaId, journal, retirementClient, allowMissingDeletedJournal }); return;
      }
      const asset = await read(db, 'mediaassets', { _id: record.mediaId });
      const tombstone = await read(db, 'mediadeletiontombstones', { mediaId: record.mediaId });
      if (allowSupersededRetirementRecovery === true && ['CANDIDATE', 'FENCED'].includes(record.state) && tombstone) {
        const guard = await read(db, 'completionuploadguards', { mediaId: record.mediaId });
        if (!validUploadGuard(guard) || guard.state !== 'RETIRED' || !sameScope(guard, record)
          || guard.storageKey !== record.storageKey || guard.metadataHash !== record.uploadMetadataHash
          || !sameId(tombstone.mediaId, record.mediaId) || !sameScope(tombstone, record)
          || tombstone.purpose !== 'task_completion' || tombstone.reason !== 'user_requested' || !date(tombstone.deletedAt)
          || asset && (!matchingAsset(asset, record) || asset.status !== 'deleted' || asset.privacyDeletionRecorded !== true
            || asset.orphanRetirementId != null || !sameDate(asset.deletedAt, tombstone.deletedAt))) fail(['USER_DELETION_EVIDENCE_INVALID']);
        // A user deletion may win before the GC records SUPERSEDED. Validate its entire
        // native audit/reference/receipt chain; this probe does not perform that transition.
        try { await assertCompletionPrivacyReadiness({ connection, writesPaused }); }
        catch (_cause) { fail(['USER_DELETION_EVIDENCE_INVALID']); }
        // Proven user deletion supersedes this attempt locally, even if homework is offline.
        return;
      }
      if (record.state === 'SUPERSEDED') {
        if (!tombstone || !sameScope(tombstone, record) || tombstone.reason !== 'user_requested'
          || tombstone.purpose !== 'task_completion' || !date(tombstone.deletedAt)
          || asset && (!matchingAsset(asset, record) || asset.status !== 'deleted' || asset.privacyDeletionRecorded !== true
            || asset.orphanRetirementId != null || !sameDate(asset.deletedAt, tombstone.deletedAt))) issues.add('RETIREMENT_INVALID');
      } else {
        if (tombstone || !matchingAsset(asset, record) || asset.status !== 'active' || asset.orphanRetirementId != null
          || asset.deletedAt != null || (asset.privacyDeletionRecorded != null && asset.privacyDeletionRecorded !== false)) issues.add('RETIREMENT_INVALID');
        if (record.state === 'FENCED') { await inspectReferences(db, record); await assertStatus(record, retirementClient); }
      }
    });
    await visit(db, 'mediaassets', { $or: [{ purpose: 'task_completion' }, { orphanRetirementId: { $exists: true } }] }, async asset => {
      if (![asset._id, asset.familyId, asset.childId].every(oid)) { issues.add('ASSET_RETENTION_INVALID'); return; }
      if (asset.orphanLastCheckedAt != null && !date(asset.orphanLastCheckedAt)) issues.add('ASSET_RETENTION_INVALID');
      if (asset.orphanRetirementId != null) {
        if (asset.status !== 'deleted') { issues.add('SYSTEM_EVIDENCE_INVALID'); return; }
        await validateSystemRetirement({ connection, writesPaused, mediaId: asset._id, journal, retirementClient, allowMissingDeletedJournal });
      } else if (asset.status === 'deleted') {
        const tombstone = await read(db, 'mediadeletiontombstones', { mediaId: asset._id });
        if (!tombstone || !sameScope(tombstone, asset) || asset.privacyDeletionRecorded !== true
          || !sameDate(asset.deletedAt, tombstone.deletedAt)) issues.add('SYSTEM_EVIDENCE_INVALID');
      }
      if ((asset.retentionPolicyVersion != null || asset.orphanEligibleAt != null)
        && (asset.retentionPolicyVersion !== 1 || !date(asset.orphanEligibleAt))) issues.add('ASSET_RETENTION_INVALID');
    });
  } catch (cause) {
    if (cause?.code === 'COMPLETION_RETENTION_NOT_READY') for (const issue of cause.issues) issues.add(issue);
    else issues.add('READINESS_QUERY_FAILED');
  }
  if (issues.size) fail(issues);
  return { ready: true, service: 'resource-service', protocol: 'task-completion-v1',
    scope: allowMissingDeletedJournal === true || allowSupersededRetirementRecovery === true
      ? 'completion-retention-recovery' : 'completion-retention' };
};

module.exports = { assertCompletionRetentionReadiness, validateSystemRetirement };
