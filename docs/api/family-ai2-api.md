# AI-2 学习包与人工订正 API 候选

**Document status:** APPROVED (2026-11-03)
**Profile:** AI2-MIN-1 (`ai2-min-v1`)
**Implementation:** AI2-2/3/4及AI2-5子批ACCEPTED；2026-11-04用户批准AI2-5汇总及AI-2总门禁CLOSED / ENGINEERING_SYNTHETIC_ONLY，见[关闭记录](../development/evidence/ai2-5-20261103/closure-readiness.md)。API契约未改；默认关闭、DEVICE_PENDING、其他OPEN门禁及后置范围保留，不代表真实启用或部署通过。
配套：[设计](../superpowers/specs/2026-11-03-family-ai2-minimal-design.md)、[测试](../development/family-ai2-test-plan.md)。
沿用[AI1 公共规则](family-ai1-api.md#1-公共规则与数据类型)的签名身份、规范摘要、响应及 no-store，
但不复用其家长详情 DTO，不修改 AI1 孩子访问拒绝规则。以下为已批准的完整最小 profile。

## 1. 通用规则

- 仅有效 parent/student；服务端推导 family，孩子只允许本人，家长必须是当前 owner/member 且孩子仍在本家庭。
  401 无效身份；403 当前角色/孩子权限被拒；404 不存在、其他家庭资源或孩子不可见包；依赖异常503，不伪装404。
- 每次读、写、重放、媒体授权均先实时检查身份及资源范围，再查幂等；不能凭旧 JWT 的家庭 claim 独自放行家长。
- 写入必填 `schemaVersion:"ai2-min-v1"`、`operationId` 小写 UUIDv4；无另一 Idempotency-Key 来源。
  命令唯一 `(familyId,actorId,endpointOperation,operationId)`，JCS+SHA256 覆盖方法/规范路径/全部规范字段。
  文本仅 CRLF→LF，按 Unicode code point 计长，不静默 trim/折叠数学文字；预览/提交前显示规范结果。
- id 为24位小写hex，hash为64位小写hex，版本为>=1安全整数；未知键、数组洞、错误 null/类型拒绝400。
  JSON 原始解压后 UTF-8 最大32 KiB，非法编码400、超限413；Gateway转发不先清洗掉未知字段或更改数学文本。
  Multipart 沿既有媒体入口，不通过本 JSON 路由上传正文。时间由服务端记录为 UTC ISO8601。
- 成功 `{success:true,data:{...}}`；失败 `{success:false,error:{code,message,details:[]}}`，不包含他人数据或私有正文。
  `success:true`表示取得命令确认/查询结果，不保证业务提交成功；提交/恢复必须检查`command.phase`，`pending:false`也不等于SUCCEEDED。
  私有响应 no-store，文本纯文字呈现。列表 page>=1，pageSize=20且<=100；稳定按 createdAt、id 排序。
- 同 key/hash 重放原结果引用，不重复发布/提交/审核；同 key异正文409。返回记录时仍按当前可见性裁剪。
  已提交的旧命令可返回其历史 Attempt，不把当前新版误作原命令结果；当前 Package 状态单独返回。

## 2. 路由

全部 `/api/ai2` 由 Gateway 签名代理到 homework；不增加 DeepTutor 请求。

| 方法/路径（相对 `/api/ai2`） | 权限 / endpointOperation | 成功及用途 |
| --- | --- | --- |
| GET `/publication-preview?cycleId=...` | parent | 200，实时验证后的精确孩子内容预览，无写 |
| POST `/learning-packages` | parent / ai2.publish | 201，本地事务发布，mode off拒绝 |
| GET `/learning-packages?childId=...&page=1&pageSize=20` | parent/student | 200；parent必填childId；student可省，提供必须等于本人；孩子只列published |
| GET `/learning-packages/:packageId` | 当前授权parent/包所属student | 200，返回专用详情，不返回 AI1 原始 DTO |
| POST `/learning-packages/:packageId/withdraw` | parent / ai2.withdraw | 200，撤回，off仍可用 |
| POST `/learning-packages/:packageId/attempts` | 本人student / ai2.submit | 201已提交、202持久处理中，或200已确认FAILED，原actor不可伪造 |
| POST `/learning-packages/:packageId/attempts/:attemptId/review` | parent / ai2.review | 200，按所见版本审核 |
| GET `/commands?childId=...&scope=mine&page=1&pageSize=20` | 原actor | 200，含终态及未终态摘要，解决成功丢响应及重登发现；无正文 |
| GET `/commands/:commandId` | 原actor | 200，原状态/结果引用与允许的原提交内容；不写 |
| POST `/commands/:commandId/recover` | 原actor | 200终态或202处理中；请求仅schemaVersion/operationId，持久原提交恢复 |

recover.operationId 是原 submit 的 UUID，不新增恢复幂等空间、不接受 payload/actor/remote ID 覆写。
仅 submit 的持久多阶段命令需要 recover；其他命令成功后由 GET/同 key 重放读取事务结果，不再执行副作用。
没有 commandId 时先查原 actor 命令列表；GET 未找到不是远端失败证明，不自动新 UUID/POST 或丢掉未知提示。
共管可在家长包详情看 pending 状态，但不得读取或恢复另一个 actor 的私有命令正文。
撤回后原孩子仍可查询自己未完成命令的最小状态并 recover 仅用于 abort/清理；不能借此重新读取包/正文/媒体。
原actor已经撤权或身份失效仍拒绝；无自动接管，保留服务端证据及锁，交后续明确运维决定，不扩大本轮恢复权限。

## 3. 发布与详情 DTO

预览返回 `{preview:{cycleId,expectedCycleStateVersion,artifactId,artifactVersion,artifactContentHash,
expectedArtifactReviewVersion,childSnapshot,childSnapshotHash}}`。
childSnapshot 严格为 `{questionText,explanationText,chapter:{provenance,subject,grade,term,textbookLabel,chapterLabel},source:{type,id}}`。
内容来自服务端保存的 AI1 input.questionText、已批准制品正文、原章节；不接受客户端另写教学正文。
questionText 1–4000、explanationText 1–12000；沿用 AI1 原长度、纯文字限制，不回传原答题/parentContext/生成请求。
preview hash 为这一完整 childSnapshot 的 JCS摘要；family/child、制品归属同时由服务端核对，不以hash代替权限。

POST 发布示例（字段全部必填；常量为合成示例，不是运行结果）：

```json
{
  "schemaVersion": "ai2-min-v1",
  "operationId": "11111111-1111-4111-8111-111111111111",
  "cycleId": "aaaaaaaaaaaaaaaaaaaaaaaa",
  "expectedCycleStateVersion": 4,
  "artifactId": "bbbbbbbbbbbbbbbbbbbbbbbb",
  "artifactVersion": 2,
  "artifactContentHash": "1111111111111111111111111111111111111111111111111111111111111111",
  "expectedArtifactReviewVersion": 2,
  "childSnapshotHash": "2222222222222222222222222222222222222222222222222222222222222222",
  "childContentConfirmed": true
}
```

发布事务与 AI1 本地关闭竞争：重新验证 Cycle/status/stateVersion/制品三元组，必须通过实际条件更新取得
同一 Cycle 写冲突保护（可递增其 stateVersion，不改业务状态），不能只做 snapshot read 后向另一个集合插入。
唯一活动发布索引和命令结果与 Package 同事务提交。来源跨服务最后读与事务边界按设计§3，不宣称跨库锁。
并发变化409要求重新预览，不自动批准/发布新制品。撤回后新发布需新显式命令、新包，旧包/Attempt保留。

SUCCEEDED写响应包含 `{command:{id,operationId,phase,resultReference},package:<role projection>}`；
submit 成功另有 `attempt:<role projection>`，202仅command及pending摘要，不返回伪造已提交 Attempt。
AI2-2实施澄清：成功写响应/终态重放为持久确认，不强依赖媒体或来源服务。package返回下述公共字段中的
静态快照/状态/版本/当前Attempt指针/pending，不含attempts及sourceAvailability；review成功也返回原Attempt摘要
（id/attemptVersion/note/submittedAt/review，父母另有attemptPayloadHash和审计），不包含media可用性。
需要媒体详情时单独GET；详情失败不得将已成功命令改成失败或伪造available/deleted。
本澄清不改变请求字段、写入语义或权限；客户端不能将写确认摘要当作已查看新作品后自动审核。
包公共详情白名单：`id,source,childSnapshot,childSnapshotHash,artifact{id,version,contentHash},visibility,
learningState,stateVersion,currentAttemptId,currentAttemptVersion,publishedAt,attempts,pending,sourceAvailability`。
sourceAvailability=`available|missing|unavailable`；不由其改变原快照。
Attempt 孩子投影：`id,attemptVersion,note,submittedAt,media[{mediaId,mimeType,sizeBytes,status}],review`；
status=`available|deleted`，review 为 null 或 `{decision,comment,reviewedAt}`。父母可额外看真实提交/审核actor及绑定审计，
孩子不返回其他候选/parentContext/answerText/Job/费用/内部映射/存储位置。媒体访问必须另经正式鉴权入口。
attempts 按版本返回分页摘要，不内嵌无限历史正文；新增 GET `/learning-packages/:packageId/attempts?page=...`
和 GET `/learning-packages/:packageId/attempts/:attemptId`，权限及投影与上述一致，均只读。
详情 attempts 仅当前 Attempt（或空），全历史走分页；待提交 RESERVED 内容只在原actor命令详情可见，不发布给其他页面。

withdraw 请求：通用两字段 + `expectedPackageVersion` + `reason`（1–500非全空白）。
成功仅改变 visibility/stateVersion/withdrawal、释放活动发布唯一位；学习状态/审核/正文不改写。
孩子任何详情、历史 Attempt、直接媒体地址均不能借撤回包取得权限；同图另有合法可见包绑定时，
仍可基于该独立绑定读取，不能声称撤回一个包等同全局删除媒体。家长仍可查看历史。

## 4. 订正与审核

submit 请求：通用两字段 + `expectedPackageVersion` + `note`（0–1000字符字符串）+
`mediaIds`（1–10个唯一id，有序；只接受 ai2_correction、本人/同孩子合法图片）。无客户端 attemptVersion/actor。
仅 published 且 learningState=open/revise、无 activeCommand 时接受；submitted/approved/withdrawn 拒绝409。
占位事务保存原 expectedVersion、取得锁后的 reservedPackageVersion、Attempt id/下一版本及随机remote ID；
最终 CAS 用 reservedPackageVersion 和 owner/phase/activeCommand 校验，不能与占位前版本混淆。
失去owner不能补偿；只有当前owner先事务CAS进入不可再发布的RESOLVING并确认提交，才能abort/unbind。
该转换与SUCCEEDED竞争同一命令；RESOLVING后不可回到发布阶段，提交未知先读回，不按一次“尚无Attempt”查询解绑。
媒体操作顺序与终态/租约/删除证明按设计§5–§6；不因HTTP超时、401或退出而自动删图或解锁。
201表示Attempt已持久发布；202表示已持久接受但未确认终态（包括RESOLVING），不当作完成。收到明确媒体失败也必须先收尾原映射。
AI2-3响应契约补充：首次submit或同key重放若已持久FAILED且完成必要收尾，返回200、`command.phase=FAILED`、
稳定`failureCode`、`resultReference:null`及`pending:false`，不含package/attempt/原payload；不是“订正提交成功”。
recover两类终态SUCCEEDED/FAILED均200，业务结果由phase区分。原有鉴权、校验、幂等/版本冲突及依赖错误仍为4xx/5xx。

review 请求：通用两字段 + `expectedPackageVersion` + `expectedAttemptVersion` + `attemptPayloadHash` +
`decision=approve|revise` + `comment`（approve允许空，revise为1–1000非全空白）。
父母详情必须返回 `attemptPayloadHash`（规范不可变 note/mediaIds/bindings/提交者/版本的摘要），不能自行重新取最新版确认。
同事务匹配当前 Attempt、review=null、Package submitted/visibility/version，无 activeCommand；
保存 review、Package状态/版本及命令结果。旧hash/version或共管竞争409，前端重新展示，不自动再POST。
approve前检查图片可读；deleted/不完整409 `AI2_MEDIA_UNAVAILABLE`；依赖异常503保持未审核。
revise 不要求旧图片仍存在，必须反馈，下一次提交另建Attempt。审核不调用任何发星/掌握/错题修改接口。

命令阶段：`RESERVED|MEDIA_PREPARED|MEDIA_COMMITTED|RESOLVING|SUCCEEDED|FAILED`。
终态结果引用 `{packageId,attemptId}` 中 attemptId 可null（非提交命令），SUCCEEDED不可退回非终态；
失败附稳定 failureCode，阶段和锁由服务端决定。提交回滚/重启/丢响应必须保留相同 remoteOperationId。
mode off只允许原命令查询/abort/精确解绑或已COMMITTED结果收敛，不得prepare/commit新远端写入。

## 5. 媒体与内部接口

复用 `/api/media` 上传、`/:mediaId/access` 和DELETE接口，新purpose/type/field严格匹配，参数见设计§6。
新purpose的正文走 GET `/api/media/:mediaId/authenticated-content`，不是旧匿名正文路径；必须携带
当前Bearer会话及该路径的短期capability。Gateway验证JWT，resource验证签名身份并实时核验孩子tokenVersion，
家长成员和孩子归属也在当前请求核验；两层中间件均须在新正文handler前，直接访问resource不能省略可信身份。
`/access` 对ai2_correction返回新路径及 `access.requiresAuthorization=true`；前端认证获取blob后展示。
Capability只约束方法/路径/media/期限，不能代替读取者身份；匿名旧`/content`对新purpose一律404，
即使持有有效旧签名也拒绝，不修改旧用途的匿名capability契约。失效身份401/403，撤回无可见绑定404，
正文返回图片bytes及no-store，无身份信息/底层路径。既有访问DTO解析需显式支持新布尔字段及路径，不静默忽略。
已有旧任务/错题/PDF请求不改语义。新图片最多10 MiB且验证真实字节；误传同家庭别孩子或非该用途仍拒绝。
AI2的远端 prepare/commit/status/abort/unbind 使用现有受保护 completion operation 入口，增加版本化类型分支，
完整参考集和精确删除凭证必须带 `ai2_attempt/AttemptId/correctionMediaIds/bindingOperationId`；
不在客户端公开这些服务凭据，不容许任意resourceType。旧 growth_task 摘要与终态重放必须保持兼容。

拟增 POST `/api/internal/ai2/media-access-check`（语义只读），仅resource到homework，使用现有
MEDIA_REFERENCE_SERVICE_TOKEN的受限路径校验，不接受LMS用户JWT代替，不经Gateway公开转发。
请求闭合 `{familyId,childId,actorId,role,mediaId,bindings:[{attemptId,bindingOperationId}]}`，
bindings为resource服务数据库中该媒体的精确已绑定/历史引用，不信任浏览器提供；最多100条，超限拒绝且不截断放行。
actorId/role取自resource已验证的当前请求身份；孩子tokenVersion在resource当前请求验证后才构造该内部请求，
不从capability、上传者或客户端JSON猜测。homework重新验证真实actor、每项Attempt归属及媒体绑定，允许孩子至少一个合法published已提交引用；
若Attempt尚未发布，只在同范围原孩子submit命令、原payload/requestHash、完整持久映射/摘要、精确代次和所属Package均可核实时，
将该项视为不授权的正常未发布/补偿历史；不能让它否决另一合法published引用。未知引用、损坏映射或已提交Attempt归属不符仍拒绝。
返回200 `{success:true,data:{allowed:boolean}}`；不返回正文/其他包ID，依赖异常503。
resource对从未绑定的本人上传、父母家庭范围按设计直接校验；有历史绑定的孩子不能走上传预览例外。
内容GET再校验当前可见性及墓碑，不以旧capability有效代替实时判断；新用途删除也走真实权限和精确证据链。
超过内部引用检查上限的对象保持拒绝，作为显式容量限制，不自动删除旧 Attempt 或引入分页截断授权。
正常隐私清理后Asset可不存在；deleted描述符仅取自同范围AI2墓碑持久保存的MIME/字节数及精确Receipt，
不伪造默认MIME/大小，不放宽当前身份。旧用途证据格式不变。独立工厂中的真实mediaService.inspect不等于已提供远程metadata接口。

### 5.1 AI2-5 正式metadata inspect接线契约

本节为AI2-5 IMPLEMENTING范围，补齐上文工厂inspect的跨进程入口，不是已通过的正式HTTP证据。
homework向resource调用`POST /api/internal/media/ai2/inspect`（语义只读），
沿用`MEDIA_REFERENCE_SERVICE_TOKEN`及现有受保护内部路径校验；不接受用户JWT替代服务凭据，不通过Gateway公开转发。

请求闭合`{familyId,childId,identity,mediaIds,bindings}`：identity取自homework已验证的当前身份，
familyId/childId与当前服务端授权范围一致；mediaIds为本次所需媒体，bindings来自服务端持久化的精确引用，
不能直接信任浏览器提交的身份或绑定。resource仍实时验证身份、家庭/孩子、媒体用途及精确绑定，服务凭据不授予越权读取。
沿用既定AI2 media inspect的合法图片与deleted证据规则，不创设另一套授权/状态语义。

成功200响应严格为`{success:true,data:{items:[{mediaId,mimeType,sizeBytes,status}]}}`。
items仅返回授权所需描述符，禁止底层存储路径、下载URL/capability、正文bytes及其他家庭数据；
deleted项仍要求既定精确墓碑/Receipt证据，不补造MIME或大小。依赖异常拒绝，不返回空成功或降级到旧metadata协议。
公共认证正文入口不变，metadata不返回图片内容，也不能替代实际认证读取和图片load后的审核资格。

启用及安全关闭后的历史读写均须`AI2_STORE_CONTINUOUS=true`和`COMPLETION_PROTOCOL_MODE=enabled`；
`AI2_MODE`默认off、`AI2_STORE_CONTINUOUS`默认false，off不放行新prepare/commit。
连续性false/不明或maintenance保持隔离；默认关闭不回退旧协议。事务/索引及正式connection启动检查见设计§7.1。

## 6. 稳定错误和兼容

| 状态 | code | 含义/客户端动作 |
| --- | --- | --- |
| 400/413 | VALIDATION_ERROR / AI2_INPUT_TOO_LARGE | 闭合校验/正文大小；未建立命令不得写入 |
| 401/403/404 | 沿用身份错误 / CHILD_ACCESS_DENIED / RESOURCE_NOT_FOUND | 当前身份拒绝先清私有视图；不展示他人/撤回包 |
| 409 | AI2_PUBLICATION_STALE / AI2_PACKAGE_ALREADY_PUBLISHED | 预览已过期/活动唯一位冲突，重读不自动发布 |
| 409 | AI2_STATE_CONFLICT / AI2_REVIEW_CONFLICT | 错状态/旧版本/审核竞争，保留原命令结果与首次审计 |
| 409 | IDEMPOTENCY_CONFLICT / AI2_COMMAND_PENDING | 同key异正文/本包已有未决提交，不换UUID重发 |
| 409 | AI2_MEDIA_UNAVAILABLE / AI2_PACKAGE_WITHDRAWN | 图片已删/不完整或原提交被撤回中止；收尾后才解锁 |
| 503 | AI2_DISABLED / SOURCE_SERVICE_UNAVAILABLE / MEDIA_SERVICE_UNAVAILABLE | 关闭或依赖失败；未知请求查询原命令，不假定未写 |

媒体既有校验/凭证不一致错误保留，不把错误映射为成功；拒绝细节不含其他家庭信息。
off也拒绝新ai2_correction上传，不影响旧用途；不删除历史，GET永远不调用模型/改费用/修改教学状态。
新profile未知请求由旧服务拒绝，不静默降级。
新增读取/媒体规则先装配再开启写入；出现新数据后保留兼容服务，不能直接旧版本回滚。
缺少恢复证据维持维护隔离，高级恢复/新回收后置；本API不提供解除隔离或真实发送授权。
