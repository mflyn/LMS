const mongoose = require('mongoose');
const { Schema } = mongoose;
const oid = { type: Schema.Types.ObjectId, required: true };
const version = { type: Number, required: true, min: 1, validate: Number.isSafeInteger };
const digest = { type: String, required: true, match: /^[a-f0-9]{64}$/ };
const scope = { familyId: oid, childId: oid };
const snapshot = { type: Schema.Types.Mixed, required: true, immutable: true };
function model(name, fields, indexes) {
  const schema = new Schema(fields, { strict: 'throw', timestamps: true, minimize: false });
  for (const [key, options] of indexes) schema.index(key, options);
  return mongoose.models[name] || mongoose.model(name, schema);
}
const Package = model('Ai2Package', { ...scope, ai1CycleId: oid, source: snapshot, artifact: snapshot,
  childSnapshot: snapshot, childSnapshotHash: { ...digest, immutable: true }, publishedBy: oid,
  publishedAt: { type: Date, required: true, immutable: true },
  visibility: { type: String, enum: ['published', 'withdrawn'], required: true },
  learningState: { type: String, enum: ['open', 'submitted', 'revise', 'approved'], required: true },
  stateVersion: version, currentAttemptId: { type: Schema.Types.ObjectId, default: null },
  currentAttemptVersion: { type: Number, default: null }, activeCommandId: { type: Schema.Types.ObjectId, default: null },
  withdrawal: { type: Schema.Types.Mixed, default: null }
}, [[{ familyId: 1, childId: 1, ai1CycleId: 1 },
  { unique: true, name: 'ai2_active_publication', partialFilterExpression: { visibility: 'published' } }]]);
const Attempt = model('Ai2Attempt', { ...scope, packageId: oid, attemptVersion: version, submitCommandId: oid,
  submittedBy: oid, submittedAt: { type: Date, required: true, immutable: true },
  note: { type: String, default: '', immutable: true }, mediaIds: { type: [Schema.Types.ObjectId], required: true, immutable: true,
    validate: values => values.length >= 1 && values.length <= 10 && new Set(values.map(String)).size === values.length },
  mediaBindings: snapshot, payloadHash: { ...digest, immutable: true }, review: { type: Schema.Types.Mixed, default: null }
}, [[{ packageId: 1, attemptVersion: 1 }, { unique: true, name: 'ai2_attempt_version' }],
  [{ submitCommandId: 1 }, { unique: true, name: 'ai2_attempt_command' }]]);
const Command = model('Ai2Command', { ...scope, packageId: oid, actorId: oid,
  endpointOperation: { type: String, enum: ['ai2.publish', 'ai2.withdraw', 'ai2.review', 'ai2.submit'], required: true },
  operationId: { type: String, required: true }, requestHash: digest, payload: snapshot,
  expectedPackageVersion: Number, reservedPackageVersion: Number, attemptId: Schema.Types.ObjectId, attemptVersion: Number,
  remoteOperationId: String, references: Schema.Types.Mixed, referencesHash: String,
  phase: { type: String, enum: ['RESERVED', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING', 'SUCCEEDED', 'FAILED'], required: true },
  owner: String, leaseExpiresAt: Date, resultReference: Schema.Types.Mixed, failureCode: String
}, [[{ familyId: 1, actorId: 1, endpointOperation: 1, operationId: 1 }, { unique: true, name: 'ai2_actor_command' }],
  [{ remoteOperationId: 1 }, { unique: true, name: 'ai2_remote_operation', partialFilterExpression: { remoteOperationId: { $type: 'string' } } }],
  [{ familyId: 1, childId: 1, actorId: 1, phase: 1, createdAt: 1 }, { name: 'ai2_actor_discovery' }]]);
module.exports = { Package, Attempt, Command };
