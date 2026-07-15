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
const MEDIA_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const PDF_MEDIA_PURPOSES = new Set(['task_attachment', 'mistake_question', 'mistake_answer']);
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_DISPLAY_NAME_BYTES = 255;
const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const truncateUtf8 = (value, maxBytes) => {
  let result = '';
  let length = 0;
  for (const character of value) {
    const characterLength = Buffer.byteLength(character, 'utf8');
    if (length + characterLength > maxBytes) break;
    result += character;
    length += characterLength;
  }
  return result;
};

const sanitizeDisplayName = (originalName) => {
  const basename = String(originalName || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .pop() || '';
  const sanitized = basename.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return truncateUtf8(sanitized, MAX_DISPLAY_NAME_BYTES) || 'media';
};

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
  mimeType: {
    type: String,
    enum: MEDIA_MIME_TYPES,
    required: true,
    validate: {
      validator(value) {
        return value !== 'application/pdf' || PDF_MEDIA_PURPOSES.has(this.purpose);
      },
      message: 'PDF is not allowed for this media purpose'
    }
  },
  displayName: {
    type: String,
    default: 'media',
    required: true,
    validate: {
      validator(value) {
        return typeof value === 'string' && value === sanitizeDisplayName(value);
      },
      message: 'displayName must be a sanitized basename'
    }
  },
  sizeBytes: { type: Number, min: 1, max: MAX_MEDIA_BYTES, required: true },
  pageCount: {
    type: Number,
    default: null,
    min: 1,
    max: 50,
    required: [function requirePageCount() { return this.mimeType === 'application/pdf'; }, 'pageCount is required for PDF media'],
    validate: {
      validator(value) {
        if (this.mimeType !== 'application/pdf') return value == null;
        return Number.isInteger(value);
      },
      message: 'pageCount is only valid for PDF media'
    }
  },
  storageKey: {
    type: String,
    required: true,
    validate: { validator: (value) => STORAGE_KEY_PATTERN.test(value), message: 'storageKey must be a UUID' }
  },
  malwareScanStatus: {
    type: String,
    enum: ['legacy_unscanned', 'skipped_trusted_local', 'clean'],
    default: 'legacy_unscanned',
    required: true
  },
  malwareScannedAt: {
    type: Date,
    default: null,
    required: [function requireMalwareScannedAt() { return this.malwareScanStatus === 'clean'; }, 'malwareScannedAt is required for clean media'],
    validate: {
      validator(value) {
        return this.malwareScanStatus === 'clean' || value == null;
      },
      message: 'malwareScannedAt is only valid for clean media'
    }
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
MediaAsset.MAX_DISPLAY_NAME_BYTES = MAX_DISPLAY_NAME_BYTES;
MediaAsset.STORAGE_KEY_PATTERN = STORAGE_KEY_PATTERN;
MediaAsset.sanitizeDisplayName = sanitizeDisplayName;

module.exports = MediaAsset;
