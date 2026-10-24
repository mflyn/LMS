# T2-G 用户删除恢复 Implementation Plan

> **当前执行范围（2026-10-24 用户批准）：** 未完成的新孤儿回收与用户删除高级恢复后置，
> 不再作为 T2-2 至 T2-6 页面开发/合成验收前置；T2-R 和已接入上传、删除、权限、幂等、版本及预检保护保留。
> D2b 剩余、D3/D4/E 不继续扩展或接入半成品，D01/T2-G 仍未验收；既有成果和历史证据保留。
> 本文后续原顺序和批准记录为历史基线；当前保留/后置矩阵、运行依赖和启用限制以
> [执行记录 §11](../../development/family-self-directed-learning-t2-execution.md#11-2026-10-24-mvp-范围调整与页面运行依赖)为准。
> 不删除现有事实、不降级旧 writer、不绕过校验；将来启用后置能力时仍须完成本文原安全验收。

> **For agentic workers:** 使用 superpowers:subagent-driven-development，按增量测试、自查、独立评审；遵守用户不提交、不推送约束，不执行技能模板中的Git提交步骤。

**Goal:** 以完整不可变用户删除证据支持合成旧备份恢复，不复活媒体或改写首次审计。
**Architecture:** resource 本服务事务冻结v2证据，事务外持久日志；显式helper校验完整组和版本依赖后原子重放。
只读预检独立于writer，任何恢复不自动宣布ready，不跨服务修库。
**Tech Stack:** 现有 Node22 / CommonJS / Mongoose / MongoDB事务 / Jest / 临时副本集及回环HTTP。
**Spec:** [已批准补充设计](../specs/2026-10-23-family-self-directed-learning-t2-user-deletion-recovery-design.md)。

## 全局约束

- 仅合成；不部署、不提交、不推送、不改真实数据，不覆盖已有未提交变更或不可变档案。
- 100个operation、1000个引用效果、2MiB规范证据；依赖最多100份/16MiB；越界整笔拒绝，不截断。
- v1日志不改写、不自动升级；v2缺失/损坏不得降级。T2-G/D01/T2保持OPEN。
- 保留旧客户端拒绝、默认关闭、首次审计、原actor/remoteOperationId、精确代次以及所有历史失败证据。
- 当前默认每增量独立复核，不增设设计内小步骤审批；涉及范围变化另审，整个T2-G完成后提交用户批次验收。

## 重点风险

1. 同scope/UUID但hash或集合不同，不能因摘要字段看似合法而接受（A/C）。
2. PREPARED整组中止与COMMITTED单目标删除不可混淆，普通解绑不能伪造receipt（A/B/C）。
3. X/Y删除逆序、普通unbind版本缺口及历史A/B覆盖不能跳版本或回退后代次（C）。
4. 发布后fsync失败、外部文件存在但outbox缺失不能误报就绪或清正文（B/D）。
5. 原有运行路由和旧日志不能在新能力尚未验证时被隐式切换（A/B/D/E）。

## A：证据契约与append-only模型

**文件**：新增 `backend/services/resource-service/services/userDeletionRecoveryEvidence.js`、
`models/MediaUserDeletionRecovery.js`、`__tests__/userDeletionRecoveryEvidence.test.js`、
`__tests__/mediaUserDeletionRecoveryModel.test.js`（后三路径均相对resource-service）；登记 `jest.family.config.js`。

**接口**：纯模块 `validateEvidence(value)` 返回脱离输入的规范v2对象，校验摘要；
`sealEvidence(unsigned)` 校验并计算 `evidenceHash`；`serializeEvidence(value)` 返回规范JSON及换行；
导出 `LIMITS`。不加载Mongoose模型、不读数据库、不碰文件、不改业务路由。
`operations`固定为 `{before:null|snapshot,after:snapshot}`；effects为 `{before:snapshot,after:snapshot}`。
operation snapshot含原标识、scope、hash、有序refs、状态/版本/租约/终态/失败码及createdAt/updatedAt；
reference snapshot保留原slot/代次/释放字段和时间。分别按after._id、after._id、receipt._id升序且唯一。
模型字段 `_id`字符串UUID=evidenceId、mediaId/familyId/childId、version=2、evidence/evidenceHash、createdAt、可选restoredAt。
全部事实字段immutable；createdAt取evidenceCreatedAt；restoredAt若有为真实重建时刻且不可随重放刷新。

- [x] 先写UDR-001/007结构及关系反例：全组、摘要、稀疏数组、scope、伪receipt、时钟/版本；记录RED。
- [x] 实现纯校验/规范化，使用现有json-canonicalize；拒绝getter/非JSON值、未知字段，不以JSON roundtrip吞掉非法输入。
- [x] 模型测试先红：UUID主键、唯一mediaId、无TTL、证据/投影/时间一致、immutable及错误输入拒绝。
- [x] 实现模型，不被server/业务服务import；真实临时副本集验证唯一键与原始文档持久化。
- [x] 同版本json-canonicalize移为生产依赖，锁文件同步；隔离omit-dev安装验证，不改共享node_modules或启动服务。
- [x] 定向测试→自查→独立评审→缺陷红绿及复核；记录A完成，不能声称事务/恢复已实现。

A内部增量完成：纯测试106项、模型及依赖测试34项，独立纯测复跑106项；
固定源码家庭回归136套件/3283项通过，零失败/跳过，exit0。详见T2执行记录§10.7及
`release-gate-artifacts/t2-udr-a-2026-10-23/`。不代表T2-G用户批次验收；当时B-E未实施，当前状态见下。

## B：冻结outbox、v2日志和删除/清理接续

**文件**：新增 `services/userDeletionRecoveryJournal.js`、`services/userDeletionRecoveryCapture.js`及同名测试；
修改 `completionMediaPrivacyService.js`、`completionMediaCleanupService.js`，扩展已有privacy/journal测试。
**接口**：`createUserDeletionRecoveryJournal({root}).persist/read(mediaId)`；
`captureUserDeletionEvidence({asset,beforeOperations,beforeReferences,session,evidenceId,evidenceCreatedAt})`在同事务读取完整after并seal。
既有服务通过显式注入v2依赖选择新路径，正式装配留D；v1旧记录无outbox不可猜造新证据。

- [x] RED覆盖本服务各写点回滚、COMMITTED/ABORTED历史整组、scope撤销、原evidenceId未知结果重放（UDR-001/002）。
- [x] 真实重叠事务：删除与原组commit/abort、同组另一媒体删除竞争；证据before/after只来自同一成功事务，不能拼入失败尝试；冻结后重放不重组证据。
- [x] 实现事务capture/outbox：有界完整历史读取，目标标记/guard/墓碑/receipt/outbox同时提交。
- [x] RED覆盖文件权限、祖先链、symlink、重复JSON键、部分发布、三处fsync失败及同步等待（UDR-003）。
- [x] 实现保护日志；只接受writer规范文件字节，JSON.parse后必须与规范序列化一致以拒绝重复键，保留v1reader原行为。
- [x] 既有204仅在v1/v2持久成功后返回；cleanup先确认双日志，再删除正文+目录同步，最后元数据CAS。
- [x] 定向回归及逐处移除fsync/await变异、自查和独立评审；无正式装配漂移。

B内部增量完成：定向6套件319项、独立纯/journal复跑171项、最终固定源码家庭回归138套件3409项通过，
均零失败/跳过。两项P2经红绿修订及独立复核关闭；保留非阻断P3到C、测试屏障超时、主动中断和PATH环境失败记录。
1167受测文件及11个独立复审文件哈希一致，归档`release-gate-artifacts/t2-udr-b-2026-10-23/`。
正式server/operations未装配；C/D/E待实施，T2-G/D01/T2保持OPEN。

## C：受控恢复与版本依赖

**文件**：新增 `services/userDeletionRestore.js`、必要的 `services/userDeletionRestoreProof.js`及对应测试。
**接口**：`createUserDeletionRestore({transactionRunner,journal,mediaStore,now}).restore({mediaId,execute,writesPaused})`；
成功仅 `{ready:false,state:'USER_DELETION_RESTORED'}`，依赖未就绪固定 `USER_DELETION_DEPENDENCY_PENDING`且零写。

- [x] RED：删除前BSON→线上删除→回退含outbox/guard，PREPARED/COMMITTED/历史A/B与无metadata（UDR-004/005）。
- [x] 实现完整预验证及事务写集合；before/after CAS、历史ABORTED断言、guard/墓碑/receipt/outbox原ID与审计重建。
- [x] RED：X/Y正逆序、重新X、高版本无解释、后代次C、迟到version0、跨scope/ID、依赖上限（UDR-006/007/009；v1/v2联合物理预算另见未完成reader条目）。
- [x] 承接B非阻断P3：独立构造可通过纯校验但与原outbox不同的外部规范证据，验证完整比较拒绝且零写/零persist；不以guard回退用例代替。
- [x] 实现有界依赖读取及无分叉版本链，禁止隐式写其他媒体，缺失证据保持隔离。
- [x] 系统交叉状态：CANDIDATE/FENCED保留原retirementId，用户证据完整后原流程SUPERSEDED；系统DELETED/PURGED冲突零写隔离。helper不调用retire，也不要求homework授予退休。
- [x] 故障注入各写点、提交未知与helper重建、原日志字节不变（UDR-008）；局部恢复核心独立评审修订复核，不代表reader及C整体验收。
- [x] 在恢复首次写入前由受保护组合`journal.read`核对已有v1/v2精确投影；目标与依赖一致走该屏障，覆盖v2-only、现存冲突和读取失败零写，D复用此reader。

C状态：内部增量完成（最终证据见本节末）；以下保留早期检查点过程，不代表T2-G批次关闭。已实现独立helper与纯证明缓存/版本链；基础恢复、X/Y依赖、历史A/B、后代次C、
清理后重放、系统交叉状态、原审计及七处事务写失败已有定向测试。首轮联合2套件131项通过；
追加边界后主套件58项通过；两项隔离变异证明最终CAS与依赖已应用事实检查不可移除。
独立代码/QA评审进行中，尚未冻结最终回归或关闭C；清单待复核后逐项确认，不以定向绿测替代验收。
B的非阻断P3已增加原证据/合法但不同外部证据/移除比较三个用例，仍等待独立复核结论。
过程记录见T2执行记录§10.9；D/E未实施，T2-G/D01/T2继续OPEN。

首轮独立评审CHANGES_REQUESTED：C-P2-1完整组员时序、C-P2-2清理/缺账本组合，以及QA五项保护缺口待修订复核。
既有v1与v2格式冲突的零写承诺需共享受保护组合reader在helper首次事务前执行，不能留到D恢复后检查；
reader只读且不升级v1、v1-only不足、v2-only与现存冲突区分处理，细分实现先自查/独立核对。
最小实现拟新增`services/userDeletionRecoveryReader.js`及同名测试，保留helper接口；
固定日志根目录下v1在根、v2在`user-deletions-v2/`，复用B的v2 reader且不修改旧writer。
v1严格保护完整祖先链/0600文件/0700根/NOFOLLOW/有界读取/句柄收尾，比较原writer编码和完整投影集合；
首次安全检查缺失才允许v2-only，存在但冲突/不可读/读取中消失必须在事务前拒绝。
尚待独立方案核对和实施；此处不是已通过证据，不新增公开API或启用权限。

2026-10-23局部检查点：三项代码P2及五项QA保护缺口已分别修订/独立复核，B保留P3已确认补齐；
最新8套件493项通过，零失败/跳过，exit0。归档`release-gate-artifacts/t2-udr-c-checkpoint-2026-10-23/`，
仅定向回归和评审源码后验哈希，不是C最终全仓冻结或验收。reader设计另有预算P2：
v1/v2应共享每次恢复100个物理文件/16MiB预算，不隐含扩大为100个v2加额外v1；保守口径的细分机制正在修订，未实施。

### C-reader 联合预算细分方案（实现及独立复核PASS）

范围仅新`userDeletionRecoveryReader.js`/测试、proof cache内部会话绑定和恢复集成测试；不改变helper的公开构造参数，
不修改B writer/已有归档、不装配正式server，不引入数据库访问或任何文件写入。
内部reader提供`read(mediaId)`与`createReadSession()`：便捷read创建单次会话；proof cache创建时只取得一个会话，
同一restore中的目标、依赖、事务重试与未知提交核验共享它。新的restore/cache才取得新预算；会话能力畸形不得回退到无预算read。
一次会话v1/v2合计最多100个物理文件、16MiB原始内容（含换行）；现有v2缓存100份/16MiB是额外约束，不替代物理预算。
以同一个已打开并核验身份的句柄fstat大小同步预留文件数和字节数，再分配buffer/读正文；失败不返还已预留预算。
为在读取前可靠计费，不采用预检路径后重新调用B.read的双重打开方式；新模块内复用B已验证的只读模式形成单个私有raw reader，
两种命名空间均走该内核，v2继续使用同一纯codec，B源码保持不变。
每个已计数文件至多额外读取一个增长检测字节，整次至多100字节；这些字节只触发拒绝，不能成为被接受内容或扩大16MiB内容上限。
同media并发/重复请求缓存同一promise，包含拒绝结果与首次安全缺失；事务重试不重新打开或返还预算，新显式restore才允许重新读取。
先读取固定`root/user-deletions-v2/<id>.json`，有效后检查`root/<id>.json`；v2-only可用，v1-only不足。
v1只在首次安全lstat缺失时可选；已存在但冲突、读取中消失或close失败不能降级。两种格式与完整投影集合核验必须先于任何恢复写入。
完整祖先链/根0700/文件0600/NOFOLLOW/同句柄与路径身份/大小mtime复核及finally收尾保留，单文件仍限2MiB。
路径/格式/投影失败为INVALID；不可读或读取中消失为PENDING，均脱敏且不落入未知提交成功确认分支。
验收：成对50份媒体可读、51份因物理文件上限拒绝；v2-only100/101；混合命名空间16MiB精确边界/溢出；
失败不返还、并发去重、共享依赖/事务重试/新restore重新计费；目标和依赖冲突真实RS零写；日志字节及正文不变。
回滚：未装配的只读reader可撤销调用，不写真实数据或升级旧文件；测试失败保持C/G开放，不移除既有删除屏障。
Pascal独立复核上述方案及plan-v2，预算P2在设计层关闭，未发现限定范围阻断；仅属既有容量的保守落实，不是扩容或真实环境授权。
实现按测试先行推进：新增reader由独立实现者负责，主线程负责cache会话绑定及真实恢复集成；代码/QA仍须另行独立评审。

最终内部验收：reader自查65项、Pascal独立代码/QA及独立65项复跑通过；Dalton缓存/集成独立复核PASS、独立纯90项通过。
真实恢复118项覆盖组合预写屏障及原回收服务SUPERSEDED接续。非阻断C-CACHE-P3明确留E，未声称已覆盖显式回调重试/未知确认的会话计数。
固定1173源码文件的家庭回归141套件/3682项通过，零失败/跳过，exit0，565.081秒；前后哈希一致，六个核心文件匹配独立评审快照。
B的全部原测试源码及各套件用例数保持；新增三套件共273项。原始全名比对因动态UUID/日期及重复参数标题不适用，原失败比对与修正核验均保留。
不可变归档`release-gate-artifacts/t2-udr-c-final-2026-10-23/`保存源码、红绿/超时/独立复核、全量和哈希证据，不覆盖旧检查点。
仅关闭C内部增量，不关闭T2-G/D01/T2；D/E待实施，默认关闭、旧客户端拒绝、不部署/Git及DEVICE_PENDING保持。

## D：只读恢复预检及正式依赖装配

**文件**：新增 `services/userDeletionRecoveryReadiness.js`及测试；修改 `completionRetentionReadiness.js`、
`completionPrivacyReadiness.js`、`completionOperations.js`、`completionStorageReadiness.js`、`server.js`及现有装配测试。
**接口**：`assertUserDeletionRecoveryReadiness({connection,journal,writesPaused})`，原生只读；
恢复inspect零写输出固定reason/counts；正式启动不能调用restore或自动创建目录/补写日志。

- [ ] RED：双向数据库/外部日志核对、v1不足、v2丢失损坏、缺索引/build/prepareUnique/collation/TTL（UDR-009/010）。
- [ ] 实现只读预检、完整收尾与脱敏；新目录纳入祖先链/持久探针，旧模式拒绝新增不兼容状态。
- [ ] 正式enabled注入capture/journal，helper不挂路由；独立组件预检与正式装配测试；默认配置仍关闭。
- [ ] 独立评审与回归；同步API/运维文档，只更新已实现能力。

### D细分执行及兼容裁决

用户确认：正常enabled可保留经原契约校验的v1-only历史删除兼容；恢复检查遇v1-only必须报告
`LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`并保持维护隔离。任何已知v2缺失、冲突或数据库回退均不能降级。
不借兼容开关绕过v2证据校验，不要求默认legacy无配置环境新增日志目录；已知v2状态禁止旧writer启动。

D1（先行、暂不改调用方）：在`completionStorageReadiness.js`提取
`assertCompletionStorageStructure({env,userDeletionRecovery=false})`，只读检查完整祖先链、根权限和媒体/日志分离，
不执行open写/link/fsync/unlink探针。既有`assertCompletionStorageReadiness`复用同一检查后显式执行原探针。
`userDeletionRecovery:true`要求enabled模式且已存在安全的`user-deletions-v2/`，缺失时拒绝、不创建目录；
false保持既有两命名空间可选语义，若v2目录已存在也校验/探测，不忽略错误权限。
两个入口保持返回`{mediaRoot,journalRoot}`和固定`COMPLETION_STORAGE_NOT_READY`，不向外输出原错误。
测试扩展原storage套件：只读禁止全部FS写/同步且快照不变；v2存在/缺失/符号链接/权限/完整祖先链；
显式探针覆盖v2文件与目录同步/失败收尾，原所有fsync变异与负例不删减。
先RED再实现、自查、独立代码/QA复核；仅合成临时目录。可回滚未装配的入口提取，不改数据或环境。

D2：新增受保护流式日志清单及原生只读预检，区分在线兼容与严格恢复；数据库和外部目录双向核对。
每条证据按C会话边界验证，扫描全库不被误限为100份日志，也不一次读入全目录或持有所有证据。
实现前细化清单API、完整游标/文件句柄收尾及固定reason/counts；与C的只读reader组合，不导入writer模型。
D3：装配正式enabled DELETE/cleanup的v2 writer，启动及运维检查接入D2；内部inspect入口仅调用只读结构检查。
不把现有带探针的check/recovery命令改称零写，不新增公开HTTP接口；CLI入口如需扩展先单独明确契约。
D4：受影响装配回归、兼容/默认关闭门禁、文档与不可变证据，独立复核后才完成D内部增量，T2-G仍待用户验收。

D1自查：对照补充设计§4/5/7，仅分离检查与探针，不启用writer、不补建目录、不调整既有回滚限制；
返回和错误契约保持，强制v2选项暂不接入调用方，后续D3必须显式使用。
D1已完成内部步骤：独立实施前核对PASS；新增28例RED后，保留原29例共57项GREEN；
补六项文件/发布后目录/清理后目录fsync和await隔离变异后63项通过。
Pascal独立代码/QA PASS、独立63项通过；受影响五套件150项通过（exit0，26.687秒），没有跳过或失败。
证据归档`release-gate-artifacts/t2-udr-d1-2026-10-23/`；D2-D4未完成，D/T2-G/D01/T2仍OPEN。

### D2实施接口与验收细化（D2a/D2b实施前GO，未完成验收）

分两步，D2a先扩展既有reader，D2b新增`userDeletionRecoveryReadiness.js`及原生只读测试；
两步均RED→最小实现→自查→独立代码/QA→相关回归，D2a未通过前不装配D2b，D3尚不接入。
不导入writer/恢复planner/Mongoose，不改变C的read、会话、计费、缺失或错误语义，不新增CLI或HTTP接口。

D2a reader增加`inventory()`异步生成器，仅流式产生`{version:1|2,mediaId}`；不返回路径或正文，不构建全库数组/Set。
使用小缓冲opendir（32项）、已固定的祖先/目录句柄与路径身份复核，显式读取至EOF并finally关闭；
每次恢复迭代及EOF复核当前与先前扫描目录的身份/mtime/ctime，最初缺失v2须在结束时仍缺失。
BASE允许规范小写24hex.json及三个固定子目录uploads-v1/orphan-retirements-v1/user-deletions-v2；
不递归其他协议目录；文件需为0600普通文件，拒绝非规范名、未知项、符号链接和遗留临时文件，不清理它们。
清单中的文件后续读取返回null不能当作安全缺失；中途读取/关闭/目录变化均阻断，不承诺跨FS/DB原子快照。
应用、清理与日志writer在整个检查期停写是前置条件，路径式opendir不能被包装成对恶意同UID写者的保证。

增加`readLegacy(mediaId)`，复用同一个受保护文件内核，最多2MiB及一个增长检测字节，首次安全缺失可返回null。
按显式版本选择解码，不能用无v2 proof来猜测格式；v1保持原JSON.stringify加换行编码、精确字段、
ID/UUID/日期/role/purpose/reason/scope及receipt集合唯一性校验，返回脱离输入的完整投影，不生成v2。
有v2时仍只能走C组合读取与精确投影比较；readLegacy不能绕过已知v2错误，也不进入C恢复写流程。
测试：原C65项和预算语义保留；合法旧writer输出；非法/重复投影；大于100条独立清单流式完整遍历；
坏项/末尾读取失败/缺失和替换/祖先链/关闭及提前退出；禁止所有FS写和sync，原日志字节不变。

D2b `assertUserDeletionRecoveryReadiness({connection,journal,writesPaused,mode='enabled'})`，mode仅enabled/recovery，
journal提供read/createReadSession/inventory/readLegacy；非法参数或未停写在I/O前拒绝。
通过仅返回`{checked:true,scope:'user-deletion-recovery',counts}`，不返回ready:true。
内部`inspectUserDeletionRecovery({connection,journal,writesPaused})`固定recovery模式，返回
`{ready:false,complete,reasons,counts}`；complete表示遍历完成，不表示可以启用。
counts固定v1Files/v2Files/outboxes/tombstones/legacyOnly，各由对应外层扫描计数，不重复统计依赖；安全整数溢出拒绝。
reasons为固定白名单排序去重，不输出异常文本、ID、路径或证据。合法v1不足先记录并继续扫描，不能掩盖后续坏v2；
仅该不足时assert报LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT；损坏/IO中断为complete:false及固定脱敏原因。

原生前提复用common completionRetentionReadinessHelpers，检查事务、既有全部必要集合/完成索引及新outbox唯一mediaId，
拒绝build/prepareUnique/partial/sparse替代、非simple collation/TTL/额外唯一约束；不冷加载模型创建索引。
复用原生privacy预检，不建立反向循环依赖。完整outbox必须原始BSON类型正确、UUID_id=evidenceId、
scope/hash/完整证据/createdAt精确一致，restoredAt若有合法；墓碑、receipt原_id与首次审计、完整集合及RETIRED guard精确匹配。
现存资产必须已删除且固定上传身份一致；合法已清理资产/引用允许缺失，但不能缺审计、guard或实际账本。
逐个账本验证固定身份/完整集合/真实终态，使用C纯证明函数核验版本链；证据存在不代表其实际删除效果已应用。
同代次效果或合法后代次必须验证完整组（包括不重叠成员）、引用日期/释放/租约关系及其删除证明；
不导入或调用C写planner，不把“可恢复”的缺账本/缺guard当成“已就绪”，不隐式补写其他媒体。

顺序流式核对清单→DB outbox→DB tombstone，外部v2而整个DB删除记录丢失也必须发现；
任一已知v2路径禁止降级。v1-only仅在完整旧文件与原生旧事实一致时按用户裁决处理。
每个独立v2根创建一个C proof cache，目标及全部依赖共享100物理文件/16MiB预算，完成后释放；
全库数量不作为依赖限额。依赖按实际组成员和唯一mediaId查找，LIMITS+1界定单根工作集，不全目录读正文或递归跳过未验证节点。
每条依赖同时校验外部/DB证据及已应用事实；实际更高版本必须完整无分叉链，不能按最大版本或单receipt推断。
保留合法迟到version0、普通解绑不可猜造、系统删除冲突拒绝的既有规则；不调用homework或任何写退休接口。
测试包含外部/DB双向缺失、合法历史兼容与严格拒绝、坏v2不降级、原始BSON/索引反例、清理后事实、
完整版本链/缺边/分叉/未应用依赖/后代次非重叠成员、单根溢出与全库大于100独立根、零写及游标失败收尾、冷加载隔离和输出脱敏。

D2自查：已覆盖外部删除全丢与数据库单向扫描漏检、兼容模式与恢复资格分离、跨证据版本不等于损坏、
模型冷加载副作用及全库容量误限五类风险。回滚只撤销未装配的只读接口，不改日志/数据；失败保持维护隔离。
此为已批准范围的实施细化，独立核对前不进入D2编码，不据计划声称预检已完成。
Dalton分阶段核对结论：D2a reader-only GO，已交付独立实现者按测试先行实施；
D2b实施前独立核对亦已通过（`/tmp/lms-t2-udr-d2b-plan-review.md`），不代表代码或启动就绪验收。
采用根生产依赖中精确声明已锁定的`bson: 6.10.3`，不升级版本；使用其ObjectId构造原生查询，
不通过Mongoose或connection.base构造身份。补齐manifest/lock一致性、隔离omit-dev加载及真实模块冷加载保护。
D2a完成复核后才装配D2b；可独立先完成依赖准备。D3正式装配仍不在本次GO范围内，也不改变C恢复写入口。

D2a实施后独立代码/QA PASS：128/128（原C65完整保留），四项新增隔离变异有效；
主线程受影响回归4套件337项通过。bson依赖准备单独复核PASS，不代表尚未实现的原生模块通过。
不可变证据见`release-gate-artifacts/t2-udr-d2a-2026-10-23/`与执行记录§10.10。
允许继续已批准D2b实现；D2/D整体、D3装配及D4全量未完成。

### D3装配细化（实施前核对通过，等待D2b验收）

复用B的`recoveryJournal`注入正式enabled DELETE及cleanup，保留原v1 journal；与系统orphan-cleanup开关解耦。
组合只读reader使用BASE，v2 writer使用固定`user-deletions-v2/`；不混用系统retirement journal。
启动和运维检查保持原模型连接约束；正常路径用D2 enabled兼容检查，并显式验证v2目录后运行原持久探针。
现有`checkCompletionRecovery`是系统退休重试预检，保留其窄例外和探针，不将其称为严格备份只读检查。
新内部`inspectCompletionUserDeletionRecovery`仅用D1结构检查及D2 recovery模式，结构失败统一为
`USER_DELETION_READINESS_NOT_READY`，始终ready:false；不新增HTTP/CLI、不调用恢复器或writer。
legacy守卫同时核对原生outbox与已配置保留根中的外部v2（含DB删除事实全回退）；不解码成功也应阻断旧writer。
默认legacy未配置根时不新增目录/token要求；已配置但不安全或读取不完整必须拒绝，不能当作无v2。
公开边界沿用既有脱敏错误，不扩展CLI错误白名单。启用夹具显式准备索引/目录，运行时不得自动补建。
Dalton蓝图与Pascal独立方案核对PASS，记录`/tmp/lms-t2-udr-d3-wiring-blueprint.md`及
`/tmp/lms-t2-udr-d3-plan-review.md`；仅是已批准范围的装配细化，D2b代码/QA通过前不实施D3。
回滚必须保留原日志根和所有v2事实；有v2后不能删除证据或改回旧writer来制造legacy就绪。

## E：真实HTTP/BSON恢复与T2-G交付

**文件**：新增 `__tests__/userDeletionRecoveryHttp.test.js`，复用现有三服务真实工厂/回环监听；
同步执行记录§10和Gate§21，不重写历史档案。

- [ ] 原actor、同UUID不同actor、公开/远程丢响应、历史终态、精确receipt、发星幂等以及迟到upload拒绝。
- [ ] 删除前备份及外部日志真实回退、恢复、原actor接续、严格预检；原审计/完整媒体代次事实断言。
- [ ] 承接C-CACHE-P3：组合reader下显式重试事务回调与提交后丢应答各一例；断言同restore只创建一个读取会话、已读目标/依赖不重复打开、确认不刷新审计，下一次restore使用新会话。C已有依赖发现再入用例不替代这两个精度用例。
- [ ] 冻结源码后Node22家庭全量、文档门禁、默认配置检查及定向变异；失败报告全部保留。
- [ ] 开发自查、独立代码/QA评审、修订复核，归档命令/退出码/源码哈希；提交T2-G用户验收，不自行关闭。

## 执行命令与记录

定向：`node node_modules/jest/bin/jest.js --config=backend/services/resource-service/jest.family.config.js --runInBand --runTestsByPath <test paths> --json --outputFile=<new report>`。
全量：`npm run test:family-regression -- --json --outputFile=<new report>`；文档：`npm run docs:family:check`；格式：`git diff --check`。
统一使用Node22，临时报告 `/tmp/lms-t2-udr-*`；最终新建不可变归档，不覆盖此前G检查点。
计划自查：Spec §3→A/B，§4→B/D，§5→C/D/E，§6 UDR全部映射，§7回滚→D/E；不额外增加公开接口或任意时点恢复承诺。
独立计划核对（Dalton）：A可推进，无范围扩大；指出B真实重叠事务和C系统交叉状态两个P2清单缺口，已补上明确正反验收，不重开设计审批。
