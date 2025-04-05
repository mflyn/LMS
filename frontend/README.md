# 前端项目

## 目录说明
本目录包含前端项目的所有代码和资源文件，采用 React + TypeScript 技术栈，使用 Ant Design 组件库。

## 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0
- Git >= 2.0.0
- 内存 >= 8GB
- 磁盘空间 >= 10GB

## 目录结构
```
frontend/
├── src/              # 源代码
│   ├── assets/      # 静态资源
│   │   ├── images/  # 图片资源
│   │   ├── icons/   # 图标资源
│   │   └── fonts/   # 字体资源
│   ├── components/  # 组件
│   │   ├── common/  # 通用组件
│   │   ├── layout/  # 布局组件
│   │   └── business/ # 业务组件
│   ├── pages/       # 页面
│   │   ├── home/    # 首页
│   │   ├── login/   # 登录页
│   │   └── user/    # 用户页
│   ├── services/    # 服务
│   │   ├── api/     # API 接口
│   │   ├── auth/    # 认证服务
│   │   └── storage/ # 存储服务
│   ├── store/       # 状态管理
│   │   ├── modules/ # 状态模块
│   │   └── index.ts # 状态入口
│   ├── utils/       # 工具函数
│   │   ├── request/ # 请求工具
│   │   ├── auth/    # 认证工具
│   │   └── common/  # 通用工具
│   ├── styles/      # 样式文件
│   │   ├── variables.less # 变量定义
│   │   ├── mixins.less   # 混合定义
│   │   └── global.less   # 全局样式
│   ├── types/       # 类型定义
│   ├── constants/   # 常量定义
│   ├── hooks/       # 自定义 Hooks
│   ├── App.tsx      # 应用入口
│   └── index.tsx    # 渲染入口
├── public/          # 公共资源
│   ├── index.html   # HTML 模板
│   ├── favicon.ico  # 网站图标
│   └── manifest.json # 应用清单
├── tests/           # 测试文件
│   ├── unit/        # 单元测试
│   ├── integration/ # 集成测试
│   └── e2e/         # 端到端测试
├── config/          # 配置文件
│   ├── webpack/     # Webpack 配置
│   ├── jest/        # Jest 配置
│   └── eslint/      # ESLint 配置
├── scripts/         # 脚本文件
├── .env             # 环境变量
├── .env.development # 开发环境变量
├── .env.production  # 生产环境变量
├── package.json     # 项目配置
├── tsconfig.json    # TypeScript 配置
└── README.md        # 项目说明
```

## 技术栈

### 核心框架
- React 18.2.0
- TypeScript 5.0.0
- Redux Toolkit 1.9.0
- React Router 6.10.0
- Axios 1.3.0
- Ant Design 5.0.0

### 开发工具
- Webpack 5.0.0
- Babel 7.0.0
- ESLint 8.0.0
- Prettier 3.0.0
- Jest 29.0.0
- Husky 8.0.0
- lint-staged 13.0.0

### 样式工具
- Less 4.0.0
- CSS Modules
- PostCSS 8.0.0
- Stylelint 15.0.0
- Autoprefixer 10.0.0

## 开发规范

### 代码规范
1. 使用 TypeScript 进行开发
2. 遵循 React 最佳实践
3. 使用函数组件和 Hooks
4. 实现适当的错误处理
5. 添加必要的注释和文档

### 组件规范
1. 组件单一职责
2. 使用 TypeScript 类型定义
3. 实现组件复用
4. 保持组件简洁
5. 添加组件文档

### 样式规范
1. 使用 CSS Modules
2. 遵循 BEM 命名
3. 实现响应式设计
4. 保持样式模块化
5. 使用变量和混合

### 提交规范
```bash
# 提交格式
<type>(<scope>): <subject>

# 提交类型
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式
refactor: 代码重构
test: 测试相关
chore: 构建相关
```

## 开发流程

### 环境搭建
1. 安装 Node.js
   ```bash
   # 使用 nvm 安装 Node.js
   nvm install 16
   nvm use 16
   ```

