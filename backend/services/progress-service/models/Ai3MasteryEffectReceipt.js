const mongoose = require('mongoose');
const { hash, validateReceipt } = require('../../../common/services/ai3ReviewEvidence');
const { Schema } = mongoose;
const objectId = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });
const digest = () => ({ type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ });
const schema = new Schema({
  familyId: objectId(), childId: objectId(), targetId: objectId(), reviewedByParentId: objectId(), finalReviewId: objectId(),
  effectId: { type: String, required: true, immutable: true, match: /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/ },
  finalReviewHash: digest(), requestHash: digest(),
  expectedStateRevision: { type: Number, required: true, immutable: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  status: { type: String, required: true, immutable: true, enum: ['applied', 'not_applied_conflict', 'not_applied_missing'] },
  reviewedAt: { type: Date, required: true, immutable: true },
  appliedAt: { type: Date, default: null, immutable: true },
  decidedAt: { type: Date, required: true, immutable: true },
  eventId: { type: Schema.Types.ObjectId, default: null, immutable: true }
}, { strict: 'throw', versionKey: false });
const toDTO = row => ({ effectId: row.effectId, finalReviewId: String(row.finalReviewId), finalReviewHash: row.finalReviewHash,
  familyId: String(row.familyId), childId: String(row.childId), targetId: String(row.targetId),
  reviewedByParentId: String(row.reviewedByParentId), expectedStateRevision: row.expectedStateRevision, status: row.status,
  reviewedAt: row.reviewedAt.toISOString(), appliedAt: row.appliedAt === null ? null : row.appliedAt.toISOString(),
  decidedAt: row.decidedAt.toISOString(), eventId: row.eventId === null ? null : String(row.eventId) });
const requestFor = row => ({ schemaVersion: 'ai3-review-effect-v1', effectId: row.effectId,
  finalReviewId: String(row.finalReviewId), finalReviewHash: row.finalReviewHash, familyId: String(row.familyId),
  childId: String(row.childId), reviewedByParentId: String(row.reviewedByParentId), targetId: String(row.targetId),
  expectedStateRevision: row.expectedStateRevision });
schema.pre('validate', function validateContract() {
  try {
    const request = requestFor(this); validateReceipt(toDTO(this), request);
    if (this.requestHash !== hash(request)) throw Error('hash mismatch');
  } catch (_) { this.invalidate('requestHash', 'Invalid AI3 mastery receipt'); }
});
schema.index({ familyId: 1, effectId: 1 }, { unique: true });
schema.index({ familyId: 1, childId: 1, targetId: 1 });
const Receipt = mongoose.models.Ai3MasteryEffectReceipt || mongoose.model('Ai3MasteryEffectReceipt', schema);
Receipt.toDTO = toDTO;
Receipt.requestFor = requestFor;
module.exports = Receipt;
