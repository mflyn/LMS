# 学习进度追踪服务 (Progress Service)

学习进度追踪服务是小学生学习追踪系统的核心微服务之一，负责跟踪和分析学生的学习进度，生成进度报告，并提供学习路径建议。本服务通过整合课程大纲、学习目标和学生表现数据，为学生、教师和家长提供全面的学习进度视图。

## 功能特性

### 进度跟踪
- 课程大纲进度监控
- 知识点掌握度评估
- 学习目标完成情况
- 学习时间和效率分析
- 进度里程碑提醒

### 报告生成
- 个人学习进度报告
- 班级整体进度报告
- 知识点掌握热力图
- 学习曲线和趋势图
- 定期进度总结报告

### 学习路径
- 个性化学习路径推荐
- 薄弱环节识别和强化建议
- 学习计划生成和调整
- 学习资源推荐

### 预警机制
- 进度落后预警
- 知识点掌握不足预警
- 学习效率下降预警
- 学习行为异常预警

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（进度数据存储）
- Redis（缓存和实时数据）
- 数据分析和统计库
- 报告生成引擎

### 目录结构
```
/progress-service
  ├── server.js           # 服务入口
  ├── models/             # 数据模型
  │   └── Progress.js     # 进度模型
  └── routes/             # API路由
      ├── index.js        # 路由入口
      ├── progress.js     # 进度相关路由
      └── reports.js      # 报告相关路由
```

## 数据模型

### Progress 模型

```javascript
const progressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  chapter: { type: String, required: true },
  section: { type: String, required: true },
  completionRate: { type: Number, min: 0, max: 100, required: true },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed', 'reviewing'], default: 'not_started' },
  comments: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
```

## API接口

### 进度接口

#### 获取学生进度
- **GET** `/student/{studentId}`
- 请求头：`Authorization: Bearer {token}`（由API网关处理）
- 查询参数：
  - `subject`: 科目ID（可选）
  - `period`: 时间段（week/month/semester/year，默认：semester）
- 响应：学生进度数据

#### 更新进度记录
- **POST** `/student/update`
- 请求头：`Authorization: Bearer {token}`（由API网关处理）
- 请求体：
  ```json
  {
    "student": "string",
    "subject": "string",
    "chapter": "string",
    "section": "string",
    "completionRate": "number",
    "status": "string",
    "comments": "string"
  }
  ```
- 响应：更新后的进度记录

### 报告接口

#### 生成个人进度报告
- **GET** `/api/reports/student/{studentId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `type`: 报告类型（daily/weekly/monthly，默认：weekly）
  - `format`: 报告格式（json/pdf/html，默认：json）
  - `subject`: 科目ID（可选）
- 响应：进度报告数据或文件下载链接

#### 生成班级进度报告
- **GET** `/api/reports/class/{classId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `type`: 报告类型（weekly/monthly/semester，默认：monthly）
  - `format`: 报告格式（json/pdf/html，默认：json）
  - `subject`: 科目ID（可选）
- 响应：班级进度报告数据或文件下载链接

## 使用示例

### 前端获取学生进度示例

```javascript
async function fetchStudentProgress(studentId, subjectId) {
  try {
    const url = new URL(`${API_BASE_URL}/api/progress/student/${studentId}`);
    if (subjectId) url.searchParams.append('subject', subjectId);
    url.searchParams.append('period', 'month');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`获取进度失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取学生进度出错:', error);
    throw error;
  }
}
```

### 更新学生进度示例

```javascript
async function updateStudentProgress(progressData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/progress/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(progressData)
    });
    
    if (!response.ok) {
      throw new Error(`更新进度失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('更新学生进度出错:', error);
    throw error;
  }
}
```

### 生成进度报告示例

```javascript
async function generateStudentReport(studentId, reportType = 'weekly', format = 'pdf') {
  try {
    const url = new URL(`${API_BASE_URL}/api/reports/student/${studentId}`);
    url.searchParams.append('type', reportType);
    url.searchParams.append('format', format);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`生成报告失败: ${response.status}`);
    }
    
    // 如果是PDF或其他文件格式，处理文件下载
    if (format !== 'json') {
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `学习进度报告_${studentId}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      return { success: true, message: '报告下载已开始' };
    }
    
    // JSON格式直接返回数据
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('生成学生报告出错:', error);
    throw error;
  }
}
```

## 错误处理

服务返回的错误格式如下：

```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "错误描述",
  "details": {}
}
```

常见错误代码：

| 错误代码 | HTTP状态码 | 描述 |
|---------|-----------|------|
| INVALID_PARAMS | 400 | 请求参数无效 |
| UNAUTHORIZED | 401 | 未授权访问 |
| FORBIDDEN | 403 | 权限不足 |
| RESOURCE_NOT_FOUND | 404 | 请求的资源不存在 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务暂时不可用 |

## 部署说明

### 环境变量

服务需要以下环境变量：

| 变量名 | 描述 | 默认值 |
|-------|------|-------|
| PORT | 服务端口 | 3003 |
| MONGODB_URI | MongoDB连接URI | mongodb://localhost:27017/student-tracking |
| REDIS_URI | Redis连接URI | redis://localhost:6379 |
| JWT_SECRET | JWT密钥 | (无默认值，必须设置) |
| LOG_LEVEL | 日志级别 | info |
| NODE_ENV | 运行环境 | development |

### Docker部署

```bash
# 构建镜像
docker build -t progress-service .

