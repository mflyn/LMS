const mongoose = require('mongoose');

const { Schema } = mongoose;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidLocalDate = (value) => {
  if (value === undefined || value === null || value === '') return true;
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
};

const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const pendingPatchSchema = new Schema({
  path: {
    type: String,
    required: true,
    enum: ['questionMediaId', 'childAnswerMediaId']
  },
  value: {
    type: Schema.Types.ObjectId,
    default: null
  }
}, { _id: false, strict: 'throw' });

const familyMistakeSchema = new Schema({
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
  dimension: {
    type: String,
    enum: ['academic'],
    default: 'academic',
    immutable: true,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  knowledgePointId: {
    type: Schema.Types.ObjectId
  },
  knowledgePointName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: ''
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  correctAnswer: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  parentNote: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  childExplanation: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  reviewReminderDate: {
    type: String,
    validate: {
      validator: isValidLocalDate,
      message: 'reviewReminderDate must be a valid YYYY-MM-DD LocalDate'
    }
  },
  corrected: {
    type: Boolean,
    default: false
  },
  reviewed: {
    type: Boolean,
    default: false
  },
  mastered: {
    type: Boolean,
    default: false
  },
  questionMediaId: {
    type: Schema.Types.ObjectId
  },
  childAnswerMediaId: {
    type: Schema.Types.ObjectId
  },
  mediaReferenceState: {
    type: String,
    enum: ['none', 'pending', 'bound'],
    default: 'none',
    select: false
  },
  mediaBindingOperationId: {
    type: String,
    match: OPERATION_ID_PATTERN,
    select: false
  },
  mediaPendingPatch: {
    type: [pendingPatchSchema],
    default: undefined,
    select: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    required: true
  }
}, {
  timestamps: true,
  strict: 'throw'
});

familyMistakeSchema.index({ familyId: 1, childId: 1, reviewReminderDate: 1 });
familyMistakeSchema.index({ familyId: 1, childId: 1, createdAt: -1 });
familyMistakeSchema.index({ familyId: 1, childId: 1, subject: 1 });

module.exports = mongoose.models.FamilyMistake
  || mongoose.model('FamilyMistake', familyMistakeSchema);
