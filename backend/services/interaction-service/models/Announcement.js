const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnnouncementSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  attachments: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String },
    size: { type: Number }
  }],
}, {
  timestamps: true
});

AnnouncementSchema.index({ class: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);