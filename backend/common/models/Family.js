const mongoose = require('mongoose');
const { Schema } = mongoose;

const familySchema = new Schema({
  familyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  ownerParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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

familySchema.index({ ownerParentId: 1 }, { unique: true });
familySchema.index({ memberParentIds: 1 });
familySchema.index({ childIds: 1 });

module.exports = mongoose.models.Family || mongoose.model('Family', familySchema);
