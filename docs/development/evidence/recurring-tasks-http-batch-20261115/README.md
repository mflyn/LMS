# 重复计划第二批：正式HTTP、预检与公平扫描

状态：SECOND_BATCH_PENDING_ACCEPTANCE；重复计划整体门禁OPEN。首批核心服务及两项日期P2已获用户批准关闭，批准绑定见[当前记录§7](../../family-recurring-tasks-test-plan.md)。首批归档不改写。

本批只使用本机合成账号、临时Mongo副本集和回环HTTP。未更新真人测试入口，未操作服务器、提交推送或部署。默认功能关闭，无自动索引创建/迁移，不放宽旧completion、媒体或凭据预检。

## 候选范围

`candidate.patch` 是基于 `3816c3f2a45daff8b66221cfffb322de11bdce33` 的完整首批+第二批源码/测试/当前文档候选，不是仅增量补丁。`candidate-files.json` 绑定各文件和补丁SHA-256；首批历史补丁仍独立保留。本入口及验证摘录是随附证据，不自包含于候选补丁形成循环哈希。

- HTTP使用正式Gateway签名身份、正式homework工厂、真实临时数据库及生产事务服务；没有用mock成功替代原命令提交。测试身份为合成JWT，不冒充真实登录页面、退出重登或真人测试。
- 创建/修改/停止/abort成功提交后断开真实HTTP响应，原UUID查询/重放收敛；只读分页、当前actor索引、角色/实时家庭权限、非法query及原正文拒绝有反例。
- resource/progress目标配置为不可达本机端口，本批管理路径不调用它们；媒体完成/发星完整闭环仍待后续，不声称三服务HTTP已通过。
- 启动使用既有正式工厂和原预检，新增事务能力、集合及索引实际读取；独立测试通过索引元数据替身注入prepareUnique/build/hidden等无效状态，另有真实临时库dropIndex与启动拒绝。没有自动DDL。
- Scanner持久分页50/60秒，单计划事务串行、跨副本游标CAS及唯一实例；扫描/关闭的部分故障用受控Promise和方法桩注入，公平分页/回执写入使用真实临时库。Mongo未知提交本身未用网络分区制造，不能把注入UNKNOWN写成数据库故障实演。

## 分批失败与验证

复验命令见下节，原始JSON摘要及逐项结果在 `verification.json`，原输出保存在本机临时证据，JSON摘录已去绝对工作区和环境标识。候选补丁保留被审文件原文，含首批历史记录的本机依赖路径，仅本地归档，未获公开推送授权。不能将以下分批合写为一次全量：

1. 新专项最初缺少模块加载失败，保留 `recurring-b2-red.json`。
2. 首次4项3通过/1失败，原媒体预检拒绝新唯一索引。仅增加精确键/类型过滤兼容，不接受任意新索引，原失败保留。
3. 扩展82项通过；随后相关6套件194通过/2失败：HTTP丢响应夹具混用固定未来时钟和生产时钟，正确触发回退保护。修订为前置计划也由正式HTTP创建，未改原业务保护；随后runtime37项通过，补启动/定时用例后6套件198项通过。
4. Gateway和共享启动7套件190项通过，包含daily plan、AI1/2/3路由与旧启动拒绝；这不是全仓或所有前端回归。
5. 独立初审实跑runtime37+core51共88项及旧媒体guard38项，通过但发现2项组合失败路径P2，不能将绿色结果当成问题不存在。开发将2个诊断固化后均红灯，修订后92项通过。
6. 两项P2修订后相关6套件200/200通过（runtime41、core51、原启动/guard/readiness/lifecycle108），0 skipped，见 `recurring-b2-p2-final-related.json`。随后独立复评同样200项通过，但发现结束/停止计划的UNKNOWN不能再次进入扫描候选；旧候选与结果保留于 `superseded-6ef0c80d/`，不能把该轮绿色当成最终结论。
7. ended/stopped两项真实事务后丢回执反例先全部失败；补同一幂等生成入口的未决ID选择后94项通过，最终开发6套件202/202通过，见 `recurring-b2-final-202.json`。原失败、旧200项及最新202项分别保留。

既有Mongo驱动废弃选项警告保留，不通过增加timeout、skip或重跑来抹除业务失败。新测试由原homework Jest配置自动收录，未新建测试框架。

## 自查与P2修订

