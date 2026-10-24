const { assertMediaReferenceOperationReadiness } = require('./mediaReferenceOperationReadiness');

// Native reads only. Model imports could create indexes before the preflight checks them.
const FIELD = 'completionMediaIds';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/;
const READ = { maxTimeMS: 5000, readPreference: 'primary' };
const oid = value => value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function'
  && /^[0-9a-f]{24}(?![\s\S])/.test(value.toHexString());
const uuid = value => typeof value === 'string' && UUID.test(value);
const date = value => value instanceof Date && Number.isFinite(value.getTime());
const sameId = (a, b) => oid(a) && oid(b) && a.toHexString() === b.toHexString();
const sameTime = (a, b) => date(a) && date(b) && a.getTime() === b.getTime();
const sameKey = (a, b) => a && Object.keys(a).length === Object.keys(b).length
  && Object.keys(b).every(key => a[key] === b[key]);
const SCOPE = { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1 };
const SPECS = {
  ASSET: { name: 'mediaassets', key: { familyId: 1, storageKey: 1 },
    projection: { _id: 1, familyId: 1, childId: 1, purpose: 1, status: 1, deletedAt: 1, privacyDeletionRecorded: 1 } },
  REFERENCE: { name: 'mediareferences', key: { familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 },
    projection: { _id: 1, ...SCOPE, mediaId: 1, operationId: 1, state: 1, leaseExpiresAt: 1, releasedAt: 1, releaseOperationId: 1 } },
  TOMBSTONE: { name: 'mediadeletiontombstones', key: { mediaId: 1 },
    projection: { _id: 1, mediaId: 1, familyId: 1, childId: 1, actorId: 1, role: 1, purpose: 1, reason: 1, deletedAt: 1 } },
  RECEIPT: { name: 'mediadeletionreceipts', key: { familyId: 1, childId: 1, mediaId: 1,
    resourceType: 1, resourceId: 1, field: 1, bindingOperationId: 1 },
  projection: { _id: 1, ...SCOPE, mediaId: 1, bindingOperationId: 1, releasedAt: 1 } }
};
const fail = issues => {
  const error = new Error('Completion privacy readiness check failed');
  error.code = 'COMPLETION_PRIVACY_NOT_READY'; error.issues = [...new Set(issues)]; throw error;
};
const consume = async (cursor, visitor) => {
  try { for await (const row of cursor) await visitor(row); } finally { await cursor.close(); }
};
const scope = row => Object.fromEntries(Object.keys(SCOPE).map(key => [key, row[key]]));
const validScope = row => [row._id, row.familyId, row.childId, row.mediaId, row.resourceId].every(oid)
  && row.resourceType === 'growth_task' && row.field === FIELD;

