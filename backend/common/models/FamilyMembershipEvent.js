const mongoose = require('mongoose');

const { Schema } = mongoose;
const ACTIONS = Object.freeze([
  'invitation_created',
  'invitation_revoked',
  'member_joined',
  'member_left',
  'member_removed',
  'ownership_transferred'
]);

const familyMembershipEventSchema = new Schema({
  familyId: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    immutable: true,
    index: true
  },
  action: {
    type: String,
    enum: ACTIONS,
    required: true,
    immutable: true
  },
  actorParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },
  targetParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    immutable: true
  },
  invitationId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyParentInvitation',
    default: null,
    immutable: true
  },
  previousOwnerParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    immutable: true
  },
  newOwnerParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    immutable: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  strict: 'throw'
});

familyMembershipEventSchema.index({ familyId: 1, createdAt: 1 });

const FamilyMembershipEvent = mongoose.models.FamilyMembershipEvent
  || mongoose.model('FamilyMembershipEvent', familyMembershipEventSchema);

FamilyMembershipEvent.ACTIONS = ACTIONS;

module.exports = FamilyMembershipEvent;
