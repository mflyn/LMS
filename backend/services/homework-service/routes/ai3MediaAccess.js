const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const M = require('../models/Ai3');
const C = require('../services/ai3Contract');
const { validateAttempt, validateMapping, assertPublishedAncestor } = require('../services/ai3SubmissionService');
const { createAi2MediaAccessRouter } = require('./ai2MediaAccess');
const same = (a, b) => String(a) === String(b);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

async function contentMatches(round, binding) {
  const publication = round.publication;
  if (!binding || !publication || publication.contentId !== binding.contentId
    || publication.contentVersion !== binding.contentVersion || publication.contentHash !== binding.fullContentHash
    || publication.childSnapshotHash !== binding.childSnapshotHash || !same(round.currentContentId, binding.contentId)
    || round.currentContentVersion !== binding.contentVersion || round.currentContentHash !== binding.fullContentHash) return false;
  const content = await M.Content.findOne({ _id: binding.contentId, familyId: round.familyId, childId: round.childId,
    roundId: round._id, version: binding.contentVersion, contentHash: binding.fullContentHash,
    childSnapshotHash: binding.childSnapshotHash }).lean();
  if (!content) return false;
  try {
    return C.hash(content.content) === binding.fullContentHash
      && C.hash(C.childSnapshot(content.content)) === binding.childSnapshotHash
      && C.hash(content.childSnapshot) === binding.childSnapshotHash;
  } catch (_) { return false; }
}

async function knownUnpublishedBinding(body, binding) {
  const command = await M.Command.findOne({ familyId: body.familyId, childId: body.childId, actorId: body.childId,
    endpointOperation: 'ai3.submit', attemptId: binding.attemptId, remoteOperationId: binding.bindingOperationId,
    phase: { $in: ['RESERVED', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING', 'FAILED'] } }).lean();
  if (!command) return false;
  try { validateMapping(command); } catch (_) { return false; }
  if (!command.payload.mediaIds.includes(body.mediaId)) return false;
  const round = await M.Round.findOne({ _id: command.roundId, familyId: body.familyId, childId: body.childId }).lean();
  return Boolean(round && await contentMatches(round, command.serverContentBinding));
}

async function checkAi3MediaAccess(body) {
  if (!shape(body, ['familyId', 'childId', 'actorId', 'role', 'mediaId', 'bindings'])
    || ![body.familyId, body.childId, body.actorId, body.mediaId].every(C.isId)
    || !['parent', 'student'].includes(body.role) || !Array.isArray(body.bindings)
    || body.bindings.length < 1 || body.bindings.length > 100) throw C.error(400, 'VALIDATION_ERROR');
  const bindings = Array.from(body.bindings);
  if (bindings.some(b => !shape(b, ['attemptId', 'bindingOperationId']) || !C.isId(b.attemptId) || !uuid(b.bindingOperationId))
    || new Set(bindings.map(b => `${b.attemptId}:${b.bindingOperationId}`)).size !== bindings.length) throw C.error(400, 'VALIDATION_ERROR');
  const denied = { allowed: false };
  const actor = await User.findOne({ _id: body.actorId, role: body.role }).lean();
  const child = await User.findOne({ _id: body.childId, role: 'student', familyId: body.familyId }).lean();
  const family = await Family.findOne({ _id: body.familyId, childIds: body.childId }).lean();
  if (!actor || !child || !family) return denied;
  if (body.role === 'student' ? !same(actor._id, child._id) || !same(actor.familyId, family._id)
    : !same(family.ownerParentId, actor._id) && !family.memberParentIds?.some(value => same(value, actor._id))) return denied;
  // Resource validates the live session/PIN before this trusted request; uploader identity is never authentication.
  let allowed = false;
  for (const binding of bindings) {
    const attempt = await M.Attempt.findOne({ _id: binding.attemptId, familyId: family._id, childId: child._id }).lean();
    if (!attempt) {
      // Known unpublished mappings grant nothing, but must not hide an independently authorized Attempt.
      if (await knownUnpublishedBinding(body, binding)) continue;
      return denied;
    }
    try { validateAttempt(attempt); } catch (_) { return denied; }
    if (!same(attempt.submittedBy, child._id) || !attempt.mediaIds.some(value => same(value, body.mediaId))
      || !attempt.mediaBindings.some(value => value.mediaId === body.mediaId && value.resourceType === 'ai3_attempt'
        && value.resourceId === binding.attemptId && value.field === 'practiceMediaIds'
        && value.bindingOperationId === binding.bindingOperationId)) return denied;
    const round = await M.Round.findOne({ _id: attempt.roundId, familyId: family._id, childId: child._id }).lean();
    if (!round || !await contentMatches(round, attempt.serverContentBinding)) return denied;
    if (body.role === 'parent') { allowed = true; continue; }
    if (round.visibility !== 'published' || round.cancelledAt) continue;
    try { await assertPublishedAncestor(round); }
    catch (cause) {
      if (cause?.code === 'AI3_SOURCE_NOT_APPROVED' || cause?.code === 'RESOURCE_NOT_FOUND') continue;
      throw cause;
    }
    allowed = true;
  }
  return { allowed };
}

// Deliberately unmounted: the caller owns the private /api/internal/ai3 mount and credential.
function createAi3MediaAccessRouter({ serviceToken, check = checkAi3MediaAccess } = {}) {
  return createAi2MediaAccessRouter({ serviceToken, check });
}
module.exports = { createAi3MediaAccessRouter, checkAi3MediaAccess };
