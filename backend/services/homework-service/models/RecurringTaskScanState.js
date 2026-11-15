const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, enum: ['recurring-task-plans-v1'] },
  afterId: { type: mongoose.Schema.Types.ObjectId, default: null },
  version: { type: Number, default: 0, validate: Number.isSafeInteger },
  failures: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  healthWriteFailures: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  lastRoundFailures: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  lastRoundHealthWriteFailures: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger }
}, { strict: 'throw', versionKey: false });
module.exports = mongoose.models.RecurringTaskScanState || mongoose.model('RecurringTaskScanState', schema);
