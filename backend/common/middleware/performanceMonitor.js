/**
 * 性能监控中间件
 * 用于监控系统响应时间和性能指标，提供性能数据收集和分析功能
 */

const { v4: uuidv4 } = require('uuid');

/**
 * 性能数据收集中间件
 * 记录每个请求的处理时间和资源消耗
 * @param {Object} options - 配置选项
 * @param {number} options.threshold - 慢请求阈值（毫秒），默认1000ms
 * @param {boolean} options.logAll - 是否记录所有请求，默认false（只记录慢请求）
 * @returns {Function} Express中间件
 */
const performanceDataCollector = (options = {}) => {
  const { threshold = 1000, logAll = false } = options;
  
  return (req, res, next) => {
    // 记录请求开始时间
    const startTime = Date.now();
    const requestId = req.requestId || uuidv4();
    
    // 记录内存使用情况
    const startMemory = process.memoryUsage();
    
    // 在响应完成时收集性能数据
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      
      // 计算内存使用变化
      const memoryDiff = {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external
      };
      
      // 构建性能数据对象
      const performanceData = {
        requestId,
        timestamp: new Date(),
        method: req.method,
        url: req.originalUrl,
        route: req.route ? req.route.path : 'unknown',
        statusCode: res.statusCode,
        duration,
        slow: duration > threshold,
        userAgent: req.get('user-agent'),
        userId: req.user ? req.user.id : 'anonymous',
        serviceName: req.app.locals.serviceName || 'unknown-service',
        memoryUsage: memoryDiff
      };
      
      // 根据配置决定是否记录所有请求或只记录慢请求
      if (logAll || performanceData.slow) {
        // 如果应用有日志记录器，使用它记录性能数据
        if (req.app && req.app.locals.logger) {
          const logLevel = performanceData.slow ? 'warn' : 'info';
          req.app.locals.logger[logLevel]('性能数据', { performanceData });
        } else {
          // 否则使用控制台记录
          console.log(`性能数据: ${req.method} ${req.originalUrl} ${duration}ms`);
        }
        
        // 如果应用配置了性能数据存储，保存性能数据
        if (req.app && req.app.locals.performanceDataStore) {
          req.app.locals.performanceDataStore.save(performanceData)
            .catch(err => console.error('保存性能数据失败:', err));
        }
      }
      
      // 添加性能相关的响应头
      res.setHeader('X-Response-Time', `${duration}ms`);
      
      // 根据响应时间设置性能等级
      let performanceLevel = 'excellent';
      if (duration > 1000) {
        performanceLevel = 'poor';
      } else if (duration > 500) {
        performanceLevel = 'fair';
      } else if (duration > 200) {
        performanceLevel = 'good';
      }
      
      res.setHeader('X-Performance-Level', performanceLevel);
    });
    
    next();
  };
};

/**
 * 进度提示中间件
 * 针对长时间运行的POST和PUT请求提供进度反馈
 * @param {Object} options - 配置选项
 * @param {number} options.interval - 进度更新间隔（毫秒），默认100ms
 * @param {number} options.threshold - 显示进度的时间阈值（毫秒），默认1000ms
 * @returns {Function} Express中间件
 */
