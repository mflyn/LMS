# 前端测试文档

## 测试类型

### 1. 单元测试
- 测试单个组件和函数
- 使用 Jest + React Testing Library
- 测试文件命名规范：`*.test.jsx`
- 测试目录结构：
  ```
  tests/
  ├── unit/
  │   ├── components/
  │   ├── hooks/
  │   ├── utils/
  │   └── services/
  ```

### 2. 组件测试
- 测试组件渲染
- 测试用户交互
- 测试组件状态
- 测试组件生命周期

### 3. 集成测试
- 测试组件间交互
- 测试页面流程
- 测试状态管理
- 测试路由导航

### 4. 端到端测试
- 测试完整用户流程
- 使用 Cypress
- 测试跨页面交互
- 测试数据流

## 测试工具

### 1. 测试框架
- Jest：JavaScript 测试框架
- React Testing Library：React 组件测试
- Cypress：端到端测试
- MSW：API 模拟

### 2. 测试辅助工具
- Jest DOM：DOM 测试扩展
- React Router Testing：路由测试
- Redux Mock Store：状态管理测试
- Axios Mock Adapter：HTTP 请求模拟

## 测试覆盖率要求

### 1. 代码覆盖率
- 语句覆盖率：> 90%
- 分支覆盖率：> 85%
- 函数覆盖率：> 95%
- 行覆盖率：> 90%

### 2. 组件覆盖率
- 核心组件：100%
- 业务组件：> 90%
- 工具函数：100%
- 自定义 Hook：100%

## 测试流程

### 1. 测试准备
```bash
# 安装测试依赖
npm install --save-dev @testing-library/react @testing-library/jest-dom cypress

# 配置测试环境
cp cypress.env.example.json cypress.env.json
```

### 2. 运行测试
```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行组件测试
npm run test:components

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 生成测试覆盖率报告
npm run test:coverage
```

## 测试用例示例

### 1. 组件测试示例
```javascript
// tests/unit/components/Button.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../../../components/Button';

describe('Button Component', () => {
  test('renders button with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  test('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 2. Hook 测试示例
```javascript
// tests/unit/hooks/useAuth.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from '../../../hooks/useAuth';

describe('useAuth Hook', () => {
  test('returns initial auth state', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('updates auth state after login', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

### 3. 端到端测试示例
```javascript
// tests/e2e/login.spec.js
describe('Login Flow', () => {
  it('successfully logs in with valid credentials', () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type('test@example.com');
    cy.get('[data-testid="password"]').type('password');
    cy.get('[data-testid="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## 测试最佳实践

### 1. 组件测试原则
- 测试用户行为而非实现细节
- 使用语义化的查询方法
- 避免测试内部状态
- 模拟必要的依赖

### 2. 状态管理测试
- 测试 action 创建函数
- 测试 reducer 逻辑
- 测试 selector 函数
- 测试异步 action

### 3. 路由测试
- 测试路由匹配
- 测试导航行为
- 测试路由参数
- 测试路由守卫

## 持续集成

### 1. CI 配置
```yaml
# .github/workflows/test.yml
name: Frontend Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '14'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

### 2. 测试报告
- 测试结果通知
- 覆盖率报告
- 性能测试报告
- 可视化测试报告

## 故障排除

### 1. 常见问题
- 测试环境配置问题
- 异步测试问题
- 状态管理问题
- 路由测试问题

### 2. 调试技巧
- 使用调试器
- 添加测试日志
- 检查测试数据
- 验证模拟行为 