# R3 正式应用装配：接入、兼容与回滚方案

**Status:** APPROVED / CLOSED（2026-10-23）；R3 四步及相应审查项已关闭，T1 后端工程总门禁及 R4 汇总项亦经用户批准关闭，仅限合成验收，不是部署授权。

依据：[总体设计](family-self-directed-learning-system-design.md)、[API 契约](../api/family-learning-tracker-api.md)、
[验收归并 R3/R4](../development/family-self-directed-learning-t1-acceptance-reconciliation.md)、
[R2 运维准备](../deployment/completion-operations.md)。当前关闭裁决见 Gate §18.40；以下实施阶段表述保留为获批方案的历史，不重新产生待办。

## 1. 目标与授权边界

将已独立验证的完成协议装入 homework/resource 的正式 `createProductionApp` / `startServer`，
保留 Gateway 身份认证、家庭隔离、服务凭据、响应及错误契约。不重新实现事务状态机或跨服务直写。

用户已批准按四步实施，第 1–3 步已关闭，本批实现第 4 步正式链路与配置准备，且仅在合成环境验证。
批准不等于向真实家庭开放新协议；真实库索引准备、持久卷挂载、密钥变更、发布及数据恢复仍须单独授权。本批仅更新默认关闭的 Compose 示例。
T2 客户端适配、R4 正式入口验收、T8 真实介质及恢复演练不因 R3 完成而提前关闭。

## 2. 当前入口及实际兼容缺口

| 入口 | 当前实现 | R3 必须解决 |
| --- | --- | --- |
| homework 正式应用 | 第 3 步 enabled 延迟装配统一新路由，材料服务 `completionIsolation: true` | 完整 Gateway 链路和真实启用仍须后续验收 |
| 任务 GET | enabled 使用独立只读服务；legacy 保留原行为 | GET 不推进 pending、不发星、不调用媒体写接口 |
| 任务材料 PATCH | enabled 按是否显式包含材料字段分派；先授权，再严格解析 | 原材料意图恢复、最终 owner/版本 CAS，不按错误回退旧路由 |
| resource 内部引用 | 第 2 步 enabled 已挂 `mediaReferenceProtocolRouter`；legacy 保留原路由 | 真实 Gateway/三服务正式链路留给后续步骤；混合/不完整协议不得回退 |
| 媒体 DELETE | 第 2 步 enabled 按实时授权范围内 Asset/Tombstone 分派；legacy 不变 | 后续正式链路验收，不按客户端 purpose 或异常码回退 |
| 家长与孩子客户端 | `family/TasksPage.js` 完成/确认缺版本；`childApi.js` 完成白名单不含 UUID/版本/作品集合 | 新协议缺字段已有 `400 CLIENT_UPGRADE_REQUIRED`；不能声称直接启用后旧前端仍可完成/确认 |

源码定位：[homework server](../../backend/services/homework-service/server.js)、
[resource server](../../backend/services/resource-service/server.js)、
[任务路由](../../backend/services/homework-service/routes/growthTasks.js)、
[孩子 API](../../frontend/web/src/services/childApi.js)、[家长页面](../../frontend/web/src/pages/family/TasksPage.js)。

## 3. 方案选择与启用条件

比较三种方式：直接替换最少配置但会立即破坏旧客户端；按请求字段自动回退旧协议容易绕过版本/CAS；
推荐显式运行模式加停写窗口，代价是启用/重启需要协调，适合当前单家庭部署。

`COMPLETION_PROTOCOL_MODE` 只在启动时读取，不支持每请求切换；下表描述批准后的完整目标。
第 1 步已实现 legacy/maintenance 和 enabled 前置检查。第 2 步 resource enabled 在自身预检和 scanner
初始化成功后使用正式组合监听；第 3 步 homework enabled 在自身预检和必要 MQ 初始化成功后装配监听。
两服务尚不可作为完整新功能开放；两端 enabled 均拒绝注入 app、依赖工厂或自定义启动工厂绕过正式装配。
直接创建正式应用供合成 HTTP 测试使用，不替代 `startServer` 的启动预检。

