# AI2-1 测试设计与评审记录

> AI2-5 / AI-2最新批准：2026-11-04用户明确批准CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY。依据为已批准各批次、31项限定核心覆盖及[关闭记录](evidence/ai2-5-20261103/closure-readiness.md)，不是仅凭测试计数自动关闭；下方待审、OPEN及失败保留阶段身份，真实启用和其他门禁不变。

**Document status:** APPROVED (2026-11-03)
**Profile:** AI2-MIN-1；**Cases:** AI2-2/3/4 ACCEPTED（限定本地合成）；AI2-5汇总CLOSED / USER_APPROVED；**Gate:** AI-2 CLOSED / ENGINEERING_SYNTHETIC_ONLY。DEVICE_PENDING及其他未关闭/后置状态见关闭记录。
日期2026-11-03；本轮仅设计/API/测试文档，无业务代码、schema fixture 或测试实现。
以上为AI2-1历史范围。用户随后批准三稿及产品取舍，授权AI2-2本地合成实施；实现/验证增量见§6，矩阵未执行项不冒称完成。
依据：[设计](../superpowers/specs/2026-11-03-family-ai2-minimal-design.md)、[API](../api/family-ai2-api.md)。
设计评审通过不等于接口已存在，以下永久反例须在后续实施时编码并实际执行。

## 1. 复用方法与数据

沿用 Jest、现有 MongoMemoryReplSet 生命周期、Gateway签名身份、正式应用工厂、Testing Library及Playwright。
合成家庭A含两位共管父母/两个孩子，家庭B有父母和孩子；准备 task/mistake 两种来源、媒体-only错题、
已删除/非数学来源及已撤权家长。通过真实 AI1 流程形成原候选→人工修订→批准，Provider可用明确标注的替身。
AI2阶段计数所有DeepTutor/Provider调用、AI1预算、GrowthTask确认/StarLedger/掌握/错题写接口，预期均无新增。
无需等待模型计数、NAS或真实部署，但不得用手工伪造批准状态来代替整条验收链路。

单元/组件允许mock；事务/CAS/权限/媒体验收用真实数据库与HTTP。最终浏览器使用生产构建和正式Gateway、
homework、resource、user、analytics等实际依赖，逐项列明仍是替身的Provider/计数器，不写成付费验证。
故障注入设在持久提交前后、prepare/commit响应、最终本地事务和账号切换；原错误与修订证据分别保留。
真机iPad单独DEVICE_PENDING，不能用WebKit或触控模拟抵销。没有真实数据，不安装依赖或新增测试服务。

## 2. 永久用例矩阵

设计批准时所有行均为 PLANNED_NOT_EXECUTED；AI2-2后端子集执行情况见§6，其余仍待实施。U=单元/契约，H=真实Mongo/HTTP，C=组件，B=真实浏览器。

| ID | 场景/操作 | 必须断言 | 层级/批次 |
| --- | --- | --- | --- |
| AI2-PUB-01 | task/mistake来源，原候选修订批准后预览发布 | 同孩子、精确id/version/hash、完整孩子预览；一包一命令，AI1不自动发布 | H/B 2/4 |
| AI2-PUB-02 | candidate/rejected/closed/unknown、假hash、未确认可见内容 | 拒绝且无Package/媒体/模型副作用；孩子经旧AI1接口仍被拒 | U/H 2 |
| AI2-PUB-03 | preview后AI1关闭/审核变化；两家长同源并发发布 | 跨集合事务写冲突保护+活动唯一索引；一个胜者，旧预览409，不自动重试新版本 | H 2 |
| AI2-PUB-04 | 原题/标题更新、源404/503 | 新发布失败/依赖错误；已发布快照不被替换，历史sourceAvailability准确，无跨库写 | H/C 2/4 |
| AI2-VIEW-01 | 孩子列表/详情/Attempt/媒体/命令；猜测其他候选ID | 仅白名单；无parentContext/answerText/费用/Job/其他候选/存储路径，未发布不可见 | U/H/B 2/4 |
| AI2-AUTH-01 | 匿名、过期/PIN重置、兄弟姐妹、跨家庭、共管被移除；携旧URL直读正文 | 读写及幂等重放实时拒绝；新正文需Bearer+capability，旧匿名路径对新purpose拒绝；无私有输出/业务变更 | H/B 2/3/4 |
| AI2-WITHDRAW-01 | 各学习状态撤回、旧capability、同key重放、再次发布 | 孩子404/隐藏；旧Attempt审计保留，家长可读；新包新ID，无旧Attempt迁移 | H/B 2/4 |
| AI2-WITHDRAW-02 | 提交prepare/commit/最终CAS与撤回竞争 | 撤回胜出无新可见Attempt；真实COMMITTED先读本地结果再精确解绑，不误删已发布引用；清理未知保锁 | H 3 |
| AI2-ATTEMPT-01 | 初次提交→退回→再次提交→通过 | 版本严格增加，旧正文/图片/review不变，当前指针正确，无掌握/错题/奖励写入 | H/B 2/4 |
| AI2-ATTEMPT-02 | 零图、11图、重复/稀疏IDs、错误类型、note边界 | 1/10合法、0/11拒绝；无占位/远端写；父母代录拒绝，不信客户端actor/version | U/H/C 2/3 |
| AI2-ATTEMPT-03 | submitted/approved/withdrawn再次提交，两个提交并发 | 一个活动命令；非法状态拒绝，不覆盖待审核内容或历史，唯一版本索引保护 | H 2 |
| AI2-REVIEW-01 | 未查看新版、旧版本/hash、两位家长同UUID/不同UUID审核 | 一个CAS胜者；首次review及真实actor不变；前端409后重看，无自动确认 | H/C/B 2/4 |
| AI2-REVIEW-02 | revise空反馈、重复审核、审核提交未知/成功丢响应 | 空反馈拒绝；相同key返回原结果，异正文409；审核/Package/命令原子，终态不回退 | U/H 2 |
| AI2-ACK-01 | 媒体持续缺失/异常时退回、撤回及重放；approve预检后媒体异常 | 写确认仅持久结果，不二次读取媒体；GET详情仍报真实错误，不伪造可用性，原审计只写一次 | H 2 |
| AI2-REVIEW-03 | 审核前图片删除/不可用、503；审核后正常删除 | approve拒绝或503未写，revise可保留反馈；事后删除不改旧review/学习状态/奖励 | H 3 |
| AI2-IDEM-01 | publish/submit/review/withdraw同key异正文、不同actor同UUID | 摘要闭合、命令隔离；仅CAS合法者生效；remote ID不等于用户UUID，不串用原actor | U/H 2/3 |
| AI2-RECOVER-01 | 占位提交后进程重建，prepare/commit成功后分别丢响应 | 原payload/AttemptID/remoteID完整持久；PREPARED/COMMITTED可续接，同引用集同代次，无新UUID | H 3 |
| AI2-RECOVER-02 | 本地最终事务回滚/提交未知；旧owner A失租读到尚无Attempt，新owner B随后成功；补偿CAS与成功交错 | A零abort/unbind；B成功引用仍bound；仅持久RESOLVING胜出才可清理且永不能再发布；转换未知先读回、owner接续仍只清理，无重复Attempt | H 3 |
| AI2-RECOVER-03 | 缺引用、多引用、错hash/type/field/binding、终态矛盾/远端503 | 拒绝/保持未决，不把缺失当删除；GET零写，RESOLVING未确认前不清锁 | U/H 3 |
| AI2-RECOVER-04 | 重登发现未决及成功丢响应命令；共管恢复别人命令；无记录 | 仅原actor显式恢复；终态可发现；无记录不自动POST/解锁未知提示；撤权仍拒绝 | H/C/B 3/4 |
| AI2-RECOVER-05 | 包已撤回后原actor查命令/恢复，另一个actor猜测命令ID | 只给本人最小状态、无旧正文；仅abort/精确清理，不复活包；他人拒绝 | H/C 3/4 |
| AI2-MEDIA-01 | 1/10图片、10MiB及多1字节、伪MIME、PDF/HEIC、错purpose/孩子 | 真实内容校验、上限与profile有效，不能借旧任务字段绕过；原任务/错题PDF回归不变 | U/H/C 3 |
| AI2-MEDIA-02 | 多图部分失败，取消选择/离开/未知响应 | 成功项保留；失败须处理后提交；普通移除不DELETE，不自动清理孤儿 | C/B 3/4 |
| AI2-MEDIA-03 | 本人未绑定、prepared、历史released、撤回、混合可见绑定；切身份后同一capability | 只有从未绑定本人预览例外；至少一个可见已提交引用才可读；新正文根据实际读取者而非上传者核验，匿名/失效身份拒绝，未知/超限/503失败关闭 | H 3 |
| AI2-MEDIA-04 | 同图跨Attempt，删除与commit竞争、重复DELETE/丢响应 | 整组证据、首次删除审计、精确代次和正文拒绝闭环；未删除其他家庭对象，不改教学/奖励 | H 3 |
| AI2-MEDIA-05 | 正常解绑与删除凭证混淆、删除后提交恢复、旧日志混合 | 仅精确墓碑+凭证允许deleted投影；缺证据保持阻断；旧摘要/终态不变，不运行高级恢复 | U/H 3 |
| AI2-SESSION-01 | 退出/坏JSON暂存、换孩子/账号/跨标签、迟到成功与迟到401 | DOM/blob/暂存清理，旧响应不能污染新身份或退出新会话；原服务端命令保留 | C/B 4 |
| AI2-SESSION-02 | 当前身份详情/恢复403、404后迟到成功；普通网络失败 | 拒绝优先清私有视图且封旧请求；网络失败保留原命令重试，不能误放行新提交 | C/B 4 |
| AI2-OFF-01 | 默认off、运行中关闭、新prepare竞争、已COMMITTED恢复 | 新发布/提交/审核及新用途上传拒绝，旧用途不受影响；在途按定义收敛；无新prepare/commit，历史读/撤回/隐私删除有效 | H 2/3 |
| AI2-OFF-02 | 缺索引/事务/凭据/日志/guard、旧服务、不明恢复连续性 | 启用失败关闭；新数据不得旧版本写；保持维护隔离，不拿NAS/计数待验伪造通过 | startup/H 3/5 |
| AI2-FLOW-01 | 合成原AI1批准→发布→孩子学习订正→家长退回→再提交→通过→回看 | 正式HTTP/生产构建闭环；来源/版本/审计一致，provider/费用/星星/掌握计数零新增 | H/B 5 |