# 运行容器
docker run -d \
  -p 3003:3003 \
  -e MONGODB_URI=mongodb://mongo:27017/student-tracking \
  -e REDIS_URI=redis://redis:6379 \
  -e JWT_SECRET=your-secret-key \
  -e NODE_ENV=production \
  --name progress-service \
  progress-service
```

### Kubernetes部署

使用项目根目录下的 `deployment/kubernetes/progress-service-deployment.yaml` 文件进行部署：

```bash
kubectl apply -f deployment/kubernetes/progress-service-deployment.yaml
```

## 性能优化

服务实现了以下性能优化措施：

1. **数据缓存**：使用Redis缓存频繁访问的数据，如学生进度概览和报告模板
2. **查询优化**：为常用查询字段创建索引，优化MongoDB查询性能
3. **分页处理**：大数据集查询结果实现分页，避免一次性返回过多数据
4. **异步处理**：耗时操作（如报告生成）使用异步处理，避免阻塞主线程
5. **数据压缩**：API响应使用gzip压缩，减少网络传输量

## 监控与日志

服务集成了以下监控和日志功能：

1. **健康检查端点**：`/health` 提供服务健康状态
2. **性能指标**：`/metrics` 提供服务性能指标，兼容Prometheus
3. **结构化日志**：使用Winston记录结构化日志，便于分析和查询
4. **请求追踪**：集成请求ID追踪，便于跨服务调试

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 代码风格检查
npm run lint
```

### 贡献指南

1. Fork项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 常见问题

### Q: 如何处理大量学生的进度数据？
A: 服务使用分页和索引优化来处理大量数据。对于超大规模数据，可以考虑使用数据分片或时间序列数据库。

### Q: 报告生成过程中服务崩溃怎么办？
A: 报告生成使用异步任务队列处理，具有自动重试和失败恢复机制。可以通过任务ID查询生成状态。

### Q: 如何扩展服务以支持新的报告类型？
A: 在`routes/reports.js`中添加新的路由处理函数，并在报告生成引擎中实现相应的模板和数据处理逻辑。

## 版本历史

### v1.2.0 (2023-06-15)
- 添加知识点掌握热力图功能
- 优化报告生成性能
- 增加批量进度更新API

### v1.1.0 (2023-04-10)
- 添加学习路径推荐功能
- 集成Redis缓存
- 改进错误处理机制

### v1.0.0 (2023-02-01)
- 初始版本发布
- 基本进度跟踪功能
- 个人和班级报告生成