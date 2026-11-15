# AI-1 家长候选讲解最小接入设计

**Document status:** APPROVED / A_ACCEPTED / B_IMPLEMENTING / C_IMPLEMENTING
**Profile:** AI1-MIN-1
**Updated:** 2026-11-01
**Implementation:** B_LOCAL_REVIEW_PASSED / EXTERNAL_IMPLEMENTATION_PENDING; B gate OPEN; real model calls / deployment NOT_AUTHORIZED

**Approval update (2026-11-01):** 用户已批准 A 批验收及三项问题关闭，授权 B 批本地无真实模型实现、测试与评审；见 Gate §29.4。
用户随后批准 B 批本地复审及 P1/P2 关闭，三版本详情补测固化为永久测试；本地关闭记录见 Gate §29.6，不表示 B 整体验收。
随后目标授权 LMS 本地 B/C/D 持续推进；C 页面及合成替身浏览器正在验证，D 正式装配尚未完成，见 Gate §29.7。
当前 D 部分进度：Gateway 原始 JSON 传输与 homework 正式工厂默认关闭装配，见 Gate §29.8。
仅公开读取/拒绝新发送边界已实现；运行态启用、只查询收敛和实际远端仍待完成，不改变上述目标设计。
后续D2已落实本地四模式运行态和正式HTTP只查询收敛（Gate §29.9）；D1当时未完成状态保留。
配置声明不是远端连续性/计费正确性的自动证明，实际外部启用仍待验收，不关闭B/D或总门禁。
用户已追加批准以本地 DeepTutor v1.7.1（`f7aed0744c36c5afef16a4261c31ebee1208cac2`）为固定开发基线，
仅本地实现受限 operation 并使用 Provider 替身验证；不操作 Ubuntu、不调用真实模型、不提交推送或部署。
版本变更不继承 AI-0 的 1.7.0 验收，亦不把 C 页面替身验收写成 B 真实远端实现通过；新批进度见 Gate §29.13。
历史复审与任务盘点见 [Gate §29.2](../../development/family-self-directed-learning-mvp-gate.md#292-三项修订复审结论归档与任务盘点2026-11-01)。AI-1 总门禁仍 OPEN。

## 1. 决策、依据与范围

用户已确认三项方向：受限单次 Provider 接入；任务或错题的家长确认纯文字输入；保留原文的人工修订版本。
最初授权仅为设计落文；2026-11-01 已追加设计批准及 A 批本地实现许可，不包含外部调用、提交推送或部署。
本稿与 [API 契约](../../api/family-ai1-api.md)、[测试方案](../../development/family-ai1-test-plan.md)
构成同一候选；主线见 [MVP 计划 §9](../plans/2026-10-21-family-self-directed-learning-mvp.md#9-deeptutor-与-k12-最小对接路线2026-10-26-补充)。

AI-0 只验证了既有 DeepTutor 1.7.0 的单次 Provider 路径，不是页面、Agent 或教材检索验收。
三组原创合成输入中，两组存在数位/计数单位表述问题；家长确认采用人工修订后适合备课。
原始错误不覆盖，不声称模型自行修复。人工准备 15 分钟、阅读核算修改 5 分钟是单次自报，
不包含工程准备，不证明整体节省比例或孩子学习效果。AI-0 结论为 CONDITIONAL_CONTINUE_PROVIDER_SCOPE。
本稿仅引用上述结论；原始输入、输出、用量和家长修订记录仍在本地私有证据中，尚未作为仓库附件归档。
AI-1 工程验收前需核对并归档脱敏证据摘要，不把当前摘要冒充独立复验。

| 本轮必须交付 | 明确不做 |
| --- | --- |
| 家长从同孩子任务或错题进入，确认脱敏题目及可选作答文字 | 孩子入口、学习包、订正 Attempt、自动掌握判断 |
| 预览完整外发文本及费用上界，显式请求一份短讲解 | 变式题批量生成、任意聊天、自动多轮、Agent/工具调用 |
| 查看 candidate，修订、拒绝或按所见版本批准 | OCR、图片/PDF/整本教材上传、K12 查询/伪造课程证据 |
| 持久幂等、费用预留、未知结果发现与显式恢复、共管审核 | 通用工作流平台、新常驻 LMS 服务、自动对账/自动重生成 |

初始只覆盖 AI-0 的四年级上册“多位数乘两位数”家长备课场景，使用家长声明的章节信息。
不声称教材年份/版本已独立验证，不推断教材使用许可。工程测试仅使用合成家庭和原创合成文字。
AI-0 的人工审核限制保留：内容必须逐项核验；发现问题先修订再批准，不因模型成功响应而可直接使用。
AI-1 的批准仅表示家长备课资产通过审核，仍不开放孩子 API、学习包或自动发送给孩子。

## 2. 现有实现与复用边界

| 现有资产 | 复用方式与缺口 |
| --- | --- |
| `backend/common/utils/familyAccess.js` | 复用实时成员和孩子归属校验，不依赖 JWT 的 familyId 判断成员关系 |
| `backend/common/services/learningSource.js` | 复用同 family/child 的任务/错题只读来源校验；返回最小元数据，不是题目全文 |
| analytics 的 `FamilyMistake` | 原题可能只有媒体，没有 questionText；必须家长另行输入文字，不能暗加 OCR |
| homework 完成命令/事务模式 | 参考持久原命令、owner/阶段 CAS 和结果恢复原则，不复用作品模型存 AI 数据 |
| `familySession`、`useAsyncResource`、`familyApi` | 复用身份代次、AbortController、错误隔离及请求信封；新增 AI 专属 DTO，不借旧白名单 |
| 现有 DeepTutor Provider | AI-0 单次调用可行；产品用受限持久 operation HTTP 能力尚未证明存在，须后续实现/核验 |
| 原 Tutor v1 JSON Schema/fixtures | 是完整平台草案，非当前已运行 API；保持不变，本轮另定义最小 profile，不能混用 |

## 3. 接入与所有权

```text
Parent Web -> Gateway (signed identity) -> homework Tutor module
                                            |-> analytics source read API
                                            |-> restricted DeepTutor operation HTTP
                                                   -> one Provider completion
```

Tutor 模块属于 homework-service，持有 Cycle、Job、Artifact、幂等结果和费用账本。
analytics 的错题只经既有只读来源 API 查询，不跨服务写库，不把 AI 审核写成错题订正/掌握事件。
不新增 LMS 常驻微服务；DeepTutor 在既有独立环境运行，产品不得依赖 SSH/docker exec 发送请求。
若既有 DeepTutor 不能提供下述持久窄接口，在其现有服务内最小补齐；不能悄悄改为 LMS 直连模型。
该外部修改和真实环境安装/部署仍需另行授权；缺少它时可做替身集成，但不能宣称正式接入通过。

DeepTutor 窄接口只接收经过校验的完整文本投影、固定调用 profile 和 opaque remoteOperationId，
不接收 LMS JWT、familyId、childId、sourceId、姓名、媒体 URL 或原始学习档案。
采用独立非管理员服务凭据及路径白名单；只允许创建/读取这类 operation，不允许配置、文件导入、
任意 URL、工具、代码执行、检索、Agent、MCP、子代理或模型切换。禁用重定向，校验目标及 TLS；
合成回环 HTTP 例外须显式配置，不作为真实跨主机明文许可。日志只存状态/摘要/计数，不存正文和凭据。

## 4. 最小持久数据与状态

| 记录 | 必需信息及约束 |
| --- | --- |
| TutorCycle | familyId、childId、source(type/id)、来源原 subject 与 subjectAliasVersion 快照、创建 actor、家长输入快照与 hash、chapter provenance、stateVersion、activeJobId、currentArtifactId、approvedArtifactId；来源和输入创建后不可原地改写 |
| GenerationJob | Cycle/原 actor、原 operationId、requestHash、generationInputHash、remoteOperationId、profile/价格快照、原 maxAuthorizedCostMicros、sendNotAfter、reservationId、阶段/owner/lease、failureCode、最后远端证据及结果引用 |
| TutorArtifact | 原文/人工文本、version、contentHash、origin、derivedFromArtifactId、editor/生成来源、reviewVersion、状态和首次审核 actor/time；正文版本不可变 |
| IdempotencyRecord | family+actor+endpointOperation+operationId 唯一、规范请求摘要、持久结果引用；重放前重新鉴权 |
| BudgetReservation / family counters | Job 唯一预留、整数金额、预留时日/月桶、持久 outstanding、结算/释放证据；两位家长共享，不按 actor 分账规避额度 |
| DeepTutor Operation | remoteOperationId 唯一、requestHash、完整允许的发送快照及 sendNotAfter、阶段和单次发送 claim、结果/hash/usage；独立持久存储，不靠进程内 Map |

拟采用 DeepTutor 独立数据目录中的小型事务数据库保存 operation（优先 SQLite，具体依赖启用前核验），
不新建独立平台。持久介质/唯一约束/事务不可用时拒绝启用，不以缓存替代。两端数据库各自负责本地事务。
remoteOperationId 由服务端安全随机生成且与本地 Job 同事务保存；同 UUID 的不同 actor 不串用映射。
同 family/child/source 同时最多一个未结束 Cycle，避免共管家长各建一个绕过未知 Job 锁。

**存储恢复不是普通进程重启。** 两端启用发送前必须确认正在使用连续、未回滚的持久存储。
已发生快照恢复/回滚、换库/换目录或无法证明连续性时，进入 `STORE_ISOLATED` 运行模式：
禁止新预留、PUT 接收后启动发送、worker claim、reserved 恢复发送及费用结算/释放。
恢复出的 `accepted/sendClaimed=false` 不能证明从未发送，恢复出的本地 reserved 同理；
原记录保留，不将 false 改成伪造的 true，也不把历史成功改写为失败。面向调用方返回隔离错误，
不把恢复出的旧终态作为当前可结算证据；LMS 对相关未结束命令维持未知处理、原锁及费用占用。
全局发送资格不得通过恢复旧占位记录、改 UUID、换 actor 或清空数据库重新获得。
发送开关默认关闭，部署/恢复流程须在启动 worker 前确认存储连续性；仅同一份 operation 数据库中的
enabled 标志、accepted 行或完整性检查不是连续性证明。普通进程重启只有满足该前提才可处理未发送记录。
当前不提供解除恢复隔离、自动对账或灾备后重新启用流程，需后续单独评审；不能证明则不启用。
这是启用与运维前提，不声称系统能自动识别任意未声明的数据库替换或回滚。

Cycle：`ready -> generating -> candidate -> approved|rejected`；明确失败的 Job 终结后回 `ready`，
`unknown` 保持 `generating` 并锁住该 Cycle；人工修订仍处于 `candidate`，递增 stateVersion。
Job：`reserved -> dispatching -> succeeded|failed|unknown`；允许 `unknown -> succeeded|failed`，
但必须来自同一 remoteOperationId 的可靠终态证据；已终结记录不被迟到非终态覆盖。
一个 Cycle 最多创建一个生成 Job，终态失败不通过再次 generate 另建 Job；新生成须新 Cycle 和新授权。
outstanding Job 指 reserved/dispatching/unknown；已知终态但费用待核实不是可退费的依据，额度仍占用。
Artifact：`candidate -> parent_approved|rejected|superseded`；修改旧候选创建新版本并将旧版标为 superseded。
关闭 Cycle 只允许 ready/candidate/approved/rejected 且无 outstanding Job；未知 Job 不可通过关闭解锁。
本轮不自动重生成；reserved 阶段有持久未发送证据时可显式恢复原 Job；terminal failed 不重开，
同命令重放仅返回该失败。若仍需生成，须关闭无未知 Job 的 Cycle 后显式新建并重新授权预算。
需要改题目时须先结束无未知 Job 的旧 Cycle，再显式创建新 Cycle；旧记录保留。

## 5. 费用预留与发送边界

1. 默认关闭。启用前必须有服务器受控的 modelProfile、输入/输出 token 上限、thinking disabled、
   tools disabled、底层尝试次数 1、全局付费发送并发 1，及家庭单次/日/月和本次实验总预算。
   Provider、SDK、HTTP、反向代理、worker 均不得自动重复生成；429、断网不触发换 key 或第二次调用。
   全局发送槽须持久且跨 worker 生效；sending/unknown 没有可靠远端结束证据时不释放槽，
   不因 worker lease 到期放行另一笔，避免本地并发为1而远端仍并行消费。
2. 上限按完整序列化请求（含 system、模板、元数据开销）计，不只算家长正文。
   profile 固定最大输入 8192、最大输出 4096 tokens；超限拒绝，不截断悄悄改变意图。
   实际模型标识、token 计数方式、价格有效期和所有重试层须在启用前重新验证；无法界定计费上界就不发送。
3. 金额统一整数微元（1 元 = 1,000,000 微元），向上取整。预留
   `ceil(inputTokenCeiling * inputPriceMicrosPerMillion / 1000000) + ceil(outputTokenCeiling * outputPriceMicrosPerMillion / 1000000)`。
   按无缓存/最高适用单价，不依赖优惠或缓存；存在额外收费项必须纳入，无法界定则阻断。
   乘除采用精确整数/定点计算并检查溢出，不能以浮点舍入少预留；落库前验证安全整数范围。
   AI-0 历史价格只能作算例：9/27 元每百万 tokens 得到单次 184320 微元（0.18432 元），不是当前报价。
4. Cycle 创建返回冻结的完整外发预览/hash、价格 profile 版本、有效期和单次预留上界。
   家长显式确认时提交相同 hash/profile 和可接受金额；服务端重新核价/验权，变化或到期返回 409，
   不自动提高授权金额。不得允许客户端选择模型、单价、重试数或绕过限额。
   报价检查不止发生在 generate：本地 reserved 首次发送/显式恢复、远端 accepted 最终 claim
   均重新采样服务端时钟，核验价格与模型 profile 未撤销、未变更，完整费用上界仍不超过原预留及原授权。
   Job 和远端 operation 持久化不可延长的 `sendNotAfter`，由服务端按原报价到期时间、
   有界调用时长及保守时钟误差计算；必须为整个可能计费请求提供有效上界，不能只证明发送瞬间价格有效。
   `now >= sendNotAfter` 拒绝发送；时钟/价格有效性无法确定也拒绝，不用旧价格静默结算或自动补差额。
   本地连续存储中尚未越过 dispatching 的 reserved，须以与发送竞争的同一 owner/阶段 CAS
   终结为 failed/AI_PREVIEW_STALE 并原子释放预留，才可关闭 Cycle、重新预览授权。
   远端连续存储中的 accepted 必须以与 claim 互斥的事务终结为 failed_not_sent/PREVIEW_STALE，
   LMS 收到匹配原映射的可靠终态后才释放。任一 CAS 失败/提交未知，先查询原记录，不推断未发送。
   已 claim、可能发送或处于存储隔离时，过期也不释放：维持 unknown 与原映射/占用；
   已可靠完成的原终态仍可按其发送时有效的价格快照收敛，不因现在过期而重发或重开。
5. 同一 Mongo 事务中以条件更新同时校验全部额度、创建唯一预留和 Job、保存 remoteOperationId
   及幂等结果。任何一步失败全回滚；事务提交结果未知先读回，不能再预留/再发。
   外部调用绝不放在 Mongo 自动重试事务回调内；必须确认本地预留持久后才可离开发送边界。
6. 新日/月桶不能清除旧未知预留：检查“本期已结算费用 + 全部 outstanding 预留 + 本次预留”
   不超过本期限制；实验总预算跨期累计。结算费用记入实际结算期，并保留原预留桶审计，避免 rollover 空洞。
   家庭时区及预算配置修改不重置累计/未知预留；降低限额至已占用以下时阻断新发送。
7. 完整可靠 usage 按冻结价格保守结算，释放有证据的差额；已发送但 usage 缺失/不可信时不退还预留，
   费用标为 reserved_unknown。可靠结果仍可成为待审核候选，但不能将预算状态写成已对账。
   超预留 usage/价格失配触发停止开关，不把负余额写成成功；须调查后人工处理，不再发新请求。
8. 仅“可靠证明未发送/零费用”的终态可全额释放。超时、租约过期、404、重启、5xx 不构成证明。
   unknown 持续占用额度；不因 UI 关闭/退出/人工标失败而释放；不实施自动退款或自动对账工具。

这是本调用通道的应用级费用控制，不是供应商账户全局硬上限；同账号其他工具的消费不在此控制内。
启用需证明凭据/预算使用边界，不能宣称限制了整个 DeepTutor 账号。AI-0 的整轮 10 元及残余额度
不转为 AI-1 调用授权；本轮额度未设置、未批准发送，付费验收另行申请有限合成预算。

## 6. 权限、未知结果与恢复

- 每个读写/重放先验证有效家长身份和实时成员/孩子归属，再取资源与幂等记录。孩子角色全拒绝，
  跨家庭/跨孩子不存在性一致返回 404，当前家长失去孩子访问权返回 403；拒绝响应不返回候选正文。
- 创建及发送前重新核对来源；源服务故障 503，确实删除 404；不从缓存猜测授权，也不跨库补读。
  已产生的历史候选作为独立私有资产可在同家庭/孩子权限内回看，标明来源不可用；不因此重新发送。
- 来源 subject 是现有自由文本，不直接要求数据库等于 math。AI-1 在服务端读取来源后仅对匹配副本
  去首尾空白、将 ASCII 大写转小写，精确映射 `数学` / `math` 为 math；空值、其他学科、
  未列别名均拒绝，不做模糊/子串/全角折叠或模型识别。保留来源返回的原值和映射版本
  `ai1-subject-alias-v1` 作为本地快照，不修改来源库；客户端 chapter.subject 不能覆盖判定。
  创建及实际发送前均应用相同规则，原来源不可识别则返回 AI_SOURCE_SUBJECT_UNSUPPORTED，
  不因题目看似数学而放行。没有新增学科体系、数据修复或跨服务写入。
- 原命令和 hash 在服务端持久；sessionStorage 只能缓存本身份的 operationId，不是恢复权威。
  重登后读取本人未结束 Job；用户显式恢复只能查询/收敛原 operation，不能由 GET 启动模型请求。
- 共管家长可查看同孩子的候选及按版本审核，但不能冒充原提交者恢复发送。原 actor 被撤权后暂停恢复，
  不自动转移 Job 或费用；可观察状态不等于授权再次发送。审核 actor 与生成 actor 分别保存。
- DeepTutor 先落盘 operation 及唯一发送 claim，再最多调用 Provider 一次；claim 后崩溃即使可能未发送
  也按 unknown，不“接管后再试一次”。相同 PUT/hash 返回原记录，异正文同 key 拒绝。
- provider 发送前对实际序列化请求再次检查完整 messages、固定模型/输出上限和关闭思考/工具，
  内部 requestOptions 不能未经映射直接传给 SDK；禁止 SDK 隐式补消息或 profile 之外的参数。
  单份输出只作为纯文字短讲解，不要求生成变式题，不采信输出中自称来源/权限/费用的指令。
- 本地发送前崩溃且能证明未越过发送边界，可由原 actor 显式恢复；已到 dispatching 时先查询远端。
  远端查不到或持久映射丢失不能证明未执行，不新建 operation；保持 unknown，报告具体阻断。
  上述恢复须先通过存储连续性和实际发送前报价门禁；恢复旧快照不满足“能证明未发送”。
- 成功结果须校验 remoteOperationId、hash、profile、响应大小/结构、usage 和完整终态，再原子保存
  Artifact、Job 及结算记录。迟到结果只可提交至原 Job，owner/阶段/stateVersion CAS 拒绝跨命令覆盖。
- 每次轮询只读；多标签/重启用相同记录收敛。租约只控制本地并发，不判断供应商终态，不解锁未知结果。
- 退出/切换家长、孩子或跨标签身份变化，立即清私有 DOM、输入和本地缓存，取消请求并递增身份代次。
  当前身份 401/403 清私有视图；迟到成功/401 不污染新身份。普通网络失败保留原命令重试入口。
- 家长确认“已脱敏”只是一项人工保障，不等于自动匿名化证明。外发前展示准确文本；输入禁止附件、URL
  和额外字段，不自动拼接孩子姓名、任务标题、原始档案或媒体；任何文本仍须人工检查个人信息。

## 7. 人工修订和版本审核

AI 原始文本不可改写。家长保存修订时必须提交所见 artifactId/version/contentHash、reviewVersion、
cycleStateVersion 及新文本；同事务校验当前候选指针并创建 `origin=parent_revision` 新版本，记录
derivedFromArtifactId、编辑 actor/time/reason，原生成 provenance 沿链保留。空白或相同正文拒绝，不制造空版本。
superseded/审核时递增旧版 reviewVersion，所有修订/审核/关闭均递增 Cycle stateVersion；新版本 reviewVersion=1。
修订不调用模型、不重新收费，也不自动批准。界面并列显示原文/本次修订并标清来源。

批准/拒绝必须针对实际查看的当前版本和完整 hash；过期请求 409，重新查看并由家长再次决定，
不能自动确认最新版。共同家长的修订/审核竞争通过同一 Cycle 和 Artifact CAS 串行化。
第一次成功审核 actor/time 不因重试改写；拒绝必须给原因。批准时确认数学、年级/章节适配和表述检查。
批准后版本只读；发现问题可关闭该 Cycle 并以新 Cycle 重新人工处理，不能原地修订已批准内容。
关闭不删除原始输出/审核证据，不改变错题、任务完成状态、星星、周报或掌握度。

## 8. 旧草案差异、启用和回滚

| 旧完整平台草案 | AI1-MIN-1 的明确替代/保留 |
| --- | --- |
| WS Agent、deep_solve、多轮 session | 仅持久 operation HTTP + 单 Provider；没有 Agent 能力验收 |
| sourceMistakeId + knowledgePointId 必填 | tagged task/mistake source；家长输入独立文字，不伪造 knowledgePointId |
| curriculumRefSnapshot / 非空课程证据 | parent_declared 的年级/章节/教材文字；不是检索证据，不伪造节点/引用 |
| AI2/3 stage/Attempt/最终掌握事务 | 全部不注册路由、不建表；只采用本稿候选审核子集 |
| artifact 仅 approve/reject | 增加 revision 新版本命令，保留原文与精确审核 CAS |
| family+endpoint+operation 幂等键 | 本 profile 加原 actor；同 UUID 不同 actor 不共享结果，仍共享来源活动锁/预算 |

本候选明确覆盖上述 AI-1 差异，不更改旧 `tutor-*.schema.json` 的 v1 语义或历史 fixtures。
本轮 API 文本契约是已批准的独立 `ai1-min-v1`；旧 JSON Schema 不验证它。A批落实版本化闭合
schema、hash反例及现有文档校验；路由/远端接入仍为B批，不用旧v1放宽字段来兼容。
目前没有生产 Tutor 数据迁移；若实施前发现已有实现/数据，先重新核对，不自动迁移。

默认不开启任何生成入口。启用前须核验实时权限、事务/唯一索引、两端持久目录、价格/计数 profile、
专用凭据、发送去重、限额和预算隔离；任一缺失失败关闭。新增写路由走 Gateway 签名身份，内部路径不公开。
回滚先停止新预留/发送，保留只读与已授权的结果查询收敛；保留账本、未知锁、候选和审核，不删除数据，
不退化到直连模型/旧 Agent 路径。手工任务/错题流程应不受影响；不能因关闭 AI 而开放私有内容。

## 9. 分批交付与评审出口

| 批次 | 交付及验收 | 边界 |
| --- | --- | --- |
| A | 本地模型/契约/权限/事务/版本及模拟闭环，验证闭合 schema 与费用并发反例 | 不发送模型 |
| B | 受限 operation 接入、预留、未知结果与重启恢复，真实 HTTP 故障注入 | Provider 可替身，须如实标注；外部部署另授权 |
| C | 家长双入口、完整输入确认、修订审核与身份切换 | 无孩子页面、不扩展媒体 |
| D | 正式工厂 HTTP/浏览器合成闭环、相关回归、人工内容价值审核 | 付费调用单独授权；无条件则记待验，不假装完整接入 |

复用现有 Jest、Playwright、family regression、docs gate；不新建审批/测试框架。
每批实现自查和聚焦评审；安全/正确性缺陷补永久反例再复评，不为每个内部步骤等待许可。
2026-11-01 已获设计及A批实现授权，A批本地域验收与运行证据见主线Gate §29.3；
B批已获授权实施，A批已批准验收；C/D仍PLANNED，AI-1总状态OPEN。后续记录以Gate §29.4起为准。
T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING 和高级恢复/新回收 REMAINDER_DEFERRED 保持不变。
真实家庭使用仍须满足 T8；本候选不以 AI-0 小样本替代 T9，不自动启动 AI-2/AI-3/K12-1。
