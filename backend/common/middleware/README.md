# 中间件 (Middleware)

本目录包含系统使用的各种中间件，用于处理请求、响应、错误和安全性等功能。

## 目录结构

```
middleware/
├── auth.js                # 认证中间件
├── errorHandler.js        # 错误处理中间件
├── fileUploadSecurity.js  # 文件上传安全中间件
├── passwordPolicy.js      # 密码策略中间件
├── requestValidator.js    # 请求验证中间件
├── responseTime.js        # 响应时间监控中间件
└── sanitize.js           # 数据清理中间件
```

## 中间件说明

### 认证中间件 (auth.js)
- 验证用户身份
- 检查访问权限
- 处理会话管理

### 错误处理中间件 (errorHandler.js)
- 统一错误处理
- 友好的错误提示
- 错误分类和建议
- 开发/生产环境差异化处理

### 文件上传安全中间件 (fileUploadSecurity.js)
- 文件类型验证
- 文件大小限制
- 病毒扫描
- 安全存储

### 密码策略中间件 (passwordPolicy.js)
- 密码强度验证
- 密码历史检查
- 密码复杂度要求

### 请求验证中间件 (requestValidator.js)
- 请求参数验证
- 数据格式检查
- 必填字段验证

### 响应时间监控中间件 (responseTime.js)
- 请求响应时间监控
- 性能等级评估
- 进度提示功能
- 性能指标记录

### 数据清理中间件 (sanitize.js)
- XSS防护
- SQL注入防护
- 数据格式化

## 使用示例

### 错误处理
```javascript
// 抛出预定义错误
throw AppError.create('NOT_FOUND', '未找到该学生信息');

// 抛出自定义错误
throw new AppError('密码强度不足', 400, 'WEAK_PASSWORD');
```

### 响应时间监控
```javascript
// 在app.js中使用
app.use(responseTimeMiddleware);
app.use(progressMiddleware);
```

### 错误处理配置
```javascript
// 在app.js中使用
app.use(errorHandler);
```

## 性能监控

系统会自动监控以下性能指标：
- 响应时间
- 请求处理时间
- 错误率
- 并发请求数

性能等级说明：
- excellent: < 200ms
- good: 200-500ms
- fair: 500-1000ms
- poor: > 1000ms

## 错误处理

系统支持以下错误类型：
- VALIDATION_ERROR: 数据验证失败
- NOT_FOUND: 资源未找到
- UNAUTHORIZED: 未授权访问
- FORBIDDEN: 禁止访问
- DUPLICATE_DATA: 数据重复
- INVALID_TOKEN: 无效令牌
- TOKEN_EXPIRED: 令牌过期

每个错误都会提供：
- 错误代码
- 错误消息
- 解决建议

## 开发指南

1. 添加新中间件时：
   - 确保错误处理兼容
   - 添加性能监控
   - 提供友好的错误提示
   - 考虑开发/生产环境差异

2. 中间件开发规范：
   - 清晰的错误消息
   - 合理的性能监控
   - 完善的日志记录
   - 安全的错误处理

3. 测试要求：
   - 单元测试覆盖
   - 性能测试
   - 错误处理测试
   - 边界条件测试

## 注意事项

1. 错误处理：
   - 生产环境不暴露敏感信息
   - 提供清晰的错误提示
   - 记录详细的错误日志

2. 性能监控：
   - 定期检查性能指标
   - 及时处理性能问题
   - 优化慢请求

3. 安全考虑：
   - 防止信息泄露
   - 验证所有输入
   - 限制请求频率

4. 用户体验：
   - 提供进度提示
   - 显示友好的错误信息
   - 优化响应时间 