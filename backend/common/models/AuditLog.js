const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  ip: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  operationType: {
    type: String,
    enum: ['normal', 'sensitive']
  },
  requestBody: {
    type: mongoose.Schema.Types.Mixed
  },
  requestQuery: {
    type: mongoose.Schema.Types.Mixed
  },
  requestParams: {
    type: mongoose.Schema.Types.Mixed
  },
  responseTime: {
    type: Number
  },
  statusCode: {
    type: Number
  },
  responseBody: {
    type: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'error'],
    default: 'pending'
  },
  completedAt: {
    type: Date
  },
  error: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// 创建索引
auditLogSchema.index({ requestId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ timestamp: 1 });
auditLogSchema.index({ operationType: 1 });
auditLogSchema.index({ status: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog; 