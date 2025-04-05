# 数据录入与管理服务 (Data Service)

数据录入与管理服务是小学生学习追踪系统的核心微服务之一，负责处理和管理学生的学习数据，包括成绩记录、作业管理、错题记录和班级表现等数据。本服务为系统提供数据存储、检索和分析的基础功能。

## 功能特性

### 成绩管理
- 考试和测验成绩录入
- 成绩查询和统计
- 成绩趋势分析
- 成绩报告生成
- 成绩导入导出

### 作业管理
- 作业记录和跟踪
- 作业完成情况统计
- 作业质量评估
- 批量作业数据处理

### 错题记录
- 错题收集和分类
- 错题关联知识点
- 错题频率分析
- 个性化错题本生成

### 班级表现
- 课堂表现记录
- 出勤率统计
- 班级整体表现分析
- 学生行为记录

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（非结构化数据）
- MySQL（结构化数据）
- Redis（缓存）
- 数据验证和处理库

### 目录结构
```
/data-service
  ├── config.js           # 服务配置
  ├── server.js           # 服务入口
  ├── package.json        # 依赖管理
  ├── models/             # 数据模型
  │   ├── Grade.js        # 成绩模型
  │   ├── Homework.js     # 作业模型
  │   ├── MistakeRecord.js # 错题记录模型
  │   └── ClassPerformance.js # 班级表现模型
  ├── routes/             # API路由
  │   ├── index.js        # 路由入口
  │   ├── grade.js        # 成绩相关路由
  │   ├── homework.js     # 作业相关路由
  │   ├── mistake-record.js # 错题相关路由
  │   └── class-performance.js # 班级表现相关路由
  ├── services/           # 业务服务
  │   ├── grade-service.js    # 成绩服务
  │   ├── homework-service.js # 作业服务
  │   ├── mistake-service.js  # 错题服务
  │   └── class-service.js    # 班级服务
  ├── middleware/         # 中间件
  │   ├── error-handler.js    # 错误处理
  │   ├── validator.js        # 数据验证
  │   ├── logger.js           # 日志记录
  │   └── performance.js      # 性能监控
  ├── utils/              # 工具函数
  │   ├── validation.js       # 验证工具
  │   ├── encryption.js       # 加密工具
  │   └── format.js          # 格式化工具
  └── tests/              # 测试文件
      ├── unit/           # 单元测试
      ├── integration/    # 集成测试
      └── performance/    # 性能测试
```

## API接口

### 成绩接口

