const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String },
    size: { type: Number }
  }],
  read: {
    type: Boolean,
    default: false
  },
}, {
  timestamps: true
});

MessageSchema.index({ receiver: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);