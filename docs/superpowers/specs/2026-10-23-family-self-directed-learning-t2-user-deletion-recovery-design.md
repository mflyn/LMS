# T2-G 用户主动删除日志与受控恢复补充设计

> **当前执行范围（2026-10-24 用户批准）：** 未完成的新孤儿回收与用户删除高级恢复后置，
> 不再作为 T2-2 至 T2-6 页面开发/合成验收前置；T2-R 和已接入上传、删除、权限、幂等、版本及预检保护保留。
> D2b 剩余、D3/D4/E 不继续扩展或接入半成品，D01/T2-G 仍未验收；既有成果和历史证据保留。
> 本文后续原顺序和批准记录为历史基线；当前保留/后置矩阵、运行依赖和启用限制以
> [执行记录 §11](../../development/family-self-directed-learning-t2-execution.md#11-2026-10-24-mvp-范围调整与页面运行依赖)为准。
> 不删除现有事实、不降级旧 writer、不绕过校验；将来启用后置能力时仍须完成本文原安全验收。

**Status:** APPROVED
**Independent design review:** PASS（2026-10-23；首轮三项P2设计缺口修订后复核通过）
**User design approval:** APPROVED（2026-10-23，用户答复“批准设计，按计划分批实施”，含新增模型、日志、helper及容量上限）
**Implementation:** IN_PROGRESS；仅合成验证，不授权真实恢复、部署、提交或推送 Git

## 1. 范围与现状

本提案补齐[回收设计](2026-10-23-family-self-directed-learning-t2-recovery-retention-design.md) §5 的用户删除恢复缺口。
既有 `mediaDeletionEvidence` 仅保存首次墓碑和目标媒体 receipts；没有完整 operation 终态组、固定上传摘要。
现有 `orphanRetirementRestore` 只恢复系统回收证据，在线用户删除写 RETIRED guard 也不能证明旧备份恢复安全。
测试必须从**删除前** BSON 备份回退，不能用删除后的快照代替。T2-G、D01、T2 门禁继续 OPEN。

目标是重放“已发生的删除事实”，不是恢复被删作品，不重新授权原用户、不替用户提交作业。
限 `task_completion` 新协议；不修改旧材料/错题媒体、不新增公开接口、不扩大前端。
旧客户端升级拒绝、默认关闭、24 小时孤儿保留及默认50/上限100回收批次保持。
用户主动删除的既有30天元数据/引用清理等待期不改成24小时；删除墓碑、终态账本、guard、恢复证据不设 TTL。

## 2. 方案选择与风险

| 方案 | 取舍 | 结论 |
| --- | --- | --- |
| 用旧 receipts 和备份猜出原终态/上传摘要 | 无法证明完整集合、首次终态或已丢失身份，可能复活媒体 | 拒绝 |
| 新删除冻结版本化证据；独立不可变日志；显式事务恢复 | 增加一个证据模型和受控 helper，可保留旧日志原文并逐条验证 | 已获用户批准 |
| 完整数据库变更流/PITR 平台 | 运维成本和范围远超本次低配置家庭合成验收 | 本轮不采用 |

主要风险是同组其他媒体被误回退、终态版本被误覆盖、日志写失败后清理正文、旧日志被静默升级。
约束：全组证据校验先于写入，精确 scope/代次 CAS，证据不足整组拒绝，文件 IO 不放入可重试事务回调。
完整恢复依赖同一受保护备份链中的数据库、媒体及删除日志；摘要只能检测一致性，不是抗恶意篡改签名。
恢复期间停写、阻断业务访问；只读预检通过也不自动开放写入。

## 3. 证据与持久化契约

拟新增 resource 自有 `MediaUserDeletionRecovery`，唯一 `mediaId`（simple collation、非部分、无 TTL），
包含 `version=2`、固定 evidenceId、规范证据及 evidenceHash、真实记录创建时间。模型 `_id` 显式为UUID字符串，
`_id = evidenceId`，不让Mongoose另分配ObjectId；证据一旦提交不可修改。
这是同一服务的删除事务 outbox，不是新业务操作标识，不替代 remoteOperationId 或公开 operationId。
证据不能依赖以后查询可变化的 operation.version 拼装；DELETE 重试和 cleanup 均读取这份冻结内容。

证据 schema 严格拒绝未知字段、重复键、稀疏/重复数组、非规范 ID/日期/摘要；集合稳定排序：

| 字段 | 内容与约束 |
| --- | --- |
| `version/evidenceId/evidenceCreatedAt` | v2、固定UUID及原证据创建时刻；恢复outbox原_id与createdAt直接取后两字段，不从当前时钟猜造；未知版本拒绝，不作为v1解析 |
| `tombstone` | 原 `_id`、media/family/child、actorId/role、purpose、reason=user_requested、首次 deletedAt；不保留姓名/Token |
| `uploadIdentity` | 固定 media/family/child/storageKey、规范 metadataHash；不保存图片、文件名、备注或完整上传正文 |
| `operations` | 经 `references.mediaId` 索引读取全部历史组：原 `_id`、完整 scope、remote operationId、commandHash、referenceSetHash、有序完整 references、终态/版本/terminalAt/failureCode/空 lease、创建/更新时间；本次发生版本或终态变化者另存同事务before快照，用于精确CAS重放 |
| `referenceEffects` | 删除事务实际改变行的 before/after 精确快照；PREPARED 中止包含整组，COMMITTED 删除仅包含目标行；记录完整 slot、原 `_id`、operationId、状态/租约/释放字段，不伪造其他成员隐私删除 |
| `receipts` | 目标媒体实际生成或已存在的精确绑定代次凭证，原 `_id`/scope/bindingOperationId/releasedAt；普通 unbind 或 ABORTED 不能制造 receipt |
| `evidenceHash` | 除本字段外整个规范证据的SHA-256；固定canonical编码；数组成员/顺序语义必须校验，不能只信文件内摘要 |

全部相关历史 COMMITTED **和** ABORTED 都要保存，不限于当前引用行。PREPARED 在原删除事务内整组转 ABORTED，
failureCode 按实际租约采样保留；COMMITTED 保持原 terminalAt/state，仅原有并发 fence version 递增。
已普通解绑的 released 行保留其 releaseOperationId，不转换为隐私凭证。当前行被后代次覆盖不能导致漏掉历史组。
组身份、账本 `_id`、有序完整集合及重算 referenceSetHash 必须相符；commandHash 为原持久摘要，不能从缺少的学习正文重算或猜造。

B集成澄清：全部历史指可信资产所属familyId/childId内、包含该mediaId的全部任务/operation/代次，
不从请求参数推导范围。外scope从未建立引用的version0 ABORTED拒绝审计不进入owner日志、不占其100组预算，
也不删除或改写；仍以有界存在性查询拒绝foreign PREPARED/COMMITTED/version>0等异常历史，
目标Reference继续跨scope检查，实际跨scope引用（含released）仍拒绝。
既有version0失败先采样terminalAt再由Mongoose生成createdAt，允许保留terminalAt早于createdAt的原事实；
仍要求terminalAt<=updatedAt、createdAt<=updatedAt<=evidenceCreatedAt及合法失败/租约/历史条件，
不采用任意毫秒容差、不扩大到COMMITTED或version>0，也不套用§5.2历史PREPARED断言。

单证据上限提案：100个 operation、1000个引用效果、2 MiB规范JSON（低于MongoDB文档上限）。
一次恢复依赖读取另限100份日志、总16 MiB；到上限+1或总字节超限即零写拒绝，不允许无限递归或隐式全目录加载。
组合读取的保守计费口径：同一次恢复中的目标及依赖、v1及v2合计最多100个物理内容文件、16 MiB原始内容（含换行），
并非100个v2之外另有v1额度；逻辑v2证据缓存的同名上限仍独立生效。
每次显式恢复只创建一个读取会话，依赖发现、事务回调重试及未知提交核验共用；下一次显式恢复重新计费。
同一已验证打开句柄的fstat大小在分配和读取前预留预算，失败不返还；同media的成功、拒绝和安全缺失结果均按会话去重。
每个计费文件最多额外读取1个增长检测字节（整次最多100字节），仅用于拒绝增长，不能成为接受内容；16 MiB不声称是进程堆或全部系统调用I/O上限。
读取 limit+1 检测溢出，任何溢出/不一致在原删除事务提交前拒绝，不截断、不先删后报错。
这不是遗忘用户删除请求：返回可重试稳定错误并进入人工运维处理；本轮不实现超大历史分片。

## 4. 在线写入、日志及兼容

新 enabled 用户 DELETE 在现有实时鉴权与同一 majority/snapshot 事务内执行：
1. 验证资产、guard、原墓碑及完整历史；冻结实际 before；按现有协议进行整组中止/精确释放。
2. asset deleted、首次墓碑、receipts、UploadGuard RETIRED 与 v2证据模型一起提交；任一步失败整笔回滚。
3. 事务外持久化原 v1兼容日志和独立 `user-deletions-v2/<mediaId>.json`。v1保留原接口投影；v2为恢复权威证据。
   两者不是文件系统原子对，但规范墓碑/receipt投影必须一致；部分成功重试同一内容，不覆写现有任何文件。
4. 两份日志的文件 fsync、原子不覆盖发布、发布/清理临时文件后目录 fsync 及必要父目录 fsync 成功，才返回既有成功状态。
   丢响应/提交未知返回既有503 pending，重查同一个墓碑和固定 outbox，不再生成 evidenceId、不覆盖首次审计。

v2路径只由固定mediaId派生；保护整个祖先链、目录0700/文件0600，拒绝symlink/非普通文件/路径越界/超长文件，
对打开句柄与检查身份一致性做验证。读失败或冲突日志不能退回 v1 作为恢复成功。
cleanup 在删除正文前重新确认 v1/v2与冻结证据一致；物理删除和目录同步完成后才 CAS 清元数据/引用。
保留 tombstone/receipt/operation/guard/outbox/两种日志。失败重试既有证据；正文已不存在属于幂等，不意味着可跳过目录同步。

**旧数据兼容：**只有v1且无v2模型的历史用户删除仍按原幂等接口识别，不改写历史文件，不凭当前状态补造v2。
其旧版清理不自动获得“可从旧备份恢复”资格；恢复预检标记 `LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`，
保持维护隔离。对已有v2模型却缺/坏v2文件，不得降级成历史v1路径；显式恢复/日志补写只能读原冻结outbox。
用户后续明确兼容裁决：正常enabled启动允许经原契约及外部v1校验的历史v1-only记录；
这不授予旧备份恢复资格，严格恢复检查仍必须以上述INSUFFICIENT原因拒绝。
任何已知v2状态，包括外部v2存在但数据库删除事实整体回退，在线/恢复检查均阻断，不按v1兼容放行。
索引及目录未就绪不能启用新writer；旧版不懂v2的writer不得与新writer混跑。
外部v2存在而outbox缺失不属于v1-only；已注入v2依赖的删除/清理在事务外读文件识别后拒绝确认/清理，
不能重建猜造证据。未注入v2依赖的旧helper以原生只读查询识别已有outbox并拒绝降级，
不冷加载v2模型或创建集合；外部日志与旧备份的完整双向启动检查仍由D承担。

## 5. 显式恢复协议与终态合并

拟新增**不挂生产路由、不自动启动**的 `createUserDeletionRestore` helper。
输入限定固定 mediaId、`execute:true`、`writesPaused:true`；依赖注入本服务事务runner、受保护日志reader、存储路径校验器。
原日志从受保护目录读取，不接收浏览器提交的证据JSON。无跨服务直写，无用户凭据授权替代，无新增公网入口。
只读 `inspect` 只返回安全计数/固定reason；实际恢复后始终 `ready:false`，不能替代完整恢复验收。
预检使用原生只读集合访问，不冷加载writer模型触发建表/索引；验证副本集事务能力、完整已建索引及BSON身份，
拒绝build中/prepareUnique/部分唯一/非simple collation/TTL，游标和连接失败路径必须收尾。

### 5.1 恢复前验证

验证文件版本/摘要/完整字段、原墓碑与receipts、所有组及effects闭包、固定上传身份、所有受影响 slot 和 `_id` 冲突。
必须同时读取现有更高代次的组证明；不能仅以 version 更大、terminalAt 更晚认为它合法。
同组多个媒体的v2日志可包含不同版本的 COMMITTED 行：比较固定身份与终态事实，不要求全部历史 version 相等。
同scope/ID但hash/集合、COMMITTED/ABORTED、首次terminalAt或失败码冲突，整笔拒绝，禁止“最后文件覆盖”。
跨日志验证采用输入证据加当前持久证明；其他删除日志缺失、无法证明普通解绑或较新generation时保持隔离，不猜造依赖。
冻结后合法迟到的、从未PREPARED的ABORTED账本不补写原日志：仅原scope且包含目标媒体、version=0、
failureCode为RESOURCE_NOT_FOUND或MEDIA_OPERATION_ABORTED、terminalAt不早于删除、整组无同代次引用时允许保留。
该例外不能替代日志内任何历史组；不满足条件一律拒绝，避免把正常迟到重放误判成需要改写旧证据。

**确定的依赖规则：**helper只写目标media删除事实和其必要整组效果，不自动重放另一媒体的删除。
例如COMMITTED版本1，X删除证据1→2，Y删除证据2→3；备份版本1先请求Y时，
返回 `USER_DELETION_DEPENDENCY_PENDING` 且零写，外部显式编排先恢复X再重试Y。
仅固定终态身份一致且精确before版本成立才执行after版本CAS；不得跳过普通unbind造成的版本缺口。
已较高版本时，要验证本日志全部目标效果已成立，再沿有界、无分叉的完整before/after证据链核验到当前版本；
依赖日志仅用于证明，不能因此扩大写入范围。缺链/分叉/普通unbind缺少足够持久证明均pending或冲突拒绝。
首版不从releaseOperationId单独推算unbind的原版本迁移；无完整版本证据链时保持隔离。
如果先恢复Y已返回pending，之后X→Y成功，再重放X必须保持版本3及两个媒体首次审计；不回写版本2。

### 5.2 同一事务重放

- 目标资产存在时核对固定scope/storageKey/metadataHash；仅匹配身份允许 active→deleted；不得重建 active 资产。
  元数据已清理时仅重建墓碑、guard、终态与真实receipt，不从摘要造元数据或媒体正文。
- UploadGuard 缺失则按原固定身份建立 RETIRED；REGISTERED仅匹配身份时推进；已有 RETIRED严格比较身份。
  新建行时间是真实重建时刻，原删除时间在墓碑保留；已有guard时间不刷新。上传重试遇该终态必须拒绝。
- 账本缺失可从完整v2终态恢复，但不能跳过该媒体的版本依赖或忽略已存在的组员；同身份 PREPARED只在before状态及完整组可验证时推进到证据终态；
  已终态仅允许相同终态事实。版本不倒退；更高版本必须由当前完整引用/解绑/其他删除证据解释，否则拒绝。
- **历史ABORTED断言重放：**A并非本次删除中止、没有before/effects时，不虚构该快照。
  允许用日志中A的完整ABORTED终态与备份的原PREPARED共同验证：原_id/scope/hash/有序集合一致、
  原版本+1等于终态版本、原创建时刻一致、PREPARED租约有效且终态时刻不早于创建；
  EXPIRED必须terminalAt>=原lease，RESOURCE_NOT_FOUND/MEDIA_OPERATION_ABORTED必须terminalAt<原lease。
  必须验证全组备份引用slot/资产范围；同A且prepared行的lease必须等于原A租约，再推导released、
  releaseOperationId=A、releasedAt=原terminalAt、lease=null，不生成隐私receipt。
  当前slot已被B/C覆盖时，只允许完整独立证明其合法终态/代次后保持不变；缺组员/未知代次/未解释状态拒绝。
  对A账本和所有需变化行执行精确CAS，一处失败整笔回滚。version=0从未PREPARED的失败不能套用该规则。
  此分支不允许PREPARED→COMMITTED，不绕过COMMITTED删除的精确版本依赖。
- PREPARED→ABORTED 还原所有同代次组员的释放状态；COMMITTED保留提交事实，仅删除目标，不把整组错误改成 ABORTED。
  同代次行只匹配before或after；不同代次必须查证其完整终态/引用合法性并保持原样，不能按mediaId盲写。
  不恢复旧 bound/prepared 行去覆盖后续已释放或已删除成员；已COMMITTED但备份仍PREPARED、缺失活跃组员证明等
  不能安全还原的跨阶段备份首版拒绝，要求补齐一致备份/证据，不能宣称任意时点恢复全覆盖。
- 目标已无资产时不重建其 released 行；真实 COMMITTED receipt与完整账本可保留历史证明。
  活跃组员缺失且无合法删除/释放证据则整笔拒绝；不能为通过校验造出已删媒体或引用。
- 恢复原墓碑、receipt/outbox 使用原 `_id`/唯一键一致性；缺失则插入，一致则幂等，冲突则零写。
  outbox创建时刻保持文件中的evidenceCreatedAt；如需记录实际恢复时间使用独立restoredAt，不进入不可变证据摘要，
  首次重建后幂等重放不刷新。已有outbox不改其原时间，_id/evidenceId/mediaId任一交叉冲突均拒绝。
  对既存行按最终版本/状态/代次 CAS；任意匹配数不符回滚全部组、guard和墓碑。

helper 不物理删除，不发星，不写 homework owner/pending、用户关系或业务内容，不调用系统 retirement 写接口。
用户删除允许已发布作品仍有教学引用，不能强制要求 homework granted/retired。
若已有系统 CANDIDATE/FENCED，保留原retirementId，待完整用户证据恢复后走原SUPERSEDED收敛；
不能同时造系统DELETED/PURGED证据。遇真正系统删除与用户删除事实冲突则隔离，不任择一种覆盖。
随后通过 T2-R/T1 原 actor 和原 remoteOperationId 显式恢复业务；历史 COMMITTED 返回真实精确删除凭证，
ABORTED 保留原失败，不能让共管家长替换原提交者。同UUID不同actor保持不同持久映射。

### 5.3 未知结果与恢复验收

事务提交未知后重读同证据标识及完整事实：一致则幂等确认，不一致/不可读返回pending，绝不补偿恢复active或删除日志。
helper 只确认本服务删除证据已重放，不宣布业务恢复完成。各服务严格预检、外部日志与数据库双向核对、
原actor恢复及迟到上传拒绝测试完成后才具备候选验收资格。
外部v2存在但数据库outbox/guard回退缺失必须被恢复专用只读检查检出；不能只遍历数据库现存行而漏过整条删除。
恢复证据有缺口或两个文件格式冲突时零写并保持维护隔离。正常启动不扫描日志自动修库。

## 6. 测试与实施门禁（已批准，按增量执行）

| 编号 | 必须证明的场景 |
| --- | --- |
| UDR-001 | 新删除原子冻结COMMITTED/ABORTED全部历史、PREPARED整组变化、原audit/ID/hash；普通解绑无假receipt |
| UDR-002 | 每处DB写失败回滚；真实重叠事务竞争；提交未知/HTTP丢响应重用同evidenceId和首次审计 |
| UDR-003 | v1/v2任一文件写/发布/每处fsync失败与等待；移除fsync/await逐项变异；冲突不覆盖、缺v2不降级 |
| UDR-004 | 删除前BSON备份→真实用户DELETE+两份日志→回退含guard/outbox→恢复；PREPARED整组ABORTED，原actor原映射恢复 |
| UDR-005 | 删除前COMMITTED备份→删除+清理→旧备份重放，精确receipt可查；迟到upload日志不复活、不返回成功 |
| UDR-006 | 同UUID不同actor；备份A PREPARED、线上A先ABORTED后B再用户删除，A无before/effects仍按历史断言全组恢复；后代次C不回退；X/Y删除1→2→3正序成功、逆序Y零写pending后X→Y收敛，再重放X不降版本或改审计 |
| UDR-007 | 更高version但缺解释、相反终态、scope/hash/集合/账本_id冲突、跨代次receipt、缺组员、稀疏数组、上限+1均零写；合法迟到version0终态保留，伪造/替代历史拒绝 |
| UDR-008 | 重放事务每步失败及未知提交后重建helper；原日志字节不变、清理前不删正文、清理后仍完整证明 |
| UDR-009 | v1-only拒绝自动恢复；v2-only/外部文件但DB全缺能检出并保持outbox原_id=evidenceId及evidenceCreatedAt；未知版本、坏文件、symlink/权限/祖先链失败和句柄关闭；依赖100份/16MiB上限及溢出拒绝 |
| UDR-010 | 只读检查原生DB快照和日志/正文不变；默认关闭/legacy拒绝、不挂新公开接口、错误和输出无个人内容 |

顺序：批准设计→编制可执行细分计划→schema/纯证据校验红绿测试→删除事务/outbox/文件生命周期→受控恢复与合成HTTP/BSON演练→
针对性变异/完整家庭回归→开发自查→独立代码与QA评审→修订再次评审→不可变证据归档→用户批次验收。
每个缺陷必须有复现/负向用例与修复后复测；不得用先删后快照、mock事务成功、只检查status代替恢复事实验证。
设计评审只审可实施性及契约，不把测试方案当作已执行证据。独立评审无阻断后仍须用户批准设计方可编码。

## 7. 回滚与非目标

写入v2前可撤销未启用装配；写入后保留新模型、guard、v1/v2日志和兼容reader，维护模式前向修复，
不得降级到不理解删除屏障/版本证据的writer。合成演练失败仅重建隔离测试库，不修改真实备份或删除历史档案。
本设计不提供自动迁移旧日志、强制解除他人任务锁、跨服务直接修库、恢复已删除文件或生产部署许可。

## 8. 设计自查与评审记录

自查：明确区分系统回收与用户删除；同时覆盖COMMITTED/ABORTED；冻结outbox避免后续版本变化破坏日志幂等；
不从摘要恢复正文；v1不足拒绝；跨日志冲突、外部日志双向核对和受限备份覆盖已列入负向门禁。
独立设计评审已完成；本设计和新增模型/参数/恢复能力已获用户批准，实施证据另记，不据设计批准关闭门禁。

首轮独立设计评审（Dalton）指出三项P2：历史ABORTED缺before/effects的恢复条件不确定、
同组删除版本依赖和逆序语义不确定、outbox原_id未进入文件契约。已分别补充历史断言重放、
单目标零写pending与有界依赖链、_id=evidenceId及原创建时刻，并扩充UDR-006/007/009。
Dalton随后独立复核确认三项P2在设计层闭合，限定范围未发现新的确证阻断，建议提交用户设计审批。
两轮评审均只读设计/相关代码，没有实施恢复能力、运行Mongo或执行本设计测试；不得标记UDR用例已通过。
2026-10-23批准范围包括证据模型、v2命名空间、受控helper、单证据100组/1000效果/2MiB及依赖100份/16MiB上限。
