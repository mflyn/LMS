# T5 本地合成工程验收材料

当前为本地合成工程提交验收材料；T5 总门禁 OPEN，关闭需用户批准。不是 Git 提交、服务器测试或部署授权。
范围是今日计划、顺序与估时；既有 T4 历史证据、DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、
D01/T2-G 及高级恢复/新回收的 REMAINDER_DEFERRED 保持不变。

## 候选和证据

候选为当前未提交工作区中 T5 相关文件；其他线程的 AI/K12 修改不属于 T5 功能范围。
逐文件候选与归档哈希见本目录 `candidate-manifest.json`、`artifacts.sha256.json`；
候选是未提交文件快照，不用历史 T4 SHA 冒充新代码。清单中的共享 AI/K12 文档只用于当前状态核验，
不代表这些无关改动由 T5 拥有或可一起提交。
日志、截图、探针、独立报告和固定构建已归档到本地 `release-gate-artifacts/t5-synthetic-2026-10-26/`。
本目录仅保留脱敏摘要与哈希索引，不包含真实家庭数据、凭据或作品。

## 实现与验收范围

- 孩子今日页选择重点、上下排序、可选估时、保存和刷新回看；其他待办包含旧 pending 任务并分页。
- 家长今日页共管和代录；从计划进入既有、按家庭/孩子校验的任务详情。输入者由服务器记录，重排不改估时归属。
- 请求保留原版本；未知结果通过重试/读取核对，冲突需显式采用最新计划，不自动覆盖或增加 operation 恢复协议。
- 历史日期只读、未来不支持；服务端和页面均检查家庭日期。失败不改变任务教学状态、作品、求助、清单和奖励。
- 正式 HTTP 与浏览器复用 `backend/tests/t2` 和 `tests/e2e/t2`，不是 mock 成功替代正式接口。

运行核心为真实 Gateway、user/progress 正式工厂、homework/resource enabled 正式装配；
analytics/notification 使用现有应用路由。数据库为临时 Mongo 副本集，存储为临时目录；
扫描为既有 trusted-local profile，不宣称 ClamAV 验收。新回收、restore 和高级恢复装配关闭，
保留正式启动所需专用凭据、索引、日志及上传保护。

## 历史失败必须保留

1. 后端和组件初始 RED，以及文档状态切换期间的检查器 RED。
2. Gateway 输入清洗 P2：非法数值可被改为 null、非法键被删除，修复需经过独立复评。
3. 前端 P2：跨午夜读取失败误启用旧日期写入；未知结果缺少与原请求内容的比较提示。
4. 首次构建的 ESLint 运算符括号错误；历史证据目录嵌套源码导致的工作区根 lint 错误。
5. 浏览器首次启动受 macOS sandbox 限制，尚未到业务断言。
6. 丢响应测试等待按钮出现而非请求结束，数据库断言过早；后续等待结果未知并断言实际丢弃 200 响应。
7. 全量浏览器期间重建同目录，旧求助用例读到缺失 index.html；后续固定独立构建副本，不修改旧用例断言。
8. 家庭后端全量在文档与检查器状态切换期间启动，不能将其中失败替换为定向通过。
9. 独立真实索引构建探针发现：尚未完成的 unique 索引允许两个首次空计划各自保存 version 1。
10. 独立限流探针发现：清洗前直接返回错误使非法正文不计入默认限流。
11. 新增真实审核浏览器用例曾因 label 同时匹配 section 与 textarea 出现 4 pass/1 fail；
    仅收窄为 textbox 定位器，业务断言未变，后续定向 5 pass、最终完整 34 pass。

## 需求到证据映射

以下是现有永久用例的定位，不是以文件存在代替执行通过。最终运行及候选哈希需与本表一起核验。

| 验收条件 | 永久证据入口及检查内容 |
| --- | --- |
| 空 GET、作用域唯一、首次创建和更新 CAS | `backend/services/homework-service/__tests__/models/DailyLearningPlan.test.js`；`__tests__/services/dailyLearningPlan.test.js`：0/20/21、重复 task、竞争、索引前提、失败回滚 |
| 日期、任务归属和状态 | 同一 service suite：家庭时区、非法/历史/未来日期、事务跨午夜、跨日同任务、三个孩子、终态竞争及删除引用；失败前后任务快照对比 |
| 实际输入者和完整替换 | 同一 service suite：孩子填写、家长重排/改分钟、空值与旧 unknown、空 items、伪造 actor/scope、CAS 失败审计 |
| 原始输入、认证和限流 | `backend/gateway/__tests__/dailyLearningPlanRoutes.test.js` 加 service suite 的真实 Gateway 请求：非法键/数值不能经清洗变成合法命令，错误不能绕过限流，原 children 路由保留 |
| 选择/排序/分页/草稿/午夜 | `frontend/web/src/__tests__/shared/DailyLearningPlanPanel.test.js`：跨页保留、旧 pending 可找到、20 项、显式采用、切日失败和轮询前提交 |
| 身份隔离与迟到响应 | 同一组件 suite 与 `shared/dailyLearningPlanApi.test.js`：退出、切孩子、跨标签 storage、旧身份迟到成功/401/403、不注销新身份 |
| 家长详情导航 | `family/DailyPlanTaskNavigation.test.js` 与真实浏览器：taskId 与选中 childId 绑定，沿既有详情审核，不用 mock 对话框证明版本保护 |
| 正式 HTTP 和既有业务不变 | `backend/tests/t2/dailyLearningPlan.integration.test.js`：真实 Gateway、正式工厂、丢弃已提交响应、原版本重试、共管和家庭隔离、作品/求助/账本快照 |
| 用户可见闭环 | `tests/e2e/t2/dailyLearningPlan.spec.js`：一年级/四年级安排、家长代录、重登、丢响应、共管冲突、真实审核版本竞争、confirmed 回看；390/768/1280 截图 |

