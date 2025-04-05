# 用户管理服务 (User Service)

用户管理服务是小学生学习追踪系统的核心微服务之一，负责用户认证、授权、权限管理和个人信息管理等功能。本服务为系统中的所有用户角色（学生、家长、教师和管理员）提供统一的身份验证和授权机制。

## 功能特性

### 用户认证与授权
- 用户注册和账号创建
- 用户登录和身份验证
- JWT令牌生成和验证
- 密码重置和恢复
- 第三方登录集成（可选）

### 权限管理
- 基于角色的访问控制（RBAC）
- 用户角色管理（学生、家长、教师、管理员）
- 权限分配和检查
- 资源访问控制

### 个人信息管理
- 用户个人资料维护
- 头像和个人设置
- 账号安全设置
- 用户关联管理（如家长-学生关系）

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（用户数据存储）
- JWT（认证机制）
- bcrypt（密码加密）
- Joi/Yup（数据验证）

### 目录结构
```
/user-service
  ├── config.js           # 服务配置
  ├── server.js           # 服务入口
  ├── package.json        # 依赖管理
  ├── models/             # 数据模型
  │   ├── User.js         # 用户模型
  │   └── Role.js         # 角色模型
  └── routes/             # API路由
      ├── index.js        # 路由入口
      ├── auth.js         # 认证相关路由
      └── user.js         # 用户管理路由
```

## API接口

### 认证接口

#### 用户注册
- **POST** `/api/auth/register`
- 请求体：
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "role": "string",
    "name": "string"
  }
  ```
- 响应：用户信息和JWT令牌

#### 用户登录
- **POST** `/api/auth/login`
- 请求体：
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- 响应：用户信息和JWT令牌

#### 密码重置
- **POST** `/api/auth/reset-password`
- 请求体：
  ```json
  {
    "email": "string"
  }
  ```
- 响应：重置链接发送状态

### 用户管理接口

#### 获取用户信息
- **GET** `/api/users/me`
- 请求头：`Authorization: Bearer {token}`
- 响应：当前用户信息

#### 更新用户信息
- **PUT** `/api/users/me`
- 请求头：`Authorization: Bearer {token}`
- 请求体：要更新的用户字段
- 响应：更新后的用户信息

#### 获取用户列表（管理员）
- **GET** `/api/users`
- 请求头：`Authorization: Bearer {token}`
- 响应：用户列表

## 数据模型

### 用户模型 (User)
```javascript
{
  username: String,       // 用户名
  email: String,          // 电子邮箱
  password: String,       // 加密密码
  name: String,           // 真实姓名
  role: ObjectId,         // 角色ID
  avatar: String,         // 头像URL
  meta: {                 // 元数据
    createdAt: Date,      // 创建时间
    updatedAt: Date,      // 更新时间
    lastLogin: Date       // 最后登录时间
  },
  status: String,         // 账号状态
  settings: Object        // 用户设置
}
```

### 角色模型 (Role)
```javascript
{
  name: String,           // 角色名称
  permissions: [String],  // 权限列表
  description: String     // 角色描述
}
```

## 开发指南

### 环境要求
- Node.js >= 14.x
- MongoDB >= 4.x

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
- `PORT` - 服务端口（默认：3001）
- `MONGODB_URI` - MongoDB连接URI
- `JWT_SECRET` - JWT密钥
- `JWT_EXPIRES_IN` - JWT过期时间
- `NODE_ENV` - 环境（development/production）

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- auth.test.js
```

## 安全考虑

- 所有密码使用bcrypt加密存储
- 敏感操作需要二次验证
- API访问使用JWT令牌认证
- 定期令牌轮换和过期策略
- 防止暴力破解的速率限制

## 常见问题

1. **JWT令牌过期**
   - 令牌默认24小时过期，需要重新登录获取新令牌
   - 可以实现刷新令牌机制延长会话

2. **权限不足**
   - 检查用户角色是否有对应操作权限
   - 联系管理员调整权限设置

3. **账号锁定**
   - 多次登录失败会临时锁定账号
   - 可通过密码重置流程解锁