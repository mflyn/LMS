# T5 专用分支交付记录

**Scope:** BRANCH_PR_ONLY / NO_MERGE / NO_DEPLOY

## 候选范围

- 基础提交：`bb9d78170ba50d64939a520c9785e5735135d761`（T4 PR #30 merge commit）。
- 专用分支：`codex/t5-daily-plan-delivery`；从 main 建立隔离工作树，不改变原工作区。
- 完整纳入 T5 每日计划模型、API、页面、数字输入修订、测试、状态校验和工程关闭记录。
- 排除 AI/K12 变更：docs/README.md、family-ai-learning-platform-design.md；仅取 system-design、development/README 和 MVP plan 中 T5 相关增量，不带入 AI 路线附录。
- 本次额外修改仅为当前 Git 授权状态及相应校验，未扩大业务范围。T4 门禁不随本次交付关闭。

## 证据分层

原 `t5-synthetic-2026-10-26` 和 `t5-numeric-fix-2026-10-27` 归档索引、补丁、历史失败和独立复验证据均保留。
原混合工作区冻结清单是历史证据，不是本 PR 完整补丁；原数字输入增量补丁也不代替完整候选。
当前候选由本分支相对基础提交的完整 Git diff 定义；新验证及文件哈希另行记录，不覆盖或重新签署旧候选。
原始运行日志和截图为本地归档，提交的是脱敏索引/摘要；不得声称本 PR 已上传所有原始日志。

## 保留边界

T5 APPROVED / CLOSED / ENGINEERING_SYNTHETIC_ONLY；真机 DEVICE_PENDING，T8_PENDING / NOT_AUTHORIZED。
T5-NB-001、T5-NB-002 保持 OPEN_NONBLOCKING；SL-04 整体 PLANNED，T7/T9 义务保留。
D01/T2-G、高级恢复、新回收 REMAINDER_DEFERRED，默认关闭；历史失败不改写为全绿。
不合并、不部署、不操作真实家庭数据。

## 本次验证

本次为交付线程对分离候选的重新验证，不冒充另一轮独立复评。Node 22.15.0，本机合成环境：

| 命令 | 实际结果 |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run docs:family:check` | exit 0 |
| `npm run test:family-regression` | 149 suites passed；4307 passed、1 skipped、4308 total；exit 0 |
| `npm run test:family-regression -- --runTestsByPath backend/common/deployment/__tests__/task5Deployment.test.js` | 补齐 kubectl PATH 后 18/18 passed，0 skipped |
| `npm --prefix frontend/web run test:ci -- --runInBand` | 49 suites / 628 passed |
| `npm --prefix frontend/web run build` | 首次沙箱 EPERM 创建 build 失败；获准工作树写权限后构建 exit 0，保留首次日志 |
| `npm run test:t2:integration` | 4 suites / 22 passed |
| `T2_WEB_BUILD=<当前构建绝对路径> npm run test:t2:e2e -- dailyLearningPlan.spec.js` | 9 passed；正式服务 HTTP、临时数据库，合成媒体和测试凭据；浏览器不是真机 |

首次全量的跳过项为既有 `TC-T5-DEPLOY-002`，原因是当时 PATH 不含 `/usr/local/bin` 的 kubectl。
补验仅执行既有 dry-run 参数测试，不连接集群；未修改或删除测试、断言、超时或跳过条件。
该补验不改写首次全量统计。构建保留既有 Browserslist 数据陈旧提示，不在此次升级依赖。
最终文档状态套件、链接检查及 diff 校验结果由 [交付验证索引](validation.json) 记录。
完整 `git diff --cached --check` 为 exit 2，仅指出旧冻结 `revision.patch` 第 26/168 行的
单空格上下文行；这些是 unified diff 空白上下文的结构，不是业务源码尾空白。原件哈希不改写。
排除此唯一不可变补丁后的暂存差异检查 exit 0，且 `git apply --stat` 可解析原补丁；未修改 lint 规则。

敏感信息检查覆盖完整候选文件：私钥、常见 Token/API key、硬编码 JWT、带密码连接串及
密码/凭据赋值的模式检查加逐项审阅；25 个赋值命中均为合成测试常量，无真实凭据发现。
此检查不宣称全面安全审计。无 `.env`、依赖目录、原始截图/日志或数据库进入提交。
原 364/182/84/108 份归档及 14 项关闭记录绑定核验一致；12 份旧证据文档逐字节保留。
本轮原始日志、截图和哈希本地归档于专用工作树 `release-gate-artifacts/t5-delivery-2026-10-27/`，
原历史证据仍在原工作区，不迁移、不覆盖。GitHub 仅提交索引、摘要和原已脱敏冻结补丁。

CI 结果以本分支 GitHub Actions 实际运行记录为准，不提前声明通过。现有 PR 工作流不触发
镜像发布或真实部署；未触发任何手动性能、安全扫描、发布或部署任务。
