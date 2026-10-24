# T2 作品提交、孩子回看与家长审核详细设计

**Status:** APPROVED
**User approval:** APPROVED（设计 2026-10-23；2026-10-24 三项 P2 及限定合成范围工程总门禁关闭，执行记录 §17）
**Scope:** BACKEND_SYNTHETIC_ONLY + FRONTEND_SYNTHETIC；不是部署授权
**Implementation:** T2-1/T2-R 后端 CLOSED；T2-2 至 T2-6 合成工程汇总验收 APPROVED / CLOSED，T2 CLOSED（ENGINEERING_SYNTHETIC_ONLY）；最新全量仍 FAILED（D2B-05）；T2-G REMAINDER_DEFERRED；真实设备 DEVICE_PENDING，T8_PENDING / NOT_AUTHORIZED；当前裁决见[执行记录 §17](../../development/family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)

**2026-10-24 范围调整（用户批准）：** 高级恢复与新孤儿回收取消对页面开发的前置阻塞。
当前范围、必要运行依赖和交付门禁统一见[执行记录 §11](../../development/family-self-directed-learning-t2-execution.md#11-2026-10-24-mvp-范围调整与页面运行依赖)。
本次调整不改变 API、权限、幂等、审核版本或隐私删除契约；旧日期的批准/审查记录保留为历史。

## 1. 输入、目标与排除项

依据：[系统设计 §8.2](../../architecture/family-self-directed-learning-system-design.md#82-任务完成页)、
[实施计划 T2](../plans/2026-10-21-family-self-directed-learning-mvp.md)、
[API §14.2](../../api/family-learning-tracker-api.md#142-sl-01sl-03任务清单和完成作品)、
[T1 Gate](../../development/family-self-directed-learning-mvp-gate.md) §18.40。
本设计不覆盖正式 API；文档中的早期“未装配”段落按其批次历史解读，当前装配以 T1 关闭记录及正式工厂为准。
2026-10-23 用户要求补齐退出恢复与安全回收，不接受原有限制作为默认交付。
[恢复与回收补充设计](2026-10-23-family-self-directed-learning-t2-recovery-retention-design.md)提出后端前置批次 T2-R/T2-G，
其新增 API/模型已通过独立设计评审并获用户批准，本文件相关恢复/回收条款以该补充为准，不代表已实现。

孩子可提交 0–10 张普通任务完成图片，确认前修改，刷新回看已绑定作品及家长反馈；
家长可查看实际作品、按所见版本确认，也可通过既有入口代录完成。保留真实 actor，不让前端填写审计身份。
同一能力适用于德智体美劳，不硬编码数学或只允许学校课内任务。

不新增 PDF 完成作品、HEIC 解码器、OCR、画板、作品版本库、独立求助、清单编辑或后台同步。
公开恢复接口仅限补充设计中的原提交者恢复，不开放内部 operation、代交或强制解锁能力。
T3/T4 不提前实施，但已有清单快照的展示/勾选及版本传递属于本包。已有任务材料/错题 PDF 不移除。
仅合成账号/媒体和回环服务。保持旧客户端升级拒绝、生产默认 legacy/false/false、写入后不回退旧 writer。

## 2. 方案与现状

推荐：API/命令状态与媒体生命周期先行，再复用孩子/家长页面，最后正式 enabled 链路 QA。
当前顺序为已完成 T2-1/T2-R → T2-2 至 T2-5 最小页面闭环 → T2-6 集成验收；T2-G 未完成部分独立后置。
备选：先做孩子端完整纵向切片，再抽共用逻辑；能更早看到页面，但未知结果恢复/家长代录容易重复实现。
不选择新建另一套前端或放宽旧请求；前者超出范围，后者违反 T1 契约。
以上设计及补充方案已获用户批准，按执行记录逐批实施，不据此跳过批次验收。

设计时基线（历史差距，当前实现及证据见执行记录 §12）：
- [childApi](../../../frontend/web/src/services/childApi.js) 的 completeOwnTask 仅放行五个旧业务字段。
- [ChildTaskPage](../../../frontend/web/src/pages/child/ChildTaskPage.js) 仅 pending 可提交，没有作品/反馈回看；
  [ChildTodayPage](../../../frontend/web/src/pages/child/ChildTodayPage.js) 仅 pending 是链接。
- [TasksPage](../../../frontend/web/src/pages/family/TasksPage.js) 没有作品审核详情，确认不带所见版本。
- [privateMediaRules](../../../frontend/web/src/components/family/privateMediaRules.js) 缺 task_completion 规则，落入默认单图。
- [集合控件](../../../frontend/web/src/components/family/PrivateMediaCollectionField.js) 可复用上传/描述，但缺细粒度访问/删除状态；
  [useDraftMedia](../../../frontend/web/src/hooks/useDraftMedia.js) 的卸载删除不能用于未知完成命令。
- [旧 E2E runtime](../../../backend/tests/task11/serviceRuntime.js) 注入旧完成路由，不能作为新协议通过的证据。

## 3. 组件与接口边界

沿用现有 React/Router、family/child 样式及媒体 API。新增共用模块限定于完成作品，不重构无关页面：

| 模块 | 职责 |
| --- | --- |
| childApi / familyApi | 严格传递完成/确认公开字段及当前身份；不调用内部 operation，不提供旧请求 fallback |
| familySession、AuthContext、ChildAuthContext、FamilyContext | 区分过期与主动退出；跨标签同步身份；发送时身份快照与迟到 401 防护；不更换后端认证协议 |
| completionCommandStore（拟新增） | 规范输入、原命令 sessionStorage 保存/读取/校验/删除；不做网络或自动恢复 |
| useTaskCompletion（拟新增） | 任务/scope generation、完成状态机、显式原命令重试、结果校验、成功后刷新详情 |
| TaskCompletionEvidence（拟新增） | 共用作品、自评、反馈、只读/编辑呈现；审核版本来自已加载的详情 |
| PrivateMediaCollectionField 或受限适配层 | 在保持旧调用方行为的条件下，增加完成作品访问、删除占位及异步 scope 保护 |
| ChildTaskPage / ChildTodayPage / TasksPage | 页面入口和命令交互，不复制恢复状态机或推断后台成功 |

公开 complete 必带 operationId、expectedCompletionVersion、expectedChecklistVersion、checkedItemIds、completionMediaIds；
允许 actualMinutes、actualAmount、difficulty、needsHelp、childNote。未知字段、remoteOperationId 和审计字段不发送。
每次完成提交是完整快照；上述可选字段省略即本次未填写，发布事务同时unset旧顶层兼容值。
页面清空用时/数量继续省略，不发送0/null冒充空白；原命令规范化/哈希不变，历史成功重放不重写当前快照。
实际数值空输入省略，0 保留；complete 的数值和备注不接受 null，不能套用普通 PATCH 的清空语义。
完成图片有序唯一；UUID/媒体 ID 规范化为小写，勾选项按服务端允许规则规范化；首次发送后冻结整个正文。
旧任务版本 0 由新 GET 投影明确返回；新字段缺失的旧路由响应不默认为“可按新协议写入”，展示升级/不可用错误。
确认仅发送 expectedCompletionVersion 与可选 parentFeedback，版本必须来自用户当前看到的详情。

## 4. 完成命令生命周期与恢复

| 状态 | 进入条件 | 允许动作 |
| --- | --- | --- |
| editing | 新 GET 返回可编辑 pending/completed，且无本地待确认命令 | 编辑/选择图片；不能把上传当绑定 |
| uploading | 一个或多个文件正在上传 | 等待/停止后续上传；禁提交和冲突编辑 |
| prepared_local | 最小原命令保存并回读校验成功，尚未发 HTTP | 发送同一命令；存储失败则不发送 |
| sending | HTTP 已发出 | 禁双击/改正文；中断或网络丢失按未知结果处理 |
| uncertain | 503、断链、超时、成功响应畸形、客户端取消但无法证明服务端未处理 | 仅“重试本次提交”与只读刷新；禁止换 UUID 或改命令 |
| awaiting_auth | 401 或身份过期 | 清 UI/URL，重新登录；仅同 actor/家庭/孩子重新验证后可重试原命令 |
| terminal | 已验证固定成功投影或受信公开稳定失败 | 清命令存储；成功后 GET 当前详情，失败展示可操作原因 |
| recovery_discovery | GET 为 pending_recovery 且本地原命令缺失/损坏 | 调用拟新增只读发现；同actor显式恢复，不猜测正文 |
| recovery_unavailable | 另一actor持有意图，或持久映射不一致/失去权限 | 只读或拒绝，提示原提交者/受控排查；不清服务器锁 |

1. 提交先完成校验，生成一次 UUID，保存规范正文与 scope，再发送。只读 GET 不恢复。发送函数不得自动改变版本。
2. 完整成功响应需匹配 taskId、目标 completionVersion、原有序媒体集合及已定义字段；只收到 2xx 不算成功。
   终态重放可能返回旧投影，不据此覆盖当前任务；成功后 GET 作为当前详情。GET 失败显示“提交已确认，详情加载失败”，不重提新命令。
3. 正常首次请求的结构化校验/版本拒绝可退出提交；已经未知的请求不凭任意裸 4xx 清锁或认定远程终止。
   MEDIA_OPERATION_EXPIRED/ABORTED 等稳定错误按原 PATCH 的公开契约展示；IDEMPOTENCY_KEY_REUSED 为命令损坏/冲突，
   保留诊断状态并阻止自动更换 ID。401/403 清除敏感视图，不因错误反复自动请求。
4. 控件只允许当前 scope generation 的结果更新 UI；AbortController 仅用于请求取消，不是服务端回滚证明。
   切任务/孩子后旧 Promise 的 success/catch/finally 不得改变新页面的 task、busy、错误、媒体或命令。

### 4.0 完成错误分类

以下只作用于该命令对应的公开 `PATCH /api/growth-tasks/:taskId/complete`，不能套用到 GET、上传、删除或 confirm。
响应须来自当前请求上下文，错误正文符合 `{success:false,error:{code,message,details}}` 的正式契约，
status/code 配对匹配；HTML、空正文、未知 code 或不一致的配对均不能证明稳定失败。
API 包装层在分类前保留状态码与完整错误结构，不先 unwrap 丢失契约信息。

| HTTP / code | 首次发送及未知后原命令重试的处理 | 本地命令与新提交 |
| --- | --- | --- |
| 200 / 有效成功投影 | 校验 taskId、目标版本、有序集合及成功字段，随后 GET 最新详情 | 清 envelope；GET 成功且任务允许编辑后才可新命令 |
| 409 / MEDIA_OPERATION_EXPIRED、MEDIA_OPERATION_ABORTED | 正式服务已持久失败；GET 当前状态并展示原因 | 清 envelope；稳定可编辑且用户重新确认后才可新 UUID |
| 404 / RESOURCE_NOT_FOUND | 本端点将远程资源/用途/权限拒绝收敛为持久 FAILED；不只视为网络 404 | 同上；媒体不可用原因不细分，不静默替换集合 |
| 409 / VERSION_CONFLICT、TASK_STATE_CONFLICT | 当前原请求不再可执行；GET 重审，不能改原版本自动重试 | 退出本地命令；只有新用户意图才产生新 UUID |
| 400 / VALIDATION_ERROR、CHECKLIST_ITEM_INVALID、MEDIA_ATTACHMENT_LIMIT_EXCEEDED、CLIENT_UPGRADE_REQUIRED | 正式校验拒绝，不自动修正已冻结正文；升级错误阻断写入 | 首次且无未知历史可清；若已有未知历史则保留诊断/恢复阻断，须核实契约或客户端变化 |
| 401；403 / CHILD_ACCESS_DENIED 或认证拒绝 | 无法证明 operation 终态；清私有视图，重新鉴权/提示无权限 | 保留同 actor envelope，禁止新命令；不自动循环重试 |
| 409 / IDEMPOTENCY_KEY_REUSED | 正文/标识冲突，不能证明服务端原命令内容 | 保留诊断状态，禁止自动换 ID |
| 503 / MEDIA_REFERENCE_PENDING；其他 5xx、断链、超时、取消、畸形成功或错误 | uncertain；仅明确用户触发的原命令重试 | 保留，禁止新命令 |

`CLIENT_UPGRADE_REQUIRED` 已对照 complete/confirm 的正式 normalize 实现，状态为 400，测试固定此配对。
权限拒绝后的本地清理仍受 §4.1 的明确退出策略控制；清本地 envelope 永远不等于清服务端 owner。
即使稳定失败后 GET 发现另一命令 pending，也只能只读等待，不因本命令失败而开放冲突写入。

### 4.1 sessionStorage 与服务端恢复（设计已批准，前端实现待验收）

保存版本化 envelope：schemaVersion、actorId/role、familyId、childId、taskId、action、规范公开 body；
仅含恢复必要的 ID/版本/自评字段，childNote 属学习数据，必须明确其本地暂存用途。禁止图片字节、访问 URL、Token、远程 ID。
键包含完整 scope，存储内容不作为权限依据；每次使用仍由当前登录身份和服务端实时授权决定。
sessionStorage.setItem 后回读验证；不支持、配额不足或损坏时本次新提交 fail closed，不发送未验证的本地命令。
已在服务端占位的命令另有拟新增发现/恢复路径，不因浏览器存储异常假定后台失败。

- 页面刷新/同标签页离页：保留原命令，重新授权、加载任务后提供显式恢复按钮，不自动提交。
- 成功或明确终态失败：移除对应 envelope；存储删除失败时仍保留终态内存状态，重载后的同原命令重放必须幂等。
- 身份过期：清 UI，但当前标签页内保留原 envelope，待同 actor 重新登录；身份改变时不展示、不重放其他 scope 数据。
- 显式登出/账号切换：清理该 actor 的本地 envelope 和所有私有预览；必要时先提示未确认提交的恢复风险，不能阻止用户退出。
- 关闭标签页/清空浏览器数据/上述退出清理后：同actor重新登录，按补充设计发现并显式恢复服务器持久意图。
  不返回原正文、不要求保留旧标签；尚未发送/尚未占位的本地草稿不承诺恢复，原actor失去权限不允许他人冒充。
- 不使用永久 localStorage 保存命令，不加后台同步/IndexedDB，不按任意短 TTL 静默丢弃未知命令；浏览器生命周期和明确退出控制保留期。
- 多标签页各自隔离；复制标签页可能复制同 envelope，原命令重放仍须幂等。不同命令竞争由服务端 owner/CAS 拒绝，不跨 actor 接管完成。

用户已选择补充退出恢复设计；T2-R 接口与权限评审、实现验收是本恢复体验的前置条件，不接受原缺口作为默认豁免。

### 4.2 身份事件与请求快照

当前 `AuthContext` 将过期事件接到 logout，`FamilyContext` 的 401 也直接 logout；两个 API 包装层
每次读取共享 localStorage token，且任意迟到 401 会清当前 session。因此只改完成 hook 不足，T2-2 必须覆盖：
- 会话变更原因明确为 `expired`、`explicit_logout`、`account_switch`。过期清 UI/凭据但保留原命令；
  主动退出/换账号清旧 actor 命令，不能由过期事件间接走主动退出分支。家长和孩子同规则，FamilyContext 不再无条件二次 logout。
- 请求捕获角色、actor、session revision 与当前 token 的内存快照；发送完成/确认/媒体请求前核对调用方 scope 与
  实际 session 一致，并使用同一次捕获的 token 发送，不在 await 后换成另一身份。身份不一致则零 HTTP。
  familyId/childId 来自当前已核验上下文，后端仍负责实时家庭授权，前端快照不成为鉴权依据。
- 请求返回时仅同 session revision/token 可更新视图或执行过期清理；旧 401 只结束旧请求，不能注销新登录。
- Gateway对缺失、无效、过期JWT统一401/UNAUTHENTICATED，复用共享请求层expired分支保留命令；
  成员撤销/业务越权仍为403，不据此注销会话。内部身份信封构造故障不冒充JWT过期。
  token 只作内存相等性核对，不进 envelope、日志或测试归档。共享 API 包装层的非完成请求也须遵守该规则，防止旁路旧请求注销新会话。
- 当前标签页的明确身份事件与其他标签页 storage 事件都要同步上下文、失效旧请求和私有预览。
  非敏感 session revision/变更原因用于跨标签识别过期与退出，允许扩展既有本地 session 格式且兼容旧会话；
  事件不含正文/媒体 URL/额外 Token。外部未知清空视为失去会话，清视图但不冒充确认退出去丢弃恢复命令。
  即使 storage 事件延迟，发送时一致性核对仍必须阻止甲的 envelope 用乙的 token 发出。
- 同 actor 重新登录需重新授权后显式恢复；同家庭不同家长也不是同 actor。多标签退出按事件清各标签的对应命令，
  不宣称已同步关闭/挂起标签页的瞬时清理；恢复可见/发送前必须再次核验身份与退出标记。

## 5. 媒体生命周期与隐私

明确添加 task_completion 规则：JPEG/PNG/WebP、最多 10 张、每张 10 MiB；accept 只是选择提示，后端真实字节检查不变。
选多图按顺序上传，成功项保留、失败项独立反馈；上传未知时不把丢失响应的文件算作已绑定。
已绑定引用的普通移除只改变待提交列表，经 complete 成功后服务端解绑；不自动 DELETE 媒体。
草稿移除不影响已绑定资产。为避免串用途与未知结果误删，完成作品默认不在卸载/取消时自动 DELETE。

**孤儿保留缺口（已要求补设计，尚未实现）：** 当前上传创建 active 资产，两个正式 cleanup 都只回收 deleted 资产，
不存在可兜底的 active 孤儿回收。已知 ID 的当前草稿保留显式隐私删除入口；单纯移除只改集合，不声称正文已删除。
若上传落库后响应丢失、退出或关闭页面导致 ID 丢失，现有前端不能找回并删除该资产，也不能安全推断它是否被另一个请求引用。
用户已选择补齐安全回收设计；T2-G 采用双服务持久屏障与引用证据、先日志后删除，不能仅按年龄删 active。
T2-3 不再依赖 T2-G 批次验收。页面合成环境关闭新孤儿回收，保留已接入的上传、删除、屏障及预检依赖。
合成 fixture teardown 不充当产品回收证据；D01 随未启用回收范围后置，保持开放，不宣称已修复。
这不豁免当前上传/删除路径的安全缺陷；真实试点另验容量、保留期及备份恢复限制。
当前实际正文写入必须在返回storageKey前等待临时文件sync/close、原子不覆盖发布及目录sync；
同步失败不派发上传日志/metadata，仅清理本次拥有的路径并报告收尾失败。日志/metadata派发后保持既有结果未知保护，
不得补偿删除正文。合成故障/等待用例不等于真实断电或T8备份恢复验收。

隐私删除使用已有 DELETE /api/media/:id，清楚提示这是删除资产而非从本次列表移除；
确认/归档只冻结教学内容，不阻止合法隐私删除。删除未确认时进入 deleting/unknown 占位并移除当前预览，
重试相同 DELETE；成功保持不可读占位，保留任务版本/自评/星星事实。不得自动把已删除 ID 从已发布版本中删掉再提交。
访问失败按 unavailable/unauthorized/retryable 分类，单张不可用不掩盖其余项；不向用户区分不存在和跨家庭资源。

签名 URL 只保存在当前 scope 内存，不持久化。切任务/账号/孩子、登出或失去权限清理 URL 与描述缓存；
过期/图片加载错误时先清旧图，提供重新授权按钮，禁止无限刷新。网络慢的旧授权响应不能重新写回已删除项。
页面重新可见时重新校验已展示媒体可访问性；请求期间不展示待核验旧图。无推送时不承诺另一设备删除后所有打开页面瞬间清空，
但旧链接的后端访问拒绝必须在集成测试验证；本页面删除后必须立即清理 DOM/内存引用。
如使用对象 URL，替换/删除/卸载必须 revoke；不得缓存图片到 localStorage、Service Worker 或离线存储。

## 6. 页面状态与审核流程

孩子今日页：pending/completed/confirmed 都能进入本人详情；不新增完整历史作品库。取消/归档详情若可读则只读，不提供完成编辑。
详情从 GET 初始化表单，展示任务目标、材料、已有清单、自评与作品；completed 支持“修改本次完成”，confirmed 只读。
历史无作品显示“未添加作品”，不可用作品显示占位；家长反馈与提交事实单独显示，不用已确认状态推断星星到账。
“需要帮助”仍为完成时回顾，页面文案避免冒充 T3 实时求助；不强迫长文字，不加入排名/兄弟姐妹比较。

家长任务列表增加“查看/审核”入口，进入后重新读取详情；列表版本不充当审核版本。复用现有对话框或适配的详情区，
需可查看完整图片并支持 iPad 滚动/放大，不将图片裁切成不可检查内容的缩略图作为唯一展示。
确认前展示实际用量、自评、备注、图片与当前版本；没有图片也允许按契约确认，媒体不可用应明确告知而非假称已审图。
确认发送冻结所见版本。409 刷新并要求重新查看/确认；503 STAR_AWARD_PENDING 本身不能证明教学已确认，
本地确认事务回滚也返回该错误。确认使用独立状态机，不生成 operationId、不递增完成版本：
- 发送前保存当前所见版本及反馈快照（同 §4.1 身份/保留策略，action=confirm），忙碌/未知期间禁止改反馈自动重试。
- 200 须验证 taskId、所见完成版本、confirmed 状态及 awarded 字段等正式投影，随后 GET 最新详情；畸形响应仍未知。
- `503 MEDIA_REFERENCE_PENDING` 是媒体/完成恢复阻断，不进入发星恢复，也不反复自动 confirm。
  GET 显示 pending_recovery 时转同actor原PATCH或T2-R发现/显式恢复；其他actor或映射损坏只读等待/受控排查。
  旧材料引用 pending 也不可由 confirm 推进，需原材料流程收敛；所有引用稳定后重新 GET、核对所见版本才能确认。
- `503 STAR_AWARD_PENDING` 或断链后 GET 若仍 completed 且引用稳定，说明尚无可见确认事实，不显示“已确认/待发星”；只允许原所见版本的显式重试。
  若版本已变化，必须刷新重审，不自动确认新作品。此时另一家长成功确认可能成为首次确认者，不能预先把旧请求人当首次审计。
- GET 若 confirmed/pending，展示教学已确认、星星待恢复；confirmed/awarded 才展示到账。
  GET 失败保留未知，不用错误码猜测。GET 只读，不触发发星。
- 当前有权限共管家长可按已核验同版本接续；后两种状态保持首次确认反馈/人/时间，后续重试不显示“你的新反馈已保存”。
  刷新后本地确认快照丢失但 GET 已 confirmed，可依据持久所见版本显式恢复发星；若仍 completed，则重新审核并发起新确认意图。
完成/确认结果未知时禁止关闭对话框造成误清媒体；用户仍可离开，命令按 §4 留存，不能强制卡住页面。
家长代录与孩子提交共用规范命令逻辑；服务端审计记录真实家长，不发送伪造 subject/actor。

## 7. 合成集成与 QA 架构

T2 专用运行器复用 T1 createProductionApp 的 enabled 路径与启动前提校验；临时副本集建立正式索引，
临时媒体/journal 目录及合成凭据，仅 127.0.0.1。不能单纯调用旧 Task 11 runtime 或把媒体/发星全部 mock 掉。
保留 Task 11/12 原后端用例和旧 runtime 供旧 API 回归；共享前端对应的原浏览器场景迁到显式 enabled 的装配，
保持原场景而非用旧 API 测试替代浏览器覆盖。不让旧运行器吞掉新字段后伪装通过。
T2 runtime 启动须执行正式 readiness/索引/事务/存储校验并连接同一模型，不能仅调用 createProductionApp().listen()。
具体兼容接线在 T2-6 实施前复核，不通过回退旧请求解决。
客户端成功展示与服务端任务版本、引用、operation/账本数量、首次审计同时断言；故障夹具在提交后丢响应，不模拟一个不持久化的假成功。

浏览器：iPad 768×1024/1024×768、桌面 1280×800、窄屏 390×844；使用合成图片检查非空、布局、触控、弹窗焦点、滚动、控制台及关键操作。
不为本轮修改生产默认配置；只在测试进程显式 enabled。扫描协议桩不是实际 ClamAV 验收。
真实 iPad TC-SL-IPAD-001..004 保持 DEVICE_PENDING；HEIC 提示要有可操作导出/重拍路径，但浏览器仿真不算真机输入通过。
设备验收单独授权，材料仅合成；T2 合成工程关闭也需用户裁决，不能替代 T8 真机/介质/备份恢复/部署。

## 8. 风险、回滚与审查

主要风险：新增恢复入口须保持原actor隔离；回收屏障/日志与既有协议的兼容；旧异步响应串孩子；
媒体组件改动误伤材料/PDF；旧 E2E 注入旧协议形成假绿。测试与退出条件见[执行记录](../../development/family-self-directed-learning-t2-execution.md)。
回滚仅撤回本包相关前端/文档改动，不回退 T1 服务、清空 pending、删除映射或使用旧 writer 处理新状态。
未处理命令停止新写并保留服务端恢复数据；不能为了回滚清除原映射。前置后端写入后的回滚限制见补充设计 §5。
无真实部署，本轮不执行真实数据迁移。
设计自查、独立评审与用户批准记录集中于执行记录。任何新增接口或范围变更必须另审，不以实现方便替换目标。
