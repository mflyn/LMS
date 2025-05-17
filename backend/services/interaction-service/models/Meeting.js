const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MeetingSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  endTime: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    default: '线上会议',
    trim: true
  },
  status: {
    type: String,
    enum: ['待确认', '已确认', '已取消', '已完成'],
    default: '待确认',
    index: true
  },
  meetingType: {
    type: String,
    enum: ['线上', '线下'],
    default: '线上'
  },
  meetingLink: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
MeetingSchema.index({ teacher: 1, startTime: 1, status: 1 });
MeetingSchema.index({ parent: 1, startTime: 1, status: 1 });
MeetingSchema.index({ student: 1, startTime: 1, status: 1 });

module.exports = mongoose.model('Meeting', MeetingSchema);