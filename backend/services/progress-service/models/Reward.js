const mongoose = require('mongoose');

const { Schema } = mongoose;

const rewardSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, trim: true, required: true, maxlength: 100 },
  requiredStars: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: Number.isInteger, message: 'requiredStars must be an integer' }
  },
  status: { type: String, enum: ['active', 'redeemed', 'disabled'], default: 'active' },
  createdByParentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  redeemedAt: Date,
  redeemedByParentId: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

rewardSchema.index({ familyId: 1, childId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Reward || mongoose.model('Reward', rewardSchema);
