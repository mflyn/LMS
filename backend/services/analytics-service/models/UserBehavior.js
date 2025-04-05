const mongoose = require('mongoose');

/**
 * 用户行为模型
 * 用于记录和分析用户在系统中的操作行为
 */
const userBehaviorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userRole: {
    type: String,
    enum: ['student', 'parent', 'teacher', 'admin'],
    required: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'login',           // 登录
      'logout',          // 登出
      'view_resource',   // 查看学习资源
      'download_resource', // 下载资源
      'submit_homework', // 提交作业
      'view_analytics',  // 查看分析报告
      'message_sent',    // 发送消息
      'profile_update',  // 更新个人资料
      'search',          // 搜索操作
      'page_view',       // 页面访问
      'feature_use',     // 功能使用
      'error_encounter'  // 遇到错误
    ],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  deviceInfo: {
    type: {
      deviceType: String,  // 'mobile', 'tablet', 'desktop'
      browser: String,
      os: String,
      screenResolution: String
    }
  },
  location: {
    type: {
      page: String,        // 页面路径
      component: String,   // 组件名称
      section: String      // 页面区域
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // 额外的操作相关数据
    default: {}
  },
  duration: {
    type: Number,         // 操作持续时间（毫秒）
    default: 0
  },
  success: {
    type: Boolean,        // 操作是否成功
    default: true
  },
  errorDetails: {
    type: String          // 如果操作失败，记录错误详情
  }
}, {
  timestamps: true
});

// 创建索引
userBehaviorSchema.index({ userId: 1, actionType: 1, timestamp: -1 });
userBehaviorSchema.index({ userRole: 1, actionType: 1, timestamp: -1 });
userBehaviorSchema.index({ 'location.page': 1, timestamp: -1 });

// 添加静态方法用于分析用户行为
userBehaviorSchema.statics.getUserActivitySummary = async function(userId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$actionType',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// 获取用户学习习惯分析
userBehaviorSchema.statics.getLearningHabitsAnalysis = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate },
        actionType: { $in: ['view_resource', 'submit_homework', 'view_analytics'] }
      }
    },
    {
      $project: {
        actionType: 1,
        timestamp: 1,
        hour: { $hour: '$timestamp' },
        dayOfWeek: { $dayOfWeek: '$timestamp' },
        duration: 1
      }
    },
    {
      $group: {
        _id: {
          hour: '$hour',
          dayOfWeek: '$dayOfWeek',
          actionType: '$actionType'
        },
        count: { $sum: 1 },
        totalDuration: { $sum: '$duration' }
      }
    },
    {
      $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// 获取用户使用习惯统计
userBehaviorSchema.statics.getUsagePatterns = async function(userRole, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        userRole,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          page: '$location.page',
          actionType: '$actionType'
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        avgDuration: { $avg: '$duration' }
      }
    },
    {
      $project: {
        page: '$_id.page',
        actionType: '$_id.actionType',
        count: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        avgDuration: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

const UserBehavior = mongoose.model('UserBehavior', userBehaviorSchema);

module.exports = UserBehavior;