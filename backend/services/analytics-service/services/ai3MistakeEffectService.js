const mongoose = require('mongoose');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const C = require('../../../common/services/ai3ReviewEvidence');
const { runMongoTransaction, assertTransactionCapability } = require('../../../common/services/mongoTransaction');
const Mistake = require('../models/FamilyMistake');
const Event = require('../models/FamilyMistakeStateEvent');
const Receipt = require('../models/Ai3ReviewEffectReceipt');
const id = v => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v);
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const same = (a, b) => String(a) === String(b);
const unavailable = () => C.error(503, 'AI3_NOT_READY');
const revision = row => {
  const value = row.stateRevision === undefined ? 0 : row.stateRevision;
  if (!Number.isSafeInteger(value) || value < 0) throw unavailable();
  return value;
};
const math = row => row.dimension === 'academic' && typeof row.subject === 'string'
  && ['math', '\u6570\u5b66'].includes(row.subject.trim().replace(/[A-Z]/g, c => c.toLowerCase()));
function receiptDto(row) {
  return { effectId: row.effectId, finalReviewId: String(row.finalReviewId), finalReviewHash: row.finalReviewHash,
    familyId: String(row.familyId), childId: String(row.childId), targetId: String(row.targetId),
    reviewedByParentId: String(row.reviewedByParentId), expectedStateRevision: row.expectedStateRevision,
    status: row.status, reviewedAt: row.reviewedAt.toISOString(), appliedAt: row.appliedAt?.toISOString() || null,
    decidedAt: row.decidedAt.toISOString(), eventId: row.eventId ? String(row.eventId) : null };
}
function inputScope(input, key, validator) {
  if (!input || Object.keys(input).sort().join(',') !== ['familyId', 'childId', 'actorId', key].sort().join(',')
    || !['familyId', 'childId', 'actorId'].every(k => id(input[k])) || !validator(input[key])) throw C.error(400, 'VALIDATION_ERROR');
}
async function authorize({ familyId, childId, actorId }, session = null) {
  const parent = await User.findOne({ _id: actorId, role: 'parent' }).session(session).lean();
  const child = await User.findOne({ _id: childId, familyId, role: 'student' }).session(session).lean();
  const family = await Family.findOne({ _id: familyId, childIds: childId,
    $or: [{ ownerParentId: actorId }, { memberParentIds: actorId }] }).session(session).lean();
  if (!parent || !child || !family) throw C.error(403, 'CHILD_ACCESS_DENIED');
}
async function assertAi3MistakeEffectReady() {
  try {
    await assertTransactionCapability(Mistake.db, 'AI3 analytics');
    const indexes = await Receipt.collection.indexes();
    if (!indexes.some(i => i.unique === true && !i.sparse && !i.partialFilterExpression
      && !i.prepareUnique && !i.buildUUID && (!i.collation || i.collation.locale === 'simple')
      && JSON.stringify(i.key) === JSON.stringify({ familyId: 1, effectId: 1 }))) throw unavailable();
  } catch (_) { throw unavailable(); }
}
function createAi3MistakeEffectService({ proofClient, now = Date.now,
  transactionRunner = work => runMongoTransaction({ mongooseInstance: mongoose, work }) } = {}) {
  const instant = () => {
    const value = Number(now());
    if (!Number.isSafeInteger(value) || !Number.isFinite(new Date(value).getTime())) throw unavailable();
    return new Date(value);
  };
  const authScope = request => ({ familyId: request.familyId, childId: request.childId, actorId: request.reviewedByParentId });
  async function existing(request, session = null) {
    let query = Receipt.findOne({ familyId: request.familyId, effectId: request.effectId }).session(session);
    if (!session) query = query.read('primary').readConcern('majority');
    const row = await query.lean();
    if (!row) return null;
    if (row.requestHash !== C.hash(request)) throw C.error(409, 'AI3_EFFECT_CONFLICT');
    return C.validateReceipt(receiptDto(row), request);
  }
  async function getContext(input) {
    inputScope(input, 'targetId', id); await authorize(input);
    const row = await Mistake.findOne({ _id: input.targetId, familyId: input.familyId, childId: input.childId }).lean();
    if (!row) throw C.error(404, 'RESOURCE_NOT_FOUND');
    if (!math(row)) throw C.error(409, 'AI3_SOURCE_NOT_APPROVED');
    await authorize(input);
    return { id: String(row._id), stateRevision: revision(row), knowledgePointId: row.knowledgePointId ? String(row.knowledgePointId) : null };
  }
  async function getReceipt(input) {
    inputScope(input, 'effectId', uuid); await authorize(input);
    const row = await Receipt.findOne({ familyId: input.familyId, childId: input.childId,
      reviewedByParentId: input.actorId, effectId: input.effectId }).read('primary').readConcern('majority').lean();
    if (!row) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const dto = receiptDto(row);
    const request = { schemaVersion: 'ai3-review-effect-v1', ...Object.fromEntries(
      ['familyId', 'childId', 'reviewedByParentId', 'effectId', 'finalReviewId', 'finalReviewHash', 'targetId', 'expectedStateRevision'].map(k => [k, dto[k]])) };
    await authorize(input); return C.validateReceipt(dto, request);
  }
  async function apply({ body }) {
    const request = Object.freeze({ ...C.normalizeEffectRequest(body) });
    const scope = authScope(request);
    await authorize(scope);
    const saved = await existing(request); if (saved) return saved;
    await assertAi3MistakeEffectReady();
    let proof;
    try {
      if (typeof proofClient?.getFinalReview !== 'function') throw unavailable();
      proof = await proofClient.getFinalReview({ familyId: request.familyId, childId: request.childId,
        effectId: request.effectId, finalReviewId: request.finalReviewId });
    } catch (e) {
      if ([401, 403, 404, 409].includes(e?.statusCode)) throw e;
      throw C.error(503, 'AI3_PROOF_UNAVAILABLE');
    }
    const review = JSON.parse(JSON.stringify(C.validateProof(proof, request, 'mistake')));
    try {
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw unavailable();
        await authorize(scope, session);
        const old = await existing(request, session); if (old) return old;
        const row = await Mistake.findById(request.targetId).select('+mediaReferenceState').session(session).lean();
        if (row && (!same(row.familyId, request.familyId) || !same(row.childId, request.childId))) throw C.error(404, 'RESOURCE_NOT_FOUND');
        let status = !row ? 'not_applied_missing' : 'not_applied_conflict', eventId = null;
        const at = instant();
        if (row && math(row) && row.mediaReferenceState !== 'pending'
          && revision(row) === request.expectedStateRevision && revision(row) < Number.MAX_SAFE_INTEGER
          && (row.knowledgePointId ? String(row.knowledgePointId) : null) === review.targets.mistake.knowledgePointId) {
          const versionQuery = request.expectedStateRevision === 0
            ? { $or: [{ stateRevision: 0 }, { stateRevision: { $exists: false } }] }
            : { stateRevision: request.expectedStateRevision };
          const updated = await Mistake.findOneAndUpdate({ _id: row._id, familyId: request.familyId, childId: request.childId,
            ...versionQuery, knowledgePointId: row.knowledgePointId || null, mediaReferenceState: { $ne: 'pending' } },
          { $set: { reviewed: true, updatedBy: request.reviewedByParentId,
            ...(review.masteryConfirmed ? { mastered: true } : {}),
            ...(review.reviewReminderDate !== null ? { reviewReminderDate: review.reviewReminderDate } : {}) },
          $inc: { stateRevision: 1, __v: 1 } }, { new: true, runValidators: true, session }).lean();
          if (!updated) throw unavailable();
          eventId = new mongoose.Types.ObjectId(); status = 'applied';
          await Event.create([{ _id: eventId, familyId: row.familyId, childId: row.childId, mistakeId: row._id,
            reviewed: updated.reviewed, mastered: updated.mastered, reviewReminderDate: updated.reviewReminderDate,
            effectiveAt: at, operationId: `ai3:${request.effectId}`, ai3Evidence: { effectId: request.effectId,
              finalReviewId: request.finalReviewId, finalReviewHash: request.finalReviewHash,
              reviewedByParentId: request.reviewedByParentId, reviewedAt: new Date(review.reviewedAt) } }], { session });
        }
        const { schemaVersion: _schemaVersion, ...fields } = request;
        const [receipt] = await Receipt.create([{ ...fields, requestHash: C.hash(request), status,
          reviewedAt: new Date(review.reviewedAt), decidedAt: at, appliedAt: status === 'applied' ? at : null, eventId }], { session });
        return C.validateReceipt(receiptDto(receipt), request);
      });
    } catch (cause) {
      // A lost commit response is resolved only by its original durable receipt.
      await authorize(scope);
      const committed = await existing(request); if (committed) return committed;
      if (cause?.statusCode) throw cause;
      throw C.error(503, 'AI3_EFFECT_PENDING');
    }
  }
  const guarded = operation => async input => {
    try { return await operation(input); }
    catch (cause) {
      if (cause?.statusCode && typeof cause.code === 'string') throw cause;
      throw unavailable();
    }
  };
  return { getContext: guarded(getContext), apply: guarded(apply), getReceipt: guarded(getReceipt) };
}
module.exports = { createAi3MistakeEffectService, assertAi3MistakeEffectReady };