## 验证方式与证据归属

- 开发运行：`npm run test:family-regression`、`npm run test:t2:integration`、`npm run test:t2:e2e`、
  `CI=true npm run test:ci --prefix frontend/web -- --runInBand`、`CI=true npm run build --prefix frontend/web`。
- 文档和静态检查：`npm run docs:family:check`、文档状态 Jest suite、`git diff --check`、`npm run lint`。
  工作区历史归档含旧源码，直接根 lint 的历史失败保留；完整 lint 另在通过 git 文件清单复制的隔离候选运行，
  不改规则、不删除归档、不以定向 lint 冒充完整检查。复制清单包括当前未提交的非忽略文件，依赖复用本机安装。
- 浏览器使用固定构建副本 `/tmp/lms-t5-reviewed-build-20261026`；不能边服务边重建该目录。
  正式链路与全量回归的重叠用例不累计为新增覆盖。
- 独立前端评审由 Meitner 执行，后端由 Dirac 执行；评审者实际运行和只阅读开发日志的行为必须分开记录。
  主线程生成的最终汇总不是另一份独立 QA。两项后端 P2 已由 Dirac 重跑原探针和永久反例确认修复，
  详见本地归档 `independent/backend/report.md`，该结论不关闭 T5 总门禁。

### 最终候选运行（2026-10-27）

原始日志在本地归档的 `logs/` 下；同名日志摘要如下。这些结果支持本地工程提交验收，
不等于用户验收或总门禁关闭，不能改写先前失败记录。

| 执行来源 | 命令/范围 | 结果 | 日志 |
| --- | --- | --- | --- |
| 开发 | npm run test:family-regression | 149 suites / 4290 passed | `t5-backend-review-family-final.log` |
| 开发 | 前端 test:ci --runInBand | 49 suites / 624 passed | `t5-frontend-final.log` |
| 开发 | CI=true 前端 build | exit 0；保留旧 Browserslist 数据提示 | `t5-build-review.log` |
| 开发 | npm run test:t2:integration | 4 suites / 22 passed | `t5-formal-http-final-candidate.log` |
| 开发 | npm run test:t2:e2e，固定构建，全 T2-T5 | 34 passed，exit 0 | `t5-browser-final-backend.log` |
| 开发 | npm run lint，完整文件清单隔离副本 | exit 0 | `t5-final-clean-candidate-lint.log` |
| 开发 | 文档状态 Jest suite | 162 passed | `t5-docs-final-candidate.log` |
| 独立 Meitner | 10 个相关前端 suite，包括独立 probe | 121 passed，exit 0，前后哈希不变 | `t5-independent-frontend-final.log` |
| 独立 Dirac | 后端永久反例、正式 T5 HTTP、共享限流、时区定向 | 6 suites / 87 passed；时区 9 项按名称过滤 | `independent/backend/results.json`，路径相对归档根 |

Meitner 的最终候选复评包含 32 项永久 T5 测试、14 项独立 probe、75 项既有回归；
其报告和哈希元数据位于本地归档 `independent/t5-independent-frontend-report.md` 及
`independent/t5-independent-frontend-hashes.json`。两项前端 P2 经独立反例确认修复，
本次补跑也覆盖最终格式修订后的 API 测试。该评审没有独立执行浏览器或完整后端。
表中 4 suites/22 项完整正式 HTTP 和 34 项浏览器由开发侧执行；Dirac 独立运行的是
其中 T5 HTTP 1 suite/4 项。前述 33/5 和当前 34 为重叠运行，不叠加计数。

Dirac 另独立执行原索引构建探针及原 Gateway 限流序列：暂停真实索引构建时两次首次写入均
503、没有进入 Plan.create、同 scope/date 新记录为 0，释放后索引构建成功；非法正文首次
400 后持续 429，均计入限流，独立正常请求及非法 JWT 对照仍分别为 200/429 和 401/429。
永久反例还验证索引构建结束后的合法写入及 prepareUnique 拒绝。后端独立候选 315 文件，
运行前后摘要均为 `8711d479567f50fa4c1630d65f2aa01b47b34227528c67495a225c1801632f0e`；
只覆盖报告列明的后端/API 范围，不冒充全仓候选。前后端独立运行使用本机 Node 26.9.0，
开发主要回归使用本机 Node 22；均是 Darwin 合成证据，不是 Ubuntu 或 iPad 验收。

## 风险、回退与人工待办

未访问真实环境，无真实数据需要回退。代码回退应整体移除 T5 页面/精确路由装配，不改变其他 children 路由；
已有日计划记录保留，不删除集合或用户数据。正式启用前必须核验唯一索引和副本集前提，不能通过请求自动修复索引。

真机 DEVICE_PENDING：一年级和四年级分别检查触控排序、数字输入/留空、页面滚动与软键盘；
切换孩子/家长、断网后重试、家庭跨午夜、重登回看及长标题不遮挡。
浏览器 390/768/1280 宽度截图不是 iPad 真机证明。服务器限额、真实备份恢复及发布回滚属于 T8，需另行授权。

工程材料齐备不意味着 T7 综合验收、T9 家庭价值验证或四周学习效果通过。
状态以 [Gate §25](../../family-self-directed-learning-mvp-gate.md#25-t5-今日计划开发授权与阶段记录2026-10-26)、
[T5 实施计划](../../../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md#t5今日计划任务顺序与孩子估时)
和 [需求追踪](../../family-growth-requirement-traceability.md) 为准。