- 关闭时正常生成成功才允许正常收尾；生成UNKNOWN/关闭期间异常向生命周期传播脱敏错误，后续stop不会把已知未解决状态抹成成功。超时仍有界拒绝，不关闭仍在提交的连接。
- 计划辅助健康写失败不再终止本页；游标回执保留当轮/上轮失败计数，跨页及重启继续，日志仅输出固定错误码。游标回执本身失败时不推进。没有新队列或通用恢复。
- 原单计划health失败用例改为health和fallback回执同时失败，保留失败/零推进断言；新增51计划的持续health失败反例证明后页不饿死。正常stop改为成功生成正例，UNKNOWN另有永久负例，不再混淆成功/失败。
- 最后一天提交成功但回执未知，或随后被停止的计划，本进程未决ID继续遵守同一个游标、排序和50项上限，调用原幂等生成重新核验，不重复实例。仍在途的停止超时与已实际观察到的迟到成功区分：前者拒绝，后者允许显式重试关闭；明确WRITE_UNKNOWN仍持续拒绝。
- 定向变异通过临时Jest transform仅改内存加载源码。旧 `6ef0c80d` 候选上的6组为游标CAS、等待在途、Gateway原正文、精确partial索引、重复stop未决保护、health失败继续，预期失败数1/2/2/1/1/1；最新候选另撤掉未决ID选择，ended/stopped两项均失败。`final-mutation-*`文件名不代表七组在同一最终候选一次运行；未选用例不算通过，不修改冻结业务文件。

## 最终独立复评

独立结论绑定补丁 `88ae98bad4acf08c3380b7cb19f602b633cfc68998e9ec9898c1b778f23efdfb`：本批限定本地实现复评通过，未发现阻断验收的未修复P1/P2；第二批及本批新发现仍待用户批准验收，不等于总门禁关闭。

- 独立重跑6套件202/202，退出0：runtime43、core51、旧媒体guard38、完成协议readiness53、生产组装13、生命周期4。结果单列于 `verification.json` 的 `independent-final`，不与开发202、历史88/38/200重复累加。
- 另5项真实临时Mongo验证全部通过：ended/stopped未知回执接续、51计划共享分页（50→1→1→0，最终51个实例）、停止超时后迟到明确成功、停止超时后迟到明确UNKNOWN。受控丢响应/延迟在服务边界注入，不冒充Mongo网络分区。见 `independent-final-probes.json`。
- 原独立绑定报告SHA-256为 `f3a00d5a4328cd471cdf92c4bd2b9ec51ce7c010a876331a97be3402c068cf55`，见 `independent-final-binding.json`；报告当时核对22文件及32份来源报告。之后追加独立结果索引，不修改源码候选或旧归档；最终索引为33份。
- 独立提出的“超时后第二次stop成功”经明确完成状态验证，不作为P2：仍在途/明确UNKNOWN拒绝，实际成功完成后可显式重试。该诊断保留在 `independent-old-probes.json`，不删失败或改写原观点。
- 非阻断补测：现有自动定时测试通过主动tick等待，尚不足以单独证明多个定时周期的自动调度。已验证tick分页/持久游标/关闭语义，不将此项写成完成。

## 复验入口

复用本机已有依赖，不安装。`jest`、`eslint`指已有可执行文件；外部依赖路径用 `NODE_PATH`，不是修改项目依赖：

```sh
jest --config backend/services/homework-service/jest.config.js --runInBand --silent --runTestsByPath backend/services/homework-service/__tests__/services/recurringTaskPlanRuntime.test.js backend/services/homework-service/__tests__/services/recurringTaskPlan.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionProductionStartup.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionGuardReadiness.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionReadiness.test.js backend/services/homework-service/__tests__/serverLifecycle.test.js --json --outputFile=/tmp/recurring-b2-final-202.json
jest --config backend/jest.config.js --runInBand --silent --runTestsByPath backend/gateway/__tests__/dailyLearningPlanRoutes.test.js backend/gateway/__tests__/serverLifecycle.test.js backend/gateway/__tests__/ai1Routes.test.js backend/gateway/__tests__/ai2Routes.test.js backend/gateway/__tests__/ai3Routes.test.js backend/common/deployment/__tests__/completionActivation.test.js backend/common/deployment/__tests__/completionActivationReadiness.test.js --json --outputFile=/tmp/recurring-b2-shared.json
npm run docs:family:check
git diff --check
git apply --reverse --check docs/development/evidence/recurring-tasks-http-batch-20261115/candidate.patch
```

候选运行环境仍为本机Node v26.9.0，不是Ubuntu限额/浏览器/iPad验证。新部署所需索引必须经另行部署流程准备；当前运行配置没有开启本功能。

## 尚待范围

家长页面、最小命令标记与同actor重登、生成任务来源显示、完成作品与真实发星、正式浏览器及真人/真机仍待后续。不影响既有真人测试；T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、历史失败及后置范围保持。第二批与本批三项扫描P2只提交验收，不自行关闭整体门禁。
