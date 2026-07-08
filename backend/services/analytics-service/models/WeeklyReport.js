const mongoose = require('mongoose');

const { Schema } = mongoose;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const weeklyReportSchema = new Schema({
  familyId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  childId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  weekStart: {
    type: String,
    required: true,
    match: LOCAL_DATE_PATTERN
  },
  weekEnd: {
    type: String,
    required: true,
    match: LOCAL_DATE_PATTERN
  },
  timezone: {
    type: String,
    required: true
  },
  statistics: {
    type: Schema.Types.Mixed,
    required: true
  },
  generatedSuggestion: {
    type: String,
    required: true,
    maxlength: 1000
  },
  sourceCutoffAt: {
    type: Date,
    required: true
  },
  generatedAt: {
    type: Date,
    required: true
  },
  frozen: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  parentNote: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  nextWeekSuggestion: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  feedbackUpdatedBy: {
    type: Schema.Types.ObjectId
  },
  feedbackUpdatedAt: {
    type: Date
  }
}, {
  timestamps: true,
  strict: 'throw'
});

weeklyReportSchema.index({ familyId: 1, childId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.models.WeeklyReport
  || mongoose.model('WeeklyReport', weeklyReportSchema);
