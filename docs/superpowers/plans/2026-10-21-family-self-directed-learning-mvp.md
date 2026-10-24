# 家庭自主学习 MVP 开发计划

> 状态：执行中（T0 已完成，T1 后端工程已关闭，T2 合成工程已关闭，T3-T9 待执行）；T1/T2 仅限既定合成验收，DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED 和 REMAINDER_DEFERRED 保留，不代表完整功能交付或真实部署获批。
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
2026-10-24 最新用户明确批准 T2-2 至 T2-6 限定合成范围工程验收及总门禁关闭；T2 CLOSED（ENGINEERING_SYNTHETIC_ONLY），三项 P2 CLOSED。最新全量仍 FAILED：143套件142通过/1失败，3943项3942通过/1失败，D2B-05 保留后置且未关闭。
JWT 过期、完成快照兼容投影和上传正文同步三项 P2 均 CLOSED；原两项页面 P2 关闭不变。
最新全量结果、前端40/490、HTTP2/14及浏览器14项等已有证据见[执行记录 §16](../../development/family-self-directed-learning-t2-execution.md#16-三项-p2-批准关闭与工程验收再申请2026-10-24)；当前批准及状态验证见[执行记录 §17](../../development/family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)。旧收口及旧失败证据原样保留，不以工程批准冒称全量全绿，不自动启动 T3–T9。
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

修改：任务模型/路由、`TasksPage.js`/`TodayPage.js`、`ChildTaskPage.js`、两个 API 模块；
新增 `growthTaskHelpService.js` 及 `__tests__/services/growthTaskHelpService.test.js`。
求助列表优先使用任务查询筛选和分页，不新增 notification worker。

拟议接口（在 T0/本包正式契约中固定）：
`PATCH /api/growth-tasks/:taskId/help`，请求 `action=request|resolve`、expectedHelpVersion；
request 带 helpType/note，resolve 仅家长允许并可带短答复。嵌入一条当前 helpRequest，
包括版本、pending/resolved、实际 actor、服务端时间；不覆盖既有 needsHelp 的完成时回顾含义。

- [ ] 写测试：pending 时 request 不改变任务状态；孩子不能 resolve；其他孩子/跨家庭拒绝；
  两个家长处理同一版本、旧 resolve 与新 request 竞争不能关闭新求助；孩子和家长提交相同正文
  不能互相冒充重放。
- [ ] 实现当前求助原子更新，说明最多 200 字。request 的安全重放必须同时满足：当前记录仍为
  pending、`currentHelpVersion === expectedHelpVersion + 1`、规范化后的 `helpType + note` 完全相同，
  且认证 actor 与 `requestedByActor` 相同。其他旧 request 返回 `409 VERSION_CONFLICT`；
  旧版本 resolve 返回 `409 VERSION_CONFLICT`，客户端刷新后不自动重复用户动作。
- [ ] 家长任务查询增加 helpStatus 过滤和现有分页；取消/归档排除，completed 的未处理求助保留。
- [ ] 在孩子页面独立提供“我需要帮助”，家长页面提供处理入口；完成写入不能清空求助。
- [ ] 增加表单与 API 组件测试、真实 Gateway 拒绝测试。

验收：孩子没做完也能求助；没有确认、发星、改掌握等副作用；家长可找到并处理。

### T4：短检查清单与基本分龄交互

依赖：T3。模式：严格（字段、并发）；页面部分标准。对应工作包 3。

修改：`GrowthTask.js`、`growthTasks.js`、completion 服务、家长/孩子任务页面与测试。
沿用现有 child profile 年级，不新增儿童画像或学习风格分类。

- [ ] 写测试：清单 0–5 项、itemId 唯一、label 1–100 字、未知 checkedItemId 拒绝、
  pending 才能改清单、旧任务无清单；创建时未提供或显式提供空清单为 `checklistVersion=0`，
  提供非空有效清单为 `checklistVersion=1`；覆盖家长修改与孩子完成并发。
- [ ] 实现 checklistSnapshot/checklistVersion，完成请求带 expectedChecklistVersion；
  同一原子完成条件同时校验 task status、completionVersion 和 checklistVersion。
- [ ] 未勾选项允许如实保留；独立求助始终可用，不能强迫孩子勾全才能求助。
- [ ] 一年级默认少字段、大按钮，家长代录标明实际 actor；四年级显示估时和自检提示；
  年级未知时采用简洁通用界面，可由家长调整现有年级资料。
- [ ] 验证一次清单变化不会使旧幂等命令被重新执行；成功重放与新请求的版本检查有明确区别。

验收：同一组业务字段适用三个孩子；不实现语音、自动朗读、S0–S4 采集或两套客户端。

### T5：今日计划、任务顺序与孩子估时

依赖：T4。模式：严格。对应工作包 4。

新增：第 2 节 DailyLearningPlan 模型/路由/service，及 homework 下对应模型、服务、路由测试。
修改：homework/server、gateway/server、ChildTodayPage、API 包装与前端测试。

契约沿设计：`GET/PUT /api/children/:childId/daily-learning-plans/:localDate`。
注意 Gateway 的 `/api/children` 原有归属：只把具体日计划路径代理给 homework，不能把全部
children 路由改向。验证家长资料、PIN、已有 children 操作不受影响。

- [ ] 写模型测试：唯一 familyId/childId/localDate，最多 20 项且 taskId 不重复，估时可空或整数 1–240。
- [ ] TC-SL-ESTIMATE-001..004：短/中/长映射 5/15/30 或留空；新增/改分钟记录 estimateRecordedBy，
  仅排序保持原归属、updatedByActor 为本次操作者；清空归属/旧数据 unknown；伪造 actor 字段和跨孩子拒绝。
  父母共管仍按实时成员检查；CAS 失败不写审计，旧版本客户端无需提交审计字段。
- [ ] 写首次并发创建测试：不存在时 expectedVersion=0，成功保存 version=1；唯一索引竞争
  返回 409，后续 CAS 更新递增；GET 不存在返回空计划/version=0，不在 GET 时隐式写入。
- [ ] 只允许写家庭“今天”；历史只读，未来计划留后续。逐项验证同孩子任务归属，新增项限 pending；
  当日已完成项目可保留展示，取消/归档项目不再可行动，旧任务仍能从普通任务列表查找。
- [ ] 日计划不修改 dueDate、不复制 task status；服务端读取时依据当前任务状态投影。
  未选中的到期任务保留在“其他待办”，避免孩子排序后遗漏学校作业。
- [ ] 孩子上下移动任务并可选估时，家长 estimatedMinutes 不被覆盖；家长代录明示实际输入者，不计独立估时。
  冲突提示重新选择，不自动重放覆盖他人；数字/图标快捷值可互换，不新增能力画像。
- [ ] 加入午夜、无权限、首次并发、同一任务跨日参考、不同孩子同日期和旧 Gateway 路由测试。

验收：顺序可保存且孩子间独立；无拖拽依赖、周排课或时间优化算法。

### T6：人工错题、订正与延迟复习连接

依赖：T5（业务上主要依赖 T2）。模式：严格。对应工作包 5。

修改：`FamilyMistake.js`、`routes/familyMistakes.js`、`GrowthTask.js`/路由、MistakesPage、TasksPage、
API 包装及对应测试。关联字段目标：错题可有 sourceTaskId；订正任务可有 sourceTaskId 或
sourceMistakeId。均为可选，不要求回填历史对象。

- [ ] 在正式契约中固定来源字段和跨服务受控读取；子域所有者验证真实资源，不相信客户端的孩子信息。
- [ ] 来源不存在和跨家庭/跨孩子来源对公开调用统一返回 `404 RESOURCE_NOT_FOUND`，真实原因只
  进入脱敏内部审计，避免资源存在性侧信道。
- [ ] 从任务详情进入现有错题表单，预填 subject/来源，家长填写错因和知识点；从错题进入
  现有任务创建表单建立订正任务；两个动作分别明确提交，不建设跨服务原子向导。
- [ ] 不把 task_completion ID 直接写入 mistake_answer；第一版提示家长重新上传正确 purpose 的图片。
- [ ] 创建后能回到来源；来源已不可读取时显示“来源不可用”，不泄露其他孩子标题或媒体。
- [ ] 使用现有 reviewReminderDate 和提醒；复习题由家长准备；不自动更新 corrected/mastered。
- [ ] 写测试：同 scope 成功、兄弟姐妹/跨家庭/不存在来源拒绝、purpose 错误拒绝、服务失败可重试、
  一个步骤成功另一个未做时保留已保存内容。沿用原创建接口重试语义，不承诺尚未实现的全局去重。

验收：一条真实错题走完来源、人工判断、订正和约定日期复习；无需 AI、K12 或自动判题。

### T7：周复盘导航与完整工程回归

依赖：T1–T6。模式：标准；新增孩子入口的授权用严格边界校验。对应工作包 6 工程部分。

修改：成长记录/ReportsPage 的必要入口，ChildTodayPage；需要时新增一个轻量
`frontend/web/src/pages/child/ChildReflectionPage.js` 并在 App 注册，复用现有 growth-logs API。
更新 `docs/user-guide/parent-guide.md`、`child-guide.md` 和本轮 Gate。

- [ ] 孩子可填写或由家长代录现有 childReflection；一年级一句话即可；家长沿现有周报反馈。
- [ ] 不新增孩子修改 WeeklyReport 的接口；结束周统计继续冻结，反思按既有成长记录语义保存。
- [ ] 在 Task 11 集成/E2E 入口增加数学闭环测试：排序 → 求助 → 处理 → 自检 → 上传 → 确认
  → 错题 → 订正任务 → 复习日期 → 成长反思/周报。用可控日期测延迟复习，不让测试真实等待数天。
- [ ] 建立两个家庭的合成夹具，一个家庭三个孩子及两位家长，验证越权和代录身份；测试中不放真实孩子数据。
- [ ] 执行相关回归、前端构建；再运行完整发布 Gate 并保存版本和日志，不把既有通过记录当新增覆盖。
- [ ] 确认发布脚本确实运行了新测试；扩展已有测试入口优先，不为每个包新建一套命令。

验收：SL-01–06 有代码/测试对应；孩子页可用、家长工作可完成、周报统计没被新功能改坏。

### T8：家庭 Ubuntu 发布、备份恢复和回滚验收

依赖：发布需 T7；只读环境清点可从 T0 开始。模式：严格。对应 SL-07。

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

## 8. MVP 后储备，不在本轮排期

| 扩展 | 启动依据 | 独立最小切口 |
| --- | --- | --- |
| 重复模板 | 家长重复布置确实费时 | 模板生成独立单次任务 |
| 复习视图/算法 | 人工安排复习成为持续负担 | 先只读到期列表，再评估算法 |
| 支架趋势/结构化反思 | 备注和现有反思不足以支持判断 | 最少字段与解释，不上能力评分 |
| DeepTutor | 家长讲解/选题准备成本高 | 依既有 AI 契约做候选、人工批准与审核 |
| K12 | 知识点映射确为瓶颈 | 单教材章节静态卡片 |
| 打印/PDF/语音 | 出现反复具体需求 | 一次只扩展一种输入或输出 |
| 长期学习项目 | 符合系统设计第 18 节门槛 | 单孩子 LearningProject + GrowthTask 关联 |

储备不要求按表顺序执行，也不要求先集成 AI 才能开发长期项目。本轮结束后重新选择即可。