const assertCompletionPrivacyReadiness = async ({ connection, writesPaused } = {}) => {
  if (writesPaused !== true) fail(['WRITES_NOT_PAUSED']);
  try { await assertMediaReferenceOperationReadiness({ connection, writesPaused }); }
  catch (_cause) { fail(['OPERATION_LEDGER_NOT_READY']); }
  const issues = new Set(), collections = {};
  try {
    for (const [kind, spec] of Object.entries(SPECS)) {
      const metadata = connection.db.listCollections({ name: spec.name }, { ...READ, nameOnly: false });
      let definition;
      try { definition = await metadata.next(); } finally { await metadata.close(); }
      if (!definition) fail([kind + '_COLLECTION_MISSING']);
      if (definition.options?.collation && definition.options.collation.locale !== 'simple') fail([kind + '_COLLATION_INVALID']);
      const cursor = connection.db.runCursorCommand({ listIndexes: spec.name, includeBuildUUIDs: true,
        cursor: { batchSize: 100 }, maxTimeMS: READ.maxTimeMS }, { readPreference: 'primary' });
      let indexes;
      try { indexes = await cursor.toArray(); } finally { await cursor.close(); }
      const valid = index => sameKey(index.key, spec.key) && index.unique === true && !index.sparse
        && index.partialFilterExpression === undefined && (!index.collation || index.collation.locale === 'simple');
      if (indexes.some(index => index.buildUUID !== undefined || index.spec !== undefined || index.indexBuildInfo !== undefined)) {
        issues.add(kind + '_INDEX_BUILD_IN_PROGRESS');
      }
      if (!indexes.some(valid)) issues.add(kind + '_INDEX_INVALID');
      if (indexes.some(index => index.expireAfterSeconds !== undefined)) issues.add(kind + '_TTL_FORBIDDEN');
      if (indexes.some(index => (index.unique === true || index.prepareUnique === true)
        && !sameKey(index.key, { _id: 1 }) && !valid(index))) issues.add(kind + '_UNEXPECTED_UNIQUE_INDEX');
      collections[kind] = connection.db.collection(spec.name);
    }
    if (issues.size) fail(issues);
    const one = (kind, filter) => collections[kind].findOne(filter, { ...READ, projection: SPECS[kind].projection });
    const scan = (kind, filter, visitor) => consume(collections[kind].find(filter, {
      ...READ, projection: SPECS[kind].projection, batchSize: 100
    }), visitor);
    const operationFor = row => connection.db.collection('mediareferenceoperations').findOne({ ...scope(row),
      operationId: row.bindingOperationId || row.operationId }, {
      ...READ, projection: { _id: 0, state: 1, references: 1 }
    });
    const includesMedia = (operation, row) => operation?.references.some(ref => sameId(ref.mediaId, row.mediaId) && ref.field === FIELD);
    const matchesAsset = (asset, tombstone) => sameId(asset._id, tombstone.mediaId)
      && sameId(asset.familyId, tombstone.familyId) && sameId(asset.childId, tombstone.childId)
      && asset.purpose === 'task_completion' && asset.status === 'deleted' && asset.privacyDeletionRecorded === true
      && sameTime(asset.deletedAt, tombstone.deletedAt);

    await scan('TOMBSTONE', {}, async tombstone => {
      if (![tombstone._id, tombstone.mediaId, tombstone.familyId, tombstone.childId, tombstone.actorId].every(oid)
        || !['parent', 'student'].includes(tombstone.role) || tombstone.purpose !== 'task_completion'
        || tombstone.reason !== 'user_requested' || !date(tombstone.deletedAt)
        || (tombstone.role === 'student' && !sameId(tombstone.actorId, tombstone.childId))) {
        issues.add('TOMBSTONE_INVALID'); return;
      }
      const asset = await one('ASSET', { _id: tombstone.mediaId });
      if (asset && !matchesAsset(asset, tombstone)) issues.add('DELETED_ASSET_INVALID');
      await scan('REFERENCE', { mediaId: tombstone.mediaId }, async reference => {
        if (!asset || !validScope(reference) || !sameId(reference.familyId, tombstone.familyId)
          || !sameId(reference.childId, tombstone.childId) || reference.state !== 'released'
          || reference.leaseExpiresAt != null || !date(reference.releasedAt) || !uuid(reference.operationId)
          || (reference.releaseOperationId != null && !uuid(reference.releaseOperationId))) {
          issues.add('DELETED_REFERENCE_INVALID'); return;
        }
        const operation = await operationFor(reference);
        if (!includesMedia(operation, reference) || !['COMMITTED', 'ABORTED'].includes(operation.state)
          || (operation.state === 'ABORTED' && reference.releaseOperationId !== reference.operationId)) {
          issues.add('DELETED_REFERENCE_INVALID'); return;
        }
        // A normal unbind or an aborted prepared group is not a privacy deletion receipt.
        if (reference.releaseOperationId == null) {
          const receipt = await one('RECEIPT', { ...scope(reference), mediaId: reference.mediaId,
            bindingOperationId: reference.operationId });
          if (!receipt || operation.state !== 'COMMITTED' || !sameTime(receipt.releasedAt, reference.releasedAt)) {
            issues.add('DELETED_REFERENCE_INVALID');
          }
        }
      });
    });
    await scan('RECEIPT', {}, async receipt => {
      if (!validScope(receipt) || !uuid(receipt.bindingOperationId) || !date(receipt.releasedAt)) {
        issues.add('RECEIPT_INVALID'); return;
      }
      // Cleanup removes current references, but must not hide ambiguous historical proofs.
      const conflicting = await one('RECEIPT', { ...scope(receipt), mediaId: receipt.mediaId,
        bindingOperationId: { $ne: receipt.bindingOperationId } });
      if (conflicting) issues.add('RECEIPT_GENERATION_CONFLICT');
      const tombstone = await one('TOMBSTONE', { mediaId: receipt.mediaId });
      const operation = await operationFor(receipt);
      if (!tombstone || !sameId(tombstone.familyId, receipt.familyId) || !sameId(tombstone.childId, receipt.childId)
        || operation?.state !== 'COMMITTED' || !includesMedia(operation, receipt)) issues.add('RECEIPT_LINK_INVALID');
      const asset = await one('ASSET', { _id: receipt.mediaId });
      const reference = await one('REFERENCE', { ...scope(receipt), mediaId: receipt.mediaId });
      if (asset && (!reference || reference.operationId !== receipt.bindingOperationId || reference.state !== 'released'
        || reference.releaseOperationId != null || !sameTime(reference.releasedAt, receipt.releasedAt))) {
        issues.add('RECEIPT_LINK_INVALID');
      }
    });
    await scan('ASSET', { privacyDeletionRecorded: true }, async asset => {
      const tombstone = await one('TOMBSTONE', { mediaId: asset._id });
      if (!oid(asset._id) || !tombstone || !matchesAsset(asset, tombstone)) issues.add('DELETED_ASSET_INVALID');
    });
    // Lost tombstones/markers must not hide a surviving privacy-release signature.
    await scan('REFERENCE', { field: FIELD, state: 'released', releaseOperationId: null }, async reference => {
      if (!validScope(reference) || !uuid(reference.operationId)) { issues.add('DELETED_REFERENCE_INVALID'); return; }
      const tombstone = await one('TOMBSTONE', { mediaId: reference.mediaId });
      const receipt = await one('RECEIPT', { ...scope(reference), mediaId: reference.mediaId, bindingOperationId: reference.operationId });
      if (!tombstone || !receipt) issues.add('DELETED_REFERENCE_INVALID');
    });
  } catch (error) {
    if (error?.code === 'COMPLETION_PRIVACY_NOT_READY') throw error;
    fail(['READINESS_QUERY_FAILED']);
  }
  if (issues.size) fail(issues);
  return { ready: true, service: 'resource-service', protocol: 'task-completion-v1', scope: 'privacy-evidence' };
};

module.exports = { assertCompletionPrivacyReadiness };
