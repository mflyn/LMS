const mongoose = require('mongoose');
const { Schema } = mongoose;
const { LOCAL_DATE_PATTERN } = require('../../../common/utils/familyDate');

const growthTaskSchema = new Schema({
  childId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  familyId: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true
  },
  createdByParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dimension: {
    type: String,
    enum: ['moral', 'academic', 'physical', 'artistic', 'labor'],
    required: true,
    index: true
  },
  area: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  taskType: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  dueDate: {
    type: String,
    required: true,
    validate: {
      validator: (value) => {
        if (!LOCAL_DATE_PATTERN.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return parsed.toISOString().slice(0, 10) === value;
      },
      message: 'dueDate must be a valid YYYY-MM-DD LocalDate'
    }
  },
  estimatedMinutes: {
    type: Number,
    min: 0
  },
  actualMinutes: {
    type: Number,
    min: 0
  },
  targetAmount: {
    type: Number,
    min: 0
  },
  actualAmount: {
    type: Number,
    min: 0
  },
  unit: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'confirmed', 'archived'],
    default: 'pending',
    index: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'normal', 'hard']
  },
  needsHelp: {
    type: Boolean,
    default: false
  },
  childNote: {
    type: String,
    trim: true,
    default: ''
  },
  parentFeedback: {
    type: String,
    trim: true,
    default: ''
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  completedAt: Date,
  confirmedAt: Date
}, {
  timestamps: true
});

growthTaskSchema.index({ familyId: 1, childId: 1, dueDate: 1 });
growthTaskSchema.index({ familyId: 1, childId: 1, dimension: 1, status: 1 });

module.exports = mongoose.models.GrowthTask
  || mongoose.model('GrowthTask', growthTaskSchema);
