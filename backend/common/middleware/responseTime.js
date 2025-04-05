const responseTime = require('response-time');

// 响应时间监控中间件
const responseTimeMiddleware = responseTime((req, res, time) => {
  // 记录响应时间
  console.log(`${req.method} ${req.url} ${time}ms`);
  
  // 添加响应时间到响应头
  res.setHeader('X-Response-Time', `${time}ms`);
  
  // 根据响应时间设置性能等级
  let performanceLevel = 'excellent';
  if (time > 1000) {
    performanceLevel = 'poor';
  } else if (time > 500) {
    performanceLevel = 'fair';
  } else if (time > 200) {
    performanceLevel = 'good';
  }
  
  // 添加性能等级到响应头
  res.setHeader('X-Performance-Level', performanceLevel);
});

// 进度提示中间件
const progressMiddleware = (req, res, next) => {
  // 为长请求添加进度提示
  if (req.method === 'POST' || req.method === 'PUT') {
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > 1000) { // 超过1秒的请求显示进度
        res.write(`\nProcessing... ${Math.min(90, Math.floor(elapsedTime / 100))}%`);
      }
    }, 100);
    
    // 请求结束时清除定时器
    res.on('finish', () => {
      clearInterval(progressInterval);
    });
  }
  next();
};

module.exports = {
  responseTimeMiddleware,
  progressMiddleware
}; 