实现后每项附测试名/命令/结果引用即可，不为每个ID创建独立审查或证据目录。
关键修复先保留可复现失败，修复后运行同一永久反例；缺环境如实记NOT_EXECUTED，不删断言或增加超时掩盖失败。

## 3. 执行与验收分层

- AI2-2/3：受影响 homework/resource/common/Gateway 测试，真实副本集事务及提交竞争；不是mock事务通过就算完成。
- AI2-4：前端API/组件测试；共享会话或媒体改动扩大至所有受影响调用方，含已有任务/错题图片及PDF。
- AI2-5：`npm run test:family-regression`、`npm run test:ci --prefix frontend/web -- --runInBand`、
  `npm run build --prefix frontend/web`；新浏览器场景加入现有自主学习测试入口，Chromium/WebKit结果分别记录。
  HTTP/浏览器用真实源/媒体/权限；合成Provider只负责前置AI1制品，AI2期间明确零外部调用。
- 文档：`npm run docs:family:check`、`git diff --check`；新三稿本轮另人工/静态对照，旧校验器没有自动证明AI2语义。
- 目标机/iPad/备份恢复/真实发送单独验收。未授权Git clean/完整发布所需提交时记录前置限制，不擅自提交。

工程完成需矩阵实际覆盖、重要缺陷修复、相关回归/正式浏览器通过并完成独立评审；总门禁关闭仍待用户批准。
不把模型替身/模拟触控/文档通过写成真实发送、iPad或家庭价值完成。

## 4. 本轮需求覆盖与设计自查

| 目标要求 | 设计/API依据 | 待实施测试 |
| --- | --- | --- |
| 批准、发布、撤回与历史 | 设计§1/3/4，API§3 | PUB-01..04、WITHDRAW-01..02 |
| 白名单、家庭孩子隔离 | 设计§3/6，API§1/3/5 | VIEW-01、AUTH-01、MEDIA-03 |
| 双来源、版本与人工审核 | 设计§3/4，API§3/4 | ATTEMPT-01..03、REVIEW-01..03 |
| 图片、隐私删除与失败 | 设计§5/6，API§4/5 | MEDIA-01..05、RECOVER-01..03 |
| 未知结果、重登/账号隔离 | 设计§5，API§2/4 | IDEM-01、RECOVER-01..05、SESSION-01..02 |
| 默认关闭、回退与范围 | 设计§7/8，API§6 | OFF-01..02、FLOW-01 |

作者自查：发现 publish 仅跨集合读 AI1 状态不能与关闭互斥，已明确同事务条件写保护；
发现撤回后原actor无法读包却仍需清理未决命令，已分开最小命令状态与包正文权限；
发现孩子历史released媒体不能退回“未绑定本人预览”例外，已写入媒体权限及反例。
上述均为设计修订，不冒称漏洞已实现、测试已通过。

## 5. 独立评审及本轮验证

2026-11-03，独立评审者 Laplace 只读核对三稿及关联实现，发现两项 P1；修订后由同一评审者聚焦复核。
复核结论：两项在设计层关闭，本次修订范围内未发现新增阻断性 P1/P2；不代表实现或运行验收通过。

| 问题 | 修订与计划保护 | 状态 |
| --- | --- | --- |
| 旧匿名正文 capability 无法验证当前读取身份 | 新 authenticated-content 路径校验当前身份与 capability；旧匿名路径拒绝新用途，认证取 blob；AUTH-01、MEDIA-03覆盖旧URL/失效会话/实际读取者 | CLOSED_DESIGN，实施待验 |
| 失租旧owner可能解绑新owner成功提交的引用 | 失租者零清理；事务CAS先进入不可逆RESOLVING，与SUCCEEDED互斥；转换未知先读回，RECOVER-02覆盖交错及接续 | CLOSED_DESIGN，实施待验 |

