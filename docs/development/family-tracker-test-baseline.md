# 家庭成长跟踪测试基线

记录日期：2026-06-17

工作区：`/Users/linmingfeng/.config/superpowers/worktrees/LMS/family-growth-tracker`

分支：`codex/family-growth-tracker`

## 1. 环境准备

### 1.1 依赖安装

命令：

```bash
npm install
```

结果：通过。

注意事项：

- npm audit 报告 30 个漏洞：7 low、12 moderate、10 high、1 critical。
- `fsevents` 和 `mongodb-memory-server` 有待审核 install scripts。
- 这些问题不阻塞 Task 1 文档基线，但后续进入可运行 Demo 前需要单独处理。

## 2. 根项目测试基线

### 2.1 命令

```bash
npm run test:nocoverage
```

### 2.2 结果

失败。

摘要：

```text
Test Suites: 238 failed, 24 passed, 262 total
Tests:       996 failed, 17 skipped, 207 passed, 1220 total
Snapshots:   0 total
Time:        39.156 s
```

### 2.3 主要失败类别

| 类别 | 代表文件或位置 | 现象 | 是否阻塞家庭成长跟踪 |
| --- | --- | --- | --- |
| 依赖解析 | `common/config/index.js` | `Cannot find module 'joi'` | 阻塞涉及公共鉴权/配置的服务测试，需要在后端实现前处理 |
| 依赖解析 | `services/analytics-service/server.js` | `Cannot find module 'socket.io'` | 不阻塞 Task 1；阻塞 analytics server 测试 |
| logger mock 不一致 | `common/config/logger.js` | `winston.addColors is not a function`、`winston.format.errors is not a function` | 阻塞部分 service server 测试，需要统一 logger mock |
| 旧路径引用 | `common/models/Homework`、`common/models/Progress` | 测试引用不存在模型路径 | 阻塞相关旧测试，不阻塞新增 `GrowthTask` / `GrowthLog` 设计 |
| mongoose mock / 模型接口不一致 | `ResourceReviewSchema.post`、`Homework.deleteMany`、`Progress.deleteMany` | mock schema 或模型缺少 mongoose 方法 | 阻塞模型测试基线，需要修 mock 或测试 setup |
| 多 Mongo 连接 | `ResourceReview.hooks.test.js`、`progress-service` 测试 | 多次连接不同 MongoMemoryServer 导致 `openUri()` 错误 | 阻塞集成测试稳定性 |
| 路由响应契约漂移 | 多个 video meeting、health、resource、analytics 测试 | 期望 4xx/特定字段，实际返回通用 `Success message` 或 `status=success` | 多数属于第一阶段暂缓模块，不阻塞家庭成长主线 |
| 缺失常量文件 | `meetingValidators.js` | `Cannot find module '../../../common/constants/userRoles'` | 不阻塞家庭成长主线，会议模块第一阶段暂缓 |

## 3. 目标服务测试

### 3.1 user-service

命令：

```bash
npm test --prefix backend/services/user-service -- --runInBand
```

结果：失败。

摘要：

```text
Test Suites: 11 failed, 11 total
Tests:       0 total
```

主要失败：

- `backend/services/user-service/__tests__/setup.js` 引用 `../models/User` 和 `../models/Role`。
- 当前实现已经使用 `backend/common/models/User.js` 和 `backend/common/models/Role.js`。

类别：路径 mismatch / 测试 setup mismatch。

是否阻塞家庭成长跟踪：

- 阻塞 Task 3 的家庭和孩子接口测试。
- 在新增 `Family`、孩子 PIN、家庭权限测试前，应先修正 user-service 测试 setup 的模型路径。

### 3.2 homework-service

命令：

```bash
npm test --prefix backend/services/homework-service -- --runInBand
```

结果：失败。

摘要：

```text
Test Suites: 5 failed, 1 passed, 6 total
Tests:       6 failed, 5 passed, 11 total
```

主要失败：

- `common/config/index.js` 无法解析 `joi`。
- `__tests__/homework.test.js` 引用不存在的 `../../../common/models/Homework`。
- `homework-flow.simple.test.js` 使用 `mongoose` 但未 import。

类别：依赖解析 / 路径 mismatch / 测试代码缺失 import。

是否阻塞家庭成长跟踪：

- 阻塞 Task 4 的 `GrowthTask` 测试基线。
- 可以不修旧 `Homework` 业务行为，但需要保证新增 `growthTasks.test.js` 不依赖旧错误 setup。

### 3.3 progress-service

命令：

