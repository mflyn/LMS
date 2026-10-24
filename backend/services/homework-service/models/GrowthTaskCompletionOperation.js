const mongoose = require('mongoose');

const { Schema } = mongoose;
const PHASES = Object.freeze(['PREPUBLISH', 'PUBLISHED_CLEANUP', 'SUCCEEDED', 'FAILED']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const objectId = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });
const uuid = () => ({ type: String, required: true, immutable: true, lowercase: true, match: UUID });
const integer = (min) => ({ type: Number, required: true, min, validate: Number.isSafeInteger });
const nestedOptions = { _id: false, strict: 'throw' };

const taskSnapshotSchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['completed'], required: true },
  checklistVersion: integer(0),
  completionVersion: integer(1),
  completionMediaIds: {
    type: [Schema.Types.ObjectId], required: true, default: undefined, castNonArrays: false,
    validate: (ids) => Array.isArray(ids) && ids.length <= 10
      && ids.every((id) => id != null) && new Set(ids.map(String)).size === ids.length
  },
  completionMediaReferenceState: { type: String, enum: ['stable'], required: true },
  parentConfirmed: { type: Boolean, required: true, validate: (value) => value === false },
  completedAt: { type: Date, required: true }
}, nestedOptions);
const successSchema = new Schema({
  success: { type: Boolean, required: true, validate: (value) => value === true },
  data: {
    type: new Schema({ task: { type: taskSnapshotSchema, required: true } }, nestedOptions),
    required: true
  }
}, nestedOptions);

// This ledger is not a public task DTO. The orchestration service must CAS phase/version
// and publish the snapshot in the same transaction as the task; schema validation alone cannot do that.
const schema = new Schema({
  familyId: objectId(), childId: objectId(), taskId: objectId(), actorId: objectId(),
  action: { type: String, enum: ['complete'], required: true, immutable: true },
  operationId: uuid(),
  remoteOperationId: uuid(),
  commandHash: { type: String, required: true, immutable: true, match: HASH },
  targetCompletionVersion: { ...integer(1), immutable: true },
  phase: { type: String, enum: PHASES, required: true, default: 'PREPUBLISH' },
  version: { ...integer(0), default: 0 },
  successResponse: { type: successSchema, default: null },
  failureCode: { type: String, default: null, match: /^[A-Z][A-Z0-9_]{0,79}$/ },
  failureStatus: { type: Number, default: null, min: 400, max: 499, validate: (value) => value == null || Number.isInteger(value) }
}, { timestamps: true, strict: 'throw' });

schema.pre('validate', function validateResult() {
  const published = this.phase === 'PUBLISHED_CLEANUP' || this.phase === 'SUCCEEDED';
  if (published !== (this.successResponse != null)) {
    this.invalidate('successResponse', 'A success snapshot is required exactly when published');
  }
  const task = this.successResponse?.data?.task;
  if (task && (String(task.taskId) !== String(this.taskId)
    || task.completionVersion !== this.targetCompletionVersion)) {
    this.invalidate('successResponse', 'Snapshot identity and version must match the command');
  }
  if (this.phase === 'FAILED') {
    if (!this.failureCode || this.failureStatus == null) {
      this.invalidate('failureCode', 'A failed command requires a stable error code and HTTP status');
    }
  } else if (this.failureCode != null || this.failureStatus != null) {
    this.invalidate('failureCode', 'Failure results are only valid in FAILED');
  }
});

schema.index(
  { familyId: 1, childId: 1, taskId: 1, actorId: 1, action: 1, operationId: 1 },
  { unique: true, name: 'completion_command_scope' }
);
schema.index({ remoteOperationId: 1 }, { unique: true, name: 'completion_remote_operation' });

const GrowthTaskCompletionOperation = mongoose.models.GrowthTaskCompletionOperation
  || mongoose.model('GrowthTaskCompletionOperation', schema);
GrowthTaskCompletionOperation.PHASES = PHASES;
module.exports = GrowthTaskCompletionOperation;
