# 学习资源管理服务 (Resource Service)

学习资源管理服务是小学生学习追踪系统的核心微服务之一，负责管理和提供各类学习资源，包括电子教材、视频课程、习题集和学习辅助材料等。本服务支持资源的上传、分类、检索和个性化推荐，为学生提供丰富的学习内容。

## 功能特性

### 资源管理
- 资源上传和存储
- 资源元数据管理
- 资源分类和标签
- 资源版本控制
- 资源审核和发布

### 资源检索
- 多条件资源搜索
- 资源分类浏览
- 知识点关联查询
- 全文内容搜索
- 高级筛选功能

### 资源推荐
- 基于学习进度的推荐
- 基于知识点薄弱环节的推荐
- 基于学习风格的推荐
- 基于同伴学习行为的推荐
- 教师指定推荐

### 资源互动
- 资源评分和评价
- 资源收藏和分享
- 资源使用统计
- 学习笔记和标注
- 资源问答和讨论

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（资源元数据存储）
- MinIO/S3（资源文件存储）
- Elasticsearch（全文搜索）
- Redis（缓存和排行榜）

### 目录结构
```
/resource-service
  ├── server.js           # 服务入口
  ├── models/             # 数据模型
  │   ├── Resource.js     # 资源模型
  │   ├── ResourceCollection.js # 资源集合模型
  │   └── ResourceReview.js # 资源评价模型
  ├── routes/             # API路由
  │   ├── resources.js    # 资源相关路由
  │   └── recommendations.js # 推荐相关路由
  ├── services/           # 业务服务
  │   ├── resource-service.js # 资源服务
  │   ├── storage-service.js # 存储服务
  │   ├── search-service.js # 搜索服务
  │   └── recommendation-service.js # 推荐服务
  ├── middleware/         # 中间件
  │   ├── error-handler.js    # 错误处理
  │   ├── validator.js        # 数据验证
  │   ├── logger.js           # 日志记录
  │   └── performance.js      # 性能监控
  ├── utils/              # 工具函数
  │   ├── validation.js       # 验证工具
  │   ├── encryption.js       # 加密工具
  │   └── format.js          # 格式化工具
  ├── test/               # 单元测试
  │   └── recommendations.test.js # 推荐算法测试
  └── tests/              # 集成测试
      ├── resources.test.js # 资源API测试
      └── resources.integration.test.js # 资源集成测试
```

## API接口

### 资源接口

#### 上传资源
- **POST** `/api/resources`
- 请求头：`Authorization: Bearer {token}`
- 请求体：`multipart/form-data`
  ```
  title: 资源标题
  description: 资源描述
  type: 资源类型（document/video/audio/exercise）
  subject: 科目ID
  gradeLevel: 年级级别
  knowledgePoints: 知识点ID数组
  tags: 标签数组
  file: 资源文件
  thumbnail: 缩略图（可选）
  ```
- 响应：上传的资源对象

#### 获取资源列表
- **GET** `/api/resources`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `type`: 资源类型（可选）
  - `subject`: 科目ID（可选）
  - `grade`: 年级级别（可选）
  - `knowledgePoint`: 知识点ID（可选）
  - `tags`: 标签（可选，逗号分隔）
  - `query`: 搜索关键词（可选）
  - `sort`: 排序方式（newest/popular/rating，默认：newest）
  - `page`: 页码（默认：1）
  - `limit`: 每页数量（默认：20）
- 响应：资源列表和分页信息

#### 获取资源详情
- **GET** `/api/resources/{resourceId}`
- 请求头：`Authorization: Bearer {token}`
- 响应：资源详细信息

