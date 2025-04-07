# API 文档

## 基础信息

### 基础URL
```
https://api.example.com/v1
```

### 认证方式
- Bearer Token 认证
- 在请求头中添加：`Authorization: Bearer <token>`

### 响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

## 用户认证

### 用户注册
```http
POST /auth/register
```

请求体：
```json
{
  "username": "string",
  "password": "string",
  "email": "string",
  "role": "string"
}
```

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "string",
    "username": "string",
    "email": "string",
    "role": "string"
  }
}
```

### 用户登录
```http
POST /auth/login
```

请求体：
```json
{
  "username": "string",
  "password": "string"
}
```

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "string",
    "user": {
      "id": "string",
      "username": "string",
      "role": "string"
    }
  }
}
```

## 学生管理

### 获取学生列表
```http
GET /students
```

查询参数：
- page: 页码
- limit: 每页数量
- search: 搜索关键词
- class: 班级筛选

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "string",
        "name": "string",
        "class": "string",
        "grade": "string"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

### 获取学生详情
```http
GET /students/{id}
```

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "string",
    "name": "string",
    "class": "string",
    "grade": "string",
    "scores": [
      {
        "subject": "string",
        "score": "number",
        "date": "string"
      }
    ]
  }
}
```

## 成绩管理

### 添加成绩
```http
POST /scores
```

请求体：
```json
{
  "studentId": "string",
  "subject": "string",
  "score": "number",
  "date": "string",
  "type": "string"
}
```

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "string",
    "studentId": "string",
    "subject": "string",
    "score": "number",
    "date": "string"
  }
}
```

### 获取成绩统计
```http
GET /scores/statistics
```

查询参数：
- class: 班级
- subject: 科目
- startDate: 开始日期
- endDate: 结束日期

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "average": "number",
    "highest": "number",
    "lowest": "number",
    "distribution": [
      {
        "range": "string",
        "count": "number"
      }
    ]
  }
}
```

## 作业管理

### 发布作业
```http
POST /homework
```

请求体：
```json
{
  "title": "string",
  "content": "string",
  "class": "string",
  "subject": "string",
  "dueDate": "string",
  "attachments": ["string"]
}
```

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "string",
    "title": "string",
    "dueDate": "string"
  }
}
```

### 提交作业
```http
POST /homework/{id}/submit
```

请求体：
```json
{
  "content": "string",
  "attachments": ["string"]
}
```

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "string",
    "status": "string"
  }
}
```

## 资源管理

### 上传资源
```http
POST /resources/upload
```

请求体：
- file: 文件
- type: 资源类型
- tags: 标签数组

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "string",
    "url": "string",
    "type": "string"
  }
}
```

### 获取资源列表
```http
GET /resources
```

查询参数：
- type: 资源类型
- tags: 标签
- page: 页码
- limit: 每页数量

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "string",
        "title": "string",
        "type": "string",
        "url": "string"
      }
    ],
    "total": 100
  }
}
```

## 错误码说明

### 通用错误码
- 400: 请求参数错误
- 401: 未授权
- 403: 禁止访问
- 404: 资源不存在
- 500: 服务器错误

### 业务错误码
- 1001: 用户名已存在
- 1002: 密码错误
- 1003: 验证码错误
- 1004: 资源不存在
- 1005: 权限不足

## 接口限流

### 限制规则
- 普通接口：100次/分钟
- 认证接口：20次/分钟
- 上传接口：10次/分钟

### 响应头
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1609459200
```

## 数据格式

### 日期格式
- ISO 8601: `YYYY-MM-DDTHH:mm:ss.sssZ`

### 文件格式
- 图片: jpg, png, gif
- 文档: pdf, doc, docx
- 视频: mp4, webm
- 音频: mp3, wav

## 版本控制

### 版本号
- 主版本号.次版本号.修订号
- 示例: v1.2.3

### 兼容性
- 主版本号变更：不兼容的API修改
- 次版本号变更：向下兼容的功能性新增
- 修订号变更：向下兼容的问题修正