const express = require('express');
const router = express.Router();
const PerformanceData = require('../models/PerformanceData');
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

// 记录性能数据
router.post('/record', async (req, res) => {
  try {
    const { 
      requestId, 
      serviceName, 
      method, 
      url, 
      route, 
      statusCode, 
      duration, 
      slow, 
      userAgent, 
      userId, 
      userRole, 
      memoryUsage, 
      performanceLevel 
    } = req.body;
    
    // 创建新的性能数据记录
    const performanceData = new PerformanceData({
      requestId,
      serviceName,
      method,
      url,
      route,
      statusCode,
      duration,
      slow,
      userAgent,
      userId,
      userRole,
      memoryUsage,
      performanceLevel
    });
    
    await performanceData.save();
    
    res.status(201).json({ message: '性能数据记录成功', id: performanceData._id });
  } catch (err) {
    logger.error('记录性能数据失败:', err);
    res.status(500).json({ message: '记录性能数据失败', error: err.message });
  }
});

// 获取服务性能概览
router.get('/service/:serviceName', authenticateToken, checkRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { startDate, endDate } = req.query;
    
    // 解析日期参数
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // 获取服务性能数据
    const performanceData = await PerformanceData.getServicePerformance(serviceName, start, end);
    
    // 获取端点性能数据
    const endpointPerformance = await PerformanceData.getEndpointPerformance(serviceName, start, end);
    
    // 获取性能趋势数据
    const performanceTrend = await PerformanceData.getPerformanceTrend(serviceName, 'day', 30);
    
    res.json({
      serviceName,
      period: { start, end },
      overview: performanceData[0] || { count: 0, avgDuration: 0, maxDuration: 0, minDuration: 0, slowRequests: 0 },
      endpoints: endpointPerformance,
      trend: performanceTrend
    });
  } catch (err) {
    logger.error('获取服务性能数据失败:', err);
    res.status(500).json({ message: '获取服务性能数据失败', error: err.message });
  }
});

// 获取用户角色性能分析
router.get('/user-roles', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // 解析日期参数
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // 获取用户角色性能数据
    const rolePerformance = await PerformanceData.getUserRolePerformance(start, end);
    
    res.json({
      period: { start, end },
      rolePerformance
    });
  } catch (err) {
    logger.error('获取用户角色性能数据失败:', err);
    res.status(500).json({ message: '获取用户角色性能数据失败', error: err.message });
  }
});

// 获取性能趋势分析
router.get('/trend/:serviceName', authenticateToken, checkRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { interval = 'day', days = 30 } = req.query;
    
    // 验证参数
    if (!['hour', 'day', 'week', 'month'].includes(interval)) {
      return res.status(400).json({ message: '无效的时间间隔参数' });
    }
    
    // 获取性能趋势数据
    const performanceTrend = await PerformanceData.getPerformanceTrend(serviceName, interval, parseInt(days));
    
    res.json({
      serviceName,
      interval,
      days: parseInt(days),
      trend: performanceTrend
    });
  } catch (err) {
    logger.error('获取性能趋势数据失败:', err);
    res.status(500).json({ message: '获取性能趋势数据失败', error: err.message });
  }
});

// 获取慢请求列表
router.get('/slow-requests/:serviceName', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    // 查询慢请求数据
    const slowRequests = await PerformanceData.find({
      serviceName,
      slow: true
    })
    .sort({ duration: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));
    
    // 获取总数
    const total = await PerformanceData.countDocuments({
      serviceName,
      slow: true
    });
    
    res.json({
      serviceName,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      slowRequests
    });
  } catch (err) {
    logger.error('获取慢请求列表失败:', err);
    res.status(500).json({ message: '获取慢请求列表失败', error: err.message });
  }
});

module.exports = router;