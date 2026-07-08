const mongoose = require('mongoose');

const { Schema } = mongoose;

const MEDIA_PURPOSES = Object.freeze([
  'avatar',
  'task_attachment',
  'task_completion',
  'mistake_question',
  'mistake_answer',
  'growth_evidence'
]);
const MEDIA_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mediaAssetSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    required: [function requireChild() { return this.purpose !== 'avatar'; }, 'childId is required unless purpose is avatar']
  },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: MEDIA_PURPOSES, required: true },
  mimeType: { type: String, enum: MEDIA_MIME_TYPES, required: true },
  sizeBytes: { type: Number, min: 1, max: MAX_MEDIA_BYTES, required: true },
  storageKey: {
    type: String,
    required: true,
    validate: { validator: (value) => STORAGE_KEY_PATTERN.test(value), message: 'storageKey must be a UUID' }
  },
  status: { type: String, enum: ['active', 'deleted'], default: 'active', required: true },
  deletedAt: {
    type: Date,
    default: null,
    required: [function requireDeletedAt() { return this.status === 'deleted'; }, 'deletedAt is required for deleted media'],
    validate: {
      validator(value) { return this.status === 'deleted' || value == null; },
      message: 'deletedAt is only valid for deleted media'
    }
  }
}, { timestamps: true });

mediaAssetSchema.index({ familyId: 1, childId: 1, status: 1, createdAt: -1 });
mediaAssetSchema.index({ familyId: 1, storageKey: 1 }, { unique: true });
mediaAssetSchema.index({ status: 1, deletedAt: 1 });

const MediaAsset = mongoose.models.MediaAsset || mongoose.model('MediaAsset', mediaAssetSchema);

MediaAsset.MEDIA_MIME_TYPES = MEDIA_MIME_TYPES;
MediaAsset.MEDIA_PURPOSES = MEDIA_PURPOSES;
MediaAsset.MAX_MEDIA_BYTES = MAX_MEDIA_BYTES;
MediaAsset.STORAGE_KEY_PATTERN = STORAGE_KEY_PATTERN;

module.exports = MediaAsset;
