# T5 数字输入 P2 / 冲突图 P3 聚焦修订

范围：QA-T5-NUMERIC-INPUT-001、QA-T5-DESIGN-CONFLICT-002。仅本地合成开发验证。
T5 总门禁 OPEN；DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、T7/T9、D01、
高级恢复/新回收 REMAINDER_DEFERRED 不变。不提交、推送、合并、部署或运行真实 cleanup/restore。

## 核实与实施前方案

2026-10-27 08:21 Asia/Shanghai，生产代码尚未修改。
已读取独立 r1 的 REPORT/findings/candidate/verification/manifest，核验冻结 108 文件和原候选
41 文件哈希一致。r1 为不可改写的失败证据，路径为评审线程的 `t5-full-review-2026-10-27/r1`。
基线仍是 `20da7e855413394454ba0a41c659cfd67abfa975` 加原 41 份未提交文件，不是新 Git 提交。

核实：number 控件的 value 空串既可能表示主动清空，也可能表示未完成的 `1e`；
当前 onChange 只保存 value，save 将空串转 null，故原生 badInput 丢失会误清估时和输入者。
API §14.4 的 null 合法清空不能删除。§9.1 时序图的“409 + 最新计划摘要”与标准错误及另发 GET 不符。

聚焦方案：

1. 每个草稿项同时保留 value 与原生 badInput，跟随 taskId 移动；onInput 捕获规范 value 仍为
   空串的连续原生编辑，onChange 保留受控输入既有行为。无效时就地提示、禁用保存，并在构造
   payload 前防御性拒绝。快捷值、纠正、真正清空恢复有效状态；标记绝不进入 API 正文。
2. 无效状态随草稿项移除、显式采用、成功读取或 scope 卸载清除；普通刷新和结果未知重试
   沿用原行为，不重新基于坏草稿生成原命令。不同任务的无效状态不能互相覆盖。
3. 只改现有时序图：标准 409、独立 GET、比较/提示、显式采用；普通读失败保留原草稿/命令，
   401/403 仍清私有视图。不新增响应字段或后端行为。
4. 先补真实 Chromium 永久反例并观察 RED，再修复；覆盖孩子/家长的未完成输入、纠正、显式
   清空、1/240、0/241/小数、排序和其他项；补组件 scope/重试保护。移植原独立探针仅改候选
   根路径与输出路径，保留其断言和原失败。使用新固定构建和新证据目录，不修改 r1。

## 实施前自查

2026-10-27 08:21 Asia/Shanghai，结论：SELF_REVIEW_PASS，允许按本方案实施。
这是开发自查，不是用户验收或评审线程复评。

- 不将“所有空串拒绝”当修复，保留真正清空；不把未完成数字自动改写成旧值或合法分钟。
- 状态和任务标识绑定，不按行号；onInput 处理相同空 value 下 badInput 变化，避免仅 onChange 漏报。
- 不新增持久化、权限或重试协议；payload 仍仅 expectedVersion 与 taskId/childEstimatedMinutes。
- 范围限组件、其组件/现有浏览器套件、架构 §9.1 和必要交付记录；共享 AI/K12 的其他段落不动。
- 本地故障回退可恢复本次组件/图的增量，不涉及数据迁移；回退会重新暴露原 P2，不能作为通过状态。
- Browser plugin not available，复用仓库 Playwright Chromium；JSDOM 不代替原生输入验证。

## 执行与交付

2026-10-27 接续授权后完成聚焦修订，状态 **FIXED_PENDING_INDEPENDENT_REVIEW**。
本记录是开发自查和开发复验，不是独立 QA 通过，不关闭两个问题或 T5 总门禁。
实施前方案原文 SHA256 为 `841dc620e952acd353818d8339333c2a60884588a6efc0f5727fa05e8ddc80c9`。

### 修订与自查

- 数字输入同时记录原生 badInput 和 value，按 taskId 绑定，排序不丢失；无效项就地提示并阻止
  保存，构造正文前再次检查。onInput 捕获空 value 未变化的主动清空，onChange 保持原有输入通道。
- 真实清空仍提交 null；纠正和快捷值清除无效标记。标记只在草稿内，完整替换正文不包含它。
  移除项、采用最新、成功保存和身份切换沿现有生命周期处理；普通刷新不偷偷清空草稿。
