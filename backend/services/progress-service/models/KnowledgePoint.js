const mongoose = require('mongoose');

const { Schema } = mongoose;
const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const nonNegativeInteger = {
  validator: Number.isInteger,
  message: 'value must be an integer'
};

const knowledgePointSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  dimension: { type: String, enum: DIMENSIONS, required: true },
  subject: {
    type: String,
    trim: true,
    default: '',
    required() { return this.dimension === 'academic'; }
  },
  area: {
    type: String,
    trim: true,
    default: '',
    required() { return this.dimension !== 'academic'; }
  },
  name: { type: String, trim: true, required: true, maxlength: 100 },
  masteryLevel: {
    type: String,
    enum: ['not_started', 'learning', 'basic', 'skilled', 'needs_review'],
    default: 'not_started'
  },
  practiceCount: { type: Number, min: 0, default: 0, validate: nonNegativeInteger },
  mistakeCount: { type: Number, min: 0, default: 0, validate: nonNegativeInteger },
  lastReviewedAt: Date,
  createdByParentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedByParentId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

knowledgePointSchema.index(
  { familyId: 1, childId: 1, dimension: 1, subject: 1, area: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.models.KnowledgePoint
  || mongoose.model('KnowledgePoint', knowledgePointSchema);
