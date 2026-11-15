const mongoose = require('mongoose');
const { Schema } = mongoose;
const id = { type: Schema.Types.ObjectId, required: true, immutable: true };
const digest = { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ };
const schema = new Schema({
  familyId: id, childId: id, targetId: id, reviewedByParentId: id, finalReviewId: id,
  effectId: { type: String, required: true, immutable: true,
    match: /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/ },
  finalReviewHash: digest, requestHash: digest,
  expectedStateRevision: { type: Number, required: true, min: 0, immutable: true, validate: Number.isSafeInteger },
  status: { type: String, required: true, immutable: true, enum: ['applied', 'not_applied_conflict', 'not_applied_missing'] },
  reviewedAt: { type: Date, required: true, immutable: true },
  appliedAt: { type: Date, default: null, immutable: true },
  decidedAt: { type: Date, required: true, immutable: true },
  eventId: { type: Schema.Types.ObjectId, default: null, immutable: true }
}, { strict: 'throw', timestamps: true });
schema.index({ familyId: 1, effectId: 1 }, { unique: true, name: 'ai3_mistake_effect_identity' });
module.exports = mongoose.models.Ai3MistakeReviewEffectReceipt
  || mongoose.model('Ai3MistakeReviewEffectReceipt', schema);
