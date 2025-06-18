# 环境变量配置示例

## 基础配置

将以下内容复制到项目根目录的 `.env` 文件中：

```bash
# 环境配置
NODE_ENV=development

# JWT配置 - 生产环境必须使用强密钥（至少32字符）
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_TOKEN_EXPIRATION=1d
JWT_REFRESH_TOKEN_EXPIRATION=7d

# 数据库配置
MONGO_URI=mongodb://localhost:27017/student_tracking
USER_SERVICE_MONGO_URI=mongodb://localhost:27017/user_service
DATA_SERVICE_MONGO_URI=mongodb://localhost:27017/data_service

# 服务端口配置
GATEWAY_PORT=5000
USER_SERVICE_PORT=3001
DATA_SERVICE_PORT=3003
ANALYTICS_SERVICE_PORT=3007
HOMEWORK_SERVICE_PORT=3008
PROGRESS_SERVICE_PORT=3009
INTERACTION_SERVICE_PORT=3010
NOTIFICATION_SERVICE_PORT=3011
RESOURCE_SERVICE_PORT=3012

# 服务URL配置（可选，默认使用localhost和对应端口）
# USER_SERVICE_URL=http://localhost:3001
# DATA_SERVICE_URL=http://localhost:3003
# ANALYTICS_SERVICE_URL=http://localhost:3007
# HOMEWORK_SERVICE_URL=http://localhost:3008
# PROGRESS_SERVICE_URL=http://localhost:3009
# INTERACTION_SERVICE_URL=http://localhost:3010
# NOTIFICATION_SERVICE_URL=http://localhost:3011
# RESOURCE_SERVICE_URL=http://localhost:3012

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your-redis-password

# 邮件配置（可选）
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-email-password

# 文件上传配置
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf

# 安全配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=*

# 监控配置
ENABLE_METRICS=false
METRICS_PORT=9090

# 外部服务配置
EXTERNAL_API_TIMEOUT=30000
EXTERNAL_API_RETRY_ATTEMPTS=3
```

## 生产环境配置注意事项

### 1. 安全配置
- `JWT_SECRET`: 必须使用至少32字符的强密钥
- `CORS_ORIGIN`: 设置为具体的域名，不要使用 `*`
- `NODE_ENV`: 设置为 `production`

### 2. 数据库配置
- 使用生产环境的MongoDB连接字符串
- 确保数据库连接包含认证信息
- 使用不同的数据库名称区分环境

### 3. 日志配置
- `LOG_LEVEL`: 生产环境建议设置为 `warn` 或 `error`
- `LOG_FILE_PATH`: 确保日志目录有写入权限

### 4. 限流配置
- 根据实际需求调整 `RATE_LIMIT_MAX_REQUESTS`
- 考虑不同端点的不同限流策略

## 开发环境快速设置

1. 复制示例配置到 `.env` 文件
2. 启动本地MongoDB服务
3. 修改 `JWT_SECRET` 为自定义密钥
4. 根据需要调整端口配置

## 测试环境配置

测试环境建议使用内存数据库或独立的测试数据库：

```bash
NODE_ENV=test
MONGO_URI=mongodb://localhost:27017/student_tracking_test
LOG_LEVEL=error
```

## 配置验证

使用以下命令验证配置：

```bash
# 验证所有配置
node backend/common/config/cli.js validate

# 验证特定服务配置
node backend/common/config/cli.js validate --service auth

# 显示当前配置
node backend/common/config/cli.js show
``` 