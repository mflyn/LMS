const mongoose = require('mongoose');
const { Schema } = mongoose;
const oid = { type: Schema.Types.ObjectId, required: true };
const amount = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
const version = { ...amount, min: 1, default: 1 };
const scope = { familyId: oid, childId: oid };
function model(name, fields, indexes = []) {
  const schema = new Schema(fields, { strict: 'throw', timestamps: true, minimize: false });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return mongoose.models[name] || mongoose.model(name, schema);
}
const Cycle = model('Ai1Cycle', { ...scope, createdBy: oid, sourceType: { type: String, enum: ['task', 'mistake'], required: true },
  sourceId: oid, sourceSubject: { type: String, required: true }, subjectAliasVersion: { type: String, required: true },
  input: { type: Schema.Types.Mixed, required: true, immutable: true }, chapter: { type: Schema.Types.Mixed, required: true, immutable: true },
  inputHash: { type: String, required: true, immutable: true }, preview: { type: Schema.Types.Mixed, required: true, immutable: true },
  status: { type: String, enum: ['ready', 'generating', 'candidate', 'approved', 'rejected', 'closed'], required: true },
  active: { type: Boolean, required: true }, stateVersion: version, activeJobId: Schema.Types.ObjectId,
  currentArtifactId: Schema.Types.ObjectId, approvedArtifactId: Schema.Types.ObjectId, closure: Schema.Types.Mixed
}, [[{ familyId: 1, childId: 1, sourceType: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: 'ai1_active_source' }]]);
const Job = model('Ai1Job', { ...scope, cycleId: oid, createdBy: oid, operationId: { type: String, required: true },
  requestHash: { type: String, required: true }, remoteOperationId: { type: String, required: true },
  reservationId: oid, preview: { type: Schema.Types.Mixed, required: true, immutable: true }, maxAuthorizedCostMicros: amount,
  sendNotAfter: { type: Date, required: true, immutable: true },
  status: { type: String, enum: ['reserved', 'dispatching', 'unknown', 'succeeded', 'failed'], required: true },
  owner: String, leaseExpiresAt: Date, remoteRequestHash: String, remoteClaimObserved: { type: Boolean, default: false },
  failureCode: String, artifactId: Schema.Types.ObjectId, outcomeHash: String,
  evidence: Schema.Types.Mixed
}, [[{ cycleId: 1 }, { unique: true }], [{ remoteOperationId: 1 }, { unique: true }]]);
const Artifact = model('Ai1Artifact', { ...scope, cycleId: oid, version, text: { type: String, required: true, immutable: true },
  contentHash: { type: String, required: true, immutable: true }, createdBy: oid,
  origin: { type: String, enum: ['ai_generation', 'parent_revision'], required: true },
  derivedFromArtifactId: Schema.Types.ObjectId, generation: { type: Schema.Types.Mixed, required: true, immutable: true },
  revisionReason: String, status: { type: String, enum: ['candidate', 'parent_approved', 'rejected', 'superseded'], required: true },
  reviewVersion: version, review: Schema.Types.Mixed
}, [[{ cycleId: 1, version: 1 }, { unique: true }]]);
const Command = model('Ai1Command', { ...scope, actorId: oid, endpointOperation: { type: String, required: true },
  operationId: { type: String, required: true }, requestHash: { type: String, required: true },
  result: { type: Schema.Types.Mixed, required: true }
}, [[{ familyId: 1, actorId: 1, endpointOperation: 1, operationId: 1 }, { unique: true }]]);
const Reservation = model('Ai1Reservation', { ...scope, jobId: oid, reservedMicros: amount, settledMicros: { type: Number, default: null },
  state: { type: String, enum: ['reserved', 'reserved_unknown', 'settled', 'released'], required: true },
  reservedDay: { type: String, required: true }, reservedMonth: { type: String, required: true },
  reservedTimezone: { type: String, required: true }, settledAt: Date
}, [[{ jobId: 1 }, { unique: true }]]);
const Account = model('Ai1Account', { _id: String, outstandingMicros: { ...amount, default: 0 },
  settledMicros: { ...amount, default: 0 }, revision: { ...amount, default: 0 }, halted: { type: Boolean, default: false } });
const Slot = model('Ai1SendSlot', { _id: String, jobId: Schema.Types.ObjectId });
module.exports = { Cycle, Job, Artifact, Command, Reservation, Account, Slot };
