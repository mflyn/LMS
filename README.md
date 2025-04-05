# 小学生学习追踪系统

## 项目简介
小学生学习追踪系统是一个用于帮助教师、学生和家长追踪学习进度、管理作业和评估学习效果的综合性平台。系统采用微服务架构，支持 Web 端和移动端访问，提供完整的学习管理解决方案。

## 功能特点
- 学生管理：学生信息、班级管理、成绩记录
- 作业管理：作业发布、提交、批改、统计
- 学习资源：课件、视频、练习题等资源管理
- 数据分析：学习进度、成绩趋势、错题分析
- 家校互动：通知发布、作业提醒、成绩反馈
- 移动应用：
  - 学生端：学习进度跟踪、作业管理、资源中心、错题本
  - 家长端：学习监控、作业跟踪、家校互动、多子女管理
- 用户体验优化：
  - 响应时间监控：实时监控系统性能，确保响应时间<200ms
  - 进度提示：文件上传、数据处理等操作的进度显示
  - 友好的错误处理：清晰的错误提示和解决方案
  - 性能优化：数据压缩、缓存策略、懒加载等
  - 数据安全：加密传输、访问控制、敏感数据保护

## 技术栈
- 后端：
  - Node.js 18.2.0
  - Express 4.18.0
  - MongoDB 6.0.0
  - Redis 7.0.0
  - TypeScript 5.0.0
- 前端：
  - React 18.2.0
  - Redux Toolkit 1.9.0
  - Ant Design 5.0.0 (Web端)
  - React Native 0.72.0 (移动端)
  - TypeScript 5.0.0
- 测试：
  - Jest 29.0.0
  - Supertest 6.3.0
  - MongoDB Memory Server 8.0.0
  - React Testing Library 14.0.0
- 部署：
  - Docker 24.0.0
  - Kubernetes 1.28.0
  - Nginx 1.25.0
- 监控：
  - Prometheus 2.45.0
  - Grafana 10.0.0
  - ELK Stack 8.8.0
- 错误处理：
  - Sentry 7.0.0
  - 自定义错误处理中间件

## 项目结构
```
.
├── backend/          # 后端代码
│   ├── common/       # 公共模块
│   │   ├── config/   # 配置管理
│   │   ├── middleware/ # 中间件
│   │   ├── models/   # 数据模型
│   │   ├── utils/    # 工具函数
│   │   └── types/    # 类型定义
│   ├── services/     # 微服务模块
│   │   ├── user-service/    # 用户服务
│   │   ├── homework-service/ # 作业服务
│   │   ├── resource-service/ # 资源服务
│   │   └── data-service/    # 数据服务
│   └── gateway/      # API网关
│       ├── routes/   # 路由配置
│       ├── middleware/ # 网关中间件
│       └── config/   # 网关配置
├── frontend/         # 前端代码
│   ├── web/          # Web端应用
│   │   ├── src/      # 源代码
│   │   ├── public/   # 静态资源
│   │   └── config/   # 配置文件
│   └── mobile/       # 移动端应用
│       ├── student-app/  # 学生端应用
│       │   ├── src/      # 源代码
│       │   ├── assets/   # 资源文件
│       │   └── config/   # 配置文件
│       └── parent-app/   # 家长端应用
│           ├── src/      # 源代码
│           ├── assets/   # 资源文件
│           └── config/   # 配置文件
├── docs/             # 项目文档
│   ├── development/  # 开发文档
│   ├── api/         # API文档
│   ├── deployment/  # 部署文档
│   ├── architecture/ # 架构文档
│   └── user-guide/  # 用户指南
├── deployment/       # 部署配置
│   ├── docker/      # Docker配置
│   ├── kubernetes/  # Kubernetes配置
│   └── nginx/       # Nginx配置
└── scripts/          # 脚本工具
    ├── dev/         # 开发脚本
    ├── build/       # 构建脚本
    └── deploy/      # 部署脚本
```

## 开发环境
- Node.js >= 18.0.0
- MongoDB >= 6.0.0
- Redis >= 7.0.0
- npm >= 9.0.0
- Docker >= 24.0.0
- Kubernetes >= 1.28.0
- 内存 >= 16GB
- 磁盘空间 >= 50GB
- 操作系统：Linux/macOS/Windows

## 快速开始

### 安装依赖
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install

# 安装移动端依赖
cd mobile/student-app
npm install
cd ../parent-app
npm install
```

### 配置环境
1. 复制环境变量文件
```bash
# 后端环境变量
cp backend/.env.example backend/.env
cp backend/.env.example backend/.env.development
cp backend/.env.example backend/.env.production

# 前端环境变量
cp frontend/.env.example frontend/.env
cp frontend/.env.example frontend/.env.development
cp frontend/.env.example frontend/.env.production

# 移动端环境变量
cp frontend/mobile/student-app/.env.example frontend/mobile/student-app/.env
cp frontend/mobile/parent-app/.env.example frontend/mobile/parent-app/.env
```

2. 修改环境变量配置
```env
# 后端环境变量示例
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/education
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
API_RATE_LIMIT=100
LOG_LEVEL=debug

# 前端环境变量示例
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=ws://localhost:3000
REACT_APP_ENV=development
REACT_APP_VERSION=1.0.0
```

### 启动服务
```bash
# 启动后端服务
cd backend
npm run dev