| 模式 | 行为 | 限制 |
| --- | --- | --- |
| `legacy`（未配置时默认） | 保持旧路由，不加载新协议 writer | 启动时用 native 只读检查阻止已有新协议持久状态的数据库回到旧 writer；检查失败不监听 |
| `maintenance` | 相关 `/api/growth-tasks`、`/api/media`、内部引用入口全部阻断，含可能触发恢复的旧 GET | 认证后返回固定 `503 COMPLETION_MAINTENANCE`，不调用 writer；此模式不是恢复执行器 |
| `enabled` | 预检成功后装配完整新协议及受保护的旧材料能力 | 失败不监听、不降级 legacy，不允许仅“部分新路由”对外服务 |

未知/空的显式模式值启动失败。健康信息只暴露模式/就绪状态，不暴露路径、凭据、对象 ID。
maintenance 要覆盖 Gateway 直通的媒体 content 路径，不能把签名内容 URL 误当成普通 JWT 路由；
停写窗口允许媒体短暂不可用，不借此改动正常 enabled 模式的签名验证。

启用和 enabled 重启顺序：

1. 运维实际阻断外部入口及其他实例、analytics/user 等旧引用写入方和清理任务，等待在途请求结束。
   单服务 maintenance 不能充当跨服务锁；容器滚动混跑和无协调自动重启不在本次支持范围。
2. 备份/索引清单/日志卷检查按 R2 执行。分别预检两个服务自己的数据库，不共享 URI、不跨服务写库。
3. 运维声明 `COMPLETION_WRITES_PAUSED=true`，仅从受控配置取得；不能在代码里硬编码 `writesPaused: true`
   把在线启动伪装成停写预检。每次 enabled 启动重新检查；声明不证明停写，人工及入口隔离仍必需。
4. 数据库禁用 autoIndex/autoCreate，再运行本地预检；resource 另运行完整存储探针，
   校验媒体/删除日志受保护目录以及实际运行 UID。不得自动建索引、修复数据或改目录权限。
5. 配置和凭据先验证；连接、预检、依赖装配及必要的 scanner/MQ 初始化成功后才监听。
   任一步失败均关闭本次建立的连接/句柄/队列，监听错误也进入收尾；错误只输出稳定脱敏 code。
   注入 app/connection 的测试入口不能绕过启动门禁；不能关闭不属于本次启动的外部连接。
6. 外部入口仍封闭时先启 resource，再启 homework，核对模式和配置一致；完成合成探针/验收后才考虑另批放行。
   一端旧版/maintenance、另一端 enabled 时不能用旧协议回退“自愈”；拒绝或保留可恢复 pending。

第 1 步正式工厂使用现有默认 Mongoose 模型连接，不提供多连接正式装配；传入其他连接返回
`COMPLETION_CONNECTION_MISMATCH`，默认 `startServer` 在连接前拒绝，防止检查 B 库却用 A 库模型服务请求。
legacy/maintenance 的显式注入 app/custom factory 仅供可信测试宿主，宿主负责模型绑定；仍须通过模式和所声明连接的预检。
enabled 禁止注入 app；两服务在连接前拒绝自定义启动工厂，正式工厂拒绝替代媒体依赖/路由工厂。
不能用测试入口规避正式装配。部分 MQ 初始化后的清理失败必须保留 `COMPLETION_STARTUP_CLEANUP_FAILED`。

legacy 防回退检查不加载新模型或建集合：homework 检查 operation 账本和任务的新 owner/pending、非零完成版本、
完成证据/精确绑定；resource 检查 operation/tombstone/receipt 和 `completionMediaIds` 引用（包括 released）。
发现任一新协议持久状态或检查不确定就拒绝 legacy 启动。历史版本缺失/0 本身不触发迁移，
但不能仅凭 pending=0 推断可安全降级；历史终态和已删除媒体证据同样属于新协议状态。

## 4. 装配与分流

### 4.1 homework

