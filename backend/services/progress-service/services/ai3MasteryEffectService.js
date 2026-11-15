const Point = require('../models/KnowledgePoint');
const Event = require('../models/KnowledgePointMasteryEvent');
const Receipt = require('../models/Ai3MasteryEffectReceipt');
const { requireParentChild } = require('./growthAccess');
const { revisionOf, revisionMatch } = require('./knowledgePointState');
const C = require('../../../common/services/ai3ReviewEvidence');

const denied = () => C.error(403, 'CHILD_ACCESS_DENIED');
const missing = () => C.error(404, 'RESOURCE_NOT_FOUND');
const conflict = () => C.error(409, 'AI3_EFFECT_CONFLICT');
const unavailable = () => C.error(503, 'AI3_EVIDENCE_UNAVAILABLE');
const id = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const math = point => point.dimension === 'academic' && typeof point.subject === 'string'
  && ['math', '\u6570\u5b66'].includes(point.subject.trim().replace(/[A-Z]/g, c => c.toLowerCase()));
const scopeMatches = (point, scope) => String(point.familyId) === scope.familyId && String(point.childId) === scope.childId;
const safe = async work => {
  try { return await work(); } catch (cause) {
    if ([400, 403, 404, 409, 413].includes(cause?.statusCode)
      && ['VALIDATION_ERROR', 'CHILD_ACCESS_DENIED', 'RESOURCE_NOT_FOUND', 'AI3_EFFECT_CONFLICT', 'AI3_INPUT_TOO_LARGE'].includes(cause.code)) throw cause;
    throw unavailable();
  }
};
const checkScope = (input, target) => {
  if (!shape(input, ['familyId', 'childId', 'actorId', target])
    || ![input.familyId, input.childId, input.actorId].every(id)
    || !(target === 'effectId' ? uuid(input[target]) : id(input[target]))) throw C.error(400, 'VALIDATION_ERROR');
};

const createAi3MasteryEffectService = ({ proofClient, now = Date.now, transactionRunner } = {}) => {
  if (typeof proofClient?.getFinalReview !== 'function' || typeof now !== 'function' || typeof transactionRunner !== 'function') {
    throw new TypeError('AI3 mastery proof client, transaction runner and clock are required');
  }
  const transact = work => transactionRunner(async session => {
    if (!session?.inTransaction()) throw unavailable();
    return work(session);
  });
  const authorize = async (scope, session) => {
    const access = await requireParentChild({ id: scope.actorId || scope.reviewedByParentId, role: 'parent' }, scope.childId, { session });
    if (!access || String(access.familyId) !== scope.familyId) throw denied();
  };
  const persistedDTO = (row, request) => {
    let dto;
    try {
      const savedRequest = C.normalizeEffectRequest(Receipt.requestFor(row));
      if (row.requestHash !== C.hash(savedRequest)) throw unavailable();
      dto = C.validateReceipt(Receipt.toDTO(row), savedRequest);
    } catch (_cause) {
      throw unavailable();
    }
    if (request && row.requestHash !== C.hash(request)) throw conflict();
    return dto;
  };
  const existing = async (request, session) => {
    const row = await Receipt.findOne({ familyId: request.familyId, effectId: request.effectId }).session(session).lean();
    return row ? persistedDTO(row, request) : null;
  };
  const getContext = input => safe(async () => {
    checkScope(input, 'targetId');
    return transact(async session => {
      await authorize(input, session);
      const point = await Point.findById(input.targetId).session(session).lean();
      if (!point) throw missing();
      if (!scopeMatches(point, input)) throw denied();
      if (!math(point)) throw missing();
      return { id: String(point._id), stateRevision: revisionOf(point) };
    });
  });
  const getReceipt = input => safe(async () => {
    checkScope(input, 'effectId');
    return transact(async session => {
      await authorize(input, session);
      const row = await Receipt.findOne({ familyId: input.familyId, effectId: input.effectId }).session(session).lean();
      if (!row) throw missing();
      if (String(row.childId) !== input.childId || String(row.reviewedByParentId) !== input.actorId) throw denied();
      return persistedDTO(row);
    });
  });
  const apply = ({ body } = {}) => safe(async () => {
    const request = JSON.parse(JSON.stringify(C.normalizeEffectRequest(body)));
    const old = await transact(async session => { await authorize(request, session); return existing(request, session); });
    if (old) return old;
    const proof = await proofClient.getFinalReview({ familyId: request.familyId, childId: request.childId,
      effectId: request.effectId, finalReviewId: request.finalReviewId });
    const review = JSON.parse(JSON.stringify(C.validateProof(proof, request, 'mastery')));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await transact(async session => {
          await authorize(request, session);
          const replay = await existing(request, session); if (replay) return replay;
          const point = await Point.findById(request.targetId).session(session).lean();
          if (point && !scopeMatches(point, request)) throw denied();
          let status = !point ? 'not_applied_missing'
            : !math(point) || revisionOf(point) !== request.expectedStateRevision ? 'not_applied_conflict' : 'applied';
          const decidedAt = new Date(Number(now()));
          if (!Number.isFinite(decidedAt.getTime())) throw unavailable();
          let eventId = null;
          if (status === 'applied') {
            const updated = await Point.findOneAndUpdate({ _id: point._id, familyId: request.familyId, childId: request.childId,
              dimension: 'academic', subject: point.subject, ...revisionMatch(request.expectedStateRevision) },
            { $set: { masteryLevel: 'skilled', updatedByParentId: request.reviewedByParentId }, $inc: { stateRevision: 1 } },
            { session, new: true, runValidators: true });
            if (!updated) status = 'not_applied_conflict';
            else {
              const [event] = await Event.create([{ familyId: request.familyId, childId: request.childId,
                knowledgePointId: point._id, dimension: point.dimension, subject: point.subject, area: point.area || '', name: point.name,
                masteryLevel: 'skilled', operationId: request.effectId, effectiveAt: decidedAt, sourceType: 'ai3_practice',
                finalReviewId: request.finalReviewId, finalReviewHash: request.finalReviewHash,
                reviewedByParentId: request.reviewedByParentId, reviewedAt: new Date(review.reviewedAt) }], { session });
              eventId = event._id;
            }
          }
          const { schemaVersion: _schemaVersion, ...fields } = request;
          const [receipt] = await Receipt.create([{ ...fields, requestHash: C.hash(request), status,
            reviewedAt: new Date(review.reviewedAt), decidedAt, appliedAt: status === 'applied' ? decidedAt : null, eventId }], { session });
          return persistedDTO(receipt, request);
        });
      } catch (cause) {
        // Only a concurrent unique insert is safe to replay here. Unknown commit outcomes stay unknown.
        if (cause?.code !== 11000) throw cause;
      }
    }
    throw unavailable();
  });
  return { getContext, apply, getReceipt };
};
module.exports = { createAi3MasteryEffectService };
