const express = require('express');
const router = express.Router();
const UserBehavior = require('../models/UserBehavior');
const winston = require('winston');

// 获取日志记录器实例
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 从请求头获取用户信息（由API网关添加）
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return res.status(401).json({ message: '未认证' });
  }
  
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role']
  };
  
  next();
};

// 角色检查中间件
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未认证' });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    next();
  };
};

// 记录用户行为
router.post('/track', async (req, res) => {
  try {
    const { userId, userRole, actionType, sessionId, deviceInfo, location, metadata, duration, success, errorDetails } = req.body;
    
    // 创建新的用户行为记录
    const userBehavior = new UserBehavior({
      userId,
      userRole,
      actionType,
      sessionId,
      deviceInfo,
      location,
      metadata,
      duration,
      success,
      errorDetails
    });
    
    await userBehavior.save();
    
    res.status(201).json({ message: '用户行为记录成功', id: userBehavior._id });
  } catch (err) {
    logger.error('记录用户行为失败:', err);
    res.status(500).json({ message: '记录用户行为失败', error: err.message });
  }
});

// 获取用户活动摘要
router.get('/activity/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    // 检查权限：只有用户本人、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== userId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 解析日期参数
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // 获取用户活动摘要
    const activitySummary = await UserBehavior.getUserActivitySummary(userId, start, end);
    
    // 获取最近的活动记录
    const recentActivities = await UserBehavior.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10);
    
    res.json({
      activitySummary,
      recentActivities
    });
  } catch (err) {
    logger.error('获取用户活动摘要失败:', err);
    res.status(500).json({ message: '获取用户活动摘要失败', error: err.message });
  }
});

// 获取学习习惯分析
router.get('/learning-habits/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    // 检查权限：只有用户本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== userId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 获取学习习惯分析
    const habitsData = await UserBehavior.getLearningHabitsAnalysis(userId, parseInt(days));
    
    // 处理数据，生成时间热图数据
    const timeHeatmap = Array(7).fill().map(() => Array(24).fill(0));
    const actionTypeData = {};
    
    habitsData.forEach(item => {
      const { hour, dayOfWeek, actionType } = item._id;
      const dayIndex = dayOfWeek - 1; // MongoDB的dayOfWeek从1开始
      
      // 更新时间热图
      timeHeatmap[dayIndex][hour] += item.count;
      
      // 更新操作类型数据
      if (!actionTypeData[actionType]) {
        actionTypeData[actionType] = {
          totalCount: 0,
          byDay: Array(7).fill(0),
          byHour: Array(24).fill(0)
        };
      }
      
      actionTypeData[actionType].totalCount += item.count;
      actionTypeData[actionType].byDay[dayIndex] += item.count;
      actionTypeData[actionType].byHour[hour] += item.count;
    });
    
    // 生成学习习惯建议
    const suggestions = [];
    
    // 分析学习时间分布
    const eveningStudyHours = [19, 20, 21, 22, 23, 0, 1, 2];
    let totalEveningCount = 0;
    let totalCount = 0;
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const count = timeHeatmap[day][hour];
        totalCount += count;
        
        if (eveningStudyHours.includes(hour)) {
          totalEveningCount += count;
        }
      }
    }
    
    const eveningStudyPercentage = totalCount > 0 ? (totalEveningCount / totalCount) * 100 : 0;
    
    if (eveningStudyPercentage > 60) {
      suggestions.push({
        area: '学习时间',
        issue: '晚间学习时间过多',
        suggestion: '建议适当调整学习时间分布，增加白天学习时间，保证充足睡眠'
      });
    }
    
    // 分析学习规律性
    const dayVariance = calculateVariance(timeHeatmap.map(day => day.reduce((sum, count) => sum + count, 0)));
    const normalizedVariance = dayVariance / (totalCount / 7 || 1);
    
    if (normalizedVariance > 0.5) {
      suggestions.push({
        area: '学习规律',
        issue: '学习时间不规律',
        suggestion: '建议制定固定的学习计划表，养成规律学习的习惯'
      });
    }
    
    // 分析资源使用情况
    if (actionTypeData['view_resource'] && actionTypeData['view_resource'].totalCount < 10) {
      suggestions.push({
        area: '资源利用',
        issue: '学习资源使用较少',
        suggestion: '建议多利用系统提供的学习资源，丰富学习内容'
      });
    }
    
    res.json({
      timeHeatmap,
      actionTypeData,
      suggestions,
      rawData: habitsData
    });
  } catch (err) {
    logger.error('获取学习习惯分析失败:', err);
    res.status(500).json({ message: '获取学习习惯分析失败', error: err.message });
  }
});