- 在 `server.js` 的 enabled 分支延迟装配本地 transactionRunner、`createCompletionMediaReferenceClient`、
  `createStarAwardClient(...).awardTaskStar`，注入既有 completion/confirmation/read/mutation 工厂。
  保留旧 `createMediaReferenceClient` 专供材料引用，不把新字段塞入旧 client。
- 材料服务明确设 `completionIsolation: true`，复用持久版本基线、owner/阶段 CAS 和旧 pending 接续。
  不从读接口自动恢复；在授权的原修改请求中接续。创建已返回 pending 任务 ID 时，以该 ID 和原附件集合 PATCH 接续，不能再次 POST 创建第二个任务。
- 建立单一正式路由组合，不依赖“先挂新路由，失败 next 到旧路由”的顺序技巧：

| 路由 | enabled 处理者 |
| --- | --- |
| POST `/api/growth-tasks` | 复用严格创建校验及开启隔离的材料创建；禁传 completion 内部字段 |
| GET 列表/详情 | `createGrowthTaskCompletionReadRouter`，不走旧 GET |
| PATCH `/:taskId/complete`、`/confirm` | `createGrowthTaskCompletionRouter`，无旧 handler 回退 |
| PATCH `/:taskId` 无材料字段 | 新 mutation.edit，保留显式转换/校验、null 语义及最终 CAS |
| PATCH `/:taskId` 含材料字段 | 先身份/实时家庭归属检查，再严格解析完整 body，调用隔离材料 mutate；空数组也是明确材料变更 |
| DELETE `/:taskId` | 新 mutation.remove，取消/归档，不物理删除任务或绕过发星恢复 |

- 材料+普通字段在同一现有材料意图中提交，不能先普通编辑再补附件造成半成功。
  提取最小共享授权/返回白名单，避免复制旧路由的鉴权后置或直接 `task.save()` 分支。
  成功响应不泄露 active owner、remoteOperationId、摘要或 pending 内部字段。
- pending 材料恢复同时核对原附件顺序和持久普通字段 patch；相同附件但不同普通字段返回 `409 RESOURCE_CONFLICT`，不推进旧意图。
  重读必须仍匹配首次读取的作用域、operation、阶段、种类、版本、fence 和完整材料/patch 快照；
  不匹配返回 `503 MEDIA_REFERENCE_PENDING`，不得推进另一个 pending 意图或把另一个稳定结果作为本次成功。
  该检查先于稳定结果返回、旧 pending 接续及远端写调用，初次读取为稳定状态的材料编辑同样受保护。
  仅提交相同附件且无普通字段修改的空更新，最后一次只读加载也须匹配该快照；不一致返回同一 503，
  不通过调用恢复流程推进新意图。无竞争时返回 200，不增加数据库版本、媒体或发星调用。
  同一快照的旧版本零 pending 仍按既有 CAS 接续；后续 owner/阶段/版本 CAS 保留。
  创建的 pending patch 为空，故使用仅附件字段的 PATCH 恢复；GET 保持只读。材料 `503 MEDIA_REFERENCE_PENDING`
  只保留经校验的 `error.details.resourceId` 对象供调用者定位任务，其他远程详情不透传。
- 不改 progress 记星账本协议；使用真实 HTTP client，保留首次确认人/时间、共管接续及记星幂等。

### 4.2 resource 与 Gateway

- 在 `server.js` enabled 分支用同一服务连接构造 transactionRunner、operationService、privacyService、
  私有 store 与受保护删除 journal；内部挂既有 `createMediaReferenceProtocolRouter`。
  完成引用全组走新协议，材料/错题/avatar 保持原合法路径；混合字段、稀疏集合、摘要缺失等显式拒绝。
