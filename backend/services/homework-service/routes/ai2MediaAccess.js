const express = require('express');
const crypto = require('crypto');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const M = require('../models/Ai2');
const C = require('../services/ai2Contract');
const same = (a, b) => String(a) === String(b);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const shape = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const digest = value => crypto.createHash('sha256').update(value).digest();

async function knownUnpublishedBinding(body, binding) {
  const c = await M.Command.findOne({ familyId: body.familyId, childId: body.childId, actorId: body.childId,
    endpointOperation: 'ai2.submit', attemptId: binding.attemptId, remoteOperationId: binding.bindingOperationId,
    phase: { $in: ['RESERVED', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING', 'FAILED'] } }).lean();
  if (!c) return false;
  let payload;
  try { payload = C.normalize('submit', c.payload); } catch (_) { return false; }
  if (c.operationId !== payload.operationId || c.requestHash !== C.requestHash('submit', `/api/ai2/learning-packages/${c.packageId}/attempts`, payload)
    || !Array.isArray(c.references) || c.references.length !== payload.mediaIds.length
    || c.references.some((r, i) => !r || r.mediaId !== payload.mediaIds[i] || r.resourceType !== 'ai2_attempt'
      || r.resourceId !== binding.attemptId || r.field !== 'correctionMediaIds' || r.bindingOperationId !== binding.bindingOperationId)
    || !payload.mediaIds.includes(body.mediaId)
    || c.referencesHash !== C.hash({ familyId: body.familyId, childId: body.childId, resourceType: 'ai2_attempt',
      resourceId: binding.attemptId, references: c.references })) return false;
  return Boolean(await M.Package.exists({ _id: c.packageId, familyId: body.familyId, childId: body.childId }));
}

async function checkAi2MediaAccess(body) {
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
    : !same(family.ownerParentId, actor._id) && !family.memberParentIds.some(id => same(id, actor._id))) return denied;
  // This trusted service request follows resource's current-session validation; no token is inferred from the uploader.
  let allowed = false;
  for (const binding of bindings) {
    const a = await M.Attempt.findOne({ _id: binding.attemptId, familyId: family._id, childId: child._id }).lean();
    if (!a) {
      // A committed-but-unpublished/compensated mapping grants nothing; a separate published Attempt may still grant access.
      if (await knownUnpublishedBinding(body, binding)) continue;
      return denied;
    }
    if (!Array.isArray(a.mediaBindings) || !Array.isArray(a.mediaIds)
      || a.payloadHash !== C.hash({ note: a.note, mediaIds: a.mediaIds.map(String), bindings: a.mediaBindings,
        submittedBy: String(a.submittedBy), attemptVersion: a.attemptVersion })
      || !a.mediaIds.some(id => same(id, body.mediaId))
      || !a.mediaBindings.some(b => b.mediaId === body.mediaId && b.resourceType === 'ai2_attempt'
        && b.resourceId === binding.attemptId && b.field === 'correctionMediaIds' && b.bindingOperationId === binding.bindingOperationId)) return denied;
    const p = await M.Package.findOne({ _id: a.packageId, familyId: family._id, childId: child._id }).lean();
    if (!p) return denied;
    if (body.role === 'parent' || p.visibility === 'published') allowed = true;
  }
  return { allowed };
}
function createAi2MediaAccessRouter({ serviceToken, check = checkAi2MediaAccess } = {}) {
  if (typeof serviceToken !== 'string' || serviceToken.length < 32) throw new TypeError('Media service credential required');
  const router = express.Router();
  router.post('/media-access-check', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const fail = (status, code) => res.status(status).json({ success: false, error: { code, message: code, details: [] } });
    const supplied = req.get('x-service-token');
    if (!supplied || !crypto.timingSafeEqual(digest(supplied), digest(serviceToken))) return fail(401, 'INVALID_SERVICE_CREDENTIAL');
    try {
      if (Object.keys(req.query).length) throw C.error(400, 'VALIDATION_ERROR');
      return res.json({ success: true, data: await check(req.body) });
    } catch (cause) { return cause.code === 'VALIDATION_ERROR' ? fail(400, cause.code) : fail(503, 'SERVICE_UNAVAILABLE'); }
  });
  return router;
}
module.exports = { createAi2MediaAccessRouter, checkAi2MediaAccess };
