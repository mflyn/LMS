# AI2-5 正式应用接线候选

**2026-11-04当前摘要：** PUB-02/VIEW-01及WITHDRAW-01/02、MEDIA-04补验已获用户ACCEPTED / USER_APPROVED；
矩阵首页P3已修正。31项核心覆盖、最新独立9/3复验和两批冻结身份见[批准记录与关闭材料](closure-readiness.md)。
2026-11-04用户随后明确批准AI2-5汇总及AI-2总门禁CLOSED / ENGINEERING_SYNTHETIC_ONLY；真机、真实启用、其他OPEN门禁及后置范围不变。下方分批进度、OPEN和计数保留为历史快照，不覆盖本摘要。

当前状态：正式接线子批ACCEPTED / USER_APPROVED（限定本地合成），异步连续性P2 CLOSED / USER_APPROVED；
浏览器子批ACCEPTED / USER_APPROVED（限定本地合成），同URL回看及recovery保护P2 CLOSED / USER_APPROVED；
AI2-5汇总仍IMPLEMENTING、AI-2 OPEN。最新已归并31项矩阵并补AI1人工修订/批准到发布的真实合成连接，
连接候选2026-11-04用户批准ACCEPTED；三项测试保护P2 CLOSED / USER_APPROVED。本轮独立四格4通过79.73秒，原失败与冻结身份保留。