- 公共媒体 DELETE 需新增最小分派适配，复用既有 `createMediaRouter` 的其他能力：
  按数据库中 Asset/Tombstone 判定完成作品；完成作品（包括 Asset 已清理但墓碑仍在）只走 privacyService。
  其他 purpose 继续走旧删除服务。不按请求参数判定，不捕获新服务错误后再尝试旧删除。
  分派先验证实时用户和家庭成员；家长查询限定实时 `childIds`，仅无 child 的 avatar 例外，孩子限定本人及有效令牌代次。
  Asset/Tombstone 使用同一范围，移出家庭的孩子、其他家庭、缺失对象统一 404；选中的服务再次鉴权。
  墓碑优先于冲突 Asset，查询失败固定 503，不回退旧删除。
- enabled 公共媒体 DELETE 统一拒绝非空 body；完成作品保持 204、整组事务、精确凭证与日志确认语义，重复删除不改首次审计。
  上传、access、content 保留原签名/授权与缓存规则；私有媒体和 journal 都不能挂到 `/uploads`。
- 清理仍仅为显式 CLI，保留 30 天及最后释放门槛，不启动 cron、不增加公共清理 API。
- Gateway 现有 `/api/growth-tasks` 和 `/api/media` 前缀可继续代理；不新增公网内部引用或发星入口，
  不让客户端注入服务凭据。Gateway 在公开入口统一剥除客户端 `x-service-token`，包括登录和签名 content 旁路；
  服务间凭据仅由服务端 client 注入，内部前缀不对外代理。身份封装、子令牌代次和家庭隔离已有合成 HTTP 测试。

## 5. 客户端与旧数据兼容

- 旧任务没有版本按已批准的历史版本 0 处理，不批量补写数据；读取增加公开字段但保持原核心字段。
  旧材料 pending 仅由授权写重试按原意图恢复，GET 无副作用。
- 新 complete 需要 UUID、expectedCompletionVersion、expectedChecklistVersion、checkedItemIds 和完整作品集合；
  confirm 需要 expectedCompletionVersion。缺版本/UUID 保持 `400 CLIENT_UPGRADE_REQUIRED`，
  不由服务端自动生成、不默认为当前版本，不允许请求 body 选择旧 writer。
- 当前 Web 客户端不兼容新完成/确认契约。本方案仅在合成环境启用；默认真实环境继续 legacy（无新协议数据时）。
  开放给家庭前，T2 客户端必须支持稳定操作 ID、相同命令重试、冲突/升级提示及新公开字段，并完成相关验收。
  若希望 R3 同时交付最小客户端适配，须另外批准扩大范围，不能默认为已授权。

## 6. 回滚与故障处置

| 时点 | 可执行处置 | 禁止操作 |
| --- | --- | --- |
| 仅部署代码，尚未启用/写入 | 保持外部停写，停止新进程；两个服务分别检查无新协议状态，再撤回装配或使用受保护 legacy 模式 | 凭开关值/空 pending 推断无新状态；任意 drop 索引 |
| 启用后首次请求之前且能证明无新状态 | 同上；索引撤回仅按 R2 的逐项清单和单独授权 | 省略 resource 账本/删除证据检查 |
| 已有任意新协议写入，包括 FAILED/ABORTED 或隐私删除 | 先封闭外部入口并停写，保留数据库、媒体、journal；回到支持新协议的已验证版本，在受控访问下重放原命令恢复 pending，或前进修复 | 切 legacy/旧二进制继续写；删映射/账本/凭证；用旧快照恢复已删除正文 |
| 元数据/远程结果未知、日志或介质故障 | 保持失败阻断，留存现场；修复存储/连接后显式恢复，核对首次审计与账本唯一性 | 自动更换 UUID、非事务重试、将 503 当已回滚或转旧服务 |

maintenance 本身不运行恢复。恢复需在入口隔离下启用兼容的新协议版本，并通过原授权命令执行；
不新增绕过家庭权限的管理恢复接口。两个服务的代码版本、配置和数据库事实必须一起核对。
旧二进制不含防降级检查，因此技术检查不能代替发布纪律；已有新状态后禁止启动该二进制接收流量。
数据快照回退、删除日志合并及真实灾难恢复另按 T8 审批，本方案不提供未经演练的“直接恢复数据库”捷径。

## 7. 批准后的实现顺序与验收

