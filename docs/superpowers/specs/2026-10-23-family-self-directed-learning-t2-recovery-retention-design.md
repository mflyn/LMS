# T2 退出后恢复与孤儿媒体安全回收补充设计

> **当前执行范围（2026-10-24 用户批准）：** 未完成的新孤儿回收与用户删除高级恢复后置，
> 不再作为 T2-2 至 T2-6 页面开发/合成验收前置；T2-R 和已接入上传、删除、权限、幂等、版本及预检保护保留。
> D2b 剩余、D3/D4/E 不继续扩展或接入半成品，D01/T2-G 仍未验收；既有成果和历史证据保留。
> 本文后续原顺序和批准记录为历史基线；当前保留/后置矩阵、运行依赖和启用限制以
> [执行记录 §11](../../development/family-self-directed-learning-t2-execution.md#11-2026-10-24-mvp-范围调整与页面运行依赖)为准。
> 不删除现有事实、不降级旧 writer、不绕过校验；将来启用后置能力时仍须完成本文原安全验收。

**Status:** APPROVED
**User design approval:** APPROVED（2026-10-23）；含新增接口、模型、专用凭据、24 小时保留期及每批 50 个参数
**Implementation:** T2-R 后端 CLOSED（2026-10-23 用户验收，含 P2）；T2-G IN_PROGRESS；仅合成验证，不授权真实迁移、部署或 Git 发布

## 1. 决策与范围

2026-10-23 用户明确要求“先补充退出后恢复设计，再编码”和“先补充安全回收设计，再实施媒体批次”。
不再以接受原限制作为 T2 的默认退出条件。本补充覆盖
[T2 原设计](2026-10-23-family-self-directed-learning-t2-design.md) §4.1、§5 中相应限制；其他规则保持。
T2-R 的三个公开恢复端点已完成后端合成验收；T2-G 新模型/内部端点分增量实施中，尚未完成正式组合或回收验收。
本文件不代表默认启用或真实部署，最新实现/测试状态见执行记录 §9。

现状依据：homework 的 `growthTaskCompletionService.recover()` 已能用持久意图恢复，但未公开装配；
resource 上传后为 active 资产，现有两类 cleanup 都只选 deleted，不能回收响应丢失或退出后遗留的 active 草稿。
`mediaReferenceOperationService.fenceAssets()` 已在事务中实际更新资产，能与本服务删除竞争；
但仅查 resource 引用无法发现 homework 已占位、尚未发 prepare 的本地意图。

| 方案 | 取舍 | 结论 |
| --- | --- | --- |
| 永久保存客户端命令，按资产年龄直接删除 | 退出隐私与恢复冲突；存在未发远程 prepare 的本地意图，年龄不证明孤儿 | 不采用 |
| 服务端发现并恢复原命令；跨服务持久回收屏障 | 增加小范围 API/模型与 CAS，保留 T1 原命令语义，不要求浏览器长期保存学习内容 | 已批准，T2-R 后端验收关闭、T2-G 实施中 |
| 重做上传会话/离线同步与完整媒体库 | 可以扩展更多体验，但涉及本轮未要求的上传管理及离线协议 | 不采用 |

新增范围只解决已持久完成命令的退出恢复、已入库 task_completion 孤儿资产；不开放内部 operation 协议给浏览器，
不增加 PDF/HEIC/OCR，不把共管发星恢复扩大为共管代替原 actor 提交作品。

## 2. 退出后恢复：公开契约

### 2.1 只读发现

新增 `GET /api/growth-tasks/:taskId/completion-recovery`，经 Gateway 与 homework 原身份校验。
每次实时验证家庭、孩子、角色及孩子 tokenVersion；不存在/无权任务仍统一 403 CHILD_ACCESS_DENIED。
同一次只读事务读取 task 的 active owner、completionPending 和本地 operation，验证原 scope、阶段、版本、hash、
持久 remoteOperationId 和完整集合一致性。GET 不调用远程、不补写、不续租、不推进阶段。

200 正文为 `{success:true,data:{recovery:{state,operationId,targetCompletionVersion}}}`，只允许以下投影：
- `none` / null：没有活动完成意图；不等于上一次提交失败，页面须 GET 当前任务确认业务事实。
- `recoverable` / 原公开 operationId：活动 owner.actorId 等于当前 actor，且持久映射完整。
- `other_actor` / null：当前用户可看任务但不是活动提交者；不返回其 ID/姓名、正文、hash 或命令标识。
- 意图或映射不一致：503 MEDIA_REFERENCE_PENDING，阻断新写并告警；不能投影 none。

targetCompletionVersion 仅 recoverable 时返回持久命令的目标整数版本，其他状态为 null。

返回 `Cache-Control: no-store`；不返回 remoteOperationId、绑定代次、待发布备注/图片正文或签名地址。
字段属于恢复状态而非权限凭证；响应经前端 schema 校验，畸形响应不得开放新提交。

新增跨日发现 `GET /api/growth-tasks/completion-recoveries?page=1&pageSize=20`，默认20、上限50，
路由注册在 `/:taskId` 之前。以服务端当前 actor/实时家庭与孩子权限筛选全部日期的活动意图，
禁止客户端指定 actor/family，返回 `{success:true,data:{items:[{taskId,childId,operationId,targetCompletionVersion}],page,pageSize,hasMore}}`。
稳定按 taskId 排序；仅当前actor自己的可恢复项，不返回其他人的意图/正文。逐项核验映射，损坏项明确503而非偷偷漏掉。
分页期间并发完成可能使列表变化，详情发现接口再次核验；扫描/换页不推进恢复。
孩子首页与家长任务页增加跨日“待恢复提交”入口，不依赖今天列表或本地taskId；新浏览器登录即可访问。
已终态任务不在活动列表里，没有列出不证明失败；本接口不承诺完整历史作品库。

### 2.2 显式恢复

新增 `POST /api/growth-tasks/:taskId/completion-operations/:operationId/recover`，无请求体（允许空对象），
拒绝原正文替换、版本修改、actorId 和 remoteOperationId 等字段。仅当前有权限的**原 actor**可恢复。
相同 UUID 由不同 actor 使用时查询包含 actor 的完整原 scope，不取“最近一条”也不切换 owner。
合法 UUID 对应命令不存在/不属于当前 actor 时统一 404 RESOURCE_NOT_FOUND；任务无权仍 403。

handler 调用受控 recovery 服务：先实时鉴权及确定本地命令存在，再复用 T1 的 stateFor/assertIntent/converge。
由服务端的持久 pending 重建并校验原 hash，使用原 remoteOperationId、完整媒体集合与精确旧绑定代次。
不新增 operation、不换 UUID、不生成新映射、不解除其他命令锁，也不以此恢复材料 pending。

- SUCCEEDED 返回原固定 successResponse（200）；FAILED 返回原稳定 4xx；非终态推进原流程，仍未知返回503。
- 历史终态 A 恢复时即使 B 已活动也只能重放 A；不能推动或清除 B，返回历史投影后页面再 GET 当前详情。
- 404 命令不存在与原命令失败在此端点可能共用 code，不能套用 complete 的“404 即本命令 FAILED”分类。
  恢复 404 后重新发现并读取任务；仍 pending 则保持阻断，不自动新提交。其他未知响应同样不证明终态。
- 服务端实时权限撤销后拒绝，不能为了消除锁而冒充原 actor。原账号永久不可用或已离家不是“正常退出”，
  本提案不授予其他家长强制代交权限；保留受控排查/另审转交策略，明确界面提示，不能声称全身份场景已解决。

### 2.3 前端与退出语义

sessionStorage 仅作为当前会话原 PATCH 的便捷重试缓存，不再是退出恢复的唯一来源。
主动退出、账号切换清除学习内容 envelope/私有预览；同一 actor 在新标签或另一设备登录后，
读取任务及 recovery，点击“继续上次提交”发 POST；初始 GET、挂载、可见性变化和登录本身均不自动写入。
仅本地尚未发送/服务端尚未占位的草稿不保证退出保留；若服务端无意图，则重新查看当前任务后允许新用户意图。
已发送请求与新命令竞争仍由 T1 单 owner/CAS 裁决，不由前端 none 猜测没有在途请求。

存在本地完整原命令时优先重放原 PATCH；本地缺失/损坏时以发现 + POST 恢复，不能猜测原正文。
无本地正文的恢复应答校验公开成功结构、taskId、发现时目标版本、合法有序唯一媒体集合；不能伪称已与本地原集合比对。
完整原集合/hash/绑定代次由服务端恢复不变量及真实HTTP测试证明；应答后GET最新详情再展示当前事实。
发现后 owner 已完成或变化，通过明确 operationId 重放固定结果；不会变成“恢复当前任意 owner”。
同 actor 重新授权、跨标签发送快照与迟到401防护保持原设计 §4.2；确认/发星恢复继续按所见版本而不是本端点。

## 3. 孤儿定义、保留与数据模型

首版保留期为上传成功后 **24 小时**，批次默认 50、上限 100，随本补充设计获用户批准；代码已按此实施，T2-G 批次验收仍待完成。
只在明确启用的合成运行器执行回收，真实环境仍关闭。保留期不是任务完成意图的租约，不使任务 pending 自动过期。

可自动回收必须同时满足：purpose=task_completion、active、具有受支持 retentionPolicyVersion/eligibleAt、超过截止点；
homework 无当前/历史保留的完成作品引用、无任何 PREPUBLISH/PUBLISHED_CLEANUP 意图使用；
resource 无 prepared/bound 引用、无 COMMITTED 历史及精确删除凭证。已发布后普通解绑也不属于首版孤儿。
released 引用仅在能关联原 ABORTED operation、完整scope/集合/hash一致且无已提交历史时允许；证据不齐拒绝回收。
不能以公开 bindingOperationId 是否为空判断曾否绑定：既有投影会把 ABORTED released 的 operationId 也输出为该字段。
prepared 即便租约过期也跳过，先由原恢复协议终结；GC 不做整组 abort，不篡改绑定代次。

新增/扩展模型（名称为实施落点）：
- MediaAsset 增加不可由客户端指定的 `retentionPolicyVersion=1`、`orphanEligibleAt`，仅新 task_completion 上传设置。
  eligibleAt 按服务端确认入库时间+24h，不能因访问/重试任意延长。增加 purpose/status/policy/eligibleAt 扫描索引。
  系统删除另设 `orphanRetirementId`（不可由公开请求指定）。普通 cleanup 必须排除此标记或有 retirement 系统删除证据的资产；
  completion 隐私 cleanup 仍只处理用户墓碑。系统资产只能走系统 journal 路径，不能设置 privacyDeletionRecorded=true 冒充用户删除。
  增加可空运维字段 `orphanLastCheckedAt` 用于持久轮转；它不是删除审计或保留期，不能影响 eligibleAt、__v 或业务更新时间。
  每批统一排序候选资产与待恢复记录，尝试前原生 `$max` 更新此字段，使长期 in_use/失败项不永久占满前50名。
  调度值须大于全候选集合的已记录最大值，不能仅比较本行与当前墙钟；时钟回拨不应造成后续项饥饿。
  超出合法Date范围或字段类型异常时零写失败关闭，不重置调度时间绕过错误。
  不把媒体ID或分页游标输出到运维日志；重建进程继续使用数据库中的轮转位置，不依赖内存游标。
- homework 自有 `CompletionMediaGuard`：familyId、childId、mediaId 唯一，state=available/retired，revision、
  retirementId（retired 后不可变）、retiredAt。没有学习正文；retired 无 TTL，不能自动重置 available。
- resource 自有 `MediaOrphanRetirement`：mediaId 唯一、family/child、retirementId、固定 storageKey、policy、eligibleAt、
  state=CANDIDATE/FENCED/DELETED/PURGED/SUPERSEDED/INCONSISTENT、revision、首次操作时间及 `actorType=system`。
  不把 uploadedBy 伪造为删除执行者，不复用 `reason=user_requested`，不生成虚假的精确解绑凭证。
  固定 `uploadMetadataHash` 一并进入系统日志，供清理后/旧备份恢复时重建相同 UploadGuard；只保留规范元数据摘要，不保留文件名或图片。
- resource 自有 `CompletionUploadGuard`：mediaId 唯一、固定scope/storageKey/摘要、state=REGISTERED/RETIRED、revision。
  metadata 首次创建/重试与系统/用户删除均须在各自事务里实际写该行；RETIRED不可逆且无TTL，元数据清理不删除guard。
  旧无guard资产在删除事务中按固定身份建立RETIRED；其目的为禁止上传未知结果重试复活已删资产，不承载学习正文。

模型分别归各服务所有，通过内部 API 协作，不跨服务直写库。唯一索引与 guard 写入能力是启用前置条件。
新模型/索引未就绪时回收 fail closed，不默认 autoIndex 成功、不通过缺集合跳过权限和引用检查。
REGISTERED UploadGuard 已存在但资产缺失属于未收敛/损坏状态，预检拒绝；旧资产从未创建 guard 的兼容读取不受此规则影响。

## 4. 回收与完成竞争协议

### 4.1 homework 禁止新使用屏障

新增内部 `POST /api/internal/completion-media-retirements`，使用拟新增独立限定用途凭据
`COMPLETION_RETIREMENT_SERVICE_TOKEN`，仅注入 resource 调用方与 homework 验证方；常量时间比对、缺失fail closed，
不得复用 MEDIA_REFERENCE_SERVICE_TOKEN/STAR_SERVICE_TOKEN 或 Gateway身份签名凭据，禁止只信任自报服务名。Gateway 不代理；
正文严格为 familyId、childId、mediaId、retirementId。返回同一 scope/retirementId 的 granted 或 in_use，
缺失/不一致/不可用返回稳定错误或503；不能用不存在的家庭作为 granted。浏览器/其他服务凭据均拒绝。

2026-10-23 用户追加批准只读 `POST /api/internal/completion-media-retirements/status`，使用同一专用凭据及四字段正文。
同一只读事务实时验证家庭/孩子及 guard：返回同一 scope/request retirementId 与 `absent`、`available` 或 `retired`。
前两种状态的 retirementId 只是请求回显，不表示已持久退休；只有原 guard 已退休且ID匹配才返回 retired，
已退休但ID不同返回409 MEDIA_RETIREMENT_CONFLICT。不得创建guard、递增revision、刷新时间或调用写接口作为预检。
接口用于跨服务启用/备份恢复核验，不增加浏览器访问或代替原actor完成的权限。

所有 enabled 新 complete 的 claim 事务，在创建 operation/任务 owner 前，按 mediaId 排序，
对整个意图涉及的 desired/previous/removal 媒体逐条 upsert guard 并实际增加 revision；遇 retired 返回
404 RESOURCE_NOT_FOUND，整笔新 claim 回滚，无本地占位。原命令/历史终态重放先走已有命令分支，不受此新占位检查替换。
新 unique 首次插入竞争和事务写冲突需有界重试；不能只读 guard 或只使用不发生变更的 $set。

内部 retirement 同一事务触碰相同 guard 行并检查所有同家庭/孩子任务，包括取消/归档任务的
completionEvidence、completionMediaBindings、completionPending.mediaIds/previousBindings/additionIds/removalBindings。
如存在引用/意图则 in_use，不设 retired；否则 CAS available→retired，永久绑定 retirementId 后 granted。
新 claim 与 retirement 至少写同一 guard 行，因此不可同时提交“无使用”与“新增使用”。
历史未有 guard 的 pending 由上述扫描保护；不能仅检查新 guard，也不能用页面任务筛选遗漏归档或隐藏意图。
首次授予 retired 前，还须在同一事务交叉核验同家庭/孩子的非终态完成账本与任务 owner/pending：
owner/pending 丢失、账本缺失、重复活动 owner、hash/阶段/完整集合不一致时，不能把缺少媒体路径当作 unused。
此时返回503并回滚 guard 写入；不修库、不接管原 actor。已确知引用时直接 in_use；完整且不涉及目标媒体的活动意图不阻止退休。
发布/清理不能绕开既有 owner/版本 CAS；未来新 writer 必须接入此 guard 才可启用回收。

### 4.2 resource 回收状态机

1. 扫描候选只读检查年龄/策略和引用证据。为候选事务化创建唯一 CANDIDATE 记录，固定 retirementId/storageKey；
   相同候选并发只复用该记录，不产生多个回收命令。候选存在不阻止正常完成。
2. 调用 homework 屏障。in_use 则本轮跳过，保持可再检查；超时/丢响应重发同 retirementId，不能推断 granted。
   granted 且 scope/id 完整匹配后，resource 持久 FENCED；崩溃重启从 CANDIDATE 重试同命令即可取回结果。
3. FENCED 事务中重新采样时钟并复查资产身份、policy、deadline、storageKey、无使用引用与历史证据；
   对同一 MediaAsset 实际 CAS active→deleted 并递增 __v，与 prepare/commit 的 fenceAssets 竞争；
   同事务设置资产 orphanRetirementId，将 retirement 设 DELETED，保存完整不可变系统删除证据。
   证据包括查询账本 `references.mediaId` 得到的全部相关历史 ABORTED operation 完整快照
   （scope、ID、hash、集合、版本、失败码/终态时间），不只当前released行的operationId。
   同媒体经历A、B两次ABORTED且引用行已被B覆盖时，A和B均入日志；任何PREPARED/COMMITTED或证据不齐均不删。
   查询需专用引用mediaId索引，不允许靠当前行或有限最近N条截断历史。不能只保存被删mediaId而丢失整组终态；
   新 prepare 此后按不存在拒绝，不能生成绑定。
4. 在重试事务外持久化独立的系统回收 journal：原子发布、文件和目录 fsync、重复相同内容幂等、冲突拒绝；
   使用独立命名空间/版本，不覆盖 T1 用户删除 journal。**日志持久成功后才删除正文**，删除后同步存储目录。
5. 正文删除可幂等重试；仅重新确认资产/retirement 身份和固定证据一致后，事务内按确切scope/operationId/状态
   清理该媒体对应且证据已确认的 released 行、清资产元数据、标 PURGED；匹配数不符整笔回滚。
   不按 mediaId 批量删除仍未知/新出现的引用，不清其他组员引用；ABORTED operation 账本保留。
   删除后的迟到 prepare/abort 可以新增从未 PREPARED 的 ABORTED 账本：仅 version=0、失败码 RESOURCE_NOT_FOUND 或
   MEDIA_OPERATION_ABORTED、terminalAt 不早于首次删除且整组没有任何同代次引用时，允许不改写原系统日志。
   原日志中全部账本仍必须逐条精确存在；不以这些迟到终态替代任何历史证据，也不接纳曾 PREPARED 的新增代次。
   保留系统 journal、retirement 和 homework guard，防旧请求/旧备份复活；不删除 T1 operation/receipt 或首次教学审计。

任何步骤失败保留已达到的阶段。resource 与 homework 断联时不删正文；丢应答只重放原 retirementId。
FENCED 后出现不应存在的引用/身份冲突，标 INCONSISTENT、停止并告警，不自动解封、不删相关内容；
这不是正常成功，必须阻断回收验收。回收失败不回滚为可新绑定，重试既有阶段而非制造新命令。

用户隐私删除与 GC 竞争时同资产写冲突：若用户墓碑已先提交，GC 标 SUPERSEDED 并交回既有隐私清理流程，
不覆盖首次删除人/时间，也不在用户 journal 未确认时自行删正文。若系统 DELETED 先提交，
公开 DELETE 根据系统证据实时鉴权并完成/重试系统 journal 后幂等应答，不假造 user_requested 审计。
访问/access 遇系统删除仍统一404；元数据清理后 DELETE 可由系统证据核验家庭/孩子权限，不泄露跨家庭存在性。
如用户墓碑与系统DELETED同时存在却不能解释为既定SUPERSEDED顺序，作为证据冲突拒绝，不任选一种覆盖。
两种删除都与资产状态变更同事务把 CompletionUploadGuard 置RETIRED；既有用户隐私删除服务需纳入此小范围适配，
不能只在新增GC里写guard。上传创建/重试写同guard，删除先提交则创建拒绝，创建先提交则删除读取实际资产再终结。

readiness 必须识别新增生命周期，而不是绕过检查：DELETED 允许系统标记+一致 retirement 证据及可追溯 ABORTED released 行；
PURGED 要求该媒体资产/引用已移除且系统 journal、retirement、homework retired 身份一致；
正常资产、用户删除仍走原校验。裸deleted无任何对应证据、PURGED留prepared/bound或缺失整组ABORTED证据均失败。
启用/恢复检查覆盖 completionReferenceReadiness、删除证据读取/分派及所有普通清理入口，不能只改新增job。

严格启动预检与显式恢复资格分开：`checkCompletionOperations` 不允许调用方绕过缺日志或待 SUPERSEDED 状态。
只有受控 `checkCompletionRecovery` 可在完整数据库冻结证据、精确guard、远端status和存储能力全部校验后，
接受 DELETED 的日志尚不存在，让原流程再次持久化；损坏/异正文日志、PURGED缺日志仍拒绝。
同样只允许有完整用户删除证据的 CANDIDATE/FENCED 进入原 SUPERSEDED 收敛；不重新授予媒体使用权。
该用户删除接续分支不依赖远端status可用，不调用retire；完整本地用户证据/guard校验仍必需。
真正系统 FENCED/DELETED/PURGED 保持远端精确retired要求；远端离线不能放行系统删除。
恢复资格返回 ready=false/recoverable=true，不是开放业务的许可，完成后必须再跑严格预检。

### 4.3 边界与失败收尾

只回收**已入库资产**。但现有上传对 MediaAsset.create 的所有异常直接删除正文，已确认存在结果未知误删风险，
必须作为 T2-G 前置修复而非等实施时再发现：在发出 metadata create 前固定 assetId 与 storageKey、规范元数据摘要，
把最小上传收敛记录持久化到受限日志（不含图片、原文件名或Token），再执行同一固定身份的数据库创建。
事务/网络结果未知时绝不补偿删正文；按固定assetId在主节点majority读取，身份/存储键/摘要一致则确认入库，
冲突则阻断告警；资产已deleted/retired不返回上传成功。不存在或读取失败不证明未提交，记录待收敛并保留正文。
直接删除正文的补偿仅限确定尚未发出metadata写入的失败；已发出写入后的错误不在catch里删正文。
重启对待收敛记录重查同一身份，不分配新ID；仅原规范元数据仍可完整重建时才允许重试创建，
必须先实时重新核验原上传scope且复用原固定身份/内容，不从摘要猜出字段或用默认值替代原元数据；
唯一键竞争重读，身份失效或证据不足则保持隔离待处置，不能冒充成功或按年龄删文件。
**删除终态优先：**重查必须同时裁决系统retirement、用户墓碑和UploadGuard；任一有效删除终态禁止重建/返回上传成功，
未知/冲突证据保持隔离。首次创建和重试创建均在同事务实际写UploadGuard并检查终态、插入固定assetId，
与上述两种删除形成真实写冲突；不能仅先查询一次墓碑。guard唯一首次upsert冲突须重读，不能绕开。
“未知上传→用户/系统删除→清理资产元数据→上传收敛器重启”必须仍为删除终态，不能因asset不存在重建active。
即使本次metadata事务确定回滚，也不能证明同一固定身份从未被其他尝试提交，因此不直接补偿删除。
已入库后走带guard/journal的删除或孤儿流程；无asset且无法确定结果的映射日志/文件保持隔离待处置，
不以一次“未查到”认定可回收，也不宣称该异常隔离等于全部文件生命周期自动闭环。
已有资产可进入正常孤儿流程；无可靠资产映射的文件仍不在自动GC范围，禁止全目录“未查到就删”的扫描。
上传日志写入失败在metadata创建前中止，不把无法追踪的状态报告为成功；正文生成到日志建立前的确定失败仍执行既有补偿，
进程强杀留下的无映射文件不宣称已自动回收。该内部收敛日志不新增公开上传会话/离线同步接口。
上传成功后 HTTP 响应丢失属于已入库候选，仍有服务器 policy/eligibleAt，可安全进入本协议，不依赖浏览器保存 mediaId。
回收正文与元数据后保留最小 ID/时间/状态证据，无图片、备注、原文件名、Token 或签名地址；受限 journal 不对外提供读取。

## 5. 历史数据、启用与回滚

不默认给历史 active 资产套用“创建已久所以可删”。新增只读 inventory 报告 eligible/missing_policy/in_use/inconsistent 计数，
不输出真实学习内容。旧无 policy 的候选需独立批准的登记步骤：先验证作用域/用途和引用证据，
按登记时刻再给完整24h宽限，CAS 写 policy；实际删除仍必须经过双服务屏障，登记不是删除授权。
本轮仅在合成历史夹具验证；真实数据库登记与删除需要另行授权、备份和恢复演练。

新增 CLI 子命令（验收状态见执行记录）：`completion-operations orphan-inventory` 只读，
`completion-operations orphan-cleanup --apply --limit 50` 显式写入；默认不运行定时任务。
复用现有服务/CLI，不增加队列或常驻扫描服务；低配置环境按有界批次串行执行并完整关闭连接/文件句柄。
启用需保持 completion 正式 enabled 且全部 writer 已实现 guard，分服务预检确认唯一索引/事务/存储/journal及内部鉴权。
只有部署版本号而无实际 guard 探针不能算前置通过。保留既有默认关闭三键；新增回收开关默认 false。
运行输出仅统计与稳定错误码；部分失败保留已处理事实并非零退出成功，下一次重试原命令。

回滚先停新回收/新完成写入，再保留新 guard、retirement、日志与待恢复数据；已持久 retired 不可回退到忽略它的旧 writer。
未发生任何新写入前可撤下新增路由；已写入后只能保留兼容读取/恢复与屏障或前向修复，不能删集合、解锁或恢复旧协议。
从旧备份恢复时，须先重放两类删除日志和 retired 屏障、验证正文不可读及旧命令不能重新绑定，再开放写入。
若备份仍为 PREPARED、日志证明原完整组后来ABORTED并回收，应按日志的完整原scope/hash/集合恢复ABORTED终态，
对该组匹配的prepared行整体释放而非只释放已删媒体；保留其他组员资产，禁止把过期本身当ABORTED证明。
备份中的本地pending保持原映射，经原actor恢复链读取该ABORTED结果并收敛FAILED；不能直接删owner或发布缺图版本。
包含A PREPARED备份、线上A→B两代ABORTED后回收的情况：重放A及B各自完整快照，按每条引用的原operationId匹配释放，
不能用B的证明替代A；其他组员若已属于不同operation，保留其现状并按scope校验，不能跨代次批量释放。
系统/用户删除日志恢复还须重建resource UploadGuard RETIRED，避免旧上传收敛记录在恢复后重新创建资产。
实施核实：当前系统 restore helper 已覆盖系统 journal；旧用户 journal 缺少完整终态组/上传摘要，
上述用户路径仍是未实现验收要求，不能从旧格式猜造证据。
[版本化用户日志补充设计](2026-10-23-family-self-directed-learning-t2-user-deletion-recovery-design.md)先评审、再获用户批准后实施，
详见执行记录 §10.4；本文件原有批准不等于该新增设计已批准。
系统 helper 新建缺失 UploadGuard 时，createdAt/updatedAt 表示本次已校验的重建时刻，不冒充原上传或删除发生时间；
已有 guard 的时间不覆盖，retirement/journal 内首次创建、删除审计精确保留。
恢复验收须同时证明该本地收敛与整组终态一致、readiness通过；原actor已无权限时保留阻塞并要求受控处理，不假定恢复成功。
遇备份COMMITTED与ABORTED日志冲突、scope/hash不符或缺日志，停止恢复并禁止开放写入，不覆盖事实。
本轮做合成恢复测试，不据此关闭 T8 真机/备份/真实部署责任。

## 6. 前置批次、测试与评审

在原 T2-2 前增加 T2-R（公开发现/恢复），T2-G（孤儿屏障/回收）；设计已批准，T2-R 获准按测试先行实施。
T2-R 独立评审/用户批次批准后再 T2-G；T2-G 通过后原 T2-2/3 才依赖新增能力，不在页面批次临时发明后端协议。
T2-1 两项测试修复与门禁 P2 已获用户验收关闭；原六批编号不改，新增前置批次有独立证据和审批。
T2-G 内部按三个可审查增量实施：上传固定身份/删除终态guard与homework使用屏障；resource回收/日志/分派；
历史预检/CLI/恢复组合。每个增量先测试、自查和独立代码评审，不把整个跨服务改动塞进一次无法复核的提交；
不额外制造用户审批点，除非设计变更或用户要求，最后统一提交 T2-G 批次验收。

| 用例 | 层级 | 必须证明的事实 |
| --- | --- | --- |
| T2-R-001 | 服务/HTTP/UI | 提交已占位后退出清本地正文，跨日同actor新浏览器无taskId通过分页待恢复入口发现+POST完成；无需原body，沿用原映射/hash/版本 |
| T2-R-002 | HTTP/CT | 发现GET无DB写/远程调用；不同家庭/孩子/离家家长拒绝；同家庭不同actor不能拿原命令ID或恢复；旧token拒绝 |
| T2-R-003 | 事务/HTTP | PREPUBLISH/PUBLISHED_CLEANUP、租约过期/隐私删除、公开及远程丢响应，均按T1协议收敛 |
| T2-R-004 | HTTP/CT | 同UUID不同actor、已终态A与新活动B、404/畸形响应、映射损坏均不误恢复B或开放新写 |
| T2-R-005 | UI | 新登录后旧401迟到、不自动POST、成功历史投影后重新GET；confirm未知仍按所见版本恢复，不误走complete恢复 |
| T2-G-001 | 服务/HTTP | 24h前/等于/之后、错用途/未登记旧资产、已绑定/历史COMMITTED/租约过期prepared皆按规则保护；已入库丢上传应答可回收 |
| T2-G-002 | 两服务事务 | 暂停在homework占位后远程prepare前，GC in_use且正文不删；反向先retired，新claim整笔拒绝无占位 |
| T2-G-003 | 两服务事务 | guard首次upsert并发、同asset不同任务/actor、末次CAS冲突；逐项删除guard实际写/意图检查时反例应失败 |
| T2-G-004 | 服务/HTTP | retired应答丢失、CANDIDATE→FENCED落库未知、DELETED事务回滚/提交未知、正文已删但PURGED未知，重启仍同ID收敛 |
| T2-G-005 | 文件/事务 | journal文件及发布目录fsync失败/同步等待、正文remove/目录sync失败、元数据失败；系统journal失败后再跑旧cleanup仍不删正文；未持久日志绝不删正文 |
| T2-G-006 | HTTP | 隐私删除抢先/系统回收抢先、首次审计/系统actor区分、元数据清理后DELETE重放与越权拒绝；无伪造精确绑定凭证 |
| T2-G-007 | 服务/恢复 | 旧备份A PREPARED+本地pending，线上A→B两代ABORTED再GC；重放完整A/B证据，精确释放、本地恢复FAILED不发布、readiness通过；恢复UploadGuard RETIRED；旧URL/晚到prepare拒绝；冲突日志拒绝；版本/账本/首次确认不变 |
| T2-G-008 | 运维/HTTP | 无凭据/共享媒体凭据/星星或Gateway凭据/浏览器拒绝内部屏障，仅专用凭据可用；inventory零写；默认关闭、预检不完整拒绝apply；部分失败非假成功 |
| T2-G-009 | 服务 | released以完整ABORTED证据而非bindingOperationId为空判定；DELETED/PURGED各阶段readiness合法/反例；精确released清理；历史无guard的pending/归档保护 |
| T2-G-010 | 服务/文件 | metadata已提交但create抛未知错误，正文保留；固定assetId重查无重复；不存在/读取失败不误删；日志失败不启动metadata；用户/系统删除并清元数据后重试不复活，UploadGuard首次竞争/删与建事务冲突及迟到响应受保护；scope撤销隔离 |

完成标准：上述反例与实际持久事实通过，自查、独立代码评审与合成 QA 完成，再提交批次批准。
本文件通过设计复审不代表这些用例已实现或执行；原 D01 只有安全回收实现与验收后才能关闭。

## 7. 设计评审记录

自查：公开恢复保留actor边界与原意图；跨服务GC用持久本地写屏障解决“先检查后新claim”的竞态；
resource再次事务检查/资产写与prepare竞争；journal确认前无物理删除；历史与真实部署不自动迁移。
独立评审：已完成首轮、修订及最终定向复核，结论见 §7.1。用户设计批准：APPROVED（2026-10-23）。
参数24h/50和新增API/模型已随本设计获批准；实施、缺陷及验收状态以执行记录 §10 为准，不据此默认启用。

### 7.1 首轮独立评审与修订

独立评审者 Boyle 只读核对设计及实现，确认原actor恢复和双服务guard互斥方向成立，提出以下设计缺口。
这些问题本轮仅修订设计与用例，不能记为实现修复；原T1代码/运行配置未修改。

| 问题 | 严重度 | 根因及修订 | 证据义务/状态 |
| --- | --- | --- | --- |
| E01 | P1 | 旧cleanup可能越过系统日志；新增orphanRetirementId与清理分派排除，系统journal为唯一物理删除前置 | 设计复核通过，G005待实现验证 |
| E02 | P1 | ABORTED released投影并非空代次；改为全部历史终态证明、精确行清理、readiness及A/B旧备份整组收敛 | 设计复核通过，G007/G009待实现验证 |
| E03 | P1 | 共享服务token不区分调用者；改为resource→homework专用限定用途凭据 | 设计复核通过，G008待实现验证 |
| E04 | P1 | 上传create异常混同确定失败与未知；固定身份、未知不删、UploadGuard不可逆终态防复活 | 设计复核通过，G010待实现验证 |
| E05 | P2 | 退出跨日新设备没有taskId入口；新增全日期分页待恢复列表 | 设计复核通过，R001/R002待实现验证 |

自查补充：恢复应答无本地body时不假称集合比对；上传收敛不得猜原元数据或把已retired资产报告为上传成功；
原设计同步去除“须回到原标签页”和“接受孤儿限制即可交付”的过时条款。
最终独立复核明确 E01–E05 均为“设计复核通过，待实现验证”，未发现这些修订范围内剩余设计阻断。
上传补偿仅限metadata写入前；未知结果后的正文保留与删除终态优先、全部历史ABORTED证据均已复核。
此结论不关闭原D01或实际上传缺陷，不表示测试/QA通过，不授权编码。
