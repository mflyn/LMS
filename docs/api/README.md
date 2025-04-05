# API 文档

## 目录
- [认证接口](./auth.md)
- [用户管理接口](./user.md)
- [成绩管理接口](./score.md)
- [作业管理接口](./homework.md)
- [学习资源接口](./resource.md)
- [家校互动接口](./interaction.md)
- [数据分析接口](./analysis.md)

## 接口规范

### 请求格式
- 基础URL: `https://api.education-system.com/v1`
- 请求头:
  ```json
  {
    "Content-Type": "application/json",
    "Authorization": "Bearer {token}"
  }
  ```

### 响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

### 错误码
| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 分页参数
```json
{
  "page": 1,
  "pageSize": 10,
  "total": 100
}
```

### 时间格式
- 所有时间字段使用 ISO 8601 格式
- 示例: `2024-03-15T08:00:00Z`

### 数据格式
- 数字: 整数或浮点数
- 字符串: UTF-8 编码
- 布尔值: true/false
- 数组: JSON 数组
- 对象: JSON 对象

### 接口版本
- 当前版本: v1
- 版本控制: 通过 URL 路径控制
- 示例: `/v1/users`

### 接口安全
- 所有接口需要认证
- 使用 JWT 进行认证
- 敏感数据需要加密传输
- 接口访问频率限制

### 接口测试
- 使用 Postman 进行接口测试
- 测试环境: `https://test-api.education-system.com/v1`
- 测试账号: test@example.com
- 测试密码: test123456

### 接口文档更新
- 文档版本: 1.0.0
- 最后更新: 2024-03-15
- 更新记录:
  - 1.0.0: 初始版本
  - 1.0.1: 添加分页参数
  - 1.0.2: 更新错误码说明 