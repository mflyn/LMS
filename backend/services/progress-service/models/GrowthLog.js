const mongoose = require('mongoose');

const { Schema } = mongoose;
const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];

const isValidLocalDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
};

const growthLogSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
  childId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: {
    type: String,
    required: true,
    validate: { validator: isValidLocalDate, message: 'date must be a valid YYYY-MM-DD LocalDate' }
  },
  dimension: { type: String, enum: DIMENSIONS, required: true },
  area: { type: String, trim: true, default: '' },
  subject: { type: String, trim: true, default: '' },
  content: { type: String, trim: true, required: true, maxlength: 1000 },
  durationMinutes: { type: Number, min: 0 },
  amount: { type: Number, min: 0 },
  unit: { type: String, trim: true, maxlength: 30, default: '' },
  completedTaskIds: [{ type: Schema.Types.ObjectId }],
  focusLevel: { type: String, enum: ['good', 'normal', 'distracted'] },
  difficulty: { type: String, enum: ['easy', 'normal', 'hard'] },
  physicalState: { type: String, enum: ['energetic', 'normal', 'tired', 'unwell'] },
  mood: { type: String, enum: ['happy', 'calm', 'resistant', 'anxious'] },
  childReflection: { type: String, trim: true, maxlength: 500, default: '' },
  parentNote: { type: String, trim: true, maxlength: 500, default: '' },
  createdBy: { type: Schema.Types.ObjectId, required: true },
  updatedBy: { type: Schema.Types.ObjectId, required: true }
}, { timestamps: true });

growthLogSchema.index({ familyId: 1, childId: 1, date: -1 });
growthLogSchema.index({ familyId: 1, childId: 1, dimension: 1, date: -1 });

module.exports = mongoose.models.GrowthLog || mongoose.model('GrowthLog', growthLogSchema);
