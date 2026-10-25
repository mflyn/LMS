const mongoose = require('mongoose');
const { Schema } = mongoose;
const identity = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });
const schema = new Schema({
  mediaId: identity(), familyId: identity(), childId: identity(), resourceId: identity(),
  resourceType: { type: String, enum: ['growth_task'], required: true, immutable: true },
  field: { type: String, enum: ['completionMediaIds'], required: true, immutable: true },
  bindingOperationId: { type: String, required: true, immutable: true, lowercase: true,
    match: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
  releasedAt: { type: Date, required: true, immutable: true }
}, { strict: 'throw', versionKey: false });
schema.index({ familyId: 1, childId: 1, mediaId: 1, resourceType: 1, resourceId: 1,
  field: 1, bindingOperationId: 1 }, { unique: true });
module.exports = mongoose.models.MediaDeletionReceipt || mongoose.model('MediaDeletionReceipt', schema);