// 获取使用习惯统计（教师和管理员可用）
router.get('/usage-patterns/:userRole', authenticateToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { userRole } = req.params;
    const { days = 30 } = req.query;
    
    // 获取使用习惯统计
    const usagePatterns = await UserBehavior.getUsagePatterns(userRole, parseInt(days));
    
    // 处理数据，按页面和功能分组
    const pageUsage = {};
    const featureUsage = {};
    
    usagePatterns.forEach(item => {
      const { page, actionType, count, uniqueUserCount, avgDuration } = item;
      
      // 更新页面使用统计
      if (page) {
        if (!pageUsage[page]) {
          pageUsage[page] = { totalCount: 0, uniqueUsers: 0, avgDuration: 0, actions: {} };
        }
        
        pageUsage[page].totalCount += count;
        pageUsage[page].uniqueUsers = Math.max(pageUsage[page].uniqueUsers, uniqueUserCount);
        pageUsage[page].avgDuration = (pageUsage[page].avgDuration + avgDuration) / 2;
        pageUsage[page].actions[actionType] = count;
      }
      
      // 更新功能使用统计
      if (!featureUsage[actionType]) {
        featureUsage[actionType] = { totalCount: 0, uniqueUsers: 0, avgDuration: 0 };
      }
      
      featureUsage[actionType].totalCount += count;
      featureUsage[actionType].uniqueUsers = Math.max(featureUsage[actionType].uniqueUsers, uniqueUserCount);
      featureUsage[actionType].avgDuration = (featureUsage[actionType].avgDuration + avgDuration) / 2;
    });
    
    // 生成使用习惯建议
    const suggestions = [];
    
    // 分析低使用率的功能
    const lowUsageFeatures = Object.entries(featureUsage)
      .filter(([_, data]) => data.uniqueUsers < 5) // 假设少于5个用户使用为低使用率
      .map(([feature, _]) => feature);
    
    if (lowUsageFeatures.length > 0) {
      suggestions.push({
        area: '功能使用',
        issue: `以下功能使用率较低: ${lowUsageFeatures.join(', ')}`,
        suggestion: '建议加强对这些功能的宣传和培训，或考虑优化功能设计'
      });
    }
    
    res.json({
      pageUsage,
      featureUsage,
      suggestions,
      rawData: usagePatterns
    });
  } catch (err) {
    logger.error('获取使用习惯统计失败:', err);
    res.status(500).json({ message: '获取使用习惯统计失败', error: err.message });
  }
});

// 获取个性化推荐
router.get('/recommendations/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 检查权限：只有用户本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== userId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 获取用户最近30天的行为数据
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const userBehaviors = await UserBehavior.find({
      userId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: -1 });
    
    // 分析用户行为模式
    const viewedResources = new Set();
    const submittedHomework = new Set();
    const timeOfDay = { morning: 0, afternoon: 0, evening: 0 };
    
    userBehaviors.forEach(behavior => {
      // 收集查看过的资源
      if (behavior.actionType === 'view_resource' && behavior.metadata && behavior.metadata.resourceId) {
        viewedResources.add(behavior.metadata.resourceId);
      }
      
      // 收集提交过的作业
      if (behavior.actionType === 'submit_homework' && behavior.metadata && behavior.metadata.homeworkId) {
        submittedHomework.add(behavior.metadata.homeworkId);
      }
      
      // 分析学习时间偏好
      const hour = new Date(behavior.timestamp).getHours();
      if (hour >= 5 && hour < 12) {
        timeOfDay.morning++;
      } else if (hour >= 12 && hour < 18) {
        timeOfDay.afternoon++;
      } else {
        timeOfDay.evening++;
      }
    });
    
    // 生成个性化推荐
    const recommendations = [];
    
    // 基于学习时间的推荐
    const preferredTime = Object.entries(timeOfDay).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    recommendations.push({
      type: 'schedule',
      title: '学习时间建议',
      description: `根据您的学习习惯，建议您在${getTimeOfDayText(preferredTime)}安排更多学习时间，这样可以提高学习效率。`
    });
    
    // 基于资源使用的推荐
    if (viewedResources.size < 5) {
      recommendations.push({
        type: 'resource',
        title: '学习资源推荐',
        description: '您最近查看的学习资源较少，建议多浏览系统提供的学习资源，丰富学习内容。'
      });
    }
    
    // 基于作业完成的推荐
    if (submittedHomework.size < 3) {
      recommendations.push({
        type: 'homework',
        title: '作业完成建议',
        description: '您最近完成的作业较少，建议按时完成作业，巩固所学知识。'
      });
    }
    
    res.json({
      recommendations,
      behaviorSummary: {
        viewedResourcesCount: viewedResources.size,
        submittedHomeworkCount: submittedHomework.size,
        timePreference: preferredTime
      }
    });
  } catch (err) {
    logger.error('获取个性化推荐失败:', err);
    res.status(500).json({ message: '获取个性化推荐失败', error: err.message });
  }
});

// 辅助函数：计算方差
function calculateVariance(arr) {
  const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
  return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
}

// 辅助函数：获取时间段文本
function getTimeOfDayText(timeOfDay) {
  switch (timeOfDay) {
    case 'morning':
      return '上午';
    case 'afternoon':
      return '下午';
    case 'evening':
      return '晚上';
    default:
      return '全天';
  }
}

module.exports = router;