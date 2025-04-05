const mongoose = require('mongoose');

/**
 * 性能数据模型
 * 用于记录和分析系统性能指标
 */
const performanceDataSchema = new mongoose.Schema({
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
  serviceName: {
    type: String,
    required: true,
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
  route: {
    type: String
  },
  statusCode: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    index: true
  },
  slow: {
    type: Boolean,
    default: false,
    index: true
  },
  userAgent: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userRole: {
    type: String,
    enum: ['student', 'parent', 'teacher', 'admin', 'anonymous'],
    index: true
  },
  memoryUsage: {
    rss: Number,
    heapTotal: Number,
    heapUsed: Number,
    external: Number
  },
  performanceLevel: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'excellent'
  }
}, {
  timestamps: true
});

// 创建索引
performanceDataSchema.index({ serviceName: 1, timestamp: -1 });
performanceDataSchema.index({ duration: -1, timestamp: -1 });
performanceDataSchema.index({ userRole: 1, slow: 1 });

// 添加静态方法用于分析性能数据
performanceDataSchema.statics.getServicePerformance = async function(serviceName, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        serviceName,
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        maxDuration: { $max: '$duration' },
        minDuration: { $min: '$duration' },
        slowRequests: { $sum: { $cond: [{ $eq: ['$slow', true] }, 1, 0] } }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// 获取端点性能分析
performanceDataSchema.statics.getEndpointPerformance = async function(serviceName, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        serviceName,
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { method: '$method', url: '$url' },
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        maxDuration: { $max: '$duration' },
        minDuration: { $min: '$duration' },
        slowRequests: { $sum: { $cond: [{ $eq: ['$slow', true] }, 1, 0] } }
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// 获取用户角色性能分析
performanceDataSchema.statics.getUserRolePerformance = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$userRole',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        maxDuration: { $max: '$duration' },
        minDuration: { $min: '$duration' },
        slowRequests: { $sum: { $cond: [{ $eq: ['$slow', true] }, 1, 0] } }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// 获取性能趋势分析
performanceDataSchema.statics.getPerformanceTrend = async function(serviceName, interval = 'day', days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  let dateFormat;
  if (interval === 'hour') {
    dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } };
  } else if (interval === 'day') {
    dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
  } else if (interval === 'week') {
    dateFormat = { 
      $dateToString: { 
        format: '%Y-%U', 
        date: '$timestamp' 
      } 
    };
  } else {
    dateFormat = { $dateToString: { format: '%Y-%m', date: '$timestamp' } };
  }
  
  const pipeline = [
    {
      $match: {
        serviceName,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: dateFormat,
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        maxDuration: { $max: '$duration' },
        minDuration: { $min: '$duration' },
        slowRequests: { $sum: { $cond: [{ $eq: ['$slow', true] }, 1, 0] } }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

const PerformanceData = mongoose.model('PerformanceData', performanceDataSchema);

module.exports = PerformanceData;