const progressTracker = (options = {}) => {
  const { interval = 100, threshold = 1000 } = options;
  
  return (req, res, next) => {
    // 只为POST和PUT请求提供进度跟踪
    if (req.method === 'POST' || req.method === 'PUT') {
      const startTime = Date.now();
      let progressSent = false;
      
      // 创建进度更新定时器
      const progressInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        // 只有当请求处理时间超过阈值时才发送进度
        if (elapsedTime > threshold) {
          // 计算进度百分比（最大90%，保留最后10%给实际完成阶段）
          const progressPercent = Math.min(90, Math.floor(elapsedTime / 100));
          
          // 如果响应头已发送且支持分块传输，发送进度更新
          if (!res.headersSent) {
            res.setHeader('X-Progress', `${progressPercent}%`);
          } else if (req.headers['accept'] && req.headers['accept'].includes('text/event-stream')) {
            // 对于SSE请求，发送事件流进度更新
            res.write(`event: progress\ndata: {"percent": ${progressPercent}}\n\n`);
            progressSent = true;
          } else if (!progressSent && res.socket && res.socket.writable) {
            // 对于普通HTTP请求，尝试发送进度更新（如果可能）
            try {
              res.write(`\nProcessing... ${progressPercent}%`);
              progressSent = true;
            } catch (e) {
              // 忽略写入错误
            }
          }
        }
      }, interval);
      
      // 请求结束时清除定时器
      res.on('finish', () => {
        clearInterval(progressInterval);
      });
      
      // 请求出错时清除定时器
      res.on('error', () => {
        clearInterval(progressInterval);
      });
    }
    
    next();
  };
};

/**
 * 性能分析中间件
 * 按服务、端点和用户角色分类统计性能数据
 * @param {Object} options - 配置选项
 * @param {number} options.sampleRate - 采样率（0-1），默认0.1（10%请求）
 * @returns {Function} Express中间件
 */
const performanceAnalyzer = (options = {}) => {
  const { sampleRate = 0.1 } = options;
  
  // 性能数据存储
  const performanceStats = {
    endpoints: {},
    roles: {},
    overall: {
      count: 0,
      totalDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      slowRequests: 0
    }
  };
  
  return (req, res, next) => {
    // 根据采样率决定是否分析此请求
    if (Math.random() > sampleRate) {
      return next();
    }
    
    const startTime = Date.now();
    
    // 响应完成时收集和分析性能数据
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const endpoint = `${req.method} ${req.route ? req.route.path : req.path}`;
      const role = req.user ? req.user.role : 'anonymous';
      
      // 更新端点统计
      if (!performanceStats.endpoints[endpoint]) {
        performanceStats.endpoints[endpoint] = {
          count: 0,
          totalDuration: 0,
          maxDuration: 0,
          minDuration: Infinity,
          slowRequests: 0
        };
      }
      
      performanceStats.endpoints[endpoint].count++;
      performanceStats.endpoints[endpoint].totalDuration += duration;
      performanceStats.endpoints[endpoint].maxDuration = Math.max(performanceStats.endpoints[endpoint].maxDuration, duration);
      performanceStats.endpoints[endpoint].minDuration = Math.min(performanceStats.endpoints[endpoint].minDuration, duration);
      
      if (duration > 1000) {
        performanceStats.endpoints[endpoint].slowRequests++;
      }
      
      // 更新角色统计
      if (!performanceStats.roles[role]) {
        performanceStats.roles[role] = {
          count: 0,
          totalDuration: 0,
          maxDuration: 0,
          minDuration: Infinity,
          slowRequests: 0
        };
      }
      
      performanceStats.roles[role].count++;
      performanceStats.roles[role].totalDuration += duration;
      performanceStats.roles[role].maxDuration = Math.max(performanceStats.roles[role].maxDuration, duration);
      performanceStats.roles[role].minDuration = Math.min(performanceStats.roles[role].minDuration, duration);
      
      if (duration > 1000) {
        performanceStats.roles[role].slowRequests++;
      }
      
      // 更新总体统计
      performanceStats.overall.count++;
      performanceStats.overall.totalDuration += duration;
      performanceStats.overall.maxDuration = Math.max(performanceStats.overall.maxDuration, duration);
      performanceStats.overall.minDuration = Math.min(performanceStats.overall.minDuration, duration);
      
      if (duration > 1000) {
        performanceStats.overall.slowRequests++;
      }
      
      // 每100个请求，记录一次性能统计数据
      if (performanceStats.overall.count % 100 === 0 && req.app && req.app.locals.logger) {
        req.app.locals.logger.info('性能统计数据', { performanceStats });
      }
    });
    
    next();
  };
};

module.exports = {
  performanceDataCollector,
  progressTracker,
  performanceAnalyzer
};