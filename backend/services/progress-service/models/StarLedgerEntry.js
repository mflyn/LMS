const mongoose = require('mongoose');

const { Schema } = mongoose;

const immutableLedgerError = () => {
  const error = new Error('Star ledger entries are immutable');
  error.code = 'IMMUTABLE_LEDGER_ENTRY';
  return error;
};

const starLedgerEntrySchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['earn', 'spend', 'adjust'], required: true },
  amount: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: Number.isInteger, message: 'amount must be an integer' }
  },
  sourceType: {
    type: String,
    enum: ['task_confirmation', 'reward_redemption', 'parent_adjustment'],
    required: true
  },
  sourceId: { type: String, required: true, maxlength: 128 },
  idempotencyKey: { type: String, maxlength: 128 },
  createdBy: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

starLedgerEntrySchema.index(
  { familyId: 1, childId: 1, sourceType: 1, sourceId: 1, type: 1 },
  { unique: true }
);
starLedgerEntrySchema.index(
  { familyId: 1, childId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

starLedgerEntrySchema.pre('save', function rejectUpdates(next) {
  if (!this.isNew) return next(immutableLedgerError());
  return next();
});
starLedgerEntrySchema.pre('deleteOne', { document: true, query: false }, function rejectDelete(next) {
  next(immutableLedgerError());
});
['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'].forEach((operation) => {
  starLedgerEntrySchema.pre(operation, { document: false, query: true }, function rejectQuery(next) {
    next(immutableLedgerError());
  });
});

module.exports = mongoose.models.StarLedgerEntry
  || mongoose.model('StarLedgerEntry', starLedgerEntrySchema);