```bash
npm test --prefix backend/services/progress-service -- --runInBand
```

结果：失败，且因 open handle 未自动退出，已手动中断。

摘要：

```text
Test Suites: 6 failed, 1 passed, 7 total
Tests:       25 failed, 8 passed, 33 total
Open handle: server.js 直接 app.listen(PORT)
```

主要失败：

- 多个测试重复连接不同 MongoMemoryServer，触发 `Can't call openUri() on an active connection with different connection strings`。
- `__tests__/progress.test.js` 引用不存在的 `../../../common/models/Progress`。
- `server.js` 在测试 import 时直接 `app.listen`，导致 open handle。
- `MONGO_URI` 未配置时 server import 触发连接失败。
- 部分测试期望 `/api/progress/...` 返回 200/401/403，实际为 404，路由挂载与测试契约不一致。

类别：Mongo 测试生命周期 / 路径 mismatch / server 启动副作用 / 路由契约不一致。

是否阻塞家庭成长跟踪：

- 阻塞 Task 5 的 `GrowthLog`、能力点和奖励测试稳定性。
- 进入 Task 5 前应优先拆分 `progress-service` 的 app 导出和 listen 启动逻辑，避免测试直接启动端口。

### 3.4 analytics-service

命令：

```bash
npm test --prefix backend/services/analytics-service -- --runInBand
```

结果：失败。

摘要：

```text
Test Suites: 10 failed, 8 passed, 18 total
Tests:       20 failed, 70 passed, 90 total
```

主要失败：

- `server.js` 缺少 `socket.io` 依赖。
- `StudentPerformanceTrend` 模型测试期望保存和校验失败，但实际返回 undefined 或未抛出校验错误。
- `long-term-trends` 测试期望 `learningPatterns`、`visualization` 字段，实际响应缺失。
- `progress` 路由对部分 period 参数返回 500。
- 存在 MSW / axios open handle 警告。

类别：依赖缺失 / 模型验证契约不一致 / 响应契约不一致 / mock open handle。

是否阻塞家庭成长跟踪：

- 不阻塞 Task 1。
- 阻塞 Task 6 的家庭错题和成长周报测试稳定性，尤其是 analytics server import 和缺失依赖问题。

## 4. 阻塞判断

Task 1 文档基线不受现有测试失败影响，已完成。

Task 3 之前建议至少处理：

1. `user-service` 测试 setup 的模型路径。
2. 公共配置中 `joi` 在服务测试环境下的解析问题。
3. 需要新增家庭成长测试时，避免复用会直接失败的旧 setup。

Task 5 之前建议处理：

1. `progress-service/server.js` 的 `app.listen` 副作用。
2. MongoMemoryServer 生命周期重复连接问题。

Task 6 之前建议处理：

1. `analytics-service` 缺失 `socket.io` 或改为可 mock 的可选依赖。
2. analytics server import 与测试隔离问题。

## 5. 下一步建议

按照原实施计划继续时，不应先修所有旧学校版测试。建议采用以下策略：

1. Task 3 先修 `user-service` 测试 setup，使家庭和孩子权限测试能跑。
2. 新增家庭成长能力时使用独立测试文件和最小 setup，避免被学校版会议、资源市场、复杂 analytics 测试拖住。
3. 旧会议、公告、资源推荐和学校分析测试作为迁移债务记录，不进入第一阶段 MVP 阻塞路径。

## 6. 2026-06-19 Task 5 准入复测

执行命令：

```bash
npm run test:nocoverage
```

执行完成并返回退出码 `1`，未再被 `ConfigManager.process.exit(1)` 提前终止：

```text
Test Suites: 224 failed, 43 passed, 267 total
Tests:       1126 failed, 18 skipped, 391 passed, 1535 total
Snapshots:   0 total
Time:        50.021 s
```

与 2026-06-17 基线相比，失败套件减少 14，通过套件增加 19。失败测试数增加是因为配置错误在测试环境改为抛出后，原先被进程提前终止的遗留套件能够继续执行并报告每个失败用例，不是家庭成长链路新增回归。

同一次全量运行中，下列 Task 5 准入套件均通过：

- family/children routes。
- growthTasks routes。
- gateway identity envelope 和 production error contract。
- common auth、gateway identity 和 error handler。
- progress-service startup、server、routes、model 和 integration，共 7 suites / 35 tests。

剩余失败仍属于本文件第 2.3 节已分类的旧学校模块、旧路径、非 progress-service 多 Mongo 生命周期、logger mock 和暂缓依赖问题。
