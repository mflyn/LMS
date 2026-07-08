const mongoose = require('mongoose');

const { Schema } = mongoose;

const familyUserSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, index: true },
  role: { type: String },
  childProfile: {
    tokenVersion: { type: Number, default: 0 }
  }
}, {
  collection: 'users',
  strict: false
});

const FamilyUser = mongoose.models.ResourceFamilyUser
  || mongoose.model('ResourceFamilyUser', familyUserSchema);

module.exports = FamilyUser;
