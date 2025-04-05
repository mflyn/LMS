# 小学生学习追踪系统 - 后端服务

## 项目概述
小学生学习追踪系统是一个用于跟踪和管理小学生学习进度、成绩和资源的综合平台。本仓库包含系统的后端服务实现。

## 技术栈
- Node.js + Express.js
- MongoDB
- Redis
- JWT认证
- 文件存储服务
- PM2（进程管理）
- Winston（日志管理）
- Jest（测试框架）
- ESLint（代码检查）
- Prettier（代码格式化）

## 功能特性

### 核心功能
- 用户认证与授权
- 学习数据管理
- 资源管理
- 成绩追踪
- 作业管理

### 用户体验优化
- 响应时间监控
- 进度提示功能
- 友好的错误处理
- 性能优化
- 数据压缩

## 项目结构
```
backend/
├── app.js                # 应用入口
├── config/              # 配置文件
│   ├── default.js      # 默认配置
│   ├── development.js  # 开发环境配置
│   ├── production.js   # 生产环境配置
│   └── test.js        # 测试环境配置
├── common/              # 公共模块
│   ├── middleware/      # 中间件
│   │   ├── error-handler.js    # 错误处理
│   │   ├── performance.js      # 性能监控
│   │   ├── authentication.js   # 认证
│   │   └── compression.js      # 数据压缩
│   ├── models/         # 数据模型
│   ├── utils/          # 工具函数
│   └── seeds/          # 种子数据
├── services/           # 服务模块
│   ├── auth-service/   # 认证服务
│   ├── data-service/   # 数据服务
│   └── resource-service/ # 资源服务
├── tests/              # 测试文件
│   ├── unit/          # 单元测试
│   ├── integration/   # 集成测试
│   └── e2e/           # 端到端测试
└── logs/              # 日志文件
    ├── access.log     # 访问日志
    ├── error.log      # 错误日志
    └── performance.log # 性能日志
```

## 安装与运行

### 环境要求
- Node.js >= 14.x
- MongoDB >= 4.x
- Redis >= 6.x
- 内存：>= 4GB
- CPU：>= 2核
- 磁盘：>= 100GB

### 安装依赖
```bash
# 安装生产依赖
npm install --production

# 安装开发依赖
npm install --save-dev
```

### 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env

# 主要环境变量
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/learning-tracker
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
LOG_LEVEL=info
```

### 运行服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 使用 PM2 启动
pm2 start ecosystem.config.js

# 使用 Docker 启动
docker-compose up -d
```

## 性能优化

### 性能指标
- 平均响应时间：< 200ms
- 95%响应时间：< 500ms
- 99%响应时间：< 1000ms
- 错误率：< 0.1%
- CPU使用率：< 70%
- 内存使用率：< 80%
- 数据库连接数：< 80%

### 响应时间监控
系统自动监控请求响应时间，并根据以下标准评估性能：
- excellent: < 200ms
- good: 200-500ms
- fair: 500-1000ms
- poor: > 1000ms

### 进度提示
对于长时间运行的请求，系统会提供进度提示：
- 文件上传进度
- 数据处理进度
- 批量操作进度

### 错误处理
系统提供友好的错误处理：
- 清晰的错误消息
- 错误解决建议
- 错误分类处理
- 开发/生产环境差异化

## API 文档
详细的API文档请参考 [API文档](./docs/api.md)

## 测试

### 测试要求
- 单元测试覆盖率：> 80%
- 集成测试覆盖率：> 70%
- 端到端测试覆盖率：> 60%

### 测试命令
```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 生成测试覆盖率报告
npm run test:coverage

# 检查测试覆盖率
npm run test:coverage:check
```

## 部署

### 部署环境
- 操作系统：Ubuntu 20.04 LTS
- Node.js版本：14.x
- MongoDB版本：4.x
- Redis版本：6.x
- Nginx版本：1.18.x

### 部署步骤
1. 安装依赖
```bash
npm install --production
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件
```

3. 构建应用
```bash
npm run build
```

4. 启动服务
```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js

# 使用 Docker 启动
docker-compose up -d
```

5. 配置 Nginx
```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 开发规范

### 代码规范
- 使用ESLint进行代码检查
- 遵循Airbnb JavaScript风格指南
- 使用Prettier进行代码格式化
- 使用TypeScript进行类型检查
- 使用JSDoc进行文档注释

### 提交规范
- 遵循Conventional Commits规范
- 提交信息格式：`<type>(<scope>): <description>`
- 类型：
  - feat: 新功能
  - fix: 修复bug
  - docs: 文档更新
  - style: 代码格式
  - refactor: 重构
  - test: 测试
  - chore: 构建/工具
- 关联Issue编号：`#<issue-number>`

### 文档规范
- 保持文档及时更新
- 使用Markdown格式
- 包含必要的示例代码
- 使用JSDoc注释
- 更新CHANGELOG.md

## 错误处理

