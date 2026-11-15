# AI2-1 孩子学习与人工订正最小差异设计

**Document status:** APPROVED (2026-11-03，含§1产品取舍)
**Profile:** AI2-MIN-1 (`ai2-min-v1`)
**Implementation / tests:** AI2-2/3/4及AI2-5子批ACCEPTED；2026-11-04用户批准AI2-5汇总及AI-2总门禁CLOSED / ENGINEERING_SYNTHETIC_ONLY，见[关闭记录](../../development/evidence/ai2-5-20261103/closure-readiness.md)。不改变已批准设计契约，保留历史失败、DEVICE_PENDING、其他OPEN门禁、非阻断及后置状态。
**Gate:** AI2-1 APPROVED；AI-2 CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY。不授权模型/Git/部署。

配套：[API](../../api/family-ai2-api.md)、[测试与评审](../../development/family-ai2-test-plan.md)。
依据：[当前路线 §9](../plans/2026-10-21-family-self-directed-learning-mvp.md#9-deeptutor-与-k12-最小对接路线2026-10-26-补充)、
[AI-1 最小设计](2026-10-31-family-ai1-minimal-design.md)。工作树基线 `4655d30f`；现有 T8/状态文档增量保留。
旧[完整平台设计](../../architecture/family-ai-learning-platform-design.md)只取人工审核、版本、权限原则，
不照搬其必填知识点/K12、练习、掌握写回、PDF/打印或通用 Outbox 全套范围。

## 1. 目标、取舍与待批准项

闭环：家长明确发布已批准讲解 → 孩子阅读题目与讲解 → 拍照提交订正 → 家长按所见版本退回或通过 → 孩子回看。
仅四年级上册、多位数乘两位数的单章节；章节仍为 parent_declared，不伪造教材覆盖/许可。
AI2 不调用模型、不改 AI1 预算/计数/Job；合成测试可通过真实 AI1 审核路径准备 Provider 替身制品。
真实生成/部署/孩子使用仍分别需要 AI1/T8 的准入与授权，不能用测试制品替代。

方案比较：直接开放 AI1 家长详情会泄漏私有上下文，且批准不等于发布；把订正伪装成普通任务会混淆教学审核和奖励。
推荐在 homework 增加小型 LearningPackage/Attempt/Command，关联 AI1 不可变制品；复用媒体事务机制，不建新常驻服务。

以下产品取舍已于2026-11-03由用户明确批准：

| 决策 | 推荐及理由 |
| --- | --- |
| 来源 | 沿用 task 或 mistake，不强制知识点；父母明确确认题目文字可给孩子看，不复制家长补充或原 answerText |
| 发布 | 家长单独确认孩子预览；同 AI1 Cycle 最多一个未撤回包；批准不自动发布 |
| 撤回/取消 | 仅家长撤回；包不可恢复原地发布，记录保留且后续孩子读取被拒；可重新发布同一仍合格制品为新包，不重用旧 Attempt |
| 订正 | 必须 1–10 张图片，可附 0–1000 字说明；保证纸上/iPad 订正有可审核内容，不增加纯文字提交模式 |
| 提交与代录 | 仅孩子本人提交；家长上传代录不在本轮，审核由任一当前共管家长执行 |
| 待审核修改 | 已提交内容不可编辑；家长退回后才产生新 Attempt，避免把正在看的作业替换掉 |
| 通过 | 仅表示本次订正被认可，不设已掌握、不改错题状态/复习日期、不调用任务确认/发星 |

AI2-2已获用户授权；重要契约变更仍需说明，不逐接口新建审批。

## 2. 现有实现与最小改动面

| 模块/文件 | 现状与拟变更 |
| --- | --- |
| `homework-service/models/Ai1.js`、`services/ai1Service.js` | 批准制品不可变且家长专用；保持旧 DTO/孩子拒绝，新增 AI2 专属投影与同库事务校验，不放宽 AI1 |
| homework 新 `models/Ai2.js`、`services/ai2Service.js`、`routes/ai2.js` | 三种记录、发布/提交/审核/撤回及持久恢复；复用现有事务、身份、CAS 模式，不把新状态塞进 Ai1Cycle |
| `common/services/learningSource.js`、analytics 来源路由 | 复用同家庭同孩子最小只读来源；不跨服务写库，不要求返回原始图片/答案全文 |
| resource `MediaAsset`、`MediaReference`、`MediaReferenceOperation` 及操作 client | 目前 purpose、resourceType、field 均有限定，operation 只接受 growth_task/completionMediaIds；须增加明确的 AI2 类型分支，见 §6 |
| resource 媒体访问、删除分派、证据、上传 guard、readiness | 适配新类型的访问、墓碑/精确凭证及启动检查；旧协议摘要、旧日志和旧任务行为不变，不扩展灾备恢复 writer |
| Gateway/server 正式装配 | 新路径签名转发、闭合 JSON 校验、默认关闭；内部媒体核验路径不公开代理 |
| `familySession`、`useAsyncResource`、`tutorCommands`、`PrivateMediaCollectionField` | 复用身份代次/组件，新增 AI2 DTO 与原命令暂存键，不能复用写死 task 路径或旧字段白名单 |
| 前端家长 TutorPage 与孩子任务入口 | 加发布预览/学习包链接；孩子学习与订正详情、家长待审/历史；不新建通用审核工作台 |

服务路径均相对 `backend/services/`，前端路径相对 `frontend/web/src/`。实施时允许依现有目录拆分，职责不扩大。
功能开关、状态校验沿用现有装配/工具；不用新测试框架或新永久执行器。

## 3. 发布快照与可见性

预览由服务端读取当前 AI1 Cycle/approvedArtifact，精确核对 id/version/contentHash/reviewVersion，
并实时验证父母成员、孩子归属、来源数学别名。仅 active approved Cycle 可新发布；closed/rejected/candidate/unknown 不可发布。
source 404 阻止新发布，503 保留依赖错误；不把来源查询失败解释为可以使用客户端快照。
孩子预览含原 input.questionText、已批准 explanation.text、章节最小声明和来源 type/id；
不含 input.answerText、parentContext、全部候选、生成 system/user、job、费用、审核者个人信息或存储 URL。
家长看完精确预览再确认 childContentConfirmed；讲解本身可能含解法，人工审核负责适龄/提示程度，不声称自动脱敏。

publish 同事务保存上述不可变快照和 hash、首个发布 actor/time，唯一活动键约束同 Cycle 并发。
跨服务来源存在性是发布前读校验，不声称与 analytics 原子锁定；返回后发生删除时按历史规则处理，不跨库事务。
已发布包不随源题目/标题/AI1 指针变化刷新正文；详情的 sourceAvailable 为 false 时提示历史来源不可用。
来源服务暂时异常返回 sourceAvailability=unavailable，历史快照仍可读；历史可读不是允许再发布。
AI1 后续关闭是备课归档，不自动撤回已发布包；需家长显式 AI2 withdraw。隐私媒体删除另见 §6。

包授权每次读写重新检查真实身份/家庭/孩子；孩子仅可读自己 published 包及其已提交 Attempts。
withdrawn 对孩子列表隐藏、详情 404；家长可读撤回历史，不能继续审核/提交。
撤回不是删除历史；整份学习档案的隐私删除/保留策略不在本轮新建，不能宣称撤回完成数据删除。
撤回不可能收回已下载正文/图片；本轮不加推送服务。孩子页面进入/恢复焦点/主动刷新及写前重读权限，
收到404/403清空旧视图；不得宣称离线或始终未刷新的已打开页面会瞬时清屏。
页面实施说明：新提交在发送前只读核验，不替换用户所见版本；原命令重放/显式恢复不以再次读取撤回正文为前提，
仍由服务端核验原actor和权限并仅返回允许的最小终态。预读失败不是写确认，不释放未知命令。
家长详情DTO未携带childId时，页面通过现有当前孩子分页列表核验包归属后才显示；不把URL参数当归属证明。

## 4. 最小模型、索引与状态

| 记录 | 字段/约束 |
| --- | --- |
| Ai2Package | familyId/childId、ai1CycleId、source(type/id/subject)、artifact(id/version/hash/reviewVersion)、childSnapshot+hash、publishedBy/At；visibility=published/withdrawn；learningState=open/submitted/revise/approved；stateVersion>=1；currentAttemptId/version 可空；activeCommandId 可空；withdrawal(actor/time/reason)可空 |
| Ai2Attempt | family/child/package、attemptVersion>=1、原 submitCommandId、submittedBy/At；不可变 note、ordered mediaIds、精确 mediaBindings 和 payloadHash；review=null 或一次追加的 decision/comment/reviewer/time/reviewOperationId |
| Ai2Command | family/child/package/actor/endpointOperation/operationId/requestHash；原规范 payload、expectedPackageVersion；预分配 attemptId/version、remoteOperationId、完整引用集/hash；phase、owner/lease、resultReference、failureCode/首次审计 |

索引：Package `(familyId,childId,ai1CycleId)` 在 visibility=published 上部分唯一（通过后仍占活动发布位）；
Attempt `(packageId,attemptVersion)` 和 `submitCommandId` 唯一；Command `(familyId,actorId,endpointOperation,operationId)` 唯一，
remoteOperationId 非空部分唯一；用于原 actor 恢复发现的 `(familyId,childId,actorId,phase,createdAt)` 普通索引。
不对同字段重复声明普通/唯一索引，不自动修复现有数据；新索引未就绪/冲突即禁止启用写入。
review 不单独建集合：同事务 CAS `review=null`、当前 Attempt、Package stateVersion，并记录唯一命令结果。
若两个家长使用同 UUID，命令仍按 actor 隔离，只有一个审核 CAS 成功；没有第二次审核覆盖入口。

```text
published/open --提交成功--> published/submitted
published/submitted --revise(必须反馈)--> published/revise --新提交--> published/submitted
published/submitted --approve--> published/approved (教学状态只读)
任意 published --家长撤回--> withdrawn (保留学习状态、Attempt、审核、首次发布审计)
```

待提交草稿仅前端持有；取消选图/离开页面不删除远端媒体，不产生 Attempt。
待审核不得新提交；approved 不再订正，需撤回后新包才可另起一轮。旧 Attempt 永远可由当前授权家长查看。
提交期间 activeCommandId 锁住本包其他提交/审核；撤回允许胜出，最终发布 Attempt 的 CAS 必须检查仍 published。
撤回与审核也在 Package stateVersion 上竞争；失败方 409 重读，不自动替用户提交新决定。

## 5. 持久命令与结果未知

所有写命令先实时鉴权再查幂等；同 actor/endpoint/key 同摘要返回原结果引用，异正文 409。
新发布/审核/撤回在本地事务保存业务变化与命令结果；提交未知先按原 key 查询，不创建第二个副作用。
提交占位事务保存规范 note/mediaIds、预分配 Attempt ID/version、独立随机 remoteOperationId 和 Package 锁；
不能将用户 UUID 直接用作远端 ID。多 actor 同 UUID 不串用；只有原 actor 可显式恢复，不能客户端覆写 actor。

提交阶段为 RESERVED → MEDIA_PREPARED → MEDIA_COMMITTED → SUCCEEDED，或 RESOLVING → FAILED；
网络未知保留阶段及映射，不因为 lease 过期推断远端失败。RESOLVING 表示必须继续收敛/解绑，仍占本包锁。
prepare/commit 先查同一远端 operation 并校验摘要、完整引用集合、类型和绑定代次；PREPARED/COMMITTED 重放均可恢复。
最终本地事务按 owner/phase、Package activeCommandId/stateVersion/visibility CAS 创建一次 Attempt、推进 submitted、保存结果并清锁。
数据库提交未知先读回原命令/Attempt；不得先解绑可能已发布的媒体。失去 owner 的执行者只能读状态/返回未决，
即使查询暂未发现 Attempt，也不得自行 abort/unbind。当前 owner 需要补偿时，须先在本地事务用
owner/phase/Package锁 CAS 进入 RESOLVING，并保存失败原因；这次条件写与最终 SUCCEEDED 事务竞争同一命令行。
RESOLVING 是不可回到发布阶段的补偿分支，接续 owner 只能完成 abort/精确 unbind，不能再次发布。
仅确认该不可发布转换已经持久提交后才操作远端；转换提交未知先读回，不能凭本地推断启动清理。
SUCCEEDED 胜出则只返回原结果，不补偿；RESOLVING 胜出则任何后续最终发布必须失败。
清理请求只针对该命令映射/代次，可幂等接续；确认终态和清理结果前保锁，不能宣称已失败解锁。
远端 ABORTED/租约终态按既有协议收敛，失败命令保持原终态；只有明确终态后，用户才可重新操作并创建新命令。
普通媒体移除不解绑已提交历史；引用重复使用于新 Attempt 时增加新引用，不替换旧引用。

GET 详情/命令发现/状态均无写，不 prepare、commit、abort、结算或后台自动恢复。
原 actor 重登可发现持久提交，点击恢复使用服务器保存的 payload/映射，无需 localStorage 留住私有正文。
所有写入口先在 sessionStorage 保存规范原命令再发送；未知锁期间不能关表单当成功或自动换 UUID。
退出/切身份清除私有 DOM/blob URL/暂存（包括坏 JSON），撤销旧响应代次；服务端命令证据保留。
当前身份 401/403 先清视图并废弃旧请求；404 显示不可用并清正文；网络失败保留原命令重试入口。

## 6. 图片与隐私安全的必要适配

新增 purpose=`ai2_correction`、resourceType=`ai2_attempt`、field=`correctionMediaIds`；resourceId 是预分配 Attempt ID。
仅孩子本人可上传此 purpose，不因媒体通用家长上传能力而默许代录。图片 JPEG/PNG/WebP，单张最多 10 MiB，
每次提交 1–10 个唯一 mediaId；拒绝 PDF/HEIC/伪 MIME/稀疏数组/重复/跨孩子/错误 purpose。
复用真实内容校验、重编码及当前安全 profile，不能以新用途绕过 secure-production 扫描要求。
成功上传项保留，失败逐项反馈；有失败项未明确移除前不提交。移除仅改变本地选择；删除另有显式确认。

严格限定两个合法 operation 类型对：旧 growth_task/completionMediaIds/task_completion 与新增 AI2 对，
不能仅扩大 enum 后允许任意组合。保留旧请求规范化和 hash 不变，新类型的规范摘要、结果和凭证包含类型/field，
现有 client、事务操作、readiness、UploadGuard、删除分派/日志/Receipt 同步识别；未知类型失败关闭。
同库小范围适配现有协议，不另建通用资源注册器或新恢复引擎；precheck 必须验证混合旧新记录及旧日志兼容。

孩子读取 AI2 媒体：尚从未绑定的上传只允许上传本人预览；有任何历史绑定的媒体必须至少关联一个自己
可见的 published Package 的已提交 Attempt。prepared/未发布 Attempt 或撤回包不授予读取权，不能把 released 记录
当作“从未绑定”。家长按当前家庭/孩子权限读取（包括待提交及撤回历史）。
resource 经服务凭据保护的 homework 只读核验接口检查绑定归属与包可见性；不直接读写 homework 库。
当前旧正文 GET 是匿名 capability 路径，capability 不含可验证的当前用户会话；不能原样复用来保证身份失效拒绝。
新增 AI2 专用 `/api/media/:mediaId/authenticated-content`，挂在 Gateway JWT/resource身份中间件之后；
Gateway验JWT，resource验可信签名身份并实时复核孩子tokenVersion/家庭关系，不能用上传者冒充读取者。
`/access` 对新purpose签发该路径的短期capability，正文必须同时携带有效会话和capability，再检查当前绑定/包可见性。
前端通过现有认证请求层取blob再预览，不能直接img src携带匿名URL；退出/换身份及时revokeObjectURL。
旧匿名正文路径必须明确拒绝 ai2_correction，即使旧URL签名有效；旧媒体用途仍按原契约，不一并改造。
签发和正文请求都实时核验，不缓存孩子可见性；依赖失败503，旧capability不能绕过PIN重置/撤权/撤回/删除。
未绑定且无历史引用的本人预览不依赖包，不能用这个例外访问已经绑定后释放的对象。

复用显式 DELETE 媒体接口和当前身份校验：孩子可删除自己上传的本用途媒体，家长可删除当前家庭孩子媒体。
删除使正文不可读、撤销 capability，并保留首次审计、墓碑及每个精确 bindingOperationId 的凭证；
同图多 Attempt 时全部相关引用进入既定删除处理，不只删当前投影。日志持久化/元数据事务/正文收尾沿用现有失败闭环。
删除不改 Attempt 原提交字段、审核/奖励/教学状态；DTO 用 deleted 占位，不伪造原来未提交图片。
提交恢复遇到精确删除凭证可以保留历史提交事实并显示 deleted；缺凭证/错代次不得当作成功绑定。
新增审核 approve 必须确认当前 Attempt 图片均可读，否则409要求退回后重新提交；已通过后的删除不追溯改写审核。
审核前读取核验与稍后删除不是跨服务原子事务，首次审核保存其核验引用摘要/时间，后续删除仍按占位展示，不承诺永远可读。
AI2 新类型删除日志必须可识别且不覆盖旧日志；备份恢复缺证据继续隔离，不能借本轮扩大 D2b/D3/D4/E。
AI2-3实施细化：AI2删除墓碑/日志保留不可变`mimeType`和`sizeBytes`（仅JPEG/PNG/WebP、1字节至10 MiB的实际字节数），
使正常保留清理移除Asset后仍能凭同范围墓碑和精确代次Receipt返回deleted占位；不保留正文或存储路径。
旧task_completion墓碑和日志字段/摘要不变；AI2证据缺失或冲突仍拒绝，不自动修复或扩展高级恢复writer。
未绑定孤儿自动回收仍后置，退出/撤回/未知结果不自动删除上传文件。

## 7. 开关、启用与回退

拟增 `AI2_MODE=off|enabled`，homework/resource 均默认 off，与 AI1 真实发送开关独立。
AI2-3独立工厂阶段仅接受显式注入的合成运行模式，省略模式即off，不因全局`AI2_MODE=enabled`自动开启旧正式装配。
正式环境变量接线、跨服务metadata读取装配、Gateway与完整启动预检仍留AI2-5，未完成不得开启真实写入。
off 拒绝新发布/新提交/新审核及新 ai2_correction 上传，不影响旧用途媒体上传，
已有 published 历史仍按实时权限读取，家长撤回及正常媒体隐私删除保留；关闭不等于删除记录。
原提交 recover 可查询/abort/精确解绑，或收敛已经 COMMITTED 的本地结果；off 禁止新的 prepare/commit，
尚 PREPARED 则 abort 后失败；若并发 commit 已成功，按真实终态和最终 CAS处理，不伪造未提交。
新写入前实时检查模式，关停期间先阻断准入再等待在途操作收敛；不得仅依赖浏览器隐藏入口。

启用前：两服务支持新 profile/媒体类型、必需索引/事务/日志目录/上传 guard/服务凭据就绪，
家庭权限与旧媒体回归通过；合成环境允许测试配置，不绕过现有 precheck。AI1 真实计数和 NAS 不作合成设计前置。
快照恢复/连续性不明时沿用既有维护隔离，不使用普通 recover 自动解除恢复隔离；T8 仍负责真实恢复/发布验收。
有 AI2 数据后只关闭功能并保留兼容 reader/删除路径，不直接退到不认识类型的旧 resource/homework 二进制。
无新数据才可按匹配版本回滚；出现新数据优先前进修复，停写与数据回滚须另行评审，不提供自动降级脚本。

### 7.1 AI2-5 正式接线细化

2026-11-03用户批准AI2-4限定合成验收及草稿刷新P2关闭后，授权开始AI2-5正式应用接线，状态IMPLEMENTING。
上文工厂阶段与待接线描述保留为阶段边界；以下落实原有启用/隔离契约，不另建审批框架，不表示已实现或测试通过。

- homework/resource正式解析`AI2_MODE=off|enabled`，默认off；新增明确的`AI2_STORE_CONTINUOUS`声明，默认false。
  enabled必须同时满足`AI2_STORE_CONTINUOUS=true`与`COMPLETION_PROTOCOL_MODE=enabled`；
  安全关闭后仍需这两个条件才可提供既定历史读取、撤回、原命令恢复及正常隐私删除，不将off等同于取消连续性要求。
  off且连续性false不回退旧协议、不以空仓或旧reader猜测恢复安全；maintenance及连续性不明保持隔离。
- 启动时检查必需事务能力/索引及正式数据库connection，模型不能落到与正式服务不同的临时或默认连接；
  沿用现有启动预检和维护隔离，配置/凭据/依赖不就绪不得宣称可用，不用普通recover绕过恢复隔离。
- Gateway正式挂载`/api/ai2`的JWT验证和签名身份代理，保留原始JSON，解压后UTF-8上限32 KiB；
  homework装配正式公共AI2路由及内部`POST /api/internal/ai2/media-access-check`，后者不经公网Gateway暴露。
- resource新增受现有`MEDIA_REFERENCE_SERVICE_TOKEN`保护的只读metadata入口
  `POST /api/internal/media/ai2/inspect`，请求闭合`{familyId,childId,identity,mediaIds,bindings}`，
  返回`{success:true,data:{items:[{mediaId,mimeType,sizeBytes,status}]}}`；禁止底层路径、URL/capability及正文bytes。
  identity由已认证的服务端请求构造，仍实时核验家庭/孩子/权限及精确绑定；凭据不是浏览器授权的替代。
  缺证据/跨范围/依赖失败拒绝，不回落旧metadata协议；详见[API§5.1](../../api/family-ai2-api.md#51-ai2-5-正式metadata-inspect接线契约)。

正式HTTP、浏览器闭环及相关回归结果由主线程另行追加到测试方案§9；已有组件/API替身通过不能代替本批验收。
仅合成实施，不授权模型、Git、部署或真实家庭启用；AI-2及现有OPEN/DEVICE_PENDING/后置边界保持。

## 8. 页面与实施顺序

家长：原 Tutor 已批准详情 → 孩子可见预览 → 明确发布；同孩子学习包列表 → 当前订正及历史 → 退回/通过。
孩子：今天/任务或错题已有入口 → 学习包题目/讲解 → 图片选择/预览/提交 → 待审核 → 退回再提交或通过回看。
不支持来源直接链接时仍由孩子学习包列表可达，不自动创建会发星的新 GrowthTask。纯文字呈现，不执行 HTML/外链。
使用现有触控/布局规范；图片加载和提交状态尺寸稳定，弱网保留成功上传项；不新增画板/离线同步。

AI2-2：Package/Command/Attempt、发布与审核权限/CAS；AI2-3：严格类型媒体适配、持久提交恢复和删除边界；
AI2-4：孩子/家长页面与身份隔离；AI2-5：正式 HTTP/浏览器闭环、相关回归/构建、证据与工程验收。
每批自查、聚焦评审、有效修复加永久反例；只在关键契约变更或真实外部操作时再审批，不逐小步骤冻结。
AI2-1不生成实现代码、schema fixture 或新测试 runner。后续AI2-2已获授权，批次实现与证据见配套测试文档§6。
T4/T8/AI-1 OPEN、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收 REMAINDER_DEFERRED、T9 NOT_STARTED 全部保留。
