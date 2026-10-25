const mongoose = require('mongoose');
const Asset = require('./MediaAsset');
const { Schema } = mongoose;
const id = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });
const schema = new Schema({
  mediaId: id(), familyId: id(), childId: id(),
  retirementId: { type: String, required: true, immutable: true,
    match: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ },
  storageKey: { type: String, required: true, immutable: true, match: Asset.STORAGE_KEY_PATTERN },
  uploadMetadataHash: { type: String, required: true, immutable: true, match: /^[0-9a-f]{64}$/ },
  retentionPolicyVersion: { type: Number, required: true, immutable: true, enum: [1] },
  orphanEligibleAt: { type: Date, required: true, immutable: true },
  actorType: { type: String, required: true, immutable: true, enum: ['system'] },
  state: { type: String, required: true, enum: ['CANDIDATE', 'FENCED', 'DELETED', 'PURGED', 'SUPERSEDED', 'INCONSISTENT'] },
  revision: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  createdAt: { type: Date, required: true, immutable: true },
  deletedAt: { type: Date, default: null },
  purgedAt: { type: Date, default: null },
  evidence: { type: Schema.Types.Mixed, default: null }
}, { strict: 'throw', versionKey: false });
schema.pre('validate', function validateEvidence() {
  const deleted = ['DELETED', 'PURGED'].includes(this.state);
  if (deleted && (!this.evidence || !this.deletedAt)) this.invalidate('evidence', 'System deletion evidence is required');
  if (this.state === 'PURGED' && !this.purgedAt) this.invalidate('purgedAt', 'Purge time is required');
});
schema.index({ mediaId: 1 }, { unique: true, name: 'orphan_retirement_identity' });
schema.index({ state: 1, createdAt: 1, mediaId: 1 }, { name: 'orphan_retirement_recovery' });
module.exports = mongoose.models.MediaOrphanRetirement || mongoose.model('MediaOrphanRetirement', schema);
