# 家庭自主学习 MVP 开发计划

> **本批交付权限（2026-11-08）：** 用户已授权已验收MVP局部修订的专用分支、Draft PR与CI，详见[交付范围](../../development/evidence/mvp-closeout-20261108/public-delivery.md)。不合并、不部署、不调用模型或操作服务器；下方原禁止Git描述保留历史身份，不扩大WP1/T8范围。

> **2026-11-08 最新开发优先级：先完成MVP。** 以[联合验收清单§0](../../development/t4-t8-joint-acceptance.md#0-mvp-优先与后置范围2026-11-08)为当前范围入口：复用T1–T7，只修影响学习闭环的实际缺陷；WP1底层执行器剩余范围REMAINDER_DEFERRED / NOT_COMPLETE，不再阻塞产品开发。真实恢复/回滚与真机等启用条件不取消，T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED和历史/后置状态保持。本次不授权服务器、模型、Git提交推送或部署；下方历史“继续实现”不构成自动恢复工具开发的指令。

> **2026-11-04 当前AI-2交付：** PR #38已按授权以merge commit `a4f051e26f3514da051910a3495e11b149a32c45`合入main，
> 合并后CI 41801096578成功，见[合并后记录](../../development/evidence/ai2-5-20261103/postmerge.md)。默认关闭、限定合成工程；
> 下方分批Git限制是原快照。本轮仅本地收口T8与文档，不新增提交推送/模型调用/部署授权，不关闭T4/T8/AI-1。

> AI2-5 / AI-2最新批准：2026-11-04用户批准关闭AI2-5汇总及AI-2限定合成工程总门禁，CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY，见[关闭批准记录](../../development/evidence/ai2-5-20261103/closure-readiness.md)。保留31项核心覆盖、冻结候选、分层回归和历史失败；后续真机、Git交付、真实启用须单独授权，不自动启动其他开发，不授权模型/Git/部署。下方实施进度保留历史身份。

> 状态：执行中（T0 已完成，T1 后端工程已关闭，T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5 合成工程已关闭，T6 合成工程已关闭，T7 合成工程已关闭，T8 本地准备，T9 待执行）；2026-11-03 当前交付：T8 限定本地交付和 AI-1 默认关闭合成工程已按授权合入 main，双仓 merge SHA、合并后 CI 及保留边界见 Gate §29.34。T5/T6/T7 已交付 main；T7 脱敏交付见 §27.45，限定合成工程总门禁 CLOSED（§27.42）。全部历史失败保留，不以最新 CI 改写原失败快照。T4/T8/AI-1 总门禁仍 OPEN，DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项非阻断补测、T8_PENDING / NOT_AUTHORIZED 和 REMAINDER_DEFERRED 保留；未部署、未启用真实 AI 发送。
> 日期：2026-10-21
> 执行约定：按仓库 AGENTS.md 逐包实施、验证和交付；不要求自动创建工作树、启动子智能体、提交或推送。
> T0 契约基线及后续评审已获用户确认；R3-LEARNING 与门禁 P2 已关闭，T1 按用户指令开始分阶段实施，证据见增量 Gate §17–§18。

**目标：** 在现有家庭成长软件上补齐六个自主学习工作包，让两个一年级孩子和一个四年级孩子
在家庭局域网中跑通数学任务、作品提交、求助、自检、人工订正、延迟复习和周复盘。

**架构：** 复用 Gateway、现有业务服务、React Web、MongoDB 副本集和私有媒体。
任务相关能力归 `homework-service`；错题归 `analytics-service`；知识点与成长记录归
`progress-service`；媒体继续通过现有引用协议管理。不新增常驻微服务。

**技术栈：** Node.js 22、Express、Mongoose/MongoDB、React 18、Jest、Playwright、Docker Compose。
版本以执行时仓库 lockfile 和镜像为准；不为本轮功能顺带升级技术栈。

**依据：** [系统设计](../../architecture/family-self-directed-learning-system-design.md)，特别是第 3.3、
5.3、14、15.2、15.3 节；[理论与家庭运行方案](../../research/family-self-directed-learning-theory-and-program.md)；
[当前 API](../../api/family-learning-tracker-api.md)；[开发测试入口](../../development/README.md)。

## 1. 本轮边界与交付判定

当前家庭成长 MVP 是复用基础，本轮称为“自主学习 MVP 增量”。不重新编号或宣称已完成现有
38 项之外的需求；下列 SL 编号只用于本计划追踪，正式需求登记在 T0 完成。

| 计划需求 | 当前缺口 | 本轮交付 | 验证归属 |
| --- | --- | --- | --- |
| SL-01 | 完成接口没有作品字段，媒体引用没有完成作品映射 | 图片上传、稳定引用、家长查看、孩子回看 | T1、T2、T7 |
| SL-02 | needsHelp 随提交完成而保存 | pending 时独立求助、家长处理 | T3、T7 |
| SL-03 | 自检只有描述文字，孩子页面字段密集 | 短清单、版本校验、基本分龄操作 | T4、T7 |
| SL-04 | 孩子不能保存今日顺序和自己的估时 | DailyLearningPlan 与简易排序 | T5、T7 |
| SL-05 | 任务、错题、订正之间靠人工寻找 | 最小来源关联与操作入口、复用复习日期 | T6、T7 |
| SL-06 | 周复盘入口不足 | 复用成长记录和周报，补导航与家庭指南 | T7、T9 |
| SL-07 | 仓库配置不代表家庭环境已验收 | 版本、权限、iPad、备份恢复、回滚证据 | T8 |

两类完成必须分开记录：

- 工程完成：T0–T8 的代码、回归、发布和目标机验收有实际证据；
- 家庭验证完成：T9 真实运行四周并覆盖至少一个数学单元，按 Gate §14 分别判定每孩子及总体结果；
  仅 PASS 可关闭价值验收，PARTIAL/FAIL 保留限制与下一步，不以“已经用过”代替。

不能用自动化测试代替四周使用，也不能因家庭验证尚未到期而提前宣称通过。

本轮只收图片完成作品，最多 10 张，沿用每张 10 MiB、JPEG/PNG/WebP 及服务端规范化规则。
原有任务材料和错题 PDF 保持既有能力。普通作品 PDF、OCR、语音、画板、多轮作品版本库、
结构化周反思、S0–S4 统计、任务模板、复习算法、AI、K12 和长期项目均不进入本轮。

## 2. 文件与服务落点

以下“现有”路径已在规划时核对；新增路径的实际进度以各任务执行记录为准，不代表整包完成。

| 领域 | 现有主要路径 | 本轮责任 |
| --- | --- | --- |
| 任务 | `backend/services/homework-service/models/GrowthTask.js`、`routes/growthTasks.js` | 完成作品、版本、清单、求助、来源引用 |
| 媒体恢复 | `backend/services/homework-service/services/growthTaskAttachmentMediaService.js` | 参考既有恢复模式；保留任务材料绑定行为 |
| 媒体服务 | `backend/services/resource-service/models/MediaAsset.js`、`models/MediaReference.js`、`services/mediaReferenceService.js` | 完成字段白名单、purpose、scope、保留和释放 |
| 业务注册 | `backend/services/homework-service/server.js`、`backend/gateway/server.js` | 新路由注册和准确代理 |
| 家长端 | `frontend/web/src/pages/family/TasksPage.js`、`TodayPage.js`、`MistakesPage.js` | 查看作品、求助处理、订正入口 |
| 孩子端 | `frontend/web/src/pages/child/ChildTodayPage.js`、`ChildTaskPage.js` | 完成/回看、独立求助、清单、日计划 |
| 前端 API | `frontend/web/src/services/familyApi.js`、`childApi.js` | 字段白名单、版本、operationId 和错误处理 |
| 错题 | `backend/services/analytics-service/models/FamilyMistake.js`、`routes/familyMistakes.js` | 源任务引用、订正操作连接 |
| 成长与周报 | `frontend/web/src/pages/family/GrowthLogsPage.js`、`ReportsPage.js`；`backend/services/progress-service/routes/growthLogs.js` | 复用 childReflection 和现有家长反馈 |
| 既有提醒 | `backend/services/notification-service/services/familyReminderService.js` | 继续使用错题复习日期；本轮不增加推送进程 |
| 集成与浏览器 | `backend/tests/task11/`、`tests/e2e/task11/` | 把新路径纳入当前自动化入口 |
| 部署 | `docker-compose.ubuntu.yml`、`docs/deployment/local-ubuntu-deployment.md` | 家庭发布、恢复和回滚 |

拟新增的业务文件控制在确有独立责任的范围：

- `backend/services/homework-service/services/growthTaskCompletionService.js`：完成写入、并发和确认协调；
- `backend/services/homework-service/services/growthTaskCompletionMediaService.js`：完成图片引用及恢复；
- `backend/services/homework-service/models/GrowthTaskCompletionOperation.js`：最小完成命令幂等记录；
- `backend/services/resource-service/models/MediaReferenceOperation.js`：新完成协议的远程终态记录；
- `backend/services/resource-service/services/mediaReferenceOperationService.js`：新完成协议的事务与租约处理；
- `backend/services/homework-service/services/growthTaskHelpService.js`：独立求助的原子更新；
- `backend/services/homework-service/models/DailyLearningPlan.js`、`routes/dailyLearningPlans.js`：日计划；
- `backend/services/homework-service/services/dailyLearningPlanService.js`：范围、日期与并发校验。

新增服务文件可按实际责任合并，但不可将多个新功能全部堆进已有路由文件。完成命令记录
只保存最少请求摘要、目标和恢复状态，不保存作品正文或形成孩子提交版本库，不复用 AI 子域
那套复杂状态机。

## 3. 顺序、依赖和里程碑

```mermaid
flowchart LR
  T0["T0 基线与契约"] --> T1["T1 完成作品后端"]
  T1 --> T2["T2 作品前端"]
  T2 --> T3["T3 独立求助"]
  T3 --> T4["T4 清单与分龄"]
  T4 --> T5["T5 日计划"]
  T5 --> T6["T6 订正连接"]
  T6 --> T7["T7 周复盘与回归"]
  T7 --> T8["T8 家庭发布验收"]
  T8 --> T9["T9 四周家庭验证"]
  T0 -. "可提前核查部署与备份条件" .-> T8
```

默认顺序实施，降低同一任务模型和页面的并发修改。T8 的只读环境清点、备份准备可提前；
真实发布和数据恢复按严格模式实施，不因计划存在自动取得部署授权。

| 里程碑 | 包含 | 可演示结果 |
| --- | --- | --- |
| M0 | T0 | 范围、接口、基线和迁移策略可审查 |
| M1 | T1–T2 | 一个孩子在 iPad 交图片作业，家长审核，孩子回看 |
| M2 | T3–T4 | 没做完能求助，孩子能按短清单自检 |
| M3 | T5–T6 | 孩子安排今天，一道错题连接到订正与复习 |
| M4 | T7–T8 | 完整闭环通过回归，家庭主机可恢复地运行 |
| M5 | T9 | 按 Gate §14 完成三份独立价值结论；总体 PASS 才关闭，否则修正/暂停/延长 |

不承诺日历开发工期：先完成 M1 后根据真实媒体/并发复杂度重新估算后续。四周家庭使用是
观察时长，不计为四周连续开发，期间只处理影响使用的问题。

## 4. 横向约束与重点反例

- 家长身份来自服务端验证，孩子只能读写本人资源；第二家长继续沿用现有治理规则。
- 新模型的索引包含 familyId/childId；所有引用逐项校验家庭与孩子，不相信前端传来的 scope。
- 父母代录保留真实 actor 和 subject child，时间取服务端，不接受伪造审计字段。
- 未确认完成可更新；已确认完成内容冻结。确认、完成更新和取消/归档必须用原子条件写入。
- 不改变每任务首次确认一颗星的现行规则；求助、排序、清单不额外发星。
- 页面保留必要的请求重试状态；不建设 IndexedDB 离线同步或自动后台提交。
- 老任务无新增字段时可以正常读取；新旧服务混合运行不是默认安全状态，发布兼容策略见 T0/T8。
- 准备好的媒体租约、业务待恢复状态和已提交引用的含义沿用现有协议；不得把 uploaded 当 bound。

| 最容易漏掉的情况 | 预期 | 所属任务 |
| --- | --- | --- |
| 两位家长/孩子同时改作品与确认 | 确认自己看过的版本；落败请求冲突，不覆盖确认 | T1 |
| 超时重试发生在确认之后 | 重新授权后重放已提交命令，不重复写入；新命令拒绝修改 | T1 |
| 跨过家庭当地午夜才保存计划 | 历史计划只读，返回明确冲突；旧任务仍可从任务列表找到 | T5 |
| 家长处理求助时孩子又提交新卡点 | 旧处理操作不能关闭新求助 | T3 |
| 完成图片被直接当作错题答案 ID | purpose 校验拒绝；提示重新上传为错题答案 | T6 |

## 5. 执行任务

### T0：基线、正式增量契约与迁移策略

依赖：无。模式：标准；涉及权限/迁移决策时严格。产物：后续各包可据以实现的契约和基线记录。

修改文档：`docs/api/family-learning-tracker-api.md`、`docs/product/family-learning-tracker.md`、
`docs/architecture/family-learning-tracker-architecture.md`、
`docs/development/family-growth-requirement-traceability.md`；新增
`docs/development/family-self-directed-learning-mvp-gate.md` 保存增量状态与证据。
新增内容必须标为 planned，历史实现和 38 项基线不被冒充覆盖。确有既有决策变化时才补 ADR。

- [x] 检查工作区、Node/依赖、现有家庭回归；记录既有失败与新增失败，不能用本轮修改掩盖旧失败。
- [x] 在 Gate 登记 SL-01–07 与 T0–T9，所有功能初始为未实现，记录执行代码版本。
- [x] 固定完成命令 `operationId + expectedCompletionVersion`、确认命令版本和媒体恢复规则。
- [x] 固定媒体稳定业务拒绝的失败收敛：不改变稳定作品、不递增版本；未知结果继续使用原命令恢复，
  修正后的请求使用新的 `operationId`。
- [x] 固定独立求助字段白名单、版本；清单上限与旧任务缺省；日计划创建和并发语义。
- [x] 对任务内版本/缺省字段采用按需原子初始化；日计划/命令记录建索引。只有实际需要批量
  修复才编写迁移脚本，禁止无必要地重写全部任务。
- [x] 决定旧客户端如何兼容：新记录或作品确认必须提供版本；旧客户端不能静默跳过版本门禁。
  协调前后端发布并提示刷新，旧数据可读不等于所有旧写客户端仍可操作。
- [x] 检查文档 Gate 是否覆盖新草案/计划，补充到独立拟议文档检查范围，不把它们计入已实现。

验收：契约包含首次调用、并发、重试、授权失败、旧数据行为和回滚限制；其他包不再自行发明
不同版本/错误含义。基线结果是真实执行记录，不复用历史通过数量。

<a id="t1-acceptance"></a>

### T1：完成作品持久化、幂等与审核并发

依赖：T0。模式：严格。对应工作包 1 后端。

#### 当前收尾入口（2026-10-23）

[T1 验收归并表](../../development/family-self-directed-learning-t1-acceptance-reconciliation.md)
逐项对应原 35 个未勾选条目（7 条历史汇总/门禁、28 条原始要求）。这些条目保留原文，
不等于 35 项未开发功能；独立实现通过不等于正式入口启用。第 1–26 批历史记录不再重复排期。

验收清单归并已完成；R1–R4 及 T1 后端工程总门禁均经用户批准关闭，详见归并表 §4/§6.4 及 Gate §18.40：

- [x] R1 稳定性收口：2026-10-23 用户复审通过，R1 及监听失败清理 P2 CLOSED。两轮冻结版本和复审重跑各 109/109 套件、2103/2103 用例，保留全部历史失败及归因限制，详见 Gate §18.31。
- [x] R2 启用条件：2026-10-23 用户复审批准，R2 及 fsync P2 CLOSED。全量 112/112 套件、2154/2154 用例，复审 5 套件/60 用例及六种变异有效；原用例和历史失败保留，见 Gate §18.32.2 及[运维准备](../../deployment/completion-operations.md)。不授权生产接入。
- [x] R3 正式应用装配：CLOSED；2026-10-23 用户批准关闭第四步及控制键 P2（Gate §18.37.2），四步范围完成。以下保留各步历史审查记录；仅合成验证，不扩大前端、不部署真实环境，后端装配与真实家庭启用分别验收。
  第三步复审历史：材料恢复绑定原验证快照，补齐替代意图 B 为 pending/稳定两类交错及稳定编辑入口的同类保护；
  原旧 pending 接续、精确代次和最终 CAS 保留，证据见 Gate §18.36.1。修订待复审，R3/T1 不自动关闭。
  后续复审的空更新最终重读遗漏已补齐原快照校验，增加 B pending/stable 永久负向用例及无竞争零副作用用例；
  验证与评审记录续记 Gate §18.36.2，不覆盖历史证据，不自行关闭 P2 或第三步。
  2026-10-23 用户批准关闭第三步与材料快照/空更新 P2，见 Gate §18.36.3；继续第四步正式链路与配置准备（§18.37），R3/R4/T1 不提前关闭。
  第四步使用实际 Gateway 和三服务正式工厂，补升级拒绝、身份/家庭边界、内部凭据剥除、公开及远程丢响应恢复、
  只读无副作用、精确代次及首次确认/删除审计；实际 startServer 验证写入前撤回、写入后拒绝 legacy。
  家庭/Ubuntu Compose 默认 legacy，停写与存储确认默认 false，resource 单独挂 journal；六组合成 config 检查不运行部署。
  第四步复审 P2：两份环境模板的三个控制键各声明一次且解析后默认关闭；拒绝同值重复、冲突覆盖和顺序交换，保留密钥精确集合检查。
  已补永久负向用例、实际 Compose 渲染和逐项移除守卫的变异验证，证据见 Gate §18.37.1；修复待复审，不自行关闭 P2 或第四步。
- [x] R4 入口验收及 T1 关闭：CLOSED；用户已批准 T1 后端工程总门禁及 R4 汇总项（Gate §18.40）。G1/G2 和两项 P2 关闭记录保留；关闭索引见[归并表 §6](../../development/family-self-directed-learning-t1-acceptance-reconciliation.md#6-t1-总门禁关闭评审材料)。仅限既定合成验收，不代表真实环境启用。

G1/G2 原为既有契约证据缺口，现已补齐并关闭，不再作为待开发任务；两项 P2 测试保护经变异验证及用户复审关闭。
真实家庭发布/旧备份恢复属于 T8，前端属于 T2/T7；T3/T4 新写入口另验证与 T1 的互斥约束。
T1 后端工程总门禁 CLOSED；R4 汇总 CLOSED。原 35 条历史复选框保留，以归并表 §6.4 的分层关闭索引为准；该次关闭不授权真实数据操作、真实部署、前端扩展或 Git 发布，当时 T2–T9 未启动；后续 T2 授权见下节。

#### 历史分批记录

首批执行记录（2026-10-22，详见增量 Gate §18）：

- [x] 新增两端 operation 模型及唯一索引定义，不接入业务调用、不对真实库建索引。
- [x] 新增模型级测试并纳入家庭后端回归入口；覆盖同 UUID 不同 actor、持久化映射、严格字段及终态数据形状。
- [ ] 接入服务层事务/CAS、摘要生成与核验、远程终态/租约、隐私删除及本地恢复。
- [ ] 完成下列端到端验收；模型级约束不等于状态机或接口已完成。

第二批服务层执行记录（2026-10-22，详见增量 Gate §18.2）：

- [x] resource 独立 operation 服务实现 prepare/commit/abort/status，原子终态和请求路径租约终止。
- [x] 旧引用命令拒绝 completionMediaIds；旧过期删除与单媒体释放 helper 排除新协议引用。
- [x] 使用真实临时副本集测试并发首占位、终态竞争、回滚、结果丢失和时间边界。
- [x] 复审 P2：prepare/abort 在完整性查询后重新采样，响应在最终读取后重新计算过期；
  固化两个跨截止点负向用例及独立响应时钟用例，红绿与自审证据见增量 Gate §18.3。
- [ ] 接入隐私删除整组事务、精确删除凭证与保留清理后，才注册生产内部路由并同步公共 client。

本批只完成服务层子项；下列同时涉及 HTTP 凭据、公共 client、隐私删除或本地编排的整体条目仍不勾选。

第三批资源服务执行记录（2026-10-22，详见增量 Gate §18.4）：

- [x] P2 租约时钟复审获用户批准，记录 CLOSED，保留历次红绿与复审证据。
- [x] 独立 completionMediaPrivacyService：实时家庭/孩子授权、资产写屏障、PREPARED 整组终止、
  COMMITTED 版本 CAS 与精确释放凭证；首次删除事实不被重复请求覆盖。
- [x] 独立持久日志与 completionMediaCleanupService：30 天/活跃引用检查、保留凭证、文件/数据库失败重试。
- [x] 内部 status 返回精确 privacyDeletion；旧清理仅跳过新事务标记，不停止历史记录清理。
- [ ] 生产依赖注入、DELETE/status/abort 凭据路由、公共 client、homework 恢复和受保护日志介质验收。

上述服务层子项不等于下方 TC-SL-PRIVACY 的 HTTP/前端/跨服务端到端验收已完成，不提前勾选整体条目。

第四批公共 client 执行记录（2026-10-22，详见增量 Gate §18.5）：

- [x] 第三批隐私删除与保留清理复审获用户批准，记录 CLOSED；T1 仍 IN_PROGRESS。
- [x] 独立 completion client 工厂：prepare/commit/abort 与两种 status，显式映射 remoteOperationId。
- [x] 请求白名单、响应终态/租约/摘要/引用集合/精确凭证校验；不以裸错误响应作为终态证据。
- [x] 补齐协议负向测试、真实资源服务契约测试、旧 client 回归、生产入口隔离与自审。
  独立检查发现的稀疏数组缺口已按完整集合契约修复，两个负向用例先红后绿。
  最终全量家庭回归 88/88 套件、1174/1174 用例通过；较第三批增加 113 用例，原 1061 均保留。
- [x] 第四批公共 client 及稀疏数组问题复审获用户批准并 CLOSED，证据见 Gate §18.5。
- [x] 第五批精确代次 unbind 及 client：整组事务、旧代次保护、重试/回滚和凭证校验，见 Gate §18.6。
  开发、自审及独立只读检查完成，家庭回归 89/89 套件、1239/1239 用例通过，原 1174 均保留，新增 65。
- [x] 第五批用户复审与关闭，证据见 Gate §18.6；T1 整体仍 IN_PROGRESS，未获生产接入授权。
- [x] 第六批 homework 独立服务：本地占位、owner/阶段 CAS、远程映射持久化、发布和恢复；见 Gate §18.7。
- [x] 第六批最终回归与自审记录；独立检查的存在性探测、稳定错误码、清单大小写三项 P2 已修正，定向 83/83 通过。
  家庭回归 92/92 套件、1322/1322 用例通过，原 1239 均保留、新增 83，最终证据见 Gate §18.7。
- [x] 第六批用户复审与三项 P2 关闭，复审 92/92 套件、1322/1322 用例通过，见 Gate §18.7。
- [x] 第七批独立确认服务：作品版本/owner CAS、历史无媒体版本 0、既有发星客户端及恢复，见 Gate §18.8。
- [x] 第七批测试与自审：确认 33/33，含隔离定向 35/35；家庭回归 93/93 套件、1355/1355 用例通过，
  原 1322 均保留。独立只读审查无待修订项，18 项纯内存检查通过，运行证据见 Gate §18.8。
- [x] 第七批用户复审与关闭，见 Gate §18.8；保留 STAB-T1-MEDIA-401 为 OPEN，不以重跑通过关闭。
- [x] 第八批独立任务编辑、取消/归档事务与 owner CAS；不含材料附件、清单或生产接入，见 Gate §18.9。
- [x] 第八批测试与自审：mutation 50/50，定向 85/85，最终家庭回归 94/94 套件、1405/1405 用例通过。
  自审的 schema/锁优先级缺口按两个负向用例先红后绿修复，独立只读审查无剩余缺陷，证据见 Gate §18.9。
- [x] 第八批用户复审与关闭，见 Gate §18.10；生产路由及旧写入口统一锁接入仍须单独确认。
- [x] 第八批复审 P2 修订/自审：显式转换后校验，补齐全部字段 CastError、鉴权优先、null/空编辑及最终 CAS 回归，见 Gate §18.10。
  4 个负向场景先红后绿；mutation 61/61，定向 96/96，全量 94/94 套件、1416/1416 用例通过。
  保留 STAB-T1-MEDIA-401 和 STAB-T1-GROWTHLOGS-401 为 OPEN，不推定同源或以重跑成功关闭。
- [x] 第八批 CastError 挂起 P2 用户批准 CLOSED；复审 94/94 套件、1416/1416 用例通过，见 Gate §18.10。
- [x] 第九批独立内部 router 工厂及实际 HTTP/client/homework 组合验收，见 Gate §18.11。
  已有内存传输组合覆盖保留；新增 loopback HTTP、凭据拒绝、错误契约、丢响应/租约/精确代次恢复。
  不修改生产 server/旧路由；材料互斥、生产分流及完整端到端门禁继续待办。
- [x] 第九批测试与自审：新增 HTTP 39/39、含生产隔离定向 48/48；全量 95/95 套件、1455/1455 用例通过。
  原 1416 用例全部保留；两项偶发 401 继续 OPEN，自审未发现本批新增可复现缺陷。
- [x] 第九批用户复审与关闭；复审 95/95 套件、1455/1455 用例，见 Gate §18.11。
- [x] 第十批材料编排显式启用统一互斥、最终版本 CAS 与旧新协议分流工厂，见 Gate §18.12；生产装配不变。
  占位持久化 mediaCompletionFence，防止重启后旧意图重基；历史 pending 仅版本 0 可 CAS 接续，
  材料 owner/阶段、精确代次与新 operation 协议隔离，无法证明的意图保留 pending。
- [x] 第十批双向竞争/恢复/协议兼容测试、全量门禁及自审：定向 190/190，全量 97/97 套件、1522/1522 用例。
  原 1455 用例保留，仅新增 67；自审发现的重启重基缺口已由两个先红后绿负向用例修复，见 Gate §18.12。
  两项偶发 401 继续 OPEN，不以本轮通过关闭；生产接入不在本批授权内。
- [ ] 第十批整体门禁关闭（材料实现及 P2 已获复审，稳定性/整体门禁仍保留）；生产接入仍须单独确认。
- [x] 第十批复审 P2 定位：远程 commit 已成功但响应丢失，旧 prepare 返回 bound 被编排误拒绝；
  复审 97/97 套件、1522/1522 全绿仍漏检，三类真实 HTTP 故障注入复现，见 Gate §18.13。
- [x] 创建/修改统一接受完整 prepared/bound prepare 重放，继续原 operation 的幂等 commit 与最终 CAS；
  不改变 commit/unbind 的严格状态要求，不接入生产路由。
- [x] P2 三类真实提交后丢响应回归、错误集合/状态与最终 CAS 负向验证及自审：定向 5/5 套件、224/224 用例。
  新增 34 用例，原 1522 用例保留；全量已执行，96/97 套件、1555/1556 用例通过，见 Gate §18.13。
- [ ] 全量门禁稳定性核查：growthTasks 取消/归档用例报 socket hang up，独立套件诊断 28/28 通过，
  根因未确认；保留原全量失败，不以诊断通过覆盖，不宣称全量门禁全绿。
- [x] 第十批 P2 用户复审与关闭，见 Gate §18.13；不等于全量门禁关闭。
  socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 保持 OPEN。
- [x] 第十一批独立完成/确认 HTTP router：真实网关认证、现有服务授权/事务及公共错误契约；
  仅测试 app 挂载，不修改生产装配；不新增 recover 端点，见 Gate §18.14。
- [x] 第十一批 HTTP 权限、请求/响应、丢响应恢复及版本确认组合测试和自审，见 Gate §18.14；
  新增 39 用例，定向 48/48，全量 98/98 套件、1595/1595 用例，原 1556 保留。
  独立只读检查后强化终态/绑定/审计断言，最终定向 48/48；全量运行与最终测试补强时间边界见 Gate。
  GET/列表、材料写入、隐私 DELETE 与生产全写入口切换仍待后续批次，不提前关闭 T1。
- [x] 第十一批用户复审与关闭，复审 5/5 套件、120/120 用例，见 Gate §18.14；
  三项稳定性风险、全量门禁及生产接入仍保留。
- [x] 第十二批独立完成作品隐私 DELETE HTTP：真实身份认证、现有整组事务/精确删除凭证/持久日志；
  仅测试 app 挂载，生产 server/Gateway/旧路由不变，见 Gate §18.15。
- [x] 第十二批授权、删除后禁读、公开丢响应/日志失败重试、与完成恢复组合测试及自审。
  定向 4/4 套件、65/65 用例；全量 99/99 套件、1622/1622 用例，原 1595 保留、新增 27。
  独立只读审查未发现新增可确认缺陷；故障注入及未接入生产的证据边界见 Gate §18.15。
- [x] 第十二批用户复审与关闭，7/7 套件、321/321 用例，见 Gate §18.15；三项稳定性问题保持 OPEN。
- [x] 第十三批独立详情/列表只读服务及 HTTP：公开投影、实时家庭授权、版本 0 兼容、分页/家庭时区；
  GET 不触发完成或材料恢复，不挂载生产路由，见 Gate §18.16。
- [x] 第十三批权限、公开投影、待恢复状态、无副作用测试及自审，定向 4/4 套件、112/112 用例；
  全量 100/100 套件、1660/1660 用例，原 1622 保留、新增 38；独立只读审查未发现新增可确认缺陷。
  并发快照及合成媒体适配器的验证边界见 Gate §18.16，不作为生产链路验收。
- [x] 第十三批用户复审与关闭，6/6 套件、178/178 用例，见 Gate §18.16；三项稳定性问题继续保留。
- [x] 第十四批真实发星 HTTP 组合测试：独立确认入口到既有 progress 内部路由/真实账本，
  覆盖未知结果、幂等、版本拒绝、共管接续和首次审计；不接入生产，见 Gate §18.17。
- [x] 第十四批相关回归及自审：新增 25 用例，定向 5/5 套件、76/76 通过；独立只读审查未发现新增可确认缺陷。
- [x] 第十四批用户复审与关闭：7/7 套件、121/121 用例，见 Gate §18.17；仅关闭该批评审。
- [ ] 第十四批全量稳定性门禁：全量已执行，100/101 套件、1684/1685 用例通过；
  knowledgePoints TC-T5-POINT-008 出现 socket hang up，独立诊断 9/9 通过但根因未确认。
  原 1660 用例保留、新增 25，失败证据见 Gate §18.17；三项稳定性问题、全量门禁和 T1 不关闭。
- [x] 第十五批完成图片、版本读取、确认与真实发星三服务 HTTP 组合，见 Gate §18.18；
  复用独立工厂和既有账本，不接入生产，补媒体未知结果/清理与确认阻断、幂等及共管审计证据。
- [x] 第十五批定向测试：新增 19 用例，6/6 套件、130/130 用例；纯删除测试序列预期修正见 Gate §18.18。
- [x] 第十五批家庭回归及自审：独立检查发现混合换图缺少资源端保留引用断言，已补齐并用临时
  故障变异验证其有效；最终 102/102 套件、1704/1704 用例，原 1685 保留，见 Gate §18.18。
- [x] 第十五批及测试保护 P2 用户复审与关闭：9/9 套件、350/350 用例，见 Gate §18.18；
  三项稳定性问题和全量稳定性门禁继续保留，不以本轮全绿关闭 T1。
- [x] 第十六批独立任务编辑/取消归档 HTTP 工厂，复用第八批事务服务，不启用材料/清单编辑；见 Gate §18.19。
- [x] 第十六批定向鉴权、互斥、丢响应/事务恢复与审计回归：新增 44 用例，5/5 套件、133/133 通过。
- [x] 第十六批家庭回归及自审：103/103 套件、1748/1748 用例；独立检查发现多字段转换测试
  被白名单提前拒绝，已修正夹具并补真实 cast 路径断言，补强后定向 133/133，时间边界见 Gate §18.19。
- [x] 第十六批及多字段转换测试保护 P2 用户复审与关闭：6/6 套件、166/166 用例，见 Gate §18.19；
  生产全写入口仍不切换，三项稳定性风险继续保留。
- [x] 第十七批带完成图片的任务编辑/取消归档三服务组合，见 Gate §18.20；仅测试 app 挂载独立 mutation router。
- [x] 第十七批媒体恢复互斥、精确代次/完整引用保留、归档丢响应与共管发星审计测试及自审。
  审计断言补强后最终全量 103/103 套件、1761/1761 用例，零跳过，见 Gate §18.20。
- [x] 第十七批及审计测试 P2 用户复审与关闭；不关闭全量稳定性门禁，不接入生产。
- [x] 第十八批 homework 自有 operation 集合的只读启用前预检：实际索引、事务能力、映射及冲突检查，见 Gate §18.21。
- [x] 第十八批真实临时索引/历史数据负向测试、隔离与回归、自审；不自动修复或挂载生产启动。
  构建中索引、prepareUnique 和尾随换行三项审查发现已按真实负向测试修订；定向 172/172，
  最终全量 104/104 套件、1814/1814 用例，原 1761 保留、新增 53，见 Gate §18.21。
- [x] 第十八批及三项审查修订用户复审与关闭；复审六套件 172/172，见 Gate §18.21。
- [x] 第十九批 resource operation 账本独立只读预检、真实索引/坏数据负向测试及自审，见 Gate §18.22。
  BSON 身份、账本主键、默认 collation 与冷加载保护修订后定向 269/269；最终全量
  105/105 套件、1895/1895 用例，原 1814 保留、新增 81，不接入生产。
- [x] 第十九批及审查修订用户复审与关闭：七套件 269/269，见 Gate §18.22。
- [x] 第二十批隐私删除证据跨集合只读预检、负向/真实删除清理测试及自审，见 Gate §18.23。
  反向证据 P2、清理后跨代次凭证冲突 P1 与真实组合测试缺口已修订；定向 320/320，
  最终全量 106/106 套件、1979/1979 用例，原 1895 保留、新增 84，不接入生产。
- [x] 第二十批及 P1/P2、相关测试缺口用户复审关闭：六套件 320/320，见 Gate §18.23。
- [x] 第二十一批完成作品引用只读一致性预检、完整集合/重绑/清理负向及组合测试、自审，见 Gate §18.24。
  独立审查未发现功能缺陷；墓碑存在但媒体未清理的测试保护缺口已补强并经变异验证。
  最终定向 382/382；全量 107/107 套件、2041/2041 用例，原 1979 保留、新增 62，不接入生产。
- [x] 第二十一批及媒体尚存清理门槛测试保护缺口用户复审关闭：七套件 382/382，见 Gate §18.24。
- [x] 第二十二批删除日志持久化故障、并发发布及重启重试验证，补齐真实 journal 与删除/清理组合测试，见 Gate §18.25。
  分批裁定：复用既有 journal，不新增日志格式或恢复写入工具；只操作合成数据和临时目录。
  独立审查发现等待语义的 P2 测试保护缺口，已用可控屏障和三个独立未等待变异补强；
  最终定向 89/89，全量 108/108 套件、2067/2067 用例，原 2041 保留、新增 26，零跳过。
- [x] 第二十二批及等待语义 P2 测试保护修订用户复审关闭：四套件 89/89，见 Gate §18.25。
  真实受保护日志介质、日志完整性/旧快照恢复与生产切换仍另行验收。
- [x] 第二十三批三服务 BSON 快照重建后的协议恢复验证：停测试 HTTP、重建合成持久记录、重启独立工厂，
  覆盖原映射、历史终态、精确代次解绑及账本/首次审计，见 Gate §18.26。
  对应 TC-SL-REMOTE-ID-004 的应用协议子项；不覆盖真实备份工具、日志重放、跨库时点一致性或生产恢复。
  新增 11 个用例；独立审查发现的审计时钟/完整任务重放、pending GET 无副作用两项 P2 已补强。
  最终关联 133/133，全量 108/108 套件、2078/2078 用例，原 2067 保留，零失败/跳过。
- [x] 第二十三批及两项 P2 测试保护修订用户复审关闭：六套件 166/166，见 Gate §18.26；稳定性总门禁仍 OPEN。
- [x] 第二十四批 BSON 重建后的隐私删除凭证与保留清理恢复：复用三服务工厂及临时日志/媒体，
  验证 PREPARED/COMMITTED 删除后重建、精确凭证、清理失败重试及首次删除审计，见 Gate §18.27。
  不提供旧快照恢复或日志重放工具，不接入生产，不关闭真实恢复验收。
  新增 8 例，最终关联 142/142，全量 108/108 套件、2086/2086 用例，原 2078 全部保留、零跳过。
  自查补强完整作品集合和恢复后删除状态；独立审查及自审未发现新的可确认问题。
- [x] 第二十四批用户复审关闭：六套件 142/142，见 Gate §18.27；三项稳定性问题及全量稳定性门禁保持 OPEN。
- [x] 第二十五批保留清理数据库回滚/提交未知后的重建恢复：组合 PREPARED/COMMITTED 删除终态，
  验证正文已移除时的元数据事务、精确凭证、首次审计、幂等清理及完成恢复，见 Gate §18.28。
  只操作临时合成数据，不接入生产，不关闭真实恢复验收。
  新增 4 例；独立审查发现恢复后媒体基线 P2，已补齐恢复前基线和两次恢复/重放后正文检查。
  最终全量中的关联七套件 162/162，通过；全量 107 通过/1 失败套件、2089 通过/1 失败用例，
  原 2086 用例保留；TC-T5-POINT-006 socket hang up 新失败证据保留，不关闭稳定性门禁。
- [x] 第二十五批及恢复前媒体基线 P2 用户复审关闭：七套件 162/162，见 Gate §18.28；
  最终全量 socket hang up 失败及两项偶发 401 保留，稳定性总门禁仍 OPEN。
- [x] 第二十六批清理失败后先恢复完成/确认、再清理的交错验证：PREPARED/COMMITTED 与
  rollback/lost-ack 四种组合，验证恢复前媒体基线、精确凭证、审计和账本不受后续清理影响，见 Gate §18.29。
  独立审查发现持久作品集合/代次 P2，已补齐首次确认前后精确断言；最终全量 108/108 套件、
  2094/2094 用例，原 2090 全部保留、新增 4，零失败/跳过；历史稳定性问题继续 OPEN。
- [x] 第二十六批及持久作品集合/精确绑定代次 P2 用户复审关闭：七套件 166/166，见 Gate §18.29；
  socket hang up 和两项偶发 401 保留，T1 IN_PROGRESS，全量稳定性门禁 OPEN，生产不接入。

#### 原始契约清单

以下原条目由归并表 A08–A35 逐项追踪；保留复选框不表示独立实现尚未开始，也不作为额外 28 个工作包。
首批的分批裁定为先完成传输与响应信任边界；后续独立组合证据见历史分批记录，正式接入/整体验收仍待 R2–R4。

修改：任务模型/路由、resource 的 `MediaReference` 与映射；新增第 2 节 completion 两个服务及
`GrowthTaskCompletionOperation`。复用 `backend/common/services/mediaReferenceClient.js`。
测试：扩展 `backend/services/homework-service/__tests__/growthTasks.test.js`、
`growthTaskMediaReferences.test.js`；新增 `__tests__/services/growthTaskCompletionService.test.js`、
`growthTaskCompletionMediaService.test.js`；resource 对应引用测试随字段同步。

输入/输出：现有 `PATCH /api/growth-tasks/:taskId/complete` 增加有序 `completionMediaIds`、
operationId、expectedCompletionVersion；确认命令携带所见 completionVersion；详情返回
最新版本与已授权的完成图片 ID，不返回恢复内部字段。

- [ ] 写聚焦失败测试：0/1/10 张成功、11 张/重复 ID/错误 purpose/跨孩子/软删除媒体拒绝，
  confirmed 状态新写拒绝，旧任务无字段可以读取。
- [ ] 写竞争测试：两个版本相同的完成更新仅一条成功；确认和更新竞争；确认旧版本拒绝；
  已提交命令重复调用不再次改 completedAt 或重复引用；同 operationId 不同内容返回
  `IDEMPOTENCY_KEY_REUSED`。
- [ ] 实现授权后命令去重：唯一作用域包含 familyId、childId、taskId、actorId、动作和 operationId；
  保存规范请求摘要及目标版本；pending 意图另保存完成恢复所需的最小规范业务 patch 和哈希，
  不保存图片正文或签名 URL。首次占位与本地任务写入保持事务一致，终态清除临时 patch。
- [ ] 分离公开 operationId 与服务端 UUID `remoteOperationId`；远程标识与首次命令占位同事务持久化，
  每条命令包括空新增集合均有映射。本地建立全局 remoteOperationId 唯一索引，保留原业务幂等唯一索引。
  不同 actor 使用同一 UUID 必须分配不同远程标识。业务键竞争重读已有命令；仅远程标识碰撞且占位
  事务确认回滚、无远程调用时可重分配。提交未知先恢复原事务结果/重读原命令，禁止发送未持久化标识。
  映射不可变并随终态保留、不单独 TTL；重试/重启/运维恢复复用，缺失映射阻断并告警、不回退客户端 UUID。
  公开请求不允许 remoteOperationId，公开响应不返回它，规范请求哈希不包含服务端生成标识。
- [ ] 内部 operationId 必须取持久化 remoteOperationId：公共 client 的 prepare/commit/abort/status(operation)
  仍使用内部字段 operationId，但取值与响应身份校验均使用持久化映射。新增引用 bindingOperationId 为
  当前远程标识，保留引用不重绑；unbind 命令使用当前远程标识，移除项使用精确旧 bindingOperationId。
  references 模式不传命令标识；纯删除复用映射但不创建空远程 operation。覆盖 client 请求及响应错配拒绝测试。
- [ ] 保存不可变成功响应投影 `successResponse`：按正式 API 固定字段与发布同事务写入，SUCCEEDED
  后才返回。覆盖 A 成功、B 更新、重放 A 及确认/归档后重放，验证正文/顺序/版本/时间不变、无额外写入，
  当前任务由 GET 获取，投影不包含备注/签名 URL，仍实时授权。
- [ ] 每个任务最多一个活动完成命令：`activeCompletionOperation` 保存完整 scope，首次占位 CAS
  要求为空；恢复 CAS 要求相同 owner/阶段/版本。完成新写、清单编辑、任务编辑、确认、取消和归档
  的最终原子写入均拒绝活动意图或待恢复引用，返回 503；测试不同 actor/新 id、清单修改和删除竞争，
  以及旧执行器不能覆盖新 owner。已终态命令重放先于锁，独立 help 只局部更新；材料 pending 阻止新占位。
- [ ] 按旧稳定引用与目标顺序计算新增集合、保留集合和移除集合：只 prepare/commit 新增集合，
  保留集合沿用原绑定代次，发布后只按精确旧代次 unbind 移除集合；各阶段不发送空媒体命令。
  纯重排和仅非媒体更新只本地发布，删除全部图片仍处理非空移除集合。
- [ ] 实现完成媒体恢复：先在本地事务中保存命令占位、pending 意图和目标代次，再以 CAS 设置
  远程结果不确定标记，之后才 prepare → commit → 发布稳定结果 → unbind 被替换引用。
  未知结果沿用 `MEDIA_REFERENCE_PENDING`；恢复只接受完全相同的 PATCH 和原 operationId，GET
  不触发恢复，不重新猜测引用代次。
- [ ] 实现稳定业务拒绝收敛：仅首次进程内 prepare 直接返回可信且带匹配 commandHash 的 ABORTED
  终态时，以事务/CAS 把命令标记为失败、清除 pending 意图并恢复上一稳定引用。
  该路径不得递增 `completionVersion`、改写完成证据或 bind/unbind；同命令重放相同失败，修正
  请求使用新的 `operationId`。恢复执行不得凭后来收到的稳定 4xx 清理意图；首次拒绝的失败收敛
  结果未知时仍返回 `MEDIA_REFERENCE_PENDING`，只恢复原命令。
- [ ] 在 resource-service 增加 `MediaReferenceOperation`、唯一索引和服务凭据保护的 status/abort，
  同步公共 client 的 schema/响应校验。仅 completionMediaIds 采用新协议，其他字段及旧数据不迁移。
  远端键的 operationId 为映射的 remoteOperationId；commandHash 含完整本地 scope/actor/action/客户端
  operationId，远端同时校验规范新增集合摘要；同键异摘要拒绝无副作用，保留 pending 并告警，不凭冲突清锁。
  终止与提交必须竞争同一 operation 记录，operation CAS 与全部引用变化同事务，事务/唯一冲突重读。
- [ ] PREPUBLISH 的受控引用状态对账使用 operation 模式。absent 不能作为失败终态证据：ABSENT
  调 abort 原子写 ABORTED，即使无引用也保留标记；有效 PREPARED 继续 commit；COMMITTED 且引用全
  bound 或各项具有精确 privacyDeletion 凭证才发布，匹配 ABORTED 才本地失败清锁。
  abort 返回 COMMITTED 继续发布，未知/矛盾保持 pending。
  新增集合为空时不进行全称状态判断，直接发布本地 patch。不得跨服务直读数据库或人工清空 pending。
- [ ] 租约过期原子转为 ABORTED，同时释放该 operation 的 prepared 引用。prepare/commit/abort
  请求路径都判断服务端 now >= leaseExpiresAt，重试不续租；status 返回 leaseExpired 但不写入。
  稳定媒体拒绝提交 ABORTED 后返回，不能抛异常回滚终止标记；裸 4xx/5xx 不允许清锁。
  EXPIRED/ABORTED 映射公开 409 同名稳定码，原命令重放同一失败。
- [ ] 终态记录不做 TTL 删除，媒体清理保留最小 operation 标记；新协议回收复用过期终止事务，
  不直接删除 prepared 行。COMMITTED 后 unbind 不反转终态，迟到 prepare/commit 不复活引用。
- [ ] 接入私有媒体软删除：涉及新协议 PREPARED 时，同事务终止 operation、释放完整新增集合后
  标记媒体 deleted；commit 胜出保留 COMMITTED，依据最小删除凭证释放目标媒体 bound。事务重试重新采样时间。
  扩展 mediaService/cleanup 测试，验证多图片命令删除其中一张、删除与 commit/abort 竞争无半终态。
- [ ] TC-SL-PRIVACY-001：复用媒体 DELETE，家庭家长/孩子本人授权、跨孩子/离家家长拒绝；确认/归档可删，
  不改教学状态/版本/星星。TC-SL-PRIVACY-002：prepare 与删除共享资产写屏障，COMMITTED 竞争保留终态，
  PREPARED 整组 ABORTED，重复 DELETE/丢响应不改首次审计。TC-SL-PRIVACY-003：COMMITTED 后本地未知且
  媒体已删除，status 精确 privacyDeletion 凭证可恢复不可读占位；伪造、其他代次及普通 released/absent 不能发布。
- [ ] TC-SL-PRIVACY-004：deletedAt/最后 releasedAt 较晚者满 30 天且无活跃引用才清理；保留 tombstone/operation。
  多任务引用同一媒体全部按精确身份释放；混入其他 purpose/字段阻断。测试清理失败可重试且不重新开放媒体。
- [ ] 发布事务固化投影、递增版本并进入 `PUBLISHED_CLEANUP`；发布后不得回滚已发布作品，
  不再 prepare/commit 或重复递增。移除集合按精确旧 bindingOperationId 对账：同代次 bound 用当前 remoteOperationId 重放
  unbind，同代次 released 或完整身份 absent 视为已无引用（锁阻止并发重绑），其他代次/prepared 阻断。
  合法混合逐项收敛；移除集合全部收敛后事务置 SUCCEEDED/stable 并清除 pending/owner。
  空移除集合直接终结。本地结果未知先读阶段；status 的 references 模式读取移除集合，不校验新增
  集合摘要、不隐藏其他绑定，releaseOperationId 仅审计。发布后禁止 abort。
- [ ] 保留任务材料引用；完成作品与材料分别可恢复。存在待恢复写入时按统一互斥规则阻止冲突写入，恢复后重新检查版本。
- [ ] 确认读取与版本一致的完成快照，CAS 成功后走现有星星幂等命令；不重新实现奖励服务。
- [ ] 历史 completed 无媒体任务按 completionVersion 0、stable 处理；确认 expected version 0 时只
  持久化缺失版本为 0，不递增作品版本，并与同一 CAS 中的 pending 发星状态衔接。
- [ ] 验证事务前/后中断、引用远端成功但本地未知、首次拒绝后本地收敛结果未知、状态对账三种
  结论、`[A]→[A,B]`、删除/纯重排/空集合/仅备注更新、删除/归档竞争和恢复后保留策略。
- [ ] 覆盖发布后解绑已成功但响应丢失、解绑前崩溃、终结事务结果未知、纯删除 `[A]→[]`、
  移除集合混合 bound/released/absent、其他代次/prepared 阻断；断言不回滚、不重复发布、版本只加一次。
- [ ] 故障测试：status absent 后原 prepare 延迟到达；abort/prepare 和 abort/commit 两种胜出顺序；
  超过租约停机、恰好到期、重复 prepare 不续租；终止响应丢失/本地失败提交未知；已解绑后的终态重放；
  同 UUID 异 actor/异摘要、部分引用异常事务整体回滚。验证 ABORTED 不再创建/绑定，COMMITTED 不被 abort
  撤销；不用 worker 也能过期收敛，任务锁最终释放，旧新命令互不覆盖。
- [ ] `TC-SL-REMOTE-ID-001`：参数化 A 先以客户端 UUID X 进入 ABORTED/FAILED 或 COMMITTED/SUCCEEDED，
  再由有权限的 B 使用同一 X、当前期望版本及合法新增媒体完成同一任务。断言 R_A != R_B，B 正常终结、
  锁释放、版本仅按成功次数递增，A 终态/引用不被 B 的 prepare/abort 覆盖；A 重放仍返回自身固定结果。
  成功分支任务保持 completed、未确认，B 新增媒体避免空集合绕开远端；补测保留/替换旧媒体的代次。
- [ ] `TC-SL-REMOTE-ID-002`：A 活动时 B 同 UUID 返回 503，不创建 B 命令、不调用远端；A 收敛后 B
  用当前版本重提获得独立映射。同 actor 同 UUID 同正文只重放一次，异正文 409 且不生成新映射。
- [ ] `TC-SL-REMOTE-ID-003`：占位提交响应丢失、prepare/abort 响应丢失、租约过期及进程重启均复用
  原远程标识；注入 UUID 唯一冲突与本地命令并发，验证只在确认回滚前提下重分配、无候选标识外泄。
  ABORTED 后迟到请求仍使用 R_A，不能影响 R_B；本地缺失映射/远端同键异摘要不得降级清锁。
- [ ] `TC-SL-REMOTE-ID-004`：纯删除及 PUBLISHED_CLEANUP 重试的 unbind 命令标识为当前 R_B，
  bindingOperationId 为旧 R_A；保留引用仍为 R_A，新增为 R_B。两端备份恢复保留映射和终态，
  停写回滚不丢映射、不允许旧版本恢复；公开 remoteOperationId 注入被拒绝，成功响应不泄露内部标识。

验收：作品不会因网络重试丢失或重复；家长确认的就是看到的版本；同家庭其他孩子仍无法访问。
幂等记录保留/清理随任务生命周期定义，本轮不增加后台清理服务；重放不能绕过当前授权。

### T2：iPad 作品交付与家长审核页面

2026-10-23 设计准备更新：用户要求先补齐退出后恢复和孤儿媒体安全回收设计，
见[补充设计](../specs/2026-10-23-family-self-directed-learning-t2-recovery-retention-design.md)和
[执行记录](../../development/family-self-directed-learning-t2-execution.md)。原设计及补充设计已获用户批准，含接口、模型、
专用凭据、24 小时保留期和每批 50 个参数。T2-1 基线修复及 P2、T2-R 后端及 owner/pending P2 已验收 CLOSED。
2026-10-24 用户批准 MVP 范围调整：T2-G 未完成的新回收、用户删除高级恢复 D2b/D3/D4/E 后置，
不再阻塞 T2-2 至 T2-6。保留已接入的上传/删除安全依赖、实时权限、原命令恢复和审核版本保护。
当前依赖核对、保留/后置矩阵与验收边界见[执行记录 §11](../../development/family-self-directed-learning-t2-execution.md#11-2026-10-24-mvp-范围调整与页面运行依赖)。
先交付孩子选图提交 → 家长按所见版本审核 → 孩子回看的纵向闭环，再补齐既定异常和 0–10 图边界；
不新建上传协议、恢复框架或审批链。后置项仍未验收，恢复启用需完成其原安全测试。
2026-10-24 页面实现已完成，工程证据与自查/独立复核见[执行记录 §12](../../development/family-self-directed-learning-t2-execution.md#12-mvp-页面闭环工程交付2026-10-24)。
共享会话、私有媒体和审核版本按严格边界验证；高级恢复未继续扩展。仅合成验证，不部署、不提交或推送 Git。
2026-10-24 用户明确批准 T2-2 至 T2-6 限定合成范围工程验收及总门禁关闭；T2 CLOSED（ENGINEERING_SYNTHETIC_ONLY），三项 P2 CLOSED。该批准时全量为 FAILED：143套件142通过/1失败，3943项3942通过/1失败；此原始失败快照保留，不随后续缺陷修复改写。
JWT 过期、完成快照兼容投影和上传正文同步三项 P2 均 CLOSED；原两项页面 P2 关闭不变。
原批准时全量结果、前端40/490、HTTP2/14及浏览器14项等已有证据见[执行记录 §16](../../development/family-self-directed-learning-t2-execution.md#16-三项-p2-批准关闭与工程验收再申请2026-10-24)；工程批准及状态验证见[执行记录 §17](../../development/family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)。旧收口及旧失败证据原样保留，不以工程批准冒称全量全绿，不自动启动 T3–T9。
后续 D2B-05 查询超时修复 e744cba1 经复审及用户批准，QUERY_ONLY / CLOSED；CI 40099315976 后端143/3958及完整发布门禁通过。当前记录与专用分支提交/推送授权见[执行记录 §18](../../development/family-self-directed-learning-t2-execution.md#18-d2b-05-查询超时复审与批准关闭2026-10-24)，不关闭 D2B 整批、高级恢复或新回收。
真实 iPad 条目保持未勾选 / DEVICE_PENDING；T8_PENDING / NOT_AUTHORIZED 和高级恢复/新回收 REMAINDER_DEFERRED 不随工程关闭，T3–T9 不自动启动。

依赖：T1。模式：标准。对应工作包 1 前端。

修改：`ChildTaskPage.js`、`ChildTodayPage.js`、`TasksPage.js`、`familyApi.js`、`childApi.js`；
复用 `frontend/web/src/components/family/` 私有媒体控件；核对 `privateMediaRules.js` 的 purpose 限制。
新增测试：`frontend/web/src/__tests__/child/ChildTaskCompletion.test.js`、
`frontend/web/src/__tests__/family/TaskCompletionReview.test.js`；扩展现有 API 测试。

- [x] 写组件测试：图片选择/移除/预览、数量限制、完成后详情入口、家长反馈、确认后只读。
- [x] 在 API 包装层显式传递 completion 字段与版本，避免孩子字段白名单把新字段丢弃。
- [x] 用 `POST /api/media` 上传后获取 mediaId，完成接口绑定；purpose 固定 task_completion。
- [x] 一次用户提交生成一个 operationId，超时沿用原请求重试；用户修改内容视为新命令。
  若旧请求结果未知，先查询/恢复再允许新提交，不能同一 id 配新图片。
- [x] 家长确认带所见版本；409 提示刷新重审，503 保留恢复入口；过期媒体地址重新授权获取。
- [x] 扩展今日页，使 completed/confirmed 任务也能进入本人详情；不开放取消/归档后的编辑。
- [x] 在正式 enabled 合成环境完成上传—完成—确认—回看整条浏览器路径；含重登恢复、账号隔离及原 PDF 兼容。
- [ ] 在真实 iPad Safari 检查相册/拍照、
  HEIC 拒绝与 JPEG 输入退路及大图表现；不自动承诺服务端支持 HEIC。按下方真机矩阵逐项记录，不能只测提示。
- [ ] 完成[系统设计 §8.2](../../architecture/family-self-directed-learning-system-design.md#82-任务完成页)的
  TC-SL-IPAD-001..004：新拍 JPEG、历史 HEIC 显式导出、文件选择、异常与回看。无设备为 DEVICE_PENDING，
  不以 Chromium 模拟或 accept 属性代替真实 iPad 验证。隐私删除明确确认、显示不可读占位并清除页面缓存。

验收：没有用错题或任务材料代替完成作品；失败有可操作提示；页面刷新后的已绑定作品可找回。

### T3：独立求助与家长处理

依赖：T2。模式：严格。对应工作包 2。

2026-10-25 用户单独授权 T3 本地实现与合成验证；不是 T2 批准的自动扩展。
当前 APPROVED / CLOSED / ENGINEERING_SYNTHETIC_ONLY，依据用户四步条件授权与独立复评关闭，见[Gate §23.8](../../development/family-self-directed-learning-mvp-gate.md#238-t3-独立复评与限定工程关闭2026-10-25)。
按后端契约、页面闭环、综合验收三个阶段执行，不新增通知/聊天服务、恢复平台或真实迁移。
DEVICE_PENDING、高级恢复及新回收 REMAINDER_DEFERRED 保留。已授权专用分支/PR 和最新 CI 通过后的 merge commit；不部署，不启动 T4–T9。

修改：任务模型/路由、`TasksPage.js`/`TodayPage.js`、`ChildTaskPage.js`、两个 API 模块；
新增 `growthTaskHelpService.js` 及 `__tests__/services/growthTaskHelpService.test.js`。
求助列表优先使用任务查询筛选和分页，不新增 notification worker。

已实现接口（API §14.3）：
`PATCH /api/growth-tasks/:taskId/help`，请求 `action=request|resolve`、expectedHelpVersion；
request 带 helpType/note，resolve 仅家长允许并可带短答复。嵌入一条当前 helpRequest，
包括版本、pending/resolved、实际 actor、服务端时间；不覆盖既有 needsHelp 的完成时回顾含义。

- [x] 写测试：pending 时 request 不改变任务状态；孩子不能 resolve；其他孩子/跨家庭拒绝；
  两个家长处理同一版本、旧 resolve 与新 request 竞争不能关闭新求助；孩子和家长提交相同正文
  不能互相冒充重放。
- [x] 实现当前求助原子更新，说明最多 200 字。request 的安全重放必须同时满足：当前记录仍为
  pending、`currentHelpVersion === expectedHelpVersion + 1`、规范化后的 `helpType + note` 完全相同，
  且认证 actor 与 `requestedByActor` 相同。其他旧 request 返回 `409 VERSION_CONFLICT`；
  旧版本 resolve 返回 `409 VERSION_CONFLICT`，客户端刷新后不自动重复用户动作。
- [x] 家长任务查询增加 helpStatus 过滤和现有分页；取消/归档排除，completed 的未处理求助保留。
- [x] 在孩子页面独立提供“我需要帮助”，家长页面提供处理入口；完成写入不能清空求助。
- [x] 增加表单与 API 组件测试、真实 Gateway 拒绝测试。

上述工程清单已获限定合成验收；不替代真机或 T7 产品集成，DEVICE_PENDING、SL-02 PLANNED 保持。

2026-10-25 独立全面复评发现 T3-HELP-P2-PARENT-DENIAL 和 T3-HELP-P2-LOADING；
本地修复及红绿证据见 Gate §23.7；后续独立复评 PASS、用户条件批准及关闭见 §23.8，历史 NEEDS_FIXES 不改写。
聚焦家长拒绝信号传播和慢读接管，不改后端协议或扩大高级恢复/回收范围。

验收：孩子没做完也能求助；没有确认、发星、改掌握等副作用；家长可找到并处理。

### T4：短检查清单与基本分龄交互

依赖：T3。模式：严格（字段、并发）；页面部分标准。对应工作包 3。

修改：`GrowthTask.js`、`growthTasks.js`、completion 服务、家长/孩子任务页面与测试。
沿用现有 child profile 年级，不新增儿童画像或学习风格分类。

- [x] 写测试：清单 0–5 项、itemId 唯一、label 1–100 字、未知 checkedItemId 拒绝、
  pending 才能改清单、旧任务无清单；创建时未提供或显式提供空清单为 `checklistVersion=0`，
  提供非空有效清单为 `checklistVersion=1`；覆盖家长修改与孩子完成并发。
- [x] 实现 checklistSnapshot/checklistVersion，完成请求带 expectedChecklistVersion；
  同一原子完成条件同时校验 task status、completionVersion 和 checklistVersion。
- [x] 未勾选项允许如实保留；独立求助始终可用，不能强迫孩子勾全才能求助。
- [x] 一年级默认少字段、大按钮，家长代录标明实际 actor；四年级显示估时和自检提示；
  年级未知时采用简洁通用界面，可由家长调整现有年级资料。
- [x] 验证一次清单变化不会使旧幂等命令被重新执行；成功重放与新请求的版本检查有明确区别。

验收：同一组业务字段适用三个孩子；不实现语音、自动朗读、S0–S4 采集或两套客户端。

2026-10-26 工程候选已完成上述实现、自查、独立代码/测试复评及合成验证，详见增量 Gate
§24.3–24.7。清单勾选代表工程验证，不代表用户已批准关闭 T4 总门禁；任务状态继续
IN_PROGRESS / OPEN，待用户验收。DEVICE_PENDING、SL-03 的 T7 集成责任、T8 真实启用及
高级恢复/新回收后置保持独立。保留历史失败和全量后端原 1 项条件跳过及其单独补验证据。

后续独立完整评审发现 `QA-T4-HELP-PROJECTION-001`：清单-only 修改响应遗漏已有求助。
最新修订及永久反例见 Gate §24.8；用户已批准关闭该 P2，关闭与完整候选交接见 §24.9。
T4 总门禁仍 OPEN，不以此前勾选或全绿结果替代用户验收批准；专用分支提交/PR 不授权合并或部署。

固定提交 `c52bed5a` 的服务器独立合成 QA 已完成并经开发线程核实，见 Gate §24.10：
后端 415/HTTP 18/家庭全量 4152/前端 592、双引擎各 29 及健康检查通过；各上下文不可相加。
这不改变本节 IN_PROGRESS / OPEN。M01–M08 人工/真机及负责人待确认，交接见
[人工准备清单](../../development/evidence/t4-synthetic-2026-10-26/manual-handoff.md)。
上述核实阶段仅做本地文档收口；随后用户批准先提交并合并已完成工程，人工测试后续再做，
见 Gate §24.11。T4 总门禁仍 OPEN，T5 的依赖与单独执行授权尚未满足，不自动开工或部署。

### T5：今日计划、任务顺序与孩子估时

依赖：T4。模式：严格。对应工作包 4。

**T5:** CLOSED
**T5 gate:** CLOSED
**T5 approval:** APPROVED
**T5 scope:** LOCAL_SYNTHETIC_ONLY
**T5 closure:** APPROVED / CLOSED / ENGINEERING_SYNTHETIC_ONLY
**T5 historical failures:** PRESERVED
**T5 nonblocking:** T5-NB-001 OPEN_NONBLOCKING / T5-NB-002 OPEN_NONBLOCKING
**T5 device:** DEVICE_PENDING
**T5 deployment:** T8_PENDING / NOT_AUTHORIZED
**T5 deferred:** REMAINDER_DEFERRED
**T5 Git:** BRANCH_PR_ONLY / NO_MERGE / NO_DEPLOY

用户新目标已授权完整开发，接续 T4 已完成工程基线；上文 T4 段与 Gate §24 的
T5 NOT_STARTED / 依赖授权未满足保留为历史，不再阻塞本次开发，也不意味着 T4 总门禁关闭。
当前分批记录见 [Gate §25.2](../../development/family-self-directed-learning-mvp-gate.md#252-t5-本地合成工程提交验收2026-10-27)：
A 基线/设计核对、B 后端、C 前端及 D 正式 HTTP/浏览器与独立复评已完成工程验证，提交用户验收。
原 46/605、首次全量失败及后续独立发现保留在历史记录；修订后家庭后端 149 suites/4290 passed，
前端 49/624、正式 HTTP 4/22、完整浏览器 34 passed。索引构建/限流及前端两项 P2 已独立复评。
下面勾选仅表示工程实现和证据具备，不关闭总门禁，不替代用户、真机或 T7 综合验收。
后续独立 QA 的数字输入 P2 / 冲突图 P3 已完成开发修订与自查，仍待独立复评，不能沿用上述
提交验收快照视为关闭。最新状态及冻结材料见 Gate §25.3 和
[修订交接](../../development/evidence/t5-numeric-fix-2026-10-27/README.md)，两项为
FIXED_PENDING_INDEPENDENT_REVIEW；总门禁仍 OPEN。
2026-10-27 后续复审已通过，用户批准关闭上述 P2/P3，两项当前 CLOSED；上段待复评为历史。
最新关闭记录见 Gate §25.4 及[总门禁关闭评审材料](../../development/evidence/t5-numeric-fix-2026-10-27/closure-review.md)。
T5 工程关闭申请 READY_FOR_APPROVAL，总门禁仍 OPEN，须另获用户批准；两项非阻断补测
T5-NB-001/002 保持 OPEN_NONBLOCKING，不冒称已经补齐。
上述为分阶段历史。用户现已另行批准 T5 限定合成工程总门禁关闭，当前以 Gate §25.5 和
[批准记录](../../development/evidence/t5-numeric-fix-2026-10-27/approved-closure.md)为准。
原候选/失败证据不覆盖；DEVICE_PENDING、两项非阻断补测、T7/T8/T9及后置范围保持原义务。
开发及关闭阶段仅本地合成家庭、临时数据库/存储，当时无 Git 写入授权；当前仅授权专用分支提交、推送及 PR（Gate §25.6），不合并或部署。T6–T9 不启动，
D01/T2-G、高级恢复/新回收仍后置且保持默认关闭，真机与服务器测试另行安排和授权。

新增：第 2 节 DailyLearningPlan 模型/路由/service，及 homework 下对应模型、服务、路由测试。
修改：homework/server、gateway/server、ChildTodayPage、API 包装与前端测试。

契约沿设计：`GET/PUT /api/children/:childId/daily-learning-plans/:localDate`。
注意 Gateway 的 `/api/children` 原有归属：只把具体日计划路径代理给 homework，不能把全部
children 路由改向。验证家长资料、PIN、已有 children 操作不受影响。

- [x] 写模型测试：唯一 familyId/childId/localDate，最多 20 项且 taskId 不重复，估时可空或整数 1–240。
- [x] TC-SL-ESTIMATE-001..004：短/中/长映射 5/15/30 或留空；新增/改分钟记录 estimateRecordedBy，
  仅排序保持原归属、updatedByActor 为本次操作者；清空归属/旧数据 unknown；伪造 actor 字段和跨孩子拒绝。
  父母共管仍按实时成员检查；CAS 失败不写审计，旧版本客户端无需提交审计字段。
- [x] 写首次并发创建测试：不存在时 expectedVersion=0，成功保存 version=1；唯一索引竞争
  返回 409，后续 CAS 更新递增；GET 不存在返回空计划/version=0，不在 GET 时隐式写入。
- [x] 只允许写家庭“今天”；历史只读，未来计划留后续。逐项验证同孩子任务归属，新增项限 pending；
  当日已完成项目可保留展示，取消/归档项目不再可行动，旧任务仍能从普通任务列表查找。
- [x] 日计划不修改 dueDate、不复制 task status；服务端读取时依据当前任务状态投影。
  未选中的到期任务保留在“其他待办”，避免孩子排序后遗漏学校作业。
- [x] 孩子上下移动任务并可选估时，家长 estimatedMinutes 不被覆盖；家长代录明示实际输入者，不计独立估时。
  冲突提示重新选择，不自动重放覆盖他人；数字/图标快捷值可互换，不新增能力画像。
- [x] 加入午夜、无权限、首次并发、同一任务跨日参考、不同孩子同日期和旧 Gateway 路由测试。

验收：顺序可保存且孩子间独立；无拖拽依赖、周排课或时间优化算法。

### T6：人工错题、订正与延迟复习连接

2026-10-27 用户已批准限定合成工程总门禁关闭；总门禁 CLOSED，设计及分批状态见 Gate §26.6。
实施细化见 [T6 设计](../specs/2026-10-27-family-self-directed-learning-t6-design.md)。
T6-1 契约/设计 -> T6-2 后端 -> T6-3 页面 -> T6-4 复习 -> T6-5 集成与独立复评。
本轮不沿用 T5 Git 授权，不自动关闭任何真机或后置责任。

依赖：T5（业务上主要依赖 T2）。模式：严格。对应工作包 5。

修改：`FamilyMistake.js`、`routes/familyMistakes.js`、`GrowthTask.js`/路由、MistakesPage、TasksPage、
API 包装及对应测试。关联字段目标：错题可有 sourceTaskId；订正任务可有 sourceTaskId 或
sourceMistakeId。均为可选，不要求回填历史对象。

- [x] 在正式契约中固定来源字段和跨服务受控读取；子域所有者验证真实资源，不相信客户端的孩子信息。
- [x] 来源不存在和跨家庭/跨孩子来源对公开调用统一返回 `404 RESOURCE_NOT_FOUND`，真实原因只
  进入脱敏内部审计，避免资源存在性侧信道。
- [x] 从任务详情进入现有错题表单，预填 subject/来源，家长填写错因和知识点；从错题进入
  现有任务创建表单建立订正任务；两个动作分别明确提交，不建设跨服务原子向导。
- [x] 不把 task_completion ID 直接写入 mistake_answer；第一版提示家长重新上传正确 purpose 的图片。
- [x] 创建后能回到来源；来源已不可读取时显示“来源不可用”，不泄露其他孩子标题或媒体。
- [x] 使用现有 reviewReminderDate 和提醒；复习题由家长准备；不自动更新 corrected/mastered。
- [x] 写测试：同 scope 成功、兄弟姐妹/跨家庭/不存在来源拒绝、purpose 错误拒绝、服务失败可重试、
  一个步骤成功另一个未做时保留已保存内容。沿用原创建接口重试语义，不承诺尚未实现的全局去重。

验收：一条真实错题走完来源、人工判断、订正和约定日期复习；无需 AI、K12 或自动判题。

上述为已批准关闭的限定合成工程实现/用例范围，不表示产品、设备或真实部署验收完成。独立评审与永久反例见
[T6 评审记录](../../development/evidence/t6-engineering-2026-10-27/review.md)，实际运行结果见 Gate §26。
当前总门禁 CLOSED，仅限 ENGINEERING_SYNTHETIC_ONLY；DEVICE_PENDING、T4 既有状态、T7/T8/T9 责任和后置范围不变。

2026-10-27：用户已批准关闭“普通重新加载拒绝优先”P2，Gate §26.4 为 CLOSED_APPROVED。
计划七项验收条件已逐项核对，批准前总门禁关闭材料见
[T6 限定合成工程关闭评审](../../development/evidence/t6-reload-denied-p2-2026-10-27/closure-review.md)。
用户随后批准 T6 限定合成工程关闭，当前 T6 CLOSED；最新批准及验证边界见
[T6 总门禁关闭记录](../../development/evidence/t6-reload-denied-p2-2026-10-27/engineering-closure.md)。
不自动启动 T7；后续用户已单独授权专用分支提交推送及 PR/CI 检查，仍不合并、不部署。
Docker INCOMPLETE_FAILED 和两项非阻断补测继续保留；交接见 Gate §26.7。

固定 a3aa01cf 的独立服务器合成回归随后通过，来源、计数、QA 工具失败与收尾见
[服务器验证记录](../../development/evidence/t6-server-synthetic-2026-10-27/README.md)及 Gate §26.8。
只补充执行证据，不改变本工程关闭的批准范围；真机、T7/T8/T9 和所有后置责任保持，本次记录不新增 Git 授权。

### T7：周复盘导航与完整工程回归

当前 IN_PROGRESS / OPEN；接续 Gate §27 最小设计及独立设计评审。孩子/家长页面及三个孩子正式
HTTP/浏览器完整链路已有合成证据；统计/隔离补强独立复验、前后端和浏览器完整相关回归已通过，
服务端反馈竞争修订、真实过期身份反例和最新完整候选见 §27.6–27.7。完整发布未通过不写全绿，
不以自查或自动化关闭总门禁，历史失败不覆盖。

2026-10-28 用户批准七项 P2 关闭，绑定原冻结候选和本轮复验，见 Gate §27.8。
本批准不关闭 T7/T4；下面两项完整发布要求仍未勾选。lint 精确归档排除、两份周报后端规则覆盖
及永久反例方案见 Gate §27.9，该节记录关闭七项 P2 时的 PROPOSED_WAITING_APPROVAL 状态。
后续用户批准该最小修订，开发实施与当时待复评状态见 Gate §27.10；独立复评已通过，用户再批准
本轮 lint 问题限定关闭（§27.11，CLOSED / USER_APPROVED）。Node26 开发与 Node22 独立证据分列，
原完整发布失败仍保留，不能据此勾选下列发布要求。逐阶段缺口和 Docker/Git clean 最小方案见
§27.12–27.13，PROPOSED_WAITING_APPROVAL；不执行 Docker、Git 或完整 release，不提前关闭 T4/T7。

后续用户已批准调整为 Ubuntu 2 CPU/3 GiB、12 GiB 磁盘的14–17分项隔离，阶段15允许既有
legacy Docker builder受限串行构建，见 Gate §27.14。首轮14因空IPAM误拒停止；入口修订及
永久反例仅本地通过（89 tests），15–17 NOT_RUN，SERVER_RETRY_PENDING，不把本地复验写成
服务器或完整发布通过。原服务未改，本次新目录已收尾；T4/T7 OPEN及所有保留边界不变。

用户再批准固定候选重试，最新结果见 Gate §27.15：14实际配置、15七镜像受限串行构建通过；
16用户服务索引准备错误85后立即停止，17未运行，INDEX_COMPATIBILITY_REVIEW_REQUIRED。
FamilyParentInvitation同键索引的Mongo4.4兼容修订/永久反例方案待批准，未改业务或真实索引；
本轮资源定向收尾完成，原服务不变，完整发布两项要求仍不勾选，T4/T7 OPEN。

用户随后批准最小索引修订及重跑，见 Gate §27.16：4.4完整错误复现、冗余普通索引修订、
四项永久反例、用户服务178项和共管HTTP2项通过，自查完成且待独立复评。冻结R3从14重跑，
14/15及16全部模型索引通过；resource存储预检出现COMPLETION_STORAGE_NOT_READY后立即停止，
17未运行，RESOURCE_STORAGE_PREFLIGHT_REVIEW_REQUIRED。失败证据与本轮资源收尾已归档，
没有绕过检查、改真实索引或继续扩展修复。T4/T7 OPEN、DEVICE_PENDING及全部保留边界不变。

后续用户批准存储最小处理，Gate §27.17直接复现媒体空卷重新挂载从0700回到镜像0755；
Dockerfile显式准备两个0700根目录后定点验证及永久反例通过。R4从14重跑，14/15/16通过，
但17因node stdin未进入原smoke主入口，原退出0被判INVALID_EVIDENCE，未计通过。
入口调用及未执行保护仍需接续处理，不能勾选下列完整发布要求。附加健康快照采集失败保留，
本轮资源已定向收尾；T4/T7 OPEN及既有全部保留边界不变，不提交、推送、合并或部署。

用户随后批准仅修正smoke执行器，见Gate §27.18：真实文件CLI、源码摘要、非0退出传播和
未执行拒绝已补齐，相关三套测试36项本机通过。隔离runtime/prepare修订候选及永久反例已冻结，
原业务/存储/原smoke断言未改；SERVER_REVALIDATION_PENDING，尚无新的Ubuntu14–17证据，
不能据此将R4阶段17或下面完整发布要求勾选为通过，T4/T7 OPEN及全部保留项不变。

用户随后接受三项修订复审并授权接续剩余工程目标，见Gate §27.19：索引/目录/smoke代码
评审项CLOSED_REVIEW_ONLY，原冻结及失败记录不覆盖；本线程复审与独立QA来源明确区分。
当前接续新固定候选的Ubuntu14–17复验，服务器认证待恢复；完整release、Git clean和提交
仍有单独授权前提，下面两个完整发布要求继续未勾选，T4/T7总门禁保持OPEN。

后续用户恢复认证，R5按原预算执行14–17全部通过（Gate §27.20）：379项源码匹配、七镜像
受限串行构建、正式健康启动及真实原smoke七请求/91字节读取均有证据；原资源核对与定向收尾完成。
旧R4的17无效证据不改写；仍无完整release01–18或Git clean通过。完整入口的受限构建/新库准备
接入与真实提交、干净检出须按批准边界继续处理，以下完整发布两项仍不勾选，T4/T7 OPEN。

后续用户批准最小入口接入、本地提交和完整隔离验证（Gate §27.21）。完整T7已提交本地专用分支
`codex/t7-engineering-release`，固定代码`6166a3e958ef335cc09ddb82a76dce615d78b8c6`，未推送。
完整R1在04的Git反例因PATH命中Intel Git而失败；R2因一次性执行器安全复评在04受控停止，
两轮均未进入Docker阶段，原服务未变，见Gate §27.22。修订后继续从01执行，不拼接部分结果。

Full R3在11因本机默认Playwright缓存权限失败，12–18未运行（§27.23）。Full R4使用独立缓存及
既有工具从01重跑，01–15及07b/13b通过：家庭4607、前端739、自主学习HTTP35/浏览器54均通过；
16正式健康启动期间触发原持续换页停止规则，17–18未运行。定向收尾完成、原资源一致，
SERVER_SWAP_DIAGNOSIS_REQUIRED，见Gate §27.24及完整发布材料。未满足完整发布，下面两项仍不勾选。

后续一次14–16受控诊断在16的storage准备后因INSPECTION_FAILED/MONITOR_EXIT中止，
没有到达Full R4的健康等待位置，17–18未执行，不能判定历史换页问题解决（Gate §27.25）。
本次73组采样与清理证据已独立核对并归档；用户提出可能人工清理Docker，仍待恢复SSH后只读核实，
不将本机Docker清理等同于Ubuntu远端清理。完整发布要求继续未勾选，T4/T7 OPEN及原保留范围不变。

随后SSH恢复，已只读核对事件/daemon日志和现有资源；事件不覆盖原失败窗口，人工清理及inspect
原始原因仍未知，原资源选定元数据/清单一致。临时监测器补inspect失败留证，字节处理P2修复经独立
8+6项本地测试复核通过，未重跑Ubuntu；历史失败、T4/T7 OPEN及完整发布未通过保持不变。
新归档与哈希见Gate §27.25链接的诊断记录，下一次14–16须另行授权，不能沿用已消耗的一次诊断许可。

用户新批准的一次14–16已完成（Gate §27.26）：新项目inspect-d45d518b、固定6166a3e9，14/15/16
及定向收尾exit0；71组采样中换入36/换出8501页，未触发原连续阈值，不等于零性能影响或旧根因解决。
17–18未执行，完整01–18仍需连续验证，下面完整发布要求保持未勾选；T4/T7及历史/真机/后置状态不变。

依赖：T1–T6。模式：标准；新增孩子入口的授权用严格边界校验。对应工作包 6 工程部分。

修改：成长记录/ReportsPage 的必要入口，ChildTodayPage；需要时新增一个轻量
`frontend/web/src/pages/child/ChildReflectionPage.js` 并在 App 注册，复用现有 growth-logs API。
更新 `docs/user-guide/parent-guide.md`、`child-guide.md` 和本轮 Gate。

- [x] 孩子可填写或由家长代录现有 childReflection；一年级一句话即可；家长沿现有周报反馈。
- [x] 不新增孩子修改 WeeklyReport 的接口；结束周统计继续冻结，反思按既有成长记录语义保存。
- [x] 保留 Task 11 回归，在现有 T2 enabled 集成/E2E 入口增加数学闭环测试：排序 → 求助 → 处理 → 自检 → 上传 → 确认
  → 错题 → 订正任务 → 复习日期 → 成长反思/周报。用可控日期测延迟复习，不让测试真实等待数天。
- [x] 建立两个家庭的合成夹具，一个家庭三个孩子及两位家长，验证越权和代录身份；测试中不放真实孩子数据。
- [x] 执行相关回归、前端构建；再运行完整发布 Gate 并保存版本和日志，不把既有通过记录当新增覆盖。（2026-10-30，0bddeb7e，Gate §27.41）
- [x] 确认发布脚本确实运行了新测试；扩展已有测试入口优先，不为每个包新建一套命令。（同轮07b/13b实际通过，Gate §27.41）

上述勾选仅表示有合成工程证据，不表示总门禁批准。最初完整发布在02-lint的44 errors失败保留；
Full R4已实际执行07b/13b，但16因换页看护终止，不能以分项通过冒充完整01–18通过。
原失败、T4 OPEN、DEVICE_PENDING 和后置责任保留。

最新一次授权完整Full R5（2026-10-29，Gate §27.27）仍固定6166a3e9：01–14含07b/13b通过，
后端4607项、前端739项、浏览器4/1/54项；15构建期间inspect错误触发MONITOR_EXIT，16–18 NOT_RUN。
同轮原始字节哈希及构建日志支持短命中间容器正常删除竞态，不归因人工清理，不覆盖历史失败。
定向收尾完成；完整发布仍失败，上述两项保持未勾选，T4/T7 OPEN。本次一次授权已使用，
监控策略修订及下一服务器运行待明确授权，原预算/停止阈值和全部保留范围不变。

随后用户授权本地监控竞态修订（Gate §27.29）：仅对完整同轮身份、已观察合规限额和正常删除
生命周期均可证明的prepare/mongo-init做一次新快照处理。两项P1/一项P2经永久反例及独立53项
复验修复，开发runner9、9个监控及1个项目注入变异另有证据。归档首轮及后续两次runner夹具失败
保留；最终夹具修正就绪时序，原断言/预算不变，R3独立复跑9项通过，但不代表真实Bash/Compose收尾。
无归属的builder仍失败关闭，R5旧问题不声称消除。
服务器未重跑，完整发布未通过，T4/T7和真机/历史/后置状态均不变；下一远端验证仍需授权。

后续获批一次14–16兼容性复验已执行（Gate §27.30）：仍固定6166a3e9，14通过，15因未观察到
限额的builder容器在list/inspect间消失而安全停止；16–18未运行，完整release未运行。定向收尾
通过并保留本轮失败证据。本次授权已用完；先提出构建生命周期/限额证明的最小处理方案，
不能在同一证明缺口下盲目重跑，也不因监控拒绝正确而关闭T4/T7或完整发布门禁。

随后用户批准保留 legacy builder 的本地最小实现与独立复核（Gate §27.31）：先固定输入与基础镜像、
提前标记同轮身份并保留中间对象，再核验实际限额及完整集合，最后在监控退出后精确清理。
构建终止不明或证据不足仍失败关闭。此次不包含新的服务器运行、提交或发布，完整发布要求继续未勾选；
候选、永久反例与评审结果见 [本地保留构建证据](../../development/evidence/t7-retained-builder-2026-10-29/README.md)。
本地最终源码回归 48 suites / 1189 tests、13 项变异通过，独立源码复核 214 项与外层 mock 56 项通过。
状态仅 LOCAL_REVIEWED；未创建新固定提交或服务器候选授权。远端监控终止和 daemon 兼容性仍待确认，
§27.30 历史失败及 T4/T7 OPEN 不变，不以本地通过替代 14–16 或完整 01–18。

后续用户已批准本地提交、干净固定检出和一次14–16复验（Gate §27.32）。执行前仍须核验远端监控停止
及服务器空闲条件；本批准不包含17–18、完整重跑、安装、推送、合并或部署，不代表任何新阶段已经通过。

当前进展见 Gate §27.33：固定本地提交 `e78ef415`，1875 个源码文件校验一致；远端停止证明已取得，
基础镜像准备因固定 digest 出现在 RepoTags 中而失败，14–16 尚未开始。收尾删除新增 tag 时 Docker 同时
删除 digest/实体，原执行器“digest 已保留”输出已被后续 inspect 否定并保留纠正证据，旧清理入口已停用。
已采集原资源清单一致不等于隐藏引用归属证明；先核清完整基线与收尾方案，不自动重拉或开始新阶段。
本地标签兼容反例通过不替代服务器验证，T4/T7 OPEN 及全部历史/真机/后置状态不变。

后续用户同意继续，已完成完整引用基线与精确新实体收尾的本地修订及独立46项复核（Gate §27.34）。
固定 `e78ef415` 的本轮准备和14通过，但15在首个镜像构建后的容器/镜像提交双向关联校验失败；
当前daemon返回的legacy Container为空，16–18及完整release未运行。本次一次授权已使用。
6个非运行容器及9个镜像实体保留，清理INCOMPLETE；原服务/镜像/卷/网络的既定采集字段一致。
先提出可验证的最小构建来源证明兼容方案，不盲目重跑或按标签清理；T4/T7 OPEN及历史/真机/后置状态不变。

后续独立 rootless 探针授权及失败见 Gate §27.35：依赖已按限定授权安装，slice-fix 候选在 worker
预检阶段退出1，未启动 daemon、拉取或构建，未运行14–18。自有空 slice 已限定停止，审计文件和
运行时配置残留明确保留，原服务既定采集字段一致。当前仅获批本地诊断/凭据上下文最小修订与独立复核，
不授权再次远端运行；来源兼容性、完整发布两项和 T4/T7 总门禁仍未通过，历史及后置状态不变。

后续获批的一次 credential-fix 探针见 Gate §27.36：正常凭据/原服务只读路径已有服务器证据，
但首次快照因 Mounts 排列敏感摘要失败，未启动 daemon、拉取或构建。本轮已限定停止并保留残留和失败。
仅本地 order-fix 修订保留完整挂载内容与真实变化拒绝，32项测试通过；仍待独立复核与新的远端授权，
不能将凭据路径实证等同于 rootless 兼容性、14–17或完整发布通过。T4/T7及全部保留状态不变。

order-fix 后续本地独立复核已通过，32项测试和 bootstrap 检查由复核方重跑，证据/源码绑定见
Gate §27.36；当前剩余前置为新候选的单独远端执行批准，不倒写旧失败，不自动重跑。

用户随后批准的一次 order-fix 探针已使用，见 Gate §27.37。独立 rootless/overlay2 daemon 正常启动，
固定基础镜像拉取因 registry 响应头超时停止；未构建、未验证来源账本、未运行14–18，仍 FAILED_STOP。
候选13文件哈希保持，原服务受检字段一致，预算起点与限额不变；限定收尾仅停止确切自有 daemon/空 slice，
保留数据目录、审计/运行时记录及旧残留。不自动重跑、改网络或安装；先评审有界只读前置诊断。
T4/T7 OPEN、历史失败、Docker INCOMPLETE_FAILED、DEVICE_PENDING、两项非阻断补测及后置范围不变。

§27.37 后续获批的只读网络诊断已完成：主机直连 registry 的IPv4超时、IPv6不可达；原Docker有镜像源、
无HTTP/HTTPS代理。结果只定位前置差异，不证明镜像源可用；未启动daemon或修改网络。先核验可接受的
既有镜像源再决定独立daemon的最小接入，不放宽TLS、固定digest、网络隔离、预算或来源账本。

该限定镜像源只读核验随后获批并完成：单个既有HTTPS镜像源返回401，TLS/目标校验通过，读取子进程
退出及进程组消失已确认；未执行镜像拉取或probe。最小独立daemon接入方案见Gate §27.37所引
`MIRROR-READ-AND-PROPOSAL.md`，本地实施及未来探针授权仍分别待批，原失败和总门禁状态不变。

最新范围裁决（2026-10-30，Gate §27.38）：停止继续扩展rootless/镜像源工具，保留此前增量。
已批准并完成限定本地调整：原release隔离入口将七个候选镜像验收与构建缓存自动清理分离；
输入摘要、固定镜像ID、原限额、未知容器拒绝及原smoke不变。中间对象不自动删除，继续计入原累计
12GiB预算，新`VERIFIED`记录不构成旧清理账本`CLOSED`。准备与正式启动固定验收ID，不再依赖可变标签。
6个本地套件265项通过及定向lint通过仅是开发自查，不是独立/Ubuntu或完整release证据。
后续按完整候选冻结、获批的14–17、获批的干净提交01–18和最终批准顺序推进；环境不支持项目登记
未验证，不阻止其他已授权本地交付，也不计为通过。不再围绕缓存回收扩建监控/恢复框架。
T4人工验收及T4/T7总门禁OPEN，历史失败、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项非阻断
补测及后置范围保留；本轮没有Git或服务器操作授权，未提交、推送、合并或部署。

后续一次14–17及限定接线已获批（Gate §27.39），仅只读确认SSH与历史固定Node镜像引用可查询，
未启动测试。旧执行器要求真实固定提交/干净检出，本轮四文件修订未提交；保持原候选断言，先请求
仅本地提交与干净检出所需授权，不新建替代框架或伪造Git clean。旧自动缓存清理仍不能直接运行。
Node22位置尚未确认、不安装或替换运行时；14–17执行机会未使用，完整release和总门禁仍未通过。

随后已从历史记录定位并实际核实`/usr/local/bin/node`为v22.15.0/arm64，本轮6套件265项在该
运行时通过（开发自查，非Ubuntu/独立复评）。没有安装；固定提交授权仍待答复，14–17未运行。

后续仅本地提交与干净检出已获批准，接续限定执行器接线及一次14–17；不推送/PR/合并/部署。
历史失败、Node26与Node22自测来源及未完成的完整01–18保持分列，固定提交不等于验收通过。

该次执行现已完成并停止：固定提交`5d8c0fafa0143059b4f69f62f66782329e5cceeb`，14通过，15的
Gateway构建成功后原容器Mounts顺序比较失败，16–18未执行。限定接线独立复核和服务器实际失败
证据分列，见Gate §27.39及`t7-candidate-run-sfsrip-2026-10-30/RESULT.md`。监控/凭据/转发已收尾，
FAILED账本拒绝自动资源清理，停止builder和缓存保留继续计费；没有重跑、推送或部署。
下一步仅建议局部排序规范化及真实变化拒绝反例，不扩建工具；新服务器执行需授权，完整发布待验。

上述排序修复现已本地完成：10项永久用例，开发6套件275项通过，独立两套件88项通过，既有比较/
预算/清理边界保留；冻结增量见Gate §27.39和`t7-mount-order-2026-10-30/RESULT.md`。尚未新增提交
或服务器复验；下一步待授权固定新候选后复验14–17，不能用本地通过覆盖原失败或完整release缺口。

随后获批并完成本地提交`0bddeb7e18200d3fd9e5879c096dd7229df538a2`及一次新候选14–17：
七镜像VERIFIED、正式健康启动、原HTTP smoke（91 bytes）和限定收尾通过。预算起点不重置，
缓存保留，原资源检查通过；证据见Gate §27.39及`t7-mount-run-gr4xby-2026-10-30/RESULT.md`。
下一步待批准固定候选的完整release01–18（含07b/13b）；本轮未执行18、不拼接历史通过，不提交
新结果记录/推送/合并/部署。T4人工及真机、T4/T7 OPEN和后置范围不变。

随后获批一次同SHA完整01–18（含07b/13b），实际在12的Chromium启动权限错误停止（Gate §27.40）。
01–11及07b通过，04为158套件4805通过/1既有跳过，09为57套件739通过；12四项启动失败，
13/13b/14–18未执行。原预算监控无告警、原服务器资源最终只读一致、凭据/转发已收尾；自动清理因
未到构建阶段缺少候选记录而退出1，该失败不改绿。下一步先核清本机浏览器启动权限，另获一次完整
运行授权；不改业务或断言、不拼接历史结果、不扩建工具。以下完整发布验收仍未完成，T4/T7 OPEN。

限定本机归因及剩余材料见Gate §27.40末尾：单目录fs.watch在当前执行上下文也报EMFILE，文件
上限1048575，内核限额读取被拒绝；未改限额/权限/轮询或重跑。环境阻断先记录，其他材料已核对，
但不把未执行阶段计为通过；待受控权限核验及新一次完整运行授权，不另建发布/测试框架。

随后获批的限定本机权限对照通过：同一Node22/目录/Chromium在受控非沙箱上下文中完成单目录
监听和空白页启动，1724ms退出0且进程组已消失。证据与适用边界见Gate §27.40；不修改产品或
测试断言，不把最小环境检查当完整回归。下一次完整01–18仍待单独授权，T4/T7 OPEN不变。

随后用户批准新一次完整运行，固定0bddeb7e、新干净目录及受控本机执行上下文；实际连续01–18
含07b/13b全部通过，最终runner及外层清理均退出0（Gate §27.41）。158后端套件4805通过/1既有
跳过，前端739，07b35，浏览器4/1/54，原smoke91bytes及18干净检出均有本轮日志。原预算及原
资源不变，缓存按批准保留；旧失败不覆盖。关闭申请材料已归并，T7总门禁待用户明确批准；T4人工、
真机、依赖安全告警和全部后置义务不因此完成，不提交/推送/合并/部署。

验收：SL-01–06 有代码/测试对应；孩子页可用、家长工作可完成、周报统计没被新功能改坏。

2026-10-30用户明确批准限定合成工程总门禁关闭（Gate §27.42）：T7为APPROVED / CLOSED /
ENGINEERING_SYNTHETIC_ONLY，绑定0bddeb7e及§27.41本轮完整验收、独立证据复核。上述历史待批准和
失败快照不覆盖；T4仍OPEN，DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项非阻断、依赖风险及
高级恢复/新回收后置保持。T8/T9不自动启动；本次仅更新本地记录/状态校验，不提交推送合并或部署。

### T8：家庭 Ubuntu 发布、备份恢复和回滚验收

**2026-11-08范围裁决：** 保留本节真实启用前的备份、恢复、权限、重启和回滚验收目标；
自研可信启动器、claim/代次管理及原生监督链的未完成增强先记录后置，不要求为MVP开发完成先做完该平台。
已取得的本地/分批证据不升级为完整发布通过，T8仍OPEN。后续最小演练方式另行评估和授权，
不以有人监督替代必要的隔离、预算、停止或原业务断言；详见[当前范围与后置项](../../development/t4-t8-joint-acceptance.md#0-mvp-优先与后置范围2026-11-08)。

依赖：发布需 T7；只读环境清点可从 T0 开始。模式：严格。对应 SL-07。

**当前交付（2026-11-03）：** PR #36 已以 merge commit `c0e16594762fca194c1a51fcf518fd4024b41180`
合入 main，[合并后 CI 41559078175](https://github.com/mflyn/LMS/actions/runs/41559078175)通过。
仅本地准备/合成工程入库，T8 总门禁 OPEN；NAS、目标 Ubuntu、真机、
删除证据恢复、RPO/RTO 与回滚待验不变。以下按日期保留的是当时授权和执行快照，
其中“未授权提交/合并”不再描述当前 Git 状态；服务器执行和真实部署仍需单独授权。详见 Gate §29.34。

同日获批继续不依赖 NAS 的本机合成验证（Gate §28.5）：正式恢复增加 user-service，清空会话后
真实密码/PIN 登录，原命令、作品、版本审核、三孩子隔离与 PIN 重置的限定 HTTP 验证通过；
同步归档工具阻塞修订及失败历史保留。两类显式演练共 15 项通过，不代替下列真实环境清单。
完整[剩余发布条件](../../development/evidence/t8-nonnas-20261103/README.md#剩余发布条件)区分
已完成的本机浏览器、需授权的 Ubuntu/回滚、NAS 暂缓及删除恢复硬阻断；T8 总门禁仍 OPEN。

同日按授权优先补齐[恢复后真实浏览器闭环](../../development/evidence/t8-browser-20261103/README.md)
（Gate §28.6）：当前前端构建和七个正式应用工厂，在真实恢复的新库上完成孩子重登与原命令恢复、
家长版本冲突/审核、孩子刷新回看及账号切换拒绝。Chromium/WebKit 各 11 项、默认 HTTP 10 项通过。
两项测试 P2 经修订与独立只读复核通过；失败历史不覆盖，不将模拟视为 iPad 真机、独立容器、NAS 或发布验收。
本机后续记录尚未提交；T4/T8/AI-1 OPEN、DEVICE_PENDING 及全部后置义务保持。

2026-11-04基于最新main `a4f051e2`完成[本地收口复验](../../development/evidence/t8-closeout-20261104/README.md)（Gate §28.7）：
原190件归档核验、当前前端构建、修订后双引擎各11项和默认归档/HTTP15项通过。
仅修复迟到浏览器关闭失败传播的夹具P2，新增两反例且独立单测13项通过，待用户验收；不冒称独立浏览器复验。
本批与AI-1文档、AI-2合并后记录分组，尚未提交；同版本合成恢复不替代跨版本/目标机/NAS/删除证据恢复。

同日后续复审通过并获用户批准：本批T8本地收口ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY，
迟到浏览器关闭失败传播P2 CLOSED / USER_APPROVED；上段待验收为历史快照。
原候选/补丁及97/27件归档与本轮13项单测0.521秒复验绑定，见[批准记录](../../development/evidence/t8-closeout-20261104/README.md#用户批准及本轮复验证据)。
T8及T4/AI-1总门禁仍OPEN，DEVICE_PENDING、历史失败和后置责任不变；AI-2合并状态与交付分组保持，未授权Git写入或部署。

2026-11-05另获专用分支/Draft PR交付授权，见[本地收口交付](../../development/evidence/t8-closeout-20261104/public-delivery.md)。
仅保存已验收合成增量，不合并、不部署；历史权限快照和T8 OPEN / RELEASE_NOT_READY保持。

当前仅本地准备获批（Gate §28），不等于真实发布或恢复执行获批。先修订 §7.4 与只读前置检查，
补 NAS/容量/停写/卷归属/竞态/脱敏反例并自查；独立复评后再明确合成备份恢复的环境与预算。
前置检查不会创建备份或自动停止/恢复服务，不能代替下列实测验收。后续采集必须包含独立删除日志卷，
全站写入者排除不能只靠完成协议暂停开关。失败保留受限证据，不自动清理缓存或旧备份。

2026-10-30 用户明确 NAS 暂不准备，先做不依赖 NAS 的本机合成归档往返（Gate §28.1）。
该预演不替代下列发布/恢复验收；NAS 上传、异机恢复、Ubuntu 版本兼容与业务恢复仍待验证。

后续用户批准本机正式应用恢复验证（Gate §28.2）：真实 dump/restore 后，经原预检及正式四服务 HTTP
验证作品、持久原命令、权限、审核版本和发星幂等；此限定合成路径当前 6/6 通过。
严格删除恢复发现 v1 证据不足 `LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`，不扩展后置恢复。
不替代 NAS、目标 Ubuntu、登录/浏览器、最新删除日志重放或 RPO/RTO，下列真实验收项不据此勾选。
本地交付已按用户要求核对并整理（Gate §28.3），仅 LOCAL_TECHNICAL_ACCEPTANCE_PASS；
完整范围/摘要与原始结果副本已准备，尚无本批 Git 提交或服务器执行授权，T8 总门禁保持 OPEN。

修改（确有需要时）：`docker-compose.ubuntu.yml`、本地 Ubuntu 部署指南、本轮 Gate。
部署目标：既有家庭电脑与局域网，不新开公网端口，不启动 DeepTutor/K12。

- [ ] 记录主机实际运行的代码/镜像版本、Compose、磁盘/内存、Mongo 副本集、媒体卷、NAS 备份状态。
  不在计划或日志写真实凭据、孩子资料或作业内容。
- [ ] 发布前按既有指南做一致性备份，在隔离目录/测试数据库恢复并核对数据库、媒体和引用；
  NAS 未挂载/空间不足时备份必须失败告警，不能误写主机目录后声称 NAS 备份成功。
- [ ] 将新增索引和缺省初始化在恢复副本演练；保存变更前版本和恢复操作，真实环境写入前按仓库
  严格模式取得对应授权。清理/覆盖真实数据需另行明确授权。
- [ ] 维护窗口停止新写入，部署匹配的后端与前端版本，初始化必要索引；提示 iPad 刷新缓存。
- [ ] 启用 completionMediaIds 前验证本地 remoteOperationId 唯一索引、resource operation 复合唯一索引及
  新协议/client/软删除/回收路径同版本；禁止旧无 operation 路径处理新字段。回滚保留两端命令记录及
  不可变映射，待恢复命令使用支持映射的新协议版本处理。缺失映射的试验命令阻止启用，单独评审修复，
  不允许用客户端 UUID 兜底/回填或删除记录绕过；执行 TC-SL-REMOTE-ID-004 的隔离备份恢复验收。
- [ ] 使用测试账号完成三孩子隔离、图片回看、重复提交、求助处理、确认与星星、容器重启检查。
- [ ] 检查只暴露既定入口，私有媒体未变公开；按已有家庭部署访问保护方案验收。
- [ ] 演练回滚：发布尚未接收新写入时可恢复旧镜像和已验证快照；收到新写入后先停写并备份
  新状态，优先修复前进。旧后端可能绕过新冻结/引用规则，不能只回滚镜像继续写。
- [ ] TC-SL-PRIVACY-005：隔离停读写恢复删除前快照，合并最新受保护删除日志并重放禁读/释放，
  旧签名不得读出正文；凭证缺失不得开放。核实实际备份保留期（示例 7 日/4 周/12 月），不声称在线
  30 天清理同时删除所有备份。需真实数据/快照清除时另行授权，当前仅使用合成数据演练。
- [ ] 如必须回到旧数据快照，列出将丢失的时间范围，取得数据回退确认；不得自动覆盖试点新记录。

验收：实际 iPad Safari 通过；备份及隔离恢复可核对；记录实测 RPO/RTO 和回滚限制。
本轮无新增重服务；AI 关闭时全部功能可用，主机压力不影响核心写入。

### T9：四周数学家庭验证与 MVP 关闭

依赖：T8。模式：实际使用与观察，涉及记录按现有私有入口。对应工作包 6 家庭部分。

唯一价值判定规程：[增量 Gate §14](../../development/family-self-directed-learning-mvp-gate.md#14-t9-轻量价值验收规程)。
顺序：一周轻量无干预基线 → P0 人工预演/最小 P1 实现 → T8 后四周正式家庭验证；开发可并行，不能把
干预期记成干净基线。T0 已发生记录不重写，基线尚未取得就如实记缺失，不补造。

- [ ] 家长确定教材版本与当前单元；两个一年级可共享教学材料，但学习记录各自保存。
- [ ] 每孩子分别确认基线至少 3 个自然学习日；正式四周每周至少 2 次简记及一次亲子复盘，选择 1–2 个
  适龄观察焦点。启动/计划/自检/求助/学习证据与家长提醒、投入、冲突、疲劳、睡眠和屏幕负担一并记录。
- [ ] 执行 TC-SL-VALUE-001..006 的缺失/停止/不排名规则；基线缺失或污染最高 PARTIAL，不以能用或打卡判 PASS。
- [ ] 按 Gate §14.1/§14.2 核对可比学习证据、负向事实及调整后复核；执行 §14.3 的
  TC-SL-VALUE-007..015 合成反例，验证唯一结论与判定优先级。合成反例通过不替代真实家庭观察，
  不新增考试/任务量或用主动性积极例子覆盖学习效果问题。
- [ ] 第 1 周：每人 1–3 项焦点任务，检查作品和求助路径，记录操作阻碍和家长耗时。
- [ ] 第 2 周：使用自检清单和孩子排序，观察一年级代录负担、四年级能否自己操作。
- [ ] 第 3 周：完成至少一道真实错题的订正和延迟再练习，核对来源与复习提醒。
- [ ] 第 4 周：覆盖至少一个数学单元，进行知识图或口述复盘，记录孩子和家长下一步建议。
- [ ] 每周使用约 3 个学习日作为试点目标；生病、假期等中断只记录原因，不补刷任务或清零。
- [ ] 保存简短结论：每名孩子的启动/自检/求助情况、家长投入、持续摩擦、是否增加冲突或屏幕负担。
  真实内容保存在家庭系统，仓库 Gate 只保存匿名结论与验证日期。
- [ ] 按 Gate §14 给每孩子及总体 PASS/PARTIAL/FAIL；记录限制、停止/重启和后续行动，不算总分或排名。

验收：工程 M4 与家庭 M5 分别有结论；若仍需修复，写明确剩余项而非“全部通过”。只有此后
才按家庭实际需求选取一个后续扩展。

## 6. 验证命令与执行频率

以下是将来执行计划的命令，不表示本次编写计划已运行这些功能测试。

| 时机 | 命令/方式 | 预期证据 |
| --- | --- | --- |
| 文档/契约变更 | `npm run docs:family:check`、`git diff --check` | 文档与契约检查通过；草案/计划另检查链接与代码块 |
| 各后端包 | `npx jest --config=backend/jest.config.js --coverage=false --selectProjects homework-service --runInBand` | 任务服务测试通过；媒体/分析修改追加对应项目 |
| 涉及多服务 | `npm run test:family-regression` | 家庭相关回归通过 |
| 前端包 | `npm run test:ci --prefix frontend/web -- --runInBand` | 新组件/API 测试和既有家庭测试通过 |
| 前端发布前 | `npm run build --prefix frontend/web` | 构建成功 |
| T7 | `npm run test:family-flow:integration`、`npm run test:family-flow:e2e` | 已纳入新数学闭环的集成和 Chromium 测试通过 |
| 目标配置 | `docker compose -f docker-compose.ubuntu.yml config -q` | 在正确的受保护环境文件上下文中校验，不输出密钥 |
| 正式发布候选 | `npm run release:family` | 包含第二家长与既有功能的完整发布记录 |
| T8 | 实际 iPad Safari、Ubuntu 重启、NAS 隔离恢复 | 不能用 Chromium 或 Compose 语法通过替代 |

局部修改先运行相关测试，工作包交付时运行受影响回归；完整发布 Gate 在集成候选上运行，
不要求每次编辑运行。该 Gate 包含 Git 清洁检查；提交/推送仍需用户授权，未授权时记录该
发布前置条件，不为通过检查擅自提交或修改门禁。

## 7. 交付记录与范围变更

每个 T 任务仅在验收完成后勾选。记录在同一份增量 Gate 中，至少包含：

| 字段 | 要求 |
| --- | --- |
| 范围 | SL 编号、T 编号、涉及文件 |
| 版本 | 实际代码版本/补丁与配置版本，区分未提交状态 |
| 证据 | 执行命令、时间、结果、日志位置；失败写明原因 |
| 兼容 | 老任务、新字段默认值、旧页面行为、权限拒绝 |
| 恢复 | 备份、媒体恢复、回滚或前进修复限制 |
| 状态 | 未开始/进行中/工程通过/家庭验证中/关闭，不把计划写成完成 |

实施发现范围扩大时，只修正阻断当前闭环的缺口；新增功能进入储备清单，不顺手实现。
本计划中的接口选择若与执行时已有代码发生冲突，先修改相应正式契约和本计划，再改代码。

## 8. MVP 后储备与独立对接路线

| 扩展 | 启动依据 | 独立最小切口 |
| --- | --- | --- |
| 重复模板 | 家长重复布置确实费时 | 模板生成独立单次任务 |
| 复习视图/算法 | 人工安排复习成为持续负担 | 先只读到期列表，再评估算法 |
| 支架趋势/结构化反思 | 备注和现有反思不足以支持判断 | 最少字段与解释，不上能力评分 |
| DeepTutor | 家长讲解/选题准备成本高 | §9 AI-0 可提前验证；AI-1～AI-3 正式接入按条件单独启动 |
| K12 | 知识点映射确为瓶颈 | §9 AI-0 先核对覆盖；K12-1 单章节只读辅助，不阻塞 DeepTutor |
| 打印/PDF/语音 | 出现反复具体需求 | 一次只扩展一种输入或输出 |
| 长期学习项目 | 符合系统设计第 18 节门槛 | 单孩子 LearningProject + GrowthTask 关联 |

储备不要求按表顺序执行，也不要求先集成 AI 才能开发长期项目。本轮结束后重新选择即可。

## 9. DeepTutor 与 K12 最小对接路线（2026-10-26 补充）

**当前入口（2026-11-03）：** AI-1 为 ENGINEERING_SYNTHETIC_ACCEPTED / MERGED_DEFAULT_OFF，B/D/AI-1 OPEN；
LMS PR #37 已合入 main：`4655d30f1b61b55f400b67f16f9143dd191de1d2`，
[合并后 CI 41564246688](https://github.com/mflyn/LMS/actions/runs/41564246688)通过；
个人 fork mflyn/DeepTutor PR #1 已合入 main：`a5e64ca49667ddba2a0ba80c02ac1c59959dc2f9`，
[合并后 Tests 第3次运行](https://github.com/mflyn/DeepTutor/actions/runs/41466687632/attempts/3)通过。
前两次 runner 分配失败保留，既有外部 fixture 浏览器作业 skipped，不算通过；不是向 HKUDS 上游交付。
35项本地合成工程已验收，双仓 CI 与限定合并已完成，详见 Gate §29.34。
下文按日期保留演进记录，不将旧待办、旧 Git 禁止条件或旧分支状态当成当前状态。
剩余计数资格、另行费用授权、真实调用及人工价值验收见[测试方案§17](../../development/family-ai1-test-plan.md#17-当前35项工程归并与外部待验2026-11-01)；
双仓交付核对和小批真实验收准备见该方案§17.2～§17.3，当前不实现counter、不调用模型、不提交推送或部署。
三组已批准适配文本及完整Provider正文已冻结，主线程与独立复核证据见该方案§17.5～§17.6及Gate §29.30～§29.31；
当前仍缺合格计数依据，冻结及复核不构成真实发送、费用授权或总门禁关闭。
原提交/PR授权见测试方案§17.7及Gate §29.32；后续用户单独批准限定合并，记录见 Gate §29.34。
技术计数资格仅暂缓而未豁免，QUALIFIED_COUNTER_PENDING、另行费用授权、人工审核和未知结果边界保持；
AI-0 的费用/人工价值证据不移作 AI-1 验收，真实发送关闭，未部署。

状态：路线已获用户同意并纳入规划，尚未执行能力验证或对接开发。本次仅修订文档，
不授权安装服务、外部模型调用/费用、上传资料、真实部署或自动启动以下任务。
以上为 2026-10-26 的历史状态。2026-10-31 当前增量：AI-0 单次 Provider 合成初测及家长审核已完成，
结论为有条件继续（人工核验、修订后才可作家长备课候选），不代表完整页面/Agent/K12 验收。
用户已选择 AI-1 三项最小方向；2026-11-01 已批准详细设计/API/测试方案及 A 批验收，当前 B_IMPLEMENTING。
已授权 B 批本地无真实模型实现、测试和评审，未授权真实模型调用、提交推送或部署；AI-1 总门禁 OPEN。
B 本地候选复审已获用户批准，矛盾退款 P1 / 原始 JSON 大小 P2 CLOSED；三版本详情已纳入永久测试。
B 整体仍 OPEN / EXTERNAL_IMPLEMENTATION_PENDING；剩余任务与源码/授权前置见 Gate §29.6，C/D 不自动启动。
随后用户以持续目标明确授权 LMS 本地 B/C/D 开发与合成验证，现 C_IMPLEMENTING；这项新授权替代上一句的后续启动限制，
不扩展为外部服务修改或付费/部署授权。C 页面证据及未完成范围见 Gate §29.7；
D 正式装配进行中，默认关闭读取/传输边界见 Gate §29.8，发送准入和完整跨层验收仍待完成。
后续D2本地运行态、启动预检与正式HTTP生成/只查询恢复见Gate §29.9；外部实际实现、正式浏览器和完整矩阵仍未完成。
后续D3真实LMS页面的双入口/共管审核/原命令及重登恢复已合成验证，35项逐行核对见测试方案§11和Gate §29.10。
远端仍是协议替身；正式浏览器剩余权限/失败组合、实际DeepTutor/Provider和人工价值验收未齐备，B/D/AI-1不关闭。
后续 D4/D5 已补本地正式浏览器权限、账号切换和失败组合，仍不能替代真实外部组合验收。
用户随后批准 DeepTutor v1.7.1 固定基线本地实现：持久层、独立 operation app 与受限 SDK 路径进度见 Gate §29.13～§29.15。
正式 main 本地装配和生命周期验证随后完成，见 Gate §29.16；SDK 验证仅使用合成计数器与网络/响应替身，
实际 LMS client→正式 main TCP 组合随后补齐用例并通过独立复评，见 Gate §29.17；完整 v4 token 上界、
LMS业务费用/页面到实际远端的本地组合随后补齐，冻结候选及独立验收进度见Gate §29.19；
旧快照隔离的分层反例和三项测试保护补强见Gate §29.20；不等同双端同轮备份恢复验收，不改变B/D/AI-1 OPEN。
后续实际双端合成恢复组合见Gate §29.21，区分局部事务准备、正式HTTP及Provider替身；不授权生产恢复或解除隔离。
当前工程归并以测试方案§17和Gate §29.22为准；实际双端合成恢复已验证，不再列作未实现前置。
2026-11-01用户批准上述限定合成工程候选验收，当前ENGINEERING_SYNTHETIC_ACCEPTED，见Gate §29.24；不关闭AI-1总门禁。
本轮补七项既有要求的故障窗口反例，不增加业务能力；独立结果以Gate最终记录为准。
实际v4计数/费用核验及人工价值验收仍待完成，B/D/AI-1 OPEN；
缺真实计数依据时默认拒绝发送，不将 AI-0 预算或历史 1.7.0 验证转为新版本启用许可。
详见 [AI-1 设计](../specs/2026-10-31-family-ai1-minimal-design.md)、
[API 契约](../../api/family-ai1-api.md)、[测试方案](../../development/family-ai1-test-plan.md)。
AI-0 的 10 元费用授权不转为 AI-1 预算；主线未关闭/后置义务不变。
T1～T9 是自主学习基础 MVP，不是整个 AI 平台交付清单；其任务编号、关闭条件和当前实施顺序不变。
AI/K12 任务独立编号，不把它们塞入 T3～T7，也不把高级恢复/回收重新作为前置。

### 9.1 与主线的衔接及启动条件

2026-11-03 AI2-1 文档工作已获授权：仅完成[最小差异设计](../specs/2026-11-03-family-ai2-minimal-design.md)、
[API 候选](../../api/family-ai2-api.md)、[测试方案](../../development/family-ai2-test-plan.md)，设计待用户批准，
AI2-2～5 未编码/未执行。当前入口见 Gate §30，不将旧完整设计或 AI1 合并视为孩子发布权限。
后续顺序：AI2-2 学习包/审核事务 → AI2-3 合法媒体类型/持久提交恢复 → AI2-4 页面及会话隔离 →
AI2-5 正式 HTTP/浏览器/相关回归。计数资格/NAS不阻塞本轮合成设计，但真实调用/使用仍受AI1/T8约束。
随后2026-11-03用户批准AI2-1三稿及产品取舍，关闭两项设计P1，授权AI2-2本地合成实施；当前AI2-1 APPROVED、AI2-2 IMPLEMENTING。
AI2-3～5仍NOT_STARTED，正式装配/媒体完整提交尚未实现；独立路由工厂验收不等同完整页面或AI-2总门禁关闭。
AI2-2后续本地候选已完成测试/自查/独立评审修复，READY_FOR_ACCEPTANCE；定向33项、homework全量1519项和文档313项通过。
证据与失败保留见测试方案§6/Gate§30，待用户批次验收；不自动进入AI2-3，不关闭AI-2总门禁。
后续用户批准AI2-2限定合成验收及本次P2关闭，授权AI2-3实施；当前AI2-2 ACCEPTED、AI2-3 IMPLEMENTING、AI2-4/5 NOT_STARTED。
AI2-3后续本地候选已完成持久提交/精确补偿、认证媒体及正常删除边界验证，当前READY_FOR_ACCEPTANCE；两项本批P2 FIXED_REVIEWED。
homework1576、resource1931及新权限49项、最终专项60/HTTP3、文档313项分别通过，保留失败历史，不累计重叠覆盖。
49文件累计补丁重建/哈希一致，交付及独立复核见[AI2-3索引](../../development/evidence/ai2-3-20261103/README.md)。
正式装配及跨进程metadata transport尚待AI2-5；AI2-4/5 NOT_STARTED、AI-2 OPEN，不以本批替代页面/真机/生产验收。

后续用户批准AI2-3限定本地合成验收及两项测试保护P2关闭；绑定最终候选与独立复验证据见测试方案§7.5。
当前AI2-3 ACCEPTED、AI2-4 IMPLEMENTING（家长发布/审核、孩子订正/回看、原命令及身份隔离），
AI2-5 NOT_STARTED、AI-2 OPEN；正式装配/浏览器整体验收另批，不变更历史失败、DEVICE_PENDING及既有后置范围。

AI2-4后续页面候选已完成本地实现、自查与聚焦独立复核，当前READY_FOR_ACCEPTANCE，未由用户批准验收。
家长发布/撤回/按所见版本审核、孩子图片订正/历史反馈、原命令与身份隔离已接入前端；
63套996项前端回归及生产构建通过；浏览器是生产React+显式API替身，非正式端到端。
最终两个测试globalThis机械修订的定向验证、冻结哈希及失败历史见[AI2-4索引](../../development/evidence/ai2-4-20261103/README.md)。
下一批AI2-5仍需正式runtime/Gateway/metadata transport、真实HTTP及浏览器闭环；不以本批关闭AI-2或其他OPEN门禁。
绑定冻结候选与独立33项复跑证据，旧送审/失败快照保留；AI-2总门禁及既有未关闭、后置状态不变。
AI2-4后续复审发现普通刷新丢失部分上传失败状态的P2，授权最小生命周期修订和真实组件反例。
新候选66文件、前端64套1000项通过，原996/95及失败保留；新浏览器仍是API替身，正式验收不提前。
修订及独立复核状态以[草稿刷新P2索引](../../development/evidence/ai2-4-20261103/draft-refresh-p2.md)为准，
AI2-4仍待用户验收、AI2-5 NOT_STARTED、AI-2 OPEN；不自动启动下一批。

2026-11-03最新用户批准AI2-4限定合成批次验收、草稿刷新P2及其他本批已复审P2限定关闭，并授权AI2-5正式应用接线。
当前AI2-4 ACCEPTED、草稿刷新P2 CLOSED / USER_APPROVED、AI2-5 IMPLEMENTING、AI-2 OPEN；以上送审记录保留为历史快照。
绑定66文件候选`b1a52ef373fe8df1b3a7299e62be7c38f88786720cc674c549058805e63b9dc3`及最新主线程复验：
4套90通过、旧行为变异2失败/2通过、还原后2套10通过，零skip；临时探针不计永久覆盖，重叠运行不累计。
原始证据另存冻结候选目录的`review/main-8PwilZ/`，新manifest绑定、不覆盖旧哈希，详见[验收记录](../../development/evidence/ai2-4-20261103/draft-refresh-p2.md#用户批准与最新主线程复验)。

AI2-5按[设计§7](../specs/2026-11-03-family-ai2-minimal-design.md#7-开关启用与回退)接入正式应用：
`AI2_MODE=off|enabled`默认off、`AI2_STORE_CONTINUOUS`默认false；启用及安全关闭后历史读写需连续性true且completion enabled；
启动事务/索引和正式connection检查，Gateway raw JSON 32 KiB+JWT，homework正式公共/内部媒体授权路由，
resource受现有服务凭据保护的`POST /api/internal/media/ai2/inspect`只读metadata接口，禁路径/正文bytes。
off且连续性false不降级旧协议，maintenance保持隔离。接口请求/响应见[API§5.1](../../api/family-ai2-api.md#51-ai2-5-正式metadata-inspect接线契约)。
实际实现、正式HTTP/浏览器及相关回归/构建结果由主线程另补[测试方案§9](../../development/family-ai2-test-plan.md#9-ai2-5-正式应用接线)，
本次只记录文档，不预写通过、不新设审批框架、不调用模型/Git/部署。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED与T9 NOT_STARTED保持。
不自动启动AI3/K12；T4/T8/AI1 OPEN、DEVICE_PENDING及既有失败/后置状态保持。

AI2-5正式接线子批已形成86文件修订候选，完成三服务正式HTTP实现与本批连续性返回边界P2补强；
具体验证和剩余项以[本批索引](../../development/evidence/ai2-5-20261103/README.md)为准。
异步隔离P2为FIXED_REVIEWED待复审；AI2-5仍IMPLEMENTING，下一步是正式浏览器闭环及最终验收，
不将本批接线或既有API替身浏览器视为全部AI2-5完成。

2026-11-03最新用户批准：AI2-5正式接线限定合成子批ACCEPTED / USER_APPROVED，
异步连续性P2 CLOSED / USER_APPROVED；上述待复审记录保留为历史快照，AI2-5整体仍IMPLEMENTING、AI-2 OPEN。
批准绑定86文件候选`b6b22e3c6992bc12da0fdcbcb6742cd4c416c7def64a0ef9bf0a03ea310920cf`及最新独立复核：
homework 4套86、resource 3套68、Gateway 2套87，共9套241项通过，零失败/跳过。
家庭全量185套5554项、Gateway全量14套132项及历史变异仅核验归档，不重跑、不累计为新覆盖。
verification及原始复核产物另存新review子目录，不覆盖133份旧证据manifest或旧文档manifest，
见[正式接线批准记录](../../development/evidence/ai2-5-20261103/README.md#正式接线用户批准与浏览器接续)。

用户授权下一步正式浏览器：由主线程独立实现browser fixture/test并执行正式服务闭环、刷新/重登、
原命令未知结果恢复、账号隔离/审核冲突及对应前端回归/构建；本次只更新批准文档，不增加代码/测试，不宣称浏览器通过。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED与T9 NOT_STARTED保持，不调用模型、不执行Git或部署。

AI2-5正式浏览器最新候选：Chromium最终8项一次通过、零跳过/重试，runtime 6、共享T2 HTTP 6套36、
前端64套1003通过，构建成功保留旧caniuse警告；正式七服务及Mongo/media/fs/auth/login，不以业务成功替身完成闭环。
AI1仅人工批准合成artifact预置，query-only与拒绝sentinel零调用；network故障限丢真实响应/延迟/abort一上传，无Provider调用。
同URL回看P2的3永久组件反例已红绿、独立组件35通过、逐handler变异分别2失败/33通过和1失败/34通过；
recovery四例unchanged保护缺口已补并静态复核，主线程最终8项实际通过。两项P2待本轮用户复审，不CLOSED。
Kepler独立WebKit初轮执行中已报告四项主/边界场景在最终健康断言失败，完整结果待补，不计全绿；接线ACCEPTED及原连续性P2 CLOSED保持，
AI2-5整体IMPLEMENTING、浏览器候选待用户复审、AI-2 OPEN。
pre-WebKit快照92文件hash `06c6d407c0a002f79f40287c0baed354ec21d6c4279d0bc02ad127f2b96b9b32`，相对接线9变更/新增，排除无关T8；
patch、全部已知结果/失败历史与待补WebKit归档见[浏览器验收候选](../../development/evidence/ai2-5-20261103/browser-acceptance.md)。
只归档log/JSON到新validation，不复制build或独立临时源码、不改旧approval manifest；旧全量不重跑、重叠计数不累计。
WebKit当前观察为登录后硬导航中断Today请求产生access-control pageerror；待本轮结束后再修测试helper等待初始化响应，
保留errors断言，修订后新冻结候选。当前不改helper、不写最终hash，旧06c6及失败保留。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002及其他后置边界不变，无模型/Git/部署。

AI2-5 WebKit修订后最新事实：初轮独立7失败/1通过、exit1，七项均在初始化请求被硬导航中断的errors健康断言失败；
旧92源码/构建指纹前后一致，无本轮新增进程遗留。main只改login夹具，注册真实Today初始化任务/通知/dailyplan（明确childId），
parent另等weekly/mistakes，每个200且finished为null后导航；产品、原健康断言及超时不动。
main定向WebKit1通过14.7秒；随后独立完整WebKit8通过101.656秒、零跳过/重试，收尾核验已完成。
新92文件candidate `54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a`，
patch `9a760baacb605d94fc5fdc7efe8ee0eb9ba9721dbdea145caf56830fe295aeee`；相对assembly9项、较pre-WebKit仅fixture变化。
main同候选Chromium最终8通过、exit0、99.541秒（`chromium-verified.json/.log`），零跳过/重试；lint-final全仓0无输出。
独立`webkit-final-verification.json`确认92源码/8构建文件/config前后哈希一致，无本轮process/root残留，旧root不动。
两项本轮P2 FIXED_REVIEWED / USER_REVIEW_PENDING，不CLOSED；本地正式浏览器候选已完成待复审。
实际命令见[Node22与Playwright入口](../../development/evidence/ai2-5-20261103/browser-acceptance.md#实际命令入口)：既有NODE_PATH/T2_WEB_BUILD、playwright.t2.config.js及三个正式spec，WebKit加`--browser=webkit`。
`execution-summary.json`中frontend 64/1003、HTTP 6/36为本批已有执行，非最终双浏览器阶段新重跑；旧backend 185/5554为接线历史证据，本轮未重跑。
旧06c6、最初pre-WebKit Chromium8、独立WebKit7失败/1通过及approval manifest保持；最终validation/manifest由main统一归档并另补哈希。
本次仅文档不重复归档或运行校验；AI2-5 IMPLEMENTING、AI-2 OPEN及旧边界不变。

2026-11-03后续用户批准正式浏览器限定合成子批ACCEPTED / USER_APPROVED，同URL回看及recovery不变量保护
两项P2 CLOSED / USER_APPROVED，绑定上述54fac3b1候选及最新独立组件35/WebKit8（110.124秒）复验。
原始复验20文件另存候选`review/user-approved-20261103/`，manifest为
`7cff9dafe168f9f24532a33d0b0d6735fba28abcd6706bdf60f5cac982677886`，旧失败/manifest不覆盖。
AI2-5汇总IMPLEMENTING、AI-2 OPEN；下一步仅需补真实AI1人工修订/批准→Tutor入口发布的合成连接证据，
将测试矩阵逐项关联既有永久用例/结果，缺项补验后准备总门禁关闭评审材料，再由用户批准。
本批浏览器从预置approved制品开始，不替代测试方案§1及AI2-PUB-01/FLOW-01的连接要求；
可复用既有Provider替身，不需要计数资格或真实调用，不增高级恢复/新回收或测试框架。
真机、真实家庭启用和T8/AI1义务仍待验，所有历史失败、OPEN/DEVICE_PENDING/后置边界保持。
详见[当前剩余条件表](../../development/evidence/ai2-5-20261103/browser-acceptance.md#总门禁剩余条件)，本次不授权Git或部署。

2026-11-03接续实施：完成31行矩阵归并，新增两文件正式AI1→AI2合成连接，任务/错题双来源各通过
Chromium/WebKit，共4项66.36秒；组件6套224、服务/正式HTTP2套30通过。复用真实DeepTutor operation/SDK和
合成Provider，实际人工修订/共管批准而非预置；无业务改动或真实发送。候选94文件、旧92源码不变，
冻结及当前独立复验见[连接记录](../../development/evidence/ai2-5-20261103/bridge-acceptance.md)。
三项测试保护P2经静态复核、作者四格及独立WebKit两格（37.474秒）通过；2026-11-04再复审原四格4通过79.73秒，用户批准连接批次及三项P2 CLOSED / USER_APPROVED。
最新31项17核心覆盖/14部分，剩余提交竞争、终态重放和特定权限/删除组合须继续最小补验或明确裁决；
不将连接通过当作矩阵全覆盖。AI2-5 IMPLEMENTING、AI-2 OPEN及历史失败/DEVICE_PENDING/后置范围不变。

2026-11-04接续：用户批准连接批次及三项P2；只在两测试新增9个竞争/终态反例，homework全部AI2 10套188通过，
五项隔离变异有效；新测试异常收尾P2补强不提前关闭。最新矩阵20核心/11部分，详见[增量记录](../../development/evidence/ai2-5-20261103/concurrency-acceptance.md)。
无需新业务/API/审批框架；本增量待复审，未授权Git/部署或总门禁关闭，保留全部历史与后置范围。

2026-11-04后续：用户已批准上述竞争/终态增量及屏障异常收尾P2关闭，绑定独立9项最新复验。
继续按授权补发布版本变化、来源快照、输入边界：四测试新增21项，homework AI2 206项和相关组件204项通过，
四项变异有效，产品源码不变。冻结、独立复评和剩余分类见[本批记录](../../development/evidence/ai2-5-20261103/publication-boundaries.md)。
本批仍待用户验收；不擅自后置剩余矩阵要求，不关闭AI-2总门禁，不执行Git/模型/部署。

2026-11-04后续用户已批准该发布/快照/输入补验，绑定原冻结与最新独立18/3证据，见上述记录批准节。
继续仅本地补AUTH-01、RECOVER-04、SESSION-02；历史失败及未关闭/DEVICE_PENDING/后置范围不变。

本批补验新增后端9/组件7；真实PIN重置、原actor撤权恢复及recover拒绝隔离均有永久反例，业务源码不变。
开发215/211与独立定向结果、P3测试收尾修订分开，见[验收候选](../../development/evidence/ai2-5-20261103/auth-recovery-boundaries.md)。
矩阵26核心/5部分，剩余五项不自动后置；本批待复审，不关闭AI-2或启动下一业务范围。

| 轨道 | 与 T1～T9 的关系 | 启动条件 |
| --- | --- | --- |
| AI-0 单章节能力验证 | 可在主线期间独立进行，不占用主线交付依赖；其失败不阻塞 T4～T9 | 用户选定一个年级、教材版本、章节及合法可用资料；确认工具版本、执行位置、调用方式和费用上限后另行启动 |
| AI-1 家长侧候选讲解 | 复用 T1/T2 的媒体与权限、T6 的错题来源、T7 的基础闭环；不依赖 T2-G | AI-0 的 DeepTutor 部分具备可用结论，T6/T7 相关闭环工程验证通过，家长确认备课负担值得解决，用户明确授权接入 |
| AI-2 孩子学习与人工订正 | 依赖 AI-1；复用 T2 交付入口和 T6 来源连接，不以普通任务确认替代教学审核 | 家长候选审核和孩子可见性门禁已验证，单章节学习包及人工订正规则明确 |
| AI-3 变式题与复习记录 | 依赖 AI-2；复用 T6 复习日期与现有学习记录 | 订正审核闭环稳定，家长确认少量变式题有用，再授权该增量 |
| K12-1 单章节课程辅助 | 不要求 AI-1/2/3 全部完成，也不是其硬前置；只提供可选课程证据 | AI-0 已核实教材覆盖和代码/数据许可证，手工映射有实际负担；用户选择接入该章节 |

默认先完成 T9 基础家庭验证，再启动正式 AI 接入。若家长在试点中已确认内容准备是主要瓶颈，
可另行批准在 T9 期间开展 AI-1/后续增量；真实孩子使用仍须满足 T8 的目标机、权限及备份验收。
记录引入日期、使用任务和家长准备/审核负担，基础流程与 AI 辅助结果分开分析；
不得把混合使用冒充四周纯基础基线，也不得以 AI 演示替代 T9 原价值验收。
T3 求助不自动调用 AI；T4 清单、T5 日计划、T7 周复盘保持原范围。AI-0 不产生新的主线门禁。

### 9.2 AI-0：有限的能力验证，不先建设集成平台

范围：只选一个年级的一章，不同时覆盖一年级和四年级。用 3 组家长编写的合成/脱敏输入，
分别覆盖基础概念、典型错因和章节内应用；每组生成一份短讲解及 2 道变式题（含供家长审核的答案/解法）。
最多进行两轮提示调整，仍不合适则记录结论并结束，不为通过验证新建 Adapter、模型或数据迁移。
仅使用有权使用的片段，不上传姓名、孩子原始手写图片、账号标识或整本教材；不把生成结果直接给孩子。

记录最少信息：输入范围、项目提交/版本、模型与提示版本、输出、家长修改、耗时、调用费用（无法获知则标未知）。
家长逐项检查数学正确性、答案一致性、年级可理解性、教材范围和提示是否代替孩子思考；
比较“直接人工准备”与“生成加审核修改”的负担，不以生成速度或一次成功作为有效性证明。
K12 部分只抽查本章少量节点：教材/年级/版本、知识点含义、来源、必要先修关系和许可证；
匹配不了就记录缺口，不能用名称相似冒充覆盖，不全量导入图谱。

验收产物是一份简短验证记录，不是新测试框架。DeepTutor 与 K12 分别判定：
- 可继续：样例内容经家长审阅可用，无遗留数学/超纲问题，修改负担可接受，来源及成本边界清楚；这是小样本可行性，不是教学效果证明。
- 有条件继续：限定可用题型/节点及不可用范围，用户确认限制后才能进入相应正式接入。
- 不继续或证据不足：写明原因及手工替代，结束验证，不自动扩展工程。
K12 不通过不否定 DeepTutor：可先使用家长确认的章节资料及手工知识点信息。

### 9.3 正式集成的最小交付与验收

| 任务 | 最小交付 | 必须通过的验收 |
| --- | --- | --- |
| AI-1 | 家长从同孩子的错题/任务发起讲解；LMS 经受限 DeepTutor Adapter 获取 candidate；家长预览、拒绝或批准 | 内容可追溯；未批准不可被孩子 API/页面读取；超时/未知结果不盲目重新生成；授权、费用边界和人工降级有效 |
| AI-2 | 批准讲解呈现为孩子学习包；孩子在纸上/iPad 订正并上传；家长按提交版本审核、退回或通过 | 原题、讲解、订正及审核同源可追踪；越权/旧版本拒绝；普通任务确认不自动判为掌握；不依赖 OCR |
| AI-3 | 家长审核订正后显式发起 2～3 道变式题；家长批准后孩子作答；人工最终审核并关联错题和复习记录 | 保留题目/作答/审核；按既有契约仅在人工最终通过后写入掌握证据，重试不重复；不直接覆盖旧审核，不自动无限出题 |
| K12-1 | 先静态版本化章节卡片/有限索引；确需查询时才加只读 Adapter；家长确认/解除课程映射 | 返回可追溯版本与来源；缺失节点明确提示；不接收或保存 familyId/childId/孩子答案，不推断掌握度；关闭后手工流程可继续 |

各项遵守既有 AI 设计及契约，不重建通用编排、上传协议或新常驻微服务。
AI-1 的已批准最小 profile 明确替代旧完整平台中与本轮不兼容的必填课程节点、WS Agent 和
只支持 approve/reject 的版本规则，采用纯文字来源、持久单次 operation 和人工修订新版本。
以新设计/API/测试稿共同评审为准；旧 v1 schema 不原地放宽，也不能将本段当成实现验收。
只落实该项使用的最少模型/API 和必要失败路径；不以“最小”绕过 candidate、批准、Attempt 版本、幂等和最终审核规则。
正式编码前对照当前实现确认复用点和差异，避免照搬旧设计中已由 T1～T7 完成的基础能力。
不因旧 AI 分期提到 PDF、打印、周报扩展或 Graph API 而一并实施；本路线仍使用当前图片范围。
不做任意聊天、本地大模型、重型 OCR、全量向量检索、全量图谱和自动学习决策，不重新引入 AutoClaw。

### 9.4 工程边界与交付方式

一次只授权/交付一个有家庭价值的增量：简短差异设计 → 实现与定向测试 → 聚焦评审 → 相关集成验收。
不要求每个内部步骤审批、独立计划或全仓冻结；当前路径安全缺陷必须修复，非阻断建议记录后置。
外部项目 API/版本与许可证须在启动时核实，不把历史文档或本路线视为兼容证明。
真实家庭部署与外部数据发送单独授权；X230i 优先保 LMS，外部组件按需运行、限制并发，
AI/K12 不可用时保留手工讲解、选题和审核，不拖垮任务服务。已有数据不得因关闭扩展而删除。
任务状态区分未启动、验证中、可行/有限可行/不继续、工程完成、真实使用验证；
某项完成不自动启动下一项，也不修改 T1～T9 原验收结论。

### 9.5 AI3 当前批次进度（2026-11-04）

当前状态以§9.5.3的2026-11-05用户批准为准；本节及§9.5.1/§9.5.2保留各批次历史。

AI3-D 限定合成批次及完整请求32KiB P2/历史UNKNOWN P3已获批准，
见[独立冻结与验收绑定](../../development/evidence/ai3-d-size-20261104/acceptance.md)。
AI3-E 继续既定孩子作答与私有媒体：持久原命令、所见发布内容绑定、精确媒体代次、
实时认证读取、撤回竞争与删除后占位；当前为本地工程候选，待本批用户验收。
本批无公开路由或页面装配，不将服务调用与内部真实HTTP组合测试称为正式浏览器验收。
后续仍需家长最终审核、复习效果写回、前端和正式应用组合验收，不扩大高级恢复或回收。
AI-3、T4/T8/AI-1 OPEN；DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、
非阻断补测、计数资格待验及后置范围不变。无真实模型、提交推送、合并或部署授权。

#### 9.5.1 后续集成进展（2026-11-05）

以上9.5保留E候选当时的装配边界。当前后续代码已接入最终人工审核、analytics/progress效果、
家长/孩子页面及LMS正式应用；[当前进展与验证分层](../../development/evidence/ai3-integration-20261105/README.md)
记录真实AI1→AI2→AI3四组浏览器闭环、原命令恢复、历史失败及修订后完整回归。
当前家庭210套6331项、前端71套1163项、正式HTTP入口50应用/HTTP加57断言项和最后四组浏览器通过；
双仓145+14源码累计补丁已重建验证，28项覆盖与独立复评见[验收准备](../../development/evidence/ai3-integration-20261105/engineering-readiness.md)。
这不是E用户批准，也不是AI-3总门禁关闭；AI-3保持OPEN / ENGINEERING_VERIFIED / USER_ACCEPTANCE_PENDING，其他既有未关闭状态不变。

#### 9.5.2 完整候选复审修订（2026-11-05）

先修复历史超限预留退款、pending草稿生命周期和分页未决锁三处问题，并将遗漏的analytics测试
接入现有家庭回归；永久反例、复验和新冻结身份见[修订记录](../../development/evidence/ai3-integration-20261105/review-fixes.md)。
上述9.5.1数量与补丁保留为原候选快照；本次修订后再评审AI3-E和总门禁，不提前关闭。
本轮修订限定复核已通过；新累计源码147+14文件。家庭全量6406过/2项Git启动失败、exit 1；
系统Git优先原两套定向106项通过，仍保留全量失败与JSON导出失败，不能合称全绿。
T4/T8/AI-1 OPEN、DEVICE_PENDING、历史失败、非阻断补测及后置范围保持，不扩展高级恢复或新回收。

#### 9.5.3 AI3-E及限定合成工程总门禁批准关闭（2026-11-05）

- [x] 三项行为修订、遗漏analytics回归接入及永久反例验收通过。
- [x] 系统Git优先，原家庭入口213套6408项一次通过、exit0，旧失败原样保留。
- [x] AI3-E及后续工程ACCEPTED / USER_APPROVED；AI-3 CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY。

见[关闭批准与证据](../../development/evidence/ai3-integration-20261105/closure-review.md)。
这是当前已批准合成范围的工程关闭，不是新一轮真实模型、真机、Git交付或部署授权。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测、
QUALIFIED_COUNTER_PENDING与REMAINDER_DEFERRED保持；无关T8和AI1/AI2文档增量继续分组。
