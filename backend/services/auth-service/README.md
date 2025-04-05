# 认证服务 (Auth Service)

认证服务是小学生学习追踪系统的核心微服务之一，负责用户认证、授权和身份验证管理。本服务为系统中的所有用户角色（学生、家长、教师和管理员）提供统一的身份验证机制，确保系统安全性和用户数据保护。

## 功能特性

### 用户认证
- 用户注册
- 用户登录
- 用户登出
- 密码修改
- 令牌验证和刷新

### 安全机制
- 密码策略强制执行
- 请求验证和参数检查
- 防暴力破解保护
- 会话管理

## 技术架构

### 技术栈
- Node.js + Express.js
- JWT (JSON Web Tokens)
- 密码加密库 (bcrypt)
- 请求验证中间件

### 目录结构
```
/auth-service
  ├── routes/            # API路由
  │   └── auth.js        # 认证相关路由
  └── __tests__/         # 测试文件
      └── auth.test.js   # 认证测试
```

## API接口

### 用户注册
- **POST** `/api/auth/register`
- 请求体：
  ```json
  {
    "username": "string",
    "password": "string",
    "email": "string",
    "role": "string"
  }
  ```
- 响应：注册成功信息和用户数据

### 用户登录
- **POST** `/api/auth/login`
- 请求体：
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- 响应：认证令牌和用户信息

### 用户登出
- **POST** `/api/auth/logout`
- 请求头：`Authorization: Bearer {token}`
- 响应：登出成功确认

### 修改密码
- **PUT** `/api/auth/password`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string"
  }
  ```
- 响应：密码修改成功确认

## 使用示例

### 用户注册示例

```javascript
async function registerUser(userData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error(`注册失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('用户注册出错:', error);
    throw error;
  }
}
```

### 用户登录示例

```javascript
async function loginUser(credentials) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
      throw new Error(`登录失败: ${response.status}`);
    }
    
    const data = await response.json();
    // 存储令牌以供后续请求使用
    localStorage.setItem('authToken', data.token);
    return data;
  } catch (error) {
    console.error('用户登录出错:', error);
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
| INVALID_CREDENTIALS | 401 | 用户名或密码错误 |
| USER_EXISTS | 409 | 用户已存在 |
| INVALID_TOKEN | 401 | 无效的认证令牌 |
| TOKEN_EXPIRED | 401 | 认证令牌已过期 |
| PASSWORD_POLICY | 400 | 密码不符合安全策略 |

## 安全考虑

1. **密码策略**：密码必须至少8个字符，包含大小写字母、数字和特殊字符
2. **令牌管理**：JWT令牌设置合理的过期时间，支持令牌刷新机制
3. **请求验证**：所有请求参数经过严格验证，防止注入攻击
4. **敏感数据保护**：密码使用bcrypt加密存储，不以明文形式传输或存储

## 部署说明

### 环境变量

服务需要以下环境变量：

| 变量名 | 描述 | 默认值 |
|-------|------|-------|
| PORT | 服务端口 | 3001 |
| JWT_SECRET | JWT密钥 | (无默认值，必须设置) |
| JWT_EXPIRES_IN | JWT过期时间 | 1d |
| NODE_ENV | 运行环境 | development |

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

## 版本历史

### v1.1.0 (2023-04-15)
- 添加密码策略强制执行
- 改进错误处理机制
- 增加请求参数验证

### v1.0.0 (2023-02-01)
- 初始版本发布
- 基本认证功能（注册、登录、登出）
- JWT令牌实现