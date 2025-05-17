const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoleSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
    enum: ['student', 'parent', 'teacher', 'admin', 'superadmin']
  },
  description: {
    type: String,
    required: true
  },
  permissions: [{
    type: String,
  }],
}, {
  timestamps: true
});

module.exports = mongoose.model('Role', RoleSchema);