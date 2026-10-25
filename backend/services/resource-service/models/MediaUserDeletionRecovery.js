const mongoose = require('mongoose');
const { validateEvidence } = require('../services/userDeletionRecoveryEvidence');

const { Schema } = mongoose;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });
const invalid = () => Object.assign(new Error('Invalid user deletion recovery evidence'), {
  code: 'USER_DELETION_EVIDENCE_INVALID'
});
const immutable = () => { throw Object.assign(new Error('User deletion recovery evidence is append-only'), {
  code: 'USER_DELETION_EVIDENCE_IMMUTABLE'
}); };
const schema = new Schema({
  _id: { type: String, required: true, immutable: true, match: UUID },
  mediaId: id(), familyId: id(), childId: id(),
  version: { type: Number, required: true, immutable: true, enum: [2] },
  evidence: { type: Schema.Types.Mixed, required: true, immutable: true },
  evidenceHash: { type: String, required: true, immutable: true, match: /^[0-9a-f]{64}$/ },
  createdAt: { type: Date, required: true, immutable: true },
  restoredAt: { type: Date, immutable: true }
}, { strict: 'throw', versionKey: false, collection: 'mediauserdeletionrecoveries' });

const assertProof = document => {
  try {
    const stored = document.toObject({ getters: false, virtuals: false, transform: false, depopulate: true });
    const fields = ['_id', 'mediaId', 'familyId', 'childId', 'version', 'evidence', 'evidenceHash', 'createdAt', 'restoredAt'];
    if (Object.keys(stored).some(key => !fields.includes(key))) throw invalid();
    const proof = validateEvidence(document.evidence);
    if (document._id !== proof.evidenceId || document.version !== 2 || document.evidenceHash !== proof.evidenceHash
      || ['mediaId', 'familyId', 'childId'].some(key => String(document[key]) !== proof.tombstone[key])
      || !(document.createdAt instanceof Date) || document.createdAt.toISOString() !== proof.evidenceCreatedAt
      || document.restoredAt != null && (!(document.restoredAt instanceof Date)
        || !Number.isFinite(document.restoredAt.getTime()) || document.restoredAt < document.createdAt)) throw invalid();
  } catch (_cause) { throw invalid(); }
};
schema.pre('validate', function checkProof() { assertProof(this); });
schema.pre('save', function enforceAppendOnly() {
  if (!this.isNew) immutable();
  // Disabling Mongoose validation must not bypass the recovery evidence contract.
  if (this.validateSync()) throw invalid();
  assertProof(this);
});
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
  'deleteMany', 'findOneAndDelete']) schema.pre(operation, immutable);
schema.pre('deleteOne', { document: true, query: true }, immutable);
schema.pre('bulkWrite', immutable);
schema.pre('insertMany', immutable);

schema.index({ mediaId: 1 }, { unique: true, name: 'user_deletion_recovery_media' });
module.exports = mongoose.models.MediaUserDeletionRecovery || mongoose.model('MediaUserDeletionRecovery', schema);