作者自查通过：三稿10个本地链接目标存在，1个JSON请求示例可解析，30个用例ID唯一、Markdown代码围栏闭合；
`node scripts/check-family-docs.js` 与 `git diff --check` 通过。现有状态检查器并未覆盖新AI2全部语义，
不能把既有契约探针的计数当作本轮AI2接口验收；语义一致性由本轮人工自查和独立评审核对。
最终文档回归命令为 `jest --config=backend/jest.family-common.config.js --runInBand --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js`，
使用已有Node 22及依赖执行：1 suite / 313 passed，0 failed / 0 skipped，exit 0，39.032秒。
本机结果 `/private/tmp/ai2-1-doc-gate-final-20261103.json`，SHA-256
`d453c67ee0c54b20f0372c428589c43543cc515782d8db695ae6f7e692a8ab4c`；这是临时本机验证记录，不冒称永久归档或AI2运行证据。
本轮不冻结业务候选、不创建测试框架，不改变既有T8代码或证据。
所有矩阵测试仍PLANNED_NOT_EXECUTED；设计交付后等用户批准再编码。

保留 T4/T8/AI-1 OPEN、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、两项非阻断补测及
高级恢复/新回收 REMAINDER_DEFERRED、T9 NOT_STARTED；本轮不关闭任何工程总门禁。

## 6. AI2-2 批次

2026-11-03用户批准AI2-1设计/API/测试及§1取舍，两项P1设计修订经复审通过，状态CLOSED_DESIGN；运行保护仍须分批验证。
本批实现学习包、Attempt/命令模型、发布/撤回/审核事务及只读投影；独立HTTP工厂验证，不挂正式server/Gateway。
AI2-3媒体提交、认证正文及不可逆补偿运行验收尚未实施；本批不能直接构造成功媒体来冒充完整提交验收。
默认关闭；仅临时副本集合成数据，不调用Provider，不提交推送部署，不关闭AI-2总门禁。

### 6.1 实现与覆盖边界

- 新增Ai2模型、闭合命令校验、事务/索引只读就绪检查、事务服务及独立HTTP路由工厂；现有homework/server、Gateway和resource未修改。
- 实现预览/发布、包/历史/原actor命令读取、撤回、按所见版本审核与本地终态重放；不提供submit/recover路由，不能绕过AI2-3。
- 服务默认enabled=false；新发布/审核拒绝；历史读取仍鉴权，连续存储已确认时允许撤回。缺唯一索引拒绝写，不自动创建/修复索引。
- AI1前置测试经过真实create/generate/claim/人工修订/review服务；生成结果是显式本地outcome夹具，未调用DeepTutor/Provider。
- 审核测试的已提交Attempt为数据库夹具，mediaReader为只读替身；验证本地审核事务，不作为真实绑定、认证正文或完整订正闭环证据。
- HTTP使用本机回环TCP、正式签名身份中间件/错误处理器和真实临时Mongo副本集；未经过正式Gateway装配，不代表JWT登录或浏览器验收。
- 原命令测试覆盖真实socket断连、服务实例重建、终态发现/重放；本批没有远端operation、补偿或租约恢复实现。

现行矩阵共31项。PUB/VIEW/AUTH的本批后端子集、REVIEW、IDEM、本地事务未知、OFF索引与默认关闭已执行；
涉及媒体/提交/页面/真机的行仍为部分覆盖或PLANNED_NOT_EXECUTED，不把整行批次2/3/4标记全完成。

### 6.2 自查与独立评审

独立评审者Noether只读检查当前代码、契约及测试，发现1项P2：业务提交后响应/重放再次读取媒体，
导致持续媒体故障时已成功的退回/撤回一直返回失败。作者新增3个反例，先3 failed，再改为同库持久确认摘要；
API§3明确写确认与详情分开，不伪造media可用性，首次approve仍执行媒体预检。
同一评审者聚焦复核确认P2已修复，本次修订无新增阻断性P1/P2；属于静态复核，不冒称评审者独立复跑。
自查另发现空持久图片集合可被批准，永久反例先1 failed后通过；增加1–10唯一媒体及完整绑定/摘要检查。
审核事务回滚/未知提交、AI1关闭与发布两种胜者、撤回与审核竞争、只读零写已补永久测试。
上述FIXED_REVIEWED为送审历史。用户复审通过并批准AI2-2批次验收后，本次成功确认依赖媒体P2关闭为CLOSED；两项AI2-1 P1仅CLOSED_DESIGN，认证正文/补偿运行保护仍待AI2-3。

### 6.3 当前证据

定向测试3 suites / 33 passed，0 failed/0 skipped；现有文档回归1 suite / 313 passed，0 failed/0 skipped。
ESLint按现有规则增加AI2文件覆盖，未放宽规则；相关文件lint、文档状态检查通过。
首次HTTP运行4项断言通过但logger写沙箱日志遭EPERM，suite失败；保留该记录，随后在已授权本机执行上下文完成验证。
真实断连故障注入首次错误使用挂载后req.path未触发，保留1 failed记录；改用originalUrl，保留ECONNRESET原断言后通过。
定向红灯中的模块缺失、1项自查失败和3项评审失败分别保留，不包装成已经执行的产品验收。
受影响homework全量回归：`jest --config=backend/services/homework-service/jest.config.js --runInBand`，
41 suites / 1519 passed，0 failed/0 skipped，exit 0，214.139秒。包含AI1及既有完成/确认/求助/清单/媒体协议，
按既有项目配置执行，未新增跳过；不是其他家庭服务、前端或全仓回归。保留既有Mongo driver弃用警告，不修改规则掩盖日志。
代码候选仅10个源码/测试/配置文件，补丁及原始日志归档在本机忽略目录；见[批次索引](evidence/ai2-2-20261103/README.md)。
代码哈希核对、文档本地链接、`check-family-docs.js`、`git diff --check`通过；当前AI2-2 READY_FOR_ACCEPTANCE，
以上为送审历史，随后用户批准本批限定本地合成验收。AI2-2 ACCEPTED；AI2-3 IMPLEMENTING，AI2-4/5 NOT_STARTED。
本轮独立复验重新执行3 suites / 33 passed、0 failed/0 skipped，17.407秒；结果为
`/private/tmp/ai2-2-review-targeted.json`，与冻结补丁及10个代码文件哈希核对一致。
冻结补丁SHA-256 `071e5d390662a3c3b637567789d7c90513466396ee592be212954368a34ec46b`；
原始1519项服务回归及313项文档回归为归档核验，不写成本轮独立重跑。
认证图片读取、持久提交/租约补偿及完整页面闭环不能据此记为通过，AI-2 OPEN。

## 7. AI2-3 批次

用户批准AI2-2及成功确认P2关闭后，授权本批本地合成实施。复用原媒体事务、journal/UploadGuard、只读预检和Jest，
不新增服务/恢复框架，不调用模型、不提交推送部署；正式server/Gateway、前端、真机与AI2-5整体装配仍未验收。

### 7.1 实现及证据边界

- 新增严格AI2 type/field/purpose分支和common client响应校验；旧growth_task摘要、上传metadata hash和删除日志保持兼容。
- 子女submit占位保存原payload、随机remoteOperationId、预分配Attempt、完整绑定和摘要；owner/phase CAS、majority结果读回，
  补偿必须先持久进入不可逆RESOLVING。只有精确收尾确认后才能FAILED并解锁；off不发送新prepare/commit。
