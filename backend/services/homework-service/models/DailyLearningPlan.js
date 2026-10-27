const mongoose = require('mongoose');
const { addLocalDateDays } = require('../../../common/utils/familyDate');
const { Schema } = mongoose;
const validDate = value => {
  try { return typeof value === 'string' && addLocalDateDays(value, 0) === value; } catch (_) { return false; }
};
const actor = new Schema({
  actorId: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['parent', 'student'], required: true }
}, { _id: false, strict: 'throw' });
const item = new Schema({
  taskId: { type: Schema.Types.ObjectId, required: true },
  childEstimatedMinutes: { type: Number, default: null, min: 1, max: 240,
    validate: value => value === null || Number.isInteger(value) },
  estimateRecordedBy: { type: actor, default: null }
}, { _id: false, strict: 'throw' });
const schema = new Schema({
  familyId: { type: Schema.Types.ObjectId, required: true },
  childId: { type: Schema.Types.ObjectId, required: true },
  localDate: { type: String, required: true, validate: validDate },
  items: { type: [item], default: [], required: true,
    validate: entries => Array.isArray(entries) && entries.length <= 20
      && entries.every(e => e?.taskId) && new Set(entries.map(e => String(e.taskId))).size === entries.length },
  version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  updatedByActor: { type: actor, default: null }
}, { timestamps: true, strict: 'throw' });
schema.index({ familyId: 1, childId: 1, localDate: 1 }, { unique: true });
module.exports = mongoose.models.DailyLearningPlan || mongoose.model('DailyLearningPlan', schema);
