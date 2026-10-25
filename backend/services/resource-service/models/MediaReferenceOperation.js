const mongoose = require('mongoose');

const { Schema } = mongoose;
const STATES = Object.freeze(['PREPARED', 'COMMITTED', 'ABORTED']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const objectId = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });
const digest = () => ({ type: String, required: true, immutable: true, match: /^[0-9a-f]{64}$/ });
const completionField = () => ({ type: String, enum: ['completionMediaIds'], required: true, immutable: true });
const referenceSchema = new Schema({
  mediaId: objectId(), field: completionField()
}, { _id: false, strict: 'throw' });

// Only the new completion protocol uses this ledger. Terminal rows have no TTL:
// deleting them would allow a delayed prepare to resurrect an aborted operation.
const schema = new Schema({
  familyId: objectId(), childId: objectId(), resourceId: objectId(),
  resourceType: { type: String, enum: ['growth_task'], required: true, immutable: true },
  field: completionField(),
  operationId: { type: String, required: true, immutable: true, lowercase: true, match: UUID },
  commandHash: digest(),
  referenceSetHash: digest(),
  references: {
    type: [referenceSchema], required: true, default: undefined, immutable: true, castNonArrays: false,
    set(value) {
      if (value === undefined || Array.isArray(value)) return value;
      throw new mongoose.Error.CastError('Array', value, 'references');
    },
    validate: (refs) => Array.isArray(refs) && refs.length >= 1 && refs.length <= 10
      && refs.every((ref) => ref?.mediaId != null)
      && new Set(refs.map((ref) => String(ref.mediaId))).size === refs.length
  },
  state: { type: String, enum: STATES, required: true },
  version: { type: Number, default: 0, required: true, min: 0, validate: Number.isSafeInteger },
  leaseExpiresAt: { type: Date, default: null },
  terminalAt: { type: Date, default: null },
  failureCode: { type: String, default: null, match: /^[A-Z][A-Z0-9_]{0,79}$/ }
}, { timestamps: true, strict: 'throw' });

schema.pre('validate', function validateStateEvidence() {
  const prepared = this.state === 'PREPARED';
  if (prepared !== (this.leaseExpiresAt != null)) {
    this.invalidate('leaseExpiresAt', 'Only PREPARED requires a lease');
  }
  if (prepared === (this.terminalAt != null)) {
    this.invalidate('terminalAt', 'Only terminal operations require terminalAt');
  }
  if (this.state === 'ABORTED' ? !this.failureCode : this.failureCode != null) {
    this.invalidate('failureCode', 'Only ABORTED requires a stable failure code');
  }
});

schema.index(
  { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1, operationId: 1 },
  { unique: true, name: 'media_reference_operation_scope' }
);

schema.index({ 'references.mediaId': 1, _id: 1 }, { name: 'completion_operation_media_history' });

const MediaReferenceOperation = mongoose.models.MediaReferenceOperation
  || mongoose.model('MediaReferenceOperation', schema);
MediaReferenceOperation.STATES = STATES;
module.exports = MediaReferenceOperation;
