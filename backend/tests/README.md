# 测试文档

## 测试类型

### 1. 单元测试
- 测试单个函数或类的功能
- 使用 Jest 作为测试框架
- 测试文件命名规范：`*.test.js`
- 测试目录结构：
  ```
  tests/
  ├── unit/
  │   ├── services/
  │   ├── models/
  │   ├── utils/
  │   └── middleware/
  ```

### 2. 集成测试
- 测试多个组件之间的交互
- 测试 API 接口
- 测试数据库操作
- 测试文件命名规范：`*.test.js`（位于 integration 目录下）
- 测试目录结构：
  ```
  tests/
  ├── integration/
  │   ├── cross-service.test.js  # 跨服务集成测试
  ```

各服务内部也有集成测试：
  ```
  services/
  ├── resource-service/
  │   ├── __tests__/
  │   │   ├── integration/
  │   │   │   └── resource-flow.test.js
  ├── progress-service/
  │   ├── __tests__/
  │   │   ├── integration/
  │   │   │   └── progress-flow.test.js
  ├── homework-service/
  │   ├── __tests__/
  │   │   ├── integration/
  │   │   │   └── homework-flow.test.js
  ├── analytics-service/
  │   ├── __tests__/
  │   │   ├── integration/
  │   │   │   └── analytics-flow.test.js
  ```

### 3. 端到端测试
- 测试完整的业务流程
- 模拟真实用户操作
- 测试文件命名规范：`*.e2e.test.js`

### 4. 性能测试
- 测试系统在高负载下的表现
- 测试响应时间
- 测试并发处理能力
- 测试文件命名规范：`*.performance.test.js`

### 5. 安全测试
- 测试认证和授权
- 测试数据验证
- 测试输入过滤
- 测试文件命名规范：`*.security.test.js`

## 测试覆盖率要求

### 1. 代码覆盖率
- 语句覆盖率：> 90%
- 分支覆盖率：> 85%
- 函数覆盖率：> 95%
- 行覆盖率：> 90%

### 2. 测试场景覆盖率
- 正常流程测试：100%
- 异常流程测试：100%
- 边界条件测试：100%
- 错误处理测试：100%

## 测试工具

### 1. 测试框架
- Jest：JavaScript 测试框架
- Supertest：HTTP 请求测试
- Mock：数据模拟

### 2. 性能测试工具
- Loadtest：负载测试
- Artillery：压力测试
- JMeter：性能测试

### 3. 安全测试工具
- OWASP ZAP：安全扫描
- ESLint：代码安全检查
- Dependency-check：依赖安全检查

## 测试流程

### 1. 测试准备
```bash
# 安装测试依赖
npm install --save-dev jest supertest @types/jest

# 配置测试环境
cp .env.test.example .env.test
```

### 2. 运行测试
```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 运行性能测试
npm run test:performance

# 运行安全测试
npm run test:security

# 生成测试覆盖率报告
npm run test:coverage
```

### 3. 测试报告
- 测试结果输出到控制台
- 生成 HTML 格式的覆盖率报告
- 生成测试报告文件

## 测试用例示例

### 1. 单元测试示例
```javascript
// tests/unit/services/auth.test.js
describe('Auth Service', () => {
  test('should register user successfully', async () => {
    const userData = {
      username: 'testuser',
      password: 'Test123!',
      email: 'test@example.com'
    };

    const result = await authService.register(userData);
    expect(result.success).toBe(true);
    expect(result.user).toHaveProperty('id');
  });

  test('should handle duplicate username', async () => {
    const userData = {
      username: 'existinguser',
      password: 'Test123!',
      email: 'test@example.com'
    };

    await expect(authService.register(userData))
      .rejects
      .toThrow('Username already exists');
  });
});
```

### 2. 集成测试示例
```javascript
// tests/integration/api/auth.test.js
describe('Auth API', () => {
  test('should login and get token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'Test123!'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### 3. 性能测试示例
```javascript
// tests/performance/api.test.js
describe('API Performance', () => {
  test('should handle 100 concurrent requests', async () => {
    const requests = Array(100).fill().map(() =>
      request(app).get('/api/data')
    );

    const start = Date.now();
    await Promise.all(requests);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // 5秒内完成
  });
});
```

## 测试最佳实践

### 1. 测试编写原则
- 测试用例要独立
- 测试结果要可预测
- 测试代码要简洁
- 测试覆盖要全面

### 2. 测试数据管理
- 使用测试数据库
- 测试前清理数据
- 使用模拟数据
- 数据隔离

### 3. 测试环境配置
- 独立的测试环境
- 测试专用的配置
- 模拟的外部服务
- 测试数据准备

## 持续集成

### 1. CI 配置
```yaml
# .github/workflows/test.yml
name: Test
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
- 安全测试报告

## 故障排除

### 1. 常见问题
- 测试环境配置问题
- 数据库连接问题
- 模拟数据问题
- 异步测试问题

### 2. 调试技巧
- 使用调试器
- 添加日志
- 检查测试数据
- 验证环境配置