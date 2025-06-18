# 统一配置管理系统

本目录包含小学生学习追踪系统的统一配置管理解决方案，提供集中化、类型安全、环境感知的配置管理功能。

## 📁 文件结构

```
config/
├── index.js          # 主配置管理器
├── validator.js      # 配置验证工具
├── migrator.js       # 配置迁移工具
├── cli.js           # 命令行工具
├── auth.js          # 认证配置（向后兼容）
├── db.js            # 数据库配置（向后兼容）
├── logger.js        # 日志配置（向后兼容）
└── README.md        # 本文档
```

## 🚀 快速开始

### 1. 基本使用

```javascript
const { configManager } = require('./common/config');

// 获取单个配置项
const jwtSecret = configManager.get('JWT_SECRET');
const dbUri = configManager.get('MONGO_URI');

// 获取服务特定配置
const userServiceConfig = configManager.getServiceConfig('user');
const gatewayConfig = configManager.getServiceConfig('gateway');

// 获取所有配置
const allConfig = configManager.getAll();
```

### 2. 环境变量配置

在项目根目录的 `.env` 文件中配置环境变量：

```bash
# 基础配置
NODE_ENV=development
JWT_SECRET=your-secret-key
MONGO_URI=mongodb://localhost:27017/student_tracking

# 服务端口
GATEWAY_PORT=3000
USER_SERVICE_PORT=3001
DATA_SERVICE_PORT=3002
```

### 3. 服务集成

在各个服务中使用统一配置：

```javascript
// gateway/config.js
const { configManager } = require('../common/config');

module.exports = configManager.getServiceConfig('gateway');
```

```javascript
// services/user-service/config.js
const { configManager } = require('../../common/config');

module.exports = configManager.getServiceConfig('user');
```

## 🛠️ 命令行工具

### 安装依赖

```bash
cd backend
npm install joi commander chokidar
```

### 可用命令

#### 验证配置
```bash
# 验证所有配置
node common/config/cli.js validate

# 验证特定服务配置
node common/config/cli.js validate --service gateway

# 验证特定环境配置
node common/config/cli.js validate --env production

# 生成配置报告
node common/config/cli.js validate --report
```

#### 查看配置
```bash
# 显示所有配置
node common/config/cli.js show

# 显示特定配置项
node common/config/cli.js show --key JWT_SECRET

# 显示服务配置
node common/config/cli.js show --service user

# 显示敏感信息（谨慎使用）
node common/config/cli.js show --secrets
```

#### 健康检查
```bash
# 检查配置健康状态
node common/config/cli.js health

# 检查特定服务
node common/config/cli.js health --service gateway
```

#### 生成配置模板
```bash
# 生成开发环境模板
node common/config/cli.js template --env development

# 生成生产环境模板并保存到文件
node common/config/cli.js template --env production --output .env.production
```

#### 监控配置变化
```bash
# 监控 .env 文件变化
node common/config/cli.js watch

# 监控特定配置文件
node common/config/cli.js watch --file .env.local
```

#### 配置迁移
```bash
# 预览迁移结果
node common/config/cli.js migrate --dry-run

# 执行配置迁移
node common/config/cli.js migrate
```

### NPM 脚本

在各服务的 `package.json` 中已添加便捷脚本：

```bash
# Gateway 服务
cd gateway
npm run config:validate
npm run config:show
npm run config:health

# User 服务
cd services/user-service
npm run config:validate
npm run config:show
npm run config:health

# Data 服务
cd services/data-service
npm run config:validate
npm run config:show
npm run config:health
```

## 📋 配置项说明

### 基础配置
- `NODE_ENV`: 运行环境 (development/test/production)
- `LOG_LEVEL`: 日志级别 (debug/info/warn/error)

### 安全配置
- `JWT_SECRET`: JWT 签名密钥（生产环境必须设置强密钥）
- `JWT_EXPIRATION`: JWT 过期时间
- `JWT_REFRESH_EXPIRATION`: 刷新令牌过期时间

