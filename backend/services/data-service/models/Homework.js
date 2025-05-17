const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attachmentSchema = new Schema({
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String } // E.g., 'pdf', 'image', 'document'
}, { _id: false });

const HomeworkSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    // required: true, // Description can be optional
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  // class field removed as homework is assigned to individual students directly
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Should point to User model in user-service context
    required: true,
    index: true
  },
  assignedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['assigned', 'submitted', 'graded', 'resubmitted'], // Added resubmitted, removed in_progress
    default: 'assigned'
  },
  content: {
    type: String // Student's submitted text content
  },
  originalAttachments: [attachmentSchema], // Attachments provided by teacher when assigning
  submissionAttachments: [attachmentSchema], // Attachments submitted by student
  score: {
    type: Number
  },
  totalScore: { // Max possible score for this homework, set by teacher
    type: Number,
    // required: true // Could be made required if always known at assignment
  },
  feedback: {
    type: String
  },
  submittedDate: {
    type: Date
  },
  gradedDate: {
    type: Date
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Teacher/Admin who assigned
    required: true
  },
  gradedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User' // Teacher/Admin who graded
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

HomeworkSchema.index({ student: 1, dueDate: -1 });
HomeworkSchema.index({ subject: 1, status: 1 });

module.exports = mongoose.model('Homework', HomeworkSchema);