- 内部media-access-check只读、服务凭据保护、最小allowed响应。认证正文同时验证签名身份、capability、当前家庭/孩子tokenVersion及可见绑定，旧匿名正文拒绝新purpose。
- 图片真实重编码、安全profile、持久上传日志/Guard、整组隐私删除、精确Receipt和30天正常保留清理已纳入本地测试；新孤儿回收仍关闭。
- homework提交单元组使用真实副本集事务，权限helper/媒体client可为显式替身；另有真实TCP homework→resource operation的提交/丢响应/撤回恢复用例。
- resource图片组使用真实图片字节、multipart/正文HTTP、文件存储及resource→homework内部HTTP；scanner拒绝与故障响应为受控替身。
  媒体inspect为独立工厂直接注入真实resource服务，不宣称已具备跨进程metadata transport；正式装配留AI2-5。
- 本批HTTP直接使用可信签名身份信封，不是Gateway JWT登录或浏览器验收。无奖励/掌握/错题状态写入能力。

### 7.2 自查、评审及修复

自查发现规范命令保留调用方数组引用；永久反例1 failed后改为规范化独立数组快照并通过，原稀疏/重复/闭合校验保留。
独立评审Parfit与Fermat均发现混合引用P2：正常未发布Attempt引用会否决同图另一合法published引用。
修订为仅跳过可验证的持久未发布映射，不授予权限；3项阶段反例先失败后通过，加入顺序交换、仅未发布、未知裸引用和损坏摘要拒绝。
Fermat另发现Asset清理后deleted占位P2：墓碑/Receipt存在但缺MIME/大小，详情被错误拒绝。
修订为仅AI2墓碑/日志保存不可变MIME/大小，读取仍需当前身份和精确凭证；实际上传/绑定/删除/清理后的正反例验证，不扩展高级恢复。
另补off与在途commit交错：abort观察到COMMITTED后仍沿已持久RESOLVING精确收尾，清理未确认前保锁。
单独固定未装配隔离：独立工厂默认off，即使全局环境变量enabled也不能越过正式装配前置要求。
submit已持久FAILED的200确认语义为本批显式响应契约补充，不是业务成功；API已区分201/202/200及错误响应，原断言保留。

Parfit与Fermat已针对修复源码及反例完成独立聚焦复核，无新增P1/P2阻断；两项本批P2为FIXED_REVIEWED，
尚待用户批次验收，不自动标为CLOSED。独立复核没有重跑完整数据库/HTTP回归，执行证据与评审结论分开归档。
resource家庭回归的显式清单已追加两个新权限测试，原45个条目未删除；不依赖人工指定文件才运行新反例。

### 7.3 验证与冻结

最终homework专项4 suites / 60 passed，涵盖闭合命令、提交恢复、只读内部权限及真实HTTP；
resource新权限专项2 suites / 49 passed，使用既定resource-family配置。均0 failed/0 skipped，exit 0。
homework服务回归44 suites / 1576 passed，0 failed/0 skipped，exit 0；随后最终HTTP失败重放断言另以60项专项复验。
resource worker末轮7 suites / 160 passed为可核验JSON；另一worker的4 suites / 194 passed只在工具输出中，
不冒称另有落盘原始日志，也不与重叠套件累计成独立覆盖数。
既有文档回归1 suite / 313 passed；49个本批相关JS文件按原ESLint配置检查通过，未放宽规则。

保留首次模块缺失、数组别名和混合引用红灯、fixture不完整、旧配置误用失败，不能把失败历史改写成全绿。
误用resource-service/jest.config.js的运行先遭相对依赖缺失，随后全局Mongo setup与用例自管连接冲突；
停止该次运行exit 130，保留日志；没有修改setup、跳过测试或增加超时来迎合错误入口。
改回项目既定jest.family.config.js并复验；本工作树仅临时链接已有依赖，没有安装包。

resource既定家庭回归最终45 suites / 1931 passed，0 failed/0 skipped，exit 0，429.853秒。
该进程启动时读取原45项清单；随后新增两套另以同一配置执行49项全通过，不能写成单次47套运行。
最后补强HTTP重放pending:false及command无payload断言，1 suite / 3 passed，4.762秒，独立只读复核无新增阻断。
49个源码/测试/配置文件累计候选已从基线补丁重建，逐文件哈希一致；日志、失败与独立评审摘要归档见
[AI2-3批次索引](evidence/ai2-3-20261103/README.md)。当前AI2-3 READY_FOR_ACCEPTANCE，AI2-4/5 NOT_STARTED、AI-2 OPEN。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED不变。

### 7.4 两项永久反例P2补强（2026-11-03后续）

前次独立复审确认§7.2两项业务P2修复有效，但发现两项测试保护P2：owner不变且租约已过期、
以及prepare/commit最后一次owned异步窗口内切off，均未被原44项永久用例独立保护。
复审临时变异分别移除租约条件/末次模式检查，原44项均通过；三个临时探针在原实现47通过、变异后3失败。
这些是测试覆盖缺口，不把当前业务实现描述为已存在越权或重复发布漏洞。

用户授权仅补测试和文档。本次只在`ai2Submission.test.js`新增三个永久例，删除新增块后原文件逐字节不变，
原44项断言、辅助函数和生命周期设置完整保留；旧49文件候选中的其他48个文件哈希不变，生产逻辑未改。

- 租约例：实际commit结果已COMMITTED后扣住响应，保持owner不变并推进时钟超过租约；旧执行者不发布、不补偿、不续租，
  保留包锁，再由原命令显式恢复，核对原远端ID/请求与引用摘要/完整绑定不变，仅一个Attempt且不重发prepare/commit。
- prepare/commit两例：在各自最后一次owned鉴权窗口等待，切off后释放；目标写调用为零，
  保留原命令映射和未决锁。租约过期后显式恢复才abort并FAILED解锁；不声称恢复全过程没有远端写。
- 独立评审Raman发现新增测试异常路径可能释放后未等待submit结束；已将屏障等待纳入try、
  使用Promise.race识别submit提前结束，并在finally中release且await提交结束。修订只限新增测试。
  临时故障注入两处屏障内异常及一次屏障未触达，逐例活动计数均归零；3例按预期失败，原44例通过，
  失败原因分别为注入异常/明确barrier error，而非超时；日志没有unhandled rejection。

