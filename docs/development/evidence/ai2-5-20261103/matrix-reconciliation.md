# AI2-5 测试矩阵归并（31项）

初始归并日期：2026-11-03；当前摘要更新：2026-11-04。状态：**MATRIX_CORE_COVERED_SCOPED；AI2-5 CLOSED；AI-2 CLOSED / ENGINEERING_SYNTHETIC_ONLY**。

最新覆盖见[§12](#12-撤回历史与隐私竞争补验)：**31 = 31 CORE_PASS_SCOPED + 0 PARTIAL**；PUB-02/VIEW-01及WITHDRAW-01/02、MEDIA-04已获用户限定合成批次验收。
2026-11-04用户单独批准限定合成总门禁关闭，见[关闭记录与保留边界](closure-readiness.md)。旧§1–12计数、OPEN及待审表述保留阶段身份，不覆盖本摘要。

> §1–6为桥接补验前快照，§7–12记录逐批补齐；旧失败、计数和当时缺口不回写。31行是分层证据累计覆盖，不是本轮独立执行31个用例。

依据：[测试方案 §2](../../family-ai2-test-plan.md#2-永久用例矩阵)。本文件只归并现有源码断言与已落盘执行结果，不修改业务、测试、其他文档或旧证据。未运行 Mongo、浏览器、Jest、模型、Git 或部署。用户已授权主线程随后补最小双来源正式连接；这里不预写其通过结果。

## 1. 口径与当前结论

逐行数量：**31 = 14 CORE_PASS_SCOPED + 15 PARTIAL + 2 PENDING_CONNECTION**。不采用历史段落“30项”计数，也不按测试总数计算需求覆盖率。

- **CORE_PASS_SCOPED**：该行核心条件已有实际断言及通过档案；明确验证层与替身边界，不代表每个条件在U/H/C/B各层都执行，更不是总门禁关闭。
- **PARTIAL**：已找到相关永久测试且对应子集通过，但至少一个明确需求子条件或关键组合未获直接证实。缺测试不是已确认产品漏洞，也不撤销已批准子批。
- **PENDING_CONNECTION**：服务层或批准后AI2链已有证据，但正式AI1人工修订/批准→Tutor入口→AI2发布连接尚缺，不能把分离测试拼接成端到端通过。
- U=单元/契约；H-db=真实Mongo事务/持久服务；H-http=真实回环HTTP；“正式H-http”另外要求实际应用装配；C=组件；B=生产构建正式浏览器。H中仍可能有明确client/sourceReader/故障替身。
- 下表测试名称为源码中的完整名称或参数化标题模板。文件别名均指向永久源码，证据别名均指向实际JSON。参数化值及实际断言已核对，不能仅凭标题判满。

**已核对范围**：AGENTS.md、§2所有31行；下方索引列出的AI2后端/前端/3个正式浏览器spec及直接相关共享协议/旧AI1拒绝断言；AI2-2/3/4/5对应JSON中的suite/assertion结果和正式Playwright spec结果。没有继续遍历无关全仓历史日志，也没有重新执行历史全量。

归并过程中只读重算最新浏览器candidate SHA-256为 `54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a`，其92个文件与当时工作树均匹配。AI2-4 draft-refresh候选为 `b1a52ef373fe8df1b3a7299e62be7c38f88786720cc674c549058805e63b9dc3`；正式接线候选为 `b6b22e3c6992bc12da0fdcbcb6742cd4c416c7def64a0ef9bf0a03ea310920cf`。后续桥接改动须另行验证，不把旧候选结果自动转给新源码。

## 2. 现有执行档案

所有执行数字均为**既有落盘结果的只读核对**，不是本次重跑；结果重叠，禁止相加成独立覆盖数量。`release-gate-artifacts/...` 为相对原项目根目录的归档标识，仅对应原项目本机的忽略目录，不是相对本文的源码链接，不代表已提交、上传或可公开访问。证据别名链接仅跳转至本节对应条目。

| 证据 | 实际档案 | 结果 | 层与边界 |
| --- | --- | --- | --- |
| <a id="e2"></a>E2 | `release-gate-artifacts/ai2-2-20261103/targeted.json` | 3套33通过，0失败/跳过 | U + H-db/独立签名HTTP；sourceReader/mediaReader/outcome存在明确替身。不是正式Gateway登录。 |
| <a id="e3p"></a>E3P | `release-gate-artifacts/ai2-3-p2-review-20261103/normal.json` | 独立4套63通过，0失败/跳过 | 真实副本集提交/恢复与独立HTTP；Q使用媒体client及权限helper替身，SH是真实resource operation HTTP。 |
| <a id="e3r"></a>E3R | `release-gate-artifacts/ai2-3-20261103/ai2-3-access-final.json` | 2套49通过，0失败/跳过 | 真实图片/multipart/fs/Mongo/内部HTTP及client单元；合成持久包/Attempt与可控依赖故障。 |
| <a id="e4"></a>E4 | `release-gate-artifacts/ai2-4-draft-refresh-20261103/validation/targeted.json` | 6套214通过，0失败/跳过 | U/C；API、媒体网络为替身。旧AI2-4 API替身浏览器不记作正式B。 |
| <a id="e5a"></a>E5A | `release-gate-artifacts/ai2-5-assembly-final-20261103/validation/family-full-final.json` | 185套5554通过，0失败/跳过 | 历史正式接线家庭回归，混合U/H/startup；逐测试看替身边界，不能一律当真实HTTP。 |
| <a id="e5h"></a>E5H | `release-gate-artifacts/ai2-5-assembly-final-20261103/review/approval-independent-20261103-2154/homework.json` | 独立4套86通过，0失败/跳过 | 含正式三服务HTTP4例、homework装配/runtime/client；FH以直接预置approved AI1起步。 |
| <a id="e5r"></a>E5R | `release-gate-artifacts/ai2-5-assembly-final-20261103/review/approval-independent-20261103-2154/resource.json` | 独立3套68通过，0失败/跳过 | resource正式装配/异步连续性/metadata路由；部分callback与延迟依赖为明确替身。 |
| <a id="e5g"></a>E5G | `release-gate-artifacts/ai2-5-assembly-final-20261103/review/approval-independent-20261103-2154/gateway.json` | 独立2套87通过，0失败/跳过 | Gateway AI1+AI2真实代理HTTP，AI2使用实际parser/router和stub service，不能当完整业务验收。 |
| <a id="e5f"></a>E5F | `release-gate-artifacts/ai2-5-browser-final-20261103/validation/frontend-full.json` | 64套1003通过，0失败/跳过 | 既定前端非legacy全量U/C，含P31、D4、M52、MA43、C71；不是最终浏览器阶段重跑。 |
| <a id="e5c"></a>E5C | `release-gate-artifacts/ai2-5-browser-final-20261103/review/user-approved-20261103/components.json` | 独立2套35通过，0失败/跳过 | P31+D4，实际React组件，API端口替身；独立复审结果。 |
| <a id="bc"></a>BC | `release-gate-artifacts/ai2-5-browser-final-20261103/validation/chromium-verified.json` | Chromium 8通过，0skip/retry/flaky；99.541秒 | 生产构建+真实7服务/Mongo/fs/登录PIN；AI1预置approved，query-only拒绝sentinel零调用。 |
| <a id="bw"></a>BW | `release-gate-artifacts/ai2-5-browser-final-20261103/review/user-approved-20261103/webkit.json` | 独立WebKit 8通过，0skip/retry/flaky；110.124秒 | 同3个正式spec与7服务；并非真机iPad，亦非AI1修订批准连接。 |

## 3. 逐行归并

“已证实”只描述测试实际做过的事情。原矩阵要求中的未证实部分单独列出，不用实现代码看起来正确、命名或通过总数补空白。

| ID / 要求 | 永久测试（文件 / 完整名称） | 实际结果及层 | 已证实子集 | 状态 / 未证实子条件 |
| --- | --- | --- | --- | --- |
| AI2-PUB-01<br>task/mistake 原候选修订批准后精确预览发布；同孩子、id/version/hash、一包一命令、无自动发布 | [S]：`PUB-01/VIEW-01 real AI1 revision and approval -> %s publication, safe snapshot and no AI side effects`<br>[P]：`published preview shows exact child text and confirms original snapshot only`<br>[BP]：`AI2 formal page publish, revise, resubmit, approve, readback, privacy deletion and withdrawal` | [E2] / [E5A]：H-db；[E4] / [E5F]：C；[BC] / [BW]：B | 已有 task/mistake 参数化真实 AI1 service.create/generate/claim/applyOutcome/revise/review→AI2 service 发布、artifact.version=2、一包一命令、Account 不变；sourceReader/outcome 为明确替身。组件断言完整发布字段。 | **PENDING_CONNECTION**：正式 HTTP/浏览器仍预置 approved Cycle/Artifact，不能视为真实 AI1 人工修订/批准→Tutor Link→发布。双来源正式连接待主线程补；审批后尚无 Package 的直接断言也待补。 |
| AI2-PUB-02<br>candidate/rejected/closed/unknown、假 hash、未确认可见内容；拒绝且无副作用，孩子旧 AI1 入口拒绝 | [S]：`PUB-02 cycle %s is never publishable`<br>[K]：`closed publish contract and exact confirmation`<br>[A1H]：`real HTTP lost response, both factories rebuilt, discovery and explicit original recovery settle exactly once` | [E2] / [E5A]：U、H-db/H-http | candidate/rejected/closed/generating 状态预览拒绝且 Package=0；confirmation=false、伪 actor/版本形状由闭合校验拒绝。旧 AI1 HTTP 用例实际断言 child GET artifact=403。 | **PARTIAL**：未找到合法格式但错误的 artifactContentHash/childSnapshotHash 对 AI2 publish 的直接反例；unknown 与 revised 未批准组合及各拒绝下 Package/媒体/模型完整零副作用断言不齐。主线程计划的负向连接可补其中一部分。 |
| AI2-PUB-03<br>预览后关闭/审核变化；两家长并发发布；事务保护、唯一胜者、409、不升级重试 | [S]：`PUB-03 two parents same UUID compete for one active publication`<br>[S]：`PUB-03 true transaction competition with AI1 close, publishFirst=%s` | [E2] / [E5A]：H-db | 两家长同 UUID 一胜一409，Package/Command 各1；真实事务屏障覆盖 close/publish 两种胜者。 | **PARTIAL**：预览后 Artifact 审核版本/批准指针改变而非关闭的发布反例未找到；页面发布409后不自动升级版本的直接断言未找到，审核409反例不能替代发布。 |
| AI2-PUB-04<br>原题/标题更新、源404/503；新发布拒绝，旧快照稳定与 sourceAvailability 准确 | [S]：`PUB-04 existing snapshot remains available on missing/unavailable source; new publication fails`<br>[FH]：`formal publication uses live GrowthTask source rather than a fixture sourceReader` | [E2] / [E5A]：H-db；[E5H]：正式 H-http | 服务源替身404/异常分别返回历史 missing/unavailable；真实 GrowthTask 在预览后删除，正式 publish=404 且无 Package/Command。 | **PARTIAL**：原题/标题更新未实际执行；服务例未比较旧 childSnapshot 完整前后值，也未直接执行503来源下的新 publish。未找到这些 sourceAvailability 状态的组件断言。 |
| AI2-VIEW-01<br>孩子列表/详情/Attempt/媒体/命令白名单；猜其他候选ID、未发布不可见 | [S]：`GET package/history/command/list have zero persisted side effects and child historical review is redacted`<br>[FH]：`formal three-service publication, upload, exact submission, authenticated media, parent approval and withdrawal`<br>[BP]：`AI2 formal page publish, revise, resubmit, approve, readback, privacy deletion and withdrawal` | [E2] / [E5A]：H-db；[E5H]：正式 H-http；[BC] / [BW]：B | 详情排除 PRIVATE_ANSWER/CONTEXT、storageKey、绑定/审核者等字段；历史投影与读操作零写；真实浏览器私密文本不可见并有媒体读取。 | **PARTIAL**：未找到对孩子 list/Attempt/command 全部 DTO 键的完整白名单断言，也未找到 AI2 场景下猜测其他候选 ID 的完整入口组合。旧 AI1 artifact 拒绝仅有独立旧 HTTP 证据，不冒称本批正式连接覆盖。 |
| AI2-AUTH-01<br>匿名/过期/PIN重置/同胞/跨家庭/共管撤权；读写重放实时鉴权；正文 Bearer+capability | [S]：`AUTH-01 real membership, sibling, stale child and actor checks precede replay`<br>[RA]：`current tokenVersion and family membership invalidate already issued capability`<br>[RA]：`parent live membership overrides stale claim, revocation rejects old capability`<br>[BB]：`AI2 parent child switch clears private views and sibling PIN cannot read details or media`<br>[G]：`AI2 malformed input does not take priority over %s JWT` | [E2] / [E5A]：H-db；[E3R]：媒体 H-http；[E5H]：正式权限 HTTP；[BC] / [BW]：B；G 的过期 JWT 为代理层；[E5G]：代理HTTP | 真实家庭/tokenVersion/撤权读与 publish 重放检查；匿名 authenticated-content=401，旧匿名新用途=404；浏览器同胞详情404及 access/旧签名正文403。 | **PARTIAL**：PIN 失效用 DB tokenVersion 变化证明，未走实际 PIN 重置动作；撤权后的每种原命令 recover/replay 未逐一执行，尤其 recover 入口不能由 publish 重放拒绝推定。浏览器覆盖同胞，不声称所有权限组合均经B验证。 |
| AI2-WITHDRAW-01<br>各状态撤回、旧capability、同key重放、再次发布；旧审计保留、新包不迁移Attempt | [S]：`WITHDRAW-01 withdraw preserves old package, child denied, parent replay and fresh republication`<br>[FH]：`formal three-service publication, upload, exact submission, authenticated media, parent approval and withdrawal`<br>[BP]：`AI2 formal page publish, revise, resubmit, approve, readback, privacy deletion and withdrawal` | [E2] / [E5A]：H-db；[E5H]：正式 H-http；[BC] / [BW]：B | open 撤回、原key重放、新包新ID；其他测试有 revise 后撤回、submitted 未决撤回与 approved 后撤回；旧 capability 失效、家长历史可读。 | **PARTIAL**：再次发布的现有例从无 Attempt 的 open 包起步，不能证明有旧订正/审核时新包不迁移 Attempt；尚无同一历史对象完整前后审计比较的再发布断言。 |
| AI2-WITHDRAW-02<br>提交prepare/commit/最终CAS与撤回竞争；COMMITTED精确清理、未知保锁 | [Q]：`withdraw after remote commit enters durable RESOLVING before exact unbind and clears lock only afterwards`<br>[Q]：`successor RESOLVING defeats an old final publisher held before its transaction writes`<br>[SH]：`withdrawal after unknown commit converges exact unbind in off mode without exposing withdrawn body or creating Attempt` | [E3P] / [E5A]：H-db（remote替身）及 H-http（真实resource operation） | commit 后撤回→不可逆 RESOLVING→精确解绑；清理未知保锁；最终发布与补偿CAS交错；实际 HTTP unknown commit 后撤回不产生 Attempt。 | **PARTIAL**：未找到针对 prepare 最后异步窗口的真实撤回竞争；off/prepare 及 privacy-delete/PREPARED 是不同触发，不能直接替代这一子条件。 |
| AI2-ATTEMPT-01<br>初次提交→退回→再提交→通过；版本/指针、旧正文图片review不变、无教学奖励写 | [Q]：`submit persists random remote mapping, full references and ordered immutable Attempt exactly once`<br>[S]：`REVIEW-01/02 both parents same UUID race: first audit wins; old body replay cannot approve newer attempt`<br>[BP]：`AI2 formal page publish, revise, resubmit, approve, readback, privacy deletion and withdrawal` | [E3P] / [E5A]：H-db；[BC] / [BW]：B | 真实浏览器完成两次提交/退回/通过和历史反馈；单提交 H 断言 hash、bindings、stateVersion=3；旧审核重放不能改新Attempt；B unchanged 检查学习记录与Provider。 | **PARTIAL**：浏览器主链未逐步断言两次 Attempt 的严格递增版本及当前指针，也未完整比较第一次正文/图片/审核在第二次提交后的快照。审核服务旧历史例的第二次 Attempt 为DB夹具，不能替代真实再提交不变性。 |
| AI2-ATTEMPT-02<br>0/1/10/11图、重复/稀疏/类型、note边界；无占位/远端写、禁止父母代录/actor注入 | [K]：`submit accepts only ordered unique 1-10 IDs and closed original command; recover carries no replacement body`<br>[M]：`eleven selected files upload ten, overflow remains blocking until dismissed`<br>[C]：`AI2 operation IDs use UUIDv4 and valid complete bodies round-trip`<br>[FH]：`formal gateway rejects forged identity, sibling/outsider access, parent submission and internal-route exposure` | [E3P] / [E5A]：U/H；[E4] / [E5F]：U/C；[E5H]：正式 H-http | 后端 normalize 正例1图，拒绝0/重复/稀疏/错类型；前端10图合法及11图阻断、note1000/1001等；正式HTTP拒绝父母上传/提交，数量不变。 | **PARTIAL**：后端没有10个不同ID合法提交，以及note边界的直接反例；后端11图测试为11个重复ID，不能独立保护上限。U拒绝未同时证明H层零占位/零远端写。 |
| AI2-ATTEMPT-03<br>submitted/approved/withdrawn新提交、两个提交并发；一个活动命令、不覆盖历史、唯一版本约束 | [Q]：`live owner prevents takeover; expired owner can resume same mapping`<br>[P]：`approved package is readonly while current and historical feedback remains readable`<br>[BP]：`AI2 formal page publish, revise, resubmit, approve, readback, privacy deletion and withdrawal` | [E3P] / [E5A]：原命令恢复 H-db；[E5F]：C；[BC] / [BW]：B | 现有证据证明活动 owner 不被恢复接管、approved UI禁提交及单命令精确重放。 | **PARTIAL**：明确阻断整行闭合：未找到同一Package两个不同UUID全新 submit 并发；未找到 submitted/approved/withdrawn 下换新UUID submit 的服务/HTTP拒绝、零新增Attempt/远端写及唯一版本保护反例。恢复竞争和禁用按钮均不能替代。 |
| AI2-REVIEW-01<br>未看新版/旧版本hash、两家长同或不同UUID；单CAS、首次actor审计不变、409显式重看 | [S]：`REVIEW-01/02 both parents same UUID race: first audit wins; old body replay cannot approve newer attempt`<br>[S]：`REVIEW-01 stale hash/version and active submit lock never change review`<br>[P]：`parent review uses viewed version and hash, requires images viewed; conflict requires an explicit reread`<br>[BB]：`AI2 co-parent review conflict clears stale detail and preserves the first audit until explicit re-view` | [E2] / [E5A]：H-db；[E5C]：C；[BC] / [BW]：B | 同 UUID H 竞争与真实两个页面各自命令竞争；旧 version/hash 拒绝；未看图片禁approve，冲突清详情/图片，显式重看且首审计不变。 | **CORE_PASS_SCOPED**：核心条件已有分层实证。H审核例的Attempt/media端口有替身，B提供真实上传/提交/媒体补充；不宣称所有竞态都在真实远端同时执行。 |
| AI2-REVIEW-02<br>revise空反馈、重复审核、未知/丢响应；同key原结果、异正文409、原子且终态不回退 | [K]：`review/withdraw require feedback, preserve whitespace and normalize only CRLF`<br>[S]：`REVIEW-02 rolled back audit is absent; committed unknown replay keeps original reviewer and one result` | [E2] / [E5A]：U、H-db | 空白/超长反馈拒绝；真实事务 rollback 无review，commit后抛未知仍保首次审计；原key重放只有一个review Command。 | **PARTIAL**：未找到 review 同 key 改 decision/comment/版本后的 IDEMPOTENCY_CONFLICT 直接服务反例。已有旧hash/version冲突使用未成功命令，不能等同已终态命令异正文重放。 |
| AI2-ACK-01<br>媒体故障下退回/撤回重放；approve预检后异常；写确认不再读媒体、详情真实报错 | [S]：`review P2 durable revise/withdraw and replay do not depend on %s media details`<br>[S]：`review P2 approve checks media before commit exactly once; replay does not recheck unavailable media` | [E2] / [E5A]：H-db，mediaReader故障替身 | missing/unavailable 参数分别验证退回/撤回与重放、确认不带媒体详情、Command计数1，GET Attempt仍报真实错误；approve只预检一次。 | **CORE_PASS_SCOPED**：此行的故障注入在只读媒体端口，真实本地事务已执行；不标成真实断网服务链或浏览器专项。旧3红保留。 |
| AI2-REVIEW-03<br>审核前媒体删除/不可用/503，审核后正常删除；approve拒绝、revise可用、事后审计/状态不变 | [S]：`REVIEW-03 deleted/missing/wrong media fail approve; revise still works and preserves submission`<br>[BP]：`AI2 formal page publish, revise, resubmit, approve, readback, privacy deletion and withdrawal` | [E2] / [E5A]：H-db，媒体端口故障替身；[BC] / [BW]：B真实隐私删除 | 前置deleted/missing/503拒绝approve，revise保留正文绑定；真实浏览器approved后DELETE，stateVersion/learningState/review不变及学习记录不变。 | **CORE_PASS_SCOPED**：前置媒体异常是服务端口替身，事后删除为真实服务；区分两者，不宣称浏览器跑过每种503。 |
| AI2-IDEM-01<br>publish/submit/review/withdraw同key异正文、跨actor同UUID；闭合摘要、原actor、独立remoteID | [S]：`IDEM/RECOVER local transaction rollback then unknown commit replay preserves one command`<br>[Q]：`only original child actor can recover and changed payload cannot reuse a key`<br>[Q]：`same public operation UUID for distinct child actors has independent random remote mappings`<br>[C]：`AI2 unresolved command accepts exact replay only, including array ordering and versions` | [E2] / [E3P] / [E5A]：U/H-db；[E4] / [E5F]：U | publish异artifactVersion、submit异note直接拒绝；家长同UUID竞争、不同孩子同UUID独立remote映射；前端精确body/数组顺序锁。 | **PARTIAL**：review、withdraw 已成功命令同key异正文的H层反例未找到。前端store闭合与客户端保留正文不能代替后端幂等判断。 |
| AI2-RECOVER-01<br>占位后重建、prepare/commit各丢响应；原payload/Attempt/remote/引用代次持久且不换UUID | [Q]：`reservation is committed before any remote effect and unknown network retains mapping and lock`<br>[SH]：`real resource commit response loss -> readonly discovery -> rebuilt original command recovery publishes exactly one Attempt`<br>[BR]：`AI2 remote commit loss survives real PIN relogin and only explicit original-command recovery publishes` | [E3P] / [E5A]：H-db及真实operation H-http；[BC] / [BW]：B | prepare成功后故障为client替身；commit成功丢响应为真实socket/正式B；服务工厂重建、PIN重登后只读发现，显式恢复核对原映射和一个Attempt。 | **CORE_PASS_SCOPED**：重建是服务工厂/登录会话重建，非整机崩溃/备份恢复；不把prepare替身丢响应写成真实远端进程故障。 |
| AI2-RECOVER-02<br>本地最终事务未知/回滚、旧owner失租、RESOLVING与成功CAS交错；不得误补偿/重复Attempt | [Q]：`expired unchanged owner cannot publish or compensate after a delayed commit response; original mapping remains recoverable`<br>[Q]：`unknown final transaction commit reads back success without compensation`<br>[Q]：`RESOLVING transaction %s unknown never authorizes speculative cleanup`<br>[Q]：`final SUCCEEDED transaction defeats a competing recovery while the command row is locked` | [E3P] / [E5A]：真实Mongo事务H-db，remote/权限helper为替身 | 不变owner过期零发布/abort/unbind；持久成功先读回；RESOLVING committed/rolled-back未知两分支；成功/补偿交错、不可回到发布、锁与原绑定断言。 | **CORE_PASS_SCOPED**：已保留租约/末次mode变异及收尾证据。不是分布式真实网络下全部竞态演练，也不是高级恢复验收。 |
| AI2-RECOVER-03<br>缺/多引用、错hash/type/field/binding、终态矛盾/503；未决失败关闭、GET零写、保锁 | [Q]：`typed operation %s mismatch never publishes`<br>[Q]：`bad cleanup receipt keeps RESOLVING lock instead of claiming failure completion`<br>[RC]：`client rejects a response with wrong %s`<br>[REF]：`malformed response %s stays pending`<br>[REF]：`rejects contradictory %s projection %#` | [E3P] / [E5A]：U及H-db；SH的GET零写见[E3P] | AI2类型/hash/field/引用损坏拒绝，清理凭证错误保锁；共享client缺/多引用/终态矛盾拒绝；真实HTTP发现读不改命令。 | **CORE_PASS_SCOPED**：共享malformed/终态矩阵使用growth_task协议夹具；AI2 typed变体另在RC/Q验证。组合证据不能宣称每个坏响应均跑过AI2正式HTTP。 |
| AI2-RECOVER-04<br>重登发现未决/终态、共管恢复他人命令、无记录、撤权；仅原actor显式恢复 | [SH]：`public response loss replays same terminal; parent cannot submit or restore a child command`<br>[P]：`logout clears local command; relogin discovers and explicitly recovers original server UUID`<br>[P]：`pending package remains locked when command discovery is empty`<br>[BR]：`AI2 remote commit loss survives real PIN relogin and only explicit original-command recovery publishes` | [E3P] / [E5A]：H-http；[E5C]：C；[BC] / [BW]：B | 父母恢复孩子命令403；真实PIN重登不自动POST，显式recover保持原UUID/映射；空发现不解锁；成功丢响应另有BR精确重试。 | **PARTIAL**：未找到已经持久原命令的原actor被撤权后，直接recover入口的永久反例（已有 stale-token submit重放及publish撤权，不能全替代）。无记录未知提示主要在C层。 |
| AI2-RECOVER-05<br>撤回后原actor查/恢复、他人猜命令；仅最小状态、精确清理、不复活 | [SH]：`withdrawal after unknown commit converges exact unbind in off mode without exposing withdrawn body or creating Attempt`<br>[Q]：`terminal succeeded replay after withdrawal reveals only command acknowledgement`<br>[P]：`withdrawn terminal command without payload retains an explicit original recovery path` | [E3P] / [E5A]：H-db/H-http；[E5C]：C；他人命令拒绝另见S/Q | 撤回后FAILED原key/原recover无payload/package/attempt、精确解绑、零Attempt、锁清理后才终态；SUCCEEDED重放最小摘要；页面缺payload仍保留显式recover。 | **CORE_PASS_SCOPED**：原actor/他人命令隔离组合由S getCommand与SH恢复拒绝补充；没有真实撤回恢复浏览器专项，不冒称B覆盖。 |
| AI2-MEDIA-01<br>1/10图与10MiB边界、真实内容/MIME/PDF/HEIC/purpose/孩子/profile；旧用途回归 | [RA]：`exactly 10MiB is accepted and reencoded to canonical image`<br>[RA]：`MIME mismatch and 10MiB plus one are rejected and temporary files removed`<br>[RA]：`nonimage bytes rejected despite MIME`<br>[RC]：`AI2 model pairs reject crossed fields and purpose mismatch never binds`<br>[M]：`eleven selected files upload ten, overflow remains blocking until dismissed` | [E3R] / [E5A]：真实multipart/重编码H-http与H-db；[E4] / [E5F]：U/C | JPEG/PNG/WebP实际重编码，伪MIME/PDF/HEIC拒绝，secure scanner故障失败关闭，typed字段/purpose/孩子约束；旧用途/PDF回归保留。 | **CORE_PASS_SCOPED**：图片数量10的正例在C；后端10张真正提交单独列ATTEMPT-02缺口。scanner失败为明确替身，不能写成生产杀毒或真机HEIC验收。 |
| AI2-MEDIA-02<br>部分失败、取消/离开/未知响应；成功保留、失败处理前禁提交、普通移除不DELETE/无孤儿回收 | [M]：`partial upload keeps success, blocks through other actions, and explicit retry resolves failure`<br>[M]：`late upload on new scope never changes selection or automatically deletes`<br>[D]：`%s detail refresh retains partial-upload failure and submit lock until explicit dismissal`<br>[BB]：`AI2 partial upload failure survives manual and focus refresh, and ordinary removal never deletes media` | [E4] / [E5F] / [E5C]：C；[BC] / [BW]：B | 真实页面+媒体组件组合保留失败队列；scope离开/late upload不写选择、不自动DELETE；B只abort一个上传，普通/focus刷新保留成功与锁，移除不DELETE，最终只提交保留ID。 | **CORE_PASS_SCOPED**：取消/离开主要由C的scope/disabled/readOnly中断覆盖；B验证一次传输abort，不声称原生文件选择器取消与所有离开方式逐一真机验证。 |
| AI2-MEDIA-03<br>未绑定/prepare/released/withdrawn/混合绑定、同capability不同身份；实时读取者鉴权/超限/503关闭 | [RA]：`never-bound self preview needs signed identity and preserves old anonymous purpose behavior`<br>[RA]：`an unpublished committed reference cannot hide another published exact Attempt`<br>[RA]：`parent live membership overrides stale claim, revocation rejects old capability`<br>[RA]：`more than 100 references is refused, never truncated into authorization`<br>[BB]：`AI2 parent child switch clears private views and sibling PIN cannot read details or media` | [E3R] / [E5A]：H-http；[BC] / [BW]：B | 从未绑定本人例外、prepared/released不回退；已知未发布绑定不否决合法已发布引用，未知/损坏则拒绝；当前读取者而非上传者鉴权、匿名拒绝，旧capability同胞403、超限/503不授权。 | **CORE_PASS_SCOPED**：资源测试使用真实内部HTTP与合成持久映射；未知依赖/畸形响应故障注入明确，不等同生产故障。 |
| AI2-MEDIA-04<br>同图跨Attempt、删除/commit竞争、重复DELETE/丢响应；整组凭证、首审计、隔离/不改教学奖励 | [RC]：`mixed task/AI2 records and multi-attempt privacy receipts pass read-only precheck and cleanup`<br>[RC]：`privacy deletion of AI2 PREPARED aborts the full group without fabricated receipts`<br>[RC]：`failed deletion journal acknowledgement is unknown; retry preserves the first audit`<br>[FH]：`formal privacy deletion preserves exact metadata and journal evidence, but rejects an incomplete descriptor` | [E5A]：H-db（transport adapter）；[E5H]：正式 H-http；[BC] / [BW]：B删除后教学不变 | 同图跨Attempt精确receipt、PREPARED整组abort、journal确认未知保首审计、正式重复DELETE字节级journal不变；正文拒绝与批准后状态不变有真实证据。 | **PARTIAL**：AI2专属真实commit与privacy-delete并发屏障用例未找到；顺序PREPARED删除不能冒称竞争。旧growth_task竞争回归不直接填AI2类型分支；跨家庭对象未改的完整负向删除快照亦未逐项证明。 |
| AI2-MEDIA-05<br>正常解绑/删除凭证区分、删除后恢复、混合旧日志；精确墓碑/Receipt，缺证据阻断、不改旧摘要/不走高级恢复 | [Q]：`committed released binding with %s stays pending`<br>[Q]：`exact deletion receipt permits historical committed submission without rewriting original media`<br>[RA]：`actual privacy deletion and 30-day cleanup retain exact deleted metadata and live identity checks`<br>[RC]：`AI2 deletion does not enter the optional advanced recovery writer` | [E3P] / [E3R] / [E5A]：U/H-db/H-http | 错代次/type/缺凭证保持未决；精确删除凭证允许恢复且保留原mediaIds；真实删除/30天清理后仅元数据投影；混合旧日志/旧摘要与新代次隔离有RC断言。 | **CORE_PASS_SCOPED**：正常保留清理不是高级恢复/新孤儿回收；缺MIME/size与不匹配墓碑的负例保留，不能由released自行推断deleted。 |
| AI2-SESSION-01<br>退出/坏JSON/切孩子账号/跨标签、迟到成功与401；DOM/blob/暂存隔离、原服务端命令保留 | [C]：`AI2 clears corrupt canonical owned data on %s only`<br>[C]：`AI2 %s late success and late 401 cannot affect a replacement session`<br>[M]：`late blob after %s cannot create or expose object URL`<br>[BR]：`AI2 same-context logout and sibling login reject a held successful ${kind} response` | [E4] / [E5F]：U/C；[BC] / [BW]：B（detail GET/authenticated media两例） | 坏JSON按当前scope清理、late401不退出新会话、blob回收；同context跨标签退出与同胞PIN登录后释放真实200，旧DOM/blob不恢复，服务端/媒体快照不变。 | **CORE_PASS_SCOPED**：B两例为迟到成功；迟到401由U/C覆盖，不写成浏览器实测401。参数化源码的${kind}分别展开为detail GET和authenticated media。 |
| AI2-SESSION-02<br>当前身份详情/恢复403/404后迟到成功；网络失败保命令、拒绝优先、不误放行新提交 | [P]：`detail %s clears private content and fences a late write success; network error keeps original command`<br>[P]：`same-session %s refresh rejects %s and fences a late detail`<br>[M]：`superseded preview %s denial %s fences a replacement pending blob in the same scope and session`<br>[D]：`detail refusal clears retained draft and rejects a later successful detail response` | [E4] / [E5F] / [E5C]：C | 详情403/404与旧写成功交错、focus/pageshow/visibility拒绝优先、同scope媒体拒绝封迟到blob；普通网络错误保原命令。 | **PARTIAL**：未找到 recover请求本身403/404后与迟到成功交错的直接页面永久例；不能把detail拒绝自动泛化为恢复分支。B现有跨身份迟到200不是当前身份拒绝优先。 |
| AI2-OFF-01<br>默认off/动态关闭/新prepare竞争/COMMITTED恢复；新写拒绝、旧用途/历史/撤回/删除有效 | [S]：`OFF-01 new writes disabled but authorized history/replay/withdraw stay available`<br>[Q]：`off during the final owned check prevents %s and preserves the original command for cleanup`<br>[Q]：`off still finalizes already committed operation`<br>[RP]：`off continuous startup retains abort/unbind and privacy deletion with real durable evidence` | [E2] / [E3P] / [E5A]：H-db；[E5R]：正式resource装配H；[E5H]：homework装配H | 默认off拒绝，新上传/prepare/commit动态检查；末次owned窗口切off零目标写；COMMITTED继续确认、PREPARED按原映射清理；连续性明确时历史/撤回/删除可用。 | **CORE_PASS_SCOPED**：无新prepare/commit不等于清理过程零远端写；abort/unbind是已定义收敛。各替身和实际装配证据分列，不宣称目标NAS运行验证。 |
| AI2-OFF-02<br>缺索引/事务/凭据/journal/guard、旧服务/连续性不明；启用失败关闭、维护隔离 | [RT]：`missing unique index fails off-with-continuity too, never repairs it, and sanitizes failures`<br>[RP]：`startup precheck failure never listens or creates upload state`<br>[RU]：`mixed AI2/task upload guards pass read-only readiness; missing AI2 guard fails closed`<br>[CR]：`metadata route rechecks continuity after inspect settles and before the success envelope` | [E5A]：U/H与startup；[E5H] / [E5R]：正式装配独立复验；ACT：旧数据/maintenance U/HTTP | 索引/事务拓扑失败不就绪不修复；Guard/journal/凭据与连续性前置；legacy发现AI2数据拒绝、maintenance不被普通recover绕过；最终异步返回再检查。 | **CORE_PASS_SCOPED**：仅本地启动/装配、配置及持久证据演练；不是NAS恢复、任意旧二进制兼容测试或真实计数资格。DEVICE_PENDING等另保留。 |
| AI2-FLOW-01<br>原AI1批准→发布→孩子订正→退回→再提交→通过回看；正式HTTP/生产构建、不变量 | [BP]：`AI2 formal page publish, revise, resubmit, approve, readback, privacy deletion and withdrawal`<br>[S]：`PUB-01/VIEW-01 real AI1 revision and approval -> %s publication, safe snapshot and no AI side effects` | [E2]：AI1服务层双来源；[BC] / [BW]：正式七服务B（approved预置task） | 已批准后AI2完整B闭环、真实媒体与登录/PIN；runtime.unchanged保护Provider sentinel零调用及Task/Ledger/Mistake/MistakeStateEvent/DailyPlan不变，AI1仅允许发布来源Cycle一次CAS。 | **PENDING_CONNECTION**：现有B只覆盖task且直接预置approved，不能拼接服务层双来源测试声称端到端已连接。待正式AI1生成替身→人工修订→共管批准→Tutor真实Link的task/mistake两链；同时核对精确来源/版本/审计。 |

## 4. 实质缺口与最小接续

### 4.1 已授权的正式双来源连接

PUB-01/FLOW-01仍PENDING_CONNECTION。主线程计划的task/mistake两条“显式Provider替身生成→真实人工修订→共管批准→Tutor真实Link→发布→孩子上传→退回→再次提交→通过回看”正好对齐缺口。本文件不将其写成已完成，也不要求真实模型调用。

连接负向检查可同时补PUB-02/VIEW-01：candidate/revised未批准不可发布；旧原候选id/version/hash不可发布；批准本身不自动创建Package；孩子旧AI1入口拒绝。注意拒绝多个字段同时过期时，只能证明该组合拒绝，不能自动证明每个hash/version独立保护。

建议在同链中直接比较两次Attempt的版本、当前指针及首次正文/图片/review，补ATTEMPT-01；断言AI2阶段无额外Provider调用和预算/学习记录变化。AI1生成阶段允许明确替身执行，不应把整个连接阶段写成Provider替身调用为零。现有approved夹具的sentinel零调用是另一口径。

### 4.2 连接以外的明确闭合缺口

优先级是**需求证据闭合顺序**，不是产品漏洞严重性，也不是新增功能授权：

1. **ATTEMPT-03**：同包两个不同UUID的全新submit竞争；submitted/approved/withdrawn下新命令拒绝，核对单活动命令、无额外Attempt/远端写、不覆盖历史及唯一版本保护。这是总矩阵闭合待决项，不是本次桥接新增阻断；恢复竞争或UI禁用不够。
2. **REVIEW-02 / IDEM-01**：review、withdraw持久终态后同key异正文，直接断言后端409及原审计/结果不变。已有publish/submit不能替其背书。
3. **PUB-03 / PUB-04 / ATTEMPT-02**：预览后审核版本变化；原题/标题变化及快照完整不变；后端10个唯一mediaId正例、11个唯一ID拒绝、note边界及拒绝零副作用。
4. **WITHDRAW-01/02 / MEDIA-04**：带历史撤回再发布不迁移Attempt；prepare窗口撤回竞争；AI2 typed删除与commit真实事务交错。不能用顺序执行或旧growth_task场景直接替代。
5. **AUTH-01 / RECOVER-04 / SESSION-02**：原actor撤权后的recover入口直接反例；当前身份recover 403/404后迟到成功的页面分支。旧token submit/publish拒绝与detail拒绝优先不能自动填满恢复入口。
6. **VIEW-01及其余PARTIAL细项**：完整DTO白名单/未发布猜ID、PIN重置动作与失效身份的连接等以逐行说明为准。可用最小U/H/C反例补证，不要求把所有组合扩成浏览器矩阵。

31行中14行CORE_PASS_SCOPED保留既有通过及限定合成批准；15行PARTIAL不是15个已知产品bug。若拟保留某子条件而不补，应由主线程明确说明证据范围/后置决定，不能在汇总中将它默认为PASS。本次只报告，不改测试、不新增审批框架。

## 5. 历史失败、批准与后置状态

- AI2-2的模块缺失、空图片审核红灯、媒体确认依赖3红、logger EPERM及错误断连路径记录仍在原[AI2-2索引](../ai2-2-20261103/README.md)和归档。失败修复后的通过不改写原结果。
- AI2-3的数组别名、混合绑定、缺删除descriptor、fixture/config误用失败，以及P2租约/末次mode变异保留。独立63通过见[E3P]；变异是反例有效性证据，不计产品通过数。见[AI2-3索引](../ai2-3-20261103/README.md)。
- AI2-4的media拒绝优先P1、页面/preflight/epoch、draft-refresh旧实现2红2绿等保留于原AI2-4-final/draft-refresh归档；API替身浏览器只能是页面交互证据，不能代替正式七服务B。
- AI2-5原始runtime-red、同URL3红、浏览器first产品失败、Cycle CAS fixture失败、matrix定位器失败、lint初轮及WebKit初轮7失败1通过均保留。最终BC/BW不覆盖旧档。详见[浏览器批准与历史证据](browser-acceptance.md)及[正式接线索引](README.md)。
- 已批准状态不撤销：AI2-2/3/4限定本地合成ACCEPTED；AI2-5接线/浏览器子批ACCEPTED，已获用户批准的连续性、同URL及recovery保护P2仍CLOSED / USER_APPROVED。**AI2-5汇总IMPLEMENTING、AI-2总门禁OPEN**。
- 真机iPad **DEVICE_PENDING**；真实启用/AI1计数资格与真实发送授权、T4/T8/AI-1 **OPEN**；Docker **INCOMPLETE_FAILED**；T5-NB-001/002 **OPEN_NONBLOCKING**；高级恢复/新回收 **REMAINDER_DEFERRED**；T9 **NOT_STARTED**。这些状态不因矩阵归并或模拟浏览器通过而改变。
- 未执行完整发布/Git clean，不声明发布全绿；不启动AI3/K12、不调用模型、不安装依赖、不部署。所有旧manifest、补丁及失败日志原字节保留。

## 6. 永久测试文件索引

文件别名仅为减少31行长路径重复，不是替代测试名；测试名已在逐行表完整列出。

| 别名 | 永久文件 |
| --- | --- |
| S | [backend/services/homework-service/__tests__/services/ai2Service.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Service.test.js) |
| K | [backend/services/homework-service/__tests__/services/ai2Contract.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Contract.test.js) |
| H | [backend/services/homework-service/__tests__/services/ai2Http.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Http.test.js) |
| Q | [backend/services/homework-service/__tests__/services/ai2Submission.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Submission.test.js) |
| SH | [backend/services/homework-service/__tests__/services/ai2SubmissionHttp.test.js](../../../../backend/services/homework-service/__tests__/services/ai2SubmissionHttp.test.js) |
| HA | [backend/services/homework-service/__tests__/services/ai2MediaAccess.test.js](../../../../backend/services/homework-service/__tests__/services/ai2MediaAccess.test.js) |
| FH | [backend/services/homework-service/__tests__/services/ai2FormalHttp.test.js](../../../../backend/services/homework-service/__tests__/services/ai2FormalHttp.test.js) |
| AS | [backend/services/homework-service/__tests__/services/ai2Assembly.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Assembly.test.js) |
| RT | [backend/services/homework-service/__tests__/services/ai2Runtime.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Runtime.test.js) |
| RA | [backend/services/resource-service/__tests__/ai2MediaAccess.test.js](../../../../backend/services/resource-service/__tests__/ai2MediaAccess.test.js) |
| RC | [backend/services/resource-service/__tests__/completionMediaClientContract.test.js](../../../../backend/services/resource-service/__tests__/completionMediaClientContract.test.js) |
| RU | [backend/services/resource-service/__tests__/completionUpload.test.js](../../../../backend/services/resource-service/__tests__/completionUpload.test.js) |
| RP | [backend/services/resource-service/__tests__/ai2ProductionAssembly.test.js](../../../../backend/services/resource-service/__tests__/ai2ProductionAssembly.test.js) |
| CR | [backend/services/resource-service/__tests__/ai2ContinuityReads.test.js](../../../../backend/services/resource-service/__tests__/ai2ContinuityReads.test.js) |
| ACT | [backend/common/deployment/__tests__/ai2Activation.test.js](../../../../backend/common/deployment/__tests__/ai2Activation.test.js) |
| REF | [backend/common/services/__tests__/completionMediaReferenceClient.test.js](../../../../backend/common/services/__tests__/completionMediaReferenceClient.test.js) |
| G | [backend/gateway/__tests__/ai2Routes.test.js](../../../../backend/gateway/__tests__/ai2Routes.test.js) |
| P | [frontend/web/src/__tests__/family/Ai2LearningPage.test.js](../../../../frontend/web/src/__tests__/family/Ai2LearningPage.test.js) |
| D | [frontend/web/src/__tests__/family/Ai2DraftRefresh.test.js](../../../../frontend/web/src/__tests__/family/Ai2DraftRefresh.test.js) |
| M | [frontend/web/src/__tests__/shared/Ai2Media.test.js](../../../../frontend/web/src/__tests__/shared/Ai2Media.test.js) |
| MA | [frontend/web/src/__tests__/shared/ai2MediaApi.test.js](../../../../frontend/web/src/__tests__/shared/ai2MediaApi.test.js) |
| C | [frontend/web/src/__tests__/family/ai2Client.test.js](../../../../frontend/web/src/__tests__/family/ai2Client.test.js) |
| BP | [tests/e2e/t2/ai2FormalPage.spec.js](../../../../tests/e2e/t2/ai2FormalPage.spec.js) |
| BB | [tests/e2e/t2/ai2FormalBoundaries.spec.js](../../../../tests/e2e/t2/ai2FormalBoundaries.spec.js) |
| BR | [tests/e2e/t2/ai2FormalRecovery.spec.js](../../../../tests/e2e/t2/ai2FormalRecovery.spec.js) |
| A1H | [backend/services/homework-service/__tests__/services/ai1Http.test.js](../../../../backend/services/homework-service/__tests__/services/ai1Http.test.js) |

### 6.1 归并阶段文档校验

只读 Node 校验结果：测试方案 §2 为31个ID，本矩阵31行、31个唯一ID，顺序完全一致；分类计数为14 CORE_PASS_SCOPED、15 PARTIAL、2 PENDING_CONNECTION。逐项引用的测试完整标题/参数化模板均存在于对应源码；12份主执行档案在原项目本机忽略目录中均已核对存在，源码相对链接无缺失。证据现以相对归档标识列示，不作为可提交文件链接。标题存在检查只验证引用准确性，覆盖判定仍依据上文实际断言核对，不以标题替代断言。本次未重新运行产品测试。

[S]: ../../../../backend/services/homework-service/__tests__/services/ai2Service.test.js
[K]: ../../../../backend/services/homework-service/__tests__/services/ai2Contract.test.js
[H]: ../../../../backend/services/homework-service/__tests__/services/ai2Http.test.js
[Q]: ../../../../backend/services/homework-service/__tests__/services/ai2Submission.test.js
[SH]: ../../../../backend/services/homework-service/__tests__/services/ai2SubmissionHttp.test.js
[HA]: ../../../../backend/services/homework-service/__tests__/services/ai2MediaAccess.test.js
[FH]: ../../../../backend/services/homework-service/__tests__/services/ai2FormalHttp.test.js
[AS]: ../../../../backend/services/homework-service/__tests__/services/ai2Assembly.test.js
[RT]: ../../../../backend/services/homework-service/__tests__/services/ai2Runtime.test.js
[RA]: ../../../../backend/services/resource-service/__tests__/ai2MediaAccess.test.js
[RC]: ../../../../backend/services/resource-service/__tests__/completionMediaClientContract.test.js
[RU]: ../../../../backend/services/resource-service/__tests__/completionUpload.test.js
[RP]: ../../../../backend/services/resource-service/__tests__/ai2ProductionAssembly.test.js
[CR]: ../../../../backend/services/resource-service/__tests__/ai2ContinuityReads.test.js
[ACT]: ../../../../backend/common/deployment/__tests__/ai2Activation.test.js
[REF]: ../../../../backend/common/services/__tests__/completionMediaReferenceClient.test.js
[G]: ../../../../backend/gateway/__tests__/ai2Routes.test.js
[P]: ../../../../frontend/web/src/__tests__/family/Ai2LearningPage.test.js
[D]: ../../../../frontend/web/src/__tests__/family/Ai2DraftRefresh.test.js
[M]: ../../../../frontend/web/src/__tests__/shared/Ai2Media.test.js
[MA]: ../../../../frontend/web/src/__tests__/shared/ai2MediaApi.test.js
[C]: ../../../../frontend/web/src/__tests__/family/ai2Client.test.js
[BP]: ../../../../tests/e2e/t2/ai2FormalPage.spec.js
[BB]: ../../../../tests/e2e/t2/ai2FormalBoundaries.spec.js
[BR]: ../../../../tests/e2e/t2/ai2FormalRecovery.spec.js
[A1H]: ../../../../backend/services/homework-service/__tests__/services/ai1Http.test.js
[E2]: #e2
[E3P]: #e3p
[E3R]: #e3r
[E4]: #e4
[E5A]: #e5a
[E5H]: #e5h
[E5R]: #e5r
[E5G]: #e5g
[E5F]: #e5f
[E5C]: #e5c
[BC]: #bc
[BW]: #bw

## 7. 桥接补验后的覆盖增量

最新作者执行：正式双来源 × Chromium/WebKit **4通过**（66.36秒，零跳过/重试），
相关组件6套224、服务/正式HTTP2套30通过。独立实际WebKit两格2通过（37.474秒）；2026-11-04再复审四格4通过79.73秒，用户批准连接及三项P2 CLOSED，见连接记录末节。
绑定94文件候选、补丁及原始结果见[连接验收记录](bridge-acceptance.md)；不是重跑§2列出的历史全量。

| 原矩阵ID | 本轮永久用例的直接增量 | 最新分类 |
| --- | --- | --- |
| AI2-PUB-01 | 同一正式运行内task/mistake生成、人工修订、共管批准、Tutor实际Link预览、显式发布；批准后仍零Package，精确tuple/childSnapshot/来源/命令 | CORE_PASS_SCOPED |
| AI2-FLOW-01 | 上述真实前置接两次孩子上传、退回、再次提交、通过回看；正式媒体及七服务；前置一次合成Provider，AI2零新增调用/预算/教学写入口，持久业务不变 | CORE_PASS_SCOPED |
| AI2-ATTEMPT-01 | 逐步Package版本1/3/4/6/7、两Attempt版本1/2和当前指针；第一次正文/图片绑定/review在第二次提交审核后精确不变，真实actor/hash逐项核对 | CORE_PASS_SCOPED |
| AI2-PUB-02 | candidate和人工revision未批准均409且AI1/AI2不变；旧artifact整组及单独id/version/hash拒绝；孩子原/批准artifact/Cycle403 | PARTIAL：childSnapshotHash独立反例及unknown相关组合等仍按§3保留 |
| AI2-VIEW-01 | 孩子详情顶层及source、childSnapshot、artifact、Attempt/review/media完整白名单；原/批准候选均拒绝 | PARTIAL：列表/命令DTO完整白名单等仍按§3保留 |

最新归并为 **31 = 17 CORE_PASS_SCOPED + 14 PARTIAL**；不再有本轮未执行的PENDING_CONNECTION行，
但不表示31行全部满足、所有层均执行或已获总门禁批准。CORE仅描述已有实测，不替代用户验收。
独立补充复核确认ATTEMPT-01升级及17/14计数准确；不变性仅指首次已审核Attempt完整持久对象，
不冒称图片文件字节或BSON原始字节的逐字节比较。原独立报告保留补验前15个PARTIAL快照，不回写其哈希。
§4.2的其他明确缺口没有自动消失；本轮没有把它们改为后置、非阻断或CLOSED。

## 8. 新UUID竞争与终态重放补验

2026-11-04：用户批准§7连接验收及三项P2关闭，并授权优先补以下三行。新增9个永久用例，
homework全部AI2 10套188通过；真实Mongo事务/索引，媒体端口为替身，既有正式HTTP另行回归。
完整候选、反例、变异及独立复评见[本批记录](concurrency-acceptance.md)。

| ID | 新增直接证据 | 当前分类 |
| --- | --- | --- |
| AI2-ATTEMPT-03 | open/revise事务读屏障下不同UUID全新submit竞争，一占位/准确409；未知保锁与原命令恢复、旧Attempt/Command完整不变；submitted/approved/withdrawn新UUID使用当前版本仍拒绝且零远程调用；实际重复Attempt版本插入11000 | CORE_PASS_SCOPED：H-db，授权/媒体端口替身；非法审核/撤回状态由明确夹具设置，不冒称全链路 |
| AI2-REVIEW-02 | approve/revise持久成功后，分别改decision/comment/包版本/Attempt版本/hash，同key准确409 IDEMPOTENCY_CONFLICT；重建service后原正文仍重放；原审计/集合不变、无媒体调用 | CORE_PASS_SCOPED：结合既有空反馈/事务回滚/未知提交证据；新补的是终态异正文子条件 |
| AI2-IDEM-01 | review上述五字段，withdraw reason/包版本分别改动的后端永久反例；原key原正文仍成功，首次命令/审计不变 | CORE_PASS_SCOPED：结合既有publish/submit异正文与跨actor同UUID映射证据 |

本轮覆盖分类归并为 **31 = 20 CORE_PASS_SCOPED + 11 PARTIAL**。这是证据覆盖状态，不代表本增量已获用户批准，
更不代表AI-2总门禁关闭。新测试异常屏障收尾P2的修订及复评单独保留，不混入已批准连接三项P2。
其余11行PARTIAL仍为PUB-02/03/04、VIEW-01、AUTH-01、WITHDRAW-01/02、ATTEMPT-02、RECOVER-04、MEDIA-04、SESSION-02。
已知缺口继续保留，不自动后置、不默认为PASS；§1–7的旧计数作为各阶段快照保留。
已批准的旧子批和P2不撤销，本轮三项测试保护P2已独立实际复验、仍待用户评审；AI2-5 IMPLEMENTING、AI-2 OPEN。

§8后续批准：用户已批准竞争/终态批次及屏障异常收尾P2关闭，见[最新批准记录](concurrency-acceptance.md#2026-11-04-用户批准及本轮复验证据)。§8原待复审描述保留为当时快照，不覆盖最新批准。

## 9. 发布版本、来源快照和输入边界补验

2026-11-04，本批四测试新增21项，自查及独立复评通过；完整候选、实际命令、失败历史和证据见[本批记录](publication-boundaries.md)。
开发homework AI2 206项、相关前端204项通过；独立后端18项/组件3项通过。独立首轮EPERM suite失败单独保留，不计通过。

| ID | 新增直接证据 | 当前分类 |
| --- | --- | --- |
| AI2-PUB-03 | S：`PUB-03 stale %s preview cannot publish or reserve; explicit fresh preview succeeds`；P：`PUB-03 publish conflict discards old preview; only explicit preview and confirmation permit a new command`。reviewVersion/批准指针变化零占位、Cycle不变，显式新预览精确tuple；UI 409清旧视图，不自动升级，重新确认后新UUID，未知结果仍原命令重试 | CORE_PASS_SCOPED：H-db故障夹具+C替身；不声称AI1支持修改已批准稿；结合旧双家长/close并发证据 |
| AI2-PUB-04 | S：`PUB-04 source updates and %s preserve complete published snapshot; new publish refuses without writes`；FH：`PUB-04 formal source title and description edits then deletion never rewrite the published child snapshot`；P：`PUB-04 %s source displays its status without replacing the published question or explanation` | CORE_PASS_SCOPED：实际Task更新/删除与完整快照比较；404/503新发布零写、状态组件提示；503是端口故障替身，不是远端服务停机 |
| AI2-ATTEMPT-02 | SH：`ATTEMPT-02 real HTTP accepts %i unique images and note boundary %#`、`ATTEMPT-02 invalid %s has no reservation, business writes or resource HTTP`；1/10不同ID成功及原命令幂等，11不同ID等拒绝；0/1000/1001码点及代理项边界，所有AI2/媒体集合不变且resource零请求 | CORE_PASS_SCOPED：真实提交及resource协议HTTP、Asset合成metadata；结合原稀疏数组/父母代录/actor拒绝证据，不冒称十图文件上传 |

本轮最新 **31 = 23 CORE_PASS_SCOPED + 8 PARTIAL**。剩余PUB-02、VIEW-01、AUTH-01、WITHDRAW-01/02、RECOVER-04、MEDIA-04、SESSION-02继续PARTIAL，未自动后置或关闭。
独立评审核查了上述覆盖升级及替身边界；本批USER_REVIEW_PENDING，AI2-5 IMPLEMENTING、AI-2 OPEN。

2026-11-04后续：本批已获用户批准，最新独立18/3及冻结绑定见[批准记录](publication-boundaries.md#2026-11-04-用户批准及本轮复验证据)。
旧待审计数保留阶段身份，AI2-5 IMPLEMENTING、AI-2 OPEN。

## 10. 实时权限、原命令恢复和迟到响应补验

2026-11-04，AUTH-01/RECOVER-04/SESSION-02接续新增后端9项、组件7项，冻结及准确分层证据见[本批记录](auth-recovery-boundaries.md)。
沿用§1原31行，§3旧PARTIAL和§9的23/8是历史快照，不覆盖原失败。

| 行 | 新增直接证据 | 最新限定覆盖及边界 |
| --- | --- | --- |
| AUTH-01 | FH `AUTH-01 actual PIN reset...`真实PIN设置/登录/重置及旧JWT八入口401、新PIN原actor恢复；S `AUTH-01 revoked co-parent...`review/withdraw两例；SH撤权六例 | CORE_PASS_SCOPED。结合原匿名/过期/同胞/跨家庭/旧URL及publish重放拒绝，不称每个角色/端点/阶段全排列；家长JWT和AI1制品为合成夹具 |
| RECOVER-04 | SH `AUTH-01/RECOVER-04 ...`持久pending/成功终态，家庭移除/token变化/账号删除，租约过期和service重建后发现/详情/recover/submit拒绝且状态不变、resource零请求 | CORE_PASS_SCOPED。结合原重登发现、显式恢复和非原actor拒绝；无新增FAILED及所有中间阶段组合，原统一授权入口保留 |
| SESSION-02 | P `SESSION-02 ...`recover403/404清理+迟到detail/command，detail拒绝+迟到recover，网络失败原UUID和新写锁 | CORE_PASS_SCOPED。7项组件直接反例，权限/epoch变异分别4/2失败；不是本轮真实浏览器验收 |

最新 **31 = 26 CORE_PASS_SCOPED + 5 PARTIAL**；剩余PUB-02、VIEW-01、WITHDRAW-01/02、MEDIA-04保持PARTIAL，未自动关闭或后置。
本批自查/独立复评和P3收尾修订的验收状态见记录；AI2-5 IMPLEMENTING、AI-2 OPEN。
历史失败、DEVICE_PENDING、T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、两项非阻断补测及全部后置状态不变。

## 11. 发布拒绝与孩子读取白名单补验

2026-11-04：§10批次及P3已获用户批准，冻结候选及最新9/7复验证据见[批准记录](auth-recovery-boundaries.md#2026-11-04-用户批准及本轮复验证据)。
本批仅两测试新增5项，开发homework AI2全部10套220通过；新反例与候选见[本批记录](publication-visibility.md)。

| 行 | 新增直接证据 | 限定覆盖 |
| --- | --- | --- |
| PUB-02 | S `PUB-02 invalid %s cannot reserve or change approved content`：错误但合法格式的childSnapshotHash、确认false；`PUB-02 real AI1 unknown job retains its reservation and cannot preview or publish`：真实AI1 create/generate/claim/markUnknown后拒绝，两类全部AI1/AI2集合不变、媒体端口零调用 | 结合§7真实连接的candidate/未批准revision、制品tuple独立拒绝、孩子旧AI1入口403及原closed/rejected等用例；source/media端口替身，无Provider。集合不变不等于数据库命令级零写，未声称所有状态组合都经真实HTTP |
| VIEW-01 | FH `VIEW-01 formal nonempty child list, attempt history and own command expose only allowed DTO keys without writes`；`VIEW-01 formal child cannot guess AI1 candidate IDs or another actor command through AI2 reads` | Gateway/homework/resource正式HTTP、真实上传/绑定/审核，非空列表/详情/Attempt/历史/命令逐层白名单，原actor原正文仍可读；猜测Cycle/Artifact ID精确404、预览403、父母命令404，持久集合不变；AI1批准状态及JWT为合成夹具。结合§7旧AI1候选403，不冒称本轮浏览器 |

独立复评SCOPED_PASS，新增5项实际通过，结合既有证据将两行归为CORE_PASS_SCOPED；最新 **31 = 28 CORE_PASS_SCOPED + 3 PARTIAL**。
开发220项与独立5项分开，详见[本批记录](publication-visibility.md)；本增量USER_REVIEW_PENDING，不能等同总门禁关闭。
新建议AI2-VIEW-NB-001仅为命令详情整对象相等断言补强，OPEN_NONBLOCKING，不回退上批P3关闭，不挤占剩余核心验收。
仍须补齐WITHDRAW-01的带订正/审核历史再发布且旧审计完整不变、WITHDRAW-02的prepare异步窗口撤回竞争，
以及MEDIA-04的AI2 commit/隐私删除真实交错与跨家庭对象不变。三项不是后置，不能用已有顺序测试代替。
原各节计数、失败、DEVICE_PENDING及全部未关闭/后置边界保持；AI2-5 IMPLEMENTING、AI-2 OPEN。

## 12. 撤回历史与隐私竞争补验

用户授权接续补验，不视为批准§11验收。三测试新增7例，开发homework224/10、resource契约53/1，
独立homework4/2、resource3/1实际通过。候选、精确命令、层次、变异、工具失败与收尾见[本批记录](withdrawal-privacy.md)。

| 行 | 补齐证据 | 最新覆盖 |
| --- | --- | --- |
| WITHDRAW-01 | FH `WITHDRAW-01 formal republication after %s preserves old attempts and audit without migrating history`，approve/revise两例；新包空历史/指针、实际再上传提交从版本1开始，旧Package/Attempt/Command/绑定/operation/Asset完整不变，旧URL和跨包旧Attempt拒绝 | CORE_PASS_SCOPED：正式三服务HTTP、合成批准AI1/JWT及真实PNG；结合已有状态撤回/旧capability拒绝，不声称所有状态组合本轮重跑 |
| WITHDRAW-02 | SH `WITHDRAW-02 withdrawal during real prepared response, commit loss=%s, retains exact mapping until cleanup`，正常/丢响应两例；prepared持久后结果交付前撤回，未知保锁，重建/off原命令恢复、完整引用精确解绑、无Attempt，原映射与审计不变 | CORE_PASS_SCOPED：签名HTTP+真实resource operation，元数据夹具；屏障位于真实client返回边界而非伪造远端成功，结合既有commit/最终CAS竞争 |
| MEDIA-04 | RC `MEDIA-04 AI2 %s wins a real snapshot conflict without mixed bindings or rewritten audit`及`MEDIA-04 AI2 cross-family deletion rejects both actors and own deletion leaves foreign objects and bytes intact`；两胜者均有真实事务重试，整组中止或精确凭证、日志不改写、跨家庭全部对象及文件字节保护 | CORE_PASS_SCOPED：真实Mongo/本地文件、JSON transport适配器不是HTTP；结合既有正式重复DELETE/教学不变/同图跨Attempt证据，不外推为本轮浏览器 |

独立复评SCOPED_PASS支持 **31 = 31 CORE_PASS_SCOPED + 0 PARTIAL**。覆盖来自既有证据与本增量，不是独立新跑31行。
§11和本批均USER_REVIEW_PENDING；AUTH批次既有批准和P3关闭保留。AI2-5 IMPLEMENTING、AI-2 OPEN。
下一步为两批验收及限定合成总门禁关闭条件核对，未获明确批准不能关闭。历史失败、DEVICE_PENDING、AI2-VIEW-NB-001、
原两项非阻断补测、T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED及后置状态全部保留。
