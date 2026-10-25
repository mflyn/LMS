# 家庭自主学习 MVP 增量 Gate

> **2026-10-24 最新范围裁决：** 用户批准取消高级恢复/新孤儿回收对页面开发的前置阻塞。
> T2-G 未完成范围及用户删除恢复 D2b 剩余、D3/D4/E 为 REMAINDER_DEFERRED，D01 未关闭；
> §21 及后续旧进度为历史快照，不表示继续扩展这些模块。T2 限定合成工程总门禁已关闭（§22.6），T1 CLOSED 不变；D2B-05 查询超时单独批准关闭（§22.7），原失败保留。
> T2-2 至 T2-6 合成范围汇总验收 CLOSED；保留权限、幂等、版本、隐私删除和现有启动预检，不自动启动 T3–T9。
> 当前页面退出条件及真实试点限制以[执行记录 §11](family-self-directed-learning-t2-execution.md#11-2026-10-24-mvp-范围调整与页面运行依赖)为准。
> 不把后置等同测试通过；最新四项独立QA及仅本地收口边界见§22.11，暂停此前条件合并，不授权部署。

**Status:** T0 CONTRACT BASELINE
**Increment:** SELF-DIRECTED-LEARNING-MVP-1
**Current implemented baseline:** FGT-MVP-1.7, 38/38 COVERED
**Recorded at:** 2026-10-21
**Base commit:** `79b34615`
**Implementation status:** `SL-01` 至 `SL-07` 仍 PLANNED；T1 后端已关闭，T2 合成工程已关闭，真机、T7 集成和完整产品验收未完成
**Current revision review:** APPROVED，用户确认复审通过；R3-LEARNING 与后续门禁 P2 均 CLOSED，T0 门禁完成。详见 §17，不代表 T1 或真实家庭效果通过。
**T1 latest review:** APPROVED / CLOSED，2026-10-23 用户批准关闭 T1 后端工程总门禁及 R4 汇总项（§18.40）；R1–R4 均 CLOSED。
**T1 closure scope:** BACKEND_SYNTHETIC_ONLY
**Production deployment:** NOT_AUTHORIZED

**T2 latest review:** 限定合成工程及三项 P2 原关闭不变；D2B-05 查询超时复审通过、用户批准 CLOSED（§22.7）。原批准时的失败快照保留，高级恢复及新回收仍后置。
**T2 closure scope:** ENGINEERING_SYNTHETIC_ONLY
**T2 approval:** APPROVED
**T2 approval-time full regression:** FAILED / D2B-05 / REMAINDER_DEFERRED
**T2 latest full regression:** PASSED / CI 40099315976 / e744cba1
**D2B-05 query timeout:** APPROVED / CLOSED / QUERY_ONLY
**T2 device:** DEVICE_PENDING
**T2 deployment:** T8_PENDING / NOT_AUTHORIZED
**T2 deferred:** REMAINDER_DEFERRED

本 Gate 记录自主学习增量的契约、执行状态和证据。T0 完成只表示后续开发不再自行发明接口、
版本、迁移或错误语义；不表示作品、求助、清单、日计划、订正连接、家庭部署或四周试点已经完成。

权威输入：

- [产品增量需求](../product/family-learning-tracker.md#14-自主学习-mvp-增量需求planned)
- [增量架构契约](../architecture/family-learning-tracker-architecture.md#12-自主学习-mvp-增量架构契约planned)
- [增量 API 契约](../api/family-learning-tracker-api.md#14-自主学习-mvp-增量-api-契约planned)
- [自主学习系统设计](../architecture/family-self-directed-learning-system-design.md)
- [执行计划](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md)
- [需求追踪](./family-growth-requirement-traceability.md#planned-autonomous-learning-increment)

## 1. T0 基线证据

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| Git 基线 | `79b34615` | 执行前 `main` 与 `origin/main` 指向同一提交；自主学习规划文档为本地未提交内容 |
| 本地运行时 | Node `v26.9.0`、npm `11.19.1` | 高于项目和 CI 的 Node 22 基线；T1 进入代码实现前应在 Node 22 重跑基线 |
| 根依赖 | present | 未在 T0 重新安装或升级依赖 |
| 前端依赖 | present | 未在 T0 重新安装或升级依赖 |
| 后端家庭回归 | PASS | `npm run test:family-regression`：81 suites / 896 tests |
| 前端家庭回归 | BASELINE FAIL | `npm run test:ci --prefix frontend/web -- --runInBand`：27/29 suites、181/183 tests 通过；2 个既有断言失败 |
| 既有失败 1 | `ChildTodayTasks.test.js` | 测试仍查找 `mistakes`，当前 UI 显示“错题数据” |
| 既有失败 2 | `Task9ReportsRemindersRewards.test.js` | `findByText` 预期单一“今天还有 1 个任务”，当前页面有标题和正文两个匹配节点 |
| T0 文档门禁 RED | PASS AS EXPECTED | 先增加 T0 校验，因缺少 Gate 和 SL 契约失败，证明新增检查能捕获缺口 |
| T0 文档门禁 GREEN | PASS | `npm run docs:family:check`：23 approved、4 proposed self-directed-learning、8 proposed AI、22 AI contracts、388 fixtures、38 requirements |

上述前端失败发生在 T0 修改权威契约之前，不计为自主学习增量引入的回归；T0 不修改业务代码
或测试断言。T1 开始前需决定是否单独关闭这两个基线问题，并在本 Gate 记录新旧失败对比。

## 2. 计划需求状态

| Requirement | 最小范围 | 当前状态 | 首次实现任务 | 最终工程 Gate |
| --- | --- | --- | --- | --- |
| `SL-01` | 图片作品、稳定引用、幂等、版本确认、家长/孩子回看 | PLANNED | T1/T2 | T7 |
| `SL-02` | pending 任务独立求助和家长处理 | PLANNED | T3 | T7 |
| `SL-03` | 0 至 5 项清单、版本和基本分龄交互 | PLANNED | T4 | T7 |
| `SL-04` | DailyLearningPlan、排序和孩子估时 | PLANNED | T5 | T7 |
| `SL-05` | 任务、错题、订正任务和复习来源连接 | PLANNED | T6 | T7 |
| `SL-06` | 复用孩子反思和家长周报反馈的周复盘 | PLANNED | T7 | T7/T9 |
| `SL-07` | 家庭部署、备份恢复、回滚和四周验证 | PLANNED | T8 | T8/T9 |

## 3. T0 至 T9 执行状态

| Task | 状态 | 退出条件 |
| --- | --- | --- |
| T0 | CONTRACT_BASELINE | PRD、架构、API、追踪、Gate 和文档校验固定；不含功能实现 |
| T1 | CLOSED | 用户批准后端工程总门禁，仅限合成验收；R4 汇总关闭见 §18.40，不代表前端或真实部署完成 |
| T2 | CLOSED | APPROVED / ENGINEERING_SYNTHETIC_ONLY；T2-1/T2-R 及三项 P2 CLOSED，T2-2 至 T2-6 汇总批准关闭（§22.6 / 执行记录 §17）；D2B-05 查询缺陷单独 CLOSED（§22.7），原失败快照保留；DEVICE_PENDING，T8_PENDING / NOT_AUTHORIZED，T2-G REMAINDER_DEFERRED |
| T3 | NOT_STARTED | 未完成任务可求助，家长处理且无任务/奖励副作用 |
| T4 | NOT_STARTED | 清单版本、代录审计和一年级/四年级交互通过 |
| T5 | NOT_STARTED | 日计划首次并发、CAS、LocalDate 和 Gateway 路由通过 |
| T6 | NOT_STARTED | 一条真实错题走完来源、订正和延迟复习连接 |
| T7 | NOT_STARTED | SL-01 至 SL-06 纳入集成/E2E 和完整发布 Gate |
| T8 | NOT_STARTED | 家庭 Ubuntu、iPad、NAS 恢复和回滚有实测证据 |
| T9 | NOT_STARTED | §14 每孩子及总体价值判定；总体 PASS 才关闭，PARTIAL/FAIL 不冒充完成 |

T1 关闭索引见[验收清单归并](./family-self-directed-learning-t1-acceptance-reconciliation.md)。
原 35 个条目及四个收尾工作包已核对，T1 范围内的工程汇总项随 §18.40 关闭；后续任务责任不计为已完成。
§18 的历史批次和失败事实保留，归并记录见 §18.30。

## 4. 固定接口和并发语义

### 4.1 完成作品

- 完成请求必须携带 `operationId`、`expectedCompletionVersion` 和
  `expectedChecklistVersion`，即使没有图片也不能走旧的无版本写路径。
- `completionMediaIds` 最多 10 张、保持顺序、不可重复，且只接受同 scope 的
  `task_completion` 图片。
- 幂等唯一作用域固定为
  `familyId + childId + taskId + actorId + action + operationId`。
- 同作用域同请求哈希重放原结果；同作用域不同哈希返回 `409 IDEMPOTENCY_KEY_REUSED`。
- 服务端为每条命令（含空新增集合）生成 UUID `remoteOperationId`，远程标识与首次命令占位同事务持久化。
  本地建立全局 remoteOperationId 唯一索引并保留原业务唯一索引；不同 actor 使用同一 UUID 必须分配不同远程标识。
  业务键竞争重读原命令；仅远程标识碰撞且占位事务确认回滚、无远程调用才可重分配。提交未知先恢复
  原事务结果/重读命令，不重建映射、不发送未确认持久化的标识。映射不可变且随终态保留、不单独 TTL；
  重试/重启/运维恢复复用，缺失映射阻断告警、禁止客户端 UUID 兜底。公开输入拒绝此字段，响应不返回它，
  规范请求哈希不包含生成标识。
- 内部 operationId 必须取持久化 remoteOperationId：prepare/commit/abort/status(operation) 保持内部
  字段 operationId，响应身份及摘要/作用域须匹配。新增 bindingOperationId 为当前远程标识，保留项沿用旧值；
  unbind 命令使用当前远程标识，但移除项使用持久化旧 bindingOperationId，releaseOperationId 只审计。
  references 模式不传命令标识；纯删除也复用映射，但不创建空远端 operation。
- 命令保存不可变成功响应投影 `successResponse`，与发布同事务写入，SUCCEEDED 后返回；字段为
  正式 API 的 taskId、status、两个版本、有序 mediaIds、引用状态、parentConfirmed、completedAt。
  后续更新/确认/归档不改变重放投影，当前状态另行 GET；不保存备注/图片正文/签名 URL，不授予媒体访问权。
- 每个任务最多一个活动完成命令：`activeCompletionOperation` 持完整 scope，首次 CAS 要求为空，
  恢复 CAS 验证 owner/阶段/版本。从占位到终态，完成新写、清单编辑、任务编辑、确认、取消和归档
  的最终原子写入拒绝活动意图或 pending_recovery，返回 503；材料 pending 也阻止新完成占位。
  鉴权/schema/同 key 异正文冲突及终态重放先于锁检查；独立 help 局部更新，恢复后新写重新 GET。
- 任务版本或清单版本不匹配返回 `409 VERSION_CONFLICT`，不产生部分写入。
- pending 意图保存可脱离客户端恢复的最小规范业务 patch 及哈希，终态清除临时 patch；不保存图片
  正文、签名 URL 或客户端时间。
- 旧稳定引用与目标顺序分为新增集合、保留集合和移除集合：只绑定新增、保留项沿用旧代次、发布
  后只解绑移除；各阶段不发送空媒体命令。纯重排或仅更新非媒体字段只本地发布，删除图片仍解绑非空移除集合。
- 媒体引用结果未知返回 `503 MEDIA_REFERENCE_PENDING`，恢复必须沿用原命令，不创建新命令猜测。
- 首次命令在任何远程媒体调用前，必须在本地事务中持久化命令占位、pending 意图和目标代次，
  再以 CAS 设置 `mediaRemoteOutcomeUncertain=true`；只有该 CAS 成功后才能 prepare/commit。
- 恢复入口固定为完全相同的完成 PATCH 与原 operationId，或读取持久化意图的受控运维恢复；
  GET 不触发恢复，也不允许生成新 operationId 猜测远端结果。
- 本地 schema/数量/重复 ID 校验在命令占位前完成。仅首次进程内 prepare 直接返回可信、结构
  完整且带匹配 commandHash 的 ABORTED 终态的稳定业务拒绝时，以事务/CAS 把命令收敛为
  失败、清除 pending 意图并恢复上一稳定引用。该路径不得递增 `completionVersion`、改写完成证据
  或执行 bind/unbind；同一命令重放相同失败，修正请求使用新的 `operationId`。
  恢复执行不得凭后来收到的稳定 4xx 清理意图；首次拒绝的失败收敛结果未知时仍以原 operationId 返回并恢复
  `MEDIA_REFERENCE_PENDING`。
- resource-service 为新完成字段持有 `MediaReferenceOperation`，唯一 scope/field/operationId，
  其中 operationId 为 remoteOperationId；校验 commandHash（含本地客户端 operationId、actor/action）和
  规范新增集合摘要；status/abort 使用内部凭据、不经 Gateway。内部同键异摘要仍阻断告警，不凭冲突清锁。
  终止与提交必须竞争同一 operation 记录，状态/版本 CAS 与全部引用变更同事务，冲突重读。
  abort 对无记录也创建 ABORTED 标记，对 COMMITTED 只返回提交已成功；两个终态不可逆。
- PREPUBLISH 受控引用状态对账使用 operation 模式。absent 不能作为失败终态证据：ABSENT 或过期
  PREPARED 调 abort，有效 PREPARED 继续 commit；匹配 COMMITTED 且新增引用全 bound 或有精确 privacyDeletion 凭证才发布，
  匹配 ABORTED 才本地失败清锁。裸 4xx、摘要冲突或未知结果不能终止；abort 返回 COMMITTED 则继续发布。
- 租约过期原子转为 ABORTED，同时释放原 prepared 引用；服务端 now >= leaseExpiresAt，重试不续租。
  prepare/commit/abort 请求路径均处理过期，status 返回服务器 leaseExpired，只读；不依赖后台任务。
  EXPIRED/ABORTED 映射公开 409 稳定码，媒体拒绝先提交终止记录再响应。终态记录不做 TTL 删除，
  媒体清理保留最小标记，新协议回收禁止直接删除 prepared 行。迟到 prepare/commit 不能复活引用。
  隐私删除须同事务终止相关 PREPARED operation 并释放完整新增集合；commit 胜出保留 COMMITTED 终态，
  依 MediaDeletionTombstone 精确凭证解除目标媒体 bound；prepare 与删除共享资产 referenceFence 实际写屏障。
  禁止新完成字段走旧协议路径，事务重试重新读取状态和服务器时间。
- 新增集合为空时不进行全称状态判断，直接本地发布。发布事务固化响应投影、递增版本并转
  `PUBLISHED_CLEANUP`；发布后不得回滚已发布作品，也不重复 prepare/commit/发布。
  对移除集合，同旧 bindingOperationId 的 bound 以当前 remoteOperationId 重放 unbind；同代次 released 或
  完整身份 absent 视为已无引用，absent 依赖活动锁阻止并发重绑。其他代次/prepared 阻断告警，
  合法混合逐项收敛，releaseOperationId 仅审计。移除集合全部收敛后事务置 SUCCEEDED/stable 并
  清除 pending/owner；空移除集合直接终结。本地结果未知先读阶段，查询失败继续 pending。
  此阶段使用 references 模式查询移除集合，不重用新增集合摘要，禁止 abort；COMMITTED 不因 unbind 反转。
- 家长确认携带其所见 `expectedCompletionVersion`；确认成功后完成证据冻结。
- 冻结/归档不阻止 task_completion 隐私删除；实际 actor、时间、scope/媒体/绑定代次保存最小凭证，不存正文。
  删除禁读并解除引用，不修改教学版本/星星；普通 released/absent 不能替代 PREPUBLISH 的精确删除凭证。
  deletedAt/最后释放时间较晚者满 30 天且无活跃引用才可清理，凭证不 TTL。备份可能保留更久，隔离恢复必须
  合并最新受保护删除日志后才能开放；缺失日志不得上线。全量家庭导出/删除不在本轮。
- 历史 completed 无媒体任务投影为 completion version 0、stable；确认用
  `expectedCompletionVersion=0`，只把缺失版本持久化为 0，不递增作品版本，并继续沿用现有
  pending 发星恢复流程。

### 4.2 清单与求助

- 清单 0 至 5 项；创建时未提供或显式提供空清单为 `checklistVersion=0`，提供非空有效清单为
  `checklistVersion=1`；后续修改从当前版本 CAS 递增，完成写入同时校验清单版本。
- 求助接口只接受 request 的 `helpType/note` 或 resolve 的 `parentResponse`，都携带
  `expectedHelpVersion`。
- 孩子或家长可 request，只有家长可 resolve；服务端记录真实 actor 与时间。
- request 的安全重放必须同时满足：当前记录仍为 pending、
  `currentHelpVersion === expectedHelpVersion + 1`、规范化后的 `helpType + note` 完全相同，且
  认证 actor 与 `requestedByActor` 相同。其他旧 request 返回 `409 VERSION_CONFLICT`；
  旧版本 resolve 返回 `409 VERSION_CONFLICT`。求助不改变任务主状态、completion、星星、错题或掌握度。

### 4.3 日计划

- `GET/PUT /api/children/:childId/daily-learning-plans/:localDate` 使用 `expectedVersion` CAS。
- GET 不存在返回空计划/version 0 且不写库；首次 PUT 用 expectedVersion 0 创建 version 1。
- 唯一索引为 `{familyId, childId, localDate}`；唯一竞争和旧版本统一返回
  `409 VERSION_CONFLICT`。
- 只允许写家庭当地今天；历史只读，未来计划不在本轮范围。
- childEstimatedMinutes 保留分钟值；短/中/长为 5/15/30 快捷值，可留空。estimateRecordedBy 在估时
  新增/改变时由服务端认证 actor 写入，同值/仅排序保留，清空时清除，旧缺失为 unknown/null。
  updatedByActor 记录本次计划写入者；客户端伪造审计字段拒绝，家长输入不冒充孩子独立估时。

### 4.4 来源连接

- `FamilyMistake.sourceTaskId` 和 GrowthTask 的 `sourceTaskId/sourceMistakeId` 都是可选加法字段。
- 资源所有者通过内部最小读取验证同家庭同孩子；不信任客户端传来的 scope。
- 来源不存在与跨家庭/跨孩子来源对公开调用统一返回 `404 RESOURCE_NOT_FOUND`；真实原因只进入
  脱敏内部审计，不能形成资源 ID 存在性侧信道。
- 任务到错题、错题到订正任务分两次显式提交；不承诺跨服务原子事务。
- `task_completion` 不能直接当作 `mistake_answer`；首版重新上传正确 purpose。

## 5. 数据迁移和索引策略

T0 裁定为加法升级，不进行真实数据迁移：

1. 老任务缺失新字段时，读取为 `checklistVersion=0`、`completionVersion=0`、
   `helpVersion=0` 及空集合；GET 不写库。
2. 第一次相关写入在同一原子条件更新中按需原子初始化；不得批量重写全部任务。
3. `GrowthTaskCompletionOperation` 使用完整业务/actor/operation 复合唯一索引；不持久化签名 URL。
   同时建立本地 remoteOperationId 唯一索引；resource 的 `MediaReferenceOperation` 使用完整
   scope/field/operationId（远程标识）唯一索引，两端记录和不可变映射均纳入备份。
4. `DailyLearningPlan` 使用 `{familyId, childId, localDate}` 唯一索引。
5. 任务查询按待处理求助需要增加以 `familyId + childId + helpRequest.status` 开头的索引时，
   T3 必须用查询计划和数据规模证明后再固定，不在 T0 猜测多余索引。
6. 索引启用前在恢复副本检查冲突；发现冲突即停止，不自动合并或删除儿童记录。
7. 只有实际发现无法按需初始化的历史冲突时才编写 repair 脚本，并要求 dry-run、审计计数和
   `--check` 零漂移；当前没有批量迁移授权。

## 6. 旧客户端和发布兼容

- 老数据继续可读，老任务可按既有规则取消或归档。
- 新完成、清单更新、求助、日计划和作品确认写路径必须携带各自版本字段。
- 旧客户端缺少 operation/version 时返回 `400 CLIENT_UPGRADE_REQUIRED`，不得静默执行旧写逻辑。
- 前后端必须作为匹配版本在维护窗口协调发布；iPad 需要刷新缓存后再开放增强写入口。
- completionMediaIds 写入启用前验证远端 operation 唯一索引、公共 client、新引用协议及软删除/回收
  路径同版本；回滚保留终态标记，待恢复命令只能由理解新协议的版本处理。
- “旧数据可读”不等于旧客户端可以继续修改作品。混合新前端/旧后端或旧前端/新后端不视为
  默认安全运行状态。

## 7. 回滚和数据保护

- 尚未接收新写入时，可以关闭入口并恢复旧镜像和已验证快照。
- 接收新写入后，先停写并备份新状态；优先前进修复，不能只回滚到会绕过冻结或版本规则的旧后端继续写。
- 应用回滚保留新增字段、索引、命令记录、日计划和媒体引用，不通过回滚脚本删除历史儿童数据。
- 只有在列出将丢失的时间范围、确认恢复点并取得明确授权后，才能恢复旧数据快照。
- T0 没有执行生产部署、外部写入、批量数据修复、备份覆盖或回滚操作。

## 8. T0 关闭条件

- [x] `SL-01` 至 `SL-07` 以 PLANNED 状态进入 PRD、架构、API、追踪矩阵和本 Gate。
- [x] `operationId`、`expectedCompletionVersion`、`expectedChecklistVersion`、
  `expectedHelpVersion` 和日计划 `expectedVersion` 语义固定。
- [x] `VERSION_CONFLICT`、`IDEMPOTENCY_KEY_REUSED`、`MEDIA_REFERENCE_PENDING` 和
  `CLIENT_UPGRADE_REQUIRED` 的使用边界固定。
- [x] 远程媒体调用前持久化意图和不确定标记、原 PATCH 恢复入口、GET 无副作用已经固定。
- [x] 媒体稳定业务拒绝、失败命令收敛、重放和修正请求新 operationId 的边界已经固定。
- [x] 历史 completed 无媒体任务的版本 0/stable 投影、确认 CAS 和发星衔接已经固定。
- [x] 清单创建版本和求助 request 的版本/正文/actor 重放条件已经固定。
- [x] 来源不存在与越权来源使用相同公开 404，避免跨家庭/孩子存在性侧信道。
- [x] 老数据按需原子初始化，当前不得批量重写的迁移策略固定。
- [x] 旧客户端阻断、协调发布、前进修复和数据快照回退授权边界固定。
- [x] T0 不新增 ADR；理由是本增量没有改变现有数据权威源或服务边界。
- [x] 现有后端和前端基线结果已记录，既有失败与新增失败可以区分。
- [x] T0 修改后的文档 Gate、链接和格式验证通过。
- [x] 最小成功响应投影、每任务活动完成命令互斥和发布后解绑阶段已固定，T1 反例列入计划。
- [x] `supportLevelUsed` 与 `helpType` 均不得进入本轮 completionEvidence，负向门禁覆盖两者。
- [x] 远程 operation 两终态、无记录 abort、租约过期事务和迟到请求拒绝已固定；T1 故障用例已列入计划。
- [x] 本地/远程命令标识分离及不可变映射、唯一索引、线协议取值和跨 actor 同 UUID 验收已固定；见 §12。

T0 契约基线已经关闭。T1 开始后仍须以测试先行，并在本 Gate 增加实际代码版本、权限拒绝、
幂等、媒体恢复和回归证据；不得把 T0 的文档通过记录复用为 T1 实现通过。
这里保留原 T0 记录；后续 R1–R8、R3-LEARNING 和门禁 P2 的评审已由用户确认通过，当前关闭记录见 §17。

## 9. T0 独立审查修订

关闭前的只读独立审查发现并完成以下契约修订：

1. 把完成媒体流程统一为“远程调用前先持久化命令/pending 意图和不确定标记”，关闭
   prepare 已送达但本地没有恢复记录的崩溃窗口。
2. 固定恢复只使用原完成 PATCH/operationId 或受控运维重放；GET 不触发恢复。
3. 来源不存在与跨家庭/跨孩子来源使用同一公开 `404 RESOURCE_NOT_FOUND`，消除资源存在性侧信道。
4. 固定历史 completed 无媒体任务的 version 0/stable 投影、确认 CAS 和现有发星恢复衔接。
5. 清理系统设计中的旧请求示例、旧幂等错误码和已解决的未决项；文档门禁增加上述规范的
   精确断言，并检查拟议文档尾随空格。
6. 区分媒体稳定业务拒绝与结果未知：稳定拒绝收敛失败命令并恢复上一稳定引用，未知结果只以
   原 operationId 恢复；修正请求使用新的 `operationId`。
7. 从完成证据移除 `helpType`，保留 `needsHelp` 作为完成时困难回顾；`helpType` 只属于当前求助。
8. 求助 request 的安全重放同时校验相邻版本、规范正文和认证 actor；旧 resolve 固定返回版本冲突。
9. 固定任务创建时空清单为 version 0、非空清单为 version 1，避免 T4 自行决定初始化语义。
10. 修复完成请求 JSON 重复键，并在文档门禁中增加 fenced JSON 重复键检查。
11. 统一验证顺序：P0 短期观察与 T1–T8 并行，T1–T8 完成后执行 T9 四周正式家庭验证。
12. 增加受控引用状态对账，避免首次拒绝与本地收敛同时未知时永久 pending，同时禁止无证据清理。
13. pending 意图保存最小规范业务 patch，确保客户端关闭后仍能发布同一完成证据，终态及时清理。
14. 固定完成媒体新增/保留/移除集合和代次规则，避免保留引用被新 operation 重绑冲突。

本轮先增强门禁再改正文，`npm run docs:family:check` 按预期以 29 条错误失败，覆盖上述稳定拒绝、
字段边界、求助重放、清单初始化、重复 JSON 键和验证顺序缺口。正文修订后必须用同一命令转绿，
证明新增检查不是事后无效断言。

后续交叉检查继续把“首次进程内稳定拒绝”和“恢复阶段后来收到稳定 4xx”分开，并修复求助备注
字段命名；门禁按预期新增 12 条失败，随后才同步修订五份权威契约文档。

最终独立复审继续补出并关闭四项实现歧义：未知结果终止对账、脱离客户端恢复所需的最小规范
业务 patch、媒体新增/保留/移除代次，以及跨权威章节的有边界门禁。合法缩进/波浪线 JSON 围栏
也纳入检查。校验器保留 5 个可重复负向探针：替代围栏重复键、completionEvidence 重新加入
helpType、取消求助 actor 相等、稳定拒绝保留 pending、非空清单错误初始化为 version 0。

正文修订后再次执行同一命令并通过：23 份 approved 文档、4 份自主学习拟议文档、5 个自主学习
契约负向探针、8 份 AI 拟议文档、22 份 AI 契约、388 个契约 fixture 和 38 项既有需求全部通过
检查。本记录只证明 T0 契约与文档门禁收敛，不作为 T1–T9 的代码、部署或家庭验证证据。

修订后 `npm run docs:family:check`、`node --check scripts/check-family-docs.js`、跟踪文件
`git diff --check` 以及拟议未跟踪文档的尾随空格扫描必须全部通过，T0 才保持关闭状态。

## 10. 第二轮复审修订

本轮逐项关闭 3 个 P1 与 1 个 P2 契约问题（仅 T0，T1 实现仍为 NOT_STARTED）：

| 问题 | 修订 | T1 验收反例 |
| --- | --- | --- |
| P1 成功重放缺少不可变结果 | 发布事务固化 successResponse，终态按原投影重放 | A 成功、B 更新、重放 A；确认/归档后重放及授权撤销 |
| P1 活动完成命令互斥不足 | 完整 scope owner 与最终原子写入 CAS，终态清理 | 新 id/不同 actor、清单编辑、取消/归档竞争、旧执行器延迟写入 |
| P1 发布后解绑恢复缺口 | PREPUBLISH 与 PUBLISHED_CLEANUP 分阶段，发布后仅向成功收敛 | 纯删除、解绑响应丢失、终结事务未知、混合状态及代次冲突 |
| P2 P2 储备字段门禁缺口 | completionEvidence 同时拒绝 helpType/supportLevelUsed | 注入 supportLevelUsed 必须失败 |

先增加门禁再修正文，本轮 `npm run docs:family:check` 退出 1，出现 40 条五份契约缺失和
3 条新探针基线缺失错误。正文同步后以同一命令验证。现有 5 个负向探针保留，新增成功投影、
单活动命令、发布后禁止回滚三个删除探针及 supportLevelUsed 注入探针，共 9 个；该数量取代第 9 节
上一轮的 5 个探针记录。关键词检查只证明文档约束存在，状态机正确性仍须由 T1 的故障/并发测试证明。

本轮验证结果：

| 校验 | 实际结果 |
| --- | --- |
| `npm run docs:family:check` | 退出 0；23 approved、4 proposed self-directed、9 probes、8 proposed AI、22 AI contracts、388 fixtures、38 requirements |
| `node --check scripts/check-family-docs.js` | 退出 0 |
| `git diff --check` | 退出 0 |
| 完整 validate 的内存 mutation 验证 | 17/17 被拒绝：五份文档分别删除成功投影/活动命令/禁止回滚约束共 15 项，两个模型分别注入 supportLevelUsed 共 2 项；恢复原文后通过 |

mutation 验证临时拦截 fs.readFileSync 返回内存变体，调用导出的 validate 并核对具体错误；未修改
仓库文档。当前 9 个内置负向探针可随标准门禁重复执行。业务回归、故障注入和真实媒体恢复留待 T1，
本轮未执行部署、真实数据写入、提交或推送。

## 11. 远程终态与租约复审修订

第二轮修订后的只读复审发现两个 P1：只读 absent 不能排除迟到远程写入；过期 prepared 重试无法
commit 且没有运行时回收调用。第 4.1 节及五份契约现统一采用资源服务的持久 operation 两终态协议：
abort 与 commit 争用同一记录，过期在请求路径原子终止，终态标记保留。第 9、10 节是历史验证，
其中基于引用 absent/released 直接终止的早期说明已由本节和第 4.1 节取代。

| 问题 | 关闭依据 | T1 必须验证 |
| --- | --- | --- |
| absent 后迟到写入 | ABSENT abort 创建 ABORTED，prepare/commit 都检验并原子竞争终态 | status absent、abort、迟到 prepare；abort 与 commit 双向竞争；响应丢失 |
| 过期租约持续 pending | prepare/commit/abort 都能过期原子终止，status 提供 leaseExpired | 无 worker、停机超过租约、到期边界、重复 prepare 不续租、本地失败结果未知 |

先增强门禁再修正文：标准文档命令退出 1（30 条五份契约缺失、2 条新探针基线缺失）；新增
absent 终态证据和过期原子终止的负向探针，内置探针从 9 个增为 11 个。门禁只能证明契约约束存在，
T1 尚未实现远程 operation 模型/API，不能据此声称生产恢复已通过。

本轮自审（设计时序推演，非运行时并发测试）：

| 时序 | 核对结论 |
| --- | --- |
| status ABSENT 后 abort 先于延迟 prepare | ABORTED 标记先落库，后续 prepare/commit 不产生引用副作用 |
| prepare 先于 abort | abort 原子释放完整 prepared 集合并存终态，不留半终止记录 |
| commit 与 abort 竞争 | 同记录写冲突使两者串行；COMMITTED 胜出继续发布，ABORTED 胜出拒绝提交 |
| prepare 后停机超过租约或恰好到期 | 请求路径按服务器时间原子过期终止，不需要 worker，不续租死循环 |
| abort 响应丢失或本地 FAILED 提交未知 | 原 operation 查询返回固定终态，按本地 owner/阶段 CAS 恢复，不能使用新 id |
| 已发布后解绑未知 | 只使用 references 模式恢复移除集合，不 abort、不反转 COMMITTED、不重复递增版本 |
| 媒体软删除与 commit 竞争 | 自审补齐同事务终止完整 PREPARED operation；提交胜出保留 bound 并禁读 |
| 媒体清理或旧请求重放 | 保留最小终态标记，不直接删新协议 prepared，不复活已解绑引用 |

上述两个 P1 在设计契约层面关闭，本轮自审未发现这些时序中的新增阻断项。验证结果：

- `npm run docs:family:check` 退出 0：23 approved、4 proposed self-directed、11 probes、8 proposed AI、
  22 AI contracts、388 fixtures、38 requirements。
- `node --check scripts/check-family-docs.js`、`git diff --check` 通过；新增拟议文档无尾随空格。
- 完整 validate 的 10 次内存 mutation 均按预期失败：五份文档分别删除 absent 禁止终止和过期原子
  终止规则，错误均定位到相应文档；恢复原文后通过。测试未写文件，11 个内置探针可随标准命令重复执行。

T1 必须用真实副本集验证事务竞争、故障注入、软删除/清理及回滚路径，文档推演和文字门禁不替代这些测试。

## 12. 本地与远程命令身份分离修订

后续复审发现 §11 未覆盖的 P1：本地含 actor 的幂等作用域与远端键不一致，不同 actor 复用客户端 UUID
可在本地占位后反复收到远端摘要冲突，无法获得匹配终态并释放锁。§11 原两项修复保留，但其“未发现新增
阻断项”不代表本项通过；本节增加不可变 remoteOperationId 映射，取代客户端 UUID 直接传远端的早期规则。

设计/API/计划/本 Gate 的 §4.1 已统一：首次占位持久化服务端 UUID、本地唯一索引防碰撞、内部线协议
operationId 取映射值、绑定与解绑代次分离、未知提交不能重建映射、备份和回滚保留映射。无实际数据迁移。
T1/T8 准入还要求检查缺失映射的试验命令，发现即停止启用并单独评审修复，不能猜测回填。

| T1 必须验收 | 关键断言 |
| --- | --- |
| TC-SL-REMOTE-ID-001：A 已失败/已成功，B 同任务同客户端 UUID | R_A != R_B；B 带非空新增集合正常终结并释放锁；A 终态重放不变、无交叉写入 |
| TC-SL-REMOTE-ID-002：A 活动时 B 同 UUID；同 actor 重试 | B 无占位/远程调用；A 收敛后 B 可用当前版本提交；同 actor 同正文复用，异正文 409 |
| TC-SL-REMOTE-ID-003：未知提交、重启、过期、UUID 冲突 | 只用已提交映射；迟到 A 不影响 B；不得以重生成标识绕过终态或冲突 |
| TC-SL-REMOTE-ID-004：替换/纯删除及回滚 | unbind 用当前 R_B，目标旧代次 R_A；保留引用不重绑；恢复映射完整，公开输入不能指定远程标识 |

上述均为待实现的运行时验收，不标记为已通过。

本轮验证记录：

- 先增强门禁再修订文档：`npm run docs:family:check` 退出 1，报告 25 条映射约束缺失和 5 条
  新探针基线缺失。更新时序图后，门禁额外拒绝 5 条未同步的旧时序断言；同步为远程标识后通过。
- 标准门禁退出 0：23 approved、4 proposed self-directed、16 probes、8 proposed AI、22 AI contracts、
  388 fixtures、38 requirements；增加的 5 个负向探针保护身份映射约束，保留原终态/租约检查。
- 完整 validate 的 25 次内存 mutation（五份契约各删除五条映射规则）均拒绝；另 8 次分别移除计划和
  Gate 中四个验收编号，均拒绝。恢复内存原文后完整门禁通过，未写临时文档或业务数据。
- `node --check scripts/check-family-docs.js`、`git diff --check` 通过。

自审范围与结论（设计时序推演，不是数据库并发测试）：

| 时序/边界 | 本轮结论 |
| --- | --- |
| A 已 ABORTED/FAILED，B 同客户端 UUID 新增媒体 | 独立 R_B 不再命中 R_A 终态和摘要，原 P1 的永久冲突路径被消除 |
| A 已 COMMITTED/SUCCEEDED，B 同 UUID 更新，随后重放 A | B 用当前版本与 R_B；保留项仍绑定 R_A；A 只重放固定结果，不重绑或改 B |
| A 尚活动，B 同 UUID；同 actor 并发重复提交 | 任务 CAS 阻止 B 占位；本地业务唯一键保证同命令只保留一个映射，竞争者重读 |
| UUID 唯一碰撞、占位提交结果未知、进程重启 | 仅确认回滚且未调用远端时重分配；未知结果和恢复不重建映射、不发送候选标识 |
| prepare/abort 响应丢失、租约过期、迟到请求 | 复用原 R_A；既有原子终态和过期规则不变，不能影响 R_B 或通过换标识复活 |
| 替换、纯删除及解绑重试 | 当前远程标识用于 unbind 命令，旧绑定代次用于目标校验；不混用、无空远端命令 |
| 回滚/备份恢复、公开标识注入 | 映射与两端记录一同保留；缺失映射停用；公开输入拒绝，响应不暴露内部标识 |

该 P1 在设计契约层面关闭，本轮上述范围未发现新增阻断项。原两个终态/租约 P1 的保护保持不变。
T1 尚未实现映射或远端模型，真实副本集的 TC-SL-REMOTE-ID-001 至 004 仍为准入必测，不能以本记录
替代运行时证据。本轮不提交、不推送、不部署；回退本次文档修订不能作为绕过 T1 验收的理由。

## 13. R1–R8 核实、处置方案与开发自审（2026-10-22）

历史 §11–§12 的“commit 后软删除保留 bound”描述由 R4 的专门隐私删除契约取代；历史执行记录不改写。
当前规范以 §4.1 和正式 API §14.2 为准，保持 COMMITTED 终态但以精确删除凭证释放目标媒体引用。

本节按“先核实 → 方案自审 → 必要修订 → 开发自测 → 独立复评”执行。需求/设计/开发线程负责前四步；
测试/评审线程负责独立复评和测试执行，开发自审不能代替独立复评。长期目标已由用户确认，不能再次作为待选方向。
以下行号是修订前快照定位，后续优先按章节/符号检索；不重写既有历史执行证据。

| 项目 | 核实结论与当前事实（修订前） | 方案、文件与验收 |
| --- | --- | --- |
| R1 P1 | 成立。PRD 1–34 行仍只定义成长跟踪，§14 为增量；docs/README §权威关系仍把自主学习当作后续方向；根 README 仍写 Task 1–11 | PRD/总体架构/两级 README/追踪/Gate 区分“已确认长期目标、FGT-MVP-1.7 已实现基础、SL-01..07 PLANNED 增量”；保留 38/38 和原证据日期，不新造发布版本。检查入口一致性与状态负向门禁 |
| R2 P1 | 已修复（设计层面）。架构 §12.3 1128–1251 行已有活动 owner、完整 CAS、终态重放优先、remoteOperationId 和旧代次；后端尚未实现 | 不重复修改媒体命令互斥；核对 A 占位/超时后 B、异 actor、A 原请求重放、A 成功后 B 旧版本 409/新版本可占位、A 失败后版本不增。保留 TC-SL-REMOTE-ID-001..004；运行时证据待 T1 |
| R3 P1 | 成立。理论 §7.4 有一周基线；计划 T9 414–433 行缺少可审查的证据下限和结论规则 | Gate 新增唯一 T9 评估规程，理论/设计/PRD/计划引用；按孩子分别观察、PASS/PARTIAL/FAIL、缺失与停止规则，不加后台采集或评分。用虚构无个人数据的判定反例检查规则 |
| R4 P2 | 成立。growthTasks.js 589–634 的 DELETE 仅取消/归档；mediaService.js 238–261 只释放 prepared；mediaCleanupService.js 33–49 跳过 bound，确认冻结缺少隐私解除路径 | 在 SL-01 必要范围扩展既有媒体 DELETE 的 task_completion 语义：原 scope 授权、最小删除凭证、资源服务事务解除引用、30 天及备份恢复边界。同步架构/API/系统设计/计划/Gate，现有基线行为明确保留。拒绝/并发/丢响应/恢复/清理测试列为 T1/T2/T8 准入，不操作真实数据 |
| R5 P2 | 成立。系统设计 §6.3 是短/中/长，§5.2 与 API §14.4 只有分钟，无估时输入者 | 最小方案为短=5/中=15/长=30 分钟的可选快捷值、可留空/改分钟；保留 childEstimatedMinutes 兼容名称，新增服务端 estimateRecordedBy 和 updatedByActor。仅估时变更更新归属；排序不篡改归属。不增加画像或能力断言。同步产品/模型/API/UI/计划/Gate |
| R6 P2 | 部分成立。现有 privateMediaRules.js、privateMediaProcessor.js 仅支持 JPEG/PNG/WebP（另有非完成用途 PDF）；没有 HEIC 实现或 Safari 自动转码保证。T2 只有提示 | 不引入解码器/OCR；使用新拍 JPEG 与显式导出 JPEG 的设备操作路径，禁止改后缀伪转换。按设备/系统版本记录真实输入 MIME 与回看、重试结果；无设备标记 DEVICE_PENDING，T8 不能通过 |
| R7 P2 | 部分成立。系统设计 §7.3 difficulty 已仅一次，§5.3 helpType 已分离；§7 开头仍写编码前补正式契约，且复制完整请求 | 保留关系、状态、交互、时序和恢复不变量；删除 §7.1–7.3 重复 JSON 请求体，引用正式 API §14；P2 草案保持隔离。门禁检查无重复请求 JSON/过期措辞，明确非运行时验证 |
| R8 P2 | 已修复主体。理论 §12 628–637 已为 P0 与 T1–T8 并行、之后 T9，没有先等四周才开发 | 仅明确无干预一周基线先于人工预演；开发可并行但不可把预演/功能切换期当干净基线。理论 §7.4/§8/结论与 T9 引用同一规则，保留 T0 已发生记录 |

### 13.1 方案自审（实施前）

| 自审问题 | 对方案的修订 | 结论 |
| --- | --- | --- |
| 统一产品标题会不会冒充新功能已上线？ | 顶部明确三层状态；保留 FGT-MVP-1.7 标签、38/38、历史日期；SL 仍 PLANNED | 通过 |
| 直接释放 bound 会不会让 COMMITTED 后本地未知永久 pending？ | 删除保存按 scope/mediaId/旧绑定代次匹配的持久凭证；仅凭可信隐私删除凭证允许发布不可读媒体占位，不放宽普通 released/absent。prepare 与删除还需共享资产写冲突屏障 | 通过 |
| 家长排序会不会把孩子估时改成家长填写？ | estimateRecordedBy 仅在分钟新增/变化时更新；排序写 updatedByActor，客户端不能伪造归属 | 通过 |
| PASS 是否把打卡和三个孩子比较当成成效？ | 每孩子单独基线与描述性证据；一年级可共同调节；无干净基线只能 PARTIAL，不能补造/计算总分 | 通过 |
| 真机、家庭数据和独立评审能否被开发自测替代？ | 设备/家庭观察均待实测；独立复评单列待执行；仓库仅匿名结论，本轮无业务实现/部署/数据写入 | 通过 |

方案自审结论：通过，可以按本节实施必要契约修订。无未解决的方案阻断项；设备与四周观察属于已明确的
后续验收限制，不冒充通过。回滚仅回退本轮文档/门禁改动，不动既有业务数据；以后实施隐私删除后禁止通过
旧镜像/旧快照恢复可读媒体，须保留删除凭证并前进修复。独立复评状态：PENDING。

## 14. T9 轻量价值验收规程

本节为理论/产品/设计/计划共用的唯一判定规则，不是孩子能力评分，也不声称因果实验结果。
工程通过与家庭价值通过分开记录；开发自测、功能能用或提交数量不能替代价值证据。

### 14.1 基线与最少证据

- 每个孩子单独建一份私有观察页。先做一周不改变家庭学习流程的基线，至少 3 个自然学习日；
  然后可做 P0 人工预演。开发可以并行，但预演、新功能、课程/作息显著变化的日期须标注，不能混入干净基线。
- 若先前已改变流程，不追忆补造基线；标为 BASELINE_MISSING 或 BASELINE_CONTAMINATED。
  可另选可比的一周重新观察；没有干净前置基线时本轮最高为 PARTIAL，只报告可用性/体验，不能断言改善。
- 正式 T9 在 T8 工程与设备验收后开始，四周至少覆盖一个数学单元；每孩子每周选 2 个自然学习日简记
  （目标约 3 日，最低共 8 次、分布四周），每周一次简短亲子复盘。缺课、生病或拒绝观察记录原因，不补刷。
- 基线前按年龄共同选择 1–2 个观察焦点；一年级允许共同调节，不以独立填表为 PASS 条件。
  每次只记启动（自己开始/需提醒）、计划（谁选顺序/估时）、自检（谁提醒/采用了什么）、求助
  （有无自然机会、是否说出卡点）、学习证据（已有私有作品或口述/订正的一条指向）。无求助机会记 N/A，非失败。
- 同时简记家长提醒次数和大致投入分钟、冲突/疲劳、睡眠或运动被挤占、额外屏幕负担；只作同一孩子
  前后描述，不精密计时、不录音录像、不新增埋点/画像。记录每天不超过约 1 分钟，周复盘约 5 分钟。
- 至少保留两次不同日期的具体行为例子（可口述），并区分孩子自主、家长提示、家长代录。
  估时 actor 只证明谁输入，不自动证明谁思考。原始内容留在家庭受控系统，不进入 Git/CI/评审截图。
- 学习效果核对复用已有作品、口述、订正或延迟再练习；在既有观察内选取至少两次不同日期的正式观察，与基线中可比的学习证据对照。
  对照边界为同一孩子、可比学习目标/内容、难度、支持程度和回忆间隔，不要求原题重测或所有能力都测一遍。
  简记孩子能否完成/解释、需要何种帮助或能否在相近间隔后再做，以及作出判断的证据指向。
  同样的正确结果若由成人代做或支持增加得来，不能直接视为学习效果稳定。
- 难度或支持变化无法解释时标为不可比；新难题不能直接对照旧熟题，间隔不同也不能直接判保持能力下降。
  不能区分成人代办、只有上传/打卡记录或无自然可比机会时保留未知；可以减少对流程的要求，不为取得 PASS 强行补测。
  核对已记录的全部相关学习证据与负向记录，不能只挑两次积极例子忽略持续变差。
  不强制新增考试、刷题、成绩总分、排名或后台采集；学习证据可与行为例子复用，不增加既定记录负担。

### 14.2 判定、停止与缺失

按以下顺序判定，首个命中即停止：FAIL → PARTIAL → PASS，否则 PARTIAL。
安全/身心停止条件和未解决的负向证据优先于主动性积极例子；下面 PASS 的全部条件是合取，
不得以两个积极例子抵消负向或未知事实，同一案例只给一个结论。

| 结论 | 每个孩子的判定条件 |
| --- | --- |
| PASS | 全部前提同时满足且未命中 FAIL/PARTIAL：干净基线及最少观察完整；足够且可解释的可比学习证据，未见明显、未解决的学习效果下降；已选焦点有至少两次具体证据显示更主动/更会使用适龄支架，或基线已稳定时在不增加支持下维持；亲子复盘认可可持续，未出现未解决的负担增加。结论限于该孩子/该场景，不要求证明成绩提升，也不证明软件造成进步 |
| PARTIAL | 未命中 FAIL，但无干净基线、缺失周/观察不足、只有功能可用证据、趋势混合、缺少可比学习证据、结果不确定或成人代办无法区分，或已观察到的学习下降尚未解决或调整后复核不足；保留已知事实并列修正/延长条件，不补齐虚构数据 |
| FAIL | 安全暂停仍未解决，或出现持续且未解决的冲突、疲劳、睡眠/运动挤占、屏幕依赖，或核心流程阻碍家庭且调整后仍不能使用；停止相关流程，不归咎孩子 |

证据缺失不能视为“没有下降”，也不能据此判孩子退步或 FAIL。一次波动先核对可比性，无法解释时为
不确定；可比证据反复显示完成、解释或延迟再练习变差时，记录具体负向事实，不做能力诊断。
调整支架、任务难度或负担，约定下一次自然学习机会复核；必要时暂停相关新流程，不要求增加练习量。
在下降未解决或复核不足期间为 PARTIAL（安全/持续不可用条件优先），不能凭主动性改善提前 PASS。
学习下降本身不自动判 FAIL；只有调整后持续不可用或命中原安全/身心停止条件才判 FAIL，适用上表未解决条件。
若调整后已有至少两次不同日期的可比复核证据表明负向问题已解决，且全部其他前提满足，才可重新判 PASS；
保留原下降、调整与复核记录，不以改难度、增加成人代办或删除记录制造“已解决”。

孩子要求停止、明显痛苦/冲突、睡眠被挤占或隐私事件时立即暂停相关功能/观察，无需等满四周。
重新开始须由家长和孩子确认负担已减轻并记录调整；不删除停用证据。安全暂停未解决即 FAIL，非安全的
自然中断导致证据不足为 PARTIAL。没有填写记录不等于孩子没有能力，缺失不计零、不插补。

总体结论只汇总各自结果：三个孩子都 PASS 且 T8 工程通过才可关闭本轮价值验收；任一 FAIL 不关闭并先处理
风险，其余含 PARTIAL 的情况保持 PARTIAL。禁止计算平均分、总分、兄弟姐妹排名或为达到 PASS 增加任务量。
仓库仅保存匿名标签、日期/观察数量、缺失类别、PASS/PARTIAL/FAIL、限制和下一步，不保存儿童内容。

待执行验收：TC-SL-VALUE-001 无基线不得 PASS；002 一年级共同调节可提供有效证据；003 无求助机会为 N/A；
004 某周缺失为 PARTIAL；005 睡眠/冲突停止条件优先；006 三人分别解释、不以工程成功替代价值结论。

### 14.3 合成判定反例

以下全部为虚构事实，用于复核条款及优先级；不是家庭试点结果，不采集真实儿童数据。
未特别指出缺失/变化的项目均假定满足 §14.1 的基线、观察和可比边界；PASS 仍要求 §14.2 的全部前提。

| 用例 | 合成事实 | 唯一结论 | 判定依据/下一步 |
| --- | --- | --- | --- |
| TC-SL-VALUE-007 | 主动性改善但学习下降：更主动排序提交、负担未增，同等难度与支持下多次不能解释原可解释步骤，尚未调整复核 | PARTIAL | 负向证据优先；调整并自然复核，不用积极例子抵消，也不直接归咎孩子 |
| TC-SL-VALUE-008 | 无可比学习证据：观察日期完整，有启动例子，但学习记录仅有上传次数 | PARTIAL | 证据缺失不能当没有下降；等待自然可比证据，不强制补测 |
| TC-SL-VALUE-009 | 难度或支持变化导致不可比：基线为熟题且成人逐步提示，正式期是新难题且独立完成，表现变差 | PARTIAL | 不能据此断言退步或稳定；标记变化并寻找自然可比证据 |
| TC-SL-VALUE-010 | 学习效果稳定且适龄主动性证据充分：两次不同日期可比解释/再练习保持，其他记录无未解决下降，一年级使用适龄支架更主动，亲子认可且负担未增 | PASS | 全部前提满足；不要求成绩提高，不声称软件造成进步 |
| TC-SL-VALUE-011 | 工程成功但家庭证据缺失：T8 和自动化测试全通过，未取得基线或四周家庭观察 | PARTIAL | 工程证据不能替代家庭价值，不能关闭本轮价值验收 |
| TC-SL-VALUE-012 | 睡眠/冲突停止条件优先：学习与主动性例子积极，但观察流程持续挤占睡眠且冲突未解决 | FAIL | 立即暂停，安全条件优先，不等四周完成也不被积极证据抵消 |
| TC-SL-VALUE-013 | 成人代办无法区分：作品看似正确且上传更主动，但无法确认哪些步骤由家长完成 | PARTIAL | 实际输入 actor 不能证明谁思考，不能把正确作品当学习稳定 |
| TC-SL-VALUE-014 | 下降调整后仍持续不可用：已降低流程负担并调整支架，可比负向证据持续，核心流程经调整仍阻碍日常学习 | FAIL | 命中原持续不可用规则，停止相关流程；不是按学习成绩给孩子判失败 |
| TC-SL-VALUE-015 | 下降已解决且可比复核充分：保留原下降记录，调整后两次不同日期在可比内容/难度/支持/间隔下表现恢复，其他 PASS 前提完整 | PASS | 负向问题有可解释的解决证据，不是靠更多代办或删记录消除 |

合成反例与正文缺条款探针只验证文档契约，不是自动评估孩子的程序，也不构成真实学习效果或因果证据。

## 15. R1–R8 实施后开发自审与交接证据

2026-10-22，按 §13 方案自审通过后实施。仅改文档和文档校验脚本；未启动 T1–T9 业务开发，
未部署、迁移、删除真实媒体、采集孩子观察数据、提交或推送，未向其他线程发送消息。

### 15.1 必要修订与自审结果

- R1：PRD/总体架构/根与 docs README/架构索引/追踪已对齐三层基线。保留 FGT-MVP-1.7、历史日期和
  38/38；SL 仍 PLANNED。门禁输出改称 baseline documents，避免把混合状态整篇文档称为全部批准。
- R2：保持原互斥设计。A 占位未发布或超时后 B（不同 id/actor）均被最终 CAS 拒绝；A 原请求走原 owner
  恢复；A 成功后 B 旧版本 409、新版本可占位；A 失败不增版本，B 用当前版本可占位。终态重放优先于活动锁，
  remoteOperationId 映射、过期/abort 与旧绑定代次仍有效。这是设计时序推演，不是运行时测试。
- R3：§14 成为唯一价值关闭标准。实施后自审发现计划摘要/M5 和 Gate T9 行仍偏重“四周用过”，已同步
  改为总体 PASS 才关闭。缺失/污染基线、成人代办、停止条件和独立解释均有明确分支。
- R4：正式架构/API 与系统设计/T1/T2/T8/Gate 已统一隐私删除例外。自审补入 tombstone/精确凭证唯一索引、
  首次审计不覆盖、恢复日志完整性检查；删除不能把 COMMITTED 改 ABORTED，也不能使 PREPUBLISH 永久等待 bound。
  不把普通 released/absent 当删除凭证，旧基线和历史自审结论显式标注适用范围/被取代部分。
- R5：分钟快捷值、estimateRecordedBy、updatedByActor、排序保留/变更更新、旧归属 unknown、伪造字段拒绝
  已同步产品/模型/API/交互/计划。actor 只证明输入者，不推导孩子思考过程。
- R6：已有 JPEG/PNG/WebP 字节校验保持；新拍 JPEG 与显式导出路径附 Apple 官方来源，真机矩阵列入 T2/T8。
  DEVICE_PENDING，不能称为已支持 HEIC 或真机通过；本轮没有可用于验证的目标 iPad。
- R7：删除系统设计 §7.1–7.3 的重复 JSON 请求体和“编码前补正式契约”措辞，API §14 为字段权威；
  原 helpType/supportLevelUsed 分离和重复键探针保持，不误改 P2 储备。门禁只校验文档，不证明事务正确。
- R8：原“最小补齐后四周”结论保留；只细化无干预基线先于预演、开发可并行、污染不可混入基线。

方案实施后自审：上述范围未发现未处理的阻断项。开发自审通过，独立复评仍 PENDING，R4/R5 等运行时能力
仍未实现；这不是对新增隐私契约或产品改动的独立批准。

### 15.2 开发自测与证据限制

- `npm run docs:family:check`：通过，23 baseline documents、4 proposed self-directed、16 原契约探针、
  8 proposed AI、22 AI contracts、388 fixtures、38 既有需求；新增 R1–R8 的约束存在性检查另在 validate 内执行。
- 15 次完整 validate 内存负向校验全部拒绝：移除方向层级、基线缺失/缺失处理、删除屏障/恢复日志要求、
  精确删除凭证、估时归属、设备限制、自审记录、实施顺序；或重新插入重复请求 JSON/旧措辞。恢复原文后通过，
  不写临时文档或业务数据。`node --check scripts/check-family-docs.js` 和 `git diff --check` 通过。
- 价值规则的六个虚构边界推演（不是家庭成效证据）：无基线但功能可用→PARTIAL；一年级共同调节且焦点证据
  完整/负担未增→可 PASS；无求助机会→N/A 不自动失败；某周缺失→PARTIAL；未解决睡眠挤占→停止并 FAIL；
  工程通过而家庭结论缺失→不关闭价值验收。没有计算孩子总分或比较孩子。
- 真实副本集故障注入、隐私删除/恢复演练、前端交互和 iPad 真机测试、基线/四周观察尚未执行，分别归
  TC-SL-PRIVACY-001..005、TC-SL-ESTIMATE-001..004、TC-SL-IPAD-001..004、TC-SL-VALUE-001..006。
  代码实现后由开发自测及独立测试分别留证；不得复用本节文档结果替代。

独立评审应优先复核 R4 新增的隐私删除与原远程终态恢复交互、R5 输入归属、R3 判定充分性；R2 已关闭设计
不重复扩张。实际设备或家庭观察不足时继续保留待验状态；任何真实数据操作/部署仍需单独授权。

## 16. R3-LEARNING 核实与修订交接（2026-10-22）

### 16.1 核实与最小方案

核实：成立，P2。修订前理论 §7.1（437–438 行）要求学习效果和身心状态不下降；本 Gate §14.1
虽采集学习证据，但 §14.2（450–452 行）的 PASS 未明确要求可比学习证据，也未明确学习下降与
主动性积极例子的判定优先级。“趋势混合”为 PARTIAL 不能无歧义排除该反例。此前 §15 的开发自审
及随后只读复审未识别这一缺口，保留原记录；本节跟踪后续修订，不将其追改为已验证。

最小方案：仅在 §14 补充轻量学习证据、可比边界、下降复核及互斥判定顺序；理论、PRD、系统设计、
T9 计划只指向该唯一规则。补充合成反例和正文分区校验，门禁不能从历史记录匹配关键词充数。
不修改 R1/R2/R4/R5/R6/R7/R8 契约，不启动 T1–T9，不新增考试、评分、埋点或真实儿童数据。

### 16.2 方案自审（规范正文与脚本修改前）

下表在修改 §14、关联引用及校验脚本之前记录；是方案自审，不是实施后测试结果。

| 问题 | 方案调整 | 通过依据 |
| --- | --- | --- |
| 主动性两次积极例子能否掩盖学习下降？ | PASS 同时要求足够且可解释的学习证据、未见明显未解决的下降；先判安全 FAIL，再判负向/不确定 PARTIAL，最后才判 PASS | 下降未解决时不能进入 PASS 分支 |
| 无证据是否会被误判为稳定或退步？ | 无可比证据、成人代办不明、结果不确定均 PARTIAL；不把缺失当没有下降，也不据此 FAIL | 缺失与负向事实分开，仍不计零/插补 |
| 难度或支持变化是否产生伪下降？ | 比较同一孩子的可比目标/内容、难度、支持程度和回忆间隔；无法解释的变化标不可比 | 不能把新难题与旧熟题或家长代做与独立完成直接比较 |
| 会不会为了证据增加考试或负担？ | 复用已有作品、口述、订正/延迟再练习，在既有观察中至少两次不同日期核对；无自然机会保留 PARTIAL | 不增任务量/考试/总分，不声称因果或能力诊断 |
| 确有下降是否直接判孩子失败？ | 先调整支架/负担，记录下一次自然复核；未解决或复核不足 PARTIAL；只在原安全或调整后持续不可用条件下 FAIL | 结论评价当前流程，负向事实不被积极例子覆盖，也不自动升级 FAIL |
| 规则与校验是否产生第二套真相？ | §14 保持唯一判定正文；其他文档只引用。门禁限定 §14.1/§14.2/§14.3，负向测试保留历史关键词但删除正文 | 可以检测正文缺条款；合成反例仅校验契约，不自动评价真实孩子 |

实施前方案自审结论：通过，无未解决的方案阻断项。接下来才修改规范正文和脚本，再记录实际测试结果。
本轮可通过撤回自身文档/门禁差异回滚，不动既有改动或业务数据。独立复评状态：PENDING。

### 16.3 实施后自审与开发自测

在 §16.2 记录完成后，先增加校验，再修改 §14 正文；未将实施后检查冒充实施前自审。
修改范围为本 Gate、理论 §7.4、PRD §14.3、系统设计 §13.2、实施计划 T9 和 `scripts/check-family-docs.js`。
只有 Gate 定义判断条件，其他四份文档引用该规则；未修改 API、媒体恢复或估时归属契约。

- 实施后自审消除一处歧义：PARTIAL 表行不再通过“未满足全部 PASS”递归引用 PASS；先按明确的
  FAIL/负向或未知 PARTIAL 条件判定，再核对 PASS 的全部前提，最后才使用 PARTIAL 兜底。
- 9 个合成案例（007..015）逐项推演结论一致：5 个 PARTIAL、2 个 PASS、2 个 FAIL；
  既覆盖主动性改善但学习下降、不可比/缺证据，也覆盖持续不可用和下降解决后的再判定。
- 红→绿：先运行新增校验，原正文因缺少 15 项判定/证据条款和 9 个合成案例返回退出码 1；
  修订正文后 `npm run docs:family:check` 返回 0，原 16 个自主学习契约探针保留，新增 24 个 value-gate text probes。
- 完整 validate 内存负向验证 26/26 被拒绝：15 个正文条款分别移除但保留历史文字；9 个反例结论改错；
  删除整个现行规范仅保留历史副本；重复反例编号。原文验证通过，全程没有写入临时文档或真实数据。
  最后进一步将检查限定在 §14 外层边界内，重新通过门禁及上述整节历史替代/重复编号两项验证。
- `node --check scripts/check-family-docs.js`、`git diff --check` 通过。文字匹配及合成案例校验只防止
  已定义条款/预期结论漂移，不是自然语言完整正确性证明，更不是评估真实孩子的程序或学习效果因果证据。

开发自审未发现本次范围内未处理阻断项；R3-LEARNING 修订完成，独立复评状态：PENDING。
真实基线、四周学习效果/负担观察仍未执行；T1–T9 业务开发、真机测试、运行时恢复和部署均未启动。
没有提交、推送、部署、处理真实数据或回发跨线程消息；由测试/评审线程读取本节后独立复评及验证。

### 16.4 门禁 P2 修复与自审

后续复审发现两项漏检：§14.2 的 FAIL 定义移入历史记录仍通过；删除下降解决后恢复 PASS 的
两次不同日期复核门槛仍通过。问题在文档保护脚本，§14 的判定规则不变；用户已授权修复。

修复只涉及 `scripts/check-family-docs.js` 和本节记录：

- 在 §14.2 内提取 PASS/PARTIAL/FAIL，分别要求恰好一条有效定义；缺失、重复或列结构错误均拒绝。
  FAIL 行必须保留未解决安全暂停、持续身心负担和调整后持续不可用三个分支，历史副本不能替代现行定义。
- 恢复 PASS 的完整门槛限定在 §14.2 正文：调整后至少两次不同日期的可比复核、负向问题已解决且其他
  前提全部满足。历史记录和 §14.3 的例子不能替代这条规范。
- 两个原漏检均固化为每次文档门禁执行的负向用例；同时固化三种判定行移入历史和重复的变体。
  原 24 个价值探针扩展为 35 个（19 项条款、9 个案例结论、7 个结构负向探针）。

红→绿证据：先加入负向用例，旧校验返回退出码 1，明确报告两个原漏检及三个重复判定行漏检；
修复校验后 `npm run docs:family:check` 返回 0。额外完整 validate 的 14/14 内存负向检查均被拒绝，
包括三种定义移入历史/重复、三个 FAIL 条件移除、恢复门槛删除/减为一次/去掉不同日期、FAIL 列畸形、
仅在例子中保留恢复门槛。原文重新校验通过，全程未改写被测文档或使用真实儿童数据。
`node --check scripts/check-family-docs.js`、`git diff --check` 通过。

实施后自审：检查边界确实限定到 §14.2，三个结论不再只取首条而忽略重复；两次不同日期与全部前提
没有被弱化；现有九个合成案例及规范正文未改动，历史 24/26 次验证记录保留。本次范围未发现新增阻断项，
该 P2 已修复并通过开发自测；独立复评状态：PENDING。文档门禁仍不是自然语言语义完整性证明，
更不代表真实家庭效果或因果证据；本轮未提交、推送、部署或启动业务开发。

## 17. T0 最终评审关闭

用户明确确认“复审通过”，授权更新评审记录、关闭本次 P2 和 R3-LEARNING，并在 T0 完成后启动 T1。
本节为当前状态；§13–§16 的 PENDING 是当时执行事实，保留而不追改历史审批。

| 项目 | 当前结论 | 关闭依据 |
| --- | --- | --- |
| R3-LEARNING | CLOSED | 学习效果可比证据成为 PASS 前提，负向/未知证据优先，下降调整/复核及互斥结论已复审通过 |
| R3 门禁 P2 | CLOSED | FAIL 定义与恢复 PASS 复核门槛均受正文保护；两个原漏检、14 个边界变体和撤去保护的反向验证均通过复审 |
| T0 | APPROVED / CLOSED | 契约、评审修订和文档门禁完成，用户已授权进入 T1；不替代业务测试、发布或家庭价值验收 |

T0 门禁以当前再次运行的 `npm run docs:family:check` 和 `git diff --check` 为交接证据。
当前仍未提交/推送，沿用工作区已有变更；不将历史前端基线失败隐藏为通过。

## 18. T1 分阶段实施

T1 已获授权，按现有计划进行，不扩大到 T2–T9。先在 Node 22 重跑既有基线，记录现存失败。
首批实现本地 `GrowthTaskCompletionOperation` 与远程 `MediaReferenceOperation` 的持久化模型、
唯一索引和校验测试；不注册新路由、不创建真实数据库索引、不启用完成作品写入口。
后续批次接入远程终态/租约事务与隐私删除、本地命令占位/恢复/确认竞争及完整拒绝/故障回归。
只有各项验收实际完成才关闭 T1，不以模型测试代替跨服务事务正确性。

风险与回滚：首批尚无业务调用，可撤回本批未启用代码；不得清理既有工作区变更。新协议启用后，
必须保留两端命令、remoteOperationId 映射和删除凭证，按既定前进修复策略执行，不能降级绕过终态。
本轮测试只使用合成数据与临时 MongoDB；部署、真实数据迁移/删除、提交和推送不在授权范围。

### 18.1 首批模型边界与验证

2026-10-22，在 Node v22.23.3 下执行。运行时取自临时 npm 缓存，没有修改项目依赖、lockfile 或系统 Node。

- `GrowthTaskCompletionOperation` 保存完整业务键、必填且不可变的 remoteOperationId、commandHash、
  目标版本、phase/version、固定字段成功投影或最小失败 code/status；业务唯一索引与远程标识唯一索引独立。
- `MediaReferenceOperation` 仅用于 growth_task.completionMediaIds；保存完整远程键、commandHash、
  referenceSetHash、非空唯一引用集合、state/version、租约和终态日期/失败码。ABSENT 不入库，两端均无 TTL。
- 身份字段使用 Mongoose immutable，普通 ORM 更新剥离这些修改；测试直接核对重新读取的身份和引用未变，
  不误认为所有 ORM 更新都会抛错。索引冲突通过临时 MongoDB 实际写入验证，不只检查 schema 声明。
- schema 的跨字段校验面向文档 validate/save；不是数据库级状态转换约束。下一批服务必须在同一事务中
  CAS phase/state/version，计算/校验摘要、固定已发布投影并保护终态；不能依赖 update validators 替代事务。
- 新模型目前仅被测试引用，旧 MediaReference 字段白名单、完成路由、媒体客户端和隐私删除逻辑未改变。
  因此尚未实现恢复、租约过期终止、运行时投影不可变、任务锁、确认竞争或媒体隐私删除协议。

修改前基线：

- `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-baseline-backend.json`：退出码 0，81 套件、896 测试通过。
- `npm run test:ci --prefix frontend/web -- --runInBand --json --outputFile=/tmp/lms-t1-baseline-frontend.json`：
  退出码 1，27 套件通过/2 失败、181 测试通过/2 失败。失败为 ChildTodayTasks 的旧 `mistakes` 文案断言，
  以及 Task9ReportsRemindersRewards 的“今天还有 1 个任务”多节点匹配；该测试后续还保留旧来源文案断言。
  本批未改前端，也未跳过、放宽这些测试；它们必须在前端相关交付前处理，不能将整体基线标成全绿。

首批红→绿：先加入两个模型测试，因两个模块不存在返回退出码 1；实现后发现引用对象被自动转数组，
沿用现有模型的显式数组 setter 拒绝；同时纠正 immutable 测试对 ORM 抛错的假设，改为核对实际数据库结果。
聚焦测试退出码 0，2 套件、73 测试通过，包含 0/1/10 张快照边界、重复/11 张/标量拒绝、同 UUID 不同 actor、
业务键重复、远程标识冲突、读回身份及成功投影顺序、失败与终态数据形状。测试使用独立临时 MongoDB，
没有验证跨服务事务或请求级恢复，不作为 T1 完整门禁通过的证据。

首轮修改后全量回归返回退出码 1：81 套件通过/2 套件失败，969 个断言通过；两个套件为
familyMediaPrivacy 和 childMediaReferences，报 `spawn .../node ENOENT`，不是断言失败。
排查确认执行器在回归期间再次通过同一个 npm exec 缓存运行文档门禁，npm 的 reify 日志记录了
移走并重新安装 Node 的过程（00:10:48 UTC），临时可执行文件的 mtime 也变为 00:10:51 UTC。
处理方式是停止重装缓存，把已安装 Node 22 的 bin 固定到 PATH 后执行原回归命令；不改测试或业务代码，
不跳过失败套件。此首轮失败证据保留，不以断言数通过冒充整套回归通过。

固定运行时后的完整验证：

- 将已安装 Node v22.23.3 的 bin 固定到 PATH，执行
  `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-models-backend-fixed-runtime.json`：
  退出码 0，83/83 套件、969/969 测试通过。比对前后 JSON 中套件路径和用例全名，原有 896 个测试无缺失，
  新增恰好 73 个；前次环境异常涉及的两个套件均正常通过。
- 固定 Node 22 直接执行 `node scripts/check-family-docs.js`：退出码 0，23 份基线文档、4 份自主学习文档、
  16 个契约探针、35 个价值门禁探针、8 份 AI 文档、22 项 AI 契约、388 个 fixtures、38 项既有需求通过。
- 两个模型、两个测试、resource 家庭 Jest 配置和文档门禁脚本的 `node --check` 通过；`git diff --check` 通过。

首批自审结论：本批未启用的模型/索引定义及测试范围内未发现遗留阻断项；现有家庭回归未新增失败，
未减少原有测试。没有改写历史审批/失败事实，没有向外暴露新路由或改变旧媒体协议。
本批完成不等于 T1 完成：上述事务、摘要校验、终态不可逆、租约到期、隐私删除、响应重放不可变和
审核竞争仍须按原 T1 清单逐项实现验证；T1 继续 IN_PROGRESS，SL-01 继续 PLANNED。
下一批从 resource 的事务化 operation 协议及终态/租约测试开始，再接隐私删除和 homework 编排。

### 18.2 第二批：远程事务协议服务

用户已授权继续 resource-service 的事务化 operation 协议、终态竞争及租约过期处理。本节接续 §18.1，
不改写首批当时未实现的事实。范围限于服务层与旧协议隔离；生产注册、公共 client、隐私删除联动和
homework 编排仍待后续批次，T1 保持 IN_PROGRESS。

实现：

- 新增 `services/mediaReferenceOperationService.js`，复用现有 transactionRunner，要求真实活动事务；
  prepare/commit/abort 将 operation 的 state/version CAS 与整组引用修改放在同一事务。
  Mongo 写冲突交给 withTransaction 重试，首插唯一竞争在有界的新事务中重读；重试重新采样时间。
- 完整 scope、UUID、64 位摘要、引用数量/字段/唯一性严格校验；按规范排序的引用集合计算并保存
  referenceSetHash，同键不同 commandHash 或集合拒绝且不修改记录。operation 与 references 两种 status
  使用只读事务快照，返回实际绑定代次，不返回资产内容、路径、URL。
- ABSENT abort 持久化 ABORTED；prepare 媒体业务拒绝也先提交 ABORTED，保留首次失败码。
  PREPARED 的 commit/abort 竞争同一行；终态重放不重绑、不续租、不反转、不删除 ledger。
- prepare/commit/abort 都处理 now >= leaseExpiresAt，原子释放完整 prepared 集合；status 只报告过期。
  commit 资产写屏障后再次检查截止点，防止等待写锁跨过租期。写屏障递增资产已有 __v，不新增常驻服务。
- 引用模型允许 completionMediaIds，但旧 prepare/commit/unbind 明确拒绝该字段，旧过期删除和单媒体释放
  helper 排除该字段，防止绕过新 ledger。未改变旧字段的绑定协议。

自审中的红→绿：

1. 新测试先因服务模块不存在失败。实现后，释放引用遇到旧模型跨字段校验器依赖文档 this 的问题；
   修复为先校验完整目标文档，再按完整 scope/原状态/旧代次 CAS 更新，所有写入仍在同一事务。
2. 增加“旧单媒体释放不能拆组”“等待资产写屏障跨过截止点”“同 operation 额外引用”三个负向用例，
   三项均先实际失败，再分别补齐 helper 隔离、二次采样和整组完整性检查；修复后通过。
3. 验证已提交后重放/abort 不反转，已释放后迟到重放不复活，过期不依赖 worker，旧终态与新代次互不覆盖。
   补测 familyId/childId/resourceId 隔离与 UUID/媒体 ID 大小写、输入顺序规范化。

启用边界与回滚：当前新服务仅被测试直接加载，server、内部路由和 Gateway 均未注册新入口。
既有 `mediaService.deleteMedia` 的单媒体释放和媒体物理清理尚未按新协议改造，不能用于新协议上线；
下一批必须先完成隐私删除整组终止、COMMITTED 精确凭证与 tombstone 保留，再接内部服务凭据和公共 client。
本批可撤回未启用服务及配套模型白名单/旧协议保护差异；不能通过删 ledger 或降级恢复已经启用的新协议数据。
本次只使用临时副本集及合成媒体，不部署、不迁移真实数据、不提交或推送。

验证记录（Node v22.23.3 固定 PATH，未重装运行时）：

- 初始 50 个服务测试修复文档校验上下文后通过；自审增加 4 个边界用例，其中 3 个先失败，修复后
  54/54 通过；再增加 3 个 scope 隔离及 1 个规范化用例，合计 58 个纳入家庭回归入口。
- 首轮 `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-operation-backend.json`：
  退出码 1，83/84 套件、1026/1027 测试通过；本批 58 个测试全部通过。
  既有 growthTaskMediaReferences 的 `complete returns pending without lifecycle mutation when media recovery cannot converge`
  出现 `socket hang up`，栈位于 Node HTTP client，未修改该测试及 homework 路由。
- 核对该用例直接注入 mock attachmentMediaService，不调用本批 resource operation 服务；保持代码和测试不变，
  独立重跑整个 growthTaskMediaReferences 套件，退出码 0，15/15 测试通过。单次未复现不能证明稳定性问题已修复，
  尚未确定该 socket 异常根因，保留为既有路径验证风险，不删除首次失败记录、不加自动重试或跳过用例。
- 保持上述 58 用例版本不变，完整复跑输出 `/tmp/lms-t1-operation-backend-recheck.json`：退出码 0，
  84/84 套件、1027/1027 测试通过。此结果不代替 socket 异常根因分析。
- 继续对照终态表自审，发现 COMMITTED 重放被过度套用当前引用完整性要求：后续合法清理或新代次重绑
  会错误拒绝历史成功。新增两个用例均先失败，修复后 60/60 聚焦测试通过。
  当前严格区分 PREPARED 整组不变量与持久终态：后者返回原终态及真实当前引用，不重绑；同原代次异常
  prepared 等矛盾仍拒绝。API 同步明确，当前 absent/其他绑定不是 PREPUBLISH 发布或清锁凭证，后续
  homework 必须核验原绑定/精确删除凭证。不同代次引用和缺失引用不能被伪装为旧代次 bound。
- 最终代码完整回归：固定 Node 22 后执行
  `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-operation-final.json`，
  退出码 0，84/84 套件、1029/1029 测试通过。与首批 83 套件/969 测试的 JSON 按路径和用例全名比对，
  旧用例无缺失，新增恰好 60 个。先前 socket 异常的套件在独立复跑和两次完整复跑均通过，但未据此宣称根因已修复。
- `node scripts/check-family-docs.js` 通过：保留 16 个自主学习契约探针、35 个价值门禁探针、388 个
  fixtures 及 38 项既有需求检查；相关服务/模型/测试/Jest 配置的 `node --check`、`git diff --check` 通过。

本批开发自审完成：scope/摘要验证先于终态使用；重复请求不续租、迟到命令不复活；事务回滚无半组引用；
PREPARED 原代次完整性与历史终态重放分开处理；旧协议不能从其命令/回收/helper 绕过新协议。
本批未启用服务范围内未发现遗留阻断项。残余项为上面的 socket 稳定性风险及已明确留待下一批的隐私删除、
保留清理、凭据路由和 client 接入，不能把开发自审当作独立评审或发布批准。
第二批服务层实现完成；T1 整体继续 IN_PROGRESS，下一批优先完成隐私删除整组事务和精确删除凭证。

### 18.3 第二批复审 P2：租约时钟重新采样

2026-10-22 复审发现 `T1-P2-LEASE-CLOCK`：prepare/abort 在额外引用查询前采样时间，
查询期间跨过截止点后仍使用旧值，分别遗漏过期终止、保存错误的 MEDIA_OPERATION_ABORTED；
响应也复用旧时钟。该发现补充 §18.2 的开发自审结论，不覆盖或删除当时的记录。
用户已批准修复、固化负向用例、更新记录并自审，未批准接入生产路由。

修复范围：

- prepare/abort 在异步完整性查询后、租约决策前重新采样，now >= leaseExpiresAt 优先过期终止，
  用同一决策时间保存 terminalAt 和整组 releasedAt。保留 commit 资产写屏障后的再次采样。
- 首次 operation 在插入前采样；重复 prepare 不重新创建记录、不续租。所有写命令响应与 status
  在最终引用读取后使用当前时间计算 leaseExpired，不复用终态决策时间。
- 若在未过期决策之后、最终读取期间才到期，PREPARED/leaseExpired=true 如实报告当前状态，
  不伪造 ABORTED/COMMITTED；下一次 commit/abort 重新检查并过期终止，不能凭该投影发布或清锁。
  API §14.2、总体设计及 T1 实施计划已同步。

新增回归用例（真实临时副本集，合成数据，不使用真实家庭数据）：

| 用例 | 故障注入 | 必须断言 |
| --- | --- | --- |
| prepare resamples the lease clock after the integrity query crosses the deadline | 真实 exists 查询完成时，时钟从截止前 1ms 推进到截止点 | ABORTED/EXPIRED、version=1、terminalAt、全部引用 released/时间/原代次一致；三种历史重放不改 ledger 或引用 |
| abort resamples the lease clock after the integrity query crosses the deadline | 同上，执行 abort | 保存 EXPIRED 而不是 ABORTED 失败码，整组释放，重放失败码与终态不可变 |
| prepare calculates leaseExpired using the clock after its final reference read | 决策未过期，最终真实引用读取后到期 | 响应 leaseExpired=true、原租期与数据不变、与 status 一致；后续 commit 原子过期终止 |

红绿证据：固定 Node v22.23.3，执行 resource-family 配置下的 mediaReferenceOperationService.test.js，
`--runInBand --silent --json --outputFile=...`。未改实现时输出 `/tmp/lms-t1-p2-clock-red.json`，
退出码 1，60 passed/3 failed；三个新增断言分别捕获 PREPARED/false、错误失败码、旧响应时钟。
修复后相同聚焦命令输出 `/tmp/lms-t1-p2-clock-green.json`，退出码 0，63/63 通过。
测试只在真实查询返回后推进注入时钟，不替换数据库结果，不靠真实等待或自动重跑掩盖失败。

生产隔离复核：以真实 createProductionApp、合成凭据和禁止 startSession 的 connection 执行 HTTP 探针，
旧 prepare/commit/unbind 对 completionMediaIds 返回 400 VALIDATION_ERROR，abort/status 返回 404，
无内部凭据的 prepare 返回 401；startSession 调用为 0，新 operation 服务/模型均未加载。
Gateway familyTask6Routes.test.js 3/3 通过。本次未修改 server、内部路由、Gateway 或公共 client。

自审：状态/version CAS、整组事务及资产写屏障未改；摘要/完整 scope 验证仍先于状态使用；
新用例覆盖持久化终态、释放整组与迟到重放，而不只验证 HTTP/返回值。未发现本次范围内新问题。

最终验证（固定 Node v22.23.3 PATH）：

- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-p2-clock-family.json`：
  退出码 0，84/84 套件、1032/1032 测试通过，无失败或跳过；日志 `/tmp/lms-t1-p2-clock-family.log`。
  与 §18.2 的 `/tmp/lms-t1-operation-final.json` 按路径/用例全名比对，原 1029 个用例无缺失，新增恰好上述 3 个。
- Gateway 聚焦命令：`node node_modules/jest/bin/jest.js --config=backend/gateway/jest.config.js
  --runInBand --runTestsByPath backend/gateway/__tests__/familyTask6Routes.test.js --silent`，退出码 0，3/3 通过。
- 服务与测试的 `node --check`、`node scripts/check-family-docs.js`、`git diff --check` 通过。
  文档门禁仍包含 16 个自主学习契约探针、35 个价值门禁探针、388 个 fixtures 和 38 项既有需求。
- 本轮未复现 §18.2 的 socket hang up，未修改该路径或增加重跑/跳过；根因未确定的既有风险仍保留，
  不能将一次完整通过解释为稳定性问题已解决。未执行前端、legacy 或部署验收，不将其标为本轮通过。

评审问题 `T1-P2-LEASE-CLOCK` 状态：CLOSED（2026-10-22 复审通过，用户明确批准关闭）。
独立复审重新执行家庭回归：84/84 套件、1032/1032 测试，无失败或跳过，证据
`/tmp/lms-t1-p2-rereview-family.json`；Gateway 3/3、文档门禁及真实生产 app 隔离探针通过。
两个跨截止点负向用例及独立响应时钟用例有效，未发现本次修订引入新问题。关闭仅针对该 P2，不代表 T1 发布批准。
隐私删除/精确凭证/保留清理仍未完成，新协议继续未启用，T1 保持 IN_PROGRESS。
本批无部署、迁移、提交或推送；回滚只撤回本次时钟修复及配套测试/文档，不删除任何 operation ledger。

### 18.4 第三批：完成媒体隐私删除与保留清理

用户授权实施，资源服务本批实现及自审完成；T1 整体 IN_PROGRESS，生产路由、公共 client、homework 编排仍不接入。
范围：资源服务独立删除事务、最小 tombstone/精确释放凭证、持久删除日志、30 天受控清理及测试。
实现约束：复用 operation 的整组校验与 CAS；删除和 prepare/commit 对同一资产实际写入，
不跨服务写教学记录；重复请求保留首次 actor/时间。日志失败不得报告删除成功，物理清理不得删除凭证。
本批只在临时副本集、临时文件目录验证，不迁移真实数据。未启用代码可撤回；存在删除事实后必须
保留凭证与日志并前进修复，不能回滚为可读。部署前的日志介质/备份完整性与隔离恢复演练仍须另行验收。

实现记录：

- MediaDeletionTombstone 保存唯一 mediaId 的首次 scope/actor/role/deletedAt/user_requested；
  MediaDeletionReceipt 保存完整 scope/资源/字段/绑定代次/releasedAt 的唯一释放凭证。
  严格 schema 拒绝正文/文件名/路径，首次字段 immutable，无 TTL；均在删除事务内写入。
- completionMediaPrivacyService 每次（含清理后的重试）查询当前用户、Family 成员及 childIds；
  孩子还核对当前 familyId/tokenVersion。资产实际写入与 prepare/commit 的 __v 屏障竞争。
  复用 operation 的完整组校验与状态/version CAS：PREPARED 整组 ABORTED，未过期为 RESOURCE_NOT_FOUND，
  已过期为 MEDIA_OPERATION_EXPIRED；COMMITTED 保留终态/terminalAt，仅竞争版本并释放目标媒体精确 bound。
  多任务引用逐一处理，任一异常 scope/字段/不完整组导致全部事务回滚，不写教学状态/版本/星星。
- operation/status 的引用投影新增 privacyDeletion（无凭证为 null）；从持久 receipt 加匹配 tombstone 生成，
  operation 模式要求原绑定代次，references 模式报告当前精确凭证。普通 released/absent 不产生凭证，
  清理资产/引用后仍可恢复原 COMMITTED 的精确删除证明；客户端提供凭证字段被拒绝。
- mediaDeletionJournal 在数据库事务提交后、成功返回前确认最小日志的文件/目录/父目录持久性。
  丢响应或日志失败返回 pending；重试从原证据重新确认日志，不重写首次 actor/时间或重置保留期。
  root 必须显式指定绝对路径且父目录已存在，日志是受保护的独立介质接口，不默认使用应用工作目录。
- completionMediaCleanupService 检查 deletedAt 和最后引用/凭证 releasedAt 都满 30 天、无活跃引用，
  先确认日志，再在事务外移除正文，最后重查并事务删除资产/released 引用；不删除 tombstone/receipt/operation。
  移除正文失败可重试；正文已移除但数据库失败仍保留禁读元数据，重试允许正文已不存在。
- 新删除事务同时写 privacyDeletionRecorded=true；旧清理的候选与删除条件均排除此标记，
  无标记的历史 task_completion 删除继续走旧清理。标记不代替授权或精确凭证，不接受公开传入。

测试与红绿过程：

1. 新 completionMediaPrivacy.test.js 初始因缺少 MediaDeletionTombstone 模块失败，随后实现模型与服务。
   首轮新隐私测试 20/20、原 operation 测试 63/63 通过，输出 `/tmp/lms-t1-privacy-first.json`。
2. 增加旧签名禁读、日志故障、物理删除后数据库失败、并发双 actor 删除、模型唯一/不可变/无 TTL、
   凭证伪造/孤儿凭证等检查，27/27 通过，输出 `/tmp/lms-t1-privacy-expanded.json`。
3. 自审补父目录 fsync 故障注入，先因错误返回成功而失败；补齐父目录同步后 28/28 通过，
   输出 `/tmp/lms-t1-privacy-journal-green.json`。不是以仅创建文件代替持久确认。
4. 自审发现初版按 purpose 全部排除旧清理会改变历史行为，新增兼容测试先失败（期望 cleaned=1，实际 0），
   收窄为新事务标记分流后通过。新隐私 29/29、旧清理 3/3，通过结果 `/tmp/lms-t1-privacy-cleanup-green.json`。
   旧 operation 的 ABSENT 引用断言仅增加正式可空 privacyDeletion 字段，未删除或弱化原语义断言。

最终验证（固定 Node v22.23.3 PATH）：

- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-privacy-family.json`：退出码 0，
  85/85 套件、1061/1061 测试通过，无失败/跳过；日志 `/tmp/lms-t1-privacy-family.log`。
  与 P2 独立复审 JSON 按路径和用例全名比对，原 1032 用例均保留，新增恰好 29 个。
- Gateway familyTask6Routes.test.js 3/3 通过。真实 createProductionApp 探针：旧 prepare/commit/unbind
  拒绝 completionMediaIds（400），abort/status 404，无凭据 401；事务启动为 0，新增 operation、
  删除/清理/日志服务及两个删除凭证模型均未加载。server、路由、Gateway、旧 mediaService 和公共 client 未改。
- 12 个相关 JS 文件（包含未跟踪新增文件）的 node --check 及逐文件空白检查通过；git diff --check 通过。
  node scripts/check-family-docs.js 通过：16 个自主学习契约探针、35 个价值门禁探针、388 fixtures、38 项既有需求。
- 全部数据与正文均为临时副本集及临时文件中的合成样本；未部署、未迁移真实数据、未提交或推送。

自审结论：本批服务层范围内未发现剩余阻断项。一次独立只读审查覆盖核心事务、凭证、日志、清理与授权，
未发现可复现的 P1/P2；其结论限于静态检查，后续标记分流由上述红绿与完整回归验证，不冒称独立验收批准。
P2 租约用例、终态竞争、回滚和历史重放继续通过。此前 socket hang up 根因风险仍保留，不因本次通过关闭。

下一批边界：生产依赖注入/内部凭据路由/公共 client、homework 恢复、HTTP/前端删除与冻结场景、
受保护日志介质配置和备份完整性/T8 隔离恢复演练尚待实施验收。不得把服务层测试当作真实备份恢复证据，
不得启用生产路由或宣称 SL-01/T1 已完成。本批完成后继续保持新协议未启用。

第三批复审结论（2026-10-22）：CLOSED。用户已批准独立复审结果并授权关闭本批评审。
复审重新执行家庭回归，85/85 套件、1061/1061 用例通过，无失败/跳过，退出码 0；
证据 `/tmp/lms-privacy-rereview-family.json`。与第三批自审相比无用例移除；与 P2 基线相比新增 29 个。
另有 Gateway 3/3、文档门禁、12 个 JS 文件语法/空白与 git diff --check 通过。
临时副本集额外探针验证 COMMITTED 删除事务回滚、同组不同媒体并发删除、租约截止点删除、
物理缺失标记的历史数据清理、并发清理，均通过；这些探针不是已入库的新增测试。
真实生产 app 探针仍为旧写接口 400、新 abort/status 404、无凭据 401、事务启动 0、新模块未加载。
本批服务层无待修订发现；真实介质/恢复演练和既有 socket hang up 根因风险仍保留，T1 仍 IN_PROGRESS。

### 18.5 第四批：隔离的公共 completion client

范围裁定：先交付新协议公共 client 的 prepare/commit/abort、status(operation/references) 适配与
严格响应校验；不改旧 client 行为，不实例化到生产依赖，不注册路由，不调用真实服务。
客户端显式接收已持久化 remoteOperationId，转换为内部 HTTP operationId；不生成、不回退公开 UUID。
本批不证明映射已持久化，持久化来源由后续 homework 占位事务负责。
未知传输结果、裸 4xx/5xx、畸形/错配响应均保留 pending；只有经验证的 200 ABORTED 是终态证据，
但何时允许本地失败清锁仍由后续编排阶段规则决定，client 不操作本地任务或数据库。
风险控制：所有参数先校验，完整引用集及远程摘要/代次逐项核验，不输出远端错误正文或 Axios 凭据。
回滚：本批没有业务调用或数据写入，撤回新增工厂、导出和配套测试即可；不回滚此前删除事实或凭证。
第四批交付时待办：精确代次 unbind 适配（现见 §18.6）、生产内部路由/依赖注入、homework 恢复与端到端验收。
实施状态：CLOSED，用户已批准本批复审及稀疏数组修复；复审证据见本节末。T1 整体 IN_PROGRESS，路由接入单独确认。

实现与验证记录（固定 Node v22.23.3）：

- 新 completionMediaReferenceClient 独立工厂经旧入口按需导出；只有显式构造新 client 才加载该模块。
  旧 client 的 prepare/commit/unbind 行为未改。当前业务代码没有构造新工厂。
- 严格请求白名单、1..10 非重复引用、远程映射和摘要；响应校验完整集合及逐项身份、终态/租约形状、
  精确 privacyDeletion，保留历史终态下的当前其他代次/absent。commit/abort 不接受 PREPARED。
- 未知结果不自动重试、不跟随 HTTP 重定向；错误一律脱敏，不将裸错误码当作终态。
  真实本地 HTTP 307 探针证实不会请求重定向目标，避免内部凭据随重定向转发。
- 首轮 74 个 client 测试因缺少工厂失败，`/tmp/lms-t1-client-red.log`；实现后新旧 client 98/98 通过。
  自审增加终态动作约束、规范绑定 UUID 与禁跟随重定向，7 个负向/请求配置断言先失败，
  `/tmp/lms-t1-client-hardening-red.log`；修正后通过，未弱化断言。
- 独立评审前 client 单元 97/97，旧 client 24/24，合计 121/121；
  `/tmp/lms-t1-client-unit-final.json`。涵盖映射缺失/公开 UUID 注入、摘要/集合错配、错误凭证、
  不完整租约/终态、裸 4xx/5xx、传输失败、历史代次及输入规范化。
- 真实临时 MongoDB 副本集契约测试 7/7，`/tmp/lms-t1-client-contract.json`：真实 provider 的
  ABSENT/PREPARED/COMMITTED/ABORTED、丢提交响应恢复、摘要冲突、租约、删除凭证和物理清理、
  历史命令的另一绑定代次；adapter 只替换传输，服务及事务真实执行，不冒称新 HTTP handler 已存在。
- 生产隔离检查已入库 completionProtocolIsolation.test.js，7/7：真实 createProductionApp 的旧
  prepare/commit/unbind 对新字段 400、abort/status 404、无凭据 401，数据库事务未启动；
  生产组合及旧 client 不加载新协议/隐私删除/清理/client 模块。
- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-client-family.json`：
  退出码 0，88/88 套件、1172/1172 用例通过，无失败/跳过；日志 `/tmp/lms-t1-client-family.log`。
  按路径及用例全名与 `/tmp/lms-privacy-rereview-family.json` 对比，原 1061 用例均保留，新增 111 个。
- 6 个本批 JS 文件（含未跟踪文件）语法/空白检查通过，git diff --check 通过。
  文档门禁通过：23 基线文档、4 自主学习文档、16 契约探针、35 价值探针、388 fixtures、38 项既有需求。

自审结论：本批传输与校验边界无剩余阻断项；未改变生产路由或旧 client 行为。协议校验通过仅证明
远程响应可解释，不替代 homework 本地 owner/阶段 CAS、持久化映射和逐项发布资格检查。
本批未迁移/修改真实数据，未提交、推送或部署。此前 socket hang up 根因风险仍保留。
生产内部路由与依赖注入、精确代次 unbind、homework 编排及真实备份恢复继续待办，生产接入另行确认。

独立检查与修正：只读 reviewer 在本批范围内未发现 P0-P2，报告一个 P3 稀疏数组边界：
Array.map 跳过空槽，使稀疏请求进入 transport，且自定义 adapter 的稀疏响应可绕过逐项校验。
普通 HTTP JSON 不直接产生稀疏响应，但进程内入参仍可能出现。按本批“完整引用集合必须校验”的
明确交付约束，本轮将其作为必须修正的契约缺口处理，不延期，不扩展到其他协议。
新增两个负向用例，先观察本地错误码不符及畸形响应被接受，`/tmp/lms-t1-client-sparse-red.log`。
改为逐槽 Array.from 校验，并在响应返回前检查剩余请求集合为空；新 client 99/99、旧 client 24/24
通过，`/tmp/lms-t1-client-sparse-green.json`。reviewer 只运行纯内存 client 测试（96 通过、1 跳过），
服务契约/路由/真实重定向由主线程全量回归验证；不冒称 reviewer 已复审修复后的版本。

修正后最终门禁：

- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-client-family-final.json`：
  退出码 0，88/88 套件、1174/1174 用例通过，无失败/跳过；日志 `/tmp/lms-t1-client-family-final.log`。
  对比第三批复审，原 1061 个用例无移除，本批新增 113 个（client 99、真实服务契约 7、生产隔离 7）。
- 修正后 6 个 JS 文件语法/空白、git diff --check、文档门禁重新通过。
- 最终自审未发现剩余阻断项；稀疏数组问题已修复并固化测试，本批仍等待用户复审，不提前记录用户批准。
  未接入任何生产路由或业务调用、未提交/推送/部署；T1 整体继续 IN_PROGRESS。

第四批复审结论（2026-10-22）：CLOSED。用户已批准复审，公共 completion client 与 P3 稀疏数组问题关闭。
复审证据 `/tmp/lms-t1-client-rereview-family.json`：88/88 套件、1174/1174 用例通过，退出码 0，
无失败/跳过，与修正后基线相比无用例移除；另有新旧 client 123/123、文档门禁及生产隔离验证通过。
此关闭仅覆盖第四批，不代表 T1 或生产接入获准；既有 socket hang up 根因风险仍保留。

### 18.6 第五批：精确绑定代次 unbind 与 client

范围：独立 operation service 与 completion client 增加 unbind，不修改生产路由、旧 client 或业务注入。
当前 remoteOperationId 映射为解绑审计 operationId，各项 bindingOperationId 必须来自旧绑定；
不传 commandHash、不创建当前 resource operation，支持纯移除及跨旧代次的完整移除集合。
同代次 bound 通过旧 COMMITTED operation 版本 CAS 和引用 CAS 整批事务释放；同代次 released 不改首次审计，
absent 如实返回。其他代次或 prepared（含已过期）整批拒绝，unbind 不是 abort。
响应 operation=null，只接受 released/absent；删除凭证按各项旧代次匹配，普通释放不生成隐私删除事实。
风险与回滚：防止迟到解绑伤及新绑定；使用合成数据副本集覆盖竞争、回滚及重试，不访问真实数据。
无 schema 迁移或生产调用，撤回新增方法及测试即可回滚；不得删除原 operation/删除凭证。
实施状态：CLOSED，用户已批准第五批复审；T1 整体 IN_PROGRESS，未批准生产接入。

实现与验收追踪：

| 边界 | 固化测试与预期 |
| --- | --- |
| 当前 R_B / 旧绑定 R_A | client 只映射持久化 remoteOperationId；移除项旧代次独立；不接受 commandHash/公开 UUID 兜底 |
| 终态与整批事务 | 1/10 引用、跨旧 operation、bound/released/absent 混合集合；旧终态/摘要/terminalAt 不变，每个实际写入的旧 operation 只增加一次版本 |
| 失败/重试 | 第二行写失败整批回滚；引用 CAS 丢失回滚后重试；operation CAS 重试耗尽保持 pending；丢响应重放保留首次审计 |
| 租约/代次 | prepared 即使过期也拒绝部分解绑；新代次 prepared/bound/released 均阻断旧解绑；历史 prepare/commit/abort 不重新绑定 |
| 隐私/保留 | 删除先于解绑、解绑先于删除及并发；清理后 absent 凭证仍匹配旧绑定，错误旧代次不复用其他凭证，普通释放不伪造删除凭证 |
| client 集合与错误 | 稀疏/重复/缺项/额外项、错误字段/代次/凭证、不合法终态、裸错误均拒绝；多个旧代次逐项匹配 |
| 家庭边界与隔离 | familyId/childId/resourceId 变化不能释放原引用；生产 app 使用合法新 unbind 请求体仍拒绝，不启动事务或加载新模块 |

测试先行证据：`/tmp/lms-t1-unbind-service-red.log` 的 23 个新服务测试、
`/tmp/lms-t1-unbind-client-red.log` 的 24 个新 client 测试均因缺少 unbind 方法失败。
初次实现后服务负向测试出现 6 个断言失败，原因是测试误用 status 而非项目 AppError.statusCode；
修正测试属性，保留 400 和 VALIDATION_ERROR 双重断言，未改变生产错误类型或放松拒绝条件。
随后补充 CAS 重试、provider 稀疏数组和双引用响应负向用例，并扩展真实 provider/client 契约。
生产隔离测试改用合法的新 unbind 请求体（含 bindingOperationId、不含 commandHash），
避免仅因畸形请求而得到 400 的假隔离证据。

自审与独立检查：本批范围内未发现剩余可复现的阻断项。独立 reviewer 对事务/代次/凭证、client
完整集合及生产依赖作只读审查，并实际执行新 unbind client 29/29 单测，退出码 0，无 actionable findings。
其事务与生产入口结论来自静态审查，没有重跑副本集或 HTTP；运行证据由主线程记录，不冒称独立验收批准。
边界仍在：absent 是当前事务快照结果，不能替代后续 homework owner/阶段锁；本批不修改本地任务状态，
不证明跨服务发布已完成，也不提供生产接入授权。既有 socket hang up 根因风险仍保留。

最终验证（固定 Node v22.23.3 PATH）：

- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-unbind-family.json`：
  退出码 0，89/89 套件、1239/1239 用例通过，无失败/跳过，167.743 秒；日志 `/tmp/lms-t1-unbind-family.log`。
  与第四批复审按路径/用例全名及重复计数比对，原 1174 个全部保留，新增 65 个：
  operation service 29（其中 provider 稀疏入参 4）、unbind client 29、真实 provider/client 契约 7。
- 生产隔离使用合法新 unbind 请求体后单独重跑：7/7 通过、退出码 0，
  `/tmp/lms-t1-unbind-isolation.json`；prepare/commit/unbind 400、abort/status 404、无凭据 401，
  事务启动为 0、新协议模块未加载。server、生产路由、Gateway 和旧 client 实现本批均未修改。
- 6 个相关 JS 文件（包括未跟踪文件）语法与逐文件空白检查、git diff --check 通过。
  文档门禁通过：23 基线文档、4 自主学习文档、16 契约探针、35 价值探针、388 fixtures、38 项既有需求。
- 所有数据库写入、正文删除与日志使用临时副本集/临时目录中的合成数据；未部署、迁移真实数据、提交或推送。

下一批仍为 homework 本地占位/owner CAS、持久化远程映射与恢复编排及其测试；路由/依赖注入需单独确认。
本批服务契约 adapter 不等于真实内部 HTTP 已实现，不提前勾选 T1 端到端或备份恢复验收。

第五批复审关闭（2026-10-22）：用户批准精确代次 unbind/client 复审。复审重新运行 89/89 套件、
1239/1239 用例，退出码 0，无失败/跳过，无用例新增或移除；证据 `/tmp/lms-t1-unbind-rereview-family.json`。
四个临时副本集探针另验证跨旧 operation 回滚、凭证缺 tombstone 回滚、已释放重放和全 absent 纯移除，均通过。
生产隔离 7/7、文档门禁、6 个 JS 语法/空白及 git diff --check 通过；没有待修订发现。

### 18.7 第六批：隔离的 homework 完成本地事务与恢复

范围：新增本地完成服务、媒体恢复编排、GrowthTask 加法兼容隐藏状态及测试；不注册路由、worker 或生产依赖。
复用现有家庭授权读取和事务 helper；跨服务只调用 completion client，不跨库读写资源引用。
首次占位同事务保存完整 owner、规范 hash、不可变 remoteOperationId 和最小 pending patch；
先确认不确定标记 CAS，再调用远端。PREPUBLISH、PUBLISHED_CLEANUP 的本地变化均按 owner/阶段/版本 CAS。
错误或未知结果保留意图，只有确定远程 ABORTED 才清失败锁；发布后只清理旧绑定，不再 abort 或重复发布。
风险/保护：覆盖越权、并发、新旧执行器、丢响应/数据库结果未知、隐私删除证据及历史终态重放。
回滚：未启用生产写入，无真实数据迁移；撤回新增服务与字段定义即可，不删除既有任务或 operation。
裁定：本批提供未注入生产的本地编排；旧完成/确认/编辑等 HTTP 写入口的统一锁接入属于后续生产接入批次，
不得把本批通过解释为这些旧入口已经遵守新锁，也不得在旧入口运行时启用新服务写真实数据。
裁定：完成字段缺失仍按旧版本 0 读取，不给历史任务批量写默认值；恢复元数据单独隐藏于 completionPending，
不复用材料引用的 mediaRemoteOutcomeUncertain。清单仅增加兼容定义与完成版本检查，不实现清单编辑端点。
实施状态：CLOSED，用户已批准本批复审及三项 P2 关闭；T1 整体仍 IN_PROGRESS，未批准生产接入。

实现/验收对应：

| 边界 | 本批固化场景 |
| --- | --- |
| 首次占位与映射 | owner/ledger 同事务；写入失败整组回滚；不同 actor 同 UUID 不共用远程标识；唯一碰撞仅回滚后重分配 |
| 本地 CAS | 同版本两个命令竞争、同命令并发、不重复发布；迟到执行器不能清除新 owner；清单/状态/owner/hash 变化阻断 |
| 结果未知 | claim/mark/publish/finalize/fail 本地提交后丢确认；prepare/commit 远端提交后丢响应；重启后仅读原映射恢复 |
| 远程收敛 | PREPARED 继续 commit；过期先 abort；ABSENT 对账后迟到 commit 胜出按 COMMITTED 发布；裸 4xx 保持 pending |
| 发布与清理 | 0/1/10 图片、纯重排、保留旧代次、纯移除不发空命令；解绑失败保留新证据和 owner；重试只清理，不再发布 |
| 隐私凭证 | COMMITTED 后精确隐私删除凭证允许发布；保留清理后 absent 凭证仍可恢复；普通 released 不足以发布 |
| 授权与重放 | 每次本地推进实时授权；撤销成员、其他孩子、过期孩子 token 拒绝；终态重放不取当前任务重建，不重复远端副作用 |
| 输入与响应 | 本地白名单/数量/重复/稀疏数组/版本校验先于占位；编排拒绝错标识/摘要/不完整集合/错误代次；业务媒体拒绝公开统一 404 |
| 兼容与隔离 | 旧任务读版本 0 无回填；pending patch 不进稳定投影；生产工厂只注入旧附件服务；旧 GET 不加载新服务、不恢复、不暴露意图 |

测试组织：homework 测试共用生命周期按新 completion 测试文件启用临时单节点副本集，旧套件保留原
MongoMemoryServer；不在单个测试内另外启动数据库。通过真实 provider/client 契约 adapter 测试两侧
事务，不宣称覆盖尚未注册的内部 HTTP。隐私恢复场景使用真实数据库删除凭证与清理状态，日志和文件
存储替身仅隔离外部 I/O；真实日志 fsync/清理失败已由第三批覆盖，实际备份恢复演练仍待发布前验收。

测试先行记录：初次 `/tmp/lms-t1-homework-red.log` 因缺失新服务而套件加载失败，未执行断言，
不计为 36 个负向用例已证伪。实现后的首轮失败来自合成 User 缺少唯一 username/email，以及 deleted
资产缺少 deletedAt；修正夹具，没有放宽业务拒绝或模型验证。随后本地编排 48/48 通过，补上隐私删除
与竞争、媒体编排和生产隔离后，定向 3/3 套件、69/69 用例通过，15.686 秒，退出码 0，
证据 `/tmp/lms-t1-homework-focused.json` 和 `/tmp/lms-t1-homework-focused.log`。

固定实现裁定：完成意图的独立字段为 completionPending.remoteOutcomeUncertain；模板中的旧材料
mediaRemoteOutcomeUncertain 不复用。经过校验的远程媒体业务拒绝统一公开 404 RESOURCE_NOT_FOUND，
租约过期/主动终止保留对应 409；错误响应本身不能清锁。字段与恢复说明同步 API §14、架构 §12.3
及自主学习详细设计 §5.3。生产依赖注入、真实内部 HTTP、旧写入口统一锁、运维告警接入及备份恢复
均非本批验收，不提前关闭 T1 整体门禁。

独立只读审查发现并修正三项 P2（已于本节末复审关闭，以下保留修正过程）：

1. `T1-HW-AUTH-ENUM`：不存在任务 404/越权任务 403 可区分存在性。read/complete/recover 对合法格式
   不存在或不可访问任务统一 403 CHILD_ACCESS_DENIED，保留鉴权先于 schema/终态重放的顺序。
2. `T1-HW-ERROR-CODES`：缺少新增 operation/期望版本、图片超限及非法勾选曾折叠为通用错误。
   按 API 分别恢复 CLIENT_UPGRADE_REQUIRED、MEDIA_ATTACHMENT_LIMIT_EXCEEDED、CHECKLIST_ITEM_INVALID；
   畸形格式、未知字段和 remoteOperationId 注入仍为 VALIDATION_ERROR。
3. `T1-HW-CHECKLIST-CASE`：清单 ID 错误使用媒体 ID 的小写去重，拒绝 A/a 两个合法项。
   清单按原始字符串精确去重，媒体仍按规范小写去重；排序后的勾选集合保持同命令幂等。

先修订原两个错误码断言并新增 14 个回归场景，`/tmp/lms-t1-homework-review-red.json` 实测
16 失败、49 通过，退出码 1，失败均为上述错误差异或合法清单被拒绝；随后修正实现。
reviewer 仅进行静态与进程内轻量验证，未修改文件、未启动数据库，未独立复审修复后的版本。
主线程负责修正后的运行验证，不把这次独立检查描述为用户验收或零发现。

修正后最终验证（Node v22.23.3）：

- 定向三个新套件 83/83 用例通过，退出码 0，13.663 秒；
  `/tmp/lms-t1-homework-review-green.json`、`/tmp/lms-t1-homework-review-green.log`。
- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-homework-family-final.json`：
  退出码 0，92/92 套件、1322/1322 用例通过，无失败/跳过，160.718 秒；
  日志 `/tmp/lms-t1-homework-family-final.log`。按文件路径、用例全名及重复计数与第五批复审比较，
  原 1239 个全部保留，新增 83 个（本地编排 65、媒体编排 16、生产组合隔离 2）。
- 首轮全量家庭回归 `/tmp/lms-t1-homework-family.json` 为 92/92 套件、1308/1308 用例通过，
  164.219 秒；它发生在三项 P2 修正之前，不作为最终通过证据。
- 9 个相关 JS 文件（包含未跟踪文件）语法/逐文件空白、git diff --check、文档门禁均通过。
  文档门禁包含 23 基线文档、4 自主学习文档、16 契约探针、35 价值探针、388 fixtures、38 项既有需求。
- 生产 server/路由/Gateway 未修改，新服务构造器引用只出现在独立模块与测试；完整回归包含两侧
  生产隔离验证。所有事务使用临时副本集合成数据，未接入生产、未迁移真实数据、未提交或推送。

修正后自审：三项 P2 均已有真实先红后绿证据，主线程复核错误优先级、规范化与恢复 hash 的一致性，
未发现本批剩余阻断项；这不代替用户复审批准。旧 socket hang up 根因风险仍保留，不能因本次回归
通过便声称根因消失。下一步先复审本批，生产接入/旧写入口锁改造仍须单独确认。

第六批复审关闭（2026-10-22）：用户明确批准关闭 homework 本地事务与恢复编排，以及
T1-HW-AUTH-ENUM、T1-HW-ERROR-CODES、T1-HW-CHECKLIST-CASE 三项 P2。
复审证据 `/tmp/lms-t1-homework-rereview-family.json`：92/92 套件、1322/1322 用例通过，
退出码 0，无失败/跳过，171.521 秒；与上轮比对无实际用例增删（仅一个夹具日期标签变化）。
另有四个临时副本集探针覆盖 mark/fail/finalize 事务回滚及解绑成功丢响应，均通过。
9 个 JS 语法/空白、文档门禁和 git diff --check 通过；生产路由仍未接入。

### 18.8 第七批：独立版本确认与发星恢复

实施状态：用户复审通过并授权关闭，本批 CLOSED；T1 整体 IN_PROGRESS，未获生产接入授权。
范围为未注入生产的确认服务及其测试，不改旧路由或奖励账本算法。
按计划实现 completed 作品 expectedCompletionVersion CAS、引用/owner 锁、历史无媒体版本 0 初始化，
确认同事务固化首位确认者、时间、反馈及 starAwardState=pending；提交确认后才调用现有发星 client。
发星失败/本地结果未知保持 pending，重试利用现有 task_confirmation 唯一账本键，禁止重复发星。
发星完成后另一个本地事务 CAS pending→awarded，重新校验当前家长授权和作品版本，不覆盖首次确认事实。
裁定：已 confirmed 的同版本重试可由当前仍获授权的共管家长发起；远程 confirmedByParentId 用当前请求者
满足现有 progress 实时授权，GrowthTask 的 confirmedByParentId/confirmedAt/parentFeedback 保留首次确认值。
不同版本重试仍冲突，不以已发星绕过授权/版本检查。确认不创建新的 completion operation 或递增作品版本。
风险与验证：用临时副本集合成数据覆盖完成/确认竞争、旧任务兼容、权限拒绝、发星丢响应、事务回滚/未知结果。
跨服务仅经既有 starAwardClient，测试 adapter 调用真实现有内部发星路由；不跨服务写库或接入新生产路由。
回滚：未启用生产写入，无迁移；撤回本批新增服务/测试即可，保留已存在的任务、命令和账本数据。
旧写入口统一锁、生产依赖注入和发布仍需单独确认，本批通过不代表 T1 整体完成。

实现与测试对应：

| 边界 | 固化用例 |
| --- | --- |
| 所见版本与竞争 | 版本不符拒绝；完成占位先胜则确认 pending/重新读取版本；确认先胜则新完成不能覆盖；双家长并发保留胜出者审计 |
| 作品与 owner | 活动 owner、pending 意图、两类引用 pending 均阻断；真实 bound 媒体确认不重绑、不改证据；旧完成命令仍按原投影重放 |
| 旧数据 | completed/confirmed-pending 无完成媒体且缺版本时初始化为 0；不改 completedAt、不创建新完成命令、不重复发星；非空媒体缺状态拒绝 |
| 发星幂等 | 真实既有 client → progress 内部凭据路由 → Task 5 账本，重复确认和双家长竞争只有一条账本；已 awarded 不再次发星 |
| 故障与恢复 | 确认/award 两阶段事务回滚和提交后丢确认；远程发星已成功但响应丢失/畸形；确认 CAS 丢失不留下部分写入；迟到响应不覆盖变化后的任务状态 |
| 授权与审计 | 孩子/离家家长/不存在任务拒绝；确认前和发星后实时授权；共管家长接续恢复不覆盖原确认审计；返回投影不包含隐藏恢复字段 |
| 生产隔离 | 工厂仍只注入旧附件服务；确认新模块不在生产 require cache；未修改旧路由、server 或 Gateway |

测试先行：`/tmp/lms-t1-confirm-red.log` 运行首个核心用例，确认服务尚未实现时该用例失败，
退出码 1（1 失败、28 因 testNamePattern 未选中）；不是套件加载失败。
实现后 29/29 通过，补充真实媒体、畸形响应、迟到响应和 CAS 回滚后，确认套件 33/33 通过，
加生产隔离共 2/2 套件、35/35 用例通过、退出码 0，9.897 秒；
证据 `/tmp/lms-t1-confirm-focused-final.json`、`/tmp/lms-t1-confirm-focused-final.log`。
以上均为合成数据临时副本集；真实现有路由经 Supertest adapter 验证，不代表新确认 HTTP 已接入。

自审与独立只读审查：未发现本批剩余可复现阻断项。独立 reviewer 核对确认/完成竞争、版本/owner CAS、
历史版本 0、事务外发星、未知结果/回滚、首次审计与实时权限，并执行 18 项纯内存检查，全部通过。
reviewer 未启动 Mongo 或运行仓库测试，纯内存结果不替代本节主线程真实副本集/HTTP 路由验收。
本批不改 starAwardClient、progress 发星路由/账本、旧 homework handler；现有奖励能力仅作依赖复用。
仍保留此前 socket hang up 根因风险；受控部署、实际索引检查、生产统一锁和备份恢复另行验收。

最终门禁（固定 Node v22.23.3）：

- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-confirm-family.json`：退出码 0，
  93/93 套件、1355/1355 用例通过，无失败/跳过，167.499 秒；日志 `/tmp/lms-t1-confirm-family.log`。
  与第六批复审按路径/用例名及重复计数核对，1322 个原用例全部保留，新增确认服务 33 个用例。
  比对仅规范化已知“deleted 媒体拒绝”参数化名称中的夹具日期，不忽略其他名称差异。
- 三个相关 JS 文件（新增服务、新增测试及扩展生产隔离测试）的语法/逐文件空白、git diff --check
  和文档门禁通过；23 基线文档、4 自主学习文档、16 契约探针、35 价值探针、388 fixtures、38 项既有需求。
- 新服务只有测试引用，生产 server/Gateway/路由与既有发星 client、progress 账本实现无修改。
  两侧生产隔离用例均纳入完整家庭回归；无新 worker，无真实数据库或文件删除操作。
- 自审及独立检查未发现待修订项；已同步 API、总体架构、详细设计和实施计划。未提交/推送/部署。

裁定影响：当前授权家长只接续既有发星幂等流程，不获得改写原确认事实的权限；若将来需要改变此
治理规则，需重新评审服务与 progress 的授权契约，不能在旧路由接入时隐式替换 confirmedByParentId。
用户复审关闭记录（2026-10-22）：版本确认、owner CAS、历史版本 0、发星幂等/未知结果恢复、
共管接续与首次确认审计通过。本轮另执行 4 个临时副本集探针通过；未修改生产路由。
首轮全量回归退出码 1：92/93 套件、1354/1355 用例通过，TC-T6-MEDIA-008 预期 403 实得 401。
该媒体套件单独重跑 43/43 通过；第二轮全量退出码 0，93/93 套件、1355/1355 用例通过，175.214 秒。
证据：`/tmp/lms-t1-confirm-rereview-family.log`、`/tmp/lms-t1-confirm-rereview-media.json`、
`/tmp/lms-t1-confirm-rereview-family-2.json`。用例清单按路径/名称/重复计数比对一致，
仅规范化两个已知动态夹具值（删除日期、非法确认字段中的 UUID）。

稳定性问题 STAB-T1-MEDIA-401：OPEN。familyMedia.test.js 的跨家庭/兄弟姐妹访问用例偶发返回 401，
根因未确定；相关测试和认证代码未被第七批修改，不能据此断言与本批无关或已解决。
后续收集脱敏 response.error.code 和认证阶段诊断，保留 403/CHILD_ACCESS_DENIED 断言，
不得放宽断言、跳过测试或仅凭重跑成功关闭。与此前 socket hang up 风险分别跟踪，不推定同一根因。
用户批准关闭本批实现评审不等于关闭此稳定性问题或批准生产发布。

### 18.9 第八批：独立任务编辑与取消/归档互斥

实施状态：用户复审及后续 P2 修复复审通过，CLOSED（关闭依据见 §18.10）；T1 整体 IN_PROGRESS。
按既有 T1 计划补齐任务生命周期写入的事务/owner CAS；生产路由未接入。
范围：独立服务复用任务编辑白名单，支持不含材料变更的 pending 任务编辑、pending 取消、
completed/confirmed 归档及终态重复删除；不物理删除任务，不改完成证据、版本、绑定或发星审计。
裁定：本批不实现材料附件编排或 T2 清单编辑；附件字段显式拒绝，不静默忽略、不调用旧附件服务。
原因是材料恢复和生产统一接入需独立验收；代价是本批服务不能替代完整旧 PATCH handler。
最终写入在同一事务中检查实时家庭权限、无活动 owner/pending、两类引用稳定及任务状态/__v；
confirmed 发星 pending 时仍禁止归档。事务回滚或提交未知不宣告成功，重试先读取当前状态。
验证：真实临时副本集覆盖权限/白名单、完成与编辑/取消竞争、确认与归档竞争、发星恢复、
CAS 失配、事务回滚与提交未知，以及首次取消时间/作品审计保留和生产模块隔离。
风险与回滚：仅合成数据，无真实库迁移；撤回新增服务/测试可回滚，旧生产 handler 保持原状。
本批不等于所有写入口已经受锁保护；生产接入、材料编排、清单编辑和跨服务端到端门禁仍待后续。

自审修正：初版仅在最终更新校验值，持锁任务的非法 dimension/空 title 先返回 503，
不符合 schema 优先于锁的约定。两个负向用例先红（预期 400、实得 503），
随后复用 Task.validate 在鉴权后、事务锁检查前校验白名单值，最终写入仍 runValidators。
红灯证据 `/tmp/lms-t1-mutation-schema-red.log`；修复后的绿灯及最终全量证据见下。

测试与自审记录：

| 边界 | 覆盖 |
| --- | --- |
| 权限与字段 | 家长/共管允许，孩子/离家家长/不存在任务拒绝；保护字段、非法模型值、材料/清单拒绝；编辑值在鉴权后先于锁校验 |
| 状态与审计 | pending 编辑/取消，completed/已发星 confirmed 归档；pending 发星拒绝；完成证据/命令重放、首次取消/确认审计保留 |
| owner 竞争 | 四种锁阻断 edit/remove；完成占位先胜；取消先胜；编辑先提交后完成保留元数据；旧事务快照不能覆盖新 owner |
| 确认竞争 | 归档先胜不发星；确认提交后等待发星响应时禁止归档；发星恢复成功才允许归档 |
| 故障与旧数据 | edit/remove 回滚、提交后丢确认、CAS 失配；缺 __v 和完成字段兼容；未知编辑重试不能覆盖后续完成；无活动事务/非法时钟拒绝 |
| 生产边界 | 生产工厂仍仅注入旧附件服务，require cache 不含新 mutation 模块；新服务无远程调用、无生产路由引用 |

首个红灯：`/tmp/lms-t1-mutation-red.log`，两个基础用例因未实现而失败，退出码 1；不是导入错误。
初次定向 3 套件 78 用例通过，增加交错/故障验证后 mutation 48/48 通过；
错误优先级两个负向用例先红，再修正。修复后最终定向 3/3 套件、85/85 用例通过（mutation 50、
confirmation 33、隔离 2），退出码 0、15.605 秒。
证据：`/tmp/lms-t1-mutation-focused-final.json`、`/tmp/lms-t1-mutation-focused-final.log`。
本批 mutation 的发星边界测试使用注入回执验证并发，不声称独立验证奖励账本；既有确认套件和全量
回归继续覆盖真实 Task 5 client/内部路由/唯一账本。本批不引入替代奖励算法。

自审与一次独立只读审查：纳入最新 schema 优先级修复后未发现剩余可复现缺陷。
独立审查对照 completion/confirmation、模型和编辑解析器，核对事务、最终 CAS、审计及生产隔离；
执行三个 JS 语法检查，未启动 Mongo/Jest，不替代主线程的真实副本集验证。
STAB-T1-MEDIA-401 仍 OPEN；不因本批结果通过关闭，生产接入需另行批准。

最终门禁（固定 Node v22.23.3）：

- 中间版本全量回归 94/94 套件、1403/1403 用例通过，退出码 0、174.2 秒；
  `/tmp/lms-t1-mutation-family.json`。该轮在 schema 优先级修正前启动，不作为最终修复证据。
- 修复后 `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-mutation-family-final.json`：
  退出码 0，94/94 套件、1405/1405 用例通过，无失败/跳过，165.956 秒；
  日志 `/tmp/lms-t1-mutation-family-final.log`。
- 与第七批复审结果按路径、用例名称及重复计数比对：原 1355 个全部保留，新增 mutation 50 个。
  只规范化上述两个已知动态夹具值，不忽略其他用例差异。
- 三个相关 JS 语法/逐文件空白检查、git diff --check、文档门禁通过；23 基线文档、4 自主学习
  文档、16 契约探针、35 价值探针、8 AI 文档/22 AI 契约、388 fixtures、38 项既有需求。
- 本轮媒体权限用例通过，STAB-T1-MEDIA-401 根因仍未解决。既有 socket hang up 风险同样保留。
- 无生产路由、server、Gateway、既有奖励或旧附件编排改动；无真实数据/索引迁移、无提交/推送/部署。
  独立服务不得在旧入口统一互斥及生产接入获批前用于真实任务；回滚无需修改真实数据。

下一步复审本批；材料编排统一互斥、生产 HTTP/依赖注入及端到端验收仍待后续单独实施/批准。

### 18.10 第八批复审 P2：全部字段转换失败挂起

状态：用户复审通过并批准关闭，CLOSED；T1 仍 IN_PROGRESS，生产路由未接入。
复审发现 mutation 的 Task.validate 在全部请求字段发生 CastError 时不返回。
当前 Mongoose 8.14.2 会移除转换失败的待校验路径，路径全空后其 Promise 无完成分支。
已有非法枚举/空标题用例只覆盖普通验证错误，未覆盖这一分支。
单字段 `{estimatedMinutes:"not-a-number"}` 和多字段 `{estimatedMinutes:"bad",targetAmount:"bad"}`
在真实临时副本集复现；编辑事务未开始、任务未变化，但未返回约定的 400。

用户已授权局部修订：鉴权、白名单之后先显式 Task.castObject，再校验；不升级依赖、不改生产路由。
保留原请求字段集合为校验路径（castObject 会略过 null），原 patch 继续交给最终更新，
避免丢失必填 null 的验证或可选 null 的清空行为；空 patch 不调用 validate。
最终事务重新鉴权、锁/版本/__v CAS、runValidators 和未知结果语义保持不变。
风险/回滚：只影响独立服务的请求校验，无数据/schema/索引变更；局部代码可撤回，无真实数据操作。
验证：单字段/多字段全转换失败分别覆盖无锁/持锁；必须有界返回 400，不能进入 edit 事务或改变任务；
孩子/离家家长仍优先 403；混合合法字段不能部分写入；验证合法转换、必填/可选 null 和空编辑。
测试中的有界等待只用于暴露未结束 Promise，不新增生产超时或重试绕过。

复审回归保留记录：`/tmp/lms-t1-mutation-rereview-family.json`，退出码 1，93/94 套件、
1404/1405 用例通过，169.069 秒；growthLogs.test.js 的 TC-T5-LOG-003 预期 201 实得 401。
该套件单独重跑 11/11 通过，证据 `/tmp/lms-t1-mutation-rereview-growthlogs.json`。
稳定性问题 STAB-T1-GROWTHLOGS-401：OPEN，根因未确定，后续需收集脱敏错误码和认证阶段诊断。
STAB-T1-MEDIA-401 同样保持 OPEN；两者是否同源尚未证明，与 socket hang up 风险分别保留。
不得因单独重跑或后续全量通过关闭稳定性问题，也不得放宽断言、跳过测试或更改身份校验。

修订及红绿证据：

- Task.castObject 在首次鉴权和白名单之后执行，转换成功后用原字段集合执行 Task.validate；
  保留原 patch 的 null 清空语义，不改变最终事务、锁/版本/__v CAS 或 runValidators。
- 新增 11 个用例：单字段/多字段转换失败各自无锁/持锁（4），孩子/离家家长优先拒绝（2），
  混合有效字段无部分写入（1），合法转换、必填 null、可选 null、空编辑（4）。
- 红灯：`/tmp/lms-t1-mutation-cast-red.json`、`.log`，退出码 1，4 个目标用例均失败，
  57 个因 testNamePattern 未选中。实际为 unsettled，不是导入/环境失败；11.152 秒。
- 绿灯：`/tmp/lms-t1-mutation-cast-focused.json`、`.log`，退出码 0，3/3 套件、96/96 用例通过，
  无跳过，14.89 秒；mutation 61、confirmation 33、生产隔离 2。原并发/回滚/CAS 用例继续执行。

自审：检查了 Mongoose 8.14.2 的 castObject/validate 路径；显式转换异常先被捕获，
不能再进入 validate 的零路径挂起分支。转换略过 null 时仍以原路径校验，不会绕过必填检查，
空 patch 不调用 validate。首次鉴权、事务内再次鉴权和最终 CAS 均保持原样，未发现剩余可复现缺陷。
生产 server/旧 handler、共同认证、两个偶发 401 用例和依赖/锁文件未修改；未升级 Mongoose。
两个相关 JS 语法/逐文件空白、git diff --check 与文档门禁通过。

最终回归（固定 Node v22.23.3）：

- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-mutation-cast-family.json`：
  退出码 0，94/94 套件、1416/1416 用例通过，无失败/跳过，179.405 秒；
  日志 `/tmp/lms-t1-mutation-cast-family.log`。
- 与复审清单按路径/名称/重复计数比对，原 1405 个全部保留，新增 mutation 11 个；
  仅规范化既有两个动态夹具值。mutation 61/61、媒体 43/43、growthLogs 11/11 通过。
- 文档门禁通过：23 基线文档、4 自主学习文档、16 契约探针、35 价值探针、
  8 AI 文档/22 AI 契约、388 fixtures、38 项既有需求。
- STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 均保持 OPEN，根因与是否同源未确定。
  本轮通过不替代稳定性调查；未改断言、跳过用例、调整认证或依赖。
- 无生产接入、真实数据/索引操作、提交/推送/部署。P2 等待复审，不能由本轮自审替代用户关闭。

用户关闭记录（2026-10-22）：用户确认复审通过，授权关闭本次 P2。复审重新运行全量家庭回归，
94/94 套件、1416/1416 用例通过，零失败/跳过，退出码 0、172.88 秒；证据
`/tmp/lms-t1-cast-rereview-family.json`、`.log`。核对显式转换、全部字段转换失败、null、
鉴权优先、最终 CAS 与生产隔离，未发现新增可复现问题。第八批及该 P2 复审关闭；
上述“等待复审”保留为当时记录，不代表当前状态。两项偶发 401 继续 OPEN。

### 18.11 第九批：独立内部 HTTP 路由与完成协议组合验收

状态：用户复审通过，CLOSED；不注册生产路由，T1 仍 IN_PROGRESS。
范围裁定：第六批已有真实 client/provider 的内存传输组合测试，本批补实际 HTTP 序列化、
现有服务凭据中间件、公共错误处理器与 homework 恢复的组合边界，不重复实现状态机。
新增独立 router 工厂，由测试应用显式注入；生产 server、旧 router 和 Gateway 保持原样。
测试内仅监听 loopback 随机端口，使用临时副本集和合成身份/媒体，不访问真实数据。
先验证拒绝凭据和成功响应的失败测试，再实现 prepare/commit/abort/status/unbind 路由；
覆盖丢响应、租约、异 actor 同 UUID、精确解绑和隐私删除后恢复，随后全量回归及自审。
风险/回滚：接口使用现有内部路径，但工厂没有生产挂载；未来接入需另外审批并解决旧材料协议分流。
本批可撤回新增工厂/测试，无数据库迁移或真实数据回滚。材料写入统一互斥、生产依赖注入、
HTTP 私有媒体删除接入及完整前端 E2E 仍未完成，不因本批通过提前勾选 T1 整体门禁。
STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 均保持 OPEN。

实现/定向证据：

- 新增 `resource-service/routes/completionMediaReferences.js`，仅导出工厂；显式注入 credential
  和完整的五动作 operationService，缺少依赖拒绝构造。路由先凭据校验，再调用原状态机，
  返回完整 `{success:true,data:{operation,references}}`；同步/异步异常统一传公共 errorHandler。
- 首轮红灯 2/2 失败：未注册动作返回 404，homework 无法完成真实 HTTP 提交；
  `/tmp/lms-t1-http-red.json`、`.log`，退出码 1、3.361 秒。扩展后 35/35 失败，
  `/tmp/lms-t1-http-red-all.json`、`.log`，退出码 1、5.096 秒；非导入或环境失败。
- 首次实现后的定向回归 43/44 通过：一个新增测试错误要求旧 operation 整行不变。
  原设计的精确 unbind 必须递增旧 operation.version 作为与隐私删除共享的事务写屏障；
  修正测试为终态/摘要/首次审计不变、成功分支 version 恰增 1、旧绑定精确释放给当前命令。
  未修改该业务行为，未屏蔽失败；证据 `/tmp/lms-t1-http-focused.json`、`.log`。
- 最终定向 3/3 套件、48/48 用例通过，退出码 0、9.347 秒：新增 HTTP 39，
  homework 隔离 2、resource 隔离 7；`/tmp/lms-t1-http-focused-final.json`、`.log`。
- HTTP 覆盖：五动作缺失/错误服务凭据及不能由用户凭据替代；授权后参数错误；只读 status；
  ABSENT abort、历史终态重放、持久化稳定拒绝；prepare/commit/unbind 后 socket 断开及重启恢复；
  租约到期整组终止；不同 actor 同 UUID 的成功/失败历史；错误凭据/摘要冲突不能清本地意图；
  精确旧代次解绑；真实临时文件/持久删除日志、保留清理后凭证经 HTTP 恢复；旧材料字段拒绝；
  同步/异步未知错误脱敏、非 POST 拒绝、构造依赖缺失拒绝。
- production 隔离新增对 router 模块未被加载的断言；生产 server、旧 router、Gateway 均未修改。
- 此证据不包含公开 homework HTTP、新隐私 DELETE HTTP、独立进程/数据库部署或真实网络故障验收；
  故障通过测试应用在真实状态机返回后销毁响应 socket 注入，业务状态机/客户端并未 mock。

自审与最终回归（固定 Node v22.23.3）：

- 自审按动作白名单、凭据/命令校验顺序、完整响应封装、同步/异步错误传播、真实断连恢复及
  生产模块隔离逐项核查，未发现本批新增可复现缺陷。工厂不创建连接/监听、不修改业务 CAS，
  未放宽 client 对远程终态、租约、摘要、引用集合及删除凭证的校验。
- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-http-family.json`：
  退出码 0，95/95 套件、1455/1455 用例通过，零失败/跳过，184.072 秒；
  日志 `/tmp/lms-t1-http-family.log`。新增 HTTP 39/39、媒体 43/43、growthLogs 11/11。
- 与第八批最终复审按文件/用例名/重复计数比对：原 1416 个全部保留，仅新增 HTTP 39 个。
  只规范化既有两个测试标题中的动态 deletedAt/UUID 夹具值，未忽略其他差异。
- JS 语法、git diff --check 和文档门禁通过；运行中的既有 MongoDB driver 弃用警告未隐藏或处理。
- STAB-T1-MEDIA-401 与 STAB-T1-GROWTHLOGS-401 继续 OPEN，根因及是否同源未确定；
  本轮通过不替代稳定性调查。旧 socket hang up 风险与本批主动断连故障注入分开记录。
- 测试监听已关闭，临时文件由用例清理；未注册生产路由、未操作真实数据/索引，未提交/推送/部署。
  本批等待用户复审，不替代完整 T1 验收。后续先补材料编排统一互斥与旧/新协议分流的独立验证；
  生产依赖注入、公开 homework HTTP、隐私 DELETE HTTP 及端到端接入仍需单独确认。

第九批关闭记录（2026-10-22）：用户已批准本批复审。关闭前复审证据为
`/tmp/lms-t1-http-rereview-family.json`、`.log`，退出码 0，95/95 套件、1455/1455 用例、
零跳过，181.841 秒；HTTP 39、homework 隔离 2、resource 隔离 7 均通过。
媒体 43 与 growthLogs 11 本轮通过，但两个稳定性问题继续 OPEN；此关闭不授权生产接入。

### 18.12 第十批：材料编排互斥及旧新协议分流独立验证

状态：开发/测试/自审及 P2 复审完成，P2 关闭见 §18.13；本批整体门禁尚未 CLOSED；仅独立依赖注入验证，
不修改生产装配，不关闭两项偶发 401，T1 仍 IN_PROGRESS。
后续复审发现真实材料 commit 丢响应恢复 P2，本节初次自审/门禁为历史证据；修订及重新验收见 §18.13，
不得以本节初次全绿认定第十批已关闭。

范围与措施：复用材料 saga，以显式 `completionIsolation: true` 增加完成 owner/pending/
恢复态互斥以及 completionVersion/checklistVersion 的最终 CAS；默认关闭以保持生产原行为。
占位同时写入隐藏的 mediaCompletionFence，恢复不可重基版本；历史无 fence pending 仅在版本 0
经最终 CAS 接续。新字段没有默认值/索引，不执行批量回填，API 不暴露它。
材料发布、精确旧代次清理、首轮稳定拒绝回滚均受相同屏障约束；未知结果只接续自己的持久意图。
独立分流工厂先校验服务凭据，再检查完整引用集合；旧材料/头像/错题继续走旧 provider 和数组 client，
完成作品只走新 operation provider，拒绝混合协议或静默降级。复用既有路由的审计与错误封装。

风险/回滚：这是尚未启用的内部能力，不是新增公开授权入口。调用方仍须完成家庭/孩子权限校验；
生产启用时必须原子切换所有写入口的互斥与协议分流，禁止仅启用 completion 写入口。
本批只使用临时副本集/合成数据/loopback HTTP，无迁移或真实数据操作；撤回新增工厂、测试和
未启用的选项即可回退。统一互斥以本地原子 CAS 与已有远程可恢复 saga 实现，不跨服务写数据库。
验证计划：先红后绿、双向竞争、最终 CAS、回滚及未知结果恢复、协议/凭据拒绝、历史旧数据兼容、
生产隔离与全量家庭回归；完整 T1 和生产接入仍需后续单独批准。

实施与自审记录（2026-10-22）：

- 材料服务新增显式启用选项；旧默认行为及旧路由保留。所有更新/创建回滚的最终写入增加统一
  完成互斥与版本检查；远程调用前重读材料 owner。发布失败重读不再接续另一个 owner 的 unbinding，
  也不将同 ID、不同绑定代次的后来结果当作本次成功。
- 新增独立 `resource-service/routes/mediaReferenceProtocolRouter.js`，复用既有 credential、
  旧审计路由、新五动作路由与 errorHandler，未复制业务状态机。生产模块隔离断言覆盖该新工厂。
- 初始材料红灯 `/tmp/lms-t1-material-red.json`、`.log`：20 个中 15 失败/5 通过，退出码 1。
  其中一个组合用例的 completion client 夹具缺少四个方法，修正完整接口后验证真实竞争；
  其余失败覆盖读锁、最终 CAS、错误 owner 接续、版本变化后的稳定拒绝清理。
- 协议分流红灯在仅委托旧 router 的基线实现上验证，修正新 client 输入必须为 remoteOperationId、
  unbind 无 commandHash/operation 终态的测试夹具后，仍为 16 失败/7 通过，退出码 1、3.131 秒；
  `/tmp/lms-t1-dispatch-red-corrected.json`、`.log`。没有修改这些既定 client/provider 契约。
- 自审发现并修复一个恢复缺口：仅用本次读取的版本做 CAS，重启会把旧材料意图重基到新版本。
  新增 completionVersion/checklistVersion 两个负向用例，修复前 28 通过/2 失败，退出码 1、5.199 秒，
  `/tmp/lms-t1-material-recovery-red.json`、`.log`；新增持久 fence 后 30/30 通过，原材料 114/114 保留，
  `/tmp/lms-t1-material-recovery-green.json`、`.log`，退出码 0、5.126 秒。
- 扩展时租约测试曾直接改写 operation 时间、未正确同步引用时间，破坏一致性导致 503；
  改为注入时钟并跨截止点，不改数据库内部状态、不开重试，验证原租约终态逻辑。
- 最终定向：5/5 套件、190/190 用例，零失败/跳过，退出码 0、13.793 秒；
  `/tmp/lms-t1-material-dispatch-final-focused.json`、`.log`。新材料互斥 40、新分流 27、
  既有材料 114、homework 隔离 2、resource 隔离 7。

| 独立验收范围 | 证据落点 |
| --- | --- |
| 完成 owner/pending/恢复态拒绝，最终版本 CAS，本地编辑、发布、清理及回滚 | growthTaskCompletionAttachmentIsolation.test.js |
| 持久版本 fence、重启拒绝重基、旧版本 0 接续、未知非零拒绝、接续 CAS 与丢响应 | growthTaskCompletionAttachmentIsolation.test.js |
| 材料阻止真实完成/编辑/取消，恢复后继续；保留旧绑定代次与重排顺序 | growthTaskCompletionAttachmentIsolation.test.js |
| prepare/commit/unbind 丢响应，本地 claim/publish/finalize 丢响应，同 owner 接续 | growthTaskCompletionAttachmentIsolation.test.js |
| 同一真实 HTTP 分流器上的两个 client/provider/homework 编排，双向互斥、引用不串用 | growthTaskCompletionProtocolDispatch.test.js |
| 四类旧字段兼容，新完成/abort/status/精确 unbind、租约终态及历史重放 | growthTaskCompletionProtocolDispatch.test.js |
| 凭据优先、混合集合双顺序、未知字段/类型、损坏集合、禁止降级、错误脱敏 | growthTaskCompletionProtocolDispatch.test.js |
| 生产不加载新工厂、不启用完成协议，默认旧材料服务仍工作 | 两个 completionProtocol/CompletionIsolation 测试与旧材料 114 用例 |

自审复核：逐个检查全部材料写入/回滚过滤条件、持久 fence 生命周期、未知结果重读、独立分流的
鉴权顺序与响应契约。上述恢复缺口已由先红后绿用例保护，目前未发现其他可复现缺陷。
不以此结论代替用户复审、生产授权或多进程部署验收；T1 仍 IN_PROGRESS。

最终门禁证据（固定 Node v22.23.3）：

- `npm run test:family-regression -- --silent --json --outputFile=/tmp/lms-t1-material-dispatch-family.json`：
  退出码 0，97/97 套件、1522/1522 用例，零失败/跳过，193.185 秒；
  日志 `/tmp/lms-t1-material-dispatch-family.log`。新增材料互斥 40、分流 27 全部通过。
- 与第九批复审 `/tmp/lms-t1-http-rereview-family.json` 按文件/完整用例名/重复计数对比，
  原 1455 个用例全部保留，仅增加 67 个。仅规范化既有两个动态标题中的 deletedAt 与 UUID，
  未忽略其他差异或减少门禁范围。
- 媒体 43/43、growthLogs 11/11 本轮通过；STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401
  仍 OPEN，根因/是否同源未确定。既有 socket hang up 风险保留，不与主动故障注入混淆。
- JS 语法、`git diff --check`、`node scripts/check-family-docs.js` 均通过；已有 driver 弃用警告保留。
- 生产 homework/resource server、旧内部 router、Gateway 无差异；它们不引用新工厂/启用选项。
  本批 HTTP listener 与临时 Mongo/测试数据均已由测试生命周期清理，没有真实数据操作或迁移。
- 本批未提交、推送、合并或部署。第九批已 CLOSED；第十批等待用户复审，T1 总门禁未提前关闭。
  公开 homework/隐私删除 HTTP、生产依赖注入、全写入口切换及前端端到端接入仍需后续单独确认。

### 18.13 第十批复审 P2：材料 prepared/bound 重放恢复

状态：本次 P2 经用户复审通过并批准关闭，CLOSED；全量门禁仍非全绿，T1 不关闭。
用户已批准修复，不授权生产路由接入或真实数据操作。

问题及评审依据：旧材料 provider 在同一 operation 已 bound 时，prepare 原样返回 bound；创建和
修改编排仅接受 prepared，导致远程 commit 成功后丢响应的任务一直停留 binding/pending。
旧 pending 即使成功补入版本 0 fence，也无法继续。此为共享旧编排的遗留缺陷，不是分流器引入。
先前 mockRejectedValueOnce 仅模拟抛错，未持久化远程成功状态，不能证明提交后丢响应恢复闭环。
复审原门禁仍为 97/97 套件、1522/1522 用例通过，210.187 秒，
`/tmp/lms-t1-material-rereview-family.json`、`.log`；独立真实 HTTP 探针三类场景均复现，
`/tmp/lms-t1-material-rereview-probe.log`。以上证据保留，不以重跑通过覆盖问题。

修订范围/风险/回滚：仅修改材料服务共用响应校验与两处 prepare 调用，允许 prepared/bound；
原完整集合校验、原 operation、后续严格 bound commit、精确 unbind 和最终 CAS 均保留。
不改 client/provider 契约，不创建新 operation/放宽 released，不增加自动重试或迁移。
该共享服务的默认旧路径也获得正确的重放处理，但 completionIsolation 默认关闭、生产装配不变。
测试只使用临时副本集/合成媒体/loopback HTTP，未操作真实数据；撤回本补丁不会改变数据格式，
但会恢复原丢响应卡住缺陷，不应以清锁/更换 operation 作为回退措施。

验收要求：创建、修改、旧 pending 接续三类均在真实 provider 提交成功后销毁 response socket，
确认远程 bound、本地 binding；重建编排实例恢复，确认 bound prepare 继续原 operation 的 commit，
保留已有绑定代次，精确释放旧引用，清除材料意图及 fence，稳定重放不再调用远程。
另测错误集合/非法状态不发布、不清锁，以及恢复后的最终 owner/阶段/完成和清单版本 CAS。

修订/定向证据（2026-10-22）：

- 三类真实故障测试先红：`/tmp/lms-t1-material-replay-red-corrected.json`、`.log`，退出码 1，
  新增 3 失败、原分流 27 通过，4.256 秒。服务端在真实 commit 返回成功后销毁 socket，
  不是在调用前模拟失败；本地已持久意图和远程 bound 均先断言，再重建 service 实例恢复。
  初轮测试夹具未防御既有 null 引用负向输入，额外造成一个 500；修正测试 middleware 后得到上述纯业务红灯，
  原始结果 `/tmp/lms-t1-material-replay-red.json`、`.log` 保留。
- 最小实现仅增加共用校验器允许状态集合、两处 prepare 的 prepared/bound 允许值；
  commit/unbind 调用仍分别传单一 bound/released，完整引用集合校验及所有最终 CAS 未修改。
- 首次扩大回归有一条既有测试把 prepare 的 bound 当成非法状态，结果 172 通过/1 失败，
  `/tmp/lms-t1-material-replay-green.json`、`.log`。按修正后的旧 provider 契约，把该负向夹具
  改为仍非法的 released，未删除用例或放松 pending/不发布断言；另加两个 prepared/bound 混合
  且乱序的完整集合正向用例，要求仍执行 commit，不将该历史错误断言当作产品限制。
- 最终定向：5/5 套件、224/224 用例、零失败/跳过，退出码 0、16.325 秒；
  `/tmp/lms-t1-material-replay-focused.json`、`.log`。HTTP 分流/恢复 61、旧材料 114、
  材料互斥 40、homework 隔离 2、resource 隔离 7。
- 新增 34 用例：三类真实提交后丢响应恢复 3；创建/修改各 9 类错误引用集合或非法状态 18；
  创建/修改各 5 类最终 CAS 竞争 10；默认旧装配恢复 1；完整乱序 prepared/bound 集合 2。
  错误响应验证保持同一本地意图，合法重放后继续恢复；成功重放保持原 operation 和保留绑定代次，
  旧引用按原代次释放，稳定后重复 resume 不再调用远程，也不创建 completion operation。

自审：逐项检查两条 prepare 路径均必须经过严格 bound commit、状态允许值未外溢至 commit/unbind，
完整引用集合仍要求数量相等且每个媒体/字段恰好匹配一次，缺失/额外/重复/错误字段/稀疏响应拒绝。
最终 owner、阶段、completionVersion、checklistVersion 竞争均保留 pending，不发布旧意图。
原先失败的三类真实场景已恢复通过，未发现本次修订新增可复现逻辑缺陷；以下全量失败仍须保留，
不能据定向通过宣称整体无问题或关闭第十批/T1。

全量执行与稳定性复核（2026-10-22）：

- 执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-material-replay-family.json`，
  Node v22.23.3；退出码 1，190.791 秒，96/97 套件、1555/1556 用例通过，1 失败、零跳过；
  原始 JSON 及 `/tmp/lms-t1-material-replay-family.log` 保留。原 1522 用例清单全部保留，新增 34，
  对比时仅规范化既有动态测试标题中的 UUID/时间。上述一个既有负向夹具的修正单独披露，不算新增。
- 唯一失败为 `growthTasks.test.js` 的 `soft-cancels pending tasks and archives completed tasks`，
  错误为 `socket hang up`，栈位于 Node HTTP client。与 §18.2 已记录的 socket 风险症状一致，
  但失败用例不同，尚不能断言同一根因，更不能判定已修复。
- 不改代码、不增加自动重试，单独诊断该完整套件：
  `npm run test:family-regression -- --runTestsByPath backend/services/homework-service/__tests__/growthTasks.test.js --json --outputFile=/tmp/lms-t1-material-replay-socket-diagnostic.json`，
  退出码 0，28/28 通过，6.599 秒；对应 `.json`、`.log` 保留。此结果仅表明未稳定复现，
  不替代上一次全量失败，也不把门禁改记为通过。
- 失败用例使用 `server.js` 默认 app，默认路由 `attachmentMediaService = null`，不执行本次修改的
  材料重放校验；本次销毁响应 socket 的故障注入只存在于独立分流测试 app。
  以上缩小了直接调用路径范围，但不足以证明稳定性失败原因，socket 风险继续待核查。
- 本轮 familyMedia 43/43、growthLogs 11/11 通过；`STAB-T1-MEDIA-401`、
  `STAB-T1-GROWTHLOGS-401` 仍 OPEN，不以本次通过关闭。生产路由与依赖装配未修改，
  `completionIsolation` 默认仍关闭；未提交、推送、部署或操作真实数据。

关闭依据：用户于 2026-10-22 明确批准本次复审。复审定向 5/5 套件、224/224 用例，
退出码 0，17.54 秒，`/tmp/lms-t1-material-p2-rereview-focused.json`；文档门禁和 diff 检查通过。
关闭仅针对 prepared/bound 重放 P2；前次全量 socket hang up 失败及两项偶发 401 保持 OPEN。

### 18.14 第十一批：独立完成/确认 HTTP 适配

状态：用户复审通过并批准关闭，CLOSED；T1 IN_PROGRESS，不接入生产，不关闭全量门禁。

范围：独立 router 工厂适配既有 PATCH complete/confirm，由真实 authenticateGateway 验证身份，
已有服务执行实时家庭授权、事务和恢复，异常交给公共 errorHandler。不创建公开 recover 端点，
恢复仍重提相同 PATCH；不提供新 GET/列表、材料写入或隐私 DELETE，不替代全写入口切换验收。
仅测试 app 显式挂载；生产 server、Gateway 和旧路由不改。

风险与保护：身份不得由 body 提供，禁止泄漏远程映射/恢复意图；过期身份、越权、旧版本和未知结果
须保持原稳定错误码。真实 HTTP/临时副本集测试验证成功响应丢失与原请求恢复；星星调用用合成幂等
适配器验证接续，不宣称 progress-service 真实 HTTP 发星验收完成。
回滚：移除未挂载的工厂与测试即可，不涉及数据库迁移/真实数据。全量门禁与三项稳定性问题继续保留。

实现与验证记录（2026-10-22）：

- 新增 `routes/growthTaskCompletion.js` 工厂，固定两个 PATCH 入口，必须显式提供 complete/confirm 服务；
  没有默认实例、监听或生产依赖创建。服务错误保持原对象交给 next，不折叠稳定错误码。
- 新增 `growthTaskCompletionPublicHttp.test.js`，两个真实 loopback HTTP server、Axios、真实身份信封、
  真实公共错误处理器、本地/远程事务服务与临时副本集。仅星星适配器为合成幂等账本，异常边界用 spy。
- 先红：首轮工厂缺失导致 27 失败，`/tmp/lms-t1-public-http-red.json`，退出码 1、3.207 秒；
  补空 router 后 27 用例因路由 404/缺依赖断言失败，`/tmp/lms-t1-public-http-red-routes.json`，
  退出码 1、4.1 秒。以第二轮作为实际行为红灯证据，不把导入失败当成恢复场景验证。
- 接线后 26 通过/1 失败，`/tmp/lms-t1-public-http-green.json`，退出码 1、6.166 秒。
  唯一失败是测试将 HTTP 日期字符串与数据库 Date 直接比较；对数据库投影作 JSON 序列化后逐字段比较，
  未改服务响应、不放松固定成功投影断言。随后增加 12 个 HTTP 边界用例。
- 定向 3/3 套件、48/48 用例，退出码 0、11.658 秒，`/tmp/lms-t1-public-http-focused.json`：
  新增公开 HTTP 39、homework 生产隔离 2、resource 生产隔离 7。生产模块缓存排除断言新增本批 router。

覆盖范围：

| 边界 | 证据 |
| --- | --- |
| 身份与家庭 | 未签名/篡改/过期/错误目标/nonce 重放/旧孩子 token；外家庭、兄弟姐妹、离家家长拒绝；无任务与无权限统一 403；授权先于业务校验 |
| 请求与错误契约 | 缺版本、非法类型、远程标识/actor 注入、11 张/重复媒体/未知清单、媒体 purpose/孩子/删除状态拒绝；同步/异步未知错误脱敏 |
| 完成与确认 | 0/1/10 张，确认所见版本，旧版本不发星；孩子不能确认，历史无媒体版本 0 可确认；confirmed 拒绝新完成命令 |
| 丢响应 | complete/confirm 成功 JSON 发送前销毁 socket，本地已终结后原请求重放不再写入/发星；内部 prepare/commit 已提交后断开，公开返回 503，重放原 PATCH 复用持久映射 |
| 幂等与审计 | 同 operation 异正文 409，不同 actor 同 UUID 获独立 remoteOperationId；确认后完成重放保持旧固定投影；离家后重放拒绝；共管家长恢复发星不改首次确认审计 |

不覆盖：Gateway JWT 登录/转发的完整部署链路、实际 progress-service HTTP、隐私 DELETE、详情/列表、
全写入口统一切换、前端与真机。不能把本批测试 app 当作可发布生产 app。

最终验证及自审：

- `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-public-http-family.json`，
  Node v22.23.3；退出码 0，98/98 套件、1595/1595 用例、零失败/跳过，228.947 秒；
  对应 `.json`、`/tmp/lms-t1-public-http-family.log` 保留。与前轮清单对比原 1556 用例全部保留，
  仅新增本批 39（只规范化既有测试标题中动态 deletedAt/operationId）。
- 自审及一次独立只读代码检查均未发现本批新增可确认逻辑缺陷。独立检查覆盖工厂、测试、认证及服务
  调用链，另做语法/纯内存签名验证，没有代替主执行者跑 Jest，也未授权任何生产接入。
- 接受检查中的测试加固建议：远程恢复后直接断言本地 SUCCEEDED、远端 COMMITTED、完整绑定代次
  和锁清除；共管恢复后重读数据库核对首次确认人/时间/反馈；合成星星适配器对重复命令返回
  awarded=false，补身份信封 method 错配断言。未改业务实现或删除用例。
- 上述断言补强后再执行三个定向套件：退出码 0，48/48 通过，12.159 秒；
  `/tmp/lms-t1-public-http-final-focused.json`、`.log`。全量证据对应补强前相同业务实现及 39 用例，
  补强后的测试以本次定向结果为准，不声称全量在最后一次断言编辑后重新执行。
- `node --check` 工厂/新增测试通过；文档门禁与 `git diff --check` 通过。
  生产 server/旧 growthTasks router/Gateway 无本批修改，生产隔离 9 用例通过。
- 本轮 growthTasks、familyMedia、growthLogs 均通过，不覆盖 §18.13 保存的 socket hang up 全量失败。
  socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 继续 OPEN，根因未证明或修复；
  运行全绿不等于稳定性问题、全量门禁、第十批整体门禁或 T1 已关闭。
- HTTP server 与临时副本集均由测试生命周期清理；未提交/推送/部署或操作真实数据。
  本批等待用户复审；后续补独立详情/列表读取与隐私删除 HTTP、真实发星链路以及完整组合验收，
  生产依赖注入/全写入口切换仍需单独确认。

第十一批关闭依据（2026-10-22）：用户批准复审并关闭该批。复审实际执行公开 HTTP 39、确认 33、
内部 HTTP 39、生产隔离 9，共 5/5 套件、120/120 用例，退出码 0，25.978 秒；
`/tmp/lms-t1-public-http-rereview.json`、`.log`，文档门禁及 diff 检查通过。
复审未发现本批新增可确认缺陷；关闭不覆盖全量稳定性风险、T1 整体门禁或生产接入。

### 18.15 第十二批：独立完成作品隐私删除 HTTP

状态：CLOSED，用户复审通过；生产未接入，T1 IN_PROGRESS。

分批裁定：从尚未完成的 TC-SL-PRIVACY HTTP 边界开始，优先验证真实删除请求与远端恢复，
暂不扩展详情/列表或全部 CRUD。新增独立 DELETE router 工厂，固定 authenticateGateway，
调用第三批隐私事务服务；204 必须晚于事务及 journal.persist 成功，不提供同步物理删除承诺。
验证授权、整组终止、精确凭证、丢响应及日志失败重试、确认/归档后删除和禁读。
保留原内部协议/完成编排，测试 app 独立组合，不修改生产 server/Gateway/旧 media router。

风险/回滚：仅临时 Mongo 副本集、合成媒体和临时目录；不得操作真实儿童资料或启用公网服务。
撤回未挂载工厂及测试不影响持久格式，无迁移。真实受保护日志介质/备份恢复、前端缓存清除和
生产切换另行验收；socket hang up 与两项 401 继续 OPEN，全量门禁不因本批通过关闭。

实现/定向记录（2026-10-22）：

- 新增独立 `routes/completionMediaPrivacy.js`，显式依赖 privacyService，固定认证、拒绝非空 JSON
  正文，不从正文接收身份/凭证；await deleteMedia 完成才发送空 204，错误交给公共 errorHandler。
  工厂无默认实例、连接或监听。测试 app 将其放在旧读取 router 前，非 task_completion 直接拒绝，
  不回退旧删除；不把该测试装配当作生产多 purpose 分流方案。
- 新增 `growthTaskCompletionPrivacyHttp.test.js`，真实双 HTTP server/Axios/签名身份、临时副本集、
  真实隐私/operation/完成编排和 fs journal。只使用合成文件，星星侧为合成适配器。
- 首轮 23 失败为测试夹具未注入既有 reader 必需的 MediaReferenceModel，退出码 1、5.438 秒，
  `/tmp/lms-t1-privacy-http-red.json`、`.log`；修正夹具后空工厂运行 13 失败/10 通过，
  退出码 1、5.781 秒，`/tmp/lms-t1-privacy-http-red-routes.json`、`.log`。
  第二轮才是行为红灯：旧路径不生成新删除凭证/持久日志、不具备整组删除恢复，既有鉴权等仍通过。
- 工厂实现后 2/2 套件、30/30 用例通过，退出码 0、7.55 秒，
  `/tmp/lms-t1-privacy-http-green.json`、`.log`。随后增加真实事务回滚/提交丢确认 2 个场景和
  DELETE 与内部 prepare/commit 并发 HTTP 2 个场景，不改变业务服务实现。
- 定向 4/4 套件、65/65 用例通过，退出码 0、14.518 秒，
  `/tmp/lms-t1-privacy-http-focused.json`、`.log`；新增 HTTP 27、原隐私事务 29、生产隔离 9。

| 范围 | 验收断言 |
| --- | --- |
| 授权 | 未签名/篡改/过期/旧孩子 token 拒绝；外家庭/兄弟姐妹/离家家长在删除前与重放时均拒绝；家长/孩子本人/共管均可删 |
| 响应 | 204 无正文且 journal 文件已存在；非法 ID/无资源/错误 purpose/非空 JSON 拒绝；未知异常 500 脱敏；无旧删除回退 |
| 整组与凭证 | PREPARED 整组 ABORTED 且只删目标资产；COMMITTED 保留终态，精确释放目标绑定、不影响另一张；DELETE 与 prepare/commit 真实 HTTP 竞争无活跃已删引用 |
| 不确定结果 | 公共 204 前断开 socket；DB 事务回滚/提交确认丢失；journal 失败后返回 503，重试保持首次 actor/时间/凭证及日志内容 |
| 禁读与保留 | 原访问签名删除前可读、删除后 404；申请新签名也拒绝，保留期内正文仍在；满保留期清理后 DELETE 仍可凭 tombstone 重放 |
| 完成组合 | 内部 prepare 丢响应后 DELETE，原完成命令稳定失败清锁；commit 丢响应后 DELETE，原映射经精确凭证恢复发布，版本加一次、原 mediaId 顺序不变 |
| 教学状态 | confirmed/archived 后可删，不修改任务版本、确认审计或重复发星；本批不验收真实星星 HTTP |

最终验证及自审：

- Node v22.23.3 执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-privacy-http-family.json`，
  退出码 0，99/99 套件、1622/1622 用例，零失败/跳过，213.582 秒；
  `/tmp/lms-t1-privacy-http-family.json`、`.log` 保留。与第十一批全量清单比较，原 1595 用例全部保留，
  仅新增本批 27；仅规范化既有两个测试标题的动态 deletedAt/operationId，不忽略其他清单差异。
- 自审与独立只读审查均未发现本批新增可确认缺陷。核对固定认证、家庭隔离、错误透传、204 与日志
  落盘先后、事务回滚/提交未知、公开及远程丢响应恢复、首次删除审计、精确凭证和保留清理后重放。
  独立审查未另跑 Jest，只做静态链路及语法检查，不作为第二次全量回归证据。
- 证据边界：并发 HTTP 测试没有强制事务交错屏障，不声称穷尽所有竞争顺序；提交丢确认采用真实事务
  提交后抛错，不能替代实际 Mongo 网络故障/进程崩溃演练。星星仍为合成适配器；真实受保护日志介质、
  备份恢复与前端清缓存仍待验收。独立工厂仅接受 task_completion，不可直接替换生产多 purpose 路由。
- 工厂/测试语法、文档门禁、`git diff --check` 通过；生产隔离 9 用例通过，生产 server、Gateway、
  旧 media router 未修改或挂载新协议。HTTP server、副本集及合成文件由测试生命周期清理。
- 本轮全量全绿不覆盖历史失败或证明稳定性根因已修复：socket hang up、STAB-T1-MEDIA-401、
  STAB-T1-GROWTHLOGS-401 继续 OPEN；全量门禁及 T1 不关闭。本批等待用户复审，生产接入需单独确认。
  未提交/推送/部署，未操作真实数据。

第十二批关闭依据（2026-10-22）：用户批准复审并关闭该批。复审实际执行独立隐私 HTTP 27、隐私事务 29、
operation 92、completion client 99、本地完成恢复 65、生产隔离 9，共 7/7 套件、321/321 用例，
退出码 0、27.344 秒；`/tmp/lms-t1-privacy-http-rereview.json`、`.log`，文档门禁及 diff 检查通过。
未发现本批新增可确认缺陷；不关闭三项稳定性问题、全量门禁或 T1，不授权生产接入。

### 18.16 第十三批：独立任务详情/列表读取

状态：CLOSED，用户复审通过；生产未接入，T1 IN_PROGRESS。

分批裁定：补齐 T1 详情/列表的只读 HTTP 边界，独立 read service/router，不修改旧生产 GET 的材料恢复行为。
详情和列表共用显式公开投影，返回当前已发布完成证据/版本，历史缺字段投影为 0/空集合，不回填。
PREPUBLISH 返回上一份稳定证据，PUBLISHED_CLEANUP 返回已发布证据及 pending_recovery；GET 不调用
媒体服务、不清锁、不恢复。通过事务快照内实时家庭授权及 familyId/childId 查询限定数据归属。
列表沿用分页、status/dimension、today/week 家庭时区；孩子默认本人，显式其他 childId 拒绝；
未知/结构化查询参数拒绝，避免误解为支持客户端投影或 scope 注入。

风险/回滚：测试仅使用合成数据和临时副本集；新服务不接受媒体恢复依赖，不跨服务读取数据库。
撤回未挂载工厂不涉及 schema/数据迁移。生产路由、真实发星及前端继续分批验收；三项稳定性问题保持 OPEN。

实现与定向记录（2026-10-22）：

- 新增 `growthTaskCompletionReadService.js` / `growthTaskCompletionRead.js`，固定 authenticateGateway；
  显式 transactionRunner，不创建连接/监听，没有媒体或发星 client。服务内仍检查 actor 存在及孩子 tokenVersion。
  详情合法但不存在/无权统一 403；列表实时授权后同时按 familyId/childId 查询，count 与 items 同快照顺序执行。
- 公开投影与原 taskView 业务字段保持兼容，仅独立读取工厂增加完成/清单字段。嵌套 evidence、清单及 actor
  也使用白名单；null/0/false 原样保留。旧生产 taskView/GET 未改动，未启用生产材料读取行为变更。
- 新增 `growthTaskCompletionReadHttp.test.js`。Supertest 实际 HTTP + 真实签名认证/公共错误处理器、临时
  副本集；完成事务使用真实本地服务，远程媒体为可控合成适配器，不宣称本批重新验证远程 HTTP。
- 先用空工厂执行 35 个用例：35 失败，退出码 1、4.87 秒，`/tmp/lms-t1-read-http-red.json`、`.log`；
  主要因 GET 404 和缺依赖约束失败，不是导入/环境故障。实现后连同 homework 生产隔离 2 用例，
  2/2 套件、37/37 通过，退出码 0、7.877 秒，`/tmp/lms-t1-read-http-green.json`、`.log`。
- 自审补强后新增套件共 38 用例：将重复的 raw pending 夹具压为一例嵌套字段防泄漏测试；另用真实本地
  complete 两次、解绑失败产生 PUBLISHED_CLEANUP，验证新证据/版本与 owner 保留；补服务层旧 token、
  无事务/数据库故障和 null/0/false 断言。定向 4/4 套件、112/112 通过，退出码 0、16.399 秒，
  `/tmp/lms-t1-read-http-focused.json`、`.log`（读取 HTTP 38、本地完成 65、生产隔离 9）。

| 范围 | 验收断言 |
| --- | --- |
| 身份与归属 | 未签名/篡改/过期/nonce 重放/旧 token 拒绝；外家庭、兄弟姐妹、离家/已删除家长、被移出家庭的孩子拒绝；共管可读 |
| 查询契约 | 孩子默认本人、显式其他孩子拒绝；未知/重复/结构化参数及非法页码拒绝；familyId/childId 同时限定；鉴权先于其他筛选校验 |
| 列表一致性 | 默认分页、最大页大小、安全整数与稳定 _id 次序；空页与 total；UTC/家庭跨日时 today/week 边界 |
| 投影与兼容 | 详情/列表同投影；旧版本 0、不回填；嵌套未知字段/隐藏材料与完成意图/绑定代次不暴露；null/0/false 保留 |
| 只读与恢复 | 真实发布 A/B 后 GET 读 B、重放 A 仍返回旧固定投影；真实 PREPUBLISH/PUBLISHED_CLEANUP 下 GET 不调用媒体、不清锁、不写任务或命令 |
| 隐私边界 | confirmed/archived 仍返回已发布 ID 和首次确认审计，不声称图片可读、不返回签名；读取异常不返回部分成功 |

自审与独立检查：

- 本批自审和一次独立只读静态审查均未发现新增可确认缺陷。独立审查未另跑测试，不作为重复运行证据。
  核对真实身份、授权模型、显式嵌套投影、版本兼容、无恢复依赖、同 session 顺序读取和生产模块隔离。
- 快照一致性依据既有 runMongoTransaction 的 snapshot 配置和所有查询绑定同 session 核对；本批未以
  并发修改家庭权限/任务数据的专门交错测试证明这一点。不得将当前证据表述为所有并发调度均已验收。
- 测试中媒体 client 为合成适配器，真实资源 HTTP 已有独立批次，本批不冒充其端到端验收；
  confirmed/archived 的 ID 投影测试也不替代删除禁读测试。GET 不验证媒体存在性，不能据此展示缓存内容。
- 新模块与测试语法、文档门禁、git diff --check 通过；生产 server、Gateway、旧 growthTasks/media router
  无本批修改。没有 schema/索引迁移、提交/推送、部署或真实数据操作。

最终全量证据：Node v22.23.3 执行
`npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-read-http-family.json`，
退出码 0，100/100 套件、1660/1660 用例，零失败/跳过，208.915 秒；对应 `.json`、`.log` 保留。
与第十二批全量清单对比，原 1622 用例全部保留，只新增本批 38；只规范化既有两个标题中动态
deletedAt/operationId，不忽略其他差异。该全量运行包含本批最终代码和全部断言。

本批待用户复审，非 CLOSED；本次全绿不证明历史稳定性根因已修复，socket hang up、
STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 继续 OPEN。全量门禁和 T1 不关闭，生产接入仍需单独确认。

第十三批关闭依据（2026-10-22）：用户批准复审并继续下一批。复审 6/6 套件、178/178 用例，
退出码 0、24.315 秒，`/tmp/lms-t1-read-http-rereview.json`、`.log`；文档门禁及 diff 检查通过。
未发现新增可确认缺陷；上述“待用户复审”为实施时状态，本条更新为 CLOSED，不关闭全量门禁或 T1。

### 18.17 第十四批：版本确认与真实发星 HTTP 组合验收

状态：用户复审通过，第十四批评审 CLOSED；全量有 socket hang up 失败，生产未接入，T1 IN_PROGRESS。

分批裁定：按 T1“确认成功后复用现有星星幂等命令”补齐真实 progress HTTP，不新增奖励服务或生产路由。
测试 app 组合独立完成/确认 router、真实 starAwardClient、既有 internalStars router 与真实 StarLedgerEntry。
补齐版本拒绝、账本幂等、公开/远程提交后丢响应、本地事务未知、共管接续及首次审计验证。
本批首先补已有实现的组合测试，不为制造红灯而删除/弱化既有实现；发现实际缺陷才按失败用例修复。

风险/回滚：仅 loopback 测试服务器、合成身份/凭据与临时副本集，禁止真实星星账本或家庭数据写入。
测试退出关闭服务器和副本集；撤回测试无需 schema/数据迁移。生产装配与新协议隔离不变，
三项稳定性问题保持 OPEN，全量门禁/T1 不提前关闭。

实施与定向记录（2026-10-22）：

- 新增 `growthTaskCompletionStarHttp.test.js`，双 loopback HTTP/Axios、真实身份认证、真实本地完成/
  确认事务、既有 starAwardClient、progress internalStars/service credential 与真实 StarLedgerEntry。
  只注入响应/事务失败点；发星响应、账本和余额不 mock。完成无图片路径使用不会被调用的媒体依赖。
- 第一次运行因测试 helper 缺少闭合括号未执行用例，退出码 1、0 用例、0.763 秒，
  `/tmp/lms-t1-star-http-initial.json`、`.log`；修复仅测试语法，不计业务红灯。
  修正并补自动重试/凭据范围断言后 24/24 用例通过，退出码 0、5.318 秒，
  `/tmp/lms-t1-star-http-green.json`、`.log`。本批为已有业务链路补组合证据，没有改写业务实现。
- 自审补“远端发星后成员被移出，最终本地授权拒绝，再由当前家长恢复”用例；全部完成前置操作均
  断言成功，避免负向用例因前置失败而误绿。并发请求仅接受 200 或稳定 STAR_AWARD_PENDING 503，
  随后重试必须成功，数据库中账本条数/金额/归属/来源及首次确认审计均有断言。
- 最终新增 25 用例，定向包含确认服务 33、starAwardClient 9、两侧生产隔离 9，合计 5/5 套件、
  76/76 用例，退出码 0、13.94 秒，`/tmp/lms-t1-star-http-focused.json`、`.log`。

| 范围 | 断言 |
| --- | --- |
| 版本与授权 | 正常版本/历史 0 确认；旧版本、孩子、外家庭、离家家长、活动 owner、未签名请求在发星前拒绝 |
| 内部凭据 | 缺失/错误服务凭据、错误家庭/孩子/家长 scope 均不写账本；公开只返回稳定脱敏错误 |
| 真实幂等 | 同任务首次一颗星，重放不增账本；公开响应丢失时本地已 awarded 不再次远程调用；自动重试复用原任务 |
| 远端未知 | 账本成功后断 socket 或损坏成功字段，公开返回 pending；重试返回相同 ledgerEntryId、awarded=false，无重复星星 |
| 本地未知 | confirm/award 两阶段分别真实事务内回滚与提交后抛错；确认未知不提前发星，终结未知重新读状态 |
| 共管与审计 | 首次确认人离家后当前家长可恢复；远端后权限撤销阻断最终本地写，当前家长接续；首次人/时间/反馈不改 |
| 并发 | 两家长同版本并发后收敛到唯一真实账本与首次确认审计，不把瞬时 503 当成功 |

边界：HTTP app 和业务事务使用同一测试进程/临时 Mongo 连接，不是独立数据库部署验证。
重建 client/confirmer 验证不依赖实例内状态，不代表真实进程崩溃演练；事务提交后抛错不等于 Mongo
网络故障。并发测试未强制穷尽交错。未加入图片到星星的 resource/homework/progress 三服务完整链路，
生产确认/读取/材料路由仍未切换，真实用户/生产账本未操作。

自审与独立只读检查均未发现本批新增可确认缺陷；独立检查仅静态核对，没有另跑测试。
唯一账本与首次确认审计的断言、真实客户端/路由调用、提交后故障注入及最终成员授权均已核对。
并发请求没有屏障保证同时进入账本首次插入窗口，不声称确定性穷尽唯一键竞争分支。
本批仅增加测试和文档，既有 starAwardClient、确认服务、奖励业务代码及生产装配均未修改。

最终验证与失败保留：

- Node v22.23.3 执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-star-http-family.json`，
  退出码 1，100/101 套件、1684/1685 用例通过，1 失败、零跳过，195.853 秒；`.json`、`.log` 原始证据保留。
  新增发星套件 25/25 通过。清单比较原 1660 用例全部保留，仅新增 25；仅规范化既有标题的动态
  deletedAt/operationId，不忽略其他差异。
- 唯一失败：progress-service `knowledgePoints.test.js` 的
  `TC-T5-POINT-008 parent updates mastery, counts and review timestamp`，错误为 `socket hang up`，
  栈起点 `Socket.socketOnEnd (node:_http_client:599:25)`。本批没有修改该测试、知识点路由或 progress setup；
  上一批全量该套件 9/9 通过。不能据此断言与历史 socket hang up 同根因或已证明与本批完全无关。
- 全量结束后单独诊断：`npm run test:family-regression -- --runTestsByPath backend/services/progress-service/__tests__/knowledgePoints.test.js --json --outputFile=/tmp/lms-t1-star-http-knowledge-diagnostic.json`，
  退出码 0，9/9 通过，4.636 秒；`.json`、`.log` 保留。没有改代码或增加重试来掩盖失败，
  独立通过不覆盖全量失败，不关闭稳定性问题；该知识点用例作为 socket hang up 新出现位置继续跟踪。
- 新测试语法、文档门禁与 git diff --check 通过；没有生产路由接入、提交/推送/部署或真实数据操作。
  该轮运行后等待用户复审，socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 保持 OPEN；
  全量门禁本轮非全绿，T1 不关闭。

用户复审关闭记录（2026-10-22）：

- 用户批准第十四批复审。复审重新执行确认、真实发星、公开 HTTP、内部发星及两侧生产隔离：
  7/7 套件、121/121 用例，零跳过，退出码 0，25.167 秒；
  `/tmp/lms-t1-star-http-rereview.json`、`.log`。文档门禁及 git diff --check 通过。
- 未发现新增可确认缺陷；事务故障注入与共享测试数据库、非确定性并发交错的证据边界不变。
  本次仅关闭第十四批评审，不覆盖原全量失败、不关闭三项稳定性问题或 T1 总门禁。

### 18.18 第十五批：完成图片、只读版本与真实发星三服务 HTTP 组合

状态：用户复审通过，第十五批及测试保护 P2 CLOSED；生产未接入，T1 IN_PROGRESS。

分批裁定：接续第十四批保留的带图片链路缺口，组合已有 resource operation HTTP、homework
完成/只读/确认 HTTP 与 progress 发星 HTTP。不新增业务协议，不启动生产装配或替换旧路由。
先补真实组合测试；已有正确实现不为制造红灯而删除，若发现业务缺陷再以失败用例驱动修复。

范围：0/1/10 张图片完成到确认发星、持久远程映射/精确绑定代次、媒体提交与清理丢响应、
只读不恢复/不泄露内部字段、版本拒绝、真实账本幂等、公开丢响应及共管审计接续。
风险/回滚：仅合成身份、临时副本集和 loopback 服务器；不读取或写入真实家庭数据。
撤回新增测试即可回滚，无迁移或生产开关；图片字节上传/签名读取/删除、独立进程部署仍不在本批。
三项稳定性问题及全量门禁保持 OPEN，独立服务组合通过不等于生产可发布。

实施与定向验证（2026-10-22）：

- 新增 `growthTaskCompletionThreeServiceHttp.test.js`，三个真实 loopback HTTP 应用、实际客户端、
  网关身份认证及服务凭据、真实完成事务/引用 operation/StarLedgerEntry，不模拟媒体或发星业务结果。
  测试按现有 setup 创建临时副本集，初始化真实唯一索引；每例清库并关闭三个 HTTP server。
- 首轮 16/16 用例通过，退出码 0，7.897 秒，`/tmp/lms-t1-three-http-initial.json`、`.log`。
  自审补纯重排、全部图片移除、不同 actor 同公开 UUID 三个场景，以及成功确认的版本/图片/审计断言。
- 补强后首次定向 5/6 套件、129/130 用例，退出码 1，26.304 秒，
  `/tmp/lms-t1-three-http-focused.json`、`.log`。唯一失败为测试误把纯删除调用序列写成 unbind；
  实际正确协议是 references status 对账后精确 unbind。核对 media service 后修正预期并断言旧代次，
  不修改业务实现，不把此失败记为业务缺陷红灯。
- 最终定向命令：`npm run test:family-regression -- --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionThreeServiceHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionStarHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionPublicHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionReadHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionIsolation.test.js backend/services/resource-service/__tests__/completionProtocolIsolation.test.js --json --outputFile=/tmp/lms-t1-three-http-focused-green.json`。
  6/6 套件、130/130 用例，零跳过，退出码 0，28.189 秒；对应 `.json`、`.log` 保留。

| 范围 | 组合断言 |
| --- | --- |
| 正常链路 | 0/1/10 张图片按序完成、详情投影当前版本、共管确认后唯一真实账本及余额；完成/确认重放无重复绑定/发星 |
| 媒体未知 | prepare/commit 提交后断响应保留 PREPUBLISH；GET 无恢复副作用，确认不触发发星；重建 client/service 后原 PATCH 复用映射收敛 |
| 清理未知 | unbind 已释放旧代次后丢响应，GET 展示新版本/pending_recovery，但确认继续阻断；恢复不再次发布或改 completedAt |
| 集合与代次 | 替换中保留项沿用旧代次，新增项使用新映射；重排零媒体 HTTP；纯删除 references 对账/精确解绑且不新增空远端 operation |
| 映射与历史 | 不同 actor 同公开 UUID 对应两个持久映射；确认最新版本后重放旧成功投影仍不可改写任务/重复发星 |
| 拒绝路径 | 错 purpose、跨孩子、已删除媒体落 ABORTED/FAILED 且不能确认发星；外家庭/同家庭其他孩子/离家家长拒绝进入链路或读取图片 ID |
| 公开未知与共管 | 完成/确认公开响应丢失后无新增绑定/星星；远端账本丢响应后当前家长可接续，原确认人/时间/反馈及图片引用不变 |

本批自审核对：故障注入位于实际 provider 计算成功响应之后；完成前置动作均断言成功；
负向断言同时检查账本/远程调用及本地状态，不只依赖 HTTP 错误码。重建 client/service 仅证明
无实例内恢复状态依赖，不代表真实进程崩溃；本批未修改业务服务、schema、生产 server 或旧路由。
独立只读检查与自审修订：

- 独立检查确认真实 HTTP/provider/提交后故障注入有效，但发现测试保护 P2：混合换图清理用例
  未检查 resource 端保留项 b 及新增项 c，若错误释放整个旧操作会漏检。未认定当前业务误解绑。
- 已补故障后精确完整集合（a released/旧代次、b bound/旧代次、c bound/新代次），以及恢复后、
  确认后引用完整不变断言；同时补 PUBLISHED_CLEANUP 的 GET/确认前后任务、本地 operation、
  远端 operation、引用及 HTTP 调用数无副作用断言。
- 断言变异验证：只在临时测试数据库将 b 改成 released，定向运行目标用例，确实因 b 的 bound
  状态断言失败；退出码 1、1 失败/18 因 testNamePattern 未选中、4.332 秒，
  `/tmp/lms-t1-three-http-mutation.json`、`.log`。这是测试敏感性验证，不是业务缺陷复现。
  验证后移除临时故障写入，最终测试不含该注入或 skip；业务代码未改。
- 补强前家庭回归 102/102 套件、1704/1704 用例，零跳过，退出码 0，224.645 秒，
  `/tmp/lms-t1-three-http-family.json`、`.log`；该报告不代替补强后最终回归证据。
  本轮仅修复该测试保护缺口，不以通过关闭历史稳定性问题。

最终验证与自审结论（2026-10-22）：

- 移除临时故障注入后，用 Node v22.23.3 执行
  `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-three-http-final-family.json`，
  102/102 套件、1704/1704 用例，零跳过，退出码 0，200.520 秒；对应 `.json`、`.log` 保留。
  本次完整运行包含补强后的三服务用例 19/19，不以补强前报告替代。
- 与第十四批原全量报告比对：原 1685 用例全部保留，仅新增 19；仅对既有两个标题中的动态
  deletedAt/operationId 值作规范化，没有忽略其他用例名差异。
- 自审确认该 P2 的完整资源引用与无副作用断言已补齐，变异测试能捕获误释放保留引用；
  最终真实协议回归通过。未发现本批剩余可确认缺陷，等待用户复审，不直接关闭第十五批。
  新测试语法、文档门禁和 git diff --check 通过；生产 server/旧路由无本批改动，隔离测试继续通过。
- 原 `/tmp/lms-t1-star-http-family.json`、`.log` 仍保留 100/101 套件、1684/1685 用例通过的失败证据：
  knowledgePoints 的 TC-T5-POINT-008 报 socket hang up；早期 growthTasks socket hang up 记录亦不覆盖。
  本轮通过不能说明已修复这些故障，也不据此推定同根因。
- socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 保持 OPEN。生产接入仍须单独确认，
  T1 IN_PROGRESS，全量稳定性门禁不关闭。未提交、推送、部署或操作真实家庭数据。

第十五批用户复审关闭记录（2026-10-22）：

- 用户批准关闭第十五批及混合换图资源引用测试保护 P2。复审重新执行三服务、真实发星、公开/只读
  HTTP、resource operation、公共客户端与两侧生产隔离：9/9 套件、350/350 用例，零跳过，
  退出码 0，32.676 秒；`/tmp/lms-t1-three-http-rereview.json`、`.log`；文档门禁及 diff 检查通过。
- 完整引用集合/精确代次、故障后/恢复后/确认后状态、只读无副作用及账本幂等均获复审确认，
  未发现新增可确认缺陷。仅关闭该批及其 P2，三项稳定性风险、T1 与全量门禁状态不变。

### 18.19 第十六批：独立任务编辑与取消/归档 HTTP

状态：第十六批及多字段转换测试保护 P2 经用户复审通过并关闭；生产未接入，T1 IN_PROGRESS。

分批裁定：接续第八批已完成的 mutation service，新增仅显式启用的 HTTP router 工厂，
复用现有网关身份认证和公共错误处理，不复制权限/状态机/CAS 逻辑。
范围为 PATCH/DELETE 任务、鉴权优先、字段转换/校验、完成/确认互斥、事务及公开丢响应恢复、
首次取消与确认审计。材料附件/清单编辑不开放，旧生产路由不替换。
风险/回滚：仅 loopback 应用、合成身份/凭据和临时副本集；不操作真实家庭数据。
撤回新增工厂和测试即可回滚，无 schema/索引迁移；生产全写入口接入仍须单独确认。

实施记录（2026-10-22）：

- 新增 `routes/growthTaskCompletionMutation.js` 工厂，仅提供 PATCH/DELETE；固定网关身份认证，
  委托既有 edit/remove 事务服务，统一 200 成功投影/公共 errorHandler。没有生产 import/mount，
  生产隔离测试新增该文件的模块排除断言；没有修改 mutation service、schema 或旧路由。
- 先写 HTTP 测试：首次 38/38 失败，均因新工厂模块不存在，退出码 1，4.975 秒；
  `/tmp/lms-t1-mutation-http-red.json`、`.log`。这是新适配器缺失的红灯，不算既有业务缺陷。
- 添加最小工厂后 38/38 通过，退出码 0，5.291 秒；`/tmp/lms-t1-mutation-http-green.json`、`.log`。
  随后补两条真实在途请求的事务屏障、错误路径签名和 sync/async 异常脱敏，总计新增 44 用例。
- 定向命令：`npm run test:family-regression -- --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionMutationHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionMutationService.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionThreeServiceHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionIsolation.test.js backend/services/resource-service/__tests__/completionProtocolIsolation.test.js --json --outputFile=/tmp/lms-t1-mutation-http-focused.json`。
  5/5 套件、133/133 用例，零跳过，退出码 0，19.691 秒；对应 `.json`、`.log` 保留。

| 范围 | 验证 |
| --- | --- |
| 身份与范围 | 未签名/篡改/路径错配/信封重放拒绝；孩子、外家庭、离家家长和不存在任务不能绕过服务鉴权 |
| 校验与投影 | 共管可编辑；显式转换、单字段/全部字段转换失败、必填 null 与可选 null、空编辑；错误不被 owner pending 掩盖；恢复内部字段不公开 |
| 功能边界 | 材料附件、repeatRule、受保护字段拒绝；不开放清单编辑或材料编排 |
| 互斥 | 静态 owner/两类 pending 状态均拒绝；真实 completion claim 提交后暂停时，PATCH/DELETE 拒绝且不清锁；真实确认 intent 提交后、远端发星前，归档拒绝 |
| 软删除与审计 | pending 取消保留首次 cancelledAt；completed/confirmed 归档保留证据、版本、完成/确认审计及账本；原完成命令仍重放旧成功投影 |
| 故障恢复 | 公开 PATCH/DELETE 提交后断响应；edit/remove 两阶段各覆盖事务内回滚与提交后抛错，重建服务后重读当前状态；编辑重试前已完成则拒绝 |
| 错误契约 | 事务未知为 503 MEDIA_REFERENCE_PENDING；待发星归档为 409 STAR_AWARD_PENDING；非预期异常统一脱敏 500 |

验证边界：loopback homework 与既有 progress HTTP 共享临时 Mongo 连接；完成走无图片路径，
媒体依赖一旦调用即报错，不宣称本批验收媒体上传/引用释放。故障是测试层事务后抛错/HTTP 断响应，
不是 Mongo 网络或进程崩溃演练。编辑赋值重试可能再次递增 __v，不承诺逐请求恰好一次；取消重试不改首次时间。
独立检查及自审修订：

- 独立只读审查未发现新增 router 的功能缺陷，但发现测试保护 P2：`all casts` 夹具混入不允许
  编辑的 actualMinutes，会先被字段白名单拒绝而误绿，不能证明多字段全部转换失败。
- 用真实 parseGrowthTaskPatch 复核旧夹具，“必须先通过字段解析”的断言失败，退出码 1，
  `/tmp/lms-t1-mutation-http-cast-fixture-red.log`；这是测试夹具错误，不是业务转换缺陷。
- 改为仅允许编辑的 estimatedMinutes/targetAmount；单字段/多字段两例增加透传 spy，确认真实
  Task.castObject 被调用一次、输入与请求一致、实际抛错，且每个选中字段均是 CastError。
  spy 不替换实现，finally 恢复；真实 parser/cast 的纯内存复核已通过，两例确实到达目标路径。
- 新 HTTP 互斥测试覆盖意图已提交且请求仍在途的顺序；第八批已有最终 owner/版本 CAS 和事务
  竞争回归仍保留，不把这两条 HTTP 屏障测试说成穷尽所有提交交错。
最终验证与自审（2026-10-22）：

- Node v22.23.3 执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-mutation-http-family.json`：
  103/103 套件、1748/1748 用例，零跳过，退出码 0，224.616 秒；对应 `.json`、`.log` 保留。
  原 1704 用例全部保留，仅新增 44；清单比较仅规范化既有两个标题的动态 deletedAt/operationId。
- 时间边界：该全量运行中的新套件在上述 CastError 测试保护修订前已加载；不能作为补强后的全量证据。
  补强仅改变新测试的夹具与断言，没有改业务实现或生产装配。
- 修订后按相同五套件定向命令，报告改为 `/tmp/lms-t1-mutation-http-final-focused.json`：
  5/5 套件、133/133 用例，零跳过，退出码 0，21.477 秒；对应 `.json`、`.log` 保留。
  44 个 HTTP 用例含真实 cast 路径断言全部通过；同时覆盖原服务 61、三服务组合 19、两侧生产隔离 9。
- 自审确认：真实 cast 调用及全部字段错误断言有效；路由仅认证/转发，业务授权、校验及 CAS 仍由
  既有事务服务负责；两条真实请求屏障均在事务提交后暂停，并在 finally 释放/等待，未留悬挂请求。
  公开丢响应与事务结果未知均由持久状态恢复，首次取消/确认审计不改；未发现本批剩余可确认缺陷。
  本批新测试保护 P2 修订完成，等待用户复审，不自行关闭第十六批。
- 新工厂/测试语法检查、文档门禁及 git diff --check 通过；无生产路由接入、schema/索引迁移、
  提交、推送、部署或真实数据操作。生产隔离排除项覆盖新工厂。
- 原 `/tmp/lms-t1-star-http-family.json`、`.log` 的 knowledgePoints socket hang up 失败仍保留
  （100/101 套件、1684/1685 用例通过）；更早 growthTasks socket hang up 证据亦不覆盖。
  socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 保持 OPEN，不推定同根因或已修复。
  T1 IN_PROGRESS，全量稳定性门禁不关闭；生产全写入口接入仍须单独确认。

第十六批复审关闭记录（2026-10-22）：

- 用户复审通过，授权关闭第十六批及多字段转换测试 P2；不扩展为生产接入或 T1 总门禁批准。
- 复审确认鉴权/错误契约、最终 owner/版本 CAS、丢响应/事务未知恢复及首次取消/确认审计闭环。
  单字段/多字段夹具均进入真实 cast，逐字段 CastError 断言有效，不再以白名单提前拒绝误绿。
- 复审命令为 family-regression 的 runTestsByPath，范围为 MutationHttp、MutationService、
  ConfirmationService、ThreeServiceHttp、homework Isolation、resource completionProtocolIsolation 六套件。
  `/tmp/lms-t1-mutation-http-rereview.json`、`.log`：6/6 套件、166/166 用例，零跳过，退出码 0，28.346 秒。
  文档门禁和 git diff --check 通过；复审未重跑全量，既有全量结果的时间边界不变。
- socket hang up 及两项偶发 401 保持 OPEN；生产路由未接入，全量稳定性门禁不关闭。

### 18.20 第十七批：带完成图片的任务编辑/取消归档组合验收

状态：第十七批及首次确认审计测试 P2 经用户复审通过并关闭；生产未接入，T1 IN_PROGRESS。

分批裁定：补齐第十六批无图片路径与第十五批真实三服务链路之间的组合缺口，
在现有 ThreeServiceHttp 测试应用挂载独立 mutation router；不增加新的业务服务或生产开关。
验证真实 prepare/commit/unbind 丢响应时编辑/删除不能清锁或帮助恢复，原命令恢复后才可归档；
验证混合换图后的完整引用集合、精确绑定代次、首次确认审计、账本以及归档丢响应重放。
范围不包含材料/清单编辑、媒体上传、物理删除或生产全写入口切换。
风险/回滚：仅合成数据、loopback HTTP 与临时副本集；撤回本批测试装配和文档即可回滚，
无 schema/索引迁移或真实数据操作。三项稳定性风险及全量门禁继续保留。

实施与定向验证（2026-10-22，Node v22.23.3）：

- 扩展既有 `growthTaskCompletionThreeServiceHttp.test.js`，新增 13 个用例；原 19 个用例保留。
  新增 helper 读取完整资产/引用/远端和本地 operation/账本快照及调用计数，
  混合换图显式断言 A released/旧代次、B bound/旧代次、C bound/新代次，不能只检查目标数组。
- 先运行新增测试，测试 app 尚无 mutation 装配：13/13 失败，既有 19 用例按名称筛选未执行，
  退出码 1，7.845 秒；`/tmp/lms-t1-mutation-media-red.json`、`.log`。
  失败来自 PATCH/DELETE 404（断响应用例也因 404 未断开），不是业务事务错误。
- 仅向测试 app 注入真实 mutation service/router，服务重建同步重建该实例；业务源码未修改。
  无名称筛选重新执行本套件：32/32 通过，零跳过，退出码 0，10.443 秒；
  `/tmp/lms-t1-mutation-media-green.json`、`.log`。
- 定向命令：`npm run test:family-regression -- --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionThreeServiceHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionMutationHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionMutationService.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionStarHttp.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionIsolation.test.js backend/services/resource-service/__tests__/completionProtocolIsolation.test.js --json --outputFile=/tmp/lms-t1-mutation-media-focused.json`。
  6/6 套件、171/171 用例，零跳过，退出码 0，28.490 秒；对应 `.json`、`.log` 保留。

| 验证点 | 新增测试 |
| --- | --- |
| 媒体恢复互斥 | prepare/commit/unbind 真实成功后丢响应，PATCH/DELETE 503；GET 无副作用；原命令恢复后才归档，引用/映射代次正确 |
| 软归档及重放 | completed/confirmed × 正常/公开 DELETE 丢响应；归档保留引用、完成/确认审计，两个历史完成命令仍重放固定结果 |
| 发星未知与共管 | 真实星星账本已写、响应丢失时归档 409；离家家长 403，当前家长接续后归档，首次确认审计及唯一账本不变 |
| 顺序与权限 | 取消先胜不产生图片 operation；编辑先胜后完成/确认/归档保留新值；外家庭、同家庭其他孩子、离家家长不能修改已有图片任务 |

验证边界：本批只扩展独立集成测试，不新建业务 API，不表示完整生产入口已实现或获准。
媒体资产为合成记录，三服务 HTTP 共用测试进程与临时副本集，未演练真实上传、独立进程重启、
数据库 failover 或隐私物理删除；`rebuild` 仅重建应用服务实例。软归档保留引用符合现行契约。

自审与测试保护修订：

- 独立只读审查发现本批测试 P2：首次确认审计仅与之前快照比较，若快照本身错写确认人或遗漏
  反馈，测试仍可能通过。该发现针对测试保护，不代表已发现业务服务写错审计。
- 新增首次审计确定值断言：confirmedByParentId 必须为实际首次确认的共管家长，反馈为首次输入，
  confirmedAt 等于注入的确认时钟；恢复前推进时钟，现有前后快照断言继续保护首次时间不被重写。
  覆盖 confirmed 归档矩阵及真实发星丢响应/共管接续，不改业务服务。
- 临时仅在测试夹具中把已确认任务的 confirmedByParentId 改为错误家长，正常及丢响应两条归档
  用例均在新增确定值断言处失败：2 failed、30 按名称筛选未执行，退出码 1，4.131 秒；
  `/tmp/lms-t1-mutation-media-audit-negative.json`、`.log`。临时故障注入已撤回，不保留旁路或环境开关。
- 首轮全量 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-mutation-media-family.json`：
  103/103 套件、1761/1761 用例，零跳过，退出码 0，230.285 秒；对应 `.json`、`.log` 保留。
  该轮组合套件在上述审计断言补强前已加载，仅保留为中间证据，最终版本另行全量验证。

最终全量验证及用户复审关闭（2026-10-22）：

- 审计断言补强及临时故障撤回后的完整命令：`npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-mutation-media-final-family.json`。
  Node v22.23.3，103/103 套件、1761/1761 用例，零失败/跳过，退出码 0，220.236 秒；
  对应 `.json`、`.log` 保留，包含最终版本三服务组合 32/32 和两侧生产隔离用例。
- 与第十六批清单比较，原 1748 用例全部保留，仅新增 13；仅规范化两个既有标题中的运行时日期/UUID。
  文档门禁及 git diff --check 通过。此次最终结果不再使用审计补强前的中间全量充当最终证据。
- 用户复审确认媒体恢复互斥、完整引用及精确代次、归档丢响应、共管发星恢复及首次确认审计闭环；
  审计测试 P2 的确定值断言及负向探针有效，未发现新增可确认缺陷，授权关闭第十七批及该 P2。
- 关闭仅限本批；生产未接入，T1 IN_PROGRESS。socket hang up、STAB-T1-MEDIA-401、
  STAB-T1-GROWTHLOGS-401 继续 OPEN，历史失败证据保留，不关闭全量稳定性门禁。

### 18.21 第十八批：homework 完成协议只读启用前预检

状态：用户复审通过，第十八批及三项审查问题关闭；不连接真实数据库、不接入生产启动或路由，T1 IN_PROGRESS。

分批裁定：落实 API §14.7 的本地唯一索引与远程映射启用条件。模型声明和测试自动建索引
不能证明实际部署具备约束，因此增加独立显式调用的本地预检，不继续扩大 HTTP 组合矩阵。
范围仅 homework 自有 GrowthTaskCompletionOperation 集合：事务能力、实际业务/远程唯一索引、
TTL 禁止、非法/缺失 remoteOperationId，以及重复业务键/远程映射。额外更窄的唯一约束也须拒绝，
避免误把公开 UUID 变成跨 actor 全局唯一。等价索引不依赖名称，隐藏索引仍可实施唯一约束。
调用者必须显式声明已停写；该声明不代替运维停写措施，也不保证检查后没有索引或数据变化。
失败仅返回固定问题码，不输出家庭/孩子/命令标识、数据库地址或原始错误。
预检只读，不 init/syncIndexes、不建集合/索引、不修映射或删除终态；每条服务端查询 maxTimeMS=5000，
不允许聚合落盘。这不代替调用者的连接/选主超时或整个运维步骤的超时控制。
风险/回滚：仅临时副本集测试；撤回新增模块即可，无数据回滚。resource 侧预检、两端备份恢复、
受保护日志介质及生产切换仍待后续验收，本批通过不能证明映射从未被历史篡改。

实施及定向验证（2026-10-22，Node v22.23.3）：

- 新增独立 `services/growthTaskCompletionReadiness.js`，仅导入既有事务能力判断，不导入 Mongoose
  模型；以原生集合读实际索引和映射。没有生产 server/Gateway/路由装配或配置开关。
- 首次测试模块尚不存在：42/42 失败、零跳过，退出码 1，4.489 秒；
  `/tmp/lms-t1-readiness-red.json`、`.log`。实现后同套件 42/42 通过，退出码 0，5.924 秒；
  `/tmp/lms-t1-readiness-green.json`、`.log`。随后补齐真实 standalone、查询故障/限时和额外唯一索引场景，48 用例。
- 定向命令：`npm run test:family-regression -- --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionReadiness.test.js backend/services/homework-service/__tests__/models/GrowthTaskCompletionOperation.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionService.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionIsolation.test.js backend/services/resource-service/__tests__/completionProtocolIsolation.test.js backend/common/services/__tests__/mongoTransaction.test.js --json --outputFile=/tmp/lms-t1-readiness-focused.json`。
  6/6 套件、167/167 用例，零跳过，退出码 0，20.286 秒；对应 `.json`、`.log` 保留。
  包含预检 48、模型 42、完成恢复 65、两侧生产隔离 9、共享事务 3。
- 成功只返回 `{ready:true,service:'homework-service',protocol:'task-completion-v1'}`。
  失败固定 code `COMPLETION_PROTOCOL_NOT_READY`，issues 为以下问题码，不携带冲突文档或标识：

| 问题码 | 阻断条件 |
| --- | --- |
| WRITES_NOT_PAUSED | 未显式确认已停写，任何数据库访问之前拒绝 |
| TRANSACTIONS_UNAVAILABLE | hello 失败或不具备可写副本集/事务前提；真实 standalone 负向测试 |
| OPERATION_COLLECTION_MISSING | 集合不存在，不自动创建 |
| COMMAND_SCOPE_INDEX_INVALID / REMOTE_MAPPING_INDEX_INVALID | 缺失或不完整的唯一约束，包括非唯一、稀疏、部分、错误键或非 simple 排序规则 |
| INDEX_BUILD_IN_PROGRESS | 索引仍在构建，不把尚未提交的 unique 规格当成生效约束 |
| UNEXPECTED_UNIQUE_INDEX | 额外 unique 或 prepareUnique 约束可能将公开 UUID 错误收紧为跨 actor 唯一 |
| OPERATION_TTL_FORBIDDEN | 任意 operation TTL 索引，不自动删除 |
| REMOTE_MAPPING_INVALID | 任一阶段缺失、非字符串、非规范小写 UUID 映射，包含空新增图片集合的命令 |
| COMMAND_SCOPE_DUPLICATE / REMOTE_MAPPING_DUPLICATE | 原生集合存在历史重复业务键/远程映射，不输出键值或修复 |
| READINESS_QUERY_FAILED | 索引/文档/聚合查询错误，保留失败状态且不泄漏原始驱动错误 |

测试验证实际临时索引（含等价异名/重排键/隐藏索引）、合法四阶段及同 UUID 异 actor、历史坏数据、
成功/失败前后文档和索引不变；只读 API 参数探针同时禁止写方法、建索引和模型 init。
生产隔离排除项覆盖新增模块。此批只校验本地 ledger 的上述前提，不宣称全 schema、
任务 pending 与远端状态交叉审计或历史篡改检测已经完成。

独立审查及自审修订：

- 独立只读审查指出 1 项 P1 与 2 项 P2：默认索引列表可能包含未完成构建的 unique 规格；
  额外 prepareUnique 也会拒绝新重复键；Mongo 正则 `$` 可接受最后一个换行。
  三项均在临时 MongoDB 中复现为错误 ready，通过负向断言报错，非仅凭文档推断。
- 新负向测试：独立临时副本集用 failpoint 暂停真实索引构建；真实 collMod 设置额外窄键
  prepareUnique 并证明跨 actor 同 UUID 插入被拒绝；原生插入带尾随换行的映射。
  3/3 失败、48 按名称筛选未执行，退出码 1，5.099 秒；
  `/tmp/lms-t1-readiness-review-red.json`、`.log`。failpoint 仅临时测试进程启用，finally 释放并关闭实例。
- 改用原生 runCursorCommand 的 listIndexes/includeBuildUUIDs，识别构建中包装并拒绝；完整消费游标，
  成功/失败均关闭，不退回缺少构建信息的 helper。真实构建完成后再次检查可通过。
  同时识别 prepareUnique，用绝对结束负向前瞻拒绝尾随字符；业务模型和生产装配不变。
- 补游标多批读取及失败关闭，修订后预检 53/53 通过，零跳过，退出码 0，9.211 秒；
  `/tmp/lms-t1-readiness-review-green.json`、`.log`。
- 自审补充：所有预检读取显式使用 primary，避免继承调用连接的次节点读偏好；两条参数断言先红
  （2 failed、51 按名称筛选未执行，退出码 1，3.203 秒），见 `/tmp/lms-t1-readiness-primary-red.json`、`.log`。
  这验证读取选项，不宣称已演练有复制延迟的多节点故障。
- 修订前首轮全量：104/104 套件、1809/1809 用例，零跳过，退出码 0，233.638 秒；
  `/tmp/lms-t1-readiness-family.json`、`.log`。该轮在上述修订前加载预检套件，只保留为中间证据。

语义依据：[MongoDB listIndexes](https://www.mongodb.com/docs/manual/reference/command/listindexes/)
说明会返回构建中索引；[4.4 实现](https://github.com/mongodb/mongo/blob/r4.4.29/src/mongo/db/catalog/list_indexes.cpp)
和 [7.0 实现](https://github.com/mongodb/mongo/blob/r7.0.14/src/mongo/db/catalog/list_indexes.cpp)
支持 includeBuildUUIDs 构建信息；[prepareUnique 官方说明](https://www.mongodb.com/docs/manual/core/index-unique/convert-to-unique/)
确认转换准备阶段已阻止新重复键。实际负向测试使用测试依赖默认 MongoDB 7.0.14；未声称完成 MongoDB 4.4 实机矩阵。

- 最终定向回归沿用上述六套件命令，报告改为 `/tmp/lms-t1-readiness-final-focused.json`：
  6/6 套件、172/172 用例，零跳过，退出码 0，23.188 秒；对应 `.json`、`.log` 保留。
  预检 53/53，包含真实索引构建阻断及完成后恢复 ready、prepareUnique、尾随换行、主节点读取选项、
  游标多批读取/关闭。其余原有 119 个相关用例仍保留。
- 修订后自审：构建信息通过真实游标命令取得，不被 driver helper 丢弃；游标任何终结均关闭，
  不支持命令或读取失败均阻断且脱敏；不增加跨服务读取、写数据库或生产挂载。
  三项发现已修订并通过负向/正向验证，等待用户复审，不自动关闭本批发现或第十八批。

最终全量验证（2026-10-22）：

- Node v22.23.3，命令：`npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-readiness-final-family.json`。
  104/104 套件、1814/1814 用例，零失败/跳过，退出码 0，252.401 秒；对应 `.json`、`.log` 保留。
  此结果来自三项修订及显式 primary 读取后的最终代码，不使用修订前全量作为最终证据。
- 对比第十七批最终报告，原 1761 用例全部保留，仅新增预检 53；清单比较仅规范化两个既有
  用例标题中的运行时日期/UUID。包含两侧生产隔离及全部完成协议相关回归。
- 新服务/测试语法检查、文档门禁、git diff --check 通过。自审未发现本批剩余可确认缺陷；
  只读预检及三项审查修订等待用户复审，未自行关闭。
- 没有生产启动/路由接入、真实数据读写、索引迁移、提交、推送或部署；撤回本批独立模块和
  测试即可回滚，不修改既有 ledger。resource 预检及实际 MongoDB 4.4/备份恢复矩阵继续待办。
- 历史 `/tmp/lms-t1-star-http-family.json`、`.log` 的 knowledgePoints socket hang up 和
  `/tmp/lms-t1-material-replay-family.json`、`.log` 的 growthTasks socket hang up 失败仍保留。
  socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 均 OPEN，不推定同源或已修复；
  T1 IN_PROGRESS，全量稳定性门禁不关闭，生产接入仍需单独确认。

第十八批复审关闭（2026-10-22）：用户明确批准关闭本批以及构建中索引 P1、prepareUnique P2、
UUID 尾随换行 P2。复审重新执行六套件：172/172 用例、6/6 套件、零失败/跳过，退出码 0，
25.166 秒；证据 `/tmp/lms-t1-readiness-rereview.json`、`.log`。文档门禁和 diff 检查通过。
此前最终全量 104/104、1814/1814 为实施阶段证据，复审未重新执行全量；不据此关闭稳定性门禁。

### 18.22 第十九批：resource operation 账本只读预检

状态：用户复审通过，第十九批及相关审查问题关闭；独立显式调用，不挂载生产启动或路由，T1 IN_PROGRESS。

分批裁定：延续 API §14.7，检查 resource 自有 MediaReferenceOperation 集合的事务前提、
实际完整唯一索引、构建状态、额外 unique/prepareUnique、TTL、重复作用域，以及持久命令的
身份、引用集合/摘要、版本和租约/终态字段一致性。过期 PREPARED 是可恢复状态，不自动过期或拒绝。
使用原生只读 API，不导入模型；调用方必须保持停写，读取指定 primary。固定问题码，不返回行或原始错误。
本批不验证 MediaReference/删除凭证/墓碑之间的一致性、日志介质、跨服务映射或备份恢复，
不证明合法格式的历史数据未被改写；不能以单账本 ready 解锁生产。连接与总步骤限时由调用方负责。
风险/回滚：仅在临时 MongoDB 测试，不操作真实数据；撤回独立模块及测试即可，无数据回滚。

实施及定向验证（2026-10-22，Node v22.23.3）：

- 新增 `resource-service/services/mediaReferenceOperationReadiness.js`，原生索引游标使用
  includeBuildUUIDs；要求完整、非部分/稀疏、simple 排序规则的 scope 唯一索引，允许异名、
  重排键及隐藏的等价索引，拒绝额外 unique/prepareUnique 与任意 TTL。
- 投影读取最小恢复字段，逐批流式检查，不收集全账本至数组；索引和文档游标均 finally 关闭。
  服务端查询 maxTimeMS=5000，聚合不落盘，不承诺整个连接或运维步骤五秒结束。
- 规范 UUID/摘要拒绝尾随字符，BSON ObjectId 校验不做字符串隐式转换；引用必须为 1..10 个
  不重复的 completionMediaIds 条目，顺序与服务规范化一致，重新计算 SHA-256 校验 referenceSetHash。
  commandHash 只校验格式，不声称在缺少原始业务命令时可以重算或证明其真实性。
- PREPARED 要求有效租约且无终态时间/失败码；COMMITTED/ABORTED 要求有效终态时间且无租约，
  仅 ABORTED 要求固定格式失败码；版本为非负安全整数。过期 PREPARED 原样保留，不续租/恢复。
- 返回 `{ready:true,service:'resource-service',protocol:'task-completion-v1',scope:'operation-ledger'}`；
  错误固定 `MEDIA_OPERATION_PROTOCOL_NOT_READY`，不回传原始异常或数据。

| 问题码 | 阻断条件 |
| --- | --- |
| WRITES_NOT_PAUSED | 未显式确认停写，在任何数据库访问之前拒绝 |
| TRANSACTIONS_UNAVAILABLE | 缺失连接、hello 失败或不具备可写副本集/会话/协议版本前提 |
| OPERATION_COLLECTION_MISSING | 集合不存在，不自动创建 |
| OPERATION_COLLECTION_COLLATION_INVALID | resource 账本默认非 simple，运行时查询与唯一索引的身份比较语义可能不一致 |
| COMMAND_SCOPE_INDEX_INVALID | 缺少已生效的完整业务 scope 唯一约束 |
| INDEX_BUILD_IN_PROGRESS | 索引尚在构建，不能以 unique 规格代替生效约束 |
| UNEXPECTED_UNIQUE_INDEX | 额外 unique/prepareUnique 约束收紧合法业务作用域 |
| OPERATION_TTL_FORBIDDEN | operation 账本存在 TTL |
| OPERATION_IDENTITY_INVALID | BSON 身份、资源类型/字段、UUID 或命令摘要格式错误 |
| OPERATION_REFERENCES_INVALID | 引用类型、数量、唯一性、字段、规范顺序或摘要错误 |
| OPERATION_STATE_INVALID | 状态、版本、租约、终态时间或失败码组合错误 |
| COMMAND_SCOPE_DUPLICATE | 历史重复业务 scope，不返回冲突身份或自动修复 |
| READINESS_QUERY_FAILED | 查询、游标迭代或关闭失败，失败状态不降级为 ready |

测试与自审补强：

- 先写 70 个用例，模块未实现时 70/70 失败、零跳过，退出码 1，3.725 秒，
  `/tmp/lms-t1-resource-readiness-red.json`、`.log`；实现后 70/70 通过、零跳过，退出码 0，
  9.086 秒，`/tmp/lms-t1-resource-readiness-green.json`、`.log`。
- 真实临时 MongoDB 校验 standalone 拒绝、索引构建 failpoint 阻断及完成后通过、collMod
  prepareUnique 的实际拒绝插入、重复历史数据、原生坏行、合法三状态和跨作用域复用 UUID。
- 自审发现 P2：仅 `_bsontype` 标签可能把普通对象误判为 ObjectId。首次反例在客户端 BSON
  序列化时失败（`/tmp/lms-t1-resource-readiness-type-red.json`、`.log`），不计为有效复现。
  改由 MongoDB `$arrayToObject` 生成普通对象后，坏数据真实落库且预检错误 ready；负向断言
  失败、其余 73 用例按名称筛选未执行，退出码 1，2.876 秒，
  `/tmp/lms-t1-resource-readiness-type-repro.json`、`.log`。修订为同时校验 BSON 方法与十六进制身份。
- 补文档游标后续批次坏行、索引/文档 close 失败、完整游标消费及无写入/无模型初始化断言。
  补强后七套件 262/262、零跳过，退出码 0，28.549 秒，
  `/tmp/lms-t1-resource-readiness-focused.json`、`.log`。
- 再补真实协议事务产物验收：通过现有 prepare/commit/abort 服务生成规范记录，预检接受三状态，
  过期 PREPARED 及媒体引用保持不变。最终预检 75 用例；七套件 263/263、零失败/跳过，
  退出码 0，26.603 秒，`/tmp/lms-t1-resource-readiness-final-focused.json`、`.log`。
  定向命令：`npm run test:family-regression -- --runTestsByPath backend/services/resource-service/__tests__/mediaReferenceOperationReadiness.test.js backend/services/resource-service/__tests__/mediaReferenceOperationModel.test.js backend/services/resource-service/__tests__/mediaReferenceOperationService.test.js backend/services/resource-service/__tests__/completionProtocolIsolation.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionReadiness.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionIsolation.test.js backend/common/services/__tests__/mongoTransaction.test.js --json --outputFile=/tmp/lms-t1-resource-readiness-final-focused.json`。
- 生产隔离排除项加入新模块；无 server/Gateway/生产路由改动。语法、文档门禁和 diff 检查通过。
  使用临时 MongoDB 7.0.14；不声称完成 MongoDB 4.4 实机、复制延迟或故障切换矩阵。
- 本批及新发现 P2 修订等待用户复审；三项既有稳定性问题保持 OPEN，不关闭 T1 或全量稳定性门禁。

独立只读审查与修订：

- 审查指出两个 P2 及一个测试保护缺口：投影排除 `_id`，会放行无法通过终态 hydrate/CAS 的
  非 ObjectId 主键；聚合继承集合默认 collation，可能与已认可的 simple 唯一约束不一致；
  模型已导入后才安装 init spy，不能证明模块冷加载不导入模型。
- 增加真实原生数据用例：字符串 `_id` 落库且 hydrate 终态校验失败，旧预检错误 ready；
  默认 numericOrdering 的集合配 simple scope 唯一索引，两条不同规范 UUID 可插入，但默认查询
  将它们视为相等，旧预检误报重复，空集合则错误 ready。
  `/tmp/lms-t1-resource-readiness-review-red.json`、`.log`：3 失败、1 冷加载测试通过、75 按名称筛选未执行，
  退出码 1，3.215 秒。三条失败均抵达预检断言，不是环境或数据准备失败。
- 修订：投影并检查 `_id` 原生身份，不对外返回标识；原生 listCollections 检查集合默认排序规则。
  裁定采用明确拒绝非 simple 默认值，不仅给重复聚合加 simple：现有业务恢复查询也继承默认值，
  只修聚合会继续放行不安全的运行时查询。返回 OPERATION_COLLECTION_COLLATION_INVALID，
  不误报重复、不自动迁移。默认未配置或 simple 均符合原生协议身份语义。
- 补集合元信息读取/关闭失败与参数断言；冷加载测试启动独立 Node 进程，在首次 import 前拦截
  models/Mongoose 依赖，并验证故意加载 mongoose 确实被拦截，避免模块缓存掩盖导入副作用。
- 修订后定向沿用七套件命令，输出 `/tmp/lms-t1-resource-readiness-review-focused.json`、`.log`：
  7/7 套件、269/269 用例（预检 81），零失败/跳过，退出码 0，27.688 秒。
- 修订前全量 `/tmp/lms-t1-resource-readiness-family.json`、`.log`：105/105 套件、1889/1889 用例，
  零失败/跳过，退出码 0，238.880 秒。该轮在上述独立审查修订前加载预检，只保留为中间证据。
- 修订后自审：集合元信息、索引、文档三类游标均在 finally 关闭；读取失败或关闭失败均脱敏阻断；
  默认排序规则限制同时保护预检和既有运行时身份查询，主键校验覆盖后续终态 CAS。
  未增加生产挂载、真实数据迁移或跨服务数据库访问；本批自审 P2、两项审查 P2 与冷加载保护补强
  均已修订，等待用户复审，不自行关闭第十九批。

最终验证（2026-10-22）：

- Node v22.23.3，命令 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-resource-readiness-final-family.json`。
  105/105 套件、1895/1895 用例，零失败/跳过，退出码 0，249.451 秒；对应 `.json`、`.log` 保留。
  该轮在 `_id`、默认 collation、冷加载与元信息游标修订后运行，不使用修订前全量代替。
- 与第十八批最终全量清单比较，原 1814 用例全部保留，仅新增 resource 预检 81 用例；
  比较仅规范化三个既有用例标题里的运行时 UUID/日期（非法映射数组、deletedAt、非法确认 UUID）。
  无删减或跳过旧用例，生产隔离测试仍通过。
- 新模块与测试语法、文档门禁、git diff --check 通过。自审及独立审查发现的修订均有针对性
  反例和回归保护；最终自审未发现本批剩余可确认缺陷，仍等待用户复审，不自动关闭本批问题。
- 无生产路由/启动挂载、真实数据修改、索引迁移、提交、推送或部署。撤回本批独立模块、测试
  及测试清单项即可回滚，不修改业务数据。resource 单账本 ready 不替代跨集合、日志或备份恢复验收。
- 已核实两份历史失败报告仍保留：`/tmp/lms-t1-star-http-family.json`、`.log` 的 knowledgePoints
  socket hang up，以及 `/tmp/lms-t1-material-replay-family.json`、`.log` 的 growthTasks socket hang up。
  socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 均 OPEN，不推定同源或已修复；
  T1 IN_PROGRESS，全量稳定性门禁不关闭，生产接入仍需单独确认。

第十九批复审关闭（2026-10-22）：用户批准关闭本批、BSON 伪装身份 P2、账本 `_id` P2、
默认 collation P2 及冷加载测试保护缺口。复审七套件 269/269，零失败/跳过，退出码 0，36.284 秒；
`/tmp/lms-t1-resource-readiness-rereview.json`、`.log`。文档门禁和 diff 检查通过。
实施阶段最终全量 105/105 套件、1895/1895 用例为已有证据，复审未重跑全量，不据此关闭稳定性问题。

### 18.23 第二十批：隐私删除证据跨集合只读预检

状态：用户复审通过，第二十批及 P1/P2、相关测试缺口关闭；独立模块，不挂载生产启动或路由，T1 IN_PROGRESS。

分批裁定：在第十九批 operation 账本前提之上，增加 resource 自有墓碑、精确代次删除凭证、
媒体及当前引用的一致性检查。成功 scope 为 privacy-evidence，不等于完整 resource 发布许可。
先检查四个相关集合实际索引及默认排序规则，再按最小字段投影流式检查关联；不读取存储路径。
调用者必须保证停写，跨集合检查不是在线事务快照。不导入模型、不自动建索引、不写数据库，
不调用日志持久化或存储删除。撤回独立模块、测试及测试清单项即可回滚，无真实数据迁移。

契约与边界：

- 四个集合必须存在且默认 simple；预期唯一索引必须生效且完整，拒绝构建中、额外
  unique/prepareUnique、部分/稀疏约束和 TTL；不使用 autoIndex 修复部署状态。
- 墓碑验证原生身份、actor/role、purpose/reason 与删除时间；student actor 必须等于 child。
  仍存在的媒体必须带新协议删除标记，状态/家庭/孩子/删除时间与墓碑一致。
- 每份凭证对应同媒体/家庭/孩子的墓碑，以及 scope、绑定代次和引用集合均匹配的 COMMITTED
  operation。未清理时当前引用须为相同代次的隐私 released，释放时间与凭证相同。
- 同一完整 scope/media 的不同绑定代次凭证为可判定冲突，清理后仍以
  RECEIPT_GENERATION_CONFLICT 阻断；跨任务合法多凭证不受影响，不变更现有索引。
- 对墓碑涉及的全部当前引用做检查；整组 ABORTED 释放和正常解绑不伪装为删除凭证，
  无绑定删除不要求凭证。媒体保留清理后允许 asset/reference 均缺失，历史终态/凭证/墓碑仍保留。
- 从新协议媒体标记及隐私释放引用反向检查证据存在，不能只从墓碑/凭证出发；旧无标记、
  无新协议隐私释放引用的删除记录兼容，不自动升级或伪造证据。
- 仅数据库证据一致性，不验证日志介质已经持久化或文件已删除；日志确认失败但数据库删除
  已提交的状态可以通过本检查，必须由独立日志/恢复门禁继续阻断发布。
- 非删除媒体的全部活动引用、历史合法格式篡改、跨服务映射及备份恢复不在本批证明范围。
  生产路由接入仍需单独确认，socket hang up 与两项偶发 401 继续 OPEN，T1 IN_PROGRESS。

实现与验证记录（2026-10-22，Node v22.23.3）：

- 新增 `completionPrivacyReadiness.js` 与 84 条测试，纳入 resource-family 标准测试清单；
  生产隔离测试检查服务器冷加载没有引入此模块。未变更服务器、生产路由或数据库 schema。
- 原生查询仅访问 resource 自有五个集合，以 primary、maxTimeMS 和最小投影读取；
  集合元信息、索引及数据流游标在 finally 关闭。异常只返回固定问题码，不泄露原始错误、
  家庭/孩子/媒体标识或存储路径。失败关闭游标仍阻断；冷加载独立进程拒绝 Mongoose/model 导入。
- 原始 TDD 红灯 `/tmp/lms-t1-privacy-readiness-red.json`、`.log`：缺失模块，70 失败，退出码 1，
  3.005 秒。初版 `/tmp/lms-t1-privacy-readiness-green.json`、`.log`：70/70，退出码 0，26.190 秒。
- 自审 P2：仅从墓碑/凭证出发，会漏掉标记与证据均丢失但仍残留的隐私 released 引用。
  补原生坏数据反例 `/tmp/lms-t1-privacy-readiness-reverse-red.json`、`.log`：1 失败、
  70 按名称筛选未执行，退出码 1，2.839 秒，失败为预检错误返回 ready。增加反向引用扫描修复；
  `/tmp/lms-t1-privacy-readiness-focused.json`、`.log`：81/81，退出码 0，30.763 秒。
- 初次关联六套件 `/tmp/lms-t1-privacy-readiness-regression.json`、`.log`：6/6、317/317，
  零失败/跳过，退出码 0，55.645 秒。此轮早于独立审查修订，仅保留为中间证据。
- 独立审查 P1：保留清理后，若同一完整 scope/media 有两个 COMMITTED 历史代次及两份删除
  凭证，原预检逐份校验会误放行，而实际 references status 抛 MEDIA_OPERATION_INCONSISTENT。
  原生 MongoDB 反例 `/tmp/lms-t1-privacy-readiness-generations-red.json`、`.log`：1 失败、
  1 通过、81 按名称筛选未执行，退出码 1，4.122 秒。失败抵达预检断言，并非环境/夹具失败。
  采用完整 scope/media 下排除当前 bindingOperationId 的只读冲突查询，保留跨任务合法凭证。
- 同时补两个审查测试缺口：真实 A 正常解绑后重绑 B、另一个任务仍绑定、第三任务已解绑，
  删除只产生 B 与第二任务的精确凭证；清理前后均通过预检，清理后实际查询每一历史 operation
  和当前 references，旧代次/普通解绑无凭证。注入冲突旧代次后，预检与实际恢复均拒绝。
- PREPARED 实际两媒体整组删除其中一个：两引用均 released、账本 ABORTED，另一媒体仍 active、
  无删除凭证；保留清理后执行 operation/references status 和重复 DELETE，终态、凭证及首次
  删除审计不变。另补清理后凭证媒体不在有效 operation 引用集合中的负向用例。
- 三种真实事务路径 PREPARED/COMMITTED/UNBOUND 均经过日志确认失败后重试及文件删除失败后
  重试，预检不调用日志/存储、不改变数据快照。日志与存储接口使用故障注入桩，仅证明数据库
  状态与恢复调用组合，不声称日志介质持久性或真实文件备份/恢复已验收。
- 审查修订后新增套件 `/tmp/lms-t1-privacy-readiness-review-focused.json`、`.log`：84/84，
  零失败/跳过，退出码 0，34.538 秒。随后强化整组删除在清理前的两引用断言，最终回归另列。

最终关联验证与自审：

- 命令：`npm run test:family-regression -- --runTestsByPath`，六套件为 resource 的
  `completionPrivacyReadiness`、`completionMediaPrivacy`、`mediaReferenceOperationReadiness`、
  `mediaReferenceOperationService`、`completionProtocolIsolation`，及 homework 的
  `services/growthTaskCompletionPrivacyHttp`（均为 `__tests__` 下的 `.test.js` 文件）。
  使用 `--json --outputFile=/tmp/lms-t1-privacy-readiness-final-focused.json`；对应 `.log` 保留。
  最终 6/6 套件、320/320 用例，零失败/跳过，退出码 0，59.153 秒。
- 最终自审复核正反向证据、清理后跨代次冲突、整组 ABORTED、正常解绑、真实重放及审计保留；
  当前未发现本批剩余可确认缺陷。自审 P2、独立审查 P1 与两项测试缺口已修订并有测试保护，
  等待用户复审，不自行关闭。未修改生产 server/Gateway，隔离与冷加载测试通过。
- 实际索引构建/prepareUnique 负向测试使用临时 MongoDB 7.0.14 副本集；没有对真实数据库操作，
  也不据此宣称 MongoDB 4.4 或生产环境验收通过。
- 最终家庭版全量命令：`npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-privacy-readiness-final-family.json`。
  106/106 套件、1979/1979 用例，零失败/跳过，退出码 0，272.830 秒；对应 `.json`、`.log` 保留。
  该轮在全部审查修订和整组断言补强后运行，不使用初版或中间结果替代。
- 与第十九批最终全量清单逐项比较，原 1895 用例全部保留，仅新增本批 84 用例，无删除/跳过；
  只规范化三个既有标题中的动态 UUID/日期（非法映射数组、deletedAt、非法确认 UUID）。
- 文档门禁、JS 语法与 git diff --check 通过；本批生产装配差异为空，隔离测试通过。
  既有未提交工作保留，未执行提交、推送、部署、真实数据修复或索引迁移。
- 已再次核实历史 `/tmp/lms-t1-star-http-family.json`、`.log` 的 knowledgePoints socket hang up
  与 `/tmp/lms-t1-material-replay-family.json`、`.log` 的 growthTasks socket hang up 失败报告仍保留。
  本轮通过不证明历史根因已解决：socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401
  继续 OPEN。T1 IN_PROGRESS，全量稳定性门禁不关闭，生产路由接入仍须单独确认。

第二十批复审关闭（2026-10-22）：用户批准关闭本批、反向证据 P2、清理后跨代次凭证冲突 P1
及真实组合/清理后重放测试缺口。复审六套件 320/320，零失败/跳过，退出码 0，58.329 秒；
`/tmp/lms-t1-privacy-readiness-rereview.json`、`.log`。文档门禁与 diff 检查通过。
复审核实实施阶段全量 106/106 套件、1979/1979 用例的报告，未重跑全量，不关闭三项稳定性问题。

### 18.24 第二十一批：完成作品引用只读一致性预检

状态：用户复审通过并批准关闭本批及测试保护缺口；独立显式调用，不接入生产，T1 IN_PROGRESS。

分批裁定：在 operation 和隐私证据预检上补齐 completionMediaIds 当前引用与媒体、账本的
双向一致性。只读扫描 resource 自有集合，调用者保证停写；不访问 homework 数据库、
不验证跨服务业务任务存在，不执行恢复/续租/解绑/清理或索引迁移。

- 当前引用必须有原生身份、规范代次、合法状态字段、同家庭/孩子的完成图片媒体和包含该项的 operation。
- PREPARED 必须保有完整原代次引用集合、逐项租约相同且媒体仍 active；到期但未恢复仍合法，预检不转换终态。
- bound 必须对应 COMMITTED；released 必须对应 COMMITTED 或 ABORTED，普通解绑不要求 release 命令账本，
  ABORTED 释放标识须为原代次，隐私释放交由前置证据检查保护。
- COMMITTED 历史集合允许当前引用由新代次持有，不要求重绑回旧代次；若当前引用缺失，
  必须为媒体和引用已清理且仍有同家庭/孩子墓碑。ABORTED 可能从未准备，不要求历史集合仍有媒体/引用。
- 非 completion 字段不纳入新增扫描，保留旧协议；无引用的活动媒体允许存在。
- 固定脱敏问题码、primary/限时投影读取、游标关闭及冷加载隔离；成功 scope 仅为 reference-consistency。
  日志介质、跨服务快照/备份恢复与生产切换仍另行验收。回滚撤回本批独立模块、测试和文档即可。

实施与阶段证据（2026-10-22，Node v22.23.3）：

- 新增独立 `completionReferenceReadiness.js` 和测试，纳入 resource-family 测试清单；
  生产隔离测试增加新模块禁入检查。原 operation/隐私预检、协议服务和生产 server/Gateway 不修改。
- 首组 52 用例 TDD 红灯 `/tmp/lms-t1-reference-readiness-red.json`、`.log`：模块缺失，
  52 失败、零跳过，退出码 1，2.974 秒；实现后 `/tmp/lms-t1-reference-readiness-green.json`、`.log`：
  52/52，退出码 0，4.694 秒。此红灯证明新能力尚未存在，不作为特定 bug 的复现证据。
- 补原生流式读取/关闭错误、查询错误脱敏、最小投影/无写入断言和三个真实事务生命周期，
  `/tmp/lms-t1-reference-readiness-focused.json`、`.log`：61/61，零失败/跳过，退出码 0，7.156 秒。
- 真实路径包含 prepare、commit、普通 unbind、重绑、过期但尚未恢复、显式 abort、整组隐私中止、
  保留清理和重复删除。各阶段预检前后快照不变，日志/存储调用数不变，首次删除审计不改写。
  预检不访问真实数据库；临时 MongoDB 副本集配合日志/存储桩，不宣称实际介质或部署验收完成。
- 初次关联七套件 `/tmp/lms-t1-reference-readiness-regression.json`、`.log`：7/7、381/381，
  零失败/跳过，退出码 0，71.287 秒；早于以下测试补强，仅保留为阶段证据。
- 独立审查未发现功能性误放行/误拒绝或读写隔离缺陷，指出 P3 测试保护缺口：
  现有反例不能独立保护“有墓碑但媒体尚存时，不得把当前引用缺失视为清理完成”的条件。
  本批补一条原生数据负例，先确认前置隐私预检允许此组合，再要求本预检拒绝；删除媒体后转为通过。
  `/tmp/lms-t1-reference-readiness-review-case.json`、`.log`：1 通过、61 按名称筛选未执行，
  退出码 0，3.037 秒。这是测试补强，不是已发现并修改了功能缺陷。
- 为证明保护有效，临时去掉 `asset ||` 条件，反例实际错误放行，
  `/tmp/lms-t1-reference-readiness-mutation-red.json`、`.log`：1 失败、61 按名称筛选未执行，
  退出码 1，3.023 秒；不是环境/夹具失败。运行结束即在 finally 恢复原条件，无变异残留。
  该缺口按清理门槛的合同保护处理，避免后续改动误报 ready；不扩展运行时实现。
- 最终关联命令 `npm run test:family-regression -- --runTestsByPath`，七套件为 resource 的
  `completionReferenceReadiness`、`completionPrivacyReadiness`、`completionMediaPrivacy`、
  `mediaReferenceOperationReadiness`、`mediaReferenceOperationService`、`completionProtocolIsolation`，
  及 homework 的 `services/growthTaskCompletionPrivacyHttp`（均为 `__tests__` 下的 `.test.js` 文件）。
  使用 `--json --outputFile=/tmp/lms-t1-reference-readiness-final-focused.json`；对应 `.log` 保留。
  最终 7/7 套件、382/382 用例，新增套件 62 用例，零失败/跳过，退出码 0，64.909 秒。
- 最终自审核对完整集合、精确作用域/代次、过期未恢复、历史重绑、普通解绑与隐私清理组合；
  冷加载隔离、查询错误脱敏、游标关闭与无写入断言均通过。未发现本批剩余可确认缺陷。
  独立审查测试缺口已补强，等待用户复审，不自行关闭第二十一批或其审查事项。
- 最终家庭版全量命令 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-reference-readiness-final-family.json`：
  107/107 套件、2041/2041 用例，零失败/跳过，退出码 0，278.530 秒；对应 `.json`、`.log` 保留。
  在测试补强及临时变异恢复后执行，不以阶段结果代替最终验证。
- 与第二十批最终报告比较，原 1979 用例全部保留，仅新增本批 62 用例，无删除/跳过。
  只规范化三个既有标题中的动态 UUID/日期（非法映射数组、deletedAt、非法确认 UUID）。
- 文档门禁、两个新增 JS 文件语法和 git diff --check 通过；生产 server/Gateway 没有本批差异，
  新模块只被测试显式调用，生产隔离测试通过。未提交、推送、部署或修改真实数据/索引。
- 历史 `/tmp/lms-t1-star-http-family.json`、`.log` 的 knowledgePoints socket hang up 与
  `/tmp/lms-t1-material-replay-family.json`、`.log` 的 growthTasks socket hang up 失败证据仍保留。
  socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 均 OPEN，不推定根因已修复。
  T1 IN_PROGRESS，全量稳定性门禁不关闭；生产路由接入仍需单独确认。

第二十一批复审关闭（2026-10-22）：用户批准关闭本批及媒体尚存清理门槛的测试保护缺口。
复审七套件 382/382，零失败/跳过，退出码 0，68.769 秒；
`/tmp/lms-t1-reference-readiness-rereview.json`、`.log`。文档门禁、语法与 diff 检查通过。
复审核实上一轮全量 107/107 套件、2041/2041 用例报告，未重跑全量。
本次关闭不包含三项稳定性问题、全量稳定性门禁、T1 或生产接入。

### 18.25 第二十二批：删除日志持久化故障与重启重试

状态：用户复审通过并批准关闭本批及同步等待测试 P2 保护缺口；不接入生产，T1 IN_PROGRESS。

范围与裁定：补齐 T1 隐私删除成功前日志持久性、TC-SL-PRIVACY-004 清理前日志确认的故障验证。
复用现有 journal 的独占临时文件、文件同步、硬链接发布及目录同步协议，补实际文件系统的
分阶段失败、并发和进程重启证据，以及删除/清理组合的拒绝与重试。发现实现问题时先复现再修复。
仅在受控临时目录与临时 MongoDB 副本集上使用合成数据，不改真实日志介质、权限、数据或索引。
不新增恢复写入脚本或生产装配；回滚仅撤回本批测试及文档，若产生实现修订须另记回滚范围。
真实断电、磁盘/NAS 持久性、独立日志完整性和跨服务旧快照恢复均不由本批证明。
socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 保持 OPEN，全量稳定性门禁不关闭。

实施与阶段证据（2026-10-22，Node v22.23.3）：

- 新增 `resource-service/__tests__/mediaDeletionJournal.test.js`，16 个测试纳入 resource-family。
  六个故障点为 parent sync、write、file sync、link 发布、临时文件 unlink、journal directory sync；
  除明确注入的系统调用失败外，实际使用临时文件，断言失败拒绝、句柄关闭、文件状态及新实例重试。
  覆盖同步顺序/成功确认等待、相同/冲突证据并发、两个子进程发布前后中断及重新启动。
  子进程以 42 退出模拟应用中断，不是断电测试；中断遗留 tmp 保留，不当作日志或自动清理。
- `completionMediaPrivacy.test.js` 新增 3 例：文件/目录同步失败贯穿删除、共管家长重试、保留清理、
  清理后重放；真实日志冲突阻断清理，不覆盖现有日志/首次数据库审计、不删除在线正文。
- `growthTaskCompletionPrivacyHttp.test.js` 新增 2 例：真实文件/目录同步错误通过真实 HTTP 返回脱敏 503，
  原签发内容 URL 和再次授权均 404，媒体正文暂保留；另一家长重试得到空 204，首次审计/精确凭证不变。
- 既有 journal、隐私删除、清理和 HTTP 实现无需修改；本批为已有契约的故障验证补齐，不重复实现持久化逻辑。
  第一轮 `/tmp/lms-t1-journal-focused.json`、`.log`：16/16，零失败/跳过，退出码 0，0.788 秒。
  关联四套件 `/tmp/lms-t1-journal-regression.json`、`.log`：4/4、84/84，零失败/跳过，退出码 0，13.368 秒。
- 保护性变异：临时将 journal 的 `await directory.sync()` 替换为无同步等待；
  `/tmp/lms-t1-journal-mutation-red.json`、`.log`：3 个套件、4 个测试因提前成功确认失败，
  73 个按名称筛选未执行，退出码 1，5.996 秒。真实 HTTP 断言实际观察到错误的 204 而非 503；
  非环境/夹具失败。测试后 finally 恢复原实现，没有变异残留，也不将变异描述为实际功能缺陷。
- 恢复后关联命令 `npm run test:family-regression -- --runTestsByPath`，四套件为 resource 的
  `mediaDeletionJournal`、`completionMediaPrivacy`、`completionProtocolIsolation`，及 homework 的
  `services/growthTaskCompletionPrivacyHttp`（均位于对应 `__tests__` 下，`.test.js`）。
  `/tmp/lms-t1-journal-final-focused.json`、`.log`：4/4、84/84，零失败/跳过，退出码 0，12.270 秒。
- 以上均为阶段证据，不能据此关闭本批或全量门禁；最终证据见下方补强后记录。
- 独立审查指出 P2 测试保护缺口：原 directory-sync 屏障只在进入同步时断言未完成，
  可能漏掉“调用 sync 但未 await，稍后提前确认”。因此将屏障扩展为 file-sync、publish、directory-sync，
  记录屏障完成前关闭句柄/发布/删除临时文件等依赖操作，不能只观察调用顺序。
  同时补 delete/cleanup 等待 journal 确认的服务层屏障、部分写入即退出及重启冲突证据拒绝。
  这是测试保护修订，不是运行时缺陷；不使用任意 sleep 判断异步步骤已完成。
- 修订后分别单独注入三个 fire-and-forget 变异，逐次恢复，避免多个变异相互影响：
  directory.sync 未等待：`/tmp/lms-t1-journal-directory-await-red.json`、`.log`，1 失败/18 按名称筛选未执行；
  删除 journal.persist 未等待：`/tmp/lms-t1-journal-delete-await-red.json`、`.log`，1 失败/33 按名称筛选未执行；
  清理 journal.persist 未等待：`/tmp/lms-t1-journal-cleanup-await-red.json`、`.log`，1 失败/33 按名称筛选未执行。
  三次退出码均为 1，分别捕获提前关闭目录句柄、删除成功确认、清理成功确认，不是环境失败。
  较早三处同时变异报告 `/tmp/lms-t1-journal-await-mutation-red.json`、`.log` 仅作阶段证据，
  3 失败/50 筛选未执行、退出码 1、3.204 秒；最终归因以以上三个独立变异为准。所有变异均在 finally 恢复。
- 修订后定向 `/tmp/lms-t1-journal-reviewed-focused.json`、`.log`：4/4 套件、89/89 用例，
  零失败/跳过，退出码 0，12.419 秒。新增 journal 套件最终 19 例；既有 privacy 增加 5 例、HTTP 增加 2 例，
  本批合计新增 26 例。原有运行时实现、存储格式、生产入口不变。
- 补强过程中启动的全量阶段报告 `/tmp/lms-t1-journal-stage-family.json`、`.log`：108/108 套件、
  2065/2065 用例，零失败/跳过，退出码 0，293.818 秒。该运行未包含最后两个服务等待屏障，
  不作为最终版本证据；所有测试修订与变异恢复后的全量验证另行执行。
- 修订后自审：核对三个等待屏障的真实后续操作、失败传播、finally 释放与文件句柄关闭，
  重启冲突必须返回明确 evidence conflict 而非任意子进程失败；确认部分 tmp 不能替代完整日志。
  普通同步失败仍禁止成功确认/物理清理，重试及清理后重放保留首次审计。未发现剩余可确认问题。
  独立审查 P2 已补强并经独立变异验证，等待用户复审，不自行关闭第二十二批及该项 P2。
- 最终家庭版全量命令 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-journal-final-family.json`：
  108/108 套件、2067/2067 用例，零失败/跳过，退出码 0，280.818 秒；对应 `.json`、`.log` 保留。
  在全部测试修订与临时变异恢复后执行；原 2041 用例全部保留、新增 26，无删除/跳过。
  比较只规范化既有三个标题族中的动态 UUID/日期，不把测试改名或删除当成原用例保留。
- 文档门禁、三个测试文件语法及 git diff --check 通过；生产隔离 7/7，server/Gateway 无本批差异。
  本批仅新增/扩展测试、测试清单和四份文档，运行时逻辑无保留变更；无需数据迁移或数据回滚。
  未提交、推送、部署或触碰真实媒体/日志介质。真实断电、NAS 备份与跨服务恢复仍待单独验收。
- 历史 `/tmp/lms-t1-star-http-family.json`、`.log` 和 `/tmp/lms-t1-material-replay-family.json`、`.log`
  的 socket hang up 失败证据仍保留；socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401
  均 OPEN，不以本轮全绿证明根因已修复。T1 IN_PROGRESS，全量稳定性门禁不关闭，生产接入仍需单独确认。

第二十二批复审关闭（2026-10-22）：用户批准关闭本批及同步等待测试 P2 保护缺口。
复审四套件 89/89，零失败/跳过，退出码 0，14.405 秒；`/tmp/lms-t1-journal-rereview.json`、`.log`。
文档门禁和 diff 检查通过；核实上一轮全量 108/108 套件、2067/2067 报告，但未重新执行全量或变异。
本次关闭不包含生产接入、T1、三项稳定性问题或全量稳定性门禁。

### 18.26 第二十三批：三服务 BSON 快照重建后的协议恢复

状态：用户复审通过，第二十三批及首次确认审计、pending GET 无副作用两项 P2 测试保护缺口关闭；不接入生产，T1 IN_PROGRESS。

范围与裁定：落实 TC-SL-REMOTE-ID-004 的应用协议子项。仅在现有测试临时副本集内，
停止 loopback HTTP 服务后对固定模型集合进行 BSON 序列化、清空并重建合成记录，再启动新的
resource/homework/progress 测试 app 与 client，验证持久映射、终态和精确绑定代次不依赖旧服务实例。
保留并核对现有索引，不迁移索引或重放真实日志；不新增生产恢复脚本，不访问真实数据库/介质。
测试用数据库重建不是 mongodump/mongorestore、多数据库一致快照、NAS 或灾备验收；
删除日志完整性与旧快照隐私防复活仍由后续专门验收负责，不勾选完整 TC-SL-REMOTE-ID-004 或 T8。
回滚仅撤回本批测试与文档，生产状态不变。socket hang up 和两项偶发 401 保持 OPEN，全量门禁不关闭。

实施与阶段证据（2026-10-22，Node v22.23.3）：

- 扩展 `homework-service/__tests__/services/growthTaskCompletionThreeServiceHttp.test.js`，
  抽取测试 app 启停，加入 BSON 重建辅助函数及 11 个组合用例；不增加运行时函数或生产路由。
  每轮关闭旧监听器，逐集合确认清空后插入 BSON 解码记录，核对原生文档及索引完全一致，
  再创建三组新 app/client；媒体故障记录和实际账本仍来自真实 loopback HTTP 提供方。
- 覆盖 prepare/commit 成功后丢响应，纯删除/混合换图分别在 unbind 执行前失败及成功后丢响应，
  COMMITTED/ABORTED 历史命令与异 actor 同 UUID，发星未知结果后的共管接续和首次确认审计，
  缺映射阻断，以及原租约恰好到期后的 ABORTED/FAILED 重放。GET/拒绝确认不触发远端恢复。
- 首轮 `/tmp/lms-t1-snapshot-focused.json`、`.log`：5 通过、3 失败、32 按名称筛选未执行，
  退出码 1，6.487 秒。核实失败为测试预期错误：references 模式不发送 bindingOperationId；
  普通解绑合法推进旧 COMMITTED operation 的 version/updatedAt，不改变 state/terminalAt/原摘要。
  已按现行契约修正断言，并要求解绑时旧代次、释放命令标识及终态事实均正确；不修改运行时实现。
- 增补解绑前及到期路径后，`/tmp/lms-t1-snapshot-three-service.json`、`.log`：1/1 套件、43/43 用例，
  零失败/跳过，退出码 0，14.589 秒；原套件 32 用例保留，新增 11。
- 以下保留阶段验证记录；最终验证另列，不以阶段结果关闭本批或任何总门禁。
- 关联命令 `npm run test:family-regression -- --runTestsByPath`：homework 的
  `services/growthTaskCompletionThreeServiceHttp`、`services/growthTaskCompletionService`、
  `services/growthTaskCompletionMediaService`、`services/growthTaskCompletionIsolation`，及 resource 的
  `completionProtocolIsolation`（均为各自 `__tests__` 下的 `.test.js`）。
  `/tmp/lms-t1-snapshot-regression.json`、`.log`：5/5 套件、133/133 用例，零失败/跳过，退出码 0，29.252 秒。
- 自查补强租约边界，明确核对重建前后原 PREPARED 记录不变、到期点成为 terminalAt/releasedAt，
  一条原引用按原代次 released 且租约清空，不能仅凭无 bound 引用放行误删。
  `/tmp/lms-t1-snapshot-lease.json`、`.log`：1 通过、42 按名称筛选未执行，退出码 0，4.871 秒。
  此补强晚于上述关联回归，最终完整验证另行执行。
- 独立只读审查发现两项 P2 测试保护缺口，未发现运行时缺陷：
  首次确认时钟未推进可能掩盖 confirmedAt 重写，且 awarded 重放只比较账本而未比较任务；
  重建后的 PUBLISHED_CLEANUP 与 starAwardState=pending 缺少 GET 无副作用覆盖。
  已分别在 pending 恢复及 awarded 重放前推进时钟、使用不同反馈并核对首次审计/完整任务记录；
  两类 pending 状态增加 GET 公开投影及任务/提供方完整快照不变断言。
  `/tmp/lms-t1-snapshot-review-fixes.json`、`.log`：11 通过、32 按名称筛选未执行，退出码 0，8.536 秒。
  这两项为测试保护修订，不修改运行时逻辑；等待用户复审，不自行关闭。

最终验证与自审（2026-10-22）：

- 全部测试修订后重新执行上述关联命令：`/tmp/lms-t1-snapshot-final-focused.json`、`.log`，
  5/5 套件、133/133 用例，零失败/跳过，退出码 0，35.836 秒。
- `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-snapshot-final-family.json`：
  108/108 套件、2078/2078 用例，零失败/跳过，退出码 0，282.094 秒；
  日志 `/tmp/lms-t1-snapshot-final-family.log`。全量进程启动早于最后的测试补强，
  但本批套件实际开始于 15:49:10.278 UTC，晚于测试文件最终修改时间 15:47:27.403 UTC；
  本套件 43/43 通过，之后没有再次修改测试或运行时代码。最终关联验证另在全部修改后重新运行。
- 与第二十二批 `/tmp/lms-t1-journal-final-family.json` 按用例名及重复次数比较：
  原 2067 个全部保留，新增 11，无移除；只规范化既有动态标题中的 UUID/日期，不忽略重复用例。
- 自审复核 BSON 重建前后的原生记录/索引、租约截止点、持久映射缺失阻断、完整引用与精确旧代次、
  历史终态重放及共管账本审计。两项 P2 已补齐测试保护，未发现新的可确认问题；
  本轮没有执行变异实验，不将通过结果描述为变异验证。第二十三批及两项 P2 仍等待用户复审。
- 文档门禁、测试文件语法及 `git diff --check` 通过；关联回归包含两套生产隔离测试。
  homework/resource server 与 Gateway 无本批差异；只修改测试和四份文档，无运行时变更、数据迁移、
  真实数据库访问、提交、推送或部署。撤回本批测试和文档即可回滚。
- 历史 `/tmp/lms-t1-star-http-family.json`、`.log` 及 `/tmp/lms-t1-material-replay-family.json`、`.log`
  继续保留。socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 仍 OPEN；
  本轮全绿不构成根因关闭证据。T1 IN_PROGRESS，全量稳定性门禁不关闭，生产接入仍需单独确认。

第二十三批复审关闭（2026-10-23）：用户批准关闭本批及两项 P2 测试保护缺口。
复审六套件 166/166，零失败/跳过，退出码 0，约 32 秒；`/tmp/lms-t1-snapshot-rereview.json`、`.log`。
文档门禁和 diff 检查通过；核实上一轮全量 108/108 套件、2078/2078 报告，复审未重跑全量或变异。
本次关闭不包含真实备份恢复、生产接入、T1、三项稳定性问题或全量稳定性门禁。

### 18.27 第二十四批：BSON 重建后的隐私删除凭证与保留清理恢复

状态：用户复审通过，第二十四批关闭；不接入生产，T1 IN_PROGRESS。

分批裁定：复用第二十三批三服务独立 HTTP 和 BSON 辅助函数，补齐隐私删除与完成恢复、保留清理
的组合验收。只重建删除后的合成数据库记录，日志和媒体留在临时目录；不恢复删除前旧快照，
不新增日志重放或生产恢复工具，不据此关闭旧快照防复活、真实备份恢复或 T8。
计划覆盖 PREPARED 整组中止、COMMITTED 精确删除凭证清理前后恢复、日志及文件删除失败重试、
首次删除审计、保留期限与错误代次/缺失凭证拒绝。仅改测试和文档，回滚不涉及真实数据。
生产接入需单独确认；socket hang up、两项偶发 401 和全量稳定性门禁继续 OPEN。

实施与阶段验证（2026-10-23，Node v22.23.3）：

- 三服务测试增加显式注入的隐私路由、临时媒体 store、真实删除 journal 和清理服务；每次 BSON
  重建均重新创建这些服务。临时目录只存合成内容，测试结束清理；生产入口没有改动。
- 新增 8 例：COMMITTED 删除丢响应在清理前/后恢复（2）、PREPARED 整组中止清理前/后（2）、
  清理后缺失/错误代次凭证阻断及修复后接续（2）、日志/文件删除失败后重建重试（2）。
  覆盖 30 天前 1 毫秒不清理及恰好到期清理、首次删除审计、原映射、真实账本幂等与 GET 无副作用。
- 首轮 `/tmp/lms-t1-privacy-snapshot-focused.json`、`.log`：测试辅助函数缺少结束括号导致解析失败，
  0 用例执行，退出码 1，0.882 秒；不是运行时功能失败或有效负向验证。修正语法，并按 store 现有
  契约以 RESOURCE_NOT_FOUND 验证正文缺失，不将其误写为底层 ENOENT。
- `/tmp/lms-t1-privacy-snapshot-focused-v2.json`、`.log`：8 通过，43 按名称筛选未执行，
  退出码 0，7.935 秒。完整关联回归、独立审查与最终自审另记，不以此阶段结果关闭门禁。
- 关联命令 `npm run test:family-regression -- --runTestsByPath`：homework 的
  `services/growthTaskCompletionThreeServiceHttp`、`services/growthTaskCompletionPrivacyHttp`、
  `services/growthTaskCompletionIsolation`，resource 的 `completionMediaPrivacy`、`mediaDeletionJournal`、
  `completionProtocolIsolation`（均为各自 `__tests__` 下的 `.test.js`）。
  `/tmp/lms-t1-privacy-snapshot-associated.json`、`.log`：6/6 套件、142/142 用例，零失败/跳过，
  退出码 0，31.953 秒。
- 自查再补强 COMMITTED 恢复后的完整媒体 ID/绑定代次，以及清理前 deleted/released、
  清理后正文和元数据均缺失的断言，避免只凭版本号或成功响应判断恢复完成。
  此补强晚于上述关联回归，最终验证另行执行；本轮未修改运行时逻辑。
- 独立只读审查已核对最新测试、fixture、对应实现及四份文档，未发现本批范围内可操作的 P1/P2。
  审查另执行测试文件语法检查通过，未单独运行 Jest；运行结果以下述主线程最终验证为准。
  自审确认异常凭证测试确实破坏 BSON 持久记录，失败期间不清锁、不发星，恢复原凭证后可继续；
  生产 server/Gateway 无本批修改。未执行变异实验，不把合成记录重建扩张为真实恢复保证。

最终验证（2026-10-23）：

- 最终版本重新执行上述六套件关联命令：`/tmp/lms-t1-privacy-snapshot-final-associated.json`、`.log`，
  6/6 套件、142/142 用例，零失败/跳过，退出码 0，31.790 秒，含 9 项生产隔离用例。
- 全部测试修订后执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-privacy-snapshot-final-family.json`：
  108/108 套件、2086/2086 用例，零失败/跳过，退出码 0，292.612 秒；
  日志 `/tmp/lms-t1-privacy-snapshot-final-family.log`。其中三服务套件 51/51 通过，原 43 保留、新增 8。
- 与第二十三批 `/tmp/lms-t1-snapshot-final-family.json` 按套件、用例名和重复次数比较：
  原 2078 个全部保留，无移除，新增恰为上述 8 个 BSON privacy 用例。只规范化既有三个动态标题组
  中的 UUID/日期，不忽略用例重复次数；比较退出码 0。
- 历史 `/tmp/lms-t1-star-http-family.json`、`.log` 及 `/tmp/lms-t1-material-replay-family.json`、`.log`
  均保留，并核实报告各有一项 socket hang up 失败。socket hang up、STAB-T1-MEDIA-401、
  STAB-T1-GROWTHLOGS-401 仍 OPEN，本轮全绿不证明根因已修复；T1 和全量稳定性门禁不关闭。
- 本批仅修改一个测试文件及四份文档，无生产运行时代码修改、数据迁移、提交、推送或部署。
  测试只访问临时副本集与临时合成文件；撤回本批测试和文档即可回滚。生产接入仍需单独确认。
- 文档门禁、测试文件语法、`git diff --check` 均通过；自审及独立审查未发现新的可确认问题。
  第二十四批等待用户复审，不自行关闭本批评审或上述长期验收项。

第二十四批复审关闭（2026-10-23）：用户批准关闭本批。复审六套件 142/142，零失败/跳过，
退出码 0，39.094 秒；`/tmp/lms-t1-privacy-snapshot-rereview.json`、`.log`。文档门禁及 diff 检查通过。
复审核实上一轮全量 108/108 套件、2086/2086 报告，未重新执行全量或变异。
本次关闭不包含生产接入、旧快照防复活、T1、三项稳定性问题或全量稳定性门禁。

### 18.28 第二十五批：保留清理数据库回滚与提交未知后的重建恢复

状态：用户复审通过并批准关闭本批及恢复前媒体基线 P2；最终全量有 socket hang up 失败，不接入生产，T1 IN_PROGRESS。

分批裁定：落实 TC-SL-PRIVACY-004 清理失败可重试的三服务恢复子项。第二十四批只注入日志和
文件删除失败；本批针对实际正文移除之后，元数据事务回滚或提交成功但确认丢失，分别组合
PREPARED 删除后的 ABORTED 和 COMMITTED 精确凭证路径。只在临时副本集注入事务故障并重建
删除后的 BSON；不操作真实数据，不恢复删除前旧快照，不新增恢复工具或生产路由。
验证正文缺失但证据保留、事务整体性、重复删除的幂等行为、原映射与首次审计、最终完成/失败及发星。
回滚仅撤回本批测试和文档；socket hang up、两项偶发 401 和全量稳定性门禁仍 OPEN。

实施与阶段验证（2026-10-23，Node v22.23.3）：

- 三服务测试工厂增加仅用于清理的事务包装：inspect 结果不注入故障，元数据删除回调返回 true
  后记录事务内剩余 deleted 资产/released 引用数量；rollback 在该真实事务提交前抛错，lost-ack
  仅在事务提交成功后抛错。测试要求故障被消耗、事务内删除已经发生；不修改运行时事务执行器。
- 新增 4 例 PREPARED/COMMITTED × rollback/lost-ack，检查物理删除成功后正文不可读，回滚时
  元数据整组保留、提交未知时整组已删；墓碑/精确凭证/原 operation/本地 pending 不变。
  BSON 重建后由另一家长重放删除仍保留首次审计，回滚重试的文件删除返回 false（已不存在），
  提交未知重试不再次执行物理删除。另一媒体的完整元数据与正文保持不变。
- 最终完成恢复仍只查询原映射：COMMITTED 正常完成且仅一笔星星，ABORTED 重放固定失败且不发星；
  再次重建后完整任务/提供方快照与公开重放响应不变。GET 前后也核对任务及提供方快照。
- `/tmp/lms-t1-cleanup-commit-focused.json`、`.log`：4 通过、51 按名称筛选未执行，退出码 0，
  6.952 秒。本批为既有协议的组合验收补齐，未修复或改写运行时逻辑；不是运行时红绿修复证据。
- 关联命令 `npm run test:family-regression -- --runTestsByPath`：homework 的
  `services/growthTaskCompletionThreeServiceHttp`、`services/growthTaskCompletionPrivacyHttp`、
  `services/growthTaskCompletionMediaService`、`services/growthTaskCompletionIsolation`，resource 的
  `completionMediaPrivacy`、`mediaDeletionJournal`、`completionProtocolIsolation`（均为各自 `__tests__` 下的 `.test.js`）。
  `/tmp/lms-t1-cleanup-commit-associated.json`、`.log`：7/7 套件、162/162 用例，零失败/跳过，
  退出码 0，35.733 秒。最终全量及独立审查结果另记，不以阶段通过关闭稳定性总门禁。
- 独立只读审查发现一项 P2：原断言在首次完成恢复后才保存 provider 快照，可能将恢复过程中
  错误改写的媒体状态固化为基线。已改为首次恢复前固定 Asset/Reference 基线，首次恢复及最终
  重放后都比较该基线，并确认已删正文不可读、另一媒体正文仍与原字节一致。四个组合均执行。
  审查未发现故障注入位置、fixture 串扰或运行时缺陷；此项仅补强测试，待用户复审，不自行关闭。
- `/tmp/lms-t1-cleanup-commit-review-fix.json`、`.log`：补强后 4 通过，51 按名称筛选未执行，
  退出码 0，6.229 秒。未执行变异实验；该结果只证明补强后的组合用例实际通过。
- 第一轮全量 `/tmp/lms-t1-cleanup-commit-final-family.json`、`.log`：108/108 套件、2090/2090 用例，
  零失败/跳过，退出码 0，293.091 秒。但该轮三服务套件在 P2 断言补强前已执行，仅作为阶段证据；
  最终版本全量另行运行并保留独立报告，不将此报告作为补强后的完整验证。

最终验证与自审（2026-10-23）：

- 全部测试修订后重新执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-cleanup-commit-final-family-v2.json`：
  107 通过/1 失败套件，2089 通过/1 失败用例，共 108 套件/2090 用例，零跳过，退出码 1，290.006 秒。
  日志 `/tmp/lms-t1-cleanup-commit-final-family-v2.log`。唯一失败为 progress-service
  `knowledgePoints.test.js` 的 `TC-T5-POINT-006 denies cross-family and sibling access`，错误 `socket hang up`。
  该测试及 knowledgePoints 路由无工作区差异；与既有 socket hang up 同类但不是同一用例，根因仍未定位，
  不把它推断为已排除回归，也不以阶段全绿覆盖最终失败。本次未为变绿再次重跑。
- 最终全量报告中上述关联 7 套件全部通过，共 162/162；三服务套件 55/55（原 51、新增 4），
  包含 P2 补强后的全部四个组合；9 项生产隔离用例通过。
- 与第二十四批 `/tmp/lms-t1-privacy-snapshot-final-family.json` 按套件、用例名和重复次数比较，
  原 2086 全部保留，新增 4，无移除；只规范化既有三个动态标题组的 UUID/日期，不忽略重复次数。
- 修订后自审确认媒体基线建立于首次完成恢复之前，两次恢复/重放后均检查完整 Asset/Reference
  与正文状态；未发现新的可确认实现问题。P2 已补强，但由用户复审关闭，本批不自行关闭。
  文档门禁、测试文件语法及 `git diff --check` 通过；未执行变异实验。
- 旧 `/tmp/lms-t1-star-http-family.json`、`.log` 和 `/tmp/lms-t1-material-replay-family.json`、`.log`
  保留，本次最终失败报告追加保留。socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401
  均 OPEN，T1 IN_PROGRESS，全量稳定性门禁不关闭，生产接入仍需单独确认。
- 仅修改一个测试文件及四份文档；无生产运行时变更、真实数据操作、迁移、提交、推送或部署。
  回滚仅撤回本批测试和文档；不影响已有删除记录或真实媒体。

第二十五批复审关闭（2026-10-23）：用户复审通过并批准进入下一步。复审重新执行关联七套件，
162/162 用例通过、零跳过、退出码 0，41.125 秒；报告 `/tmp/lms-t1-cleanup-commit-rereview.json`、`.log`。
确认恢复前媒体基线 P2 保护有效，未发现新增可确认 P1/P2。关闭的是本批评审及该测试缺口，
不是全量稳定性门禁；保留最终全量 v2 的 TC-T5-POINT-006 socket hang up 失败与两项偶发 401。

### 18.29 第二十六批：清理失败后先恢复业务、再清理的交错验证

状态：用户复审通过并批准关闭本批及持久作品集合/精确绑定代次 P2 测试保护缺口；生产不接入，T1 IN_PROGRESS，全量稳定性门禁 OPEN。

分批裁定：补齐 TC-SL-PRIVACY-003/004 的交错顺序。第二十五批先重试清理再恢复完成，本批
在正文已删除、元数据 rollback/lost-ack 后，先重建并恢复 PREPARED/COMMITTED 对应本地命令，
再重试清理。使用原映射和精确凭证，不新增 API、后台任务或真实数据恢复工具。
验证恢复前媒体基线、首次删除/确认审计、账本幂等及后续清理不改教学状态；只使用临时数据。
回滚仅撤回本批测试和文档；稳定性历史证据保留，不授权生产路由接入。

实施与阶段验证（2026-10-23）：

- 复用三服务独立 HTTP、真实临时媒体/日志和清理事务故障工厂，新增四种顺序组合，
  不新增 mock 成功结果或运行时补丁。故障后先重建，明确检查回滚仍保留元数据、提交未知已移除元数据。
- 在首次完成恢复前固定完整 Asset/Reference 基线；真实 status 请求校验原 remoteOperationId、
  commandHash 和完整引用集合。恢复不得重绑或改写媒体，已删正文不可读、另一媒体原字节不变。
- COMMITTED 恢复后由共管家长确认，断言首次确认人/时间/反馈以及一笔真实账本；ABORTED
  固定失败、确认拒绝且零发星调用。之后重复 DELETE 和清理重试逐段比较完整任务、本地命令、
  远程终态、墓碑/凭证、日志及账本。再次重建后由另一家长重放确认，时钟和反馈均改变，审计仍不变。
- 聚焦命令 `npm run test:family-regression -- --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionThreeServiceHttp.test.js --testNamePattern='BSON recovery before cleanup retry'`：
  4 通过、55 按名称筛选未执行，退出码 0，5.943 秒；报告 `/tmp/lms-t1-recovery-before-cleanup-focused.json`、`.log`。
  这是已有契约的组合验证，不是运行时缺陷的红绿修复；未执行变异实验。
- 独立只读审查发现一项 P2：COMMITTED 恢复仅验证响应集合，再把落库任务保存为 settled，
  可能接受错误的持久作品集合/绑定代次。已在首次确认前及确认后明确核对 status/version、
  完整 completionMediaIds（包括已删媒体）和全部 bindingOperationId，均必须匹配原命令及原远程映射，
  再建立后续清理的业务基线。无需修改运行时实现；最终验证完成，等待用户复审关闭。
- 首轮全量 `/tmp/lms-t1-recovery-before-cleanup-family.json`、`.log`：108/108 套件、2094/2094
  用例通过、零跳过，退出码 0，282.406 秒。由于三服务套件执行后才补强持久作品集合/代次断言，
  该报告只作为阶段证据，不代表 P2 修订后的完整验证。最终版本另存报告，历史失败不覆盖。

最终验证与自审（2026-10-23，Node v22.23.3）：

- 全部修订完成后执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-recovery-before-cleanup-final-family.json`：
  108/108 套件、2094/2094 用例通过，零失败/跳过，退出码 0，277.136 秒。
  日志 `/tmp/lms-t1-recovery-before-cleanup-final-family.log`，不覆盖阶段报告或历史失败报告。
- 最终报告中的关联七套件共 166/166：三服务 59、隐私 HTTP 29、完成媒体恢复 16、resource 隐私 34、
  删除日志 19、homework 隔离 2、resource 隔离 7；新增四例及九项生产隔离均通过。
- 与第二十五批最终 v2 报告按套件/用例名/重复次数比较，原 2090 全部保留，新增四例，无移除。
  对照原始标题仅三个既有动态标题组的 UUID/日期变化，规范化后比较，不忽略重复次数。
- P2 修订后自审确认：建立 settled 基线前，首次确认前后均核对落库完整作品集合和原精确绑定代次；
  后续清理/重建/重放比较完整任务与命令，首次确认时间、家长及反馈不得被改写。
  恢复前媒体基线、删除凭证/日志和真实账本持续受保护，未发现新的可确认运行时问题。
  未执行变异实验，不声称本批四例单独覆盖所有凭证负向拒绝路径；既有缺失/错代凭证用例随全量通过。
- 文档门禁、测试文件语法和 `git diff --check` 通过。本轮仅一个测试文件和四份文档变更，
  不修改生产运行时、路由或 Gateway，不操作真实数据，不提交、推送或部署。
- 第二十五批 `/tmp/lms-t1-cleanup-commit-final-family-v2.json`、`.log` 中 TC-T5-POINT-006 的
  socket hang up 失败，以及更早 star-http/material-replay 失败证据仍保留；本轮通过不证明根因消除。
  socket hang up、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401 继续 OPEN；T1 IN_PROGRESS，
  全量稳定性门禁不关闭，生产路由接入仍需单独确认。本批及新发现的 P2 测试保护修订等待用户复审。

第二十六批复审关闭（2026-10-23）：用户批准关闭本批及持久作品集合/精确绑定代次 P2 测试保护缺口。
复审重新运行关联七套件，166/166 用例通过、零失败/跳过、退出码 0，37.478 秒；
报告 `/tmp/lms-t1-recovery-before-cleanup-rereview.json`、`.log`。确认首次确认前后均校验落库
完整作品集合和原绑定代次，之后才建立业务基线；未发现新增可确认 P1/P2。
复审未重跑全量，前述 108/108 套件、2094/2094 是实施阶段最终版本的既有全量证据。
本次仅关闭该批评审及该测试缺口，不关闭 T1 或全量稳定性门禁；socket hang up 失败证据和
两项偶发 401 保留，生产接入仍需单独确认。批准不包含提交、推送、部署或真实数据操作。

### 18.30 T1 验收清单归并

状态：文档归并完成；T1 IN_PROGRESS，全量稳定性门禁 OPEN。不属于新增功能批次或生产接入批准。

2026-10-23 按用户要求，将原 35 个未勾选条目（7 条历史汇总/门禁、28 条原始要求）逐项映射到
[T1 验收归并表](./family-self-directed-learning-t1-acceptance-reconciliation.md) A01–A35。
独立服务/client/HTTP 工厂已有实现和测试，正式 homework/resource server 仍装配旧依赖；
二者不能混同。第十批整体门禁、历史 socket hang up 失败及两项偶发 401 不因归并关闭。

归并后只按 R1 稳定性、R2 启用条件、R3 正式装配、R4 正式入口验收四个工作包排期。
额外明确两项原契约证据待补：G1 活动 A 下异 actor B 同 UUID 拒绝再接续；G2 abort 已提交后
丢 HTTP 响应的本地恢复。已有分段证据，但未定位完整组合；不认定为运行时缺陷，不自动新增实现批次，
可先补等价证据链接，确有缺口才最小补测。T2/T7 前端与完整闭环、T8 真实备份/部署不提前并入 T1。

本次仅文档整理，未重跑业务测试。核对既有最终全量 108/108 套件、2094/2094 用例及
第二十六批复审 7/7 套件、166/166 用例报告；历史 v2 的 1 项 socket hang up 失败仍保留。
本机 `/tmp` 报告不是永久发布归档，R4 关闭前须保存版本和持久报告位置。
验收归并表的 A01–A35 数量/顺序、原 35 条保留（7+28）及四项当前入口均校验通过；
本次四份文档共 100 个本地文件链接存在性、显式 T1 锚点及 Markdown 围栏校验通过。
`node scripts/check-family-docs.js` 与 `git diff --check` 均退出码 0；未将普通标题锚点检查或业务回归冒充为本次已执行验证。
未修改代码、启用路由、操作真实数据或执行提交/推送/部署。

### 18.31 R1 稳定性收口

状态：CLOSED（2026-10-23 用户复审通过）；R1 及监听失败清理 P2 关闭。T1 IN_PROGRESS，总门禁仍 OPEN。
本节不覆盖历史失败或追认生产接入。只改测试传输和证据，不改鉴权、业务路由、数据库或真实密钥。

**定位与证据边界**

- 四个历史失败套件（growthTasks、knowledgePoints、growthLogs、familyMedia）都使用
  `request(expressApp)`：Supertest 7.1.0 隐式 `listen(0)`，却用 `127.0.0.1` 作为客户端目的地址。
  在本机 macOS 上，IPv6 通配监听能与 IPv4 回环监听占同一端口；客户端可能进入另一个服务。
- 已在 Node v22.23.3 / darwin arm64 原生环境复现：合成 IPv4 服务与默认通配监听同端口，
  前者返回 401 或销毁连接时，旧方式分别收到 401、`ECONNRESET: socket hang up`；两次目标应用请求计数均为 0。
  修复后两次目标计数均为 1、响应 200，另一服务计数不再增加。
  `/tmp/lms-t1-r1-native-bind-probe.json` 保存脱敏探针结果，退出码 0。
- 历史 growthLogs/media 的失败响应没有目标应用的相应请求/鉴权失败日志，符合串线机制；但旧报告没有
  响应体、目标地址或错误码，**不能倒推出每一次历史失败均由同一个外部进程导致**。
  本次确认并消除了相关套件的地址族错配路径，不虚构旧 401 是签名、nonce 或过期错误。
- 核对 Superagent 9.0.2 默认 `agent: false`，未将问题误判为 keep-alive，也未增加请求重试、延长租约或放宽鉴权。

**最小修复与保护**

- 新增[测试 HTTP 生命周期工具](../../backend/common/test/httpTestHarness.js)：显式绑定 `127.0.0.1`，
  等待 listening 后交给原 Supertest；同一测试内同一 app 共享监听器，app 变体分别管理，`afterEach` 关闭。
  没有替换全局 http、mock 鉴权或修改生产启动逻辑。
- 首先适配四个已失败套件；阶段全量又在 authLogout 暴露相同症状后，扩展至当前家庭回归全部
  36 个原本直接使用 Supertest 隐式监听的套件。其余显式 HTTP 监听保持不变，未扩展到 legacy-only 集合。
  使用 AST 定位请求调用并增加 await/必要的 async，未删改业务、权限、并发及审计预期；
  knowledgePointHistory 的辅助函数返回 Promise 后，原链式 `.expect(status)` 改为响应 status 断言。
  growthLogs TC-T5-LOG-003 和
  media TC-T6-MEDIA-008 同时断言 status/error.code，失败时只显示脱敏分类，不输出 Token、正文或身份信封。
- [9 项传输回归](../../backend/common/test/__tests__/httpTestHarness.test.js)覆盖：显式回环、两个串线负例及修复对照、
  并发单监听/关闭再建、真实 401 原样返回/真实断连向上传播且仅请求一次、多个 app 清理、监听失败与缓存释放。
  跨平台串线夹具显式 `ipv6Only: true` 以稳定复现地址族隔离；本机原生探针不设置该选项。
- 红灯 `/tmp/lms-t1-r1-transport-red.json`：1 失败、2 通过，退出码 1；旧监听收到的本地地址
  为 `::ffff:127.0.0.1` 而非 `127.0.0.1`。绿灯 `/tmp/lms-t1-r1-transport-green.json`：8/8，退出码 0。
- 首轮定向 `/tmp/lms-t1-r1-focused.json`：5/5 套件、99/99 用例，零跳过，退出码 0，20.278 秒。
- 阶段全量 `/tmp/lms-t1-r1-family-1.json`：108 通过/1 失败套件、2102 通过/1 失败用例，
  退出码 1，308.85 秒；失败为 authLogout 的 `returns 204 with no body for an authenticated student`
  报 `socket hang up`。这是从四套件修复扩展到 36 套件的依据，报告保留，不以随后全绿覆盖它。
  该轮与工具 P2 修订有时间交叠，因此不是最终冻结版本证据。
- 独立复审发现工具 P2：`close()` 在某个待启动 app 失败时因 `Promise.all` 提前拒绝，漏关其他已启动 app。
  已增加启动失败与关闭重叠的回归，Node 22 独立探针和 Jest 均先红灯确认；
  `/tmp/lms-t1-r1-cleanup-jest-red.json` 为 1 失败/8 通过、退出码 1。
  改为两阶段 `Promise.allSettled`，所有成功监听都关闭后才传播错误；
  `/tmp/lms-t1-r1-transport-final.json` 为 9/9、退出码 0。没有吞掉启动失败或自动重试。
- 扩展适配时曾将 `close` 误解构为 `closeHttp`，阶段全量 `/tmp/lms-t1-r1-family-2.json` 有
  2 个套件初始化失败、107 个通过，已执行的 2065 个用例通过，退出码 1，291.06 秒。
  该轮不是完整通过，也不是冻结版本验证；32 处已统一为 `close: closeHttp`，没有删除失败套件。
  修订后 authLogout、knowledgePointHistory 和工具定向 `/tmp/lms-t1-r1-adaptation-focused.json`
  为 3/3 套件、18/18 用例、零跳过，退出码 0，10.507 秒。
- 最终验证前保存 `/tmp/lms-t1-r1-code-manifest.json`：748 个 backend JS/JSON 文件的 SHA-256，
  清单摘要 `99c8d987107e85d2e94f81339e71fc975c036431ae9443633486d6c4eeee5740`。
  两轮最终验证分别使用 family-3/family-4，并在每轮前后检查源文件未变；失败则停止，不自动重跑。
  最终报告及自审见下；不把定向通过或过程中的混合版本运行作为全量门禁关闭证据。

**验证入口与回滚**

```bash
# 使用项目验证基线 Node 22；脚本原有 --runInBand 保持不变。
npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r1-family-3.json
npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r1-family-4.json
node scripts/check-family-docs.js
git diff --check
```

计划独立执行两轮全量，不是失败后自动重试；任一轮失败都保留报告并重新定位。
基线 HEAD `79b346155abf4fefd2afdabe12c7e5a87db1448e` 加当前未提交 T0/T1 工作区，不能将报告归因于仅该提交。
测试环境：Jest 29.7.0、Supertest 7.1.0、Superagent 9.0.2、Mongoose 8.14.2、mongodb-memory-server 10.1.4。
回滚只撤回本节新增工具、相应测试适配及文档记录，不回退既有 T1 工作，也不触及真实数据。
保留 `/tmp/lms-t1-confirm-rereview-family.log`、`/tmp/lms-t1-mutation-rereview-family.log`、
`/tmp/lms-t1-material-replay-family.json`、`/tmp/lms-t1-star-http-family.json`、
`/tmp/lms-t1-cleanup-commit-final-family-v2.json` 等历史失败证据；临时报告仍需在 R4 做持久发布归档。

**冻结版本最终验证与自审**

| 验证 | 结果 | 退出码 | 耗时 |
| --- | --- | --- | --- |
| 家庭全量 family-3 | 109/109 套件、2103/2103 用例，零跳过 | 0 | 279.891 秒 |
| 家庭全量 family-4 | 109/109 套件、2103/2103 用例，零跳过 | 0 | 285.875 秒 |
| 源码清单核验及用例比对 | 748 个文件未变；两轮均保留原 2094 个用例，仅新增 9 项传输回归 | 0 | 不作性能指标 |

- 最终原始报告分别为 `/tmp/lms-t1-r1-family-3.json/.log` 和 `/tmp/lms-t1-r1-family-4.json/.log`。
  汇总 `/tmp/lms-t1-r1-final-evidence.json` 包含报告摘要、源码摘要、用例增减及生产隔离结果。
  比对只对三个已知动态标题组规范化日期/UUID：stable media refusal 的 deletedAt、
  noncanonical remote mapping 的 UUID 数组、invalid confirmation 的 operationId；不模糊匹配其他标题。
- 两轮均包含 homework/resource 正式装配隔离的 2 个套件、9 个用例全部通过；新协议仍未挂载生产路由。
- 独立复审及本地自审已检查 36 套件、309 处请求调用：监听就绪 await 不等待整次 HTTP 才发下一请求，
  发星/兑换/邀请/确认的 Promise.all 并发仍保留；未发现 Promise 后继续 `.set/.expect` 的断链，
  未引入 async/done 混用；全部 teardown 注册正确。上述清理 P2 已修复并有红绿证据，复核未发现新可行动问题。
- R1 提交关闭复审：socket hang up（包括本轮 authLogout）、STAB-T1-MEDIA-401、STAB-T1-GROWTHLOGS-401
  均已有统一传输修复及回归证据，但保留历史原因的可观测性限制，不声称已识别旧请求实际进入的外部进程。
  R1、清理 P2 和全量稳定性门禁不自行标记为用户批准 CLOSED；R2/R3/R4 与 T1 仍未完成。
- 最终文档 Gate 与 `git diff --check` 均退出码 0；3 份文档的 55 个本地文件链接、代码围栏、
  A01–A35 行序及四项 R1–R4 待关闭边界检查通过。无提交、推送或部署。

**用户复审关闭（2026-10-23）**

- 用户批准关闭 R1 及监听失败清理 P2；上文 READY_FOR_REVIEW/未批准表述是提交复审时的历史记录。
- 复审重新核对 748 个后端文件与冻结清单完全一致、两轮报告 SHA-256 一致、原 2094 用例无丢失。
  内存反证验证旧清理逻辑漏关监听、当前逻辑正确关闭；未修改仓库进行变异测试。
- 复审新全量 `/tmp/lms-t1-r1-rereview-family.json/.log`：109/109 套件、2103/2103 用例，
  零跳过、退出码 0、286.81 秒；包含 9 个传输测试及 9 个生产隔离测试。
- 历史失败及原因可观测性限制全部保留，关闭修复不追溯删除失败事实。
  R2 进入实施，R3 接入仍需单独批准，R4/T1 总门禁保持 OPEN；临时证据的持久归档仍归 R4。

### 18.32 R2 启用条件与运维接口准备

状态：CLOSED（2026-10-23 用户复审批准，含 §18.32.1 fsync P2）。仅关闭独立运维准备，未挂载生产路由；T1 总门禁 OPEN。以下执行过程与历史待审结论保留，最终裁决见 §18.32.2。

**范围和执行裁决**

- 复用第十八至二十一批的分服务只读预检，不重新定义索引或状态机。
  新增[CLI](../../scripts/completion-operations.js)，homework/resource 各使用自己的 MONGO_URI；
  禁用 autoIndex/autoCreate，连接失败也清理连接，不导入生产 server。
- 新增[resource 运维适配](../../backend/services/resource-service/services/completionOperations.js)，
  顺序检查事务/实际索引/映射、隐私证据及完整引用，再验证存储；成功只报告 productionEnabled=false。
  cleanup 必须显式 --execute、合法 limit 和停写声明，每次重新预检，不自动重试或后台运行。
- 新增[存储检查](../../backend/services/resource-service/services/completionStorageReadiness.js)：
  预建目录、规范绝对路径、当前 UID/0700、完整可信祖先链、sticky 语义和媒体/日志互不嵌套；
  合成文件写入/fsync/硬链接/目录 fsync 探针，失败收尾只删除自身文件，不改真实日志或目录权限。
- 停写声明不是真实锁，COMPLETION_STORAGE_CONFIRMED 是人工持久挂载/备份确认而非自动证明。
  因生产接入未批准，本批不改 Compose/部署配置，不启动真实库检查或清理；挂载示例与停写步骤写入
  [运维说明](../deployment/completion-operations.md)，R3/T8 分别承担实际接入与介质/恢复验收。
- 回滚只撤回新增入口。启用前合成演练验证缺索引阻断、显式建索引、停止检查进程、精确撤回新索引；
  接收新协议写入后必须保留字段、映射、凭证和日志并先停写恢复，不允许旧 writer 继续写。

**测试与自审**

- 新增三个套件：CLI 参数/配置/脱敏/连接收尾/冷加载，存储正反例，真实副本集运维入口与清理恢复；
  resource 正式装配隔离扩展为禁止加载新增运维模块。原业务及 R1 用例不删除。
- 初始缺少模块红灯 `/tmp/lms-t1-r2-red.log`：2 套件加载失败、0 用例，退出码 1，仅证明新入口尚未实现。
- 首次定向 `/tmp/lms-t1-r2-focused.json/.log`：2 通过/1 失败套件，31 通过/1 失败用例，退出码 1；
  原因是 CLI test.each 数组展开误传参数，修正为单数组参数。保留报告，不作为通过证据。
- 修正后 `/tmp/lms-t1-r2-focused-v2.json/.log`：4/4 套件、42/42 用例，零跳过、退出码 0、8.117 秒。
- 自审 P2-1：只验证直属父目录不能阻止高层可写祖先被替换；补完整祖先链与可信 sticky 处理。
  `/tmp/lms-t1-r2-ancestor-red.json/.log`：1 失败/13 通过、退出码 1，旧代码错误放行可写祖先。
  修复后拒绝负向及 sticky 正向均通过。
- 自审 P2-2：原测试只覆盖首次日志发布失败，缺少删除后/部分批次恢复证据；新增两个入口级故障场景：
  正文已删且日志持久后元数据事务失败，再显式重试保留原日志；多条目第二项失败时第一项完成、后项未动，
  重试清理剩余项且不改首次删除审计。不是新建第二套恢复逻辑。
- 最终定向 `/tmp/lms-t1-r2-focused-v3.json/.log`：4/4 套件、46/46 用例，零跳过、退出码 0、11.829 秒。
  两项 P2 已修复且独立只读复核未发现新可行动问题；待本批用户复审，不自动关闭 R2。

**全量验证**

```bash
# 使用 Node 22；原 --runInBand 保持不变，不自动重试失败。
npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r2-family.json
node scripts/check-family-docs.js
git diff --check
```

冻结 `/tmp/lms-t1-r2-code-manifest.json`：756 个 backend JS/JSON 及 CLI/root package 文件，
SHA-256 摘要 `1508a1efabffa9970ba7cb21f80b751b11fc27c7833dd583b749e8988adb9422`。
基线是 HEAD `79b346155abf4fefd2afdabe12c7e5a87db1448e` 加未提交工作区，不将历史提交单独视为测试版本。
最终全量 `/tmp/lms-t1-r2-family.json/.log`：112/112 套件、2142/2142 用例，零失败/跳过，
退出码 0，343.681 秒。Node v22.23.3 / macOS，本批未执行 Linux CI、Compose 实际挂载或真实备份恢复。
报告 SHA-256：`8d601c237e652c4ea92334a2a5057234b48e872c7b933c57d251706502854c41`。

- 运行后 756 个冻结文件无修改/新增/删除；与 R1 复审基线逐项对比，原 2103 个用例无丢失，仅新增 39 个 R2 用例。
  比对沿用 R1 的三个动态标题组规范化，不泛化其他标题；汇总为 `/tmp/lms-t1-r2-final-evidence.json`。
- homework/resource 正式装配隔离 2 套件、9 用例全部通过；没有新增生产监听、生产挂载、真实库操作或 Git 发布。
- 文档 Gate、7 份文档的 135 个本地链接/代码围栏检查及 `git diff --check` 通过。
- 自审结论：两项 P2 已修订并通过负向/恢复测试，独立复核未发现新可行动问题；R2 提交复审，不自行 CLOSED。
  R1 及原监听失败清理 P2 按用户批准保持 CLOSED，历史失败证据完整保留，R3/R4/T1 门禁不提前关闭。

#### 18.32.1 R2 复审 P2：分阶段 fsync 回归保护

状态：CLOSED（2026-10-23 用户复审批准）；原祖先链、部分清理恢复两项 P2 和本次 fsync 测试保护 P2 均已完成复核。
以下保留修订及提交复审时记录；本次批准关闭 R2，不授权生产接入，T1 总门禁 OPEN。

- 复审发现：原 `sync` 故障注入在文件 fsync 即失败，未到达发布后及清理后目录 fsync。
  临时移除两处目录同步仍 14/14 通过，证据 `/tmp/lms-t1-r2-rereview-dir-sync-mutant.json/.log`；
  保留该漏检证据，不将它作为成功门禁。复审定向 9 套件/328 用例通过也不能替代这一负向保护。
- 本轮仅修改 [storage 测试](../../backend/services/resource-service/__tests__/completionStorageReadiness.test.js)，
  不修改运行时、CLI、清理服务或生产装配。原 14 用例完整保留，新增 12 用例：媒体/日志两根目录，
  文件、发布后目录、清理后目录三阶段，各有独立失败及同步等待场景。
- 故障只注入指定根目录的指定阶段，其他文件操作真实执行。断言错误 code/message 脱敏、
  所有打开句柄关闭一次、探针移除、既有日志内容及目录权限不变。
  等待用可释放屏障，不靠定时 sleep；未完成同步前不得返回 ready 或关闭目标句柄，
  同时校验各阶段探针数量。finally 释放屏障并等待操作收尾；删除同步调用时用 entry/completion
  竞争立即报错，避免测试挂死；缺 await 导致真实句柄提前关闭的拒绝保持被观察，不掩盖操作结果。

**负向变异证据（故意失败，不是正常回归失败）**

| 单独变异 | 通过/失败/跳过 | 退出码 | 有效保护 |
| --- | --- | --- | --- |
| 移除文件 fsync | 22/4/0 | 1 | 两根目录的文件失败与等待 |
| 仅移除发布后目录 fsync | 22/4/0 | 1 | 两根目录的发布后失败与等待 |
| 仅移除清理后目录 fsync | 22/4/0 | 1 | 两根目录的清理后失败与等待 |
| 文件 fsync 仅去掉 await | 4/2/20 | 1 | 仅选等待组，两根目录均拦截 |
| 发布后目录 fsync 仅去掉 await | 4/2/20 | 1 | 仅选等待组，两根目录均拦截 |
| 清理后目录 fsync 仅去掉 await | 4/2/20 | 1 | 仅选等待组，两根目录均拦截 |

- 使用临时 Jest transform，在加载 `completionStorageReadiness.js` 时分别移除唯一文件 sync、
  第一个或第二个 directory sync，或仅去掉对应 await；每次只改变一处，执行前断言源中调用数量。
  不改仓库运行时代码，不引入测试开关。驱动 `/tmp/lms-r2-fsync-mutations.cjs`，
  转换器 `/tmp/lms-r2-fsync-mutation-transform.cjs`；汇总 `/tmp/lms-t1-r2-fsync-mutations.json`，
  逐次报告 `/tmp/lms-t1-r2-fsync-mutant-{remove,noawait}-{file,0,1}.json/.log`。
  noawait 变异显式 `--testNamePattern='waits for'`，因此 20 项未选择；正常全量不跳过。
- 首次正常定向 `/tmp/lms-t1-r2-fsync-focused.json/.log`：1 套件/26 用例通过，零失败/跳过，退出码 0。
  最终版本定向 `/tmp/lms-t1-r2-fsync-focused-final.json/.log` 同为 26/26 通过，零失败/跳过，退出码 0。
- 历史 socket hang up、两项偶发 401、R1/R2 既往失败证据均保留，不因本轮测试修订删除或改写。

**最终全量与自审（2026-10-23）**

```bash
# Node v22.23.3 / macOS；不重试失败、不跳过用例。
npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r2-fsync-family.json
npm run docs:family:check
git diff --check
```

- 全量 `/tmp/lms-t1-r2-fsync-family.json/.log`：112/112 套件、2154/2154 用例，
  零失败/跳过，退出码 0，297.017 秒。报告 SHA-256：
  `2f223f2051824a203e7b514fc72de5589b172bc044c795b1a49682a0e9ce2f84`。
- 冻结清单 `/tmp/lms-t1-r2-fsync-code-manifest.json` 含 756 文件，其文件 SHA-256：
  `2e62559b6f52592e9762c520945f8488cac3f093a0985b525a2f5c4cec17c7ab`。
  相比上一轮源码只有本测试变化；本轮测试执行后清单无新增、删除或哈希变化。
  汇总 `/tmp/lms-t1-r2-fsync-final-evidence.json`：沿用原三个动态标题组的限定规范化，
  原 2142 用例完整保留，仅新增 12 用例；存储原 14 用例均保留。
- homework/resource 生产隔离 2 套件/9 用例通过；文档 Gate 与 diff 检查通过。
  未进行真实挂载、真实数据清理、Linux CI、断电或备份恢复演练，不用本轮合成探针替代 R3/T8 验收。
- 自审及独立只读复核未发现新增可行动问题：六种变异命中对应拒绝/等待断言，不是超时、加载错误或
  未处理拒绝导致的假阳性；等待用例失败也释放屏障、等待运行结束，生产实现没有测试专用开关。
  本 P2 修订完成并提交用户复审，不自行标记 CLOSED；R2 仍 READY_FOR_REVIEW，T1 总门禁 OPEN。
  回滚仅撤回本轮新增测试和记录，不涉及运行时或数据变更，也不回滚先前 R2 实现。

#### 18.32.2 R2 最终复审及关闭裁决

- 2026-10-23 用户明确批准关闭 R2 及本次 fsync P2；状态均为 CLOSED。
- 最终复审定向 `/tmp/lms-t1-r2-fsync-review-focused.json/.log`：5 套件/60 用例通过，零失败/跳过。
  六种变异重跑见 `/tmp/lms-t1-r2-fsync-review-mutations.json`，分别删除三处 fsync 各命中 4 项失败，
  分别删除 await 各命中 2 项等待失败；无超时、加载失败或未处理拒绝假阳性。
- 最终复审核对 756 个冻结文件与全量报告哈希一致；112 套件/2154 用例的全量证据沿用 §18.32.1，
  不将定向复审写成重新执行全量。原 2142 用例保留，原目录 fsync 漏检、socket hang up、两项偶发 401
  及其他失败报告不删除、不覆盖；临时证据持久归档仍由 R4 负责。
- R2 关闭仅表明应用启用条件和独立运维接口准备完成，不证明真实存储挂载、备份恢复或客户端已就绪。
  R1 保持 CLOSED；R3 方案待批准，R4 OPEN，T1 总门禁 OPEN。本轮仅文档变更，无 Git 发布或真实库操作。

### 18.33 R3 正式应用装配方案与批准

状态：APPROVED（2026-10-23 用户批准四步方案）。方案见 [R3 接入、兼容与回滚](../architecture/family-self-directed-learning-r3-assembly-proposal.md)。
本节保留方案编制阶段记录，当时只核查现有入口，不装配新路由、不修改运行时代码或部署配置。
获批后的第 1 步实现及验证见 §18.34；R3 整体 IN_PROGRESS，真实部署未授权。

- 拟采用显式运行模式、停写预检及失败阻断；新协议不能在错误后回退旧 writer。
- homework 统一读/完成/确认/编辑/取消归档及材料互斥；resource 按协议分流并按可信媒体归属分派删除。
- 当前旧前端缺新命令版本/UUID，必须保持升级拒绝；后端装配批准不等于真实家庭启用或 T2 客户端交付。
- 新协议写入前可撤回装配；写入后先停写，保留账本/映射/删除证据，以兼容新协议版本恢复或前进修复。
- 用户批准本方案前不开始接入；真实数据迁移、挂载、密钥和部署另批。R4-G1/G2 与 T1 总门禁不提前关闭。

### 18.34 R3 第一步：启动模式与预检门禁

状态：CLOSED（2026-10-23 用户复审批准，第 1 步及本次 P1/P2 同步关闭），R3 IN_PROGRESS / T1 OPEN。只在合成环境验证，不部署真实环境、不扩大前端范围；
旧客户端 `CLIENT_UPGRADE_REQUIRED` 契约不变。下述实现/验证是第 1 步历史快照，当时第 2–4 步未执行；
后续第 2 步记录见 §18.35。

**实现范围**

- [共享启动助手](../../backend/common/services/completionActivation.js)与两个正式 server：
  默认 legacy，显式空/非法模式拒绝；maintenance 认证后阻断任务/媒体/内部引用及签名 content，
  不执行旧 GET 恢复；enabled 要求停写声明与明确 URI，分服务检查，resource 另执行存储探针。
- 当前 enabled 在预检成功后仍返回 `COMPLETION_ASSEMBLY_NOT_READY`，不装配旧 writer、不监听。
  正式工厂直接 enabled 调用也拒绝。新 completion HTTP 业务路由未接入。
- legacy 原生只读检查新协议账本、历史终态、任务持久字段及删除凭证，发现状态或查询不确定则拒绝降级。
  不建库/集合/索引；实际连接禁用 autoIndex/autoCreate。合成索引仅由测试显式创建。
- 凭据先于连接校验，MQ/scanner 先于监听；部分连接、队列、监听失败均尝试本次资源收尾，
  外部注入资源不误关，错误固定脱敏。正式工厂拒绝不属于模型的连接，防止预检与业务错库。

**自审修订与负向证据**

1. maintenance 外层复制 locals 导致内层旧作业路由不可见新队列：改为共享 locals，真实 HTTP 验证。
   `/tmp/lms-t1-r3-startup-locals-red-v2.json/.log`：40 通过/1 失败，退出码 1，准确命中缺失 exchange。
2. homework 媒体凭据未在连接前验证：复用现有配置校验器，注入 app 也不绕过默认校验。
   `/tmp/lms-t1-r3-startup-validation-red.json/.log`：42 通过/1 失败，退出码 1。
3. 独立自审 P1，B 库预检却访问 A 库正式模型：正式工厂与默认启动路径拒绝非模型连接。
   两个真实合成库分别放入历史终态/空数据，修复前 resource 错误启动；homework 返回普通启动失败，
   而非预期的连接不匹配错误，该红版不能证明 homework 已成功监听。
   `/tmp/lms-t1-r3-startup-two-db-red-v2.json/.log`：21 通过/2 失败，退出码 1。
   修复后在 connect/listen 前拒绝，两库快照不变，两个已有连接不关闭；直接工厂同样拒绝。
4. 独立自审 P2，局部 MQ 清理失败被外层改成普通启动失败：固定 code 加入脱敏白名单，
   组合注入 createChannel 与 connection.close 失败，保留清理失败码、仍收尾数据库、不监听。
   `/tmp/lms-t1-r3-startup-review-red.json/.log`：43 通过/3 失败，退出码 1，含上述两服务工厂检查和 MQ 错误码。

初始红灯 `/tmp/lms-t1-r3-startup-red.json/.log`（26 失败），旧测试适配前
`/tmp/lms-t1-r3-startup-focused-v1.json/.log`（36 通过/5 失败）均保留。
维护 HTTP 测试初稿误把已有 server 传给 app harness，执行中断（exit 130，`startup-locals-red.log`）；
已改用显式监听 server 的 supertest。双库初稿全局 disconnect 误关 B 库导致第二例 fixture 失败
（`startup-two-db-red.json/.log`），已限定关闭 A 连接，v2 两例均为有效负向失败。
这些调试/中断证据不计作成功门禁，不覆盖历史 socket hang up、两项偶发 401 或 R1/R2 失败证据。

**验证与范围约束**

- 定向最终 `/tmp/lms-t1-r3-startup-focused-final.json/.log`：6 套件/93 用例通过，零失败/跳过，
  退出码 0，12.217 秒。包含原 homework/resource 生产隔离 2 套件/9 用例；资源侧原 7 用例仅调整
  startSession spy 到正式模型连接，不删除冷加载、凭据或协议拒绝断言。
- 前一版全量 `/tmp/lms-t1-r3-startup-family.log` 因自审修订主动中断（exit 130），不作为通过证据。
  最终全量冻结清单 `/tmp/lms-t1-r3-startup-code-manifest-final.json`：759 文件，SHA-256
  `d289ec5bc6222ba8bd5472a428aeea83d5e6cbb6972c145950a12975475b7201`。
- 最终全量 `/tmp/lms-t1-r3-startup-family-final.json/.log`：114/114 套件、2223/2223 用例，
  零失败/跳过，退出码 0，316.692 秒。报告 SHA-256：
  `09744614e503fa23f59e79cf78dd6229afaa47af8ea5c2d5af90a3a97073f2d1`。
  `/tmp/lms-t1-r3-startup-final-evidence.json` 比对 R2 fsync 全量，原 2154 用例完整保留，新增 69 用例；
  只沿用前述三组动态 UUID/时间标题的限定规范化，不泛化其他标题。759 个冻结文件执行后无变化；
  相对 R2 仅 5 个既有代码/测试文件变化、新增启动助手及 2 个测试文件。
- 执行环境 Node v22.23.3 / macOS；最终命令（无失败重试或用例跳过）：

  ```bash
  npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r3-startup-family-final.json
  npm run docs:family:check
  git diff --check
  ```

  文档 Gate、7 份相关文档的 140 个本地链接/代码围栏及 diff 检查通过。历史证据仍保留，
  `/tmp` 报告持久归档仍归 R4；本次不代表 Linux CI、真实介质、断电或备份恢复验收。
- 独立只读复核确认 P1 连接身份与 P2 MQ 清理码的实现/测试覆盖已闭环，未发现新可行动代码问题；
  其复核未重新执行测试，执行结果以本节定向及最终全量报告为准。
- 回滚仅涉及本批启动助手/server/测试和记录；若已有新协议状态，必须保留门禁和账本/凭证，
  不回退旧 writer。无真实库迁移、存储挂载、部署、前端改动或 Git 发布。
- R1/R2 及获批 P2 保持 CLOSED；本批自审修订提交用户复审，不自行关闭 R3/R4/T1。

#### 18.34.1 第一步最终复审及关闭裁决

- 用户已批准关闭 R3 第一步、正式模型连接一致性 P1 和局部 MQ 清理错误码 P2；上文待审表述为历史记录。
- 复审 `/tmp/lms-t1-r3-startup-review-focused.json/.log`：9 套件/185 用例通过，零失败/跳过，23.702 秒。
- `/tmp/lms-t1-r3-startup-review-mutations.json`：临时移除连接检查、仅移除启动提前检查、移除清理码白名单，
  分别触发 4、2、1 项对应失败；无加载失败或超时假阳性，源码没有改变。
- 759 个冻结文件及全量报告哈希复核一致；沿用 114 套件/2223 用例全量证据，不把复审定向写成全量重跑。
- 历史失败保留；批准继续 R3 第二步 resource 正式组合与删除分派，仅合成环境验证，前端范围不扩大。
  第三、四步和 R4 未完成，真实部署未授权，T1 总门禁 OPEN。

### 18.35 R3 第二步：Resource 正式组合与删除分派

状态：实现提交复审（2026-10-23），R3 IN_PROGRESS / T1 OPEN。第 1 步及 P1/P2 已按 §18.34.1 关闭，
本节不关闭 R3 整体或 T1。仅使用 MongoMemoryReplSet、临时私有目录和显式回环 HTTP/TCP；未部署真实环境。

**实现与范围**

- [resource 正式 server](../../backend/services/resource-service/server.js)在 enabled 分支延迟装配既有 operation、
  privacy、journal 和内部协议分流器，使用同一正式模型连接/事务运行器。预检及必要的 scanner 初始化成功才监听。
  legacy 仍冷加载原路由，maintenance 仍阻断；homework enabled 继续拒绝，等待第 3 步。
- [删除分派](../../backend/services/resource-service/services/mediaDeletionDispatcher.js)先验证实时身份和家庭范围，
  在相同范围内查询 Asset/Tombstone。家长限定当前 childIds，只有 null-child avatar 例外；孩子限定本人和有效令牌代次。
  墓碑优先，完成作品只走整组隐私删除，其余合法 purpose 保持原删除；不按客户端 purpose 或错误回退。
  其他家庭、移出家庭的孩子及不存在媒体统一 404；分类数据库故障固定脱敏 503，写服务再次鉴权。
- enabled 公共 DELETE 拒绝非空 body，成功仍为 204；删除后清理、日志失败重试和丢响应重建重放保留首次审计与精确凭证。
  上传、access、签名 content、PDF purpose/下载限制、安全 profile 保留；无公开 journal/正文路径、后台清理或新前端功能。
- enabled 不接受替代 app/媒体依赖工厂；resource 自定义启动工厂在连接前拒绝，不能返回未装配应用绕过门禁。
  本批不改 complete/confirm 版本契约或 `CLIENT_UPGRADE_REQUIRED`，不把 resource 单服务可用写成完整家庭功能已启用。

**测试与自审修订**

新建 [正式组合套件](../../backend/services/resource-service/__tests__/completionProductionAssembly.test.js)，31 个用例覆盖：
正式启动、全引用集合/精确代次、PREPARED/COMMITTED 删除、旧新分流、实时权限/缺失一致响应、日志失败重试、
清理后墓碑、公开 204 丢响应后重建、首次审计、私有内容、PDF、两种安全 profile 及启动失败收尾。
legacy 隔离套件增加新分派模块的冷加载拒绝断言，不删原用例。自审及独立只读复核处理：

1. 自定义启动工厂可绕过 enabled 正式组合：新增拒绝且工厂不得调用的用例；修复前实际监听，现于连接前阻断。
2. 父母分类只查 familyId，移出家庭孩子的现存媒体/清理后墓碑呈 403，而缺失 ID 为 404：补实时 childIds 过滤；
   真实保留媒体、清理后墓碑、不存在 ID 三类统一 404 且无写入，另保留 null-child avatar 成功用例。
3. 最初缺 secure-production 正式组合证据：补真实启动 PING、clean 上传扫描审计、FOUND/不可用拒绝且无元数据/正文残留，
   PING 失败不监听并关闭本次拥有的连接。使用回环 TCP 协议桩，不宣称真实 ClamAV 或低配置性能已验收。
4. TCP 桩最初把单次 data 当完整请求：改为累计 NUL 命令、完整 INSTREAM 长度帧至零帧后只回复一次，处理 socket error；
   逐字节 PING/INSTREAM 两例要求最后一字节前无回复/无完成记录，后续重复数据不重复回复。
   各扫描成功/失败路径另断言实际到达的请求序列，避免前置失败假阳性。

保留真实红灯和调试记录，不将 fixture 故障写成有效负向保护：

- `resource-red.json/.log` 与 `resource-focused-v1.json/.log`（下同完整前缀 `/tmp/lms-t1-r3-`）因 ConfigManager
  缺测试 MONGO_URI 在加载阶段失败、0 用例，不是有效红灯。补合成配置后，保留第 1 步 enabled 拒绝运行
  `resource-red-v2.json/.log`：15 用例均按装配未就绪失败，退出码 1；这是激活门禁红灯，不声称全部代码先写测试。
- `resource-expanded-red.json/.log`：23 通过/2 失败；一项为工厂绕过，另一项 PDF fixture 默认 object-stream 被既有解析器拒绝。
  PDF fixture 改为既有测试采用的非 object-stream 编码，未放宽生产解析器。
- `resource-scope-red.json/.log`：26 通过/3 失败，新增移出孩子的 403/403/404 命中范围缺陷；另两项为上述工厂/PDF。
- 修订后 `resource-focused-v3.json/.log`：6 套件/118 用例，退出码 0，18.061 秒。
  TCP 分包补强后 `resource-focused-final.json/.log`：1 套件/31 用例，退出码 0，7.336 秒，均零失败/跳过。
- 独立只读复核确认以上修订与测试已闭环，未发现新的可行动问题；其未执行测试，不代替主线程全量结果。

**最终验证与门禁边界**

- 冻结 `/tmp/lms-t1-r3-resource-code-manifest.json`：761 文件，SHA-256
  `3735ca1a9bbdd057ad75a287d9da124f3ce86cbc2062a6f3c1a66210fde42fa1`。
  当前 HEAD `79b346155abf4fefd2afdabe12c7e5a87db1448e`，实现包含未提交文件，故以冻结内容哈希而非 HEAD 单独标识测试版本。
- 全量 `/tmp/lms-t1-r3-resource-family.json/.log`：115/115 套件、2254/2254 用例，零失败/跳过，
  退出码 0，341.652 秒；报告 SHA-256 `a1b4839796a427d1687cd08ea03a8b5f31ad209e8a44f27453a637b16ddd6101`。
- `/tmp/lms-t1-r3-resource-final-evidence.json` 比对第 1 步最终全量：原 2223 用例完整保留，新增 31 用例，
  仅沿用既有三组动态 UUID/时间标题的限定规范化；761 个冻结文件运行后无变化。
  相对第 1 步仅 7 个既有代码/配置/测试文件变化、新增 dispatcher 与正式组合测试；两服务原隔离 2 套件/9 用例仍通过。
- Node v22.23.3 / macOS，命令如下；本轮全量未通过失败重跑或跳过取得成功：

  ```bash
  npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r3-resource-family.json
  npm run docs:family:check
  git diff --check
  ```

  文档门禁通过；7 份相关文档的 144 个本地链接及代码围栏检查通过，diff 检查通过。
  `/tmp` 证据持久归档仍归 R4，不将本地合成测试当作 Linux CI、真实介质、断电或备份恢复验收。

历史 socket hang up、两项偶发 401、R1/R2 和第 1 步失败报告全部保留。
新丢响应测试主动制造且断言的 socket hang up 是预期故障，不是历史偶发失败的替代或删除理由。
不执行真实数据库修复/迁移、密钥变更、挂载、部署、Git 提交或推送。写入新协议状态后不得切回旧 writer，
应停写并保留账本/映射/凭证/journal，再用已验证的兼容版本恢复或前进修复；完整回滚要求仍见 R3 方案 §6。
下一步先复审本批；获批后再做第 3 步 homework 正式组合，第 4 步/R4/T2/T8 不因本批通过而关闭。

#### 18.35.1 第二步复审关闭与 P3 补强

- 2026-10-23 用户复审通过，批准关闭 R3 第二步并继续第三步；本批及非阻塞 P3 状态 CLOSED，R3 整体 IN_PROGRESS / T1 OPEN。
- 复审定向 `/tmp/lms-t1-r3-resource-review-focused.json/.log`：10 套件/190 用例通过，零失败/跳过，退出码 0，25.934 秒。
  761 个冻结文件与 §18.35 全量报告哈希一致；沿用全量证据，不把定向复跑写成全量重跑。
- `/tmp/lms-t1-r3-resource-review-mutations.json`：移除启动工厂拒绝、孩子范围、墓碑优先及加入错误后旧删除回退，
  分别触发 1、1、2、2 项失败，无加载失败假阳性；移除测试桩 replied 保护未被拦截，记录为非阻塞 P3。
- P3 已在首次响应之后、重复整包之前增加 `Buffer.alloc(4)` 输入，要求不重复响应且请求记录只保留一次。
  `/tmp/lms-t1-r3-resource-p3-mutant.json/.log`：仅在运行时移除 replied 保护后 29 通过/2 失败，退出码 1，
  两个失败均命中新增断言，非加载或超时故障。正常源码 `/tmp/lms-t1-r3-resource-p3-final.json/.log`：
  31/31 通过、零跳过，退出码 0，5.502 秒；未修改扫描器生产逻辑。
- 保留所有历史失败和前述报告；本次测试修改不冒充原冻结版本，将纳入第三步新冻结清单与全量验证。
  真实环境部署未授权，前端范围及旧客户端升级拒绝不变；第三、四步与 R4/T1 不随第二步关闭。

### 18.36 T1 R3 第三步：Homework 正式组合

**Status:** IMPLEMENTED / READY_FOR_REVIEW；第 1–2 步及对应 P1/P2/P3 CLOSED，R3 IN_PROGRESS，R4/T1 OPEN。
2026-10-23 用户批准关闭第二步、补齐 P3 并实施第三步；仅合成环境验证，不扩大前端范围、不部署真实环境。

**实现与边界**

- [homework 正式工厂](../../backend/services/homework-service/server.js)在 enabled 分支延迟装配现有完成、确认、
  只读和编辑/取消归档服务，使用正式模型所属连接的真实事务运行器、completion client 与记星 HTTP client。
  本地预检和必要 MQ 初始化完成才监听；enabled 拒绝替代 app、媒体/路由工厂，以及自定义启动工厂。
  legacy 仍冷加载旧路由，maintenance 仍仅拒绝，不通过错误回退旧 writer。
- 新[统一路由](../../backend/services/homework-service/routes/growthTaskCompletionProduction.js)严格创建，GET 使用只读投影；
  PATCH 按是否显式包含 attachmentMediaIds 分派，空数组仍走材料编排；完成/确认和 DELETE 使用既有新服务。
  不复制事务状态机，不跨服务写数据库，不增加公开恢复接口或清理调度。
- 提取最小[家长授权](../../backend/services/homework-service/services/growthTaskCompletionParentAccess.js)和显式转换/校验 helper，
  保留实时家庭/孩子归属、鉴权优先、null 语义、最终 owner/版本 CAS。材料服务开启 completionIsolation；
  材料和普通字段统一发布，pending 恢复同时匹配原有序附件集合和持久普通字段 patch，异正文 409 且零推进。
- 材料 pending 错误仅公开合法的 error.details.resourceId；POST 占位后用该任务 ID 和仅附件 PATCH 恢复，
  原修改用原完整 PATCH 恢复。GET 不恢复、不发星，不暴露内部映射、owner、摘要或未知嵌套字段。
  缺 UUID/所见版本的旧完成/确认请求仍 400 CLIENT_UPGRADE_REQUIRED，不为旧前端提供兼容 writer。

**测试与自审修订**

- 新[正式组合测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js)
  46 项：真实正式 homework/resource 工厂及真实 progress 记星路由在显式回环 HTTP 下组合；
  覆盖严格 POST、内部字段拒绝、混合 PATCH/删空、转换失败/nullable、实时权限优先、孩子写权限、
  旧客户端升级拒绝、只读全库快照、取消/归档、确认竞争、首次审计、账本幂等、媒体与记星提交后丢响应恢复。
  为有界测试共用合成副本集；跨服务命令仍实际走 HTTP，progress 不是正式工厂/Gateway 全链路证据，后者留给第四步/R4。
- 新[正式启动测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionStartup.test.js)
  使用合成副本集和真实默认 startServer，实际通过预检并监听，完成后关闭。原 legacy 冷加载断言保留并加入新模块。
  共享启动套件增加两个服务连接前拒绝自定义工厂的断言。
- 自审修复：原隔离材料恢复只比较附件 ID，相同附件但新标题可返回 200 旧结果。
  新协议模式先匹配完整原意图，异正文返回 409，测试同时要求数据库快照、媒体调用和记星调用均不变，
  随后原请求恢复成功；旧模式行为未改，既有材料最终 CAS/完整引用集合校验保留。
- 独立只读复核未发现其他可证实 P1/P2；复核覆盖正式工厂/预检、实时权限、字段分派、校验脱敏和 GET 无副作用。
  复核者未运行测试，且不替主进程宣告上述异正文修复关闭；其结论不替代本批实际红绿及全量验证。

真实红灯及调试证据均保留，以下文件均以 `/tmp/lms-t1-r3-` 为前缀：

- `homework-factory-red.json/.log`：47 通过/1 失败，homework 自定义启动工厂拒绝前已发生连接；现已连接前阻断。
  `homework-startup-red.json/.log`：默认正式工厂仍 ASSEMBLY_NOT_READY，1 项失败，是启动装配的有效红灯。
- `homework-startup-focused.json/.log`：111 通过/1 失败，测试误期望 UNAUTHENTICATED，实际稳定契约为 INVALID_IDENTITY_ENVELOPE。
  仅校正测试预期，未改身份认证；此失败不作为生产缺陷证据。
- `homework-red.json/.log`：39 通过/4 失败，其中三项记星断言的 fixture 账本查询类型有误，另一项为异正文 200。
  修正 fixture 后 `homework-business-recheck.json/.log`、`homework-pending-intent-red.json/.log` 均 42 通过/1 失败，
  唯一失败命中异正文应为 409 的断言，不是加载或超时；修复后强化零副作用断言并补两项工厂覆盖拒绝。
- `homework-intent-strengthened.json/.log`：45/45，零失败/跳过，退出码 0，7.439 秒。
  `homework-startup-final.json/.log`：4 套件/112 项，退出码 0，11.101 秒；
  `homework-material-final.json/.log`：3 套件/215 项，退出码 0，12.358 秒，原材料与旧 pending 接续用例保留。
  正式组合业务测试首次运行时装配已完成，不宣称上述全部 45 项均在实现前变红。
- 覆盖核对再补一条正式 legacy 工厂混合材料提交丢响应、无 fence 的旧 pending 接续，使用 enabled 原 PATCH 恢复。
  断言 GET 无副作用、原 operationId 复用、完整有序集合、保留/新增/移除的精确代次、普通字段共同发布。
  `homework-legacy-resume.json/.log`：46/46，零失败/跳过，退出码 0，7.713 秒；原 45 项标题和顺序均保留。

**最终验证与门禁边界**

- 首轮 `homework-family-pass1.json/.log`：117 套件/2302 项通过，退出码 0，309.922 秒。
  运行期间追加上述旧 pending 入口用例，`homework-pass1-evidence.json` 如实记录该测试文件相对冻结清单变化，
  因此首轮不能作为最终源码通过证明；保留报告及 `homework-code-manifest-pass1.json`，重新冻结后运行最终全量。
  这不是失败重跑，不删减旧用例或覆盖历史失败。
- 最终 `/tmp/lms-t1-r3-homework-code-manifest.json` 冻结 765 个代码/配置/测试文件，SHA-256
  `ea1816b1db514b06e552f362c072e15906c3d45a0c0abb4f0d0bb169cac1ab40`。
  HEAD 仍为 `79b346155abf4fefd2afdabe12c7e5a87db1448e`，未提交工作区必须用清单哈希标识，不能仅用 HEAD 证明版本。
- 最终 `/tmp/lms-t1-r3-homework-family.json/.log`：117/117 套件、2303/2303 用例，零失败/跳过，
  退出码 0，309.232 秒；报告 SHA-256 `69a0528f849b2f596da63e8ec01a58ce0a34b7218a104e705cf7f30f0aac83ca`。
- `/tmp/lms-t1-r3-homework-final-evidence.json` 对比第二步最终全量：原 2254 项完整保留，新增 49 项
  （正式组合 46、正式启动 1、两服务启动工厂拒绝 2）；仅沿用既有三组动态 UUID/时间标题规范化。
  765 个文件运行后无变化；相对第二步 12 个既有文件变化、4 个新文件，原两端隔离 2 套件/9 项仍通过。
- Node v22.23.3 / macOS；以下命令退出码均为 0：

  ```bash
  npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r3-homework-family.json
  npm run docs:family:check
  git diff --check
  ```

  文档门禁通过，7 份相关文档的 150 个本地链接与代码围栏检查通过；本批 16 个代码/测试文件语法检查通过。
  自审修订与补测已完成，未发现其他可行动 P1/P2；本批 IMPLEMENTED / READY_FOR_REVIEW，不自行批准第三步。
  `/tmp` 证据持久归档仍归 R4；不将合成副本集/HTTP/临时目录结果当作 Linux CI、真实介质或备份恢复验收。

保留历史 socket hang up、两项偶发 401、各批失败报告及第二步 P3 变异证据。
本批合成丢响应测试中主动制造的 socket hang up 为预期故障，不覆盖或删除历史偶发失败记录。
不修改 Compose/前端，不执行真实修复、迁移、密钥变更、部署、Git 提交或推送；不提前关闭第四步/R4/T1。
回滚沿用 R3 §6：无新状态可撤回代码，已有新状态必须停写并保留账本/映射/凭证/journal，禁止换回旧 writer。

#### 18.36.1 第三步复审 P2：原意图快照绑定

**Status:** FIX_IMPLEMENTED / READY_FOR_REVIEW；本次 P2 与第三步等待复审，R3 IN_PROGRESS，R4/T1 OPEN。

2026-10-23 复审发现：材料入口已校验 A 的有序附件与普通字段，但 resume 按 ID 重读可能接续并返回
另一共管家长的 B。B 仍 pending 时会被 A 推进；B 已稳定时会直接作为 A 的成功结果返回。
最终 CAS 不能修复已经换成 B 的恢复起点。用户授权本次修复，不授权关闭第三步或部署真实环境。

**修订与自审**

- [材料服务](../../backend/services/homework-service/services/growthTaskAttachmentMediaService.js)在 completionIsolation
  模式将恢复绑定到已校验快照：家庭/孩子/任务、版本、状态、operation/phase/kind、未知结果标记、
  完成版本/fence、有序公开及待绑定集合、现有及旧绑定精确代次、普通字段 patch。
  重读不一致返回既有 503 MEDIA_REFERENCE_PENDING；先比较再执行稳定返回、旧 pending 接续或远程调用。
- 自审扩展到同入口的稳定任务初次编辑：其第二次读取也必须匹配首次快照，不能接续后来出现的 B。
  原异正文 409、版本 0 旧 pending 的 CAS 接续、最终 owner/阶段/版本 CAS 和完整引用校验均保留。
  未增加 schema、持久控制字段或对外恢复接口；旧模式行为不改。
- [正式组合测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js)
  原 46 项完整保留，新增四项：A 原 pending 重试及 A 稳定编辑分别遭遇 B pending/B stable。
  仅在测试 query.exec 重读前调度真实共管 HTTP 请求，无生产测试 hook、固定 sleep 或伪造数据库行。
  断言 A 返回 503、十组集合快照不变、媒体/发星调用无增加；B pending 后还能按自己的原请求恢复。

**红绿证据**

以下文件均以 `/tmp/lms-t1-r3-homework-` 为前缀；旧报告保留，不覆盖初次交付证据。

- `review-focused.json/.log`：复审原 8 套件/259 项通过；`review-race.json/.log` 使用临时运行时调度复现
  46 通过/2 失败，应拒绝但实际返回 200。原 `review-mutations.json` 的意图/精确代次/GET 副作用保护证据继续保留。
- 永久用例先于修复加入：`snapshot-red.json/.log` 为 46 通过/2 失败，断言应为 503、实际 200，退出码 1。
  修复 pending 入口后 `snapshot-focused.json/.log` 为 4 套件/263 项通过，退出码 0。
- 稳定入口补测先于第二处修复：`snapshot-stable-red.json/.log` 为 48 通过/2 失败，同样命中 503/200 断言，退出码 1。
  两处均修复后 `snapshot-focused-final.json/.log` 为 4 套件/265 项通过，零失败/跳过，退出码 0，20.668 秒。
  包含原材料、协议分流及隔离的 215 项用例，旧 pending 接续与最终 CAS 未删减。

**冻结全量与自审验收**

- `/tmp/lms-t1-r3-homework-snapshot-code-manifest.json` 冻结 765 个文件，SHA-256
  `2810d6210962a13ceaa004eff9675383fa7b822b1865d589cf9283ed3cb9a09b`。
  `/tmp/lms-t1-r3-homework-snapshot-family.json/.log`：117/117 套件、2307/2307 项，零失败/跳过，
  退出码 0，307.458 秒；报告 SHA-256 `85c06a16607c46c35e3d24adcb4288d3c61a4877629c41bfc1575ca907b60694`。
- `/tmp/lms-t1-r3-homework-snapshot-final-evidence.json` 对比第三步初次交付：原 2303 项完整保留，
  新增恰为上述四项；765 个文件运行后无变化，相对前次冻结仅材料服务和正式组合测试两个文件变化。
  未以 HEAD 或旧 2303 项报告代替本次源码验证。
- `npm run docs:family:check`、`git diff --check` 和两份修改 JS 的语法检查均退出码 0；
  七份相关文档的 152 个本地链接与代码围栏检查通过。

- `/tmp/lms-t1-r3-homework-snapshot-mutations.json`：仅临时 Jest transform 注入变异，仓库源码不变。
  分别移除 pending 入口快照、移除稳定入口快照、将比较移动到稳定返回之后，三轮均为 48 通过/2 失败、
  Jest 退出码 1；各自命中对应两项新增断言（应为 503、实际 200），零运行时加载失败、零跳过。
  变异脚本退出码 0 表示三种退化全部被拦截，不表示变异后的实现通过。
  变异后重新核对冻结清单仍零变化；原始红灯与变异失败报告全部保留。
- 自审完成：已检查校验时点、两个入口、旧 pending 接续及后续 CAS；未发现其他可行动 P1/P2。
  本次 P2 修订 IMPLEMENTED / READY_FOR_REVIEW，不自行标记 CLOSED；本节不替代用户复审批准。
保持旧客户端升级拒绝；不改前端/Compose，不部署真实环境，不提交或推送 Git。
保留所有历史 socket hang up、两项偶发 401 及失败报告；新合成故障注入不能覆盖历史失败。
回滚继续遵守 R3 §6，不因本次局部修复解除已有新状态禁止回退旧 writer 的限制，不提前关闭 T1 总门禁。

#### 18.36.2 第三步复审 P2：空更新最终重读

**Status:** FIX_IMPLEMENTED / READY_FOR_REVIEW；本次 P2 与第三步仍待复审，R3 IN_PROGRESS，R4/T1 OPEN。

2026-10-23 对 §18.36.1 复审时，原 4 套件/265 项及三种变异均有效，但发现空更新分支仍直接
`load(task._id)` 返回：仅提交未变化的附件集合且没有普通字段 patch，另一个家长 B 可在最后一次重读前
写入新意图。B pending 和 B stable 均返回 200，后者甚至返回 B 的不同标题/附件。
没有观察到 A 额外写数据库或调用远程服务，但成功响应未绑定原意图；因此上一轮 P2 未获关闭。
用户授权本次补充修复，不授权真实环境部署或关闭 T1。

**修订与永久用例**

- [材料服务](../../backend/services/homework-service/services/growthTaskAttachmentMediaService.js)仅在 completionIsolation
  空更新分支保存已校验快照，最后一次只读加载后再次比较；消失或快照不匹配时拒绝，不返回替代意图结果。
  比较使用同一 recoverySnapshot，沿用现有 503 MEDIA_REFERENCE_PENDING/resourceId 契约。
  不调用 resume 推进新意图，不新增控制字段、schema、索引或 writer；legacy 行为及后续写入 CAS 不变。
- [正式组合测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js)
  原 50 项标题保留，复用真实 HTTP 共管交错 helper，在空更新的第四次查询（最终重读）前提交 B。
  新增 B pending/stable 两项负向用例，要求 503、十组集合快照不变、媒体/发星调用不增加；B pending 可按原请求恢复。
  另加无竞争空更新正向用例，要求 200 且数据库（含版本）和远程调用零变化；没有生产 hook 或固定等待。
- 旧 pending 版本零接续、未知结果恢复、精确代次及最终 owner/阶段/版本 CAS 均保留。
  仅更新此次设计/API/实施与运维边界说明，不扩前端，旧客户端 CLIENT_UPGRADE_REQUIRED 不变。

**评审、红绿及变异证据**

- 上轮只读复审证据 `/tmp/lms-t1-r3-homework-snapshot-review-summary.json`、`snapshot-review-noop*.json/.log`
  （完整前缀均为 `/tmp/lms-t1-r3-homework-`）继续保留；运行时探针为原 50 通过/新增 2 失败。
- 本次永久用例先于代码修复：`/tmp/lms-t1-r3-homework-noop-red.json/.log` 为 51 通过/2 失败、退出码 1，
  两项均命中应为 503、实际 200；无竞争正向用例已通过，非加载或超时导致红灯。
- 修复后 `/tmp/lms-t1-r3-homework-noop-focused.json/.log`：4 套件/268 项通过、零失败/跳过，退出码 0，21.678 秒。
  包含原材料、隔离及协议分流 215 项，未删减旧 pending 接续或最终 CAS 用例。
- `/tmp/lms-t1-r3-homework-noop-mutations.json`：临时 Jest transform 仅改变运行时源码，不修改仓库。
  移除本次空更新 guard 时 51 通过/2 失败；仅检查 B pending 时 52 通过/1 失败，准确命中 B stable。
  重放前三种变异（移除 pending 入口、移除稳定入口、延后 guard）各 51 通过/2 失败。
  五轮 Jest 均退出码 1，失败均为 503/200 的对应断言，零加载失败/零跳过；汇总脚本退出码 0 表示变异均被拦截。

**最终冻结验证与自审**

- `/tmp/lms-t1-r3-homework-noop-code-manifest.json` 冻结 765 个代码/配置/测试文件，SHA-256
  `1764e6a48a3ae9d7001bec5a4f160fdb84e446b2b9d7c5b1ac66afd4b8fdd527`。
- `/tmp/lms-t1-r3-homework-noop-family.json/.log`：117/117 套件、2310/2310 项，零失败/跳过，退出码 0，
  346.085 秒；报告 SHA-256 `6bb8418aa8ae4f68b92b20ee23221c936faefdc4546cd1ca5fdc9458b05d1ec6`。
  命令：`npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r3-homework-noop-family.json`，Node v22.23.3/macOS。
- `/tmp/lms-t1-r3-homework-noop-final-evidence.json` 核对上一轮 2307 项完整保留，新增恰为两项空更新并发负向
  和一项无竞争正向用例；765 个文件运行后无变化，相对上一轮冻结仅材料服务及正式组合测试两个文件变化。
  此前 §18.36/18.36.1 的报告保留，不冒充本次源码验证。
- `npm run docs:family:check`、`git diff --check`、两份修改 JS 的语法检查退出码均为 0；
  七份相关文档的 154 个本地链接和代码围栏检查通过。
- 自审核对了最终读取比较时点、两类交错、空更新零副作用、旧 pending 接续及其他重读出口的相邻版本/
  operation/阶段/精确代次检查；未发现其他可行动 P1/P2。本次修订 IMPLEMENTED / READY_FOR_REVIEW，
  不自行将 P2 标为 CLOSED；`/tmp` 证据持久归档仍归 R4，合成验证不替代真实环境/介质验收。

保留所有历史 socket hang up、两项偶发 401 和本次红灯/变异失败，不以合成丢响应覆盖历史偶发故障。
仅合成环境验证，不部署真实环境、不改前端/Compose、不提交或推送 Git；回滚遵守 R3 §6，已有新状态不切旧 writer。
本次修订待用户复审，不自行关闭 P2、第三步、R3/R4 或 T1 总门禁。

#### 18.36.3 第三步及空更新 P2 关闭

2026-10-23 用户复审批准关闭本次空更新 P2 及 R3 第三步，授权继续第四步。
**Status:** 第三步及 §18.36.1/18.36.2 材料快照 P2 CLOSED；R3 第四步 IN_PROGRESS，R4/T1 OPEN。
复审重跑 `/tmp/lms-t1-r3-homework-noop-review-focused.json/.log` 为 4 套件/268 项通过，退出码 0，22.285 秒。
`/tmp/lms-t1-r3-homework-noop-review-mutations.json` 五种变异有效：前四种各 51 通过/2 项预期失败，
仅检查 pending 的变异 52 通过/1 项预期失败；均为对应 503/200 断言，无加载失败/跳过。
765 个冻结文件无变化，复审核实原 117 套件/2310 项全量及哈希，未声称本轮重新执行全量。
保留 §18.36–18.36.2 的原状态、红绿报告、全部历史失败，关闭不等于真实启用或 T1 完成。

### 18.37 T1 R3 第四步：正式链路与配置准备

**Status:** IMPLEMENTED / READY_FOR_REVIEW；第三步及空更新 P2 已关闭，第四步待用户复审；R3 整体 IN_PROGRESS，R4/T1 OPEN。
执行范围：Gateway 与三服务正式工厂的 HTTP 链路、身份及内部凭据边界、维护和回滚验证、默认关闭的 Compose/env 配置。
沿用已批准 R3 §6：有新状态后禁止 legacy/旧二进制写入，保留数据库/账本/映射/凭证/journal；回滚前先停写。
裁定：本次配置准备覆盖家庭最小栈及 Ubuntu 栈；学校参考 Compose/Kubernetes 不作为新协议部署入口，保持未启用。
不创建新恢复接口或自动清理，不把 T2 客户端适配或 R4-G1/G2 纳入完成声明。

**实现与审查范围**

- [正式组合测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js)
  复用实际 Gateway、homework/resource 正式工厂，并将原裸记星 router 替换为正式 progress `createApp`。
  原 53 项完整保留，新增 12 项：创建/完成/确认/读取链路、两种旧客户端升级拒绝、JWT/孩子代次/实时家庭边界、
  内部路径不公开、媒体提交/记星提交各一次丢响应恢复、上传/签名内容/隐私删除、维护阻断、实际启动回滚、
  公开完成和确认各一次响应丢失重放。断言持久集合、精确代次、调用次数、首次审计和单条账本，不只断言 HTTP 200。
- [Gateway 边界](../../backend/gateway/identityMiddleware.js)在公开入口剥除客户端 `x-service-token`；
  [代理测试](../../backend/gateway/__tests__/proxyIdentity.integration.test.js)增加认证、普通媒体、签名 content 三条上游实收头检查。
  不新增公开内部路由，不改变 JWT 签名或服务端 client 凭据。现有冷加载测试仅显式限定 legacy，原隔离断言保留。
- 家庭/Ubuntu 两套 Compose 共用 mode/paused 环境变量，默认 legacy/false；resource storage confirmed 默认 false，
  journal 单独命名卷，不给其他服务挂载、不增加内部端口。模板和 Compose 受
  [配置测试](../../backend/common/deployment/__tests__/completionCompose.test.js)保护。
- 文档门禁原来把 Ubuntu 模板所有键当作必填密钥；本次保留密钥精确集合，显式加入三个非密钥开关并校验默认关闭值。
  六项永久负向用例在内存替换模板，分别拒绝 enabled/paused/storage 默认开启、缺控制键、缺密钥和未知键；不改工作区文件。
  另两项检查 backend/Ubuntu 模板默认值。未用跳过门禁或宽泛忽略环境键解决不匹配。
- 同步总体设计、API、装配方案、运维、计划及追踪状态。卷存在不等于存储就绪：runtime UID/0700/完整祖先链、
  独立持久介质、索引及备份仍须操作者核实；不自动创建目录、修权、建索引或真实部署。

**过程证据（不可替代最终冻结结果）**

- `/tmp/lms-t1-r3-step4-config-red.json/.log`：2 套件、5 失败/1 通过，退出码 1；三个凭据透传和两项缺配置的真实红灯。
  后续 `config-green` 为 2 套件/6 项通过；`storage-red` 保留两项缺失 storage confirmed 的预期失败。
- `chain-first` 保留 outsider 403/404 测试预期错误；`chain-green` 虽命名 green，实际因失效孩子代次预期错误而失败。
  权限实现未为测试改动：任务越权 403、孩子代次失效 401、Gateway 过期 JWT 403、媒体越权 404。
- `chain-final` 虽命名 final，实际 78 通过/2 失败：公开丢响应钩子在 mounted router 返回时用被裁剪的 `req.path`，未触发断链。
  改为进入 Gateway 前捕获 `originalUrl`；`chain-recheck.json/.log` 为 5 套件/80 项通过、零失败/跳过，退出码 0。
  两项公开丢响应测试均要求实际连接失败及 lost=true，再验证重放不写库、不增加远程调用；不是模拟错误返回。
- `/tmp/lms-t1-r3-step4-docs-red.log` 保留模板键门禁失败；修订后 `docs-green.log` 退出码 0。
  `config-final.json/.log` 为 2 套件/13 项通过，包含六个配置负向用例及原文档门禁三项，退出码 0。
  随后加强独立媒体卷和 journal 不得挂载其他服务的断言，`config-recheck.json/.log` 仍为 2 套件/13 项通过。
  本段省略前缀的路径均为 `/tmp/lms-t1-r3-step4-`，不删除或覆盖这些失败记录。
- `/tmp/lms-t1-r3-step4-compose.json`：两份 Compose × default/maintenance/enabled 六组 `config -q` 均退出码 0；
  使用合成变量、`--env-file /dev/null`，渲染配置仅在内存检查，不输出密钥。没有 up/build/pull、真实容器或真实数据操作。
- 独立只读审查未发现本轮可行动问题，核对原 53 项保留、真实提交后断链、精确代次/审计和启动回滚边界。
  文档门禁随后补充的默认值检查由作者另行核对，未宣称独立审查覆盖该后续修改。
- `/tmp/lms-t1-r3-step4-interim-family.json/.log` 为 118 套件/2335 项通过、退出码 0；运行期间补充了配置门禁检查，
  因此仅保留为过程证据，不作为冻结源码验证或第二轮稳定性证据。对应旧冻结清单另存 `interim-code-manifest.json`，
  之后重新冻结所有代码/配置/测试并重跑；不以过程全绿代替最终验证。

**最终冻结验证与自审**

- `/tmp/lms-t1-r3-step4-code-manifest.json` 冻结 771 个代码/配置/测试文件（原 765 加新配置测试、四份环境/Compose 和文档门禁脚本），
  SHA-256 `401919b873c445fdaff900ac794dbc44be8761cb364cab7a19b72dfebe20e550`。
  Git HEAD 仍为 `79b346155abf4fefd2afdabe12c7e5a87db1448e`，工作区未提交；以清单而非 HEAD 代表实际验证源码。
- Node v22.23.3/macOS 执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r3-step4-family.json`：
  **118/118 套件、2335/2335 项，零失败/跳过，退出码 0，330.39 秒**。
  `/tmp/lms-t1-r3-step4-family.json/.log` 保留原始结果，JSON SHA-256
  `d727afdf87d2e1684092dc9732d1d878eb891dc33185583c491d87734cf7b0cf`。
- `/tmp/lms-t1-r3-step4-final-evidence.json` 对比第三步最终报告：原 **2310 项完整保留**，新增恰为
  12 项正式链路、3 项 Gateway 凭据边界、10 项配置/门禁测试；771 个冻结文件运行后零变化。
  只沿用既有三个动态测试标题的 UUID/时间归一化，不忽略其他用例名称或删减断言。
- `npm run docs:family:check`、`git diff --check`、七份相关 JS 语法检查通过；相关八份文档内部路径和代码围栏检查通过。
  六组 Compose config 通过只证明配置语法和拓扑，不代表服务成功启动或真实卷合规。
- 自审结论：Gateway 原来透传客户端服务凭据的缺口已被真实上游断言捕获并修复；
  文档门禁的模板分类与默认值保护已同步，测试预期和公开丢响应钩子的错误已纠正，失败报告保留。
  复核默认关闭、完整集合/精确代次、终态重放、首次审计、只读边界及写入后禁止降级，未发现其他可行动 P1/P2。
  独立只读审查结果同样未发现本轮链路可行动问题，但不代替用户复审；不自行关闭第四步、R3 或 T1。

**验证边界及回滚**

合成 JWT 为测试直接签发；没有运行 user-service 登录流程。跨服务命令走真实回环 HTTP，但三个服务共用临时副本集，
不是物理分库/多进程部署验证。实际 startServer 演练复用模型既有连接，不能代替冷连接/所有权收尾专项用例。
无新状态时 enabled → 停止监听 → 受保护 legacy 成功；写入新状态后两服务拒绝 legacy，持久状态和日志保留。
没有通过删除协议数据绕过防降级；旧二进制仍受发布纪律限制，回滚按 R3 §6。
保留历史 socket hang up、两项偶发 401 和全部原红灯。仅合成环境，不扩大前端、不部署、不提交或推送 Git。
R3 第四步提交复审，不自行关闭 R3/R4/T1；R4-G1/G2、证据持久归档、T2 客户端和 T8 真实介质仍待后续验收。

### 18.37.1 R3 第四步复审 P2：控制键唯一性与默认关闭

**Status:** FIX_IMPLEMENTED / READY_FOR_REVIEW；P2 修复提交复审，第四步及 R3 未关闭，R4/T1 OPEN。
本节追加复审发现与修复证据，不覆盖 §18.37 原自审结论或历史失败。仅合成配置验证，无真实部署、数据或前端改动。

**复审发现及修订**

- 原门禁使用键集合及默认行存在性检查，无法拒绝重复声明。追加 `COMPLETION_WRITES_PAUSED=true` 或
  `COMPLETION_STORAGE_CONFIRMED=true` 后，原测试仍通过但 Compose 实际取最后值。原复审证据
  `/tmp/lms-t1-r3-step4-review-defaults.json`、`review-duplicate-tests.json/.log` 保留；后者 10 项通过不构成安全证明。
- [文档门禁](../../scripts/check-family-docs.js)使用已有 dotenv 解析器读取两份模板的实际标量值，并在解析器折叠重复键前按行统计声明。
  backend/Ubuntu 模板三键均须恰好一次，解析后分别严格为 `legacy`、`false`、`false`；不放宽 Ubuntu 密钥精确集合。
  同值重复和错误值在前、安全值在后同样拒绝；本规则限定模板单行控制键，不改变运行时显式启用流程。
- [配置测试](../../backend/common/deployment/__tests__/completionCompose.test.js)原 10 项保留，新增 48 项负向用例：
  两模板 × 三键 × 后置冲突、前置冲突、后置同值、前置同值、export 冲突、前置 export 冲突 CR、缺键、唯一不安全值。
  另新增 4 项引号/空白/注释/export/CRLF/CR 正向格式验证；原两项默认值检查也增强为唯一性和解析值断言。

**红绿、变异及实际配置证据**

- `/tmp/lms-t1-r3-step4-defaults-red.json/.log`：先加入初版矩阵，旧实现 38 失败/18 通过，退出码 1。
  修复后 `defaults-focused.json/.log` 为 2 套件/59 项通过；随后补六项前置 export/CR 顺序用例，最终验证另记，不混用中间结果。
- `/tmp/lms-t1-r3-step4-defaults-mutations.json`：仅在临时 Jest transformer 中分别移除唯一性、默认值守卫，
  62 项中分别 24 项、9 项预期失败，退出码均为 1，无运行时加载错误或跳过；失败均为门禁未抛错断言。
  对应 `defaults-mutant-unique.json/.log` 和 `defaults-mutant-value.json/.log`；仓库源码未被变异修改。
- `/tmp/lms-t1-r3-step4-defaults-compose.json/.log`：两模板 × 两 Compose × 15 种输入，共 **60 组**
  `config -q` 和 JSON 渲染核对通过（辅助脚本退出码 0）。12 组唯一安全模板被门禁接受；48 组重复声明均拒绝。
  包含冲突前后顺序、同值重复、export 覆盖，逐一核对 homework/resource 的实际值，不以 YAML 字符串存在性代替生效值。
  使用临时合成文件、合成密钥，并清除子进程环境中的三个控制键；渲染凭据不写入报告，临时目录收尾删除。
  没有执行 up/build/pull；此证据不是服务启动、真实存储、独立数据库或部署验收。

本段省略前缀的证据路径均以 `/tmp/lms-t1-r3-step4-` 开头。最终冻结全量及自审结论在下方续记。

**最终验证与自审**

- `/tmp/lms-t1-r3-step4-defaults-focused-final.json/.log`：最终两份定向套件 **65/65 项通过**，零失败/跳过，退出码 0，8.152 秒。
  命令：`node node_modules/jest/bin/jest.js --config backend/jest.family-common.config.js --runInBand --runTestsByPath backend/common/deployment/__tests__/completionCompose.test.js backend/common/deployment/__tests__/familyDocumentationGate.test.js --json --outputFile=/tmp/lms-t1-r3-step4-defaults-focused-final.json`。
- `/tmp/lms-t1-r3-step4-defaults-code-manifest.json` 冻结 771 个代码/配置/测试文件，SHA-256
  `52f27d2f1a3a6521ac51c442a661750a67caaeff7d828576d62c8270f0cc2a77`。
  Git HEAD 仍为 `79b346155abf4fefd2afdabe12c7e5a87db1448e`；工作区未提交，清单代表实际受测源码。
- Node v22.23.3/macOS 执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r3-step4-defaults-family.json`：
  **118/118 套件、2387/2387 项通过**，零失败/跳过，退出码 0，331.846 秒。
  `/tmp/lms-t1-r3-step4-defaults-family.json/.log` 保存原始报告，JSON SHA-256
  `f7bb1b5337afb1e6de34c127536c02776675f6047f00032dd74061bf5cea544a`。
- `/tmp/lms-t1-r3-step4-defaults-final-evidence.json` 核对上一轮最终报告：原 **2335 项完整保留**，新增 52 项，
  771 个冻结文件运行后零变化；相较上一轮仅配置测试和文档门禁脚本两个代码文件变化。
  沿用既有三个动态测试标题的 UUID/时间归一化，无其他名称忽略，不将本轮通过重写为历史失败不存在。
- `npm run docs:family:check`、`git diff --check`、两份修改 JS 的 `node --check` 通过；
  四份修改文档的 97 个内部路径及代码围栏检查通过。原定向/全量报告不覆盖，证据持久归档仍属 R4。
- 自审结论：唯一性守卫负责拒绝所有重复声明，解析值守卫负责拒绝唯一但不安全的值，两个守卫均有独立变异证据。
  原精确密钥集合、合法单行格式和失败测试的读文件 mock 收尾保留；Compose 实际生效值已验证，本次范围内未发现新的可行动问题。
  未改运行时业务、权限、旧客户端升级拒绝、写入前后回滚限制，也未增加前端范围。

本次 P2 为修复完成、待用户复审，不自行标记 CLOSED。保留历史 socket hang up、两项偶发 401 和全部原红灯证据。
仅合成环境验证，没有部署真实环境、变更真实配置或数据、提交或推送 Git；R3 第四步、R3/R4 与 T1 总门禁不提前关闭。

### 18.37.2 用户批准关闭控制键 P2 及 R3 第四步

**Status:** CLOSED，2026-10-23 用户复审通过；控制键 P2、R3 第四步及四步装配范围完成，R4 IN_PROGRESS，T1 OPEN。
复审定向重跑 `/tmp/lms-t1-r3-step4-defaults-review-focused.json/.log` 为 2 套件/65 项通过，退出码 0，6.135 秒。
`defaults-review-compose.json/.log` 60 组实际渲染符合预期；`defaults-review-mutations.json` 两种变异分别触发 24/9 项预期失败，无运行时错误或跳过。
复审核验 771 个冻结文件无变化及上一轮 118 套件/2387 项报告哈希，原 2335 项保留、新增 52 项；未宣称复审重新执行全量。
以上省略前缀的路径均以 `/tmp/lms-t1-r3-step4-` 开头。保留 §18.37/18.37.1 历史状态和全部失败证据。
此关闭仅覆盖已批准的后端装配及合成验证，不改变旧客户端升级拒绝，不授权真实部署，不关闭 R4/T1。

### 18.38 T1 R4：G1/G2 正式入口验收及证据归档

**Status:** IMPLEMENTED / READY_FOR_REVIEW；R1/R2/R3 CLOSED，R4 待复审，T1 总门禁 OPEN。
执行范围：补齐归并表 A31/A33/A34 的完整串联证据，复用原事务/故障矩阵及正式链路回归，
保存冻结源码、用例对比和报告；不增加业务接口或前端，不部署真实环境。
裁定：G1/G2 是既有行为的证据缺口，先补测试而不修改生产逻辑；原 A01–A35 保留，分层对应见归并表 §4.3。
仅关闭用户已批准的 R3 和控制键 P2；本节新增自审发现及 R4 均提交用户复审，不提前关闭 T1。

**实现和验收断言**

- [正式装配测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js)保留原 65 项，增加 3 项。
  复用真实 Gateway、homework/resource 正式工厂及 progress app，跨服务走显式回环 HTTP，不替换为 mock client。
- **R4-G1（COMMITTED/ABORTED 两分支）**：孩子 A 使用 UUID X，在真实 prepare/commit 成功响应丢失后保持本地活动 owner；
  同家庭共管家长 B 使用同一 X 返回 503，B 命令数为零，整个模型快照和远程/发星调用数不变。
  同 actor 异正文仍优先返回 409。A 成功/到期失败收敛后，B 用当前版本和同一 X 正常完成，得到独立 remoteOperationId/摘要。
  精确比较三个媒体 ID、field、state、绑定及释放代次、本地完整 mediaId→代次映射、作品集合及两个账本数。
  A 本地终态保持不变；COMMITTED 旧远程记录只允许正常 unbind 的一次 fence 版本/更新时间推进，首次 terminalAt 和其余字段不变。
  A/B 历史重放返回各自结果、无数据库/远程调用变化，未确认不发星。
- **R4-G2**：两媒体真实 prepare 提交后断链；仅在测试副本集中同步设置 operation/引用租约已过期，保持实际正式服务时钟。
  原 PATCH status 后执行真实 abort，等其提交 ABORTED/两引用 released 后在成功 JSON 发送点销毁连接；本地仍保持原 pending/owner/映射。
  关闭旧监听器，对十个模型集合做 BSON 序列化、清空、重建并比较全部数据和索引，再新建 provider/homework/Gateway 工厂。
  重建后 GET 零副作用，原 PATCH 只发一次同 remoteOperationId/摘要及完整集合的 status，409 失败收敛并释放 owner。
  对比失败前任务基线，只允许 owner/pending 清除、引用状态 stable、合法 `__v` 和 updatedAt 推进，作品证据及业务字段不得改变。
  全部远程记录/引用保持精确原值，无新命令/星星；失败重放和迟到 prepare 均不复活引用、不改变数据库快照。
- 提取测试 `startProviders` 仅为正式工厂重建复用；新增丢响应开关每例归零，原材料 commit 和发星断链逻辑完整保留。
  未改变运行时启用门禁、客户端升级拒绝、鉴权、数据库 schema、生产事务或回滚规则。

**过程失败、自审与变异证据**

- `/tmp/lms-t1-r4-first.json/.log` 保留初版 3 失败/65 因名称筛选未运行：actor BSON/string 比较和错误 requestId 跨请求比较不当。
  `/tmp/lms-t1-r4-focused.json/.log` 保留 67 通过/1 失败：旧 COMMITTED 记录正常 unbind fence 的 version/updatedAt 会推进，不能断言完全不变。
  以上为测试预期修正，不冒称生产缺陷的红绿证明；未修改业务实现。
- `/tmp/lms-t1-r4-focused-final.json/.log` 首次 68 项通过；独立只读审查随后指出两项 P2 测试保护不足：
  G1 仅比较代次未锁定完整媒体映射，G2 失败收敛未锁定原任务业务字段。两项均已补精确基线断言，未删减原断言。
- `/tmp/lms-t1-r4-protected-focused.json/.log`：补强后 **1 套件/68 项通过**，零失败/跳过，退出码 0，12.444 秒。
  命令：`node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js --json --outputFile=/tmp/lms-t1-r4-protected-focused.json`。
- `/tmp/lms-t1-r4-final-mutations.json`：六种临时 transformer 分别验证公开 UUID 误用为远程映射、失败后保留 owner、
  恢复重新 prepare 而非 status、ABORTED 被错误发布、错误媒体绑定和失败路径污染业务字段；依次触发 **2/2/1/2/2/1** 项预期失败。
  各次退出码 1，无加载错误；仅筛选三个 `R4-G` 用例，65 项未运行是明确过滤，不是完整回归通过。
  `final-mutant-wrongMedia` 的 G1 ABORTED 分支在完整映射断言失败，`final-mutant-failedEvidence` 在 G2 原任务基线断言失败，
  证明两项审查 P2 保护有效。原四种变异的中间报告 `lms-t1-r4-mutations.json` 保留，不覆盖。

**冻结验证和边界**

`/tmp/lms-t1-r4-code-manifest.json` 冻结 771 个文件，SHA-256
`b0d802b33aaefd0901d6a7e7793057cf273e508f84401ba3a8caa1e14e0ebb4c`。
Git HEAD 仍为 `79b346155abf4fefd2afdabe12c7e5a87db1448e`，未提交工作区由清单标识；最终全量和归档结果在下方续记。
合成 JWT 不是登录验收，三服务共享临时副本集；BSON/同进程应用工厂重建不是进程/数据库重启或真实备份恢复。
测试中的租约变更仅为临时数据夹具，不是运维修复命令。真实介质、物理分库、停机恢复、旧备份恢复仍归 T8。
保留历史 socket hang up、两项偶发 401 及全部原红灯，不扩大前端、不部署、不提交或推送 Git。

**最终全量、自审及归档**

- Node v22.23.3/macOS 执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r4-family.json`，
  **118/118 套件、2390/2390 项通过**，零失败/跳过，退出码 0，321.8 秒；原始 JSON/log 同前缀保存。
  JSON SHA-256 `21adb6e63baba0ea3ed0b81cea5b189fac7e0eacf3a53a7c01f312039e8ddb8b`。
- `/tmp/lms-t1-r4-final-evidence.json` 对比上一轮最终报告：原 **2387 项完整保留**，新增恰为 G1 两分支和 G2 一项；
  771 个冻结文件零变化，唯一代码变更为正式装配测试文件。原 65 项装配测试仍在，未修改生产服务或客户端。
- `npm run docs:family:check`、`git diff --check`、修改 JS 的语法检查通过；五份修改文档的内部路径和代码围栏检查通过。
- 自审及独立审查：丢响应钩子位于真实路由成功 JSON、事务提交之后；本地 pending 和远端终态同时核验，
  旧监听器关闭、全部模型 BSON 数据/索引比较及新工厂创建有效。两项 P2 测试保护缺口已补强并被针对性变异拦截。
  修订后的原用例及全量通过，本轮未发现其他可行动问题；独立审查没有替代作者修订后的用户复审。
- 本机持久证据目录：`release-gate-artifacts/t1-r4-2026-10-23/`（Git 忽略，目录权限 0700、文件 0600）。
  `archive-manifest.json` 记录报告、源码和文档的逐文件 SHA-256；`reports/` 复制本机现有全部 `lms-t1-*.json/.log`，
  包括本次过程失败、原 socket hang up/401 证据（以实际仍存在的原文件为准）、历史通过及变异失败，不删除原 `/tmp` 文件。
  `source.tar.gz` 保存冻结代码及当前修改/未跟踪文件快照，覆盖到记录的 HEAD 的独立检出上可重建受测工作区；
  不覆盖当前工作区、不包含 node_modules/真实 `.env` 或 `.git`，依赖需另安装。归档提取到独立临时目录后逐文件复核哈希。
  该归档是本机可追溯证据，不是 Git 提交、远端发布或异地备份；原始报告仅合成环境产生，仍不直接对外发布。

结论：R4 G1/G2 证据补齐并完成本轮自审，新增两项 P2 测试补强和 R4 整体提交复审；不自行关闭 R4/T1。
归并表仍保留原 A01–A35 和历史勾选，最终关闭及真实启用分别等待用户批准。旧客户端升级拒绝和范围边界保持不变。

### 18.38.1 R4 G1/G2 及两项 P2：用户批准关闭

**Status:** CLOSED，2026-10-23 用户确认复审通过，明确批准关闭 R4 G1/G2 及两项 P2 测试保护缺口。
关闭范围为 G1 同 UUID 活动冲突与终态接续、G2 abort 丢响应后的持久映射/重建恢复，
以及完整媒体代次映射、失败前后业务字段不变两项测试保护。此批准不等于 T1 总门禁关闭。

- 独立复审定向重跑 `/tmp/lms-t1-r4-review-focused.json/.log`：1 套件、68 项通过，零失败/跳过，退出码 0，15.215 秒。
- `/tmp/lms-t1-r4-review-mutations.json/.log` 及六份 `review-mutant-*.json/.log`：mapping、owner、reprepare、
  publishAborted、wrongMedia、failedEvidence 分别触发 2/2/1/2/2/1 项预期失败，退出码均 1，无加载错误。
  每次只筛选三项 G1/G2，65 项未运行不得计为全量通过。wrongMedia 命中完整映射断言，failedEvidence 命中原任务基线断言。
- 复审核验旧 2387 项完整保留、新增 3 项；771 个冻结文件未变，原 118 套件/2390 项全量报告及哈希匹配。
  本次关闭记录更新前再核验原归档的 788 个源码/文档、765 个报告和 6 个辅助文件，以及归档权限，结果一致。
  关闭记录更新未重跑业务全量，不将上轮 321.8 秒的运行写成本次新运行。
- 复审确认丢响应发生在真实事务提交后，完整引用集合、精确代次、失败清锁及业务字段基线受到断言保护；
  在已声明的合成验证范围内未发现新的可行动问题。旧失败、变异失败及首次审计证据全部保留。

§18.38 的待审结论作为历史保留，以本节为该范围最新裁决。R1 稳定性已批准关闭，历史 socket hang up/两项偶发 401
不删除、不冒称当时通过，也不因保留历史记录而重新标记为当前未关闭缺陷。R4 工作包中的 T1 汇总关闭步骤仍待批准。

### 18.39 T1 总门禁关闭申请（待用户批准）

**Review material:** READY_FOR_REVIEW。**Decision:** PENDING_USER_APPROVAL。**T1:** IN_PROGRESS / OPEN。

完整评审材料集中在[验收清单归并 §6](./family-self-directed-learning-t1-acceptance-reconciliation.md#6-t1-总门禁关闭评审材料)，
逐组覆盖 A01–A35，区分已批准工程证据、汇总关闭审批和 T2/T3/T4/T7/T8 后续责任。
本次核对在既定 T1 后端、合成环境范围内未发现新的待实现项或待补验收证据；剩余步骤为用户总门禁裁决，
获批后再更新 T1/R4 汇总状态、历史汇总项的关闭索引及相应文档状态校验。本次不预先改为 CLOSED。

沿用 §18.38 的冻结源码和全量报告；本次仅修改五份状态/评审文档。原归档
`release-gate-artifacts/t1-r4-2026-10-23/` 保持不可变；复审报告、此次文档快照、校验结果与逐文件哈希另存于
`release-gate-artifacts/t1-close-review-2026-10-23/`，不覆盖原失败证据，不作为远端发布或异地备份。
补充归档记录本节及归并表的待批状态，批准后的状态必须另行追加记录，不能改写本次送审快照。

批准建议仅限 T1 后端工程总门禁；旧客户端升级拒绝、默认关闭、写入前后回滚限制均保留。
不扩大前端、不接触真实数据、不部署真实环境、不提交/推送，不将合成 JWT、BSON/工厂重建或扫描协议桩称为真实登录、
主机重启、备份恢复或 ClamAV 验收。SL-01 至 SL-07 与后续任务状态不因本次关闭申请改变。

本次文档验证：首次使用 HTML 锚点的三处新链接被现有标题校验拒绝，原失败保存在
`/tmp/lms-t1-close-review-doc-gate.log`、`/tmp/lms-t1-close-review-docs.json/.log`（1 失败/2 通过）。
改用 Markdown 标题锚点后，Node 22 的 `npm run docs:family:check` 退出 0；文档门禁定向测试
`familyDocumentationGate.test.js` 为 1 套件/3 项通过，零失败/跳过，退出码 0，0.45 秒。
最终报告使用 `lms-t1-close-review-doc-gate-final.log` 和 `lms-t1-close-review-docs-final.json/.log`，不覆盖首次失败。
未修改校验器或冻结代码；状态/清单及归档核验结果由补充归档的 `validation.json` 记录。

### 18.40 T1 后端工程总门禁及 R4 汇总：用户批准关闭

**Status:** APPROVED / CLOSED，2026-10-23 用户明确批准。关闭范围严格限定为既定后端合成验收。

| 关闭项 | 裁决 | 依据与边界 |
| --- | --- | --- |
| T1 后端工程总门禁 | CLOSED | A01–A35 已逐组核对；R1/R2/R3 及 R4 G1/G2、两项 P2 已复审批准；沿用 §18.38–18.39 的冻结实现与证据 |
| R4 汇总项 | CLOSED | G1/G2、完整媒体代次映射及失败业务字段基线保护已关闭，总门禁审批现已完成 |
| A01–A05、A07 历史汇总范围 | CLOSED（仅 T1 部分） | 各批实现、装配及稳定性证据已归并，不重开批次；A04 的真实介质、A02 的前端等后续责任仍留原任务 |
| T2–T9 / SL-01–SL-07 | 状态不变 | 不将 T1 后端完成等同完整功能、真实发布或家庭价值验证 |

§18.39 的 READY_FOR_REVIEW / OPEN 是送审时历史状态，原送审快照不改写；当前裁决以本节及 §3 为准。
实施计划只勾选当前 R4 汇总入口；旧分批日志和原 35 条复选框保留历史，由归并表 §6.4 提供关闭索引，
不把含 T2/T3/T4/T7/T8 责任的混合条目全部打勾。

本次同步文档状态校验及其负向测试，不修改生产服务、客户端、环境模板或 Compose 默认值。
旧客户端升级拒绝、默认 legacy/false/false、写入后禁止回退旧 writer 的限制不变；未部署真实环境，未操作真实数据。
保留历史 socket hang up、两项偶发 401 以及各批失败/变异报告，R1 已批准关闭的稳定性问题不重新标为当前缺陷。
此次审批不授权提交、推送、前端扩展或启动 T2；后续开发按计划另行安排。

历史全量证据仍为 §18.38 的 118 套件/2390 项；本次关闭验证针对文档门禁和默认配置保护，不冒称重新执行业务全量。
本轮记录及报告独立保存至 `release-gate-artifacts/t1-closed-2026-10-23/`，关联原 R4 和送审归档的哈希，
不覆盖旧归档；冻结清单仅允许文档校验脚本与其测试发生本次授权变化，运行时实现和启用配置必须保持不变。

**关闭验证（2026-10-23）**

- 文档/配置定向：Node 22 执行 `node node_modules/jest/bin/jest.js --config backend/jest.family-common.config.js --runInBand --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js backend/common/deployment/__tests__/completionCompose.test.js --json --outputFile=/tmp/lms-t1-closed-final.json`，
  2 套件/79 项通过，零失败/跳过，退出码 0，8.274 秒，原始日志为同前缀 `.log`。
- 新增 14 项文档状态测试（1 正向、13 负向），原 3 项文档测试及 62 项 Compose/default 控制测试完整保留。
  负向覆盖当前状态回退、重复/冲突 T1 行、合成范围丢失、伪造生产授权、T2 提前关闭，以及计划/归并/R4/导航/运维摘要不同步。
  内存替换文档输入并断言对应错误，不改真实文件。仅当前状态表参与 T1 判定，历史 OPEN 不会被当作当前状态。
- 保留先测试后修订校验器的 `/tmp/lms-t1-closed-red.json/.log`：13 失败/3 通过，退出码 1，
  证明旧校验仍要求 IN_PROGRESS 且缺少关闭边界检查；不是业务运行时失败。后续新增 R4 表格反例随最终 79 项验证。
- 正式装配：Node 22 执行 `node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js --json --outputFile=/tmp/lms-t1-closed-assembly.json`，
  1 套件/68 项通过，零失败/跳过，退出码 0，13.773 秒，包含直接应用/Gateway 旧客户端升级拒绝、G1/G2 和无副作用断言。
- `npm run docs:family:check` 通过；既有 16 个契约探针、35 个价值门禁探针及 388 个契约夹具保留。
  本次合计实际重跑 3 套件/147 项，不代称 118 套件/2390 项业务全量重跑。
- 自审：不放宽产品/家庭隔离/事务契约，不修改默认配置、服务或客户端；当前摘要与批准范围一致，历史待审内容均保留为历史。
  原归档与冻结运行时、链接/围栏、语法及 `git diff --check` 的收尾核验记录在本轮归档 `validation.json`。

## 19. T2-1 基线修复批次验收

**Status:** CLOSED（2026-10-23 用户批准，含空白变体 P2）；T2 总门禁 IN_PROGRESS / OPEN。
以下保留原提交验收时说明；最新裁决为用户答复“批准 T2-1，进入 T2-R”，证据归档不改写。

2026-10-23 用户批准 T2 原设计与补充设计（新增接口、模型、专用凭据、24 小时保留期、默认批次 50），
仅执行 T2-1；详见[执行及评审记录 §8](family-self-directed-learning-t2-execution.md#8-t2-1-基线修复与批次验收2026-10-23)。
两项旧测试按现有中文来源标签和 heading 角色修复，原业务断言保留；校验器同步唯一 T2 IN_PROGRESS 状态，
新增 12 条负向用例；独立评审发现空白变体行漏计 P2 后另补四负向、一正向并修复，不放宽 T1 关闭范围、部署授权或 T3–T9 状态。

本轮前端全量 29/29 suites、183/183 tests；文档门禁最终 34/34，P2 修订后独立复跑 34/34 通过；构建、文档审计和差异格式检查通过。
修复前定向 2 failed / 14 passed、门禁先红 8 failed / 21 passed 及设计阶段全量失败均保留，不覆盖 T1 历史失败。
自查和独立评审结论、命令与归档见执行记录 §8；本批用户验收未批准，不自行关闭 T2-1 或 T2 总门禁。
没有业务代码、默认关闭配置或旧客户端拒绝行为变更。后端业务全量、真实 HTTP E2E、浏览器与真机 QA 本批未执行。
T2-R/T2-G 未实施，原孤儿回收及上传未知结果缺口仍待实现验证；不部署真实环境，不提交或推送 Git。

## 20. T2-R 公开恢复后端批次

**Status:** CLOSED（2026-10-23 用户批准，含 owner/pending 丢失 P2）；T2 总门禁 OPEN。
实现三个 enabled-only 入口：跨日分页待恢复列表、单任务只读发现、原 actor 指定命令显式 POST 恢复。
复用原事务、hash/完整集合/精确代次/终态与 CAS；GET 无写入或远程调用，不公开 remoteOperationId/待发布正文。
自审发现 owner/pending 同时丢失的错误 none/漏列表 P2，已补只读账本反查及永久负向用例，独立复核确认有效。
后端定向两套件 171/171 通过，独立复跑新增 38 项通过；完整家庭回归 118/118 套件、2459/2459 测试通过，零失败/跳过，exit 0。
原始失败及通过报告、本批源快照和独立评审结论归档于 `release-gate-artifacts/t2-r-recovery-2026-10-23/`，不覆盖历史证据。
命令、历史失败与用例映射集中在[执行记录 §9](family-self-directed-learning-t2-execution.md#9-t2-r-公开恢复接口实施)。
本批仅覆盖 R001–004 后端层，UI/CT 层和 R005 留后续前端批次；T2-G 未实施，不部署、不提交、不推送。

上述为本批交付时范围。用户随后明确“批准 T2-R，进入 T2-G”；复审重跑171项和文档门禁通过，归档与当前文件哈希匹配。
T2-R 后端验收关闭，不扩展为 UI/真机或部署验收。T2-G 已授权进入实施，进度见执行记录 §10；D01 和 T2 总门禁仍 OPEN。

## 21. T2-G 孤儿媒体回收实施门禁

**Status:** IN_PROGRESS / PENDING_BATCH_ACCEPTANCE。仅合成验证，未部署、未提交或推送 Git；T2 总门禁 OPEN。
G-A/G-B 限定实现已自查及独立复核；G-C 正式装配、预检、显式运维和重建组合实施中，
不得以旧快照家庭回归或单个helper的通过结果关闭本批。详见 T2 执行记录 §10。

2026-10-23 用户追加批准同专用凭据保护的只读 retirement status 接口，用于精确家庭/孩子/媒体/retirementId核验。
absent/available不是退休许可；预检不调用写退休接口、不递增guard、不改变数据库或自动开放写入。
系统回收保持24小时、每批默认50/上限100、显式开关默认false；上传日志保护在enabled中独立生效。

本批自查/独立评审发现的活动账本孤立、上传未知结果及终态、用户删除竞争、日志等待和存储/预检缺口，
均按红测→修订→针对性复测记录；历史失败保留，不以最终通过覆盖。仍需最终固定源码的家庭回归、
正式配置检查、独立复核和不可变证据归档，然后提交用户批次验收。DEVICE_PENDING 不变。

**保留阻断：**旧用户主动删除日志没有完整终态组及上传身份摘要，现有系统回收恢复 helper 不覆盖这一路径。
用户明确要求先补充版本化日志/恢复设计并评审，再实施。补充设计经两轮独立评审、三项P2设计修订通过，
2026-10-23用户随后批准设计及容量，已进入细分实施A；尚未完成恢复流程，未自动改写历史证据；
T2-G、D01 和 T2 均不得因此提前关闭。
详见 T2 执行记录 §10.4。系统恢复合成通过与用户旧日志恢复未完成必须分别陈述。

设计入口：[用户主动删除版本化恢复](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-user-deletion-recovery-design.md)。
当前实现两项追加P2及固定源码回归另见执行记录 §10.5；仅为检查点，不是T2-G批次关闭依据。
该检查点冻结源码家庭回归134套件/3143项全部通过，零失败/跳过，exit 0；
独立只读复核确认离线SUPERSEDED与时钟回拨轮转两P2修复有效，未发现限定范围新增确证问题。
此结果不覆盖尚未编码的用户删除恢复方案，不改变本节IN_PROGRESS及T2总门禁OPEN。

用户删除恢复增量A已完成纯证据契约及append-only模型、自查和独立复核，未接入正式删除/清理/启动路径。
新定向106+34项通过，独立纯测复跑106项通过；最终固定源码家庭回归136套件/3283项通过，零失败/跳过，exit0。
源码1163项哈希无漂移，归档`release-gate-artifacts/t2-udr-a-2026-10-23/`；原始失败与中断记录保留。
此为A阶段内部增量证据，不代表UDR全流程或T2-G验收；当时B-E待实施，当前进度见下。
T2-G/D01/T2仍OPEN，DEVICE_PENDING不变，不部署、不提交或推送。

增量B事务outbox/v2持久日志及删除清理接续已完成内部实现验收，正式依赖装配未接入；
不得以内部增量结果提前关闭本节。详见执行记录§10.8。
独立评审两项B-P2（外部v2与active旧备份、未变化历史引用终态闭包）经四项红测复现后已修订，
六套件319项通过，两项P2已独立复核关闭；最终固定源码家庭回归138套件3409项通过，零失败/跳过，exit0。
1167受测文件及11个独立复审文件哈希一致，归档`release-gate-artifacts/t2-udr-b-2026-10-23/`。
非阻断规范比较用例精度建议留C；旧全量主动中断exit130、测试屏障超时及PATH选错Git的全量失败证据保留。
后者在保持源码不变、恢复原PATH并仅前置Node22后定向及全量通过，不归因于产品或历史socket/401。
C/D/E仍待实施，T2-G/D01/T2及DEVICE_PENDING边界不变，不部署、不提交或推送。

增量C已开始实现独立受控helper、版本依赖证明及真实BSON回退测试，详见执行记录§10.9。
首轮联合131项通过、追加边界主58项通过；CAS/依赖事实及B保留P3规范比较均有隔离变异验证。
独立代码/QA评审与最终冻结回归未完成，不标记C验收；D/E仍待实施，本节/T2总门禁保持OPEN。

C局部恢复核心后续三项代码P2、五项QA保护缺口及B保留P3已修订并独立复核，
最新定向8套件493项通过，零失败/跳过，exit0；四个核心文件与评审快照哈希一致。
证据归档`release-gate-artifacts/t2-udr-c-checkpoint-2026-10-23/`，是进行中检查点，不是全仓冻结或C验收。
受保护v1/v2预写屏障仍未实施；组合reader设计存在联合预算P2，按原100物理文件/16MiB保守口径修订中。
不得因局部恢复测试通过关闭C、T2-G、D01或T2；默认关闭、DEVICE_PENDING及不部署/Git限制不变。

C-reader联合预算方案后续已独立核对PASS并进入实现；缓存会话绑定、7项真实组合读取恢复、
3项原系统回收接续用例已补充，完整核心2套件208项通过，零失败/跳过，exit0。
reader文件系统测试、独立代码/QA及最终冻结回归仍待完成，详见执行记录§10.9；
本段只记录进展，不关闭C、T2-G/D01/T2，不改变默认关闭、旧客户端拒绝或真实环境限制。

C最终内部增量完成：受保护组合reader及会话绑定已分别通过独立代码/QA复核；
固定1173文件家庭回归141套件3682项全部通过，零失败/跳过，exit0，六个核心文件匹配独立评审快照。
原B测试源码和逐套件用例数未变，新增三套件273项；保留所有历史失败、容量超时与动态标题比对说明。
归档`release-gate-artifacts/t2-udr-c-final-2026-10-23/`，执行记录§10.9和计划C记载详细边界。
非阻断C-CACHE-P3明确留E，不提前声称关闭；D/E、T2-G/D01/T2及DEVICE_PENDING仍未完成。
本节总状态保持IN_PROGRESS；默认关闭、旧客户端升级拒绝、不部署、不提交或推送Git均不变。

D进入实施，用户确认保留正常enabled的历史v1-only兼容、严格恢复拒绝；v2不完整始终阻断。
D1已完成结构检查/显式探针分离，63项自测和独立复跑通过，独立代码/QA PASS，受影响5套件150项全部通过。
仅新增内部只读入口及严格v2目录选项，未改调用方或正式装配；证据见执行记录§10.10与
`release-gate-artifacts/t2-udr-d1-2026-10-23/`。D2-D4及本节总门禁仍开放，不将D1结果当作恢复预检已经完成。

D2a reader流式清单/旧日志读取内部步骤完成，独立代码/QA PASS、独立128项通过，原C65全部保留；
受影响4套件337项通过，零失败/跳过，exit0。bson直接生产依赖准备单独复核PASS、隔离安装/加载通过，
保留初次默认npm cache EPERM失败证据。归档`release-gate-artifacts/t2-udr-d2a-2026-10-23/`。
D2b原生预检和完整模块加载尚未验收，D3/D4及本节总门禁保持开放；不部署、不提交或推送，默认关闭不变。

2026-10-24按用户MVP范围调整在D2b未装配检查点暂停。已启动的定向验证收尾为4套件433通过/1失败/0跳过，
exit1；16MiB依赖预算用例先遭遇MongoDB查询超时，失败保留、不重跑掩盖。独立代码/QA尚未完成，
不进入D3，不关闭本节门禁；源码及证据见`release-gate-artifacts/t2-udr-d2b-deferred-2026-10-24/`。
详细交接见执行记录§10.10，后续以用户新任务安排为准。

## 22. T2 MVP 页面工程验收申请（2026-10-24）

> §22 至 §22.5 保留历次申请及收口记录；当前限定合成范围关闭以 §22.6 为准，旧证据不改写，最新全量失败保留。

用户已恢复并授权完成 T2-2 至 T2-6，不再以高级恢复/新回收阻塞页面。
作品上传、完成、版本审核、孩子回看、跨日期原 actor 恢复及账号/孩子隔离已实现。
当前证据、失败记录、独立复核和逐项验收矩阵见 [T2 执行记录 §12](family-self-directed-learning-t2-execution.md#12-mvp-页面闭环工程交付2026-10-24)。
前端39套件474项、正式HTTP 2套件13项、T2浏览器8项、原Task11/12浏览器4+1项及构建均通过；
后端家庭全量143套件3912项通过，报告success:true；原会话句柄失效无法回读退出码，未伪造exit。
十图精确解绑/文件保留断言P2另补1项定向通过并独立复核关闭；此前D2b容量超时失败仍保留，不将单轮通过当作后置能力验收。
自查修复代录/上传与确认互斥；独立复核关闭切孩子旧列表/弹窗残留P2，新增反例保留。
T2 总门禁 OPEN / IN_PROGRESS，未获用户关闭批准。T2-G/D01、高级恢复D2b/D3/D4/E及C-CACHE-P3保持
REMAINDER_DEFERRED（不是通过）；DEVICE_PENDING、T8真实部署/备份/隔离恢复待办不变。
合成验证使用正式enabled工厂和真实HTTP，保留预检/凭据/上传保护，新回收关闭，v2 writer未装配；
真实默认关闭配置及旧客户端升级拒绝未变。没有部署、真实数据/NAS操作、提交或推送Git。

### 22.1 页面恢复边界 P2 增量（2026-10-24）

T2-PAGE-P2-403 与 T2-PAGE-P2-STORAGE：CLOSED（2026-10-24 用户复审通过并明确批准关闭），不等于 T2 总门禁批准。
当前恢复 403 清空私有详情并阻断操作，保留原命令/operationId；规范命令键支持退出清除损坏正文，
同 actor 重登后只读发现、显式恢复，过期保留和跨身份迟到响应隔离不变。
新增14项永久反例在旧代码12失败/2通过，修复后完整前端40套件488项、正式HTTP 2套件13项及构建通过。
真实浏览器新增损坏命令退出恢复与移除共管家长后403清屏；原正常提交/审核/回看及其他失败边界继续保留。
最终完整浏览器10项通过（0 retries，exit 0），不是只用组件替身验收；文档状态校验及diff检查通过。
详细自审、夹具204断言修正和构建lint失败证据见 [执行记录 §12.5](family-self-directed-learning-t2-execution.md#125-页面恢复边界两项-p2-修订与自审2026-10-24)，
增量归档 `release-gate-artifacts/t2-page-p2-2026-10-24/`；旧报告不替换，不将高级恢复后置视为通过。
T2 总门禁仍 OPEN / IN_PROGRESS，DEVICE_PENDING 和 REMAINDER_DEFERRED 边界不变；仅合成验证，无部署/提交/推送。

### 22.2 T2 工程验收及限定范围总门禁关闭申请

后续裁决：本节是独立全流程评审前的申请快照。三项新P2修订及验证见§22.3；旧材料不再表示当前无阻断项。

**Status:** PENDING_USER_APPROVAL。用户本次仅批准两项P2关闭及准备材料，未批准关闭 T2。
完整退出条件、证据限制、设备/T8/后置义务及拟审批内容见 [执行记录 §13](family-self-directed-learning-t2-execution.md#13-t2-工程验收及总门禁关闭评审包待批准)。
复审实际重跑前端40套件488项、正式HTTP 2套件13项和关键浏览器2项均通过；未发现新增缺陷。
受测172文件及构建哈希匹配，原完整浏览器10项和失败证据保留。复审归档：`release-gate-artifacts/t2-page-acceptance-review-2026-10-24/`。
当前页面范围无已知未解决阻断项；T2-2至T2-6工程汇总验收与总门禁关闭须等待用户批准。
拟关闭仅限正式enabled合成页面工程范围，不代表真机、真实发布、高级恢复、新回收或SL-01整体已完成。
唯一T2 IN_PROGRESS行及现有状态校验器保持，T1 CLOSED、T3–T9 NOT_STARTED不变，不扩大授权。

### 22.3 独立全流程评审三项 P2 修订

T2-P2-JWT、T2-P2-SNAPSHOT、T2-P2-BODY-SYNC 已逐项核实成立，先记录聚焦方案与自审通过，再补红灯并实施。
修订与证据见 [执行记录 §14](family-self-directed-learning-t2-execution.md#14-独立全流程评审三项-p22026-10-24)。
当前三项 P2 已独立复审通过并获用户批准 CLOSED，最新裁决见 §22.6；以下保留开发自审时的验证快照，不覆盖 T1 及原两项 P2 的关闭历史。
前端40/490、正式HTTP2/14、定向3/37、真实页面14、Task11/12各4/1通过。
家庭全量143/3926中1项旧JWT403断言失败，其余3925通过；精确同步401及错误码后完整装配套件106通过。
该开发轮没有第二轮全仓报告，不以定向报告伪称全仓全绿；后续独立全量 3926/3926 证据见 §22.4。原失败及后置D2B历史证据保留；原归档 `release-gate-artifacts/t2-three-p2-2026-10-24/` 不改写。
范围仍是enabled合成环境；DEVICE_PENDING及高级恢复/新回收REMAINDER_DEFERRED不变，不部署/提交/推送。

### 22.4 用户批准与 T2 合成工程关闭（2026-10-24）

> 历史收口快照。该裁决曾由 §22.5 待批准要求覆盖，当前授权以 §22.6 为准；三项 P2 仍 CLOSED，不用本节旧绿灯覆盖最新失败。

用户直接指令：“先一次性完成 T2 的缺陷／证据／文档与批准收口”。此前独立复审通过，本次据此批准并关闭
T2-P2-JWT、T2-P2-SNAPSHOT、T2-P2-BODY-SYNC，以及 T2-2 至 T2-6 / T2 工程总门禁，范围仅 ENGINEERING_SYNTHETIC_ONLY。
总体设计的当前状态滞后 P3 同步修正；T1、T2-1、T2-R 及原两项页面 P2 已关闭裁决不变。

最终独立复审实际执行：后端 143 suites / 3926 passed，前端 40 / 490，正式 HTTP 2 / 14，定向 3 / 37，
T2 浏览器 14 passed / 0 retries，原 Task11/12 浏览器 4/1，构建通过，均 exit 0；四种 sync/await 变异预期 exit 1，非运行错误。
180 项候选源码哈希及构建哈希已核对。本次归档复用上述复审结果，不声称本次文档更新重跑全部业务测试；
开发轮旧 JWT403 断言失败及 D2B 历史失败保留，不删除或改绿。

完整裁决、批次与缺陷映射及保留义务：[执行记录 §15](family-self-directed-learning-t2-execution.md#15-t2-合成范围工程验收与关闭裁决2026-10-24)。
本地证据归档及本次文档状态验证：[归档索引](evidence/t2-synthetic-2026-10-24/README.md#历史独立验收)；可纳入版本管理的[用户批准记录正本](family-self-directed-learning-t2-closure-approval.json)供文档门禁读取，不依赖 Git 忽略的本地归档。
DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、T2-G/D01、D2b/D3/D4/E、C-CACHE-P3 的 REMAINDER_DEFERRED 保持；SL-01 至 SL-07 仍 PLANNED，T3–T9 NOT_STARTED。

### 22.5 三项 P2 关闭及总门禁待批准（2026-10-24）

> 历史申请快照；当前批准见 §22.6。本节全量失败仍为最新证据，不能替换为旧绿灯。

最新用户明确批准关闭 T2-P2-JWT、T2-P2-SNAPSHOT、T2-P2-BODY-SYNC，并要求补跑全量、更新材料，“待我批准后再关闭”。
三项 P2 为 CLOSED；T2 工程总门禁 OPEN / IN_PROGRESS，T2-2 至 T2-6 汇总验收 PENDING_USER_APPROVAL。
§22.4 与执行记录§15保留此前收口原文及证据，不再作为当前关闭授权；结构化裁决保留 previousDecision，当前校验严格保护待批准状态。

本轮实际 `npm run test:family-regression`：143 suites，142通过/1失败；3943项，3942通过/1失败/0跳过，exit1。
唯一失败为后置 `D2B-05` 的 mediareferences 查询 code50；未接入正式启动/页面链路，保持 REMAINDER_DEFERRED，未修复或重跑掩盖。
旧 JWT403 断言现已通过；此前3926项报告与本轮差17项均为既有文档门禁反例（34→51）。不把原绿灯或后置裁决替代最新全量结果。
后续仅更新文档/状态校验及2项反例，另跑公共模块；产品源码和真实配置不变，原失败报告/批准快照不改写。

工程验收条件、缺陷关闭表、最新证据与待批准事项见[执行记录 §16](family-self-directed-learning-t2-execution.md#16-三项-p2-批准关闭与工程验收再申请2026-10-24)；
[本轮证据](evidence/t2-synthetic-2026-10-24/README.md#最新全量失败)单独保存全量失败和文档验证，不能称全量全绿。
拟关闭仅 ENGINEERING_SYNTHETIC_ONLY，需用户知悉本轮后置失败后另行裁决；DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、REMAINDER_DEFERRED 保持。
不部署、不提交或推送Git，不自动开始T3–T9，不关闭D01/T2-G或高级恢复验收。
真实默认关闭、旧客户端拒绝、权限/日志/上传 guard/索引/预检均不变；无真实数据/NAS、部署、Git 提交或推送。

### 22.6 T2 限定合成工程批准关闭（2026-10-24）

> 本节为原批准快照，下述“最新”指该次批准时点；不随 §22.7 的查询缺陷关闭或后续 CI 成功改写。

**Decision:** APPROVED / CLOSED。用户明确批准 T2 限定合成范围工程验收及总门禁关闭，并要求保留本轮 D2B-05 失败、不写全量全绿。
T2-2 至 T2-6 CLOSED；T2-1/T2-R、三项 P2 和 T1 原关闭保持。
批准原文、退出条件与保留义务见[执行记录 §17](family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)，
正本为[批准记录](family-self-directed-learning-t2-closure-approval.json)；§22.5 待批准裁决保留为历史，最新失败仍有效。

最新家庭后端全量仍 **FAILED / exit1**：143 suites（142通过/1失败），3943 tests（3942通过/1失败/0跳过）。
D2B-05 code50 继续 REMAINDER_DEFERRED，未修复、未关闭；原报告不改写，不用旧绿灯替代。
本轮仅文档/校验器状态同步及对应公共模块验证，证据见[关闭验证归档](evidence/t2-synthetic-2026-10-24/README.md#限定范围关闭验证)。
本轮文档59项、公共模块41套件662项通过（exit0）；文档门禁、语法、diff及本地链接检查通过。状态切换时旧校验器红灯及空白正例夹具遗漏导致的失败均另行保留，详见执行记录§17.2。

关闭范围仅 ENGINEERING_SYNTHETIC_ONLY；DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、高级恢复/新回收 REMAINDER_DEFERRED 保留。
不关闭 D01/T2-G 或高级恢复验收，不自动启动 T3–T9，不将 SL-01 标为整体 COVERED。
默认关闭、旧客户端升级拒绝和全部现有安全运行依赖不变；仅合成验证，不部署、不提交或推送 Git。

### 22.7 D2B-05 查询超时批准关闭（2026-10-24）

**Decision:** APPROVED / CLOSED。**Scope:** QUERY_ONLY。
用户明确批准复审通过，关闭 D2B-05 查询超时，更新门禁及评审记录，验证后提交/推送当前分支并同步 PR #27；不合并、不部署。
此次关闭仅针对 `userDeletionRecoveryReadiness` 重复展开引用查询导致的 MongoDB code50，不是 D2B 整批、高级恢复或新回收的验收关闭。

修复提交 `e744cba13c303852515e599e7617269819d8d615`：按组提取共同条件，保留完整代次、媒体槽位、ObjectId/字符串异常见证及最终家庭/孩子校验；没有增加超时、放宽断言、删减测试或改变默认开关。
[CI 40099315976](https://github.com/mflyn/LMS/actions/runs/40099315976) 成功：后端143套件3958项、前端40套件490项，Task 11/12 集成、5项浏览器测试、构建和合成 Compose 门禁通过。
CI 的临时合并测试提交 `72d1878df8ef52ffdd5ff1fd176ca648ddf7165d` 不是实际合并；本轮也不设置自动合并。
复审另行无名称筛选重跑相关套件139项通过，文档门禁通过；未发现新增正确性/安全问题。查询仍可使用 COLLSCAN，合成耗时不作为任意规模的性能保证。

原 §22.6、[批准正本](family-self-directed-learning-t2-closure-approval.json)、3943项历史失败、上次CI的3951项中1项失败，以及修复过程中13项文档锚点失败均保留，不拼接成“历史全绿”。
新增关闭记录与本轮状态验证见[执行记录 §18](family-self-directed-learning-t2-execution.md#18-d2b-05-查询超时复审与批准关闭2026-10-24)；原修复证据见[证据索引](evidence/t2-synthetic-2026-10-24/README.md#d2b-05-查询缺陷关闭)。
DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、D01/T2-G、D2b剩余/D3/D4/E、C-CACHE-P3 的 REMAINDER_DEFERRED 不变；不启用 cleanup/restore，不修改产品代码或真实数据，不自动启动 T3–T9。

### 22.8 Ubuntu QA 后修订交接（2026-10-25）

新增QA-T2-FOCUS-001、QA-T2-WEBKIT-FIXTURE-001、QA-T12-INVITATION-WAIT-001已修订并本地验证，IMPLEMENTED / READY_FOR_QA。
QA-T2-D2B-BUDGET-001的闭包去重及键查找优化已实现，IMPLEMENTED / SERVER_VALIDATION_PENDING；原Ubuntu2CPU/3GiB的120秒预算仍须复验，不用本机通过关闭。
[修订及独立代码评审](family-self-directed-learning-t2-qa-p2-review.md)和[隔离测试步骤](family-self-directed-learning-t2-server-test.md)作为本轮交接入口。
原批准快照、历史失败及QUERY_ONLY关闭不变，DEVICE_PENDING、高级恢复/新回收REMAINDER_DEFERRED保持。
用户授权提交推送当前专用分支、同步PR #27并检查CI；不合并、不部署、不自动开启后置功能。新CI按新提交单独记录，不覆盖旧失败。

2026-10-25续项：固定4dff6871的Ubuntu完整readiness出现明确120000ms超时（141通过/1失败），
QA-T2-D2B-BUDGET-001保持OPEN；不得用其后的家庭全量或单例通过覆盖。
[同限额测量及聚焦修订](family-self-directed-learning-t2-d2b-budget-followup.md)在新目录单独留证，
开发自测不代替独立QA关闭。本续项没有新的Git写入、合并或部署授权，其他保留边界不变。

### 22.9 D2B 预算及隔离 P3 批准关闭（2026-10-25）

**D2B budget:** APPROVED / CLOSED / SYNTHETIC_ONLY
**D2B isolation P3:** APPROVED / CLOSED
**D2B retained:** HISTORICAL_FAILURES_PRESERVED / DEVICE_PENDING / REMAINDER_DEFERRED / T8_PENDING / NOT_AUTHORIZED

§22.8 为当时待验收快照；用户本次批准复审通过，关闭 QA-T2-D2B-BUDGET-001 及组合结果双向隔离 P3 测试保护缺口。
证据及复审见[预算续项 §6](family-self-directed-learning-t2-d2b-budget-followup.md#6-复审通过及批准关闭2026-10-25)和[评审记录 §4](family-self-directed-learning-t2-qa-p2-review.md#4-d2b-预算及隔离-p3-批准关闭2026-10-25)。
Ubuntu同限额完整readiness142项、家庭144套件3972项、正式HTTP14项通过；最终P3断言补验6项，复审331项及别名/浅拷贝变异有效。
原批准快照和固定4dff6871预算失败不改写；最终断言补验不冒充全量重跑，源码和证据范围以归档轮次为准。
仅关闭上述缺陷，不关闭 D01/T2-G、D2b剩余/D3/D4/E、C-CACHE-P3 或高级恢复/新回收验收。
保留 DEVICE_PENDING、默认关闭和旧客户端升级拒绝，真实启用仍需 T8；本次不提交、推送、合并或部署。

关闭校验：文档门禁、80项状态测试（原64项加16项反例）、受影响校验器/测试lint及diff检查通过；54份归档与原批准快照不变。
命令及范围见[本轮验证](family-self-directed-learning-t2-d2b-budget-followup.md#61-本次关闭记录验证)，不据此声称业务全量重新执行。

### 22.10 三项独立 QA 关闭与合并条件（2026-10-25）

用户批准同步 QA-T2-FOCUS-001、QA-T2-WEBKIT-FIXTURE-001、QA-T12-INVITATION-WAIT-001 为
VERIFIED_CLOSED / AUTOMATED_SYNTHETIC_ONLY；§22.8 的 READY_FOR_QA 保留为历史交接状态。
固定4dff6871独立复评的85份归档核对一致，相关前端及浏览器源码至07ffca67未变。
逐项结论、可携带证据指纹及环境边界见[评审记录 §5](family-self-directed-learning-t2-qa-p2-review.md#5-三项独立-qa-关闭与条件合并授权2026-10-25)。
原独立R1的D2B超时和原批准失败不回写；预算缺陷后续关闭与三项自动化QA关闭分开记录。
本次仅授权文档验证后提交推送，等待新提交CI通过再将PR #27转为Ready并以merge commit合并main，随后核对main的CI；不是部署授权。
DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED及全部REMAINDER_DEFERRED保持；不关闭高级恢复/新回收，不更改默认开关或旧客户端拒绝策略。

### 22.11 四项独立 QA 最终收口与合并暂停（2026-10-25）

**Current independent QA:** VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE（四项，非产品/真机/发布批准）
**Current authorization:** COMMIT_PUSH_PR_SYNC_ALLOWED / NO_MERGE_DEPLOY

FOCUS、WEBKIT-FIXTURE、INVITATION-WAIT三项由R1独立复评关闭，D2B-BUDGET由R2最终九文件候选的同限额独立回归关闭。
根因、候选映射、完整计数、原始/归档SHA-256及历史失败链见[评审记录 §6](family-self-directed-learning-t2-qa-p2-review.md#6-四项最终独立-qa-与本地收口2026-10-25)。
R2家庭144套件3972项从始至终使用最终深隔离断言；后续CI3988项另含16项文档状态反例，不能混称同一轮或同一九文件候选。
§22.10的条件合并授权已由用户“仅本地修改，暂不合并”取代。2026-10-25四项文档收口复审通过后，用户另授权验证后提交推送当前分支、同步PR #27并检查CI；不转Ready、不合并、不部署，不设置自动合并。a9e21fe6此前已推送，不回滚或改写。
复审核对R1/R2身份、计数与哈希、开发/独立证据区分及历史失败无新增问题，详见[复审通过记录 §6.2](family-self-directed-learning-t2-qa-p2-review.md#62-四项文档收口复审通过及提交授权)。新提交CI独立留证，不用既有CI成功代替。
原批准失败、R1超时、开发红灯与旧QUERY_ONLY关闭保持；DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED和全部REMAINDER_DEFERRED不变。