- 原命令重试仍使用原 expectedVersion/items；未改后端、共享会话、作用域验证或奖励逻辑。
- 系统设计 §9.1 改为标准 409 后独立 GET、比较完整顺序/估时、显式采用，不自动保存；普通
  读取失败保留命令，401/403 清私有视图，与现有组件/API 一致。没有新增响应字段。
- 自查逐项核对 payload 白名单、同空串输入、排序/移除、多项状态、跨孩子卸载和原请求重试，
  未发现新增阻断；该结论不能替代下一轮独立复评。

### 开发验证

运行目录为仓库根；Node 22.15.0。原始命令、环境白名单、执行时间、退出码和运行前后文件 SHA
保存在新归档各同名 `.json`/`.log`，执行者均为开发线程。源码运行期间无变更。

| 证据标签 / 命令 | 结果 |
| --- | --- |
| component-red；修复前组件文件 | 3 failed / 21 passed，保留原失败 |
| browser-red；修复前新增真实浏览器用例 | 两个角色负向 2 failed，合法边界对照 2 passed |
| original-child-red / original-controls-red；原探针旧构建 | 孩子 1 failed；家长 1 failed、清空/合法值 2 passed |
| component-green；`npm run test:ci --prefix frontend/web -- --runInBand --runTestsByPath src/__tests__/shared/DailyLearningPlanPanel.test.js` | 24 passed |
| frontend-full；`npm run test:ci --prefix frontend/web -- --runInBand` | 49 suites / 628 passed |
| fixed-build；`CI=true npm run build --prefix frontend/web` | exit 0，固定构建另存 fixed-web |
| browser-green；`npm run test:t2:e2e -- dailyLearningPlan.spec.js` | 9 passed，原 5 项完整保留，新增 4 项 |
| original-child-green / original-controls-green；原独立探针仅替换根路径 | 1 passed / 3 passed，断言未改；这是开发复跑 |
| formal-http；`npm run test:t2:integration` | 4 suites / 22 passed，正式 HTTP 回归 |
| lint-focused；ESLint 检查组件、组件测试和浏览器测试三个增量 JS 文件 | exit 0，不声明全仓 lint |
| docs-gate / docs-check 及 final 版本 | 文档状态 162 passed；`npm run docs:family:check` exit 0 |

永久反例覆盖原生 `1e`/`-`/`1e+`、零 PUT 和完整数据库不变、纠正为 30、真正清空、
1/240 合法值及 0/241/小数拒绝、两项估时和移动、移除、身份切换和原命令精确重试。
组件新增 4 项，浏览器新增 4 项；原探针与永久反例重叠，不相加为独立覆盖数。
真实页面运行于临时回环端口，Gateway、user/homework/resource/progress/analytics/notification
使用既有正式工厂和真实 HTTP；临时 Mongo/存储，trusted-local 扫描不是 ClamAV 验证。
Browser plugin not available，使用仓库 Playwright Chromium；截图核对孩子 390 和家长 768 宽的
无效提示及保存状态，原回归另覆盖 390/768/1280。无空白页/框架覆盖层/浏览器控制台警告错误，
控制台 Node 色彩环境提示单独保留。未运行真机、服务器或新的后端全量，历史 4290 不冒称本次重跑。

### 冻结与独立复评入口

- 新归档：`release-gate-artifacts/t5-numeric-fix-2026-10-27/dev-r1/`，包含红/绿原始日志、
  两份固定构建、原探针路径适配证明、截图、运行元数据和原 41 文件基线副本。
- 本目录 `candidate-manifest.json` 绑定原基线 SHA、当前完整 T5 候选逐文件哈希及增量清单；
  `revision.patch` 只包含本轮七文件增量，不将既有 AI/K12 文档修改重新归为本次修订。
- `freeze-verification.json` 记录补丁在基线副本应用后与候选一致、历史独立 108 文件及开发
  364 文件哈希核验、原探针仅路径替换；`artifacts.sha256.json` 绑定新归档全部文件。
- 独立复评应使用冻结候选及 fixed-web，重跑两份原探针和新增永久测试，核对原值、归属、
  零写、显式清空和图文契约。独立通过前两项不关闭；冻结材料不等于 Git 提交。

历史失败和原独立 r1 均未覆盖；DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、T7/T9、D01、
高级恢复/新回收 REMAINDER_DEFERRED 不变。本轮无 Git 写入、真实部署或 cleanup/restore。