#### 添加成绩记录
- **POST** `/api/grades`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "studentId": "string",
    "subjectId": "string",
    "examId": "string",
    "score": "number",
    "totalScore": "number",
    "date": "date",
    "comments": "string"
  }
  ```
- 响应：创建的成绩记录

#### 获取学生成绩
- **GET** `/api/grades/student/{studentId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `subject`: 科目ID（可选）
  - `startDate`: 开始日期（可选）
  - `endDate`: 结束日期（可选）
- 响应：成绩记录列表

### 作业接口

#### 添加作业记录
- **POST** `/api/homework`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "title": "string",
    "description": "string",
    "subjectId": "string",
    "classId": "string",
    "dueDate": "date",
    "attachments": ["string"],
    "totalPoints": "number"
  }
  ```
- 响应：创建的作业记录

#### 获取班级作业
- **GET** `/api/homework/class/{classId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `status`: 作业状态（可选）
  - `startDate`: 开始日期（可选）
  - `endDate`: 结束日期（可选）
- 响应：作业记录列表

### 错题记录接口

#### 添加错题记录
- **POST** `/api/mistake-records`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "studentId": "string",
    "questionId": "string",
    "subjectId": "string",
    "knowledgePointId": "string",
    "mistakeType": "string",
    "correctAnswer": "string",
    "studentAnswer": "string",
    "date": "date"
  }
  ```
- 响应：创建的错题记录

#### 获取学生错题本
- **GET** `/api/mistake-records/student/{studentId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `subject`: 科目ID（可选）
  - `knowledgePoint`: 知识点ID（可选）
- 响应：错题记录列表

## 数据模型

### 成绩模型 (Grade)
```javascript
{
  studentId: ObjectId,     // 学生ID
  subjectId: ObjectId,     // 科目ID
  examId: ObjectId,        // 考试ID
  score: Number,           // 得分
  totalScore: Number,      // 总分
  percentage: Number,      // 得分百分比
  rank: Number,            // 排名
  date: Date,              // 考试日期
  comments: String,        // 评语
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

### 作业模型 (Homework)
```javascript
{
  title: String,           // 作业标题
  description: String,     // 作业描述
  subjectId: ObjectId,     // 科目ID
  classId: ObjectId,       // 班级ID
  teacherId: ObjectId,     // 教师ID
  dueDate: Date,           // 截止日期
  attachments: [String],   // 附件URL
  totalPoints: Number,     // 总分
  status: String,          // 状态
  submissions: [{          // 提交记录
    studentId: ObjectId,   // 学生ID
    submissionDate: Date,  // 提交日期
    score: Number,         // 得分
    feedback: String,      // 反馈
    attachments: [String]  // 提交的附件
  }],
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

## 错误处理

### 错误类型
```javascript
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',    // 数据验证错误
  NOT_FOUND: 'NOT_FOUND',                  // 数据不存在
  DUPLICATE_DATA: 'DUPLICATE_DATA',        // 重复数据
  DATABASE_ERROR: 'DATABASE_ERROR',        // 数据库错误
  PERMISSION_DENIED: 'PERMISSION_DENIED',  // 权限不足
  INVALID_FORMAT: 'INVALID_FORMAT',        // 格式错误
  SYSTEM_ERROR: 'SYSTEM_ERROR'             // 系统错误
};
```

### 错误处理中间件
```javascript
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const error = {
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Internal Server Error',
    details: err.details || null,
    timestamp: new Date().toISOString()
  };

  // 记录错误日志
  logger.error({
    error,
    request: {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: req.body
    }
  });

  res.status(status).json({ error });
};
```

## 数据验证

### 成绩数据验证
```javascript
const validateGrade = (grade) => {
  const schema = Joi.object({
    studentId: Joi.string().required(),
    subjectId: Joi.string().required(),
    examId: Joi.string().required(),
    score: Joi.number().min(0).required(),
    totalScore: Joi.number().min(0).required(),
    date: Joi.date().required(),
    comments: Joi.string().max(500)
  });

  return schema.validate(grade);
};
```

### 作业数据验证
```javascript
const validateHomework = (homework) => {
  const schema = Joi.object({
    title: Joi.string().required().max(100),
    description: Joi.string().required(),
    subjectId: Joi.string().required(),
    classId: Joi.string().required(),
    dueDate: Joi.date().required(),
    attachments: Joi.array().items(Joi.string()),
    totalPoints: Joi.number().min(0).required()
  });

  return schema.validate(homework);
};
```

## 性能监控

### 监控指标
```javascript
const metrics = {
  responseTime: new Histogram(),
  requestCount: new Counter(),
  errorCount: new Counter(),
  dataSize: new Gauge()
};

// 记录响应时间
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.responseTime.observe(duration);
    metrics.requestCount.inc();
  });
  next();
});
```

### 性能指标
- 平均响应时间：< 200ms
- 95%响应时间：< 500ms
- 99%响应时间：< 1000ms
- 错误率：< 0.1%
- 并发处理能力：> 1000 QPS
- 数据导入速度：> 1000条/秒
- 数据导出速度：> 500条/秒

## 日志记录

### 日志配置
```javascript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
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

## 测试

### 单元测试
```bash
# 运行单元测试
npm run test:unit

# 运行测试覆盖率
npm run test:coverage
```

### 集成测试
```bash
# 运行集成测试
npm run test:integration

# 运行性能测试
npm run test:performance
```

### 测试覆盖率要求
- 语句覆盖率：> 85%
- 分支覆盖率：> 80%
- 函数覆盖率：> 90%
- 行覆盖率：> 85%

## 部署

### 环境要求
- Node.js >= 14.x
- MongoDB >= 4.x
- MySQL >= 8.x
- Redis >= 6.x
- 内存：>= 4GB
- CPU：>= 2核
- 磁盘：>= 50GB

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

3. 启动服务
```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js

# 使用 Docker 启动
docker-compose up -d
```

### 健康检查
```bash
# 检查服务状态
curl http://localhost:3002/health

# 检查数据库连接
curl http://localhost:3002/health/db

# 检查缓存状态
curl http://localhost:3002/health/cache
```

## 安全配置

### 数据加密
```javascript
const encryptData = (data) => {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};
```

### 访问控制
```javascript
const checkPermission = async (req, res, next) => {
  const { role, userId } = req.user;
  const resourceId = req.params.id;

  const hasPermission = await PermissionService.checkAccess({
    role,
    userId,
    resourceId,
    action: req.method
  });

  if (!hasPermission) {
    throw new AppError('PERMISSION_DENIED', 'Access denied');
  }

  next();
};
```

## 性能优化

### 数据库优化
```javascript
// 创建索引
db.grades.createIndex({ studentId: 1, subjectId: 1, date: -1 });
db.homework.createIndex({ classId: 1, dueDate: -1 });
db.mistakeRecords.createIndex({ studentId: 1, subjectId: 1 });

// 使用聚合管道
const pipeline = [
  { $match: { studentId: studentId } },
  { $group: { _id: "$subjectId", avgScore: { $avg: "$score" } } },
  { $sort: { avgScore: -1 } }
];
```

### 缓存策略
```javascript
const getStudentGrades = async (studentId) => {
  const cacheKey = `grades:${studentId}`;
  const cachedData = await redis.get(cacheKey);
  
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const grades = await Grade.find({ studentId });
  await redis.set(cacheKey, JSON.stringify(grades), 'EX', 3600);
  return grades;
};
```

### 批量处理
```javascript
const batchInsert = async (data, chunkSize = 1000) => {
  const chunks = _.chunk(data, chunkSize);
  for (const chunk of chunks) {
    await Grade.insertMany(chunk, { ordered: false });
  }
};
```

## 监控告警

### 告警规则
```yaml
rules:
  - alert: HighErrorRate
    expr: error_rate > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }}%"

  - alert: SlowResponse
    expr: response_time_95 > 500
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow response time"
      description: "95th percentile response time is {{ $value }}ms"
```

### 告警通知
- 邮件通知
- 短信通知
- Slack通知
- 企业微信通知

## 维护指南

### 日常维护
1. 检查服务状态
2. 监控性能指标
3. 检查日志文件
4. 清理临时文件
5. 更新依赖包
6. 备份数据
7. 优化数据库
8. 检查安全配置

### 故障处理
1. 服务不可用
   - 检查日志
   - 检查资源使用
   - 重启服务
   - 回滚版本

2. 数据不一致
   - 运行数据校验
   - 修复数据
   - 更新索引
   - 清理缓存

3. 性能下降
   - 分析慢查询
   - 优化索引
   - 调整缓存
   - 扩容资源

## 更新日志

### v1.1.0 (2024-03-15)
- 新增性能监控功能
- 优化数据导入导出
- 改进错误处理机制
- 增强安全配置
- 更新依赖包版本

### v1.0.0 (2024-01-01)
- 初始版本发布
- 基础功能实现
- 核心API完成
- 文档完善