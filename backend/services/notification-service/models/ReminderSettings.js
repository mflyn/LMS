const mongoose = require('mongoose');

const { Schema } = mongoose;

const ReminderSettingsSchema = new Schema({
  familyId: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    unique: true,
    index: true
  },
  taskReminderEnabled: {
    type: Boolean,
    default: true
  },
  overdueReminderEnabled: {
    type: Boolean,
    default: true
  },
  mistakeReviewReminderEnabled: {
    type: Boolean,
    default: true
  },
  dimensionReminderEnabled: {
    type: Boolean,
    default: true
  },
  weeklyReportReminderEnabled: {
    type: Boolean,
    default: true
  },
  weeklyReportDay: {
    type: Number,
    min: 1,
    max: 7,
    default: 7
  },
  quietHours: {
    start: {
      type: String,
      default: '21:00'
    },
    end: {
      type: String,
      default: '07:00'
    }
  },
  updatedByParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ReminderSettings
  || mongoose.model('ReminderSettings', ReminderSettingsSchema);
