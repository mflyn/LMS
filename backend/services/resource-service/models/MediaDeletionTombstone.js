const mongoose = require('mongoose');
const { Schema } = mongoose;
const identity = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });

const schema = new Schema({
  mediaId: identity(), familyId: identity(), childId: identity(), actorId: identity(),
  role: { type: String, enum: ['parent', 'student'], required: true, immutable: true },
  purpose: { type: String, enum: ['task_completion'], required: true, immutable: true },
  reason: { type: String, enum: ['user_requested'], required: true, immutable: true },
  deletedAt: { type: Date, required: true, immutable: true }
}, { strict: 'throw', versionKey: false });
// No TTL: deletion evidence must survive content retention and old-command replay.
schema.index({ mediaId: 1 }, { unique: true });
schema.index({ familyId: 1, childId: 1, mediaId: 1 });
module.exports = mongoose.models.MediaDeletionTombstone || mongoose.model('MediaDeletionTombstone', schema);
