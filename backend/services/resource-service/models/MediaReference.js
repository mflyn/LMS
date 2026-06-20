const mongoose = require('mongoose');

const { Schema } = mongoose;

const MEDIA_RESOURCE_FIELDS = Object.freeze({
  child: Object.freeze(['avatarMediaId']),
  growth_task: Object.freeze(['attachmentMediaIds']),
  family_mistake: Object.freeze(['questionMediaId', 'childAnswerMediaId'])
});
const MEDIA_RESOURCE_TYPES = Object.freeze(Object.keys(MEDIA_RESOURCE_FIELDS));
const MEDIA_REFERENCE_STATES = Object.freeze(['prepared', 'bound', 'released']);
const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mediaReferenceSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mediaId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', required: true },
  resourceType: { type: String, enum: MEDIA_RESOURCE_TYPES, required: true },
  resourceId: { type: Schema.Types.ObjectId, required: true },
  field: {
    type: String,
    required: true,
    validate: {
      validator(value) {
        return MEDIA_RESOURCE_FIELDS[this.resourceType]
          && MEDIA_RESOURCE_FIELDS[this.resourceType].includes(value);
      },
      message: 'field is not valid for resourceType'
    }
  },
  operationId: {
    type: String,
    required: true,
    validate: { validator: (value) => OPERATION_ID_PATTERN.test(value), message: 'operationId must be a UUID' }
  },
  state: { type: String, enum: MEDIA_REFERENCE_STATES, default: 'prepared', required: true },
  leaseExpiresAt: {
    type: Date,
    default: null,
    required: [function requireLease() { return this.state === 'prepared'; }, 'leaseExpiresAt is required for prepared references']
  },
  releasedAt: {
    type: Date,
    default: null,
    required: [function requireReleaseTime() { return this.state === 'released'; }, 'releasedAt is required for released references'],
    validate: {
      validator(value) { return this.state === 'released' || value == null; },
      message: 'releasedAt is only valid for released references'
    }
  }
}, { timestamps: true });

mediaReferenceSchema.index(
  { familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 },
  { unique: true }
);
mediaReferenceSchema.index({ familyId: 1, childId: 1, mediaId: 1, state: 1 });
mediaReferenceSchema.index({ state: 1, leaseExpiresAt: 1 });

const MediaReference = mongoose.models.MediaReference
  || mongoose.model('MediaReference', mediaReferenceSchema);

MediaReference.MEDIA_REFERENCE_STATES = MEDIA_REFERENCE_STATES;
MediaReference.MEDIA_RESOURCE_FIELDS = MEDIA_RESOURCE_FIELDS;
MediaReference.MEDIA_RESOURCE_TYPES = MEDIA_RESOURCE_TYPES;

module.exports = MediaReference;
