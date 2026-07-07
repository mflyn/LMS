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
  operationId: { type: String, required: true, trim: true, maxlength: 128 }
}, { timestamps: true });

knowledgePointMasteryEventSchema.index(
  { familyId: 1, knowledgePointId: 1, operationId: 1 },
  { unique: true }
);
knowledgePointMasteryEventSchema.index({ familyId: 1, childId: 1, effectiveAt: 1 });

module.exports = mongoose.models.KnowledgePointMasteryEvent
  || mongoose.model('KnowledgePointMasteryEvent', knowledgePointMasteryEventSchema);
