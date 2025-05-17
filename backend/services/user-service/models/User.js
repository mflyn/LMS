const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  role: {
    type: String,
    enum: ['student', 'parent', 'teacher', 'admin', 'superadmin'],
    required: true,
    index: true
  },
  avatar: {
    type: String
  },
  grade: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  studentClass: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  studentIdNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  children: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  teacherIdNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  subjectsTaught: [{
    type: String,
  }],
  classesOverseen: [{
    type: String,
  }],
  isActive: {
    type: Boolean,
    default: true
  },
}, {
  timestamps: true
});

UserSchema.index({ role: 1, isActive: 1 });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (typeof this.password !== 'string' || !this.password) {
    throw new Error('User password not available for comparison. Ensure it is selected from the database.');
  }
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison (bcrypt) error:', error);
    return false;
  }
};

module.exports = mongoose.model('User', UserSchema);