2. 安装依赖包
   ```bash
   # 安装依赖
   npm install

   # 安装生产依赖
   npm install --production

   # 安装开发依赖
   npm install --save-dev
   ```

3. 配置开发环境
   ```bash
   # 复制环境变量文件
   cp .env.example .env.development

   # 修改环境变量
   vim .env.development
   ```

4. 启动开发服务器
   ```bash
   # 启动开发服务器
   npm run dev

   # 启动开发服务器（带热更新）
   npm run dev:hot
   ```

5. 检查环境配置
   ```bash
   # 检查 Node.js 版本
   node -v

   # 检查 npm 版本
   npm -v

   # 检查依赖版本
   npm list
   ```

### 开发步骤
1. 创建功能分支
   ```bash
   # 创建并切换到新分支
   git checkout -b feature/your-feature
   ```

2. 实现功能代码
   ```bash
   # 添加修改
   git add .

   # 提交修改
   git commit -m "feat: add new feature"
   ```

3. 编写测试用例
   ```bash
   # 运行单元测试
   npm run test:unit

   # 运行集成测试
   npm run test:integration

   # 运行端到端测试
   npm run test:e2e
   ```

4. 进行代码审查
   ```bash
   # 运行代码检查
   npm run lint

   # 运行类型检查
   npm run type-check

   # 运行格式化
   npm run format
   ```

5. 合并到主分支
   ```bash
   # 切换到主分支
   git checkout main

   # 合并功能分支
   git merge feature/your-feature

   # 推送到远程
   git push origin main
   ```

### 构建部署
1. 运行构建命令
   ```bash
   # 构建生产环境
   npm run build

   # 构建开发环境
   npm run build:dev

   # 构建测试环境
   npm run build:test
   ```

2. 检查构建结果
   ```bash
   # 检查构建文件
   ls -l dist/

   # 检查构建日志
   cat build.log
   ```

3. 部署到服务器
   ```bash
   # 部署到生产环境
   npm run deploy:prod

   # 部署到测试环境
   npm run deploy:test
   ```

4. 验证部署结果
   ```bash
   # 检查部署状态
   npm run status

   # 检查部署日志
   npm run logs
   ```

5. 监控运行状态
   ```bash
   # 监控性能指标
   npm run monitor

   # 监控错误日志
   npm run error-log
   ```

## 环境变量配置

### 开发环境 (.env.development)
```env
# API 配置
REACT_APP_API_URL=http://localhost:3000
REACT_APP_API_TIMEOUT=5000

# 认证配置
REACT_APP_AUTH_TOKEN_KEY=auth_token
REACT_APP_AUTH_EXPIRES=3600

# 存储配置
REACT_APP_STORAGE_PREFIX=app_
REACT_APP_STORAGE_TYPE=local

# 功能开关
REACT_APP_FEATURE_FLAG_1=true
REACT_APP_FEATURE_FLAG_2=false
```

### 生产环境 (.env.production)
```env
# API 配置
REACT_APP_API_URL=https://api.example.com
REACT_APP_API_TIMEOUT=10000

# 认证配置
REACT_APP_AUTH_TOKEN_KEY=auth_token
REACT_APP_AUTH_EXPIRES=7200

# 存储配置
REACT_APP_STORAGE_PREFIX=app_
REACT_APP_STORAGE_TYPE=session

# 功能开关
REACT_APP_FEATURE_FLAG_1=false
REACT_APP_FEATURE_FLAG_2=true
```

## 测试要求

### 单元测试
1. 测试组件渲染
   ```javascript
   import { render, screen } from '@testing-library/react';
   import Component from './Component';

   test('renders component', () => {
     render(<Component />);
     expect(screen.getByText('Hello')).toBeInTheDocument();
   });
   ```

2. 测试事件处理
   ```javascript
   import { render, fireEvent } from '@testing-library/react';
   import Button from './Button';

   test('handles click event', () => {
     const handleClick = jest.fn();
     render(<Button onClick={handleClick} />);
     fireEvent.click(screen.getByRole('button'));
     expect(handleClick).toHaveBeenCalled();
   });
   ```

