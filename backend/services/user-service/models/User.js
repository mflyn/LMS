const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['student', 'parent', 'teacher', 'admin'],
    required: true
  },
  avatar: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  // 学生特有字段
  grade: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  class: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  studentId: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  // 家长特有字段
  children: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.role === 'parent'; }
  }],
  // 教师特有字段
  teacherId: {
    type: String,
    required: function() { return this.role === 'teacher'; }
  },
  subjects: [{
    type: String,
    required: function() { return this.role === 'teacher'; }
  }],
  classesManaged: [{
    type: String,
    required: function() { return this.role === 'teacher'; }
  }]
});

module.exports = mongoose.model('User', UserSchema);