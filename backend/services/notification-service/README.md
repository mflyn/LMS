# 消息通知服务 (Notification Service)

消息通知服务是小学生学习追踪系统的核心微服务之一，负责管理和发送各类通知，确保系统中的重要信息能够及时传达给相关用户。本服务支持多种通知渠道和类型，提供可靠的消息推送机制。

## 功能特性

### 通知管理
- 通知创建和发送
- 通知状态跟踪
- 通知历史记录
- 通知模板管理
- 批量通知处理

### 通知类型
- 系统通知（更新、维护等）
- 学习提醒（作业、考试等）
- 进度提醒（学习目标、进度落后等）
- 互动通知（消息、评论等）
- 活动通知（家长会、学校活动等）

### 推送渠道
- 应用内通知
- 电子邮件
- 短信
- 移动推送（iOS/Android）
- 微信/钉钉等第三方平台（可选）

### 个性化设置
- 用户通知偏好设置
- 免打扰时段设置
- 通知重要性分级
- 通知频率控制
- 通知分组和过滤

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（通知存储）
- Redis（队列和缓存）
- RabbitMQ（消息队列）
- 邮件/短信/推送SDK

### 目录结构
```
/notification-service
  ├── server.js           # 服务入口
  ├── models/             # 数据模型
  │   └── Notification.js # 通知模型
  └── routes/             # API路由
      ├── index.js        # 路由入口
      └── notifications.js # 通知相关路由
```

## API接口

### 通知接口

#### 创建通知
- **POST** `/api/notifications`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "recipients": ["string"], // 用户ID数组
    "type": "string", // system, learning, progress, interaction, activity
    "title": "string",
    "content": "string",
    "data": {}, // 附加数据
    "priority": "number", // 1-5
    "channels": ["string"], // app, email, sms, push
    "scheduledAt": "datetime" // 可选，定时发送
  }
  ```
- 响应：创建的通知对象

#### 获取用户通知
- **GET** `/api/notifications`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `status`: 状态（read/unread/all，默认：all）
  - `type`: 通知类型（可选）
  - `limit`: 数量限制（默认：50）
  - `before`: 时间戳，获取此时间之前的通知
- 响应：通知列表

#### 标记通知为已读
- **PUT** `/api/notifications/{notificationId}/read`
- 请求头：`Authorization: Bearer {token}`
- 响应：更新后的通知对象

#### 标记所有通知为已读
- **PUT** `/api/notifications/read-all`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `type`: 通知类型（可选，仅标记特定类型）
- 响应：操作结果

#### 更新通知偏好设置
- **PUT** `/api/notifications/preferences`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "channels": {
      "app": "boolean",
      "email": "boolean",
      "sms": "boolean",
      "push": "boolean"
    },
    "types": {
      "system": "boolean",
      "learning": "boolean",
      "progress": "boolean",
      "interaction": "boolean",
      "activity": "boolean"
    },
    "quietHours": {
      "enabled": "boolean",
      "start": "string", // HH:MM format
      "end": "string", // HH:MM format
      "timezone": "string" // e.g., Asia/Shanghai
    }
  }
  ```
- 响应：更新后的偏好设置

## 数据模型

### 通知模型 (Notification)
```javascript
{
  recipients: [ObjectId],  // 接收者ID数组
  type: String,            // 通知类型
  title: String,           // 通知标题
  content: String,         // 通知内容
  data: Object,            // 附加数据
  priority: Number,        // 优先级（1-5）
  channels: [String],      // 发送渠道
  status: String,          // 状态（pending/sent/failed）
  scheduledAt: Date,       // 计划发送时间
  sentAt: Date,            // 实际发送时间
  readBy: [{               // 已读记录
    userId: ObjectId,      // 用户ID
    timestamp: Date        // 已读时间
  }],
  deliveryStatus: [{       // 发送状态
    channel: String,       // 渠道
    status: String,        // 状态
    sentAt: Date,          // 发送时间
    error: String          // 错误信息
  }],
  expiresAt: Date,         // 过期时间
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

### 用户通知偏好模型
```javascript
{
  userId: ObjectId,        // 用户ID
  channels: {              // 渠道偏好
    app: Boolean,          // 应用内通知
    email: Boolean,        // 电子邮件
    sms: Boolean,          // 短信
    push: Boolean          // 移动推送
  },
  types: {                 // 类型偏好
    system: Boolean,       // 系统通知
    learning: Boolean,     // 学习提醒
    progress: Boolean,     // 进度提醒
    interaction: Boolean,  // 互动通知
    activity: Boolean      // 活动通知
  },
  quietHours: {            // 免打扰时段
    enabled: Boolean,      // 是否启用
    start: String,         // 开始时间（HH:MM）
    end: String,           // 结束时间（HH:MM）
    timezone: String       // 时区
  },
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

## 开发指南

### 环境要求
- Node.js >= 14.x
- MongoDB >= 4.x
- Redis >= 6.x
- RabbitMQ >= 3.x

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 环境变量
- `PORT` - 服务端口（默认：3005）
- `MONGODB_URI` - MongoDB连接URI
- `REDIS_URL` - Redis连接URL
- `RABBITMQ_URL` - RabbitMQ连接URL
- `EMAIL_CONFIG` - 邮件服务配置
- `SMS_CONFIG` - 短信服务配置
- `PUSH_CONFIG` - 推送服务配置
- `NODE_ENV` - 环境（development/production）

## 通知流程

1. **通知创建**
   - 系统服务调用API创建通知
   - 或通过消息队列接收通知请求

2. **通知处理**
   - 验证通知数据
   - 检查接收者通知偏好
   - 应用免打扰规则
   - 准备通知内容（应用模板）

3. **通知分发**
   - 根据渠道分发到不同队列
   - 处理定时发送逻辑
   - 执行发送操作

4. **状态跟踪**
   - 记录发送状态
   - 处理失败重试
   - 更新通知状态

## 通知模板

系统提供预定义的通知模板，支持变量替换：

```
# 作业提醒模板
标题: 【作业提醒】{subject}作业即将截止
内容: 亲爱的{studentName}，你的{subject}作业