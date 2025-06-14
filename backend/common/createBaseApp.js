const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean'); // xss-clean
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize'); // For NoSQL injection protection

// 共享模块导入
const { requestTracker, errorHandler } = require('./middleware/errorHandler');
const { auditLogger } = require('./middleware/auditLogger'); // Assuming auditLogger is correctly exported
const { sanitizeInput } = require('./middleware/requestValidator'); // For HTML sanitization
const { logger } = require('./utils/logger');

// 导入会话管理 (如果需要，并使其可选)
// let session, sessionManagerModule;
// if (process.env.NODE_ENV === 'test') {
//   session = jest.fn(); // Mock session for tests
//   sessionManagerModule = require('./middleware/mockSessionManager');
// } else {
//   session = require('express-session');
//   sessionManagerModule = require('./middleware/sessionManager');
// }
// const { sessionConfig, sessionSecurity, sessionCleanup } = sessionManagerModule;

function createBaseApp(options = {}) {
  const app = express();
  const serviceName = options.serviceName || 'unknown-service';
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. 设置 app.locals (会被 errorHandler, logger, auditLogger 等使用)
  app.locals.logger = logger;
  app.locals.serviceName = serviceName;
  if (options.dbInstance) {
    app.locals.db = options.dbInstance; // 例如，mongoose 实例
  }

  // 2. 基础安全和请求处理中间件 (顺序可能重要)
  // Helmet (详细配置可以像 common/app.js 那样，或者提供选项覆盖)
  app.use(helmet(options.helmetOptions || {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Add 'nonce-YOUR_SERVER_GENERATED_NONCE' if using nonces for inline scripts
          // Add 'sha256-YOUR_SCRIPT_HASH' for specific inline scripts if absolutely necessary
          // Consider using 'strict-dynamic' if applicable for trusted scripts loading other scripts
        ],
        styleSrc: [
          "'self'",
          // Add 'nonce-YOUR_SERVER_GENERATED_NONCE' for inline styles
          // Add 'sha256-YOUR_STYLE_HASH' for specific inline styles
          "'unsafe-inline'" // Temporary: Keep for styles until fully migrated to CSS files or hashes/nonces. Remove if not strictly needed.
        ],
        imgSrc: ["'self'", "data:", "https:"], // Allows images from self, data URLs, and HTTPS sources
        fontSrc: ["'self'", "https:", "data:"], // Common sources for fonts
        connectSrc: [
          "'self'", 
          // Add other domains that the service needs to connect to (e.g., other microservices, payment gateways)
          // Example: options.connectSrcDirectives || [] 
        ],
        objectSrc: ["'none'"], // Disallow <object>, <embed>, <applet>
        frameAncestors: ["'none'"], // Disallow embedding in iframes from other origins (clickjacking protection)
        // ... 其他CSP指令 ...
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, // HTTP Strict Transport Security
    frameguard: { action: 'deny' }, // X-Frame-Options: deny
    xssFilter: true, // X-XSS-Protection
    noSniff: true, // X-Content-Type-Options: nosniff
    ieNoOpen: true, // X-Download-Options: noopen
    dnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "no-referrer" }, // Referrer Policy
    // ... 其他 helmet 选项 ...
  }));

  // CORS (允许通过 options.corsOptions 进行更细致的配置)
  const defaultCorsOptions = {
    origin: isProduction ? (options.productionCorsOrigin || ['https://your-production-domain.com']) : (options.developmentCorsOrigin || ['http://localhost:3000', 'http://localhost:8080']), // 默认开发端口
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400, // 1 day
  };
  app.use(cors(options.corsOptions || defaultCorsOptions));

  // Body parsers (限制大小)
  app.use(express.json({ limit: options.requestBodyLimit || '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: options.requestBodyLimit || '10kb' }));
  
  // NoSQL injection sanitize
  app.use(mongoSanitize());

  // XSS sanitize (cleans req.body, req.query, req.params)
  app.use(xss());

  // Prevent HTTP Parameter Pollution
  app.use(hpp({
    // whitelist: ['list', 'of', 'parameters', 'to', 'allow', 'duplicates'] 
  }));
  
  // HTML sanitize (自定义的中间件，如果需要全局应用)
  // app.use(sanitizeInput); // sanitizeInput 是针对字符串的，如果全局用，确保其鲁棒性

  // 3. 速率限制 (可配置)
  const limiter = rateLimit(options.rateLimitOptions || {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests, please try again later.' },
  });
  app.use(limiter);
  
  // 4. 会话管理 (可选，通过 options.enableSessions 启用)
  // if (options.enableSessions && session && sessionConfig) {
  //   app.use(session(sessionConfig));
  //   if (sessionSecurity) app.use(sessionSecurity);
  //   if (sessionCleanup) app.use(sessionCleanup);
  //   logger.info(\`Session management enabled for \${serviceName}\`);
  // }

  // 5. 请求追踪和上下文中间件 (应该在日志和业务逻辑之前)
  app.use(requestTracker); // 来自 errorHandler.js

  // 6. 审计日志 (如果需要全局应用)
  // app.use(auditLogger(options.auditLogOptions || {})); // auditLogger 可以接受选项

  // 7. 服务特定的路由将由调用方挂载到此处 app.use('/api/v1/service-routes', serviceRoutes);

  // 8. 全局错误处理中间件 (必须在所有路由和中间件之后)
  app.use(errorHandler);

  logger.info(`Base application configured for service: ${serviceName}`);

  return app;
}

module.exports = createBaseApp; 