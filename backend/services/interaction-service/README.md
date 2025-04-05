# 家校互动服务 (Interaction Service)

家校互动服务是小学生学习追踪系统的核心微服务之一，负责提供教师、家长和学生之间的沟通和互动功能。本服务支持即时消息、公告发布、家长会安排以及视频会议等功能，促进家校协同育人。

## 功能特性

### 即时消息
- 教师-家长私信沟通
- 群组消息（班级通知）
- 消息历史记录和搜索
- 消息已读状态跟踪
- 文件和图片分享

### 公告管理
- 学校和班级公告发布
- 重要通知置顶
- 公告阅读状态跟踪
- 公告评论和反馈
- 定时发布和过期设置

### 家长会
- 线上家长会预约和安排
- 家长会议题设置
- 家长参与确认
- 会议纪要和跟进事项
- 个别家长会安排

### 视频会议
- 一对一视频通话
- 小组视频会议
- 屏幕共享和演示
- 会议录制和回放
- 在线白板协作

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（消息和公告存储）
- Socket.IO（实时通信）
- WebRTC（视频会议）
- Redis（在线状态和会话管理）

### 目录结构
```
/interaction-service
  ├── config.js           # 服务配置
  ├── server.js           # 服务入口
  ├── models/             # 数据模型
  │   ├── Message.js      # 消息模型
  │   ├── Announcement.js # 公告模型
  │   └── Meeting.js      # 会议模型
  └── routes/             # API路由
      ├── messages.js     # 消息相关路由
      ├── announcements.js # 公告相关路由
      ├── meetings.js     # 家长会相关路由
      └── video-meetings.js # 视频会议相关路由
```

## API接口

### 消息接口

#### 发送消息
- **POST** `/api/messages`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "receiverId": "string",
    "content": "string",
    "attachments": ["string"],
    "type": "string" // private, group
  }
  ```
- 响应：发送的消息对象

#### 获取对话历史
- **GET** `/api/messages/conversation/{userId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `limit`: 消息数量限制（默认：50）
  - `before`: 时间戳，获取此时间之前的消息
- 响应：消息列表

### 公告接口

#### 发布公告
- **POST** `/api/announcements`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "title": "string",
    "content": "string",
    "targetGroups": ["string"], // classIds, all
    "importance": "number", // 1-5
    "attachments": ["string"],
    "expiryDate": "date"
  }
  ```
- 响应：创建的公告对象

#### 获取公告列表
- **GET** `/api/announcements`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `target`: 目标群组ID（可选）
  - `importance`: 重要性级别（可选）
  - `active`: 是否仅显示有效公告（默认：true）
- 响应：公告列表

### 家长会接口

#### 安排家长会
- **POST** `/api/meetings`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "title": "string",
    "description": "string",
    "type": "string", // class, individual
    "classId": "string", // 如果是班级家长会
    "participants": ["string"], // 如果是个别家长会
    "startTime": "datetime",
    "endTime": "datetime",
    "location": "string", // 线下地点或线上链接
    "agenda": ["string"],
    "isOnline": "boolean"
  }
  ```
- 响应：创建的家长会对象

#### 获取家长会列表
- **GET** `/api/meetings`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `role`: 角色（teacher/parent）
  - `status`: 状态（upcoming/past/all，默认：upcoming）
  - `classId`: 班级ID（可选）
- 响应：家长会列表

### 视频会议接口

