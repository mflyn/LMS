const { assertCompletionPrivacyReadiness } = require('./completionPrivacyReadiness');
const { validateSystemRetirement } = require('./completionRetentionReadiness');

// Native reads only; callers must keep protocol writes paused for the whole preflight.
const FIELD = 'completionMediaIds';
const READ = { maxTimeMS: 5000, readPreference: 'primary' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/;
const oid = value => value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function'
  && /^[0-9a-f]{24}(?![\s\S])/.test(value.toHexString());
const uuid = value => typeof value === 'string' && UUID.test(value);
const date = value => value instanceof Date && Number.isFinite(value.getTime());
const sameId = (a, b) => oid(a) && oid(b) && a.toHexString() === b.toHexString();
const sameDate = (a, b) => date(a) && date(b) && a.getTime() === b.getTime();
const SCOPE = { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1 };
const scope = row => Object.fromEntries(Object.keys(SCOPE).map(key => [key, row[key]]));
const PROJECTIONS = {
  mediareferences: { _id: 1, ...SCOPE, mediaId: 1, operationId: 1, state: 1,
    leaseExpiresAt: 1, releasedAt: 1, releaseOperationId: 1 },
  mediareferenceoperations: { _id: 1, ...SCOPE, operationId: 1, state: 1, references: 1, leaseExpiresAt: 1 },
  mediaassets: { _id: 1, familyId: 1, childId: 1, purpose: 1, status: 1, mimeType: 1,
    deletedAt: 1, privacyDeletionRecorded: 1, orphanRetirementId: 1 },
  mediadeletiontombstones: { _id: 1, familyId: 1, childId: 1 }
};
const fail = issues => {
  const error = new Error('Completion reference readiness check failed');
  error.code = 'COMPLETION_REFERENCES_NOT_READY'; error.issues = [...new Set(issues)]; throw error;
};
const validReference = row => [row._id, row.familyId, row.childId, row.resourceId, row.mediaId].every(oid)
  && row.resourceType === 'growth_task' && row.field === FIELD && uuid(row.operationId)
  && ['prepared', 'bound', 'released'].includes(row.state)
  && (row.state === 'prepared' ? date(row.leaseExpiresAt) : row.leaseExpiresAt == null)
  && (row.state === 'released' ? date(row.releasedAt) && (row.releaseOperationId == null || uuid(row.releaseOperationId))
    : row.releasedAt == null && row.releaseOperationId == null);

const assertCompletionReferenceReadiness = async ({ connection, writesPaused, journal, retirementClient,
  allowMissingDeletedJournal = false } = {}) => {
  if (writesPaused !== true) fail(['WRITES_NOT_PAUSED']);
  try { await assertCompletionPrivacyReadiness({ connection, writesPaused }); }
  catch (_cause) { fail(['PRIVACY_EVIDENCE_NOT_READY']); }
  const issues = new Set();
  try {
    const one = (name, filter) => connection.db.collection(name).findOne(filter, {
      ...READ, projection: PROJECTIONS[name]
    });
    const scan = async (name, filter, visitor) => {
      const cursor = connection.db.collection(name).find(filter, { ...READ, projection: PROJECTIONS[name], batchSize: 100 });
      try { for await (const row of cursor) await visitor(row); } finally { await cursor.close(); }
    };
    await scan('mediareferences', { field: FIELD }, async row => {
      if (!validReference(row)) { issues.add('REFERENCE_INVALID'); return; }
      const asset = await one('mediaassets', { _id: row.mediaId });
      let sameSystemEvidence = false;
      if (row.state === 'released' && asset?.status === 'deleted' && asset.orphanRetirementId != null) {
        try { sameSystemEvidence = await validateSystemRetirement({ connection, writesPaused, mediaId: row.mediaId,
          journal, retirementClient, allowMissingDeletedJournal }); }
        catch (_cause) { issues.add('REFERENCE_ASSET_INVALID'); }
      }
      if (!asset || !sameId(asset.familyId, row.familyId) || !sameId(asset.childId, row.childId)
        || asset.purpose !== 'task_completion' || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
        || !['active', 'deleted'].includes(asset.status)
        || (asset.status === 'active' && (asset.deletedAt != null || asset.orphanRetirementId != null
          || (asset.privacyDeletionRecorded != null && asset.privacyDeletionRecorded !== false)))
        || (row.state !== 'released' && asset.status !== 'active')
        || (asset.status === 'deleted' && asset.privacyDeletionRecorded !== true && !sameSystemEvidence)) issues.add('REFERENCE_ASSET_INVALID');
      const operation = await one('mediareferenceoperations', { ...scope(row), operationId: row.operationId });
      if (!operation || !operation.references.some(ref => sameId(ref.mediaId, row.mediaId) && ref.field === FIELD)
        || (row.state === 'prepared' && (operation.state !== 'PREPARED' || !sameDate(row.leaseExpiresAt, operation.leaseExpiresAt)))
        || (row.state === 'bound' && operation.state !== 'COMMITTED')
        || (row.state === 'released' && (!['COMMITTED', 'ABORTED'].includes(operation.state)
          || (operation.state === 'ABORTED' && row.releaseOperationId !== row.operationId)))) {
        issues.add('REFERENCE_OPERATION_INVALID');
      }
    });
    await scan('mediareferenceoperations', { state: { $in: ['PREPARED', 'COMMITTED'] } }, async operation => {
      for (const item of operation.references) {
        const row = await one('mediareferences', { ...scope(operation), mediaId: item.mediaId });
        if (operation.state === 'PREPARED') {
          if (!row || row.operationId !== operation.operationId || row.state !== 'prepared'
            || !sameDate(row.leaseExpiresAt, operation.leaseExpiresAt)) issues.add('OPERATION_REFERENCE_SET_INVALID');
        } else if (!row) {
          // Historical commits may be superseded, or cleaned with the deleted asset, never silently lost.
          const asset = await one('mediaassets', { _id: item.mediaId });
          const tombstone = await one('mediadeletiontombstones', { mediaId: item.mediaId });
          if (asset || !tombstone || !sameId(tombstone.familyId, operation.familyId)
            || !sameId(tombstone.childId, operation.childId)) issues.add('OPERATION_REFERENCE_SET_INVALID');
        }
      }
    });
  } catch (_cause) { fail(['READINESS_QUERY_FAILED']); }
  if (issues.size) fail(issues);
  return { ready: true, service: 'resource-service', protocol: 'task-completion-v1', scope: 'reference-consistency' };
};

module.exports = { assertCompletionReferenceReadiness };
