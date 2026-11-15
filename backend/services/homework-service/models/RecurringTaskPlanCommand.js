const mongoose = require('mongoose');
const { UUID } = require('../services/growthTaskCompletionCommand');
const { Schema } = mongoose;
const schema = new Schema({
  schemaVersion: { type: Number, enum: [1], required: true },
  familyId: { type: Schema.Types.ObjectId, required: true }, actorId: { type: Schema.Types.ObjectId, required: true },
  childId: { type: Schema.Types.ObjectId, required: true },
  operationId: { type: String, required: true, match: UUID },
  action: { type: String, enum: ['create', 'patch', 'stop'], required: true },
  targetPlanId: { type: Schema.Types.ObjectId, default: null },
  requestDigest: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  state: { type: String, enum: ['succeeded', 'aborted'], required: true },
  command: { type: Schema.Types.Mixed, default: null }, result: { type: Schema.Types.Mixed, default: null },
  settledAt: { type: Date, required: true }
}, { strict: 'throw' });
schema.index({ familyId: 1, actorId: 1, operationId: 1 }, { unique: true, name: 'recurring_command_identity' });
schema.index({ familyId: 1, actorId: 1, childId: 1, settledAt: -1, _id: -1 });
schema.pre('validate', function validateTerminal(next) {
  if (this.state === 'aborted' ? this.command !== null || this.result !== null : !this.command || !this.result) {
    this.invalidate('state', 'Invalid terminal payload');
  }
  if (this.action === 'create' ? this.targetPlanId !== null : !this.targetPlanId) this.invalidate('targetPlanId', 'Invalid target');
  next();
});
module.exports = mongoose.models.RecurringTaskPlanCommand || mongoose.model('RecurringTaskPlanCommand', schema);