### 错误类型
系统支持以下错误类型：
- VALIDATION_ERROR: 数据验证失败
- NOT_FOUND: 资源未找到
- UNAUTHORIZED: 未授权访问
- FORBIDDEN: 禁止访问
- DUPLICATE_DATA: 数据重复
- INVALID_TOKEN: 无效令牌
- TOKEN_EXPIRED: 令牌过期
- INTERNAL_ERROR: 服务器内部错误
- NETWORK_ERROR: 网络错误
- TIMEOUT_ERROR: 请求超时

### 错误处理示例
```javascript
// 使用自定义错误类
const AppError = require('./common/utils/AppError');

// 抛出验证错误
throw new AppError('VALIDATION_ERROR', '用户名不能为空', {
  field: 'username',
  suggestion: '请输入有效的用户名'
});

// 错误处理中间件
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      suggestion: err.suggestion
    });
  }
  // 处理其他错误
  next(err);
});
```

### 错误响应格式
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "错误描述",
  "suggestion": "解决建议",
  "details": {
    "field": "错误字段",
    "value": "错误值"
  }
}
```

## 性能监控

### 监控指标
- 响应时间：请求处理时间
- 吞吐量：单位时间内的请求数
- 错误率：错误请求的比例
- 资源使用：CPU、内存、磁盘使用率
- 数据库性能：查询时间、连接数

### 性能监控实现
```javascript
// 响应时间监控中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = getPerformanceLevel(duration);
    logPerformance(req, duration, level);
  });
  next();
});

// 性能等级判断
function getPerformanceLevel(duration) {
  if (duration < 200) return 'excellent';
  if (duration < 500) return 'good';
  if (duration < 1000) return 'fair';
  return 'poor';
}
```

### 性能优化措施
- 数据库优化：
  - 索引优化
  - 查询优化
  - 连接池管理
- 缓存策略：
  - Redis缓存
  - 内存缓存
  - 查询缓存
- 代码优化：
  - 异步处理
  - 批量操作
  - 延迟加载

## 中间件使用

### 核心中间件
```javascript
// 错误处理中间件
app.use(require('./common/middleware/errorHandler'));

// 性能监控中间件
app.use(require('./common/middleware/performanceMonitor'));

// 认证中间件
app.use(require('./common/middleware/authentication'));

// 数据压缩中间件
app.use(require('./common/middleware/compression'));
```

### 自定义中间件
```javascript
// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// 响应时间中间件
app.use((req, res, next) => {
  res.locals.startTime = Date.now();
  next();
});
```

## 安全措施

### 认证与授权
- JWT认证
- 角色权限控制
- 会话管理
- 密码策略

### 数据安全
- 数据加密
- 输入验证
- XSS防护
- CSRF防护

## 日志管理

### 日志配置
```javascript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console()
  ]
});
```

### 日志级别
- ERROR: 错误日志
- WARN: 警告日志
- INFO: 信息日志
- DEBUG: 调试日志
- TRACE: 跟踪日志

## 监控告警

### 监控配置
```javascript
const monitor = {
  metrics: {
    responseTime: new Histogram(),
    requestCount: new Counter(),
    errorCount: new Counter(),
    resourceUsage: new Gauge()
  },
  alerts: {
    responseTime: {
      threshold: 1000,
      interval: '5m'
    },
    errorRate: {
      threshold: 0.01,
      interval: '1h'
    }
  }
};
```

### 告警规则
- 响应时间 > 1000ms
- 错误率 > 1%
- CPU使用率 > 80%
- 内存使用率 > 90%
- 磁盘使用率 > 85%

### 告警通知
- 邮件通知
- Slack通知
- 短信通知
- 电话通知

## 维护与支持

### 日常维护
1. 检查服务状态
2. 监控性能指标
3. 检查日志文件
4. 清理临时文件
5. 更新依赖包
6. 备份数据
7. 优化存储
8. 检查安全配置

### 故障处理
1. 服务不可用
   - 检查日志
   - 检查资源使用
   - 重启服务
   - 回滚版本

2. 存储问题
   - 检查存储服务
   - 检查磁盘空间
   - 清理过期文件
   - 扩容存储

3. 性能问题
   - 分析慢查询
   - 优化索引
   - 调整缓存
   - 扩容资源

## 贡献指南

### 开发流程
1. Fork 项目
2. 创建特性分支
   ```bash
   git checkout -b feature/your-feature
   ```
3. 提交更改
   ```bash
   git commit -m "feat: add new feature"
   ```
4. 推送到分支
   ```bash
   git push origin feature/your-feature
   ```
5. 创建 Pull Request

### 代码审查
- 确保代码符合规范
- 添加必要的测试
- 更新相关文档
- 检查性能影响
- 确保向后兼容

### 发布流程
1. 更新版本号
2. 更新CHANGELOG.md
3. 创建发布标签
4. 发布到npm
5. 更新文档

## 许可证
MIT License

## 联系方式
- 项目维护者：张三
- 技术负责人：李四
- 运维负责人：王五
- 邮箱：support@example.com
- 问题反馈：GitHub Issues
- 紧急联系：+86 123 4567 8900
- 工作时间：周一至周五 9:00-18:00
- 值班安排：7x24小时轮值 