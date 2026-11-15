# AI-1 最小 API 契约

**Document status:** APPROVED / A_ACCEPTED / B_IMPLEMENTING
**Profile:** AI1-MIN-1 (`ai1-min-v1`)
**Implementation:** FORMAL_ROUTES_DEFAULT_OFF / RUNTIME_ASSEMBLED / EXTERNAL_ACTIVATION_PENDING

当前本地实际DeepTutor v1.7.1组合、双端合成恢复与35项工程归并见测试方案§17及Gate §29.22。
历史“发送启用未完成”指真实启用资格；受限SDK/正式HTTP/页面本地实现已具备，真实完整输入计数资格、
当前价格与费用授权、人工价值验收仍待完成。默认关闭、B/D/AI-1 OPEN，不把Provider替身当付费验收。

B批本地候选：`createAi1JsonParser()` 必须在任何通用 JSON parser 消费请求流之前装配；
它按原始（解压后的）UTF-8 JSON字节限制32 KiB，超限413/AI_INPUT_TOO_LARGE且no-store。
`createAi1Router()` 拒绝没有该解析标记的写请求；不得只用重新序列化后的大小替代原始大小。
GET Cycle详情返回 `{cycle,preview,artifacts,job}`：artifacts按版本递增，job可null，均在同一只读事务快照读取。
创建响应仍为 `{cycle,preview}`。当前 Gateway 与 homework 正式工厂已装配公开 AI-1 路径，发送启用仍未完成。
Gateway 仅这三类路径在通用 parser/sanitizer 前捕获原始 JSON（解压后上限32 KiB），
保留原始字节向 homework 转发，不能让清洗器删除未知键或改变数学文本；普通限流和 JWT 校验仍执行。
两端仅接受合法 UTF-8 JSON，其他 charset 或非法 UTF-8 拒绝400/VALIDATION_ERROR；不得静默替换字节。
代理在解压/组装正文后移除旧 Content-Encoding 和 Transfer-Encoding，由代理按实际字节重算 Content-Length。
调用者的 `x-ai1-service-token` 被剥离，内部 operation 路径不代理。homework 专用 parser 不影响其他签名路由。
正式 AI 服务默认关闭，拒绝新建/生成；已有授权记录可读。D2已补四模式及本地正式HTTP查询收敛，
外部真实启用前置仍未满足，不能将协议替身验收当成实际远端或完整回滚验收。
历史D1为SEND_ACTIVATION_PENDING；其冻结记录不改写，当前实现见下方运行配置及Gate §29.9。

