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
const MAX_MEDIA_PER_GROUP = 10;

const validMediaArray = (value) => !Array.isArray(value) || (
  value.length <= MAX_MEDIA_PER_GROUP
  && new Set(value.map((entry) => String(entry).toLowerCase())).size === value.length
);

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

const mediaBindingSchema = new Schema({
  field: {
    type: String,
    required: true,
    enum: ['questionMediaId', 'childAnswerMediaId']
  },
  mediaId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  bindingOperationId: {
    type: String,
    required: true,
    match: OPERATION_ID_PATTERN
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
  questionMediaIds: {
    type: [Schema.Types.ObjectId],
    default: undefined,
    validate: { validator: validMediaArray, message: 'questionMediaIds must contain at most 10 unique IDs' }
  },
  childAnswerMediaId: {
    type: Schema.Types.ObjectId
  },
  childAnswerMediaIds: {
    type: [Schema.Types.ObjectId],
    default: undefined,
    validate: { validator: validMediaArray, message: 'childAnswerMediaIds must contain at most 10 unique IDs' }
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
  mediaPendingMistakePatch: {
    type: Schema.Types.Mixed,
    select: false
  },
  mediaPendingStateEvent: {
    type: Boolean,
    select: false
  },
  mediaReferenceBindings: {
    type: [mediaBindingSchema],
    default: undefined,
    select: false
  },
  mediaPreviousBindings: {
    type: [mediaBindingSchema],
    default: undefined,
    select: false
  },
  mediaMutationKind: {
    type: String,
    enum: ['create', 'patch'],
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

familyMistakeSchema.pre('validate', function synchronizeMediaProjections(next) {
  [
    ['questionMediaIds', 'questionMediaId'],
    ['childAnswerMediaIds', 'childAnswerMediaId']
  ].forEach(([arrayField, aliasField]) => {
    if (!this.isModified(arrayField)) return;
    const first = Array.isArray(this[arrayField]) ? this[arrayField][0] : undefined;
    this.set(aliasField, first || undefined);
  });
  next();
});

module.exports = mongoose.models.FamilyMistake
  || mongoose.model('FamilyMistake', familyMistakeSchema);

module.exports.MAX_MEDIA_PER_GROUP = MAX_MEDIA_PER_GROUP;
