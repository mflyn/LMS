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

const familyMistakeStateEventSchema = new Schema({
  familyId: {
    type: Schema.Types.ObjectId,
    required: true,
    immutable: true
  },
  childId: {
    type: Schema.Types.ObjectId,
    required: true,
    immutable: true
  },
  mistakeId: {
    type: Schema.Types.ObjectId,
    required: true,
    immutable: true
  },
  reviewed: {
    type: Boolean,
    required: true,
    immutable: true
  },
  mastered: {
    type: Boolean,
    required: true,
    immutable: true
  },
  reviewReminderDate: {
    type: String,
    immutable: true,
    validate: {
      validator: isValidLocalDate,
      message: 'reviewReminderDate must be a valid YYYY-MM-DD LocalDate'
    }
  },
  effectiveAt: {
    type: Date,
    required: true,
    immutable: true
  },
  operationId: {
    type: String,
    required: true,
    maxlength: 128,
    immutable: true
  }
}, {
  timestamps: true,
  strict: 'throw'
});

familyMistakeStateEventSchema.index(
  { familyId: 1, mistakeId: 1, operationId: 1 },
  { unique: true }
);
familyMistakeStateEventSchema.index({ familyId: 1, childId: 1, effectiveAt: 1 });

module.exports = mongoose.models.FamilyMistakeStateEvent
  || mongoose.model('FamilyMistakeStateEvent', familyMistakeStateEventSchema);
