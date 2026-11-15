const oid = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const invalid = () => Object.assign(new Error('Unverified AI1 response'), { code: 'AI_RESPONSE_UNVERIFIED' });
const requireResult = condition => { if (!condition) throw invalid(); };

export function tutorEnvelope(response) {
  const envelope = response?.data;
  requireResult(envelope?.success === true && envelope.data !== null && typeof envelope.data === 'object' && !Array.isArray(envelope.data));
  return envelope.data;
}

export function isDefinitiveTutorRejection(cause) {
  const { status, data } = cause?.response || {};
  if (data?.success !== false || typeof data.error?.code !== 'string') return false;
  const errors = {
    VALIDATION_ERROR: 400, AI_SOURCE_SUBJECT_UNSUPPORTED: 400, AI_INPUT_TOO_LARGE: 413,
    AI_VERSION_CONFLICT: 409, AI_PREVIEW_STALE: 409, AI_BUDGET_EXCEEDED: 409,
    AI_SOURCE_CYCLE_ACTIVE: 409, AI_OPERATION_UNRESOLVED: 409
  };
  // Missing objects/identities, reused keys and infrastructure errors do not prove non-commit.
  return Object.prototype.hasOwnProperty.call(errors, data.error?.code) && errors[data.error.code] === status;
}

// A transport success alone does not prove the saved command committed to its intended object.
// Keep the original command on malformed/mismatched results; only explicit replay may resolve it.
export function confirmedTutorResult(command, result, scope, session) {
  requireResult(result && typeof result === 'object' && !Array.isArray(result));
  const { action, targetId, body } = command;
  if (action === 'create' || action === 'close') {
    const c = result.cycle;
    requireResult(oid(c?.id) && c.childId === scope.childId && positive(c.stateVersion));
    if (action === 'create') {
      requireResult(c.createdBy === session.actorId && c.status === 'ready' && c.stateVersion === 1
        && c.source?.type === body.source.type && c.source?.id === body.source.id && hash(result.preview?.generationInputHash));
    } else requireResult(c.id === targetId && c.status === 'closed' && c.stateVersion === body.expectedCycleStateVersion + 1);
    return c.id;
  }
  if (action === 'generate' || action === 'recover') {
    const j = result.job;
    requireResult(oid(j?.id) && oid(j.cycleId) && j.createdBy === session.actorId
      && ['reserved', 'dispatching', 'unknown', 'succeeded', 'failed'].includes(j.status));
    requireResult(action === 'generate' ? j.cycleId === targetId && j.operationId === body.operationId : j.id === targetId);
    return j.cycleId;
  }
  const a = result.artifact;
  requireResult(['revise', 'review'].includes(action) && oid(a?.id) && a.cycleId === targetId
    && hash(a.contentHash) && positive(a.version) && positive(a.reviewVersion)
    && result.cycleStateVersion === body.expectedCycleStateVersion + 1);
  if (action === 'revise') {
    requireResult(a.id !== body.artifactId && a.derivedFromArtifactId === body.artifactId
      && a.version === body.artifactVersion + 1 && a.reviewVersion === 1 && a.status === 'candidate'
      && a.origin === 'parent_revision' && a.createdBy === session.actorId);
  } else {
    requireResult(a.id === body.artifactId && a.version === body.artifactVersion && a.contentHash === body.artifactContentHash
      && a.reviewVersion === body.expectedArtifactReviewVersion + 1
      && a.status === (body.decision === 'approve' ? 'parent_approved' : 'rejected')
      && a.review?.reviewerId === session.actorId && a.review?.decision === body.decision);
  }
  return a.cycleId;
}