3. 测试状态变化
   ```javascript
   import { render, act } from '@testing-library/react';
   import Counter from './Counter';

   test('updates count', () => {
     render(<Counter />);
     act(() => {
       fireEvent.click(screen.getByRole('button'));
     });
     expect(screen.getByText('1')).toBeInTheDocument();
   });
   ```

### 集成测试
1. 测试页面流程
   ```javascript
   import { render, screen } from '@testing-library/react';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';

   test('navigates to about page', () => {
     render(
       <BrowserRouter>
         <App />
       </BrowserRouter>
     );
     fireEvent.click(screen.getByText('About'));
     expect(screen.getByText('About Page')).toBeInTheDocument();
   });
   ```

2. 测试数据交互
   ```javascript
   import { render, waitFor } from '@testing-library/react';
   import UserList from './UserList';

   test('fetches and displays users', async () => {
     render(<UserList />);
     await waitFor(() => {
       expect(screen.getByText('User 1')).toBeInTheDocument();
     });
   });
   ```

### 端到端测试
1. 测试用户操作
   ```javascript
   describe('User Flow', () => {
     it('should login and view profile', () => {
       cy.visit('/login');
       cy.get('input[name="username"]').type('user');
       cy.get('input[name="password"]').type('pass');
       cy.get('button[type="submit"]').click();
       cy.url().should('include', '/profile');
     });
   });
   ```

## 性能优化

### 加载优化
1. 代码分割
   ```javascript
   // 动态导入组件
   const LazyComponent = React.lazy(() => import('./LazyComponent'));

   function App() {
     return (
       <Suspense fallback={<Loading />}>
         <LazyComponent />
       </Suspense>
     );
   }
   ```

2. 资源压缩
   ```javascript
   // webpack.config.js
   module.exports = {
     optimization: {
       minimize: true,
       minimizer: [
         new TerserPlugin(),
         new CssMinimizerPlugin(),
       ],
     },
   };
   ```

3. 缓存策略
   ```javascript
   // 设置缓存头
   app.use(express.static('public', {
     maxAge: '1y',
     etag: true,
   }));
   ```

### 渲染优化
1. 虚拟列表
   ```javascript
   import { VirtualList } from 'react-virtualized';

   function List({ items }) {
     return (
       <VirtualList
         width={300}
         height={400}
         rowCount={items.length}
         rowHeight={50}
         rowRenderer={({ index, style }) => (
           <div style={style}>{items[index]}</div>
         )}
       />
     );
   }
   ```

2. 记忆化组件
   ```javascript
   const MemoizedComponent = React.memo(function Component({ data }) {
     return <div>{data}</div>;
   });
   ```

### 网络优化
1. 请求合并
   ```javascript
   // 使用 GraphQL 合并请求
   const query = gql`
     query {
       user {
         name
         email
         posts {
           title
           content
         }
       }
     }
   `;
   ```

2. 数据缓存
   ```javascript
   // 使用 SWR 缓存数据
   function Profile() {
     const { data, error } = useSWR('/api/user', fetcher);
     if (error) return <div>failed to load</div>;
     if (!data) return <div>loading...</div>;
     return <div>hello {data.name}!</div>;
   }
   ```

## 部署配置

### Nginx 配置
```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
```

### Docker 配置
```dockerfile
# 构建阶段
FROM node:16-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 注意事项
1. 保持代码可维护性
   - 遵循代码规范
   - 添加必要注释
   - 定期重构代码
   - 保持文档更新

2. 注意性能问题
   - 监控加载时间
   - 优化资源大小
   - 减少重渲染
   - 使用缓存策略

3. 处理兼容性
   - 支持主流浏览器
   - 处理浏览器差异
   - 提供降级方案
   - 测试不同设备

4. 关注安全性
   - 防止 XSS 攻击
   - 防止 CSRF 攻击
   - 加密敏感数据
   - 定期安全审计

5. 定期更新依赖
   - 检查更新日志
   - 测试兼容性
   - 更新依赖版本
   - 解决安全问题 