最终相关回归4 suites / 63 passed，0 failed/0 skipped；单文件47项包含原44项及新增3项。
既有homework1576、resource1931及其他历史结果仅保留/核验归档，本轮未重跑，不宣称当前全仓全绿。
最终逐项变异及独立复核、冻结哈希见[批次索引后续P2记录](evidence/ai2-3-20261103/README.md#永久反例p2后续候选)。
最终逐项变异分别得到1 failed / 46 passed（移除租约条件）及2 failed / 45 passed（移除末次模式检查），
失败均命中新增例的业务断言，非超时。独立评审Raman复核最终源码、JSON及合并日志通过，无新增阻断性P1/P2；
这是独立源码/执行证据复核，不冒称评审者重新执行了主线程测试。
本轮两项测试P2及测试异常收尾意见为FIXED_REVIEWED，待用户复审，未自动关闭；
AI2-3 READY_FOR_ACCEPTANCE，AI2-4/5 NOT_STARTED、AI-2 OPEN。
原冻结补丁、失败日志与历史审批保持；仅本地合成验证，不调用模型、不提交推送或部署。
最终ESLint、链接/围栏、diff与现有文档状态校验通过。文档检查首次误用默认Node26且未指定已有依赖，
因dotenv无法解析而exit1；保留日志，改用已有Node22及NODE_PATH后exit0，未安装依赖或修改校验规则。

### 7.5 用户验收与独立复验

用户复审通过并批准AI2-3限定本地合成批次验收；本次两项测试保护P2（不变owner失租、末次owned切off）CLOSED。
绑定累计补丁`e26e219e73281872d4ec4460f4075cb838d7d845bc97bb9cdb66f831b7dafec0`与
候选清单`180b4e5875e1b04714b947dee46d9f9ad924c805a131d9318127bf1722d00621`。
本轮独立重建49文件并核验40证据/3文档，只有测试新增77行；原44例及其余48文件不变。
独立执行4套63通过、租约变异1失败/46通过、模式变异2失败/45通过、收尾探针3预期失败/44通过；
恢复候选后47通过，均无skip。ESLint、diff及现有文档状态校验通过。
Newton另行静态复核无新增可行动问题，静态意见与主线程独立运行结果分开记录。
复验证据归档`release-gate-artifacts/ai2-3-p2-review-20261103/manifest.json`，旧证据不覆盖；
HTTP为独立正式路由工厂与回环请求，非Gateway/浏览器整体验收；媒体client替身反例不冒称真实远端竞争。
历史全量未重跑，AI2-3 ACCEPTED、AI2-4 IMPLEMENTING、AI2-5 NOT_STARTED、AI-2 OPEN。

## 8. AI2-4 页面批次

已批准范围：家长批准详情到精确孩子预览/发布/撤回/订正审核，孩子列表/讲解/图片订正/反馈历史，
原actor命令发现与显式恢复、认证blob及身份清理。复用现有会话、Jest/Testing Library及构建工具；
不修改AI2-3业务逻辑、不装配正式服务、不调用模型，正式闭环留AI2-5。
本批关键反例：未知结果不换UUID、重登只读发现；403/404拒绝清私有内容且隔绝迟到响应；
原版本审核冲突必须重看；部分上传成功保留但失败未处理禁止提交；退出清坏JSON暂存；blob回收。
当前IMPLEMENTING，执行结果、修复和独立评审将在本节追加，不提前关闭AI-2。

### 8.1 页面交付与永久反例

上述IMPLEMENTING为开工快照，当前AI2-4 READY_FOR_ACCEPTANCE。新增16个前端相关文件的变更，
AI2-3冻结候选49个文件哈希全部不变；未接入正式后端/Gateway，不新增模型调用或恢复框架。
家长从已批准AI1详情进入精确孩子预览并显式发布，可分页查看、撤回、按所见Attempt版本/hash审核；
通过审核必须实际读取当前认证图片，退回需要反馈，冲突清详情后重新查看，不自动审核新版本。
孩子从今日页进入学习包，读取发布快照、上传1–10张合法图片并提交、查看当前/历史订正与反馈；
submitted/approved只读，deleted保持占位；普通移除与隐私删除分开，未确认删除不能伪造墓碑。
部分上传成功保留，失败需显式重试或忽略，PDF/HEIC/超限/重复拒绝，不改变既有任务/错题/PDF控件。

原命令按role/actor/family/child保存在sessionStorage，失败不换UUID；刷新/重登只读发现、显式恢复，
列表无记录不等于失败，坏JSON不能被覆盖，主动退出/换身份清理；当前身份拒绝优先于请求序号过滤。
新submit先读权限但保留原版本，读错误不当作写确认；重放和终态recover不依赖已撤回正文可读。
GET确认有正文且匹配的原命令终态也清理旧详情/草稿并废弃旧读请求；无正文时保留显式recover通道。

### 8.2 自查及独立评审

页面/API/store由Erdos复核，媒体由Schrodinger交叉复核，API/store另由Poincare交叉核对。
评审是源码及执行证据只读核验，不冒称评审者重跑全量或真实HTTP。修复与永久反例如下：

| 问题 | 修复及永久保护 | 当前状态 |
| --- | --- | --- |
| P1 同会话恢复焦点未核验权限 | focus/pageshow/visibilitychange只读刷新；403/404清正文并隔绝迟到读成功 | FIXED_REVIEWED |
| P2 家长详情未绑定所选孩子 | 当前孩子分页列表归属核验；裸URL切孩子、错误包/child参数、第二页均覆盖 | FIXED_REVIEWED |
| P2 GET确认终态保留旧可写视图 | 复用终态清理与epoch；旧草稿/图片清空、迟到GET不能恢复提交资格 | FIXED_REVIEWED |
| P2 迟到写成功夹具不完整 | 补完整endpointOperation与结果引用，403/404后原命令不清、无成功提示/链接 | FIXED_REVIEWED |
| P1 被替代媒体预览的拒绝被忽略 | 同scope拒绝优先；access/content×403/404、换scope/身份及普通503共9例 | FIXED_REVIEWED |
| P2 预读错误被当写确认 | dispatched区分读/写错误；读409保留原命令、禁止新命令，未再次POST | FIXED_REVIEWED |
| P2 撤回后裁剪正文阻塞原命令收尾 | 原UUID/body重放独立于正文；终态无payload仍可显式recover；预读不升级版本 | FIXED_REVIEWED |

最终页面28项通过；六处临时副本变异分别触发2/1/3/1/1/1项预期失败，均命中对应断言，不是加载错误。
媒体组件52项通过；拒绝优先变异命中4项预期失败、另5项通过，其余43项未选中，不计作通过。
工作区不应用变异，原跨身份/范围隔离保持。上述本批问题待用户复审，不自动CLOSED。
另修复未知命令ACK的action匹配、正文key顺序比较、scope变更瞬间隔离及历史重复key，均有页面用例。

### 8.3 验证范围与历史失败

前端既定非legacy全量63 suites / 996 passed / 0 failed / 0 skipped；包含会话、既有任务/错题/PDF、AI1及本批新增测试。
最终仓库级ESLint发现新增两测试文件使用global的23项no-undef；仅改为globalThis，不放宽规则/断言，
两文件再定向2套95项通过（0失败/跳过），最终仓库级15个JS文件lint exit0。全量996证据在这项纯测试标识修订前取得，不伪称相同文件哈希。
期间另一次全量在机械修订前启动，保留为过渡运行，不代替最终两个受影响文件的定向验证。
CI=true生产构建通过，保留Browserslist数据陈旧提示，未安装/升级依赖。

本机Chromium生产构建验证：家长预览发布、孩子上传并提交、刷新等待审核、家长实际图片load后按版本审核、
孩子刷新回看反馈且只读；1366×900、820×1180触控模拟、390×844均无横向溢出，截图已人工查看。
写入publish/submit/review各1次，图片upload1次、认证读取2次，0未知API/0外部请求/0控制台警告或错误。
所有后端API均为明确Playwright合成替身，不是真实服务权限验收；本批未新增真实HTTP证据，不替代AI2-5。
浏览器、回环服务在finally关闭；模拟触控不等于真机，DEVICE_PENDING保持。

保留模块缺失、fixture/时序、评审red、构建lint及早期全量973通过/1失败的原始记录；后者是既有
TaskHelpPanel长Unicode输入用例超原5000ms，未增超时/删断言，串行全量该用例通过。
不能将本轮前端通过写成全仓/发布全绿；后端历史全量未重跑，AI2-5正式装配、metadata transport、
Gateway真实权限与正式浏览器闭环仍NOT_STARTED。冻结补丁、命令和逐文件哈希见[AI2-4索引](evidence/ai2-4-20261103/README.md)。
T4/T8/AI-1/AI-2 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED及T9 NOT_STARTED不变；没有模型调用、提交推送、部署。

### 8.4 普通刷新与草稿媒体生命周期 P2

用户复审发现共享mediaEpoch使部分上传失败队列在手动/focus详情刷新后丢失，提交锁错误解除。
本轮分离草稿稳定身份scope与只读作品view刷新scope，只读所见审核保护保持；不改后端及原命令协议。
新增真实页面+真实媒体组件的永久反例：手动刷新、focus刷新均保留成功项/失败重试/提交锁，
响应落地后断言、显式忽略才解锁；403拒绝及切换孩子清理草稿并拒绝迟到详情成功。
旧实现2红/2绿，新实现4绿；6套定向214通过，新前端全量64套1000通过，0失败/跳过。
恢复共享epoch的临时变异触发两提交锁反例，2失败/2通过，副本已还原；不放宽原断言。
新生产构建、lint及两种刷新/原完整闭环的API替身浏览器通过，不等于正式HTTP验收。
独立复跑3套84通过；旧页面2失败/2通过，六临时生命周期探针6通过，恢复候选后2套10通过，
不将重叠用例相加，临时探针不冒充永久覆盖。当前FIXED_REVIEWED、待用户复审，不提前CLOSED；冻结66文件候选及独立复核记录见
[P2修订索引](evidence/ai2-4-20261103/draft-refresh-p2.md)。历史996与最后95复验不覆盖，
原失败、DEVICE_PENDING、未关闭/后置范围保持；AI2-4待批次验收、AI2-5 NOT_STARTED、AI-2 OPEN。

### 8.5 用户批准与最新主线程复验

2026-11-03用户批准AI2-4限定合成批次验收、草稿刷新P2及本批其他已复审P2限定关闭，授权开始AI2-5。
AI2-4 ACCEPTED、草稿刷新P2 CLOSED / USER_APPROVED、AI2-5 IMPLEMENTING；上文送审状态/修复表为历史快照。
绑定66文件候选`b1a52ef373fe8df1b3a7299e62be7c38f88786720cc674c549058805e63b9dc3`，旧manifest/patch不改。
最新主线程`ai24-p2-review-8PwilZ`复验4套90通过（28+52+4+6）；临时旧行为变异2失败/2通过，
两失败均为手动/focus刷新响应落地后提交锁断言；还原后2套10通过（永久4+临时6），全部无skip。
本次没有新构建/浏览器运行，不与独立84或历史全量1000相加；文档更新者核对产物，未重跑这些测试。
新review子目录及逐项哈希绑定见[批准与复验记录](evidence/ai2-4-20261103/draft-refresh-p2.md#用户批准与最新主线程复验)。

## 9. AI2-5 正式应用接线

状态IMPLEMENTING，仅按既有设计§7落实正式应用装配；以下是待实现/验证范围，不是通过记录。
本次仅更新文档，主线程随后另补实际代码、命令、结果和评审；不新增审批框架，不运行模型/Git/部署。

| 正式接线边界 | 本批待验证 |
| --- | --- |
| 模式及连续仓库 | `AI2_MODE=off|enabled`默认off；`AI2_STORE_CONTINUOUS`默认false。enabled及安全关闭后保留的历史读取/撤回/恢复/删除均要求连续性true且`COMPLETION_PROTOCOL_MODE=enabled`；缺失/false不得回退旧协议 |
| 启动及维护隔离 | 两服务必需事务/索引就绪，模型绑定正式connection；启用依赖缺失启动拒绝，连续性不明或completion maintenance保持隔离，不用普通recover解除 |
| Gateway与homework | `/api/ai2`正式JWT/签名身份代理、原始解压后UTF-8 JSON限32 KiB；homework挂载正式公共路由及受服务凭据保护的内部media-access-check，拒绝伪造/缺失身份、超限和未知字段 |
| resource metadata | `POST /api/internal/media/ai2/inspect`，沿用`MEDIA_REFERENCE_SERVICE_TOKEN`，请求`{familyId,childId,identity,mediaIds,bindings}`，响应`{success:true,data:{items:[{mediaId,mimeType,sizeBytes,status}]}}`；实时身份/家庭/孩子/绑定检查，禁路径和正文bytes，拒绝/依赖异常不得变成功 |
| 原命令和旧用途回归 | off不新prepare/commit，保留精确收尾及原映射；旧task/错题/PDF协议不变，私有正文仍走认证入口，未知结果/拒绝路径/维护隔离必须覆盖 |
| 正式闭环与交付 | 正式HTTP及浏览器闭环、相关回归/构建与收尾验证待执行；区分API替身与正式服务、主线程与独立复验，不预写通过或真实家庭效果 |

metadata接口完整边界见[API§5.1](../api/family-ai2-api.md#51-ai2-5-正式metadata-inspect接线契约)。
AI-2/T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED与T9 NOT_STARTED不变。

### 9.1 正式接线候选及异步隔离复核

§9上方为开工快照。本批已实现Gateway/homework/resource正式装配、默认关闭与连续性/维护隔离、
内部metadata transport及真实服务权限回查。首次85文件候选的独立复核发现异步读取后连续性P2，
现已补四处最终返回检查、六个永久反例及逐处变异，独立复验为FIXED_REVIEWED，待用户复审。
修订后86文件累计候选及实际测试明细见[AI2-5本批索引](evidence/ai2-5-20261103/README.md)。
原AI2-4的17个前端文件哈希不变，不把上批组件/API替身浏览器写成本批正式浏览器证据。
AI2-5仍IMPLEMENTING、AI-2 OPEN；正式浏览器及对应前端回归/构建和最终工程验收仍待完成。

### 9.2 正式接线批准与正式浏览器授权

2026-11-03用户批准AI2-5正式接线限定合成子批ACCEPTED / USER_APPROVED，
异步连续性（异步读取返回隔离）P2 CLOSED / USER_APPROVED，并授权主线程开始正式浏览器fixture/test及验证。
§9.1及此前候选待批状态作为历史快照保留；AI2-5整体IMPLEMENTING、AI-2 OPEN，未完成整体验收。
批准绑定86文件候选`b6b22e3c6992bc12da0fdcbcb6742cd4c416c7def64a0ef9bf0a03ea310920cf`，旧manifest/hash不变。

最新独立复核`/private/tmp/ai25-review-current/`：homework 4套86、resource 3套68、Gateway 2套87，
合计9套241项通过，0失败/跳过；正式HTTP4项包含在homework内。verification的候选/补丁及JSON哈希已核对。
归档家庭全量185套5554项、Gateway全量14套132项及四处历史guard变异仅核验原证据，没有重新执行，不累加覆盖数。
文档更新者只读核验这些独立执行产物，不冒称重跑；新review目录、清单及批准记录见
[正式接线用户批准记录](evidence/ai2-5-20261103/README.md#正式接线用户批准与浏览器接续)。

正式浏览器下一步须使用正式服务链路验证闭环、刷新/重登、原命令未知结果恢复、账号隔离及审核冲突，
并追加前端回归/构建和收尾证据；由主线程另行实现与执行，本次不增加fixture/test或报告通过。
既有API替身浏览器和正式HTTP不能替代该验证；真机仍DEVICE_PENDING。
T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED、T9 NOT_STARTED及历史失败保持；无模型/Git/部署授权扩张。

### 9.3 正式浏览器候选与本轮P2

§9.2为接线批准及浏览器开工快照。当前Chromium-final 8项均一次通过，0skip/重试，覆盖完整链路及删除撤回、
共管审核冲突、兄弟媒体拒绝、部分上传刷新、公共提交成功丢响应精确重试、远端commit丢响应后真实PIN恢复、
同context跨标签身份切换后的迟到GET/media隔离。独立WebKit初轮由Kepler运行中，已报告四项主/边界场景在最终健康断言失败，完整结果待补，不计全绿。
主链路使用真实Gateway/user/homework/resource/progress/analytics/notification与Mongo/media/fs/auth/login；
AI1只预置人工批准合成artifact，query-only+拒绝sentinel零调用；故障注入仅丢真实响应/延迟/abort一次上传，无业务成功替身。

runtime-green 6通过、共享T2 HTTP全量6套36通过、前端既定全量64套1003通过，构建成功保留旧caniuse警告；
独立两个组件35通过。新同URL回看P2已补3永久组件红绿及独立handler变异（2失败/33通过、1失败/34通过）。
recovery四项缺`unchanged()`的保护P2已补三调用点，原断言/收尾保持，独立静态复核后主线程最终8项通过。
两项均FIXED_REVIEWED / USER_REVIEW_PENDING，不CLOSED；独立组件/静态复核不冒称独立浏览器执行。

runtime-red 1失败/5skip、same-url-red 3失败/28未选中、first浏览器真实产品失败1、fixed的Cycle CAS夹具失败1、
matrix精确label定位失败1/通过7、lint初始11项globals失败均保留；scope声明修正未关闭规则，最终成功不抹除红灯。
pre-WebKit的92文件快照`06c6d407c0a002f79f40287c0baed354ec21d6c4279d0bc02ad127f2b96b9b32`，相对正式接线9项变更/新增，不是最终修订候选。
原始产物、patch/hash及待补WebKit证据见[浏览器验收候选](evidence/ai2-5-20261103/browser-acceptance.md)。
已知36份log/JSON新归档validation，不复制build或独立临时源码，不更改旧approval manifest。
WebKit当前观察为登录后立即page.goto硬卸载Today，未完成daily-learning-plan请求产生access-control pageerror。
待初轮结束后主线程拟参照既有help.spec.js等待Today初始化响应再导航，保留errors断言；本次不修helper或预写修复通过。
后续须新冻结候选，旧06c6及失败证据保留，当前不写最终hash。
旧185套5554及9套241仍为历史证据，本轮未重跑，不与1003/36/35叠加计数。
AI2-5 IMPLEMENTING、浏览器候选待用户复审、AI-2 OPEN；所有其他OPEN/DEVICE_PENDING/后置范围不变，无模型/Git/部署。

### 9.4 WebKit修订后最新冻结与复验

§9.3运行中观察为历史快照。初轮独立WebKit最终7失败/1通过、exit1，七项均停在seen.errors健康断言，
初始化请求被登录后硬导航中断；旧92文件及构建指纹前后一致，无本轮新增测试进程遗留。
main仅修fixture.login：登录前注册scope=today任务、status=pending候选任务、notifications及明确childId的dailyplan，
parent另等weekly/mistakes，每个真实响应均200且finished返回null后才导航；未改产品、原健康断言或120秒超时。
main定向WebKit主链路1通过（14.7秒）；新候选独立完整WebKit8通过（101.656秒），零跳过/重试，健康断言保持并实际通过。

新目录`ai2-5-browser-final-20261103`的candidate为`54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a`，
patch为`9a760baacb605d94fc5fdc7efe8ee0eb9ba9721dbdea145caf56830fe295aeee`，92文件/相对assembly9项增量，较pre-WebKit仅fixture。
两项本轮P2保持FIXED_REVIEWED / USER_REVIEW_PENDING，不CLOSED；原连续性P2已批准关闭不变。
main同候选Chromium最终8通过、exit0、99.541秒（`chromium-verified.json/.log`），独立WebKit8通过、exit0、101.656秒，均零跳过/重试。
独立`webkit-final-verification.json`已确认92源码/8构建文件/config前后哈希一致，本轮process/root无残留，旧root不动，收尾完成。
最终validation及manifest由main统一归档并另补哈希；本次不复制证据或改旧manifest。
实际命令见[Node22与Playwright入口](evidence/ai2-5-20261103/browser-acceptance.md#实际命令入口)：既有NODE_PATH/T2_WEB_BUILD、playwright.t2.config.js及三个正式spec，WebKit加`--browser=webkit`。
`execution-summary.json`中的frontend 64套1003、HTTP 6套36是本批已有执行，未在最终双浏览器阶段再跑；backend 185套5554属于旧接线归档，本轮未重跑。
lint-final全仓exit0、零字节日志为main执行结果，本次文档更新未重跑；详见[最新候选记录](evidence/ai2-5-20261103/browser-acceptance.md#最新冻结与webkit复验)。
本地正式浏览器候选已完成待复审；AI2-5 IMPLEMENTING、AI-2 OPEN及所有原边界保持，原pre-WebKit Chromium8及独立WebKit7失败/1通过继续保留。

### 9.5 浏览器批次批准与总门禁剩余条件

2026-11-03用户批准正式浏览器限定本地合成批次验收及两项新P2关闭：浏览器子批ACCEPTED / USER_APPROVED，
同URL回看P2、recovery不变量保护P2 CLOSED / USER_APPROVED；原接线子批及异步连续性P2关闭不变。
绑定92文件candidate `54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a`，
最新独立复审组件2套35通过、正式WebKit8通过（110.124秒），零失败/跳过/重试；
候选/补丁重建、证据/文档/构建哈希及测试后源码一致。最新20份复审产物单独归档，
manifest `7cff9dafe168f9f24532a33d0b0d6735fba28abcd6706bdf60f5cac982677886`，
详见[批准与剩余条件](evidence/ai2-5-20261103/browser-acceptance.md#浏览器批次批准与剩余条件)。
旧134份证据manifest和文档快照不回写；原红灯与不同层次执行计数保留，本次不重跑产品测试。

AI2-5汇总仍IMPLEMENTING、AI-2 OPEN。本批从预置approved AI1制品起步，不满足§1禁止以手工批准状态
替代整条链路的要求；AI2-PUB-01/FLOW-01的真实AI1修订/批准→Tutor发布连接仍PENDING。
后续复用现有Provider替身和正式应用补最小连接证据，不调用模型；另将§2矩阵逐行映射至已有实际用例/结果，
明确双来源及各验证层的覆盖，缺项才补。相关重验、新候选和限定合成工程汇总复审后再请求总门禁关闭。
DEVICE_PENDING、真实启用/AI1计数资格、T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、
两项非阻断补测及高级恢复/新回收后置均不变；Git clean/完整发布未执行，不借本批宣布发布全绿。

### 9.6 矩阵归并与AI1到AI2连接补验

用户授权先归并§2矩阵，再补最小正式连接。归并快照31项为14核心覆盖、15部分、2待连接，
逐ID与真实断言/档案对应见[矩阵](evidence/ai2-5-20261103/matrix-reconciliation.md)。不是依据5554/1003等通过数量推定覆盖。
新增两份显式跨仓验收文件，复用DeepTutor真实operation/store/SDK及合成transport/counter与LMS正式应用；
task/mistake各从真实页面生成、人工修订、共管批准，经Tutor真实Link发布，孩子订正/家长退回/再提交/通过回看。
不改业务实现、不seed批准、不调用真实模型；完整命令、源码与真实/替身边界见[连接记录](evidence/ai2-5-20261103/bridge-acceptance.md)。

新增合法未批准409、单独旧artifact字段409、无自动发布、孩子旧AI1拒绝、精确DTO及两版Attempt不变性反例。
独立静态评审三项测试保护P2（Node出站、被拒绝写调用计数、顶层source）已补强；作者四格4通过66.36秒，
相关组件6套224、服务/正式HTTP2套30通过，独立实际WebKit两格通过（37.474秒）。2026-11-04复审四格4通过79.73秒，用户批准连接批次及三项P2 CLOSED；不关闭总门禁。
累计94文件candidate `b2f1632a44d08145be938cabf4e46e9fa5d0222293dbe200c2eb5f711c709f16`，
patch `2cbf4a01a4ecb5d1ceca398325c4a45d7ebeae26bdbee51f631b4f5a48bd9dc7`；保留collect/import失败、修订同步失败及补强前四格快照。

增量后31项为17核心覆盖、14部分；未闭合细项继续记录，尤其新UUID提交竞争/非法状态新提交、
终态review/withdraw异正文、带历史再发布、特定恢复拒绝和提交/删除窗口，不能借本次连接自动标绿。
其余现有全量/浏览器结果不冒称本次重跑。AI2-5 IMPLEMENTING、AI-2 OPEN及§9.5全部未关闭/后置状态不变。

### 9.7 新UUID竞争与终态异正文重放

按用户授权在两个既有测试文件新增9个永久用例，覆盖ATTEMPT-03、REVIEW-02、IDEM-01剩余子条件。
先跑8项定向，再受影响4套88项；补异常屏障收尾反例后，最终homework全部AI2 10套188项通过。
五项隔离变异分别命中活动锁、状态限制、终态hash、单侧屏障释放与Attempt版本唯一索引。
业务实现、原断言、超时不变；提交权限/媒体端口替身边界、初次变异工具误计数和新测试收尾P2均明确记录。
候选/命令/证据/评审见[竞争与终态补验](evidence/ai2-5-20261103/concurrency-acceptance.md)，
矩阵[§8](evidence/ai2-5-20261103/matrix-reconciliation.md#8-新uuid竞争与终态重放补验)更新为20核心/11部分。
本增量待用户复审，非总门禁关闭；旧连接批次及三项P2的批准不回退，全部历史失败和后置边界保留。

2026-11-04后续批准：§9.7补验ACCEPTED / USER_APPROVED，屏障异常收尾P2 CLOSED / USER_APPROVED。
绑定原冻结候选及最新独立2套9项、11.392秒复验；原188项回归和首次10.634秒独立转录仍为各自历史证据。

### 9.8 发布版本、来源快照和输入边界

按用户本轮授权，四个既有测试文件新增21项（后端18、组件3），只补PUB-03/04与ATTEMPT-02。
具体用例、真实/替身边界、命令、初次组件失败及候选哈希见[发布补验记录](evidence/ai2-5-20261103/publication-boundaries.md)。
homework全部AI2 10套206通过，相关前端5套204通过；四项临时副本变异准确命中失败断言。
不改业务代码、原断言或超时，不将新增组件等同正式浏览器，不把故障注入的批准指针变化当作AI1新功能。
本批独立复评通过：新增组件3项、后端18项实际复验通过；后端首轮EPERM suite失败单独保留，不计成功。
矩阵最新23核心/8部分，验收待用户复审，AI2-5 IMPLEMENTING、AI-2 OPEN及全部既有未关闭/后置边界不变。

2026-11-04后续用户已批准本批，见[批准及最新18/3复验证据](evidence/ai2-5-20261103/publication-boundaries.md#2026-11-04-用户批准及本轮复验证据)。
上述待审为历史快照，不改变原失败及全量/定向分类；接续AUTH-01、RECOVER-04、SESSION-02，总门禁仍OPEN。

## 10. AUTH-01 / RECOVER-04 / SESSION-02 补验

仅在四测试新增16项：正式PIN重置/重登，持久命令撤权恢复与共管终态重放，以及恢复拒绝后的迟到响应和网络失败保锁。
开发homework AI2 215项、相关前端211项通过；原语句AST顺序与业务源码保持不变。
独立复评发现前端deferred前置等待未纳入finally的P3，已最小修订收尾，不改变产品/断言。
新旧候选、首次失败、独立9/7与修订后验证分别登记[补验记录](evidence/ai2-5-20261103/auth-recovery-boundaries.md)，不冒称完整浏览器复验。
矩阵最新26核心/5部分，剩余PUB-02、VIEW-01、WITHDRAW-01/02、MEDIA-04继续PARTIAL；本批待用户验收，AI-2 OPEN。

2026-11-04后续用户批准§10批次ACCEPTED及P3 CLOSED，绑定[批准记录](evidence/ai2-5-20261103/auth-recovery-boundaries.md#2026-11-04-用户批准及本轮复验证据)。
旧待审文字保留历史身份，不覆盖最新批准；开发215/211与独立9/7分开。

## 11. PUB-02 / VIEW-01 补验

在既有服务和正式HTTP测试新增5项：错误孩子快照hash、未确认内容、AI1真实unknown预留发布拒绝，
非空孩子各DTO完整白名单、猜测候选及他人命令拒绝；不改业务实现或原断言。
开发homework全部AI2 10套220通过。具体层次、首轮夹具失败、变异、独立复评及冻结见[本批记录](evidence/ai2-5-20261103/publication-visibility.md)。
验收未经用户批准，不关闭AI-2；WITHDRAW-01/02、MEDIA-04仍须继续补齐。

## 12. WITHDRAW-01 / WITHDRAW-02 / MEDIA-04 接续补验

新增7例：带approve/revise历史再发布，prepare返回待交付时撤回（commit正常/丢响应），
真实事务快照竞争的删除/commit各先胜，以及跨家庭拒绝/他方持久对象和文件字节不变。
复用正式HTTP、既有Mongo事务和JSON契约适配器，不新增框架或业务逻辑。
开发homework224/10、resource53/1，独立定向4/2及3/1分别登记；精确范围、失败历史、变异和冻结见[本批记录](evidence/ai2-5-20261103/withdrawal-privacy.md)。
独立复评结论和覆盖归并以记录最终状态为准；未经用户批准不记批次验收或总门禁关闭，旧§11待补为当时快照。