### 数据库配置
- `MONGO_URI`: 主数据库连接字符串
- `USER_SERVICE_MONGO_URI`: 用户服务专用数据库（可选）
- `DATA_SERVICE_MONGO_URI`: 数据服务专用数据库（可选）

### 服务配置
- `GATEWAY_PORT`: API 网关端口
- `USER_SERVICE_PORT`: 用户服务端口
- `DATA_SERVICE_PORT`: 数据服务端口
- `*_SERVICE_URL`: 各服务的完整 URL

### 缓存配置
- `REDIS_HOST`: Redis 主机地址
- `REDIS_PORT`: Redis 端口
- `REDIS_PASSWORD`: Redis 密码（可选）

### 安全策略
- `CORS_ORIGIN`: 允许的跨域来源
- `RATE_LIMIT_MAX_REQUESTS`: 限流最大请求数
- `PASSWORD_MIN_LENGTH`: 密码最小长度
- `ACCOUNT_LOCKOUT_ATTEMPTS`: 账户锁定尝试次数

## 🔧 高级功能

### 1. 配置验证

系统提供多层配置验证：

- **环境特定验证**: 不同环境有不同的验证规则
- **服务特定验证**: 每个服务有专门的配置要求
- **安全验证**: 检查密钥强度、生产环境安全配置等

### 2. 热重载

开发环境支持配置文件热重载：

```javascript
// 配置文件变化时自动重新加载
configManager.on('configChanged', (changes) => {
  console.log('配置已更新:', changes);
});
```

### 3. 环境感知

配置管理器会根据 `NODE_ENV` 自动调整行为：

- **development**: 宽松验证，支持热重载
- **test**: 严格验证，禁用某些功能
- **production**: 最严格验证，强制安全配置

### 4. 服务发现

自动生成服务 URL 配置：

```javascript
// 自动根据主机和端口生成服务 URL
const serviceUrls = configManager.get('SERVICE_URLS');
// {
//   user: 'http://localhost:3001',
//   data: 'http://localhost:3002',
//   ...
// }
```

## 🔒 安全最佳实践

### 1. 密钥管理
- 生产环境必须使用强 JWT 密钥（至少 32 字符）
- 不要在代码中硬编码密钥
- 定期轮换密钥

### 2. 环境隔离
- 不同环境使用不同的配置文件
- 生产环境配置不应包含开发/测试数据

### 3. 访问控制
- 限制对敏感配置的访问
- 使用环境变量而非配置文件存储密钥

## 🚨 故障排除

### 常见问题

1. **配置验证失败**
   ```bash
   # 检查配置健康状态
   node common/config/cli.js health
   
   # 查看详细验证信息
   node common/config/cli.js validate --service gateway
   ```

2. **服务无法启动**
   ```bash
   # 检查必需的配置项
   node common/config/cli.js show --env
   
   # 验证数据库连接
   node common/config/cli.js validate
   ```

3. **配置热重载不工作**
   - 确保在开发环境 (`NODE_ENV=development`)
   - 检查文件权限
   - 查看控制台错误信息

### 调试模式

启用详细日志：

```bash
DEBUG_MODE=true VERBOSE_LOGGING=true node your-service.js
```

## 📚 迁移指南

### 从旧配置系统迁移

1. **备份现有配置**
   ```bash
   node common/config/cli.js migrate --dry-run
   ```

2. **执行迁移**
   ```bash
   node common/config/cli.js migrate
   ```

3. **验证迁移结果**
   ```bash
   node common/config/cli.js validate
   ```

### 更新服务代码

将旧的配置引用替换为新的统一配置：

```javascript
// 旧方式
const config = {
  port: process.env.USER_SERVICE_PORT || 3001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/db'
};

// 新方式
const { configManager } = require('../../common/config');
const config = configManager.getServiceConfig('user');
```

## 🤝 贡献指南

1. 添加新配置项时，请更新验证规则
2. 为新功能添加相应的 CLI 命令
3. 更新文档和示例
4. 确保向后兼容性

## 📄 许可证

本配置管理系统是小学生学习追踪系统的一部分，遵循项目的整体许可证。