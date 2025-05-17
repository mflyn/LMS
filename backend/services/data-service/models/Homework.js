const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attachmentSchema = new Schema({
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String } // E.g., 'pdf', 'image', 'document'
}, { _id: false });

const HomeworkSchema = new Schema({
  // Link to the original assignment in homework-service
  assignmentId: {
    type: Schema.Types.ObjectId,
    // ref: 'HomeworkAssignment', // Logical ref, not a direct Mongoose populate ref across services usually
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true // Redundant, synced from homework-service via event
  },
  description: {
    type: String, // Redundant, synced from homework-service via event
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject', // Ref to Subject model within data-service
    required: true,
    index: true
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Should point to User model in user-service context
    required: true,
    index: true
  },
  assignedDate: {
    type: Date,
    required: true,
    default: Date.now // Or set by the event from homework-service
  },
  dueDate: {
    type: Date,
    required: true // Redundant, synced from homework-service via event
  },
  status: {
    type: String,
    enum: ['assigned', 'submitted', 'graded', 'resubmitted'],
    default: 'assigned'
  },
  content: {
    type: String // Student's submitted text content
  },
  // originalAttachments are part of the assignment definition in homework-service.
  // If needed for display, they can be fetched via assignmentId or redundantly stored (synced via event).
  // For simplicity, let's assume they are not stored directly here to reduce redundancy, 
  // or if stored, they are explicitly marked as synced.
  // originalAttachments: [attachmentSchema], 
  submissionAttachments: [attachmentSchema], // Attachments submitted by student
  score: {
    type: Number
  },
  // totalScore is part of the assignment definition in homework-service.
  // It can be stored redundantly (synced) or fetched when needed.
  totalScore: {
    type: Number, 
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
  // assignedBy is part of the assignment definition in homework-service.
  // Can be stored redundantly (synced) or fetched when needed.
  // assignedBy: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true
  // },
  gradedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User' // Teacher/Admin who graded
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

HomeworkSchema.index({ student: 1, dueDate: -1 });
HomeworkSchema.index({ subject: 1, status: 1 });
HomeworkSchema.index({ assignmentId: 1, student: 1 }, { unique: true }); // Ensures one submission record per student per assignment

module.exports = mongoose.model('Homework', HomeworkSchema);