const mongoose = require('mongoose');

const { Schema } = mongoose;
const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const MASTERY_LEVELS = ['not_started', 'learning', 'basic', 'skilled', 'needs_review'];

const knowledgePointMasteryEventSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  knowledgePointId: { type: Schema.Types.ObjectId, ref: 'KnowledgePoint', required: true },
  dimension: { type: String, enum: DIMENSIONS, required: true },
  subject: { type: String, trim: true, default: '' },
  area: { type: String, trim: true, default: '' },
  name: { type: String, trim: true, required: true, maxlength: 100 },
  masteryLevel: { type: String, enum: MASTERY_LEVELS, required: true },
  effectiveAt: { type: Date, required: true },
  operationId: { type: String, required: true, trim: true, maxlength: 128 },
  sourceType: { type: String, enum: ['ai3_practice'], default: undefined, immutable: true },
  finalReviewId: { type: Schema.Types.ObjectId, default: undefined, immutable: true },
  finalReviewHash: { type: String, match: /^[a-f0-9]{64}$/, default: undefined, immutable: true },
  reviewedByParentId: { type: Schema.Types.ObjectId, default: undefined, immutable: true },
  reviewedAt: { type: Date, default: undefined, immutable: true }
}, { timestamps: true });
knowledgePointMasteryEventSchema.pre('validate', function validateAi3Audit() {
  const fields = ['finalReviewId', 'finalReviewHash', 'reviewedByParentId', 'reviewedAt'];
  if (this.sourceType === 'ai3_practice'
    ? fields.some(key => this[key] == null) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(this.operationId)
      || this.masteryLevel !== 'skilled'
    : fields.some(key => this[key] !== undefined)) this.invalidate('sourceType', 'Invalid AI3 mastery event audit');
});

knowledgePointMasteryEventSchema.index(
  { familyId: 1, knowledgePointId: 1, operationId: 1 },
  { unique: true }
);
knowledgePointMasteryEventSchema.index({ familyId: 1, childId: 1, effectiveAt: 1 });

module.exports = mongoose.models.KnowledgePointMasteryEvent
  || mongoose.model('KnowledgePointMasteryEvent', knowledgePointMasteryEventSchema);
