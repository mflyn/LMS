const mongoose = require('mongoose');

const { Schema } = mongoose;
const STATUSES = Object.freeze(['pending', 'accepted', 'revoked', 'expired']);

const familyParentInvitationSchema = new Schema({
  familyId: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true
  },
  invitedByParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tokenDigest: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-f0-9]{64}$/
  },
  status: {
    type: String,
    enum: STATUSES,
    required: true,
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  acceptedByParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  acceptedAt: {
    type: Date,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  strict: 'throw'
});

familyParentInvitationSchema.index(
  { familyId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
    name: 'one_pending_parent_invitation_per_family'
  }
);
familyParentInvitationSchema.index({ familyId: 1, status: 1, expiresAt: 1 });

const FamilyParentInvitation = mongoose.models.FamilyParentInvitation
  || mongoose.model('FamilyParentInvitation', familyParentInvitationSchema);

FamilyParentInvitation.STATUSES = STATUSES;

module.exports = FamilyParentInvitation;
