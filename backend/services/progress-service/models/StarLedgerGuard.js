const mongoose = require('mongoose');

const { Schema } = mongoose;

const starLedgerGuardSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

starLedgerGuardSchema.index({ familyId: 1, childId: 1 }, { unique: true });

module.exports = mongoose.models.StarLedgerGuard
  || mongoose.model('StarLedgerGuard', starLedgerGuardSchema);