#### 评价资源
- **POST** `/api/resources/{resourceId}/reviews`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "rating": "number", // 1-5
    "comment": "string",
    "tags": ["string"] // 评价标签
  }
  ```
- 响应：创建的评价对象

### 推荐接口

#### 获取个性化推荐
- **GET** `/api/recommendations/personalized`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `count`: 推荐数量（默认：10）
  - `type`: 资源类型（可选）
  - `subject`: 科目ID（可选）
- 响应：推荐资源列表

#### 获取知识点相关资源
- **GET** `/api/recommendations/knowledge-point/{knowledgePointId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `count`: 推荐数量（默认：10）
  - `type`: 资源类型（可选）
  - `difficulty`: 难度级别（可选）
- 响应：相关资源列表

#### 获取热门资源
- **GET** `/api/recommendations/trending`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `period`: 时间段（day/week/month，默认：week）
  - `count`: 推荐数量（默认：10）
  - `subject`: 科目ID（可选）
  - `grade`: 年级级别（可选）
- 响应：热门资源列表

## 数据模型

### 资源模型 (Resource)
```javascript
{
  title: String,           // 资源标题
  description: String,     // 资源描述
  type: String,            // 资源类型
  subject: ObjectId,       // 科目ID
  gradeLevel: [Number],    // 适用年级
  knowledgePoints: [ObjectId], // 关联知识点
  tags: [String],          // 标签
  author: ObjectId,        // 上传者ID
  fileUrl: String,         // 文件URL
  fileSize: Number,        // 文件大小
  fileType: String,        // 文件MIME类型
  thumbnailUrl: String,    // 缩略图URL
  duration: Number,        // 时长（视频/音频）
  pageCount: Number,       // 页数（文档）
  difficulty: Number,      // 难度级别（1-5）
  status: String,          // 状态（pending/approved/rejected）
  featured: Boolean,       // 是否精选
  stats: {
    views: Number,        // 查看次数
    downloads: Number,     // 下载次数
    favorites: Number,     // 收藏次数
    shares: Number,        // 分享次数
    averageRating: Number, // 平均评分
    reviewCount: Number    // 评价数量
  },
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date,       // 更新时间
    approvedAt: Date       // 审核通过时间
  }
}
```

### 资源集合模型 (ResourceCollection)
```javascript
{
  title: String,           // 集合标题
  description: String,     // 集合描述
  creator: ObjectId,       // 创建者ID
  isPublic: Boolean,       // 是否公开
  resources: [{
    resourceId: ObjectId,  // 资源ID
    addedAt: Date,         // 添加时间
    note: String           // 备注
  }],
  tags: [String],          // 标签
  coverUrl: String,        // 封面URL
  stats: {
    views: Number,        // 查看次数
    followers: Number      // 关注人数
  },
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

### 资源评价模型 (ResourceReview)
```javascript
{
  resourceId: ObjectId,    // 资源ID
  userId: ObjectId,        // 用户ID
  rating: Number,          // 评分（1-5）
  comment: String,         // 评价内容
  tags: [String],          // 评价标签
  helpfulCount: Number,    // 有帮助数
  reportCount: Number,     // 举报数
  status: String,          // 状态（active/hidden）
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
  NOT_FOUND: 'NOT_FOUND',                  // 资源不存在
  DUPLICATE_DATA: 'DUPLICATE_DATA',        // 重复数据
  STORAGE_ERROR: 'STORAGE_ERROR',          // 存储错误
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

## 性能监控

### 监控指标
```javascript
const metrics = {
  responseTime: new Histogram(),
  requestCount: new Counter(),
  errorCount: new Counter(),
  storageUsage: new Gauge(),
  cacheHitRate: new Gauge()
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
- 存储使用率：< 80%
- 缓存命中率：> 70%

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

## 部署

### 环境要求
- Node.js >= 14.x
- MongoDB >= 4.x
- MinIO/S3 兼容存储
- Elasticsearch >= 7.x
- Redis >= 6.x
- 内存：>= 4GB
- CPU：>= 2核
- 磁盘：>= 100GB

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
curl http://localhost:3006/health

# 检查存储服务
curl http://localhost:3006/health/storage

# 检查搜索服务
curl http://localhost:3006/health/search
```

## 资源审核

### 审核流程
1. 资源上传
2. 自动检查
   - 文件格式验证
   - 病毒扫描
   - 内容安全检查
3. 人工审核
   - 内容审核
   - 版权检查
   - 质量评估
4. 审核结果
   - 通过：发布资源
   - 拒绝：通知上传者
   - 需要修改：提供反馈

### 审核标准
1. 内容标准
   - 教育价值
   - 内容准确性
   - 适合年龄段
   - 无不当内容

2. 技术标准
   - 文件完整性
   - 格式兼容性
   - 加载性能
   - 移动端适配

3. 版权标准
   - 版权声明
   - 使用许可
   - 引用规范
   - 原创证明

## 数据备份

### 备份策略
1. 元数据备份
   - 每日增量备份
   - 每周完整备份
   - MongoDB备份

2. 文件备份
   - 实时同步到备份存储
   - 每日快照
   - 版本控制

3. 备份存储
   - 本地备份
   - 异地备份
   - 云存储备份

### 恢复流程
1. 数据恢复
   - 选择恢复点
   - 恢复元数据
   - 恢复文件

2. 验证恢复
   - 数据完整性检查
   - 功能测试
   - 性能测试

## 维护指南

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

## 更新日志

### v1.1.0 (2024-03-15)
- 新增资源审核功能
- 优化存储性能
- 改进推荐算法
- 增强安全配置
- 更新依赖包版本

### v1.0.0 (2024-01-01)
- 初始版本发布
- 基础功能实现
- 核心API完成
- 文档完善