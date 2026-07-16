const mongoose = require('mongoose');
const { Schema } = mongoose;
const { isValidTimeZone } = require('../utils/familyDate');

const familySchema = new Schema({
  familyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  timezone: {
    type: String,
    required: true,
    default: 'Asia/Shanghai',
    validate: {
      validator: isValidTimeZone,
      message: 'timezone must be a valid IANA timezone'
    }
  },
  ownerParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  memberParentIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  childIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

familySchema.index({ memberParentIds: 1 });
familySchema.index({ childIds: 1 });

familySchema.pre('validate', function validateParentMembership(next) {
  const ownerId = this.ownerParentId ? this.ownerParentId.toString() : null;
  const memberIds = (this.memberParentIds || []).map((id) => id.toString());
  const uniqueMemberIds = new Set(memberIds);

  if (!ownerId || memberIds.length < 1 || memberIds.length > 2
    || uniqueMemberIds.size !== memberIds.length || !uniqueMemberIds.has(ownerId)) {
    this.invalidate(
      'memberParentIds',
      'memberParentIds must contain the owner exactly once and at most one additional parent'
    );
  }

  next();
});

module.exports = mongoose.models.Family || mongoose.model('Family', familySchema);