#### 创建视频会议
- **POST** `/api/video-meetings`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "title": "string",
    "participants": ["string"],
    "scheduledTime": "datetime", // 可选，即时会议可不填
    "duration": "number", // 预计时长（分钟）
    "description": "string",
    "features": ["string"] // recording, whiteboard, screen-share
  }
  ```
- 响应：会议信息和加入链接

#### 加入视频会议
- **GET** `/api/video-meetings/{meetingId}/join`
- 请求头：`Authorization: Bearer {token}`
- 响应：会议连接信息和令牌

## 数据模型

### 消息模型 (Message)
```javascript
{
  senderId: ObjectId,      // 发送者ID
  receiverId: ObjectId,    // 接收者ID（用户或群组）
  content: String,         // 消息内容
  attachments: [String],   // 附件URL
  type: String,            // 消息类型（private/group）
  status: String,          // 状态（sent/delivered/read）
  readBy: [{
    userId: ObjectId,      // 已读用户ID
    timestamp: Date        // 已读时间
  }],
  timestamp: Date,         // 发送时间
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

### 公告模型 (Announcement)
```javascript
{
  title: String,           // 公告标题
  content: String,         // 公告内容
  authorId: ObjectId,      // 发布者ID
  targetGroups: [String],  // 目标群组ID
  importance: Number,      // 重要性（1-5）
  attachments: [String],   // 附件URL
  publishDate: Date,       // 发布日期
  expiryDate: Date,        // 过期日期
  isActive: Boolean,       // 是否有效
  readBy: [{
    userId: ObjectId,      // 已读用户ID
    timestamp: Date        // 已读时间
  }],
  comments: [{
    userId: ObjectId,      // 评论用户ID
    content: String,       // 评论内容
    timestamp: Date        // 评论时间
  }],
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

### 会议模型 (Meeting)
```javascript
{
  title: String,           // 会议标题
  description: String,     // 会议描述
  type: String,            // 会议类型（class/individual）
  organizerId: ObjectId,   // 组织者ID
  classId: ObjectId,       // 班级ID（班级家长会）
  participants: [ObjectId], // 参与者ID列表
  startTime: Date,         // 开始时间
  endTime: Date,           // 结束时间
  location: String,        // 地点或链接
  agenda: [String],        // 议程
  isOnline: Boolean,       // 是否线上会议
  status: String,          // 状态（scheduled/ongoing/completed/cancelled）
  attendees: [{
    userId: ObjectId,      // 出席者ID
    status: String,        // 状态（confirmed/declined/pending）
    joinTime: Date,        // 加入时间
    leaveTime: Date        // 离开时间
  }],
  minutes: String,         // 会议纪要
  followUps: [{
    task: String,          // 跟进事项
    assignedTo: ObjectId,  // 负责人ID
    dueDate: Date,         // 截止日期
    status: String         // 状态
  }],
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
- 支持WebRTC的环境（视频会议功能）

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
- `PORT` - 服务端口（默认：3004）
- `MONGODB_URI` - MongoDB连接URI
- `REDIS_URL` - Redis连接URL
- `SOCKET_PORT` - Socket.IO端口（默认：3104）
- `JWT_SECRET` - JWT密钥
- `WEBRTC_CONFIG` - WebRTC配置
- `STORAGE_URL` - 文件存储服务URL
- `NODE_ENV` - 环境（development/production）

## WebSocket事件

### 客户端事件
- `connect` - 连接到服务器
- `disconnect` - 断开连接
- `join-room` - 加入聊天室或会议
- `leave-room` - 离开聊天室或会议
- `send-message` - 发送消息
- `typing` - 正在输入
- `read-message` - 标记消息为已读

### 服务器事件
- `message` - 接收新消息
- `announcement` - 接收新公告
- `meeting-invitation` - 接收会议邀请
- `user-status` - 用户状态变更
- `typing-notification` - 用户正在输入
- `message-status` - 消息状态更新

## 视频会议功能

### 支持的功能
- 多人视频通话
- 屏幕共享
- 文字聊天
- 在线白板
- 会议录制
- 背景模糊/替换

### 技术实现
- WebRTC用于点对点连接
- TURN/STUN服务器用于NAT穿透
- Socket.IO用于信令
- MediaRecorder API用于录制

## 安全考虑

- 所有通信使用TLS/SSL加密
- 消息内容在传输和存储时加密
- 会议访问需要验证和授权
- 敏感操作需要二次验证
- 防止XSS和注入攻击

## 性能优化

- 消息分页和懒加载
- WebSocket连接池管理
- 消息队列处理大量并发
- Redis缓存热点数据
- 媒体文件优化和压缩

## 常见问题

1. **消息发送失败**
   - 检查网络连接
   - 确认接收者存在且有权限
   - 查看服务日志获取详细错误

2. **视频会议连接问题**
   - 检查浏览器WebRTC支持
   - 确认摄像头和麦克风权限
   - 检查防火墙设置
   - 尝试使用不同的网络环境

3. **通知未送达**
   - 检查用户通知设置
   - 确认推送服务工作正常
   - 验证设备注册状态