2026-11-04后续[新UUID竞争与终态重放补验](concurrency-acceptance.md)：只改两测试、增加9项，最终homework AI2 10套188通过；
该增量现已获用户ACCEPTED，异常收尾测试P2 CLOSED / USER_APPROVED，绑定最新独立9项复验；见其末节批准记录。AI2-5 IMPLEMENTING、AI-2 OPEN。
最新11行部分覆盖仍公开保留，不能直接申请全部满足的总门禁关闭；旧14行计数保留为桥接批次快照。
发布版本/来源快照/输入边界补验已于2026-11-04获用户批准，见[批准及证据](publication-boundaries.md#2026-11-04-用户批准及本轮复验证据)：开发206/204与最新独立18/3分别保留，不关闭总门禁。最新覆盖增量以矩阵后续章节为准，旧11行计数保留阶段身份。

接续[实时权限与恢复补验](auth-recovery-boundaries.md)：用户已批准本批及P3关闭，开发215/211与最新独立9/7分开，冻结与复验证据绑定于批准记录；历史失败保留。当前PUB-02/VIEW-01增量见[发布拒绝与孩子DTO补验](publication-visibility.md)，最新矩阵以末节为准，不关闭AI-2。
PUB-02/VIEW-01：开发220/10、独立5/2通过，三项变异有效；两测试只增不删，USER_REVIEW_PENDING。
最新28核心/3部分；WITHDRAW-01/02、MEDIA-04未完成。新AI2-VIEW-NB-001非阻断断言建议单独登记，原两项非阻断补测不变。
接续[WITHDRAW-01/02、MEDIA-04补验](withdrawal-privacy.md)：新增7项，开发224/53、独立4/3分层记录，旧28/3为上一批快照。
最新覆盖以矩阵末节及本批评审结论为准；本批与PUB-02/VIEW-01仍待用户验收，AI-2 OPEN。
本轮独立复评SCOPED_PASS支持最新31核心/0部分，仅为限定覆盖归并；不替代两批用户验收或总门禁关闭授权。
见[连接验收](bridge-acceptance.md)及[矩阵增量](matrix-reconciliation.md#7-桥接补验后的覆盖增量)。
以下接线批准、运行中观察及冻结哈希均保留为历史快照；当前结论见[浏览器批次批准与剩余条件](browser-acceptance.md#浏览器批次批准与剩余条件)。
AI2-4已获用户批准为ACCEPTED，草稿刷新P2为CLOSED / USER_APPROVED，见[上一批批准记录](../ai2-4-20261103/draft-refresh-p2.md#用户批准与最新主线程复验)。
本批不调用模型、不提交推送、不部署；T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收REMAINDER_DEFERRED、T9 NOT_STARTED保持。

## 实现范围

- Gateway正式代理`/api/ai2`：JWT、签名身份、服务凭据剥离、32 KiB原始UTF-8 JSON；内部路径不公开。
- homework正式工厂挂载公共AI2路由、内部media-access-check，复用真实sourceReader与completion client；
  新metadata client通过内部HTTP读取完整有序描述符，拒绝缺项/乱序/错误类型/额外字段/重定向及错误响应。
  家长只传`id/role`，家庭归属仍以实时数据库为准；孩子保留并核验当前家庭、孩子及tokenVersion。
- resource正式工厂装配用途开关、权限回查和只读metadata接口，保留UploadGuard、事务、日志、删除凭证及启动预检。
  `HOMEWORK_SERVICE_URL`及已有`MEDIA_REFERENCE_SERVICE_TOKEN`用于内部回查，不新增浏览器凭据。
- 两服务`AI2_MODE`默认off、`AI2_STORE_CONTINUOUS`默认false；启用及保留历史读取均须连续仓库和completion enabled。
  未预检/断连/连续性不明拒绝AI2读取、上传、删除及内部恢复；off且连续性true保留历史回看、撤回、精确收尾及隐私删除。
  已有AI2数据不能退入legacy写入路径；maintenance保留认证后拒绝且不误阻断旧健康检查。

上传关闭的拒绝点在mediaService及durable upload。既有multipart解析器仍可能先产生受限临时文件，随后finally清理；
不把“未建立媒体/guard/journal记录”写成“零临时字节”。不改变旧任务/错题/PDF用途。

## 冻结与回滚边界

归档均在本机原项目`release-gate-artifacts/`，不纳入Git：

| 对象 | 绑定 |
| --- | --- |
| 基线 | `4655d30f1b61b55f400b67f16f9143dd191de1d2` |
| 原85文件候选 | `ai2-5-assembly-20261103/candidate.json`，SHA-256 `1affded2371a6ed1ac729f59d8dc727daba31e112ed8cb2cebf53a72e50625f9`；保留异步隔离P2，不作最终通过候选 |
| 修订后86文件候选 | `ai2-5-assembly-final-20261103/candidate.json`，SHA-256 `b6b22e3c6992bc12da0fdcbcb6742cd4c416c7def64a0ef9bf0a03ea310920cf` |
| 修订后累计补丁 | `ai2-5-assembly-final-20261103/code-candidate.patch`，SHA-256 `7519d55c87ffd9296a5b94c4ab308505c0f6a9cb6f678fd643b627a6d21e0c59` |

累计补丁包含AI2-2/3/4及本批，排除无关T8增量；86文件均由基线加补丁重建并核对哈希。
AI2-4的17个前端文件逐字节不变，保留上一批1000项前端回归及替身浏览器的原范围，不冒称本批重跑。
没有真实数据迁移。无新数据时可回退本批接线；已有AI2数据时只关新写入、保留兼容reader和删除/恢复路径，
不直接退到不认识AI2数据的旧二进制，不自动清理或回滚数据库。

## 本批异步隔离P2

独立评审发现：入口连续性检查通过后，在文件读取期间切入隔离，家长/孩子正文及inspect描述符仍可返回。
旧探针三项均复现；使用真实runtime、mediaService和capability，数据库/存储边界是合成替身，不是正式HTTP。
修复只在四处最终返回点复查连续性：capability签发前、正文返回前、整个metadata返回前、metadata HTTP成功响应前。
没有重构普通并发撤权或其他媒体用途。

新增`ai2ContinuityReads.test.js`六个永久用例覆盖家长/未绑定孩子正文、capability、available/deleted描述符、
路由响应，以及off+continuous=true和旧用途正例。四处逐项去掉检查，均5通过/1失败，精确命中对应反例；
还原后6通过。独立复跑6通过，原探针逐字节副本三项均拒绝、返回字节/项数为0；原失败JSON未覆盖。
本P2为FIXED_REVIEWED，待用户复审，不借AI2-4的批准提前关闭本批问题。

## 验证口径与剩余项

正式HTTP用真实Gateway、homework/resource的`startServer`、临时MongoMemoryReplSet及私有媒体/journal目录；
保留实际启动预检和正式服务间HTTP，不注入业务service或媒体成功替身。仅AI1人工批准artifact预置为合成记录，
JWT由合成账号签发，日志输出改到测试runner；未运行真实登录页面或Provider。
覆盖发布—上传—提交—审核—回看—撤回、正常删除及精确凭证、缺描述符拒绝、兄弟/外家庭/PIN失效和内部路由拒绝，
以及真实GrowthTask来源预览后失效阻止发布。较早factory/manual-readiness运行与最终startServer运行分别保留。

### 最终候选验证

以下命令使用本机既有Node22和依赖；完整回归等价于现有`npm run test:family-regression`，
仅额外指定JSON输出。未执行legacy全量、发布流水线、真实模型或真实浏览器验收，不将本轮写成全仓发布全绿。

| 验证 | 命令/证据 | 实际结果 |
| --- | --- | --- |
| 家庭后端完整回归 | `node node_modules/jest/bin/jest.js --config=backend/jest.config.js --coverage=false --selectProjects family-common user-service homework-service progress-service resource-family analytics-family analytics-attachments notification-family --runInBand`；`validation/family-full-final.json` | exit0，185 suites / 5554 tests通过，0失败/跳过；977.394秒 |
| Gateway完整回归 | `node node_modules/jest/bin/jest.js --config=backend/gateway/jest.config.js --runInBand`；`validation/gateway-regression.json` | exit0，14 suites / 132 tests通过；独立AI1/AI2代理专项87通过，不与全量相加 |
| 正式三服务HTTP | `--config=backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/ai2FormalHttp.test.js`；`validation/formal-http-final.json` | 4通过，最终家庭全量再次包含本套件 |
| 异步隔离P2 | `validation/resource-inflight-green.json`及`review/p2-continuity-recheck-20261103/` | 开发及独立6通过；四处逐项变异各1失败/5通过；原探针副本3项均拒绝 |
| lint | `node node_modules/eslint/bin/eslint.js .`；`validation/lint-final.log` | exit0 |
| 文档状态 | `node scripts/check-family-docs.js`；`validation/docs-final.log` | exit0，412 contract fixture cases、38 requirements通过 |
| 补丁格式与重建 | `git diff --check`及冻结补丁逐文件重建 | exit0；86文件哈希一致 |

全量包含新增正式装配/HTTP/连续性保护及既有完成作品、权限、删除、恢复预检等共享路径。
未改写旧证据的测试计数，重叠执行不累计成不同用例。
最终源码的独立正式HTTP复验4通过、exit0；命令与退出记录在
`validation/review/final-formal/execution.json`，结果在同目录`ai2-formal-http.json`。
冻结源码/断言与文档边界的独立静态复核位于`validation/review/final-freeze-doc-review-20261103/`；
其中较早静态快照记录全量仍在运行，不覆盖该历史快照，最终执行结果以上表及各执行JSON为准。

早期夹具语法、日志目录EPERM、默认关闭兼容及真实产品红灯均保留并区分。
首次完整回归因worktree根依赖缺失、旧uuid绝对映射加载失败中止，exit130，INCOMPLETE_ENVIRONMENT_FAILURE；
临时复用既有依赖，不安装/升级、不改断言或超时；确认取消后未遗留本轮Jest/Mongo临时进程，未操作系统既有Mongo。

AI2-5剩余：正式服务驱动的真实浏览器闭环、页面刷新/重登/原命令未知结果恢复及账号隔离/审核冲突验收、
对应前端回归与构建、汇总验收材料和用户批准。已有API替身浏览器不能替代；真机继续DEVICE_PENDING。

## 正式接线用户批准与浏览器接续

2026-11-03，用户批准AI2-5正式应用接线限定合成子批验收，并批准异步连续性（上文异步隔离）P2关闭。
正式接线ACCEPTED / USER_APPROVED，P2 CLOSED / USER_APPROVED；批准不扩展为整个AI2-5或AI-2验收。
绑定86文件候选`b6b22e3c6992bc12da0fdcbcb6742cd4c416c7def64a0ef9bf0a03ea310920cf`及上文累计补丁，
保留旧85文件候选、原失败、133份历史证据清单和8份旧文档快照；不回写任何旧manifest或冻结哈希。

最新独立复核来源`/private/tmp/ai25-review-current/`，报告与原始JSON/log核对一致：

| 独立实际复验 | 套件 / 通过 | 结果 |
| --- | --- | --- |
| homework正式HTTP/装配/runtime/metadata client | 4 / 86 | 0失败/跳过；正式HTTP4项已包含，不另加 |
| resource装配/metadata/连续性 | 3 / 68 | 0失败/跳过 |
| Gateway AI1/AI2代理 | 2 / 87 | 0失败/跳过 |
| 合计 | 9 / 241 | 独立执行，不冒称本次文档更新重跑 |

独立verification绑定候选/补丁与三份Jest JSON哈希，并记录86文件重建核验。
家庭完整回归185套5554项及Gateway全量14套132项仅核验归档，未在该次独立复核或本次文档更新中重跑；
四处历史guard变异也仅核对既有证据，不与241项累计。此次不执行归档verify.cjs或任何测试。

最新复核10份文件（verification、review、verify脚本、三组JSON/log及docs.log）原样归档到
`release-gate-artifacts/ai2-5-assembly-final-20261103/review/approval-independent-20261103-2154/`，
由新`review-manifest.json`绑定候选、原manifest指纹、本轮证据及四份更新文档；旧133份manifest及旧document-manifest不变。
verification.json SHA-256：`3b38eaa385c80b5b19215ff14786bb8b267088defaaec1e134f1922270fd2b38`。

用户同时授权正式服务驱动的浏览器验证，下一步由主线程独立实现browser fixture/test、执行并追加结果。
范围仍为正式服务闭环、刷新/重登/原命令未知结果恢复、账号隔离/审核冲突及相应前端回归/构建；
本次只记录授权，不增加代码或测试、不宣称浏览器通过，不以此前API替身或正式HTTP通过替代浏览器验收。
AI2-5整体IMPLEMENTING、AI-2 OPEN；T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收REMAINDER_DEFERRED与T9 NOT_STARTED保持。
不调用模型、不执行Git或部署，不新增审批框架；整批验收仍依后续真实执行证据和用户批准。

## 正式浏览器候选进展

2026-11-03已取得主线程Chromium最终8项通过，零跳过/重试；runtime 6、共享T2 HTTP 6套36、
前端全量64套1003通过，生产构建成功并保留旧caniuse警告。独立两组件35通过，两个Link handler逐处变异
分别2失败/33通过及1失败/34通过；recovery四例补`unchanged()`经独立静态复核及主线程最终8项执行。
新同URL回看P2与recovery保护P2均待本轮用户复审，不影响已批准关闭的接线异步连续性P2，也不自动CLOSED。
真实链路包括Gateway/user/homework/resource/progress/analytics/notification、Mongo/media/fs/auth/login；
AI1仅预置人工批准合成artifact，query-only及拒绝sentinel零调用。仅丢响应/延迟/abort上传作故障注入，无业务成功替身或Provider调用。

pre-WebKit的92文件快照`06c6d407c0a002f79f40287c0baed354ec21d6c4279d0bc02ad127f2b96b9b32`，
累计patch `2163fccea488fc1aea225d20549bde9d0c3ae0e2959e6b83a63430621d676464`，相对接线9变更/新增，无关T8排除。
已知日志/JSON另归档`release-gate-artifacts/ai2-5-browser-20261103/validation/`，
不复制build/独立临时源码，不改旧approval manifest；矩阵、历史红灯与档案绑定见[browser-acceptance.md](browser-acceptance.md)。
独立WebKit初轮由Kepler执行中，四项主/边界场景在最终健康断言失败，初步定位登录后立即硬导航中断Today请求产生access-control pageerror。
待本轮结束后主线程按既有等待Today初始化响应模式修helper，保留errors断言并新冻结候选；本次不改helper，不写最终hash。
旧06c6快照和失败保留；WebKit完整结果、修订后验证及档案绑定待补，不能写全绿。
AI2-5整体IMPLEMENTING、浏览器候选待用户复审、AI-2 OPEN及其他历史边界不变。

## WebKit修订后最新候选

初轮独立WebKit最终7失败/1通过、exit1；七项均在errors健康断言发现初始化请求被硬导航中断，
旧92源码/构建hash前后一致、无本轮新增进程遗留。main仅修login夹具等待真实Today初始化GET均200且finished为null，
未动产品/原健康断言/超时；定向WebKit主链路1通过、14.7秒，随后独立完整WebKit8通过、1.7分钟，零跳过/重试。
新92文件候选`54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a`，
patch `9a760baacb605d94fc5fdc7efe8ee0eb9ba9721dbdea145caf56830fe295aeee`；相对pre-WebKit仅fixture变化，相对assembly仍9项增量。
新目录`ai2-5-browser-final-20261103`与旧06c6快照分开；两项本轮P2均FIXED_REVIEWED待用户，不CLOSED。
同候选main Chromium最终8通过、exit0、99.541秒（`chromium-verified.json/.log`），独立WebKit8通过、exit0、101.656秒；均零跳过/重试。
`independent/webkit-final-verification.json`确认92源码/8构建文件/config前后哈希一致，本轮process/root无残留，旧root不动；收尾已完成。
最初pre-WebKit Chromium8及独立WebKit7失败/1通过仍是历史快照，不改写为本次结果。
`execution-summary.json`区分本批既有frontend 64/1003、HTTP 6/36与此前backend 185/5554；这些不是最终双浏览器阶段的新重跑。
实际Node22、NODE_PATH/T2_WEB_BUILD及现有Playwright配置三个spec入口见[执行命令](browser-acceptance.md#实际命令入口)，WebKit增加`--browser=webkit`。
main全仓lint-final报告exit0且日志无输出；细节见[最新记录](browser-acceptance.md#最新冻结与webkit复验)。
本次不重复归档、不改旧approval manifest；final目录validation及manifest由main统一完成并另补哈希。
本地正式浏览器候选已完成待复审；两项新P2 FIXED_REVIEWED / USER_REVIEW_PENDING，AI2-5 IMPLEMENTING、AI-2 OPEN与旧边界不变。
