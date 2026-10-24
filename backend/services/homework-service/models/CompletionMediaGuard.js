const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema({
  familyId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  childId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  mediaId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  state: { type: String, enum: ['available', 'retired'], required: true, default: 'available' },
  revision: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  retirementId: { type: String, default: null, match: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ },
  retiredAt: { type: Date, default: null }
}, { timestamps: true, strict: 'throw' });

schema.pre('validate', function () {
  if (this.state === 'retired' ? !this.retirementId || !this.retiredAt : this.retirementId != null || this.retiredAt != null) {
    this.invalidate('state', 'Retirement requires immutable identity and time');
  }
});
schema.index({ familyId: 1, childId: 1, mediaId: 1 }, { unique: true, name: 'completion_media_guard_scope' });

module.exports = mongoose.models.CompletionMediaGuard || mongoose.model('CompletionMediaGuard', schema);
