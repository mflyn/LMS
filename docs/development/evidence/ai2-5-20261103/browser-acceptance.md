# AI2-5 正式浏览器验收候选

当前状态：本地正式浏览器批次ACCEPTED / USER_APPROVED（限定合成），同URL回看P2及recovery不变量保护P2 CLOSED / USER_APPROVED。
正式接线子批ACCEPTED及原异步连续性P2 CLOSED / USER_APPROVED保持；AI2-5汇总仍IMPLEMENTING，AI-2总门禁OPEN。
最新独立复审：同一冻结候选组件35通过、WebKit8通过（110.124秒），用户随后批准本批及两项P2关闭。
本批批准范围、证据绑定及批准时剩余项以文末[浏览器批次批准与剩余条件](#浏览器批次批准与剩余条件)为准。
后续已执行的矩阵归并与AI1到AI2正式连接增量见[连接验收记录](bridge-acceptance.md)，本文件旧剩余表保留为批准时快照。
以下pre-WebKit快照和运行中观察均为保留的历史记录，不作为当前最终结论。
历史批准见[正式接线记录](README.md#正式接线用户批准与浏览器接续)，本文仅追加本轮已取得的结果。

## Pre-WebKit冻结快照

原项目归档：`release-gate-artifacts/ai2-5-browser-20261103/`，仅本机，不纳入Git。

| 对象 | SHA-256 / 范围 |
| --- | --- |
| candidate.json | `06c6d407c0a002f79f40287c0baed354ec21d6c4279d0bc02ad127f2b96b9b32` |
| code-candidate.patch | `2163fccea488fc1aea225d20549bde9d0c3ae0e2959e6b83a63430621d676464` |
| 上一正式接线candidate | `b6b22e3c6992bc12da0fdcbcb6742cd4c416c7def64a0ef9bf0a03ea310920cf` |
| 快照范围 | 累计92文件，相对正式接线9项变更/新增；无关T8增量排除；不是修订后的最终候选 |

本次文档更新只读重算candidate/patch及92个当前文件哈希，均与冻结清单匹配；没有重新运行冻结重建脚本。
旧正式接线candidate、133份证据manifest、旧document-manifest及approval review-manifest保持原字节，
其文档哈希是当时快照，不回写为本轮文档内容。

## 真实链路与替身边界

主链路使用真实Gateway、user、homework、resource、progress、analytics、notification应用，
真实临时Mongo、媒体文件系统、认证及登录/PIN流程；浏览器运行生产前端构建，不以业务成功API替身完成闭环。
AI1仅预置人工批准的合成artifact，配置query-only；operation目标为拒绝请求的本地sentinel，断言调用数为零，
没有Provider或模型调用，也不构成真实AI1生成验收。

故障注入仅丢弃真实成功响应、延迟真实上游响应或abort一次上传；不伪造发布、提交、审核或媒体成功结果。
无关外部请求受拦截。普通移除上传项不等同于隐私删除，已成功上传内容不得因部分失败或刷新自动丢失。
`runtime.unchanged()`同时核对sentinel零调用和既有Task/Ledger/Mistake/MistakeStateEvent/DailyPlan不变；
AI1仅允许唯一发布来源Cycle的一次stateVersion增量及非递减updatedAt，其余内容/预算/集合不变，不笼统声称Cycle完全无写。
桌面、窄屏及iPad视口是浏览器模拟，不是真机；DEVICE_PENDING保持。

## 已取得的执行结果

原始产物来自`/private/tmp/ai25-browser/`；下列为主线程实际执行产物，文档更新者仅核对JSON/log，不重跑测试或浏览器。

| 验证 | 产物 | 结果及口径 |
| --- | --- | --- |
| Chromium最终浏览器 | chromium-final.json/log | 8通过，0跳过/重试/意外失败/flaky；每项单次retry=0；103.768秒 |
| T2 runtime | runtime-green.json/log | 1套6通过，0失败/跳过 |
| 共享T2 HTTP完整范围 | t2-full.json/log | 6套36通过，0失败/跳过；不称全仓后端全量 |
| 前端既定非legacy全量 | frontend-full.json/log | 64套1003通过，0失败/跳过 |
| 同URL组件修复后 | same-url-green.json/log | 两组件套件35通过，含新增3个永久反例 |
| 生产构建 | build-fixed.log | Compiled successfully；保留旧caniuse-lite数据陈旧警告，不安装/升级依赖 |
| lint修订后 | lint-fixed.log、lint-full.log | 主线程报告通过；原browser globals失败日志保留，新增文件scope声明而非关闭规则 |
| 独立组件复验 | independent/baseline.json/log | 两套35通过，0失败/跳过；独立execution记录exit0 |
| 独立结果回看Link变异 | independent/mutant-result-link.json/log | 单独移除对应handler：2失败/33通过，exit1，命中提交后及家长审核后同URL回看 |
| 独立列表回看Link变异 | independent/mutant-list-link.json/log | 单独移除对应handler：1失败/34通过，exit1，命中显式查看学习包内容 |
| 独立recovery补强复核 | independent/recovery-p2-static-recheck.json | 静态复核通过，独立评审者未执行浏览器；主线程最终Chromium 8项已包含补强后的四recovery例 |
| 独立WebKit初轮 | Kepler执行中，已报告失败 | 四项主链路/边界场景到最后健康断言后失败；完整8项结果/退出/重试待本轮结束，当前不计全绿 |

35/36/1003及各历史执行存在重叠，不累计成不同覆盖数。独立35项与变异不是独立浏览器结果。
上一接线185套5554项、Gateway14套132项及9套241项独立复验仍是历史证据，本轮没有重跑这些全量。
Chromium日志含NO_COLOR/FORCE_COLOR环境警告；部分上传故障为明确注入，不将所有负向场景描述成零网络错误。

### Chromium八项矩阵

1. 完整发布、退回、再次订正、通过、回看、隐私删除及撤回。
2. 共管家长审核冲突：旧详情清除，首次审核记录保留，必须显式重看。
3. 家长切孩子清私有视图，兄弟孩子通过真实PIN登录后详情/媒体读取被拒。
4. 部分上传失败在手动/focus刷新后保留成功项和失败队列，仍锁定提交；普通移除不触发隐私删除。
5. 公共成功响应丢失：原正文/UUID精确重试，无第二个Attempt。
6. 远端commit成功响应丢失：真实PIN重登后只读发现，显式恢复原命令才发布，原映射保持。
7. 同一浏览器context跨标签退出/兄弟登录后，迟到成功详情GET不得恢复旧身份私有视图。
8. 相同跨标签身份边界下，迟到认证媒体响应不得恢复旧身份私有内容。

## 本轮P2与复核状态

同URL回看P2：首次真实浏览器在提交后点击原URL的回看Link，未重新加载详情，等待审核标题未出现。
已补显式Link回看handler和3个永久组件反例；旧实现3红，修复后组件35绿、独立35绿，
两个handler逐处移除分别2红/33绿及1红/34绿，测试断言未放宽。状态FIXED_REVIEWED / USER_REVIEW_PENDING，不CLOSED。

recovery不变量保护P2：独立静态评审发现四个recovery场景缺少`runtime.unchanged()`，
仅AI2/media快照与浏览器请求观察不足以保护AI1及其他学习记录或发现后端sentinel调用。
已新增三处调用覆盖两个独立例及GET/media参数化两例；移除新增调用后原断言/清理逻辑逐字节保持。
独立后续记录为FIXED_REVIEWED_STATIC，随后主线程最终8项实际通过；不将静态复核写成独立浏览器执行。
状态FIXED_REVIEWED / USER_REVIEW_PENDING，不借上一批P2批准提前关闭。

## 历史失败保留

| 原始产物 | 当时结果及归因 |
| --- | --- |
| runtime-red.json/log | 1失败/5跳过；合成环境隔离断言预期AI模式off、实际继承enabled，保留真实断言红灯，不将5项算通过 |
| same-url-red.json/log | 3失败/28未选中，真实同URL回看缺陷的组件红灯；不将未选中项算通过 |
| first.log | 浏览器1失败，真实产品同URL回看缺陷，不改写为单纯环境问题 |
| fixed.log | 浏览器1失败，夹具把发布所需Cycle CAS也当作完全不变；修订为精确允许一次CAS，其余不变量保留 |
| matrix.log | 1失败/7通过，说明输入框label精确定位失败；改用精确可访问名称textbox定位，原值保持断言保留 |
| lint.log | 首次11项browser globals no-undef失败；仅限定新e2e文件scope声明，未关规则 |

旧日志/JSON与独立首评发现均保留，最终成功不覆盖这些失败。早期skip/未选中口径只属于对应历史运行，
不与最终Chromium零skip混写。

## 当前归档与待补证据

本轮已知36份log/JSON（含独立组件/静态复核、历史失败及Playwright last-run）归档到新候选目录`validation/`，
由`validation/pre-webkit-manifest.json`绑定原始字节、pre-WebKit候选身份和本轮五份文档快照，不发布最终候选hash。
只归档已知运行产物；不复制build目录、独立临时源码/变异工作副本或安装依赖，不执行归档脚本。
截图及错误上下文仍在原始临时目录，未计入该log/JSON清单；不将未归档内容写成已冻结。
旧approval manifest保持原哈希，不追加或回写；WebKit及后续文档/档案指纹另以增量证据补充。

### WebKit初轮失败观察与接续

主线程最新报告：四项主链路/边界场景均跑到最后健康断言后失败；WebKit在登录后立即`page.goto`硬卸载Today，
未完成的daily-learning-plan请求生成access-control pageerror。此为运行中观察及当前归因，不替代完整退出结果。
拟待本轮结束后，沿用既有`help.spec.js`第209行附近的等待Today初始化响应再导航方式修测试helper，
保留原errors健康断言，不过滤/忽略pageerror、不放宽规则。本次文档更新不实施该修订，也不声称其已验证。
helper修订后必须新冻结候选并绑定实际重跑证据；旧`06c6d407...`及本轮所有红灯保留为历史快照。
目前不写最终candidate/patch/档案hash；待主线程补齐本轮WebKit原始JSON/log和完整结果，再追加修订与新冻结身份。
当前Chromium已知8项通过不抵销WebKit初轮失败，整个浏览器候选待用户复审；AI2-5 IMPLEMENTING、AI-2 OPEN。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED与T9 NOT_STARTED保持；不调用模型、不执行Git或部署，不新设审批框架。

## 最新冻结与WebKit复验

### 初轮完整失败与限定修订

初轮独立WebKit实际7失败/1通过、exit1，零跳过/重试，155.911秒；
证据为`/private/tmp/ai25-browser/webkit-independent.json/.log`及`independent/webkit-verification.json`。
七项均在`seen.errors`相关健康断言发现Today初始化请求的access-control pageerror；初轮独立报告本身未确证根因，
主线程后续确认登录后硬导航中断尚未完成的初始化请求。失败后的断言（包括部分unchanged检查）未执行，不按业务步骤完成计通过。
初轮92个源码及8个构建文件指纹前后一致，独立报告核实本轮新增worker/browser/Mongo及runtime目录无遗留；旧系统进程未动。

main仅修改`ai2Fixture.js`的login helper：登录动作前注册真实GET响应等待，覆盖`scope=today`任务、
`status=pending`候选任务、notifications、dailyplan（路径明确childId），parent另等weekly/mistakes。
每项必须HTTP200且`response.finished()`为null后才允许后续导航，不再硬卸载这些在途初始化请求。
未改产品业务、原健康/errors断言或120秒超时；不是过滤pageerror或放宽通过条件。
本轮WebKit修订只有夹具变化，产品源码仍仅此前两个Link回看handler的增量。
修订后main定向WebKit主链路1通过，14.7秒；该单项不替代完整矩阵。

### 新冻结身份与当前执行

新归档目录`release-gate-artifacts/ai2-5-browser-final-20261103/`，与pre-WebKit原目录分开：

| 对象 | SHA-256 / 范围 |
| --- | --- |
| candidate.json | `54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a` |
| code-candidate.patch | `9a760baacb605d94fc5fdc7efe8ee0eb9ba9721dbdea145caf56830fe295aeee` |
| 文件范围 | 92文件，相对正式接线9项变更/新增；相对pre-WebKit仅tests/e2e/t2/ai2Fixture.js变化 |

文档更新者已只读核对新candidate/patch哈希和92个当前文件，未重跑测试或重建补丁。
旧`06c6d407...`、旧stage/pre-WebKit档案和approval manifest不改，初轮7失败/1通过永久保留。

新候选独立WebKit完整8项已通过，`webkit-final.json/.log`：101.656秒（日志1.7分钟），
0跳过/重试/flaky/意外失败，八项均保留120000ms超时且单次retry=0；真实WebKit启动与正常关闭可从日志核对。
登录初始化等待修订后原健康断言实际通过，但不扩展为任意硬导航或WebKit引擎问题的普遍修复。
同一新候选main Chromium最终8项通过、exit0，`chromium-verified.json/.log`记录99.541秒，0跳过/重试/flaky/意外失败。
独立`independent/webkit-final-verification.json`已完成收尾核验：92个源码、8个构建文件及config前后哈希一致，
无本轮新增测试process/runtime root残留；旧root及系统Mongo未动。main已停止本次运行。
main报告本轮全仓lint-final exit0，`lint-final.log`为零字节；本次未重跑lint。
此前`chromium-final.json`的8项属于pre-WebKit快照，与本次`chromium-verified.json`分开保留；初轮独立WebKit7失败/1通过不改写。
`execution-summary.json`汇总本批证据。frontend 64套1003及共享T2 HTTP 6套36是本浏览器批次已有执行，
不是最终双浏览器复验阶段重新运行；旧backend 185套5554及Gateway 14套132是此前正式接线归档证据，本轮未重跑。

主线程已将最终证据归档至`release-gate-artifacts/ai2-5-browser-final-20261103/validation/`，
由同目录上级的`evidence-manifest.json`绑定候选及逐文件SHA-256；文档快照另由`document-manifest.json`绑定。
本节文档更新者不重复复制证据或改写任何旧manifest；最终校验由主线程执行。
同URL回看P2、recovery不变量保护P2均FIXED_REVIEWED / USER_REVIEW_PENDING，不CLOSED。
AI2-5整体IMPLEMENTING、本地正式浏览器候选已完成待用户复审、AI-2 OPEN；所有其他OPEN/DEVICE_PENDING/历史失败与后置边界保持。

### 实际命令入口

工作目录为本工作树根目录，使用既有Node 22及原仓依赖，不安装依赖。
`LMS_NODE_MODULES`指向本机既有根依赖目录，实际绝对路径仅在本地执行证据中保留。Chromium入口如下；
独立WebKit使用同一配置、三个spec和环境，在`test`后增加`--browser=webkit`，输出名改为`webkit-final`。
保留现有配置的120000ms超时、1 worker及零重试；精确执行结果与日志索引见`execution-summary.json`及独立复验报告。

```sh
NODE_PATH="$LMS_NODE_MODULES" \
T2_WEB_BUILD=/private/tmp/ai25-browser/build \
T2_BROWSER_OUTPUT=/private/tmp/ai25-browser/chromium-verified \
PLAYWRIGHT_JSON_OUTPUT_FILE=/private/tmp/ai25-browser/chromium-verified.json \
/usr/local/bin/node "$LMS_NODE_MODULES/@playwright/test/cli.js" test \
  --config=playwright.t2.config.js --reporter=list,json \
  tests/e2e/t2/ai2FormalPage.spec.js \
  tests/e2e/t2/ai2FormalRecovery.spec.js \
  tests/e2e/t2/ai2FormalBoundaries.spec.js
```

独立WebKit另设`DEBUG=pw:browser`保留真实浏览器启动/退出日志；本次文档收尾没有再次执行上述命令。

## 浏览器批次批准与剩余条件

2026-11-03，用户在独立复审通过后明确批准本批浏览器验收及两项P2关闭，并要求核对AI-2剩余条件，
不以本批通过关闭总门禁。浏览器子批ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY；
同URL回看P2、recovery不变量保护P2均CLOSED / USER_APPROVED。AI2-5汇总仍IMPLEMENTING、AI-2 OPEN。
上文待复审、运行中观察及失败均为原始历史快照，不回写原候选或证据清单。

批准绑定candidate `54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a`、
patch `9a760baacb605d94fc5fdc7efe8ee0eb9ba9721dbdea145caf56830fe295aeee`。
最新独立复审原目录为`/private/tmp/ai25-review-1gbzLJ/`，20份原始产物（含截图及隐藏last-run文件）
逐字节归档至原项目`release-gate-artifacts/ai2-5-browser-final-20261103/review/user-approved-20261103/`；
新增`manifest.json` SHA-256为`7cff9dafe168f9f24532a33d0b0d6735fba28abcd6706bdf60f5cac982677886`。
该增量清单不替换原134份证据manifest或9份文档快照；文档当前内容与旧快照不同是本次批准更新，不是旧证据失效。

| 独立复审内容 | 实际结果及边界 |
| --- | --- |
| 冻结及重建 | 92源码、134证据、9文档及8构建文件哈希匹配；从固定基线加补丁重建92文件一致；测试后源码不变，source map中页面源码与候选相同 |
| 组件 | `react-scripts test --watchAll=false --runInBand --runTestsByPath`运行Ai2LearningPage与Ai2DraftRefresh：2套35通过、0失败/跳过 |
| 正式浏览器 | 原三个spec及`playwright.t2.config.js --browser=webkit`，8通过、0失败/跳过/重试/flaky，110.124秒，exit0；真实七服务、临时库/媒体，模型零调用 |
| 两项P2 | 同URL两个入口及三永久反例通过；归档逐handler变异分别2失败/33通过和1失败/34通过，未在本次重跑；恢复四例实际执行unchanged断言，原映射/原命令及收尾保持 |
| 文档与格式 | 状态检查及diff check通过；首次未设置NODE_PATH导致dotenv缺失，使用既有依赖路径后通过，未安装或改规则 |

本次批准记录更新只核对上述既有复审产物，不重复执行产品测试。Chromium8、前端64套1003、
共享HTTP6套36和接线后端185套5554仍分别属于原执行，不合并累计、不写成本次新全量。
WebKit初轮7失败/1通过、真实同URL红灯及其他历史失败保留；iPad视口不等于真机。

### 总门禁剩余条件

| 条件 | 当前状态与最小后续动作 |
| --- | --- |
| 已批准AI2范围 | AI2-1设计APPROVED、AI2-2/3/4限定合成ACCEPTED；AI2-5正式接线与本批浏览器子批ACCEPTED，相关已复审P1/P2按各批批准关闭，不重复开发 |
| AI1到AI2衔接 | PENDING：测试方案§1及AI2-PUB-01/FLOW-01要求真实AI1人工修订/批准路径；当前`ai2Fixture.js`及正式HTTP夹具直接预置approved Cycle/Artifact，仅证明批准后AI2闭环。须复用现有AI1合成Provider路径，补一条原候选→人工修订→批准→Tutor入口预览发布→订正审核回看的连接证据；不调用真实模型，不改已批准契约 |
| 完整矩阵证据归并 | PENDING：将测试方案§2各ID映射到已有永久用例、实际执行及冻结候选，区分task/mistake双来源、HTTP/组件/浏览器和待验项；缺项才补，不因用例总数多而默认全部覆盖 |
| 最终回归口径 | 已有分层回归与构建证据；衔接补验若修改共享夹具/实现，按影响重验并新冻结，不覆盖本批候选。现有`test:t2:e2e`会发现新spec，无需新runner；完整发布/Git clean未执行也未获本轮授权，不冒称发布全绿 |
| 工程汇总与总门禁批准 | PENDING：完成前两项和必要验证后提交限定合成工程关闭评审材料，由用户另行批准；本次仅批准浏览器批次，不是AI-2总门禁关闭 |
| 真机与真实启用 | DEVICE_PENDING；目标环境/T8、AI1计数资格与真实发送授权、真实家庭效果仍分别待验。本轮不将它们写成已完成，也不要求等待它们才补本地衔接证据 |
| 保留事项 | T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收REMAINDER_DEFERRED、T9 NOT_STARTED保持；不启动AI3/K12，不提交推送或部署 |

以上是已批准范围的缺口盘点，不撤销本批批准、不新增高级恢复工作，也不自动授权模型、真实环境或Git操作。

本次批准记录自查：仅更新7份Markdown；复用既有依赖执行`node scripts/check-family-docs.js`通过
（412 contract fixture cases、38 requirements），`git diff --check`通过；7文件264个本地链接目标存在，代码围栏闭合。
260次哈希核对确认92个源码未变、原candidate/patch/证据与文档manifest及旧快照未改，20份新增复审归档匹配。
上述为本轮文档自查，不是新增产品测试或独立业务复评；产品复评结果仍以本节已绑定原始产物为准。