按四个小步执行，不再扩成独立故障组合批次；每步新增测试先红后绿，证据归入 R3：

1. **模式与启动门禁**（CLOSED，2026-10-23 用户复审批准）：两个 `server.js`、共享启动助手及生命周期测试；新增
   `backend/common/deployment/__tests__/completionActivation.test.js` 和 `completionActivationReadiness.test.js`，
   同时参数化验证两个服务。覆盖模式值、默认 legacy 冷加载、已有新状态拒绝降级、
   两端分服务预检、缺索引不自动创建、预检/监听/队列失败收尾及错误脱敏。
2. **resource 正式组合**（CLOSED，2026-10-23 用户复审批准，含单次响应 P3）：`server.js`、`routes/media.js` 及必要的删除分派；新建
   `__tests__/completionProductionAssembly.test.js`。覆盖旧新协议与 purpose 分流、越权、清理后墓碑删除、
   日志失败 503/重试、maintenance 内容路径阻断、旧 handler 不被调用及所有既有安全 profile。
3. **homework 正式组合**（CLOSED，2026-10-23 用户复审批准，含材料快照与空更新 P2）：`server.js` 与最小组合模块，旧 `routes/growthTasks.js` 不接收新请求；新建
   `__tests__/services/growthTaskCompletionProductionAssembly.test.js`。覆盖读无副作用、完整新命令、
   旧客户端升级拒绝、材料混合 PATCH/旧 pending、权限优先、完成与确认/编辑/归档竞争及丢响应恢复。
4. **正式链路、文档及部署配置准备**（IMPLEMENTED / READY_FOR_REVIEW）：用 Gateway + 正式工厂 + 真实媒体/记星 HTTP 验证，
   以合成数据库/临时目录演练写入前撤回及写入后拒绝降级。更新已有隔离用例为“legacy 保持隔离、
   enabled 正确装配、maintenance 阻断”，不是删除隔离断言。需要的 Compose/env 示例保持默认不启用，
   journal 必须独立持久挂载；只用合成变量做 `docker compose ... config -q`，不启动真实服务。
   将获批模式、维护错误码及路由分派同步到总体设计/API/运维/需求追踪与门禁，不提前把本待审方案当作现行契约。

验证命令使用现有 `npm run test:family-regression`（含原用例）、`npm run docs:family:check`、
`git diff --check`；固定源码/命令/退出码/报告/新旧用例对比。涉及 Gateway 配置另跑现有路由/身份测试。
R4-G1/G2 仍按归并清单补齐或复用等价证据，不在 R3 方案中宣称完成。
所有验证通过只提交 R3 评审，不自动关闭 R4/T1；真实启用需单独核验客户端、发布条件与回滚责任人。

## 8. 批准记录与当前边界

2026-10-23 用户批准显式三模式与停写启动策略、严格新契约及旧客户端升级拒绝、服务器持久事实删除分派、
写入后禁止回退旧 writer，以及四步后端实施顺序。第 1–3 步及对应 P1/P2/P3 已获用户批准关闭；
不扩大前端范围，不部署真实环境。维护模式只拒绝，旧模式仍使用原路由；两端 enabled 装配新协议。
2026-10-23 用户批准关闭第 4 步及控制键 P2，R3 四步范围 CLOSED；R4/T1 不自动关闭。批准与历史证据见 [Gate §18.37.2](../development/family-self-directed-learning-mvp-gate.md)，后续 G1/G2 证据见 §18.38。
后续用户另行批准 R4 G1/G2、两项 P2 及 T1/R4 总门禁关闭（Gate §18.38.1、§18.40）；不扩展本方案的真实部署授权。
配置准备仅覆盖家庭最小栈与 Ubuntu 栈，默认 legacy/停写 false/存储确认 false；resource 独立挂载 journal。
目录属主、0700 权限、完整祖先链、持久介质及备份仍须按运维前提核实，不自动修权或建索引。
合成链路使用已签发 JWT、临时副本集和回环 HTTP，不声称真实登录、物理分库或容器部署已验收。