**Approval update (2026-11-01):** 用户已批准 A 批验收及 B 批本地实现，随后授权 LMS 本地 C/D 持续推进；真实模型调用未获授权。
历史 B 候选为 `PRODUCTION_ROUTES_NOT_MOUNTED`；该冻结状态不改写，当前装配进度见 Gate §29.8。
历史复审见 [Gate §29.2](../development/family-self-directed-learning-mvp-gate.md#292-三项修订复审结论归档与任务盘点2026-11-01)。

本稿描述已批准的目标接口，挂载不表示发送准入或整体验收通过。配套 [设计](../superpowers/specs/2026-10-31-family-ai1-minimal-design.md)
与 [测试方案](../development/family-ai1-test-plan.md)。现有 [家庭 API](family-learning-tracker-api.md)
的签名身份、统一响应、实时家庭/孩子权限继续适用；旧 Tutor v1 JSON Schema 不是本 profile 的验证器。
A批已增加[版本化闭合schema](../../backend/common/contracts/ai1-min.schema.json)及fixtures并接入既有校验，
不能直接套旧schema或默许多余字段。

## 1. 公共规则与数据类型

- 仅当前有效的家长。服务端推导 familyId，所有资源查询绑定 familyId + childId，先权限后幂等。
  无身份 401；非家长/当前孩子权限撤销 403；资源不在当前允许范围或不存在统一 404。
  服务故障不能伪装成 404。所有 AI-1 GET 只读、不触发模型调用或账本结算。
- 所有写请求均必填 `schemaVersion="ai1-min-v1"`、`operationId`（小写 UUID v4）；
  无 Idempotency-Key 第二来源。唯一键 `(familyId,actorId,endpointOperation,operationId)`。
  请求摘要含方法、规范路径、schemaVersion、全部有效请求字段，RFC8785 JCS + SHA-256；
  UUID/ObjectId 采用规范小写，正文只将 CRLF 转 LF，不 trim 或折叠内部空白。必须先展示规范后的正文再确认。
  未知字段、null 替代缺失、非预期类型、非有限数值拒绝；可空字段仅按下表明确允许。
- `id`：24 位小写十六进制；`hash`：64 位小写 SHA-256；版本：大于等于 1 的安全整数；
  金额 `*Micros`：大于等于 0 的安全整数，币种固定 CNY；时间：UTC ISO 8601。
  字符长度按 Unicode code point；JSON 正文总 UTF-8 上限 32 KiB；超限 413。
- 成功 `{success:true,data:{...}}`；错误 `{success:false,error:{code,message,details:[]}}`，
  details 不含原题/输出/其他家庭状态/凭据。私有响应 `Cache-Control: no-store`，文本只按纯文字渲染。
- 相同 key/hash 返回原持久结果引用（读取时仍实时鉴权），不再次副作用；同 key 异正文 409。
  两个 actor 同 UUID 独立，但共享来源活动锁、Cycle CAS 和预算。幂等历史不因 lease/日期变化自动删除。
- 路由关闭时拒绝新建/生成；已存在记录按权限可读，显式恢复仅查询已发送 operation，不启动新发送。

## 2. 路由表

路径沿用原 Tutor 命名，但只接受本 profile；不注册 AI-2/AI-3 路由。以下已纳入本地正式工厂，不兼容旧 Tutor v1。

| 方法与路径 | endpointOperation | 成功 | 用途 |
| --- | --- | --- | --- |
| POST `/api/tutor-cycles` | `ai1.create` | 201 | 无模型调用地创建来源/输入快照、预览和估价 |
| GET `/api/tutor-cycles?childId=...&page=1&pageSize=20` | - | 200 | 当前孩子列表；最大 pageSize 100 |
| GET `/api/tutor-cycles/:cycleId` | - | 200 | 私有详情、当前版本和原始/修订链、Job 摘要 |
| POST `/api/tutor-cycles/:cycleId/explanation-jobs` | `ai1.generate` | 202 | 显式确认预览，原子预留并创建单一 Job |
| GET `/api/tutor-jobs?childId=...&scope=mine-unfinished&page=1&pageSize=20` | - | 200 | 重登后仅发现原 actor 尚未结束的 Job |
| GET `/api/tutor-jobs/:jobId` | - | 200 | 当前权限内查询；共管可看状态，不能接替原 actor 发送 |
| POST `/api/tutor-jobs/:jobId/recover` | `ai1.recover` | 200/202 | 原 actor 显式收敛同一 operation；非终态 202，终态 200 |
| GET `/api/tutor-artifacts/:artifactId` | - | 200 | 指定不可变版本正文及来源/审核元数据 |
| POST `/api/tutor-cycles/:cycleId/explanation-revisions` | `ai1.revise` | 201 | 人工修订创建新候选版本，不调用模型 |
| POST `/api/tutor-cycles/:cycleId/explanation-review` | `ai1.review` | 200 | 按所见当前候选版本 approve/reject |
| POST `/api/tutor-cycles/:cycleId/cancel` | `ai1.close` | 200 | 无 outstanding Job 时关闭 Cycle，保留证据 |

POST recover 的同 key 重放可返回最新的同一 Job 状态，不触发第二次发送或重复结算；
重复查询可用 GET，新的显式 recover 命令也仅收敛原 remoteOperationId，不创建新生成 Job。
列表只返回摘要和 ids，不带整篇内容；详情才返回正文。服务端不把任意 sourceId 当作 childId。

## 3. 创建 Cycle 与完整预览

请求所有字段必填，嵌套对象均闭合：

```json
{
  "schemaVersion": "ai1-min-v1",
  "operationId": "11111111-1111-4111-8111-111111111111",
  "childId": "aaaaaaaaaaaaaaaaaaaaaaaa",
  "source": { "type": "task", "id": "bbbbbbbbbbbbbbbbbbbbbbbb" },
  "input": {
    "questionText": "请解释 124 乘 23 的竖式数位。",
    "answerText": null,
    "parentContext": "只解释部分积的数位，不生成变式题。"
  },
  "chapter": {
    "provenance": "parent_declared",
    "subject": "math",
    "grade": 4,
    "term": "upper",
    "textbookLabel": "人教版数学四年级上册，具体版次由家长核对",
    "chapterLabel": "多位数乘两位数"
  },
  "deidentifiedConfirmed": true
}
```

source.type 为 task|mistake，仅一个来源；必须同孩子且服务端确认属于数学，跨学科本轮拒绝。
来源读取接口仍原样返回 subject，不变更其契约或数据库。映射版本 `ai1-subject-alias-v1`：
只对服务端取得的字符串匹配副本去首尾空白并转 ASCII 小写，精确接受 `数学` 或 `math`，
例如 ` Math ` 归为 math；`数学练习`、`mathematics`、`ｍａｔｈ`、语文、空值均拒绝。
不得做子串匹配或相信客户端 chapter.subject；原始来源 subject 与映射版本只存本地来源快照，
不改写来源记录，不额外加入外发 messages。创建及实际发送前重新读取并按同一映射判断。
不支持的来源返回 400 AI_SOURCE_SUBJECT_UNSUPPORTED；依赖故障仍为503而非“不支持”。
questionText 1–4000 字符且非全空白，answerText 为 null 或 1–4000 字符，parentContext 0–500；
chapter 固定上述 provenance/subject/grade/term/chapterLabel，textbookLabel 1–200 字符。
不得附带媒体、链接、课程节点/检索引用、模型参数、费用或家长/孩子身份字段；正文包含 URL 亦拒绝。
不自动读取媒体，不用标题冒充题目。人工确认不能替代实时来源和权限校验。

创建返回 `data.cycle` 与 `data.preview`。Cycle 最小读模型：
`id,childId,source,status,stateVersion,currentArtifactId,approvedArtifactId,activeJobId,createdBy,createdAt`；
后三个引用允许 null，actor 仅在当前家庭权限内返回。status 增加 closed 终态。
preview 必须包含以下全部字段：

| 字段 | 含义 |
| --- | --- |
| generationInputHash | JCS 摘要绑定外发投影、system/prompt 版本、输出格式及固定 modelProfile；本地身份不发送 |
| modelProfileVersion / pricingProfileVersion | 服务端版本；家长不可指定模型/单价 |
| messages | 确切的 system/user 两条纯文本消息，含角色及 content；不得还有未展示的隐式消息 |
| requestOptions | 固定 model、maxInputTokens=8192、maxOutputTokens=4096、thinking=disabled、tools=[]、attemptLimit=1 |
| pricing | currency=CNY、input/outputPriceMicrosPerMillion、checkedAt、expiresAt |
| reservedCeilingMicros | 完整请求的保守单次费用上界 |
| sendNotAfter | 不可延长的最晚发送截止点；服务端按报价期限减去有界调用时长和时钟误差余量生成 |
| sourceAvailable / inputProvenance | 来源校验结果；输入固定 parent_confirmed_text，无课程检索证据 |

该预览只是未收费报价，不预留费用、不保证剩余额度。配置不可用时 503，不伪造零价。
原输入不可 PATCH；需改输入时按设计关闭旧 Cycle 后新建。过期/变化预览必须重新创建 ready Cycle，
不能静默改冻结 hash；若已有 Job/未知结果则不得关闭来绕过。

## 4. 生成、发现与恢复

generate 请求在公共字段之外必填：`expectedCycleStateVersion,generationInputHash,modelProfileVersion,
pricingProfileVersion,maxAuthorizedCostMicros,externalSendConfirmed=true`，无其他字段。
须匹配已展示的预览且上限不低于本次预留；实际预留只取服务端计算值，不能按客户端任意额度扣款。
事务写 Job + reservation + Cycle + 幂等记录；不足或竞态失败零发送、零部分预留。
每个 Cycle 最多一个 Job；已有 Job 的新 generate key 不创建第二个 Job，返回 409 AI_OPERATION_UNRESOLVED。
终态失败亦不可重开；按下述关闭/新建规则重新取得授权。只有同 key/hash 才重放原结果。
响应 `data.job` 包含：
`id,cycleId,operationId,createdBy,status,recoveryStatus,canRecover,artifactId,budget,createdAt,updatedAt`。
status：reserved|dispatching|unknown|succeeded|failed；artifactId 可 null；
recoveryStatus：none|query_pending|uncertain_manual_reconcile；canRecover 按当前 actor/权限/运行模式动态计算。
budget：`reservationId,reservedMicros,settledMicros,state`；settledMicros 可 null；
state：reserved|reserved_unknown|settled|released。接口不返回外部凭据或底层错误正文。

Job 另须持久保存原 `maxAuthorizedCostMicros` 与 preview.sendNotAfter，不能恢复时从当前配置重建或延长。
初次发送和 reserved 恢复发送前重新核验报价/profile、截止点及上界；`now >= sendNotAfter`、
profile 撤销/变化、超原预留或原授权均不发送。可靠未发送的 reserved 仅在连续存储且 owner/阶段 CAS
胜出时，以同一事务写 terminal failed、稳定原因 AI_PREVIEW_STALE、预算 released 和 Cycle ready。
原命令重放返回这个失败，不续期、不自动重生成；需关闭旧 Cycle 后取得新预览和授权。
Job 响应另含 `failureCode`：非 failed 为 null；failed 为允许的稳定原因
AI_PREVIEW_STALE / AI_SOURCE_SUBJECT_UNSUPPORTED / CHILD_ACCESS_DENIED / RESOURCE_NOT_FOUND / AI_PROVIDER_FAILED。
发送前发现来源确实删除/学科不支持/原 actor 撤权时，也只有可靠未发送且 CAS 胜出才按对应原因终结释放；
依赖暂时故障保留 reserved 和重试入口。已可能发送则不得套用上述本地释放路径。

本地仅 reserved 且持久证据明确尚未越过 dispatching 边界时，原 actor 的 recover 可继续同一个 Job。
dispatching/unknown 仅查询远端并幂等结算，不新建 key、Job 或预留。未查询到仍 unknown。
重登发现列表只定位本人记录；详细正文始终重新授权。终态重放不恢复旧 lease、不过写首次 actor。
recover 请求除公共字段外无字段；jobId 来自路径，不接收 remoteOperationId 或替代文本。
非原 actor 调用 recover 返回 403 `AI_ORIGINAL_ACTOR_REQUIRED`。
terminal failed 不重开；明确终态后可关闭 Cycle 并显式新建，须重新预览/授权/预算，非自动重试。
该能力只适用于正常连续存储。任一端恢复/回滚或连续性未知时，受影响发送及结算入口
返回 503 AI_STORE_ISOLATED，LMS 保留未知处理与费用/锁，不以旧 reserved 或旧 accepted 为未发送证据。

## 5. 修订、审核与关闭

revise/review 共享必填字段：
`artifactId,artifactVersion,artifactContentHash,expectedArtifactReviewVersion,expectedCycleStateVersion`。
必须指向当前 candidate；对 superseded/rejected/approved/closed 版本拒绝。

- revise 另必填 `revisedText`（1–12000 字符、非空白）、`revisionReason`（1–500 字符）。
  文本与现版规范字节相同 400；内容为纯文字，禁止嵌入可执行 HTML/远端媒体。
  返回 `data.artifact` 和新 `data.cycleStateVersion`；原版 superseded、新版 candidate，审核计数从 1 开始。
  原版 reviewVersion 和 Cycle stateVersion 均递增；不能只创建新版而遗漏当前指针/CAS 更新。
- review 另必填 `decision`（approve|reject）、`comment`（0–500；reject 必须非空白）、
  `checks`（闭合的 mathCorrect/gradeAppropriate/chapterAppropriate/wordingReviewed 四个布尔字段）。
  approve 时四项必须 true；reject 可 false。不能提交审核 actor/time。
  返回精确 artifact 和 Cycle 新版本。按所见版本一次 CAS，冲突 409，前端重新查看后才可再次决定。
  成功时 artifact.reviewVersion 与 Cycle stateVersion 各递增一次，重放不递增。
- close 另必填 `expectedCycleStateVersion,reason`（1–500 字符），将 Cycle 标为 closed；
  无效阶段或 outstanding Job 拒绝。已批准 Artifact 保持原批准状态，但 Cycle 明确关闭不可继续使用。
  不删除正文/账本/审核、不改源任务或错题；返回 `data.cycle`。
  outstanding Job 为 reserved/dispatching/unknown；已知终态但费用未知仍保留预算占用，不借关闭退费。

Artifact 读模型：`id,cycleId,version,text,contentHash,status,reviewVersion,origin,derivedFromArtifactId,
revisionReason,createdBy,createdAt,generation,review`；origin 为 ai_generation|parent_revision；
revisionReason 为已持久化的人工修订原因，AI 原版为 null；刷新详情与原命令重放均保留，不触发生成。
人工版 derivedFromArtifactId 必填，原始版为 null。generation 保留原始 jobId/modelProfileVersion/
generationInputHash，人工版另标编辑者，不能冒充模型原文；review 为 null 或首次 reviewerId/time/
decision/comment/checks。contentHash = SHA-256(UTF-8 的规范 LF text)，不使用前端提交 hash 代替服务端计算。
无论批准与否，本 profile 均无孩子可读路由；不能用现有任务详情/错题列表附带候选正文绕过。

## 6. DeepTutor 内部 operation 契约

本接口已在 DeepTutor v1.7.1 固定基线中实现，并挂载到既有正式 main 的 `/internal/deeptutor`；
LMS Gateway 不代理该路径。正式生命周期的默认关闭、启用拒绝、启动失败收尾与跨进程只查询恢复已做合成验证，
不等于真实 Provider 启用或完整业务组合验收。进度见 Gate §29.14～§29.17。
子 app 相对路径为 `/operations/:remoteOperationId`，不新增独立常驻服务。
专用服务凭据保护，缺失/错误 401；凭据只授权本 profile 的 PUT/GET，无管理权限。
LMS client使用独立 `x-ai1-service-token`，不复用身份签名或来源读取凭据；禁用代理继承、重定向和自动重试。
实际 LMS client 与 DeepTutor 正式 main 的本机 TCP 组合已补测试并通过独立复评，包含丢响应和进程退出恢复；
Provider网络仍为替身，证据见Gate §29.17，该批不含LMS费用结算/页面。
后续实际Gateway/服务/账本及双引擎页面到正式DeepTutor main的本地增量见Gate §29.19；
旧快照隔离的分层恢复验证见Gate §29.20，仅补测试，不新增恢复API或自动解除隔离；总体门禁仍OPEN。
实际双端合成快照组合增量见Gate §29.21，保留非终态recover=202、终态=200及既有隔离契约，不新增接口。
不能把合成计数器及SDK传输替身视为已核验实际v4计数上界、账单或人工适用性。

正式 main 仅从 `DEEPTUTOR_AI1_CONFIG_FILE` 指向的私有 JSON 读取运行配置，缺省 off；
配置闭合键为 mode/storePath/storeContinuous/serviceTokenFile/providerKeyFile/profile。
配置及凭据要求绝对路径、私有父目录、当前用户所有、普通单链接文件，无符号链接，大小有界；FIFO 不阻塞启动。
query-only 需要既有合法库及明确连续性声明，但不读取当前报价或 Provider key；store-isolated 不打开旧库。
enabled 另验证现有 schema/唯一 id 索引、写事务可用性、独立凭据、报价与完整输入计数器；不自动建库或修复索引。
缺已核验计数器仍启动拒绝；当前 enabled 成功测试仅注入合成计数器和模型网络替身。
外层 lifespan 无论正常关闭或其他模块启动失败均清除 AI-1 runtime/ready，不删除持久记录或释放未知 claim。
连续性是受控配置前置，不意味着系统能自动发现未声明的旧备份回滚。

受限发送复用 DeepTutor 所用 OpenAI SDK，但不经过通用 chat 的换 key、兼容回退或 Agent。
固定官方 HTTPS 目标、TLS 校验、禁用代理继承/重定向/SDK及传输重试；最终 transport 再核对闭合正文和截止点。
完整 wire body 包含 system/user、固定模型、max_tokens=4096、stream=false、thinking disabled，不发送工具。
输入计数器必须绑定 modelProfileVersion，计整个 wire body 及模型模板开销；缺计数器或无法证明上界时拒绝发送。
当前测试计数器和模型响应均是合成替身；未提供已核验的 v4 计数实现，也未批准真实费用，不能据此启用或宣称硬限费。
原始响应在 SDK 解析前限为64KiB，保留用量原始整数类型；缺 usage 不补零，错误/取消不重试且保持持久 claim。
本次受限调用的 SDK 调试日志不记录正文/错误明细；其他调用的日志等级与处理器不更改。

| 接口 | 行为 |
| --- | --- |
| PUT `/internal/deeptutor/operations/:remoteOperationId` | 首次持久接收 201；相同 hash 200 返回既有记录；不同 hash 409，无第二次 Provider 发送 |
| GET `/internal/deeptutor/operations/:remoteOperationId` | 200 只读返回原记录；404 仅表明当前查不到，不能作为零费用/未发送证明 |

remoteOperationId 是 LMS 持久生成的 opaque UUID，与公开 operationId 独立。
PUT 正文闭合：`schemaVersion="ai1-provider-operation-v1",requestHash,modelProfileVersion,
pricingProfileVersion,messages,requestOptions,reservedCeilingMicros,sendNotAfter`。messages/requestOptions 与家长确认预览
完全一致；requestHash 对其余字段的 JCS 字节计算，不包含 requestHash 自身。无 family/child/actor/source ID。
两端只接受已启用 profile，计数和上界须再次核验；远端不能仅信任请求金额/参数。
sendNotAfter 为 UTC ISO 8601，计入 requestHash 且不得晚于远端按同一 profile 算出的安全截止点；
持久保存后不得延长。远端在 PUT 接收和 accepted -> sending 的事务 claim 中均重新采样时钟、
检查 profile 未变更/撤销和上界；最终 transport 前再检查，截止点之后不得调用 Provider。
accepted 上的拒绝和发送 claim 必须互斥：拒绝胜出写 failed_not_sent/PREVIEW_STALE；
claim 已胜出后再发现过期，停止发送但保守进入 unknown，不回写 sendClaimed=false 或宣称零费用。
提交未知先查原 operation，不能凭客户端时间或新 key 继续。完成记录的读取不因报价现在过期而失败。
LMS 将可靠 failed_not_sent/PREVIEW_STALE 或 PROFILE_UNAVAILABLE 映射为 Job failed/AI_PREVIEW_STALE；
其他可靠 failed_not_sent 或 failed_sent 映射为 failed/AI_PROVIDER_FAILED。
所有可靠 failed_not_sent 均可按原预留释放；failed_sent 只按可信 usage 结算，缺失则 reserved_unknown；
隔离和矛盾记录不走此终态映射。

返回统一 envelope，data.operation 闭合字段：`remoteOperationId,requestHash,modelProfileVersion,
pricingProfileVersion,sendNotAfter,status,result,error,usage,sendClaimed,updatedAt`。
status：accepted|sending|succeeded|failed_not_sent|failed_sent|unknown；
result 为 null 或 `{text,contentHash}`，text 非空且最多12000字符、响应总字节上限64 KiB；
error 为 null 或允许的稳定 code（VALIDATION_ERROR/PROFILE_UNAVAILABLE/PREVIEW_STALE/PROVIDER_FAILED/RESULT_UNKNOWN），
不传供应商原文；usage 为 null 或 `{inputTokens,outputTokens}` 非负安全整数且不超过固定上限。
sendClaimed 为持久单次发送 claim；failed_not_sent 必须 false，其余已发送/unknown 必须 true；
accepted 只能 false，sending/succeeded/failed_sent 为 true。时间和摘要一致性也需严格验证。

状态组合必须闭合：accepted/sending 的 result/error/usage 均 null；succeeded 必有有效 result、
error=null，usage 可缺失但不能伪造为0；failed_not_sent 必须 result=null、usage=null、
error 为 VALIDATION_ERROR/PROFILE_UNAVAILABLE/PREVIEW_STALE 之一；
failed_sent 必须 result=null、error=PROVIDER_FAILED，usage 可 null；unknown 必须 result=null、
error=RESULT_UNKNOWN、usage=null。任何相互矛盾组合按 AI_REMOTE_CONTRACT_INVALID 处理，不能释放预留。

仅存储连续性已确认且报价发送门禁通过的 accepted，worker 才可唯一 claim；发送前强制落盘 sending，再单次请求；worker 崩溃后发送 claim
不可重置。已得结果但响应丢失，GET 读取同一持久成功；已发但未持久结果则 unknown，不补发。
模型输出含非允许字段/超限/不可信 usage 时保留失败证据及费用占用，不返回假成功。
无可靠 usage 但完整有效结果可保留 candidate，预算仍 reserved_unknown；unknown 没有可展示的成功正文。
LMS 只认可与持久映射/hash/profile 匹配的完整终态；重复终态结算一次，终态冲突停止并报告。
LMS持久记录单调的 `remoteClaimObserved`；已观察远端sendClaimed=true后，后续failed_not_sent即为矛盾证据，
须在结算/释放事务内拒绝并暂停新发送，保留原预留及全局槽，不因本地重启丢失已观察事实。
not_sent 证据须来自正常完整 operation 存储且未发生回滚/恢复；存储完整性不明必须隔离，不能释放费用。
**恢复隔离优先于所有 operation 状态。** 已恢复/回滚的 accepted、sending、终态甚至空库均不能
恢复发送资格；这项限制不只作用于 not_sent 退款。worker 在准入前不得扫描/消费旧 accepted。
隔离时 PUT 和 GET 均返回 503 AI_STORE_ISOLATED（统一 error envelope，无 data.operation），
不伪造 sendClaimed、不把旧成功返回为可结算结果。原始数据保留供受控只读调查；LMS 不结算/退款、
不释放全局槽、不换 UUID，普通有权限的本地历史查看与其他人工业务仍可用。
发送默认关闭；启动 worker 前须确认使用连续未回滚存储，不能只信任同份可回滚数据库内的启用标记。
正常进程重启和快照恢复必须区分；本期没有自动解除隔离/重新启用接口，连续性无法证明就保持阻断。
不新增 reconcile 写接口或供应商查询框架；本期无法证明的未知结果保持阻断并走人工调查。

## 7. 稳定错误与前端动作

| HTTP / code | 契约及动作 |
| --- | --- |
| 400 VALIDATION_ERROR / 413 AI_INPUT_TOO_LARGE | 不预留、不发送；保留当前身份的编辑输入 |
| 400 AI_SOURCE_SUBJECT_UNSUPPORTED | 来源学科不在显式数学别名中，不信任客户端覆盖；初始拒绝零预留/发送，延迟发送前拒绝按未发送 CAS 规则处理 |
| 401 UNAUTHENTICATED / INVALID_IDENTITY_ENVELOPE | 当前身份清私有视图，重新登录；晚到旧身份响应不处理 |
| 403 CHILD_ACCESS_DENIED / FIELD_ACCESS_DENIED / AI_ORIGINAL_ACTOR_REQUIRED | 不泄漏内容；当前身份拒绝清私有视图，不能自动改 actor 重试 |
| 404 RESOURCE_NOT_FOUND | 范围内不可见或来源不存在；不查其他家庭以作区分 |
| 409 IDEMPOTENCY_KEY_REUSED | 不更换 UUID 隐藏冲突；要求核对原命令 |
| 409 AI_SOURCE_CYCLE_ACTIVE / AI_OPERATION_UNRESOLVED | 返回当前范围内可访问的定位引用，不解锁、不再 POST 生成 |
| 409 AI_PREVIEW_STALE / AI_VERSION_CONFLICT | 重新查看完整预览/候选，不自动接受新版或涨价 |
| 409 AI_BUDGET_EXCEEDED | 家庭共享/实验总预算不足，零发送；不切换家长/key 绕过 |
| 503 SOURCE_SERVICE_UNAVAILABLE / AI_PROFILE_UNAVAILABLE / AI_DISABLED | 保留手工业务；无可信价格/profile 不进入生成 |
| 503 AI_STORE_ISOLATED | 恢复/回滚或连续性未知；禁止发送和结算/释放，保留原映射/占用；不自动退出隔离 |
| 503 AI_REMOTE_UNAVAILABLE / AI_REMOTE_CONTRACT_INVALID | 已发送则标 unknown 并保锁；原命令显式恢复，不自动重生成 |

响应丢失时客户端不能假设操作失败；保留原 operationId，重登通过服务端发现恢复。
原命令不能从未知状态直接变“可重新生成”；错误 toast 不替代私有视图清理或后台锁。

## 9. 正式运行配置与回滚（D2 本地候选）

以下为服务启动配置，不是客户端字段或真实启用授权。没有默认模型、默认预算或从AI-0继承的额度。

| 配置 | 约束 |
| --- | --- |
| `AI1_MODE` | 缺省`off`；仅`off`、`query-only`、`enabled`、`store-isolated`，空字符串/其他值拒绝 |
| `AI1_LOCAL_STORE_CONTINUOUS`、`AI1_REMOTE_STORE_CONTINUOUS` | query-only/enabled均须为字面量`true`；代表操作员已核验两端连续存储，不能来自可回滚DB标记 |
| `AI1_OPERATION_URL`、`AI1_OPERATION_TOKEN` | query-only/enabled必需；固定HTTPS origin，无账号/路径/查询；独立32至256字符凭据，不得复用JWT/网关/内部/媒体/retirement凭据 |
| `AI1_ALLOW_LOOPBACK` | 仅`NODE_ENV=test`且显式`true`允许127.0.0.1或IPv6回环HTTP；其他运行环境拒绝，不修改TLS规则 |
| `AI1_PROVIDER_PROFILE_CONFIRMED` | enabled必需`true`；操作员已核验实际模型、完整请求计数、价格与全部重试层；声明不是测试证据 |
| `AI1_MODEL_PROFILE` | enabled必需闭合JSON对象：model/modelProfileVersion/pricingProfileVersion/checkedAt/expiresAt/callWindowMs/clockMarginMs/inputPriceMicrosPerMillion/outputPriceMicrosPerMillion |
| `AI1_BUDGET_LIMITS` | enabled必需闭合JSON对象：singleMicros/dayMicros/monthMicros/experimentMicros；全部为非负安全整数微元，无默认额度 |

配置在工厂创建时冻结，启动前验证实际模型连接、可写副本集事务能力和已有唯一索引；预检不创建索引或修复数据。
直接构造启用工厂但未完成预检时不得创建预留或发送；正式startServer在队列/监听前执行预检，失败按原生命周期收尾并脱敏。
profile在构造和就绪检查时校验，业务生成/claim/实际发送边界继续使用既有复核，不因启动通过跳过运行时截止点。

正常停止新发送使用query-only重建服务：不提供PUT方法，仅原actor显式查询既有dispatching/unknown映射并结算可靠结果；
reserved不能借恢复/原generate重放/新UUID获得发送资格。当前报价过期不阻碍按原可靠快照收敛，因此query-only不要求新报价或预算。
存储曾回滚、替换或连续性未知时使用store-isolated，保留未知锁和费用，不查询/结算旧快照、不自动解除隔离。
隔离证据只证明发送/恢复/结算边界，不宣称所有人工修订、审核、关闭API均禁止写入；它们仍遵守原权限/版本契约。
off为默认不发送/不远端查询的状态。切换模式需重建服务，不是新公开运维API。

这些声明及本地hello/索引检查不证明远端存储、Provider或未声明恢复的可靠性。
实际DeepTutor实现与连续性/计价/重试核验、凭据部署、付费授权仍是EXTERNAL_ACTIVATION_PENDING；
本地协议替身配置仅用于合成验证，不能直接用于真实启用。回滚不得清空记录、改变UUID或退化到直连模型。
