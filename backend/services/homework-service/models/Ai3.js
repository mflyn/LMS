const mongoose = require('mongoose');
const { Schema } = mongoose;
const oid = { type: Schema.Types.ObjectId, required: true };
const version = { type: Number, min: 1, required: true, validate: Number.isSafeInteger };
const digest = { type: String, required: true, match: /^[a-f0-9]{64}$/ };
const snapshot = { type: Schema.Types.Mixed, required: true, immutable: true };
const scope = { familyId: oid, childId: oid };
function model(name, fields, indexes) {
  const schema = new Schema(fields, { strict: 'throw', timestamps: true, minimize: false });
  for (const [key, options] of indexes) schema.index(key, options);
  return mongoose.models[name] || mongoose.model(name, schema);
}
const Round = model('Ai3Round', { ...scope, sourcePackageId: oid, sourceAttemptId: oid, sourceAttemptVersion: version,
  sourceAttemptPayloadHash: digest, sourceReviewHash: digest, source: snapshot, chapter: snapshot,
  knowledgePointId: { type: Schema.Types.ObjectId, default: null }, exerciseCount: { type: Number, enum: [2, 3], required: true },
  createdBy: oid, stateVersion: version, active: { type: Boolean, required: true },
  activeCommandId: { type: Schema.Types.ObjectId, default: null },
  generationCommandId: { type: Schema.Types.ObjectId, default: null },
  preparation: { type: String, enum: ['ready', 'generating', 'candidate', 'rejected'], required: true },
  visibility: { type: String, enum: ['draft', 'published', 'withdrawn'], required: true },
  learningState: { type: String, enum: ['open', 'submitted', 'revise', 'passed'], required: true },
  cancelledAt: { type: Date, default: null }, cancellation: Schema.Types.Mixed,
  currentContentId: { type: Schema.Types.ObjectId, default: null }, currentContentVersion: { type: Number, default: null },
  currentContentHash: { type: String, default: null }, publication: Schema.Types.Mixed,
  currentAttemptId: { type: Schema.Types.ObjectId, default: null }, currentAttemptVersion: { type: Number, default: null },
  finalReviewId: { type: Schema.Types.ObjectId, default: null }, reviewReminderDate: { type: String, default: null },
  publishedBy: Schema.Types.ObjectId, publishedAt: Date, withdrawal: Schema.Types.Mixed
}, [[{ familyId: 1, childId: 1, sourcePackageId: 1 }, { unique: true, name: 'ai3_active_round', partialFilterExpression: { active: true } }]]);
const Content = model('Ai3Content', { ...scope, roundId: oid, version, content: snapshot, contentHash: { ...digest, immutable: true },
  childSnapshot: snapshot, childSnapshotHash: { ...digest, immutable: true }, createdBy: oid,
  origin: { type: String, enum: ['parent_manual', 'parent_revision', 'ai_generation'], required: true },
  derivedFromContentId: { type: Schema.Types.ObjectId, default: null }, reason: { type: String, required: true, immutable: true }
}, [[{ roundId: 1, version: 1 }, { unique: true, name: 'ai3_content_version' }]]);
const Command = model('Ai3Command', { ...scope, roundId: oid, actorId: oid,
  endpointOperation: { type: String, enum: ['ai3.create', 'ai3.revise_content', 'ai3.reject_content', 'ai3.publish', 'ai3.cancel', 'ai3.withdraw', 'ai3.generate', 'ai3.submit', 'ai3.review'], required: true },
  operationId: { type: String, required: true }, requestHash: digest, payload: snapshot,
  phase: { type: String, enum: ['RESERVED', 'DISPATCHING', 'UNKNOWN', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING', 'EFFECTS_PENDING', 'SUCCEEDED', 'FAILED'], required: true },
  resultReference: { type: Schema.Types.Mixed, default: null },
  expectedRoundVersion: Number, reservedRoundVersion: Number, attemptId: Schema.Types.ObjectId, attemptVersion: Number,
  serverContentBinding: { type: Schema.Types.Mixed, immutable: true },
  remoteOperationId: String, references: Schema.Types.Mixed, referencesHash: String, owner: String, leaseExpiresAt: Date,
  finalReview: { type: Schema.Types.Mixed, immutable: true }, finalReviewHash: { type: String, match: /^[a-f0-9]{64}$/, immutable: true },
  effects: Schema.Types.Mixed,
  remoteClaimObserved: { type: Boolean, default: false }, outcomeHash: String, remoteEvidence: Schema.Types.Mixed,
  failureCode: String,
  generation: { type: new Schema({ reservationId: oid,
    reservedCeilingMicros: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    remoteOperationId: String, remoteRequestHash: String, preview: Schema.Types.Mixed, sendNotAfter: Date,
    maxAuthorizedCostMicros: { type: Number, min: 0, validate: Number.isSafeInteger }
  }, { _id: false, strict: 'throw' }), immutable: true }
}, [[{ familyId: 1, actorId: 1, endpointOperation: 1, operationId: 1 }, { unique: true, name: 'ai3_actor_command' }],
  [{ remoteOperationId: 1 }, { unique: true, name: 'ai3_submission_remote_operation',
    partialFilterExpression: { remoteOperationId: { $type: 'string' } } }],
  [{ familyId: 1, childId: 1, actorId: 1, phase: 1, createdAt: 1 }, { name: 'ai3_actor_discovery' }],
  [{ 'generation.remoteOperationId': 1 }, { unique: true, name: 'ai3_remote_operation',
    partialFilterExpression: { 'generation.remoteOperationId': { $type: 'string' } } }]]);
const Attempt = model('Ai3Attempt', {
  familyId: { ...oid, immutable: true }, childId: { ...oid, immutable: true }, roundId: { ...oid, immutable: true },
  attemptVersion: { ...version, immutable: true }, submitCommandId: { ...oid, immutable: true }, submittedBy: { ...oid, immutable: true },
  submittedAt: { type: Date, required: true, immutable: true }, note: { type: String, default: '', immutable: true },
  serverContentBinding: snapshot, mediaBindings: snapshot, payloadHash: { ...digest, immutable: true },
  mediaIds: { type: [Schema.Types.ObjectId], required: true, immutable: true,
    validate: values => values.length >= 1 && values.length <= 10 && new Set(values.map(String)).size === values.length },
  review: { type: Schema.Types.Mixed, default: null }
}, [[{ roundId: 1, attemptVersion: 1 }, { unique: true, name: 'ai3_attempt_version' }],
  [{ submitCommandId: 1 }, { unique: true, name: 'ai3_attempt_command' }]]);
module.exports = { Round, Content, Command, Attempt };