# 启动前端服务
cd ../frontend
npm start

# 启动移动端服务
cd mobile/student-app
npm start
cd ../parent-app
npm start
```

## 测试
```bash
# 运行后端测试
cd backend
npm test
npm run test:coverage

# 运行前端测试
cd ../frontend
npm test
npm run test:coverage

# 运行移动端测试
cd mobile/student-app
npm test
cd ../parent-app
npm test
```

### 测试覆盖率要求
- 后端服务：>90%
  - 单元测试：>95%
  - 集成测试：>85%
  - API测试：>90%
- 前端组件：>80%
  - 组件测试：>85%
  - 页面测试：>75%
  - 集成测试：>80%
- 移动端应用：>75%
  - 组件测试：>80%
  - 功能测试：>70%
  - 集成测试：>75%

## 性能指标

### 响应时间
- API响应时间：<100ms
- 页面加载时间：<2s
- 首屏渲染时间：<1s
- 移动端启动时间：<3s

### 并发能力
- 最大并发用户：10000
- 每秒请求数：1000
- 数据库连接数：100
- WebSocket连接数：5000

### 资源使用
- CPU使用率：<70%
- 内存使用率：<80%
- 磁盘使用率：<85%
- 网络带宽：<50%

## 错误处理

### 错误类型
- 验证错误 (400)
- 认证错误 (401)
- 授权错误 (403)
- 资源不存在 (404)
- 服务器错误 (500)
- 服务不可用 (503)

### 错误处理流程
1. 错误捕获
2. 错误分类
3. 错误记录
4. 错误通知
5. 错误恢复

### 监控告警
- 错误率 > 1%
- 响应时间 > 200ms
- CPU使用率 > 80%
- 内存使用率 > 85%
- 磁盘使用率 > 90%

## 构建部署

### 本地开发环境
```bash
# 构建前端
cd frontend
npm run build

# 构建后端
cd ../backend
npm run build

# 构建移动端
cd ../frontend/mobile/student-app
npm run build
cd ../parent-app
npm run build
```

### Docker部署
```bash
# 使用Docker Compose启动所有服务
docker-compose -f deployment/docker/docker-compose.yml up -d

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f
```

### Kubernetes部署
```bash
# 部署到Kubernetes集群
kubectl apply -k deployment/kubernetes/

# 查看部署状态
kubectl get pods
kubectl get services

# 查看部署日志
kubectl logs -f deployment/app
```

## 系统架构

系统采用微服务架构设计，主要包含以下组件：

- API网关：
  - 统一请求入口
  - 路由转发
  - 认证授权
  - 限流控制
  - 性能监控
  - 错误处理
- 微服务集群：
  - 用户服务：用户管理、认证授权
  - 作业服务：作业管理、批改统计
  - 资源服务：资源管理、文件存储
  - 数据服务：数据分析、报表生成
- 数据存储层：
  - MongoDB：主数据库
  - Redis：缓存数据库
  - Elasticsearch：搜索服务
- 前端应用：
  - Web端：管理后台
  - 移动端：学生端、家长端
- 监控系统：
  - 性能监控：Prometheus + Grafana
  - 日志分析：ELK Stack
  - 错误追踪：Sentry
  - 链路追踪：Jaeger
- 安全系统：
  - 认证授权：JWT + OAuth2
  - 数据加密：AES-256
  - 访问控制：RBAC
  - 安全审计：日志记录

## 文档
- [开发文档](./docs/development) - 开发环境搭建、规范、流程等
- [API 文档](./docs/api) - 接口说明、请求/响应格式、错误码等
- [部署文档](./docs/deployment) - 环境要求、部署流程、配置说明等
- [架构文档](./docs/architecture) - 系统架构、技术栈、数据流等
- [用户指南](./docs/user-guide) - 功能说明、操作指南、常见问题等
- [性能监控文档](./docs/performance) - 监控指标、告警规则、优化建议等
- [错误处理文档](./docs/error-handling) - 错误类型、处理流程、最佳实践等
- [用户体验文档](./docs/user-experience) - 交互设计、响应时间、错误提示等

## 贡献指南

### 开发流程
1. Fork 项目
2. 创建功能分支
   ```bash
   git checkout -b feature/your-feature
   ```
3. 提交代码
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```
4. 推送到分支
   ```bash
   git push origin feature/your-feature
   ```
5. 创建 Pull Request

### 代码规范
- 使用 TypeScript 开发
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 添加必要的注释
- 编写单元测试

### 提交规范
```bash
# 提交格式
<type>(<scope>): <subject>

# 提交类型
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式
refactor: 代码重构
test: 测试相关
chore: 构建相关
```

## 版本记录

### v1.1.0 (2024-03-15)
- 新增移动端应用
- 优化性能监控
- 改进错误处理
- 更新依赖版本

### v1.0.0 (2024-01-01)
- 初始版本发布
- 基础功能完成
- 核心服务上线

## 许可证
MIT License

## 联系方式
- 项目负责人：张三
  - 邮箱：zhangsan@example.com
  - 电话：13800138000
- 技术负责人：李四
  - 邮箱：lisi@example.com
  - 电话：13900139000
- 运维负责人：王五
  - 邮箱：wangwu@example.com
  - 电话：13700137000
- 问题反馈：[GitHub Issues](https://github.com/your-org/education-system/issues)
- 紧急联系：support@example.com