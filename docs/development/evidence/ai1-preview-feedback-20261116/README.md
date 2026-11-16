# AI-1 外发预览反馈 P2 本地修订候选

> **当前状态（2026-11-16用户批准）：CLOSED / USER_APPROVED / LOCAL_ONLY。** 仅关闭 `QA-AI1-PREVIEW-FEEDBACK-001` 的限定本地修订，见文末[限定关闭记录](#限定关闭记录2026-11-16)。下文从“冻结时状态”到“评审与保持状态”保留提交复评时的历史身份，不代表当前P2仍待批准；原事件缺证及其他未关闭状态不变。

## 冻结时状态

日期：2026-11-16。基线：`9e97aa58d0dc98aaae0af14b18d586c733f87ef9`。
问题 `QA-AI1-PREVIEW-FEEDBACK-001` 状态：LOCAL_FIX_PENDING_INDEPENDENT_REVIEW，不关闭。
真实事件：REAL_REQUEST_EVIDENCE_PENDING；真人/真机验收不随本地验证完成。

## 先核实，再方案和自审

原独立证据目录标识 `ipad-tutor-preview-diagnosis-2026-11-16`，原生Jest为1通过/1失败、exit1；
不是包装器返回0就全绿。原反例SHA256 `cdaf68cf9064784da8058a5bd9c259d0abe7cf523971af42b42f16d1ae09a7ec`，
原results.json SHA256 `e250f833e9f947f6435639aefc8d2d732653782bc200448bba53485be04eb1f0`。
已核对原5份相关源码与当前基线一致，未覆盖原文件或将原红灯改绿。

原事件仅知用户在iPad/Ubuntu内网HTTPS、北京时间下午3点多、另一条数学任务点击创建预览。
没有原POST/详情GET的状态、错误码、cycle关联、完整预览/费用字段或真实发送证据。
本轮只读已有本地报告及元数据，没有新的Network记录可用；未连接服务器、代发POST或猜测ID。
不能据旧配置AI off认定本次503，也不能据点击预览认定已调用模型或产生费用。
后续安全补证仅取原Network/已有脱敏日志的请求类别、状态、错误码、字段存在性和同一请求关联，
不索取正文/Token/完整storage，不为补证再次创建、启用AI或清原命令；服务器取证另需明确授权。

最小方案在编码前自审：`TutorPage`的写错误独立保留，cycles/jobs/detail读错误各自归属；
某读取成功只能清本类读错误。权限拒绝仍用原epoch失效全部在途读取/写入并清私有界面，
退出/切换由既有会话生命周期清理；创建中显示状态。没有新API、费用模型或通用恢复框架。
风险是误清另一操作错误或拒绝后的迟到响应复活，分别以顺序反例和原权限套件保护。
回滚只撤销本批页面增量并保留证据；不迁移数据、不处理现有实例或已保存命令。

## 实现及永久保护

- 业务修订仅 `frontend/web/src/pages/family/TutorPage.js`；不改变原UUID/正文、确定拒绝清理规则、响应校验或费用/人工同意边界。
- 新组件反例 `TutorPreviewFeedback.test.js` 纳入现有Jest发现入口；原 `TutorPage.test.js` 未删断言。
- 原 `tests/e2e/t2/ai1FormalPage.spec.js` 增加创建/详情丢响应两项。旧网络刷新用例的命令、请求次数、远端次数、服务端详情不变和显式重试断言保留；两处提示断言按本次读写分离契约更新，见下方失败归因。
- 矩阵见[测试方案§18](../../family-ai1-test-plan.md)。固定候选以本地证据包的patch及逐文件SHA绑定，不以未提交HEAD冒充完整候选。

## 分批验证

证据包标识：`ai1-preview-feedback-fix-20261116`。日志、JSON、命令/退出码回执和截图均留在本地受保护目录，不包含用户真实请求内容。

| 批次 | 当前结果 | 边界 |
| --- | --- | --- |
| 新反例首轮红灯 | 14项：4通过/10失败，exit1 | 9项反馈缺陷；另1项测试误用已退出会话读取命令，原失败保留 |
| 修正测试契约后红灯 | 14项：5通过/9失败，exit1 | 直接核对存储键清除并保留旧会话拒绝断言，没有修改产品来迎合夹具 |
| 修复后定向 | 2套件37项，exit0 | 新14项及原TutorPage23项 |
| 相关组件回归 | 8套件162项，exit0 | 含AI1客户端、AI2页面、会话和孩子scope；不是全项目前端回归 |
| 构建及局部lint | exit0 | 使用已有依赖，不升级；Browserslist/CRA等原警告保留 |
| 正式Chromium新增专项 | 2项，exit0 | 后续补强列表已完成的屏障另验；不是独立复验 |
| Chromium相关首轮 | 19项：18通过/1失败，exit1 | 旧网络刷新用例期待全局清错，与本次修订契约冲突；原日志与截图保留 |
| 最终相关组件回归 | 8套件163项，exit0 | 新增第15项固定同屏读写错误恢复；既有148项通过，不冒充一次全量全绿 |
| Chromium相关修订后 | 19项通过，exit0 | 两处提示断言改为读写分离后；最终新增用例导航接线前的测试快照，产品源码相同 |
| WebKit相关首轮 | 19项：4通过/15失败，exit1 | 页面离开首页的在途请求错误，以及旧用例Chromium专属取消文本断言；失败保留，未过滤或放宽 |
| 最终新增专项 | Chromium 2项、WebKit 2项，分别exit0 | 新增用例复用既有openParentTasks真实导航；不是旧19项WebKit全绿，也不是真机验收 |
| 文档校验 | 指定已有NODE_PATH后exit0 | 首次直接调用因缺dotenv退出1；未安装依赖或改校验器 |

Chromium首轮失败实际收到“未知写入提示＋详情读取失败”，旧断言只期待单条提示，随后还期待GET成功后零提示。
该旧行为恰是本次需要禁止的全局清错。没有修改产品迎合旧断言，也未改为宽松包含判断：
现在精确断言失败时两条提示、成功GET后仅剩未知写提示；原命令精确相等、零额外POST/远端查询及原UUID重试保护不变。
新增组件反例覆盖同屏创建拒绝及记录读取失败，读取恢复只消除自身错误，新建保持锁定。
此断言语义更新须独立复评确认；首轮失败不追改为通过。

WebKit首轮失败证据表明：新增两项以及部分旧用例在硬导航离开首页后记录到
`daily-learning-plans`的access-control pageerror；另有旧用例期待`net::ERR_ABORTED`/`net::ERR_FAILED`，
实际为`cancelled`/`Blocked by Web Inspector`。本次只把新增两项的任务入口换成既有`openParentTasks`，
保留原零pageerror、精确响应和请求次数断言；两项专项通过。未修改其余旧用例的导航或引擎文本断言，
未重跑到绿，也未据此宣称旧问题已解决或与本次业务修改无关；旧套件兼容性归因及处置留给独立复评。

实际命令由各`*-receipt.json`保存：组件使用原react-scripts test（runInBand），构建用原build入口，
浏览器使用原Playwright配置，WebKit只覆盖browserName和绝对testDir。
最终新增专项使用`ai1FormalPage.spec.js --grep 'preview feedback survives'`，明确仅2项，不代替相关19项。
局部eslint覆盖三份JS；文档使用`NODE_PATH=<已有依赖>/node_modules node scripts/check-family-docs.js`。

开发自查：产品增量仅分离错误归属和创建进度文案；刷新未增加写调用，503仍保留原命令，
权限拒绝仍先失效epoch并清私有界面，错误文字来自既有固定映射，不回显后端原始错误或题目正文。
相关组件覆盖迟到响应/身份切换，正式HTTP覆盖丢响应后显式原命令重试及零自动生成。
浏览器Fixture的异常关闭反例在两引擎均通过，验证HTTP监听关闭和环境恢复；各运行进程正常退出。
仅本轮临时服务按既有stop入口收尾，测试副本/日志保留供复验，原始仓库与真人入口未修改。
未发现需扩大本次产品修订的自查问题；这不是独立复评无问题结论，WebKit相关失败及原事件缺证仍保留。

正式浏览器复用Gateway及既有正式服务、临时Mongo副本集/私有存储，远端operation仅回环替身，无Provider；
新增两项服务真实成功后仅替换响应为合成503，不能当作iPad原错误码。原 `ai1ParentPage.spec.js` 为全API替身，单独标识。
本轮不运行ActualRemote/RestoreRemote acceptance入口。Browser插件未提供，复用既有Playwright；
原120秒用例/10秒断言/15秒动作预算及串行、零重试不变。

## 评审与保持状态

开发自查和测试不等于独立验收；固定候选交测试/评审线程重跑相关反例和Chromium/WebKit后，再由用户决定。
本次P2、真实事件根因、DEVICE_PENDING/MANUAL_PENDING、T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、
Docker INCOMPLETE_FAILED、非阻断补测及全部后置状态均不提前关闭。
不调用真实模型、不操作服务器、不改配置/数据库、不重启入口、不提交推送/合并/部署；旧数据及旧命令现场不变。

## 限定关闭记录（2026-11-16）

用户在本轮复审通过后明确批准本P2限定本地验收及关闭。当前状态为 **CLOSED / USER_APPROVED / LOCAL_ONLY**。
复审确认读写错误归属、原命令保留及权限清理符合修订目标，未发现新的阻断性代码问题；
两处提示断言调整合理：GET成功只清对应读错误，不能证明原写入已收敛，原命令和调用次数等断言保留。
关闭不包括真实iPad事件根因、旧WebKit相关失败、真实模型或真人/真机验收。

冻结证据包 `ai1-preview-feedback-fix-20261116` 保持原件不变：

| 对象 | 固定身份 / SHA-256 |
| --- | --- |
| 基线 | `9e97aa58d0dc98aaae0af14b18d586c733f87ef9` |
| `candidate.patch` | `d1b5fa514de3844c7532fa191653a1471ec2ab358003bda73806b45fda5cbf8d` |
| `candidate-manifest.json` | `4d69264b7632f5761b8f8a9b0991c9f8d97d86c4e1f2b3b2d46d36f5275e6844` |
| 原109文件索引 `evidence-files.json` | `10be14d9bae5004697e9795e4156a74d1ccf7e4cf97170a214aa07b47ea1b4e4` |
| 本轮复验 `closure-review-20261116/results.json` | `db068e5811179531ab44cd123d2a31adab15206524c20196d8468b17667196ea` |
| 本轮复验 `closure-review-20261116/tests.log` | `0681a1319bd750acc903a17be5ea93fb72ba4048a3ae6eb9c4fc584d0762c73c` |

本轮复审核验补丁、5份候选文件、109份归档及原红灯证据哈希；冻结重建目录同样匹配。
实际复验使用 `react-scripts/scripts/test.js --watchAll=false --runInBand --cache=false --json`
运行 `TutorPreviewFeedback.test.js` 和 `TutorPage.test.js`，2套件38项通过、0失败、exit0。
结果从临时复验目录原样归档到上述证据包的独立 `closure-review-20261116` 子目录，未覆盖原索引或日志。
本轮浏览器仅核查既有日志/回执及源码快照，没有重跑实例，不能称作新增独立浏览器复验。

开发最终相关组件163项、Chromium相关19项和最终两引擎各2项专项仍按前述范围记录：
Chromium19项是最终新增导航改动前测试快照；WebKit相关4通过/15失败继续保留，专项不能替代它。
原请求保持 `REAL_REQUEST_EVIDENCE_PENDING`；T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、
DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、非阻断补测及全部其他未关闭/后置状态不变。
本轮只修改关闭文档；三份JS仍匹配原冻结哈希。关闭文档是候选之后的批准增量，
不回写旧补丁、旧manifest的PENDING字段或冻结README哈希，不将历史失败改为通过。

## 专用分支交付授权（2026-11-16）

用户批准整理本批提交范围、敏感信息与冻结哈希检查后，提交推送专用分支、创建Draft PR并检查CI。
本授权只替代上述批次当时“不提交推送”的交付限制，不授权合并、真人入口更新、模型、服务器或部署。
[公开交付索引](public/README.md)区分原冻结补丁、批准后文档增量、分批验证与失败；原始日志和截图留在本地。
