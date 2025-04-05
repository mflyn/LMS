# 开发文档

## 概述

本文档提供小学生学习追踪系统的开发指南，包括开发环境搭建、代码规范、开发流程、测试指南和调试技巧等内容。本指南旨在帮助开发者快速上手项目，并保持代码质量和一致性。

## 目录

- [开发环境搭建](#开发环境搭建)
- [项目结构](#项目结构)
- [代码规范](#代码规范)
- [开发流程](#开发流程)
- [测试指南](#测试指南)
- [调试技巧](#调试技巧)
- [版本控制](#版本控制)
- [文档规范](#文档规范)

## 开发环境搭建

### 系统要求

- **操作系统**：Windows 10+、macOS 10.15+、Linux (Ubuntu 18.04+)
- **Node.js**：v14.x 或更高版本
- **MongoDB**：v4.4 或更高版本
- **Redis**：v6.x 或更高版本
- **Git**：v2.x 或更高版本

### 安装步骤

#### 1. 安装 Node.js

从 [Node.js 官网](https://nodejs.org/) 下载并安装适合您系统的版本。

验证安装：
```bash
node --version
npm --version
```

#### 2. 安装 MongoDB

从 [MongoDB 官网](https://www.mongodb.com/try/download/community) 下载并安装社区版。

验证安装：
```bash
mongo --version
```

#### 3. 安装 Redis

从 [Redis 官网](https://redis.io/download) 下载并安装。

验证安装：
```bash
redis-cli --version
```

#### 4. 克隆项目

```bash
git clone https://github.com/your-organization/student-tracking-system.git
cd student-tracking-system
```

#### 5. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

#### 6. 配置环境变量

```bash
# 后端环境变量
cp backend/.env.example backend/.env

# 前端环境变量
cp frontend/.env.example frontend/.env
```

编辑 `.env` 文件，配置必要的环境变量。

#### 7. 启动开发服务器

```bash
# 启动后端服务
cd backend
npm run dev

# 启动前端服务
cd ../frontend
npm start
```

## 项目结构

### 后端结构

```
backend/
├── app.js                # 应用入口
├── config/              # 配置文件
├── common/              # 公共模块
│   ├── middleware/      # 中间件
│   ├── models/         # 数据模型
│   ├── utils/          # 工具函数
│   └── seeds/          # 种子数据
├── services/           # 服务模块
│   ├── auth-service/   # 认证服务
│   ├── data-service/   # 数据服务
│   └── resource-service/ # 资源服务
└── tests/              # 测试文件
```

### 前端结构

```
frontend/
├── src/              # 源代码
│   ├── assets/      # 静态资源
│   ├── components/  # 组件
│   ├── pages/       # 页面
│   ├── services/    # 服务
│   ├── store/       # 状态管理
│   ├── utils/       # 工具函数
│   └── styles/      # 样式文件
├── public/          # 公共资源
├── tests/           # 测试文件
└── config/          # 配置文件
```

## 代码规范

### JavaScript/TypeScript 规范

我们使用 ESLint 和 Prettier 来保证代码质量和一致性。

#### ESLint 配置

项目根目录下的 `.eslintrc.js` 文件包含了 ESLint 配置。

运行 ESLint 检查：
```bash
npm run lint
```

自动修复 ESLint 问题：
```bash
npm run lint:fix
```

#### Prettier 配置

项目根目录下的 `.prettierrc` 文件包含了 Prettier 配置。

格式化代码：
```bash
npm run format
```

### 命名规范

- **文件名**：使用小写字母，多个单词用连字符（-）连接
  - 例如：`user-service.js`、`auth-middleware.js`

- **类名**：使用 PascalCase
  - 例如：`UserService`、`AuthMiddleware`

- **函数和变量**：使用 camelCase
  - 例如：`getUserById`、`authToken`

- **常量**：使用大写字母，多个单词用下划线（_）连接
  - 例如：`MAX_RETRY_COUNT`、`API_BASE_URL`

- **组件文件**：使用 PascalCase
  - 例如：`UserProfile.jsx`、`LoginForm.jsx`

### 注释规范

- 使用 JSDoc 风格的注释
- 为所有函数、类和复杂逻辑添加注释
- 注释应该解释"为什么"而不仅仅是"是什么"

示例：
```javascript
/**
 * 获取用户信息
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 用户信息对象
 */
async function getUserInfo(userId) {
  // 实现逻辑
}
```

## 开发流程

### 功能开发流程

1. **需求分析**：理解需求文档，明确功能目标和范围
2. **任务分解**：将功能分解为可管理的小任务
3. **分支创建**：从主分支创建功能分支
   ```bash
   git checkout -b feature/feature-name
   ```
4. **编码实现**：按照代码规范实现功能
5. **单元测试**：编写并运行单元测试
6. **代码审查**：提交Pull Request并接受代码审查
7. **合并代码**：审查通过后合并到主分支

### 版本发布流程

1. **版本规划**：确定版本包含的功能和修复
2. **创建发布分支**：从主分支创建发布分支
   ```bash
   git checkout -b release/v1.0.0
   ```
3. **版本测试**：进行集成测试和系统测试
4. **修复问题**：修复测试中发现的问题
5. **版本标记**：创建版本标签
   ```bash
   git tag -a v1.0.0 -m "Version 1.0.0"
   ```
6. **合并到主分支**：将发布分支合并回主分支
7. **部署发布**：部署到生产环境

## 测试指南

### 单元测试

我们使用 Jest 作为测试框架。

#### 编写测试

测试文件应放在与被测代码相同的目录下，并以 `.test.js` 或 `.spec.js` 结尾。

示例：
```javascript
// user-service.test.js
const UserService = require('./user-service');

describe('UserService', () => {
  test('should get user by id', async () => {
    // 测试实现
  });
});
```

#### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- path/to/test-file.test.js

# 生成测试覆盖率报告
npm run test:coverage
```

### 集成测试

集成测试验证不同模块之间的交互。

```bash
# 运行集成测试
npm run test:integration
```

### 端到端测试

我们使用 Cypress 进行端到端测试。

```bash
# 打开 Cypress 测试运行器
npm run cypress:open

# 运行所有端到端测试
npm run cypress:run
```

## 调试技巧

### 后端调试

#### 使用 Node.js 调试器

```bash
# 启动调试模式
node --inspect backend/app.js
```

然后在Chrome浏览器中访问 `chrome://inspect` 连接到调试器。

#### 使用 VS Code 调试

在 `.vscode/launch.json` 中配置调试设置：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/backend/app.js"
    }
  ]
}
```

### 前端调试

#### 使用浏览器开发工具

- Chrome DevTools：按 F12 或右键点击 -> 检查
- React DevTools：Chrome 扩展，用于调试 React 组件
- Redux DevTools：Chrome 扩展，用于调试 Redux 状态

#### 使用日志调试

```javascript
console.log('变量值:', variable);
console.table(arrayData);
console.time('操作') && console.timeEnd('操作');
```

## 版本控制

### Git 工作流

我们采用 Git Flow 工作流：

- **master**：生产环境代码
- **develop**：开发环境代码
- **feature/***：功能分支
- **release/***：发布分支
- **hotfix/***：热修复分支

### 提交规范

我们使用 Conventional Commits 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- **feat**：新功能
- **fix**：修复Bug
- **docs**：文档更新
- **style**：代码风格更改（不影响功能）
- **refactor**：代码重构
- **perf**：性能优化
- **test**：添加或修改测试
- **chore**：构建过程或辅助工具变动

示例：
```
feat(auth): 添加用户登录功能

实现了基于JWT的用户认证系统，包括登录、注销和令牌刷新功能。

Closes #123
```

## 文档规范

### 文档类型

- **README.md**：项目概述和快速入门
- **API文档**：API接口说明
- **开发文档**：开发指南和规范
- **部署文档**：部署和配置说明
- **用户指南**：用户使用说明

### Markdown 规范

- 使用标准 Markdown 语法
- 标题层级清晰，从 # 开始
- 代码块使用 ``` 包裹，并指定语言
- 使用列表、表格等元素提高可读性
- 添加适当的链接和图片

### API 文档规范

我们使用 Swagger/OpenAPI 规范记录 API 文档：

- 每个 API 端点都应有清晰的描述
- 包含请求参数、响应格式和错误码
- 提供示例请求和响应
- 定期更新文档以保持与代码同步