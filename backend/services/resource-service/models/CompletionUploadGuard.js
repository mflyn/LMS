const mongoose = require('mongoose');
const Asset = require('./MediaAsset');
const { Schema } = mongoose;
const schema = new Schema({
  mediaId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  familyId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  childId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  storageKey: { type: String, required: true, immutable: true, match: Asset.STORAGE_KEY_PATTERN },
  metadataHash: { type: String, required: true, immutable: true, match: /^[0-9a-f]{64}$/ },
  state: { type: String, enum: ['REGISTERED', 'RETIRED'], required: true },
  revision: { type: Number, required: true, min: 1, validate: Number.isSafeInteger }
}, { timestamps: true, strict: 'throw' });
schema.index({ mediaId: 1 }, { unique: true, name: 'completion_upload_identity' });
module.exports = mongoose.models.CompletionUploadGuard || mongoose.model('CompletionUploadGuard', schema);
