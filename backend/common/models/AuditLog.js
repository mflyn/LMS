const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 审计日志模型
 * 用于记录系统中的用户操作和系统事件
 */
const auditLogSchema = new Schema({
  requestId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
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
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  operationType: {
    type: String,
    enum: ['normal', 'sensitive'],
    default: 'normal'
  },
  requestBody: {
    type: Schema.Types.Mixed
  },
  requestQuery: {
    type: Schema.Types.Mixed
  },
  requestParams: {
    type: Schema.Types.Mixed
  },
  responseTime: {
    type: Number
  },
  statusCode: {
    type: Number
  },
  responseBody: {
    type: Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'error'],
    default: 'pending'
  },
  error: {
    message: String,
    stack: String
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// 创建索引
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ operationType: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });

// 避免重复编译模型
let AuditLog;
try {
  AuditLog = mongoose.model('AuditLog');
} catch (error) {
  AuditLog = mongoose.model('AuditLog', auditLogSchema);
}

module.exports = AuditLog; 