const { oid, uuid, date, revision, fail, scan, one, assertPrerequisites } = require('../../../common/services/completionRetentionReadinessHelpers');

const GUARD = 'completionmediaguards';
const SPECS = { [GUARD]: { unique: [{ familyId: 1, childId: 1, mediaId: 1 }] }, growthtasks: {} };
const PROJECTION = { _id: 1, familyId: 1, childId: 1, mediaId: 1, state: 1, revision: 1,
  retirementId: 1, retiredAt: 1, createdAt: 1, updatedAt: 1 };
const USAGE = ['completionEvidence.completionMediaIds', 'completionMediaBindings.mediaId',
  'completionPending.mediaIds', 'completionPending.previousBindings.mediaId',
  'completionPending.additionIds', 'completionPending.removalBindings.mediaId'];
const validGuard = row => [row._id, row.familyId, row.childId, row.mediaId].every(oid)
  && revision(row.revision) && date(row.createdAt) && date(row.updatedAt) && row.updatedAt >= row.createdAt
  && ['available', 'retired'].includes(row.state)
  && (row.state === 'retired' ? uuid(row.retirementId) && date(row.retiredAt) && row.retiredAt >= row.createdAt
    : row.retirementId == null && row.retiredAt == null);

const assertCompletionMediaGuardReadiness = async ({ connection, writesPaused } = {}) => {
  await assertPrerequisites({ connection, writesPaused }, SPECS);
  const issues = new Set();
  try {
    await scan(connection.db, GUARD, {}, PROJECTION, async guard => {
      if (!validGuard(guard)) { issues.add('MEDIA_GUARD_INVALID'); return; }
      if (guard.state !== 'retired') return;
      // No status/date filter: cancelled, archived and unpublished intents retain ownership.
      // Text aliases are rejection-only: corrupt BSON types must not turn a retained intent into absence.
      const identity = value => ({ $in: [value, String(value)] });
      if (await one(connection.db, 'growthtasks', { familyId: identity(guard.familyId), childId: identity(guard.childId),
        $or: USAGE.map(path => ({ [path]: identity(guard.mediaId) })) }, { _id: 1 })) issues.add('RETIRED_MEDIA_IN_USE');
    });
  } catch (_cause) { fail(['READINESS_QUERY_FAILED']); }
  if (issues.size) fail(issues);
  return { ready: true, service: 'homework-service', protocol: 'task-completion-v1', scope: 'completion-media-guards' };
};

module.exports = { assertCompletionMediaGuardReadiness };
