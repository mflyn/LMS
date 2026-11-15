const mongoose = require('mongoose');
const { isValidTimeZone, assertLocalDate } = require('../../../common/utils/familyDate');
const Task = require('./GrowthTask');
const { fields } = require('../services/recurringTaskPlanCommand');
const { Schema } = mongoose;
const options = { _id: false, strict: 'throw' };
const localDate = { type: String, required: true, validate: value => {
  if (value == null) return true;
  try { assertLocalDate(value); return true; } catch { return false; }
} };
const integer = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
const rule = new Schema({ kind: { type: String, enum: ['daily', 'weekly'], required: true },
  weekdays: { type: [Number], default: undefined, castNonArrays: false } }, options);
rule.pre('validate', function validateRule(next) {
  if (this.kind === 'daily' ? this.weekdays !== undefined : !Array.isArray(this.weekdays)
    || !this.weekdays.length || this.weekdays.length > 7
    || this.weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7)
    || new Set(this.weekdays).size !== this.weekdays.length) this.invalidate('weekdays', 'Invalid recurrence');
  next();
});
const template = new Schema(Object.fromEntries(fields.map(key => {
  const { index: _index, ...validation } = Task.schema.path(key).options;
  return [key, { ...validation, default: undefined }];
})), options);
const revision = new Schema({ revisionNumber: { ...integer, min: 1 }, effectiveFrom: localDate,
  endDate: { ...localDate, required: false, default: null },
  schedule: { type: rule, required: true }, template: { type: template, required: true } }, options);
const range = new Schema({ from: localDate, to: localDate, count: integer }, options);
const schema = new Schema({
  familyId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  childId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  createdByParentId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  timezone: { type: String, required: true, immutable: true, validate: isValidTimeZone },
  startDate: { ...localDate, immutable: true },
  status: { type: String, enum: ['active', 'stopped'], default: 'active', required: true },
  version: { ...integer, min: 1, default: 1 }, generationFence: { ...integer, default: 0 },
  currentRevision: { type: revision, required: true }, pendingRevision: { type: revision, default: null },
  lastEvaluatedDate: localDate, skippedOccurrenceCount: { ...integer, default: 0 },
  lastSkippedRange: { type: range, default: null }, lastSucceededAt: { type: Date, default: null },
  lastFailureCode: { type: String, default: null }, stoppedAt: { type: Date, default: null },
  stoppedByParentId: { type: Schema.Types.ObjectId, default: null }
}, { timestamps: true, strict: 'throw' });
schema.index({ status: 1, _id: 1 });
schema.index({ familyId: 1, childId: 1, _id: 1 });
module.exports = mongoose.models.RecurringTaskPlan || mongoose.model('RecurringTaskPlan', schema);
