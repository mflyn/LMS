# T2 服务器 QA 后修订评审

**日期：** 2026-10-25。**范围：** 四项 QA P2 的本地修订、验证和 PR #27 交接。
**基线：** `548865738e8b5fb9ac67f20f51e4edb05df0a2f7`。
原限定合成批准及 QUERY_ONLY 关闭不变；§1–5 保留对应时点记录。四项最终独立 QA、候选映射和最新仅本地收口边界见 §6，不关闭高级恢复验收。

## 1. 核实、方案与自查

| QA ID | 核实和修订 | 永久保护与边界 |
| --- | --- | --- |
| QA-T2-FOCUS-001 | 审核后表单移除会丢失焦点。FamilyDialog监听焦点及DOM变化、隔离背景、处理Tab/Escape并恢复入口；Safari点击入口显式聚焦 | 移除/禁用/隐藏、空弹窗、内层Escape、卸载、入口移除与身份切换；审核成功/冲突/丢响应后焦点仍在详情 |
| QA-T2-WEBKIT-FIXTURE-001 | route.fetch重放multipart破坏WebKit上传；改用现有resource响应提交后丢失故障点 | 原始真实201及10份active资产/正文，UI保留9项、补传10项、版本2移除引用不删正文；不接受400代替故障 |
| QA-T2-D2B-BUDGET-001 | 原Ubuntu2CPU/3GiB出现测试级120秒预算超限，与旧Mongo code50缺陷分开。闭包内去重发现、使用已校验键Map，减少重复线性序列化查找 | 原139项及完整大证明图不删；新增一次闭包每成员只发现一次、跨检查不缓存外孩子/错误BSON；审计、全引用、5000ms和120秒不变 |
| QA-T12-INVITATION-WAIT-001 | 静态标题出现不等于异步preview就绪；等待实际家庭名称并增加受控延迟promise | 保留登录回跳、身份、接受邀请、fragment清理及本地不泄漏token断言，无随意sleep |

实现前已给出聚焦方案和自查：仅修现有组件、测试故障点及既有只读校验性能，不新增接口/框架/配置、不接入后置功能。
闭包去重仅限同一次暂停写入的检查；每节点审计与当前状态仍读取，下次检查重新建立集合。Maps使用已验证的唯一键，不提前按孩子过滤掉损坏证据。

## 2. 验证证据

本机Node22.15.0/macOS，Mongo7.0.14临时副本集。原QA归档162项哈希复核不变。
本轮原始证据保存在本地 `release-gate-artifacts/t2-ubuntu-p2-development-2026-10-25/`；可入库脱敏摘要见 [证据摘要](evidence/t2-synthetic-2026-10-24/pr27-ubuntu-p2.json)。原日志和截图不上传Git。

- 前端完整：`npm run test:ci --prefix frontend/web -- --runInBand`，41套件499项通过；构建通过。
- 只读预检完整：resource-family 的 `userDeletionRecoveryReadiness.test.js`，142项通过，0失败/跳过。
- T2正式浏览器：`T2_WEB_BUILD=<最终构建绝对路径> npm run test:t2:e2e -- --browser=chromium` 和 `--browser=webkit`，分别14项通过，retries=0。
- Task12真实邀请浏览器：`npm run test:task12:e2e`，1项通过。
- T2正式HTTP：`npm run test:t2:integration`，两套件14项通过。
- 家庭后端全量：`npm run test:family-regression`，142套件通过/1失败，3965项通过/1失败/0跳过，exit1，728.959秒；D2B所在142项套件通过。唯一失败为checkGitClean测试spawn Git报-86，PATH误选本机旧x86 Git。Jest随后因该异常对象循环引用未生成JSON，完整日志为证据，不能伪造JSON或将本轮写为全绿。
- 修正本轮Node22入口、保留原生ARM64 Git后，`npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false` 公共套件41/667通过，exit0，30.526秒。另启动相同8项目的完整复验，提交前尚在运行，终态单独归档/同步PR；不修改产品、测试或lint规则，不用公共补验拼接成一次完整全绿。新提交CI另行核对。
- 文档门禁64项通过；干净跟踪文件加本次新文件导出副本的lint、文档校验通过；新增文档链接/围栏、diff检查通过。增量Gitleaks8.30.1扫描无命中；工具官方SHA-256校验通过。敏感扫描不是完整安全审计。
- 独立只读代码评审无可执行新问题；审查员阅读10份JS修改及既有证据、自行执行diff检查，未声称重跑全部测试。
- 文档独立评审另发现两项P2：浏览器默认目录会互相覆盖、限额容器缺少可执行入口。已补每轮独立目录/退出码及明确的准备和离线容器命令，复审无剩余问题；四段Bash独立及合并语法校验通过，未执行服务器命令。只关闭这两项文档审查问题，不关闭服务器QA预算缺陷。

保留红灯：前端6失败/4通过，入口移除1失败/7通过，闭包发现47次而非13次的反例失败，原WebKit故障点及焦点复现失败。
中间Chromium使用Gateway丢响应未得到预期9/10，WebKit未回到触发按钮，两轮各13通过/1失败；分别改为resource提交后丢响应和显式触发聚焦，最终完整14/14通过。失败文件单独保留，不覆盖。
初次CPU剖析误用Node26，不能与Node22耗时作受控性能对比；归档脚本PATH误选旧x86 Git的-86错误改用原生Git，不涉及产品。

## 3. 待验收和发布边界

本地绿灯不等于原Ubuntu限额复验。`QA-T2-D2B-BUDGET-001` 保持 `IMPLEMENTED / SERVER_VALIDATION_PENDING`；其他三项为 `IMPLEMENTED / READY_FOR_QA`，独立代码评审不冒充独立服务器QA或用户验收。
[服务器步骤](family-self-directed-learning-t2-server-test.md)要求固定新SHA、相同限额串行执行大图、142项预检及143套件全量，并保留每轮退出码和失败。
DEVICE_PENDING、高级恢复/新回收及D01/T2-G、D2b剩余/D3/D4/E、C-CACHE-P3的REMAINDER_DEFERRED继续保留。
本次用户仅授权整理、验证、提交推送当前分支、同步PR并检查CI；PR保持Draft，不合并、不部署、不变更真实数据、密钥或默认开关。

## 4. D2B 预算及隔离 P3 批准关闭（2026-10-25）

**D2B budget:** APPROVED / CLOSED / SYNTHETIC_ONLY
**D2B isolation P3:** APPROVED / CLOSED
**D2B retained:** HISTORICAL_FAILURES_PRESERVED / DEVICE_PENDING / REMAINDER_DEFERRED / T8_PENDING / NOT_AUTHORIZED

用户批准本次复审，关闭 QA-T2-D2B-BUDGET-001 和组合结果双向隔离 P3；其他三项 QA 的验收状态不由本条代改。
完整依据见[预算续项 §6](family-self-directed-learning-t2-d2b-budget-followup.md#6-复审通过及批准关闭2026-10-25)：
Ubuntu 2CPU/3GiB 原预算下 readiness142项、家庭144套件3972项、正式HTTP14项通过；
最终隔离断言单独补验6项，复审四套件331项及两类别名变异通过，不把补验拼接成最终源码全量重跑。
保留原批准失败及固定4dff6871超时，候选原始归档不改写。C-CACHE-P3、高级恢复和新回收继续后置。
本次授权仅更新关闭记录及校验，覆盖此前交接中的Git授权描述：暂不提交、推送、合并或部署。

## 5. 三项独立 QA 关闭与条件合并授权（2026-10-25）

用户批准同步以下独立复评结论；§3 的 READY_FOR_QA 是此前交接快照，不再代表这三项的当前状态。
本次只同步已存在的独立证据，不把开发自测或后续 CI 替代独立 QA，不更改业务代码。

| QA ID | 当前状态 | 独立验证依据 |
| --- | --- | --- |
| QA-T2-FOCUS-001 | VERIFIED_CLOSED / AUTOMATED_SYNTHETIC_ONLY | 焦点组件反例及两地完整前端；Chromium/WebKit 确认后不额外点击，验证 Tab/ShiftTab、Escape、存活入口返回和内层取消返回 |
| QA-T2-WEBKIT-FIXTURE-001 | VERIFIED_CLOSED / AUTOMATED_SYNTHETIC_ONLY | Chromium/WebKit 完整 T2 各14项，retries=0；真实201后丢响应，页面9/10与数据库10图，补图后提交、版本2移除、9个精确绑定及全部资产/正文保留 |
| QA-T12-INVITATION-WAIT-001 | VERIFIED_CLOSED / AUTOMATED_SYNTHETIC_ONLY | 受控延迟预览反例、Mac/Ubuntu完整前端及Task12真实浏览器；身份、回跳、fragment清理和本地不泄漏Token |

独立证据来自 `t0-t2-p2-independent-2026-10-25/REPORT.md`（R1，§3），固定候选
`4dff6871d2d3bec2d4c34729fe3ae20a35317e97`。Ubuntu限额为2CPU/3GiB/无swap，
Node22.23.4/Debian12容器用户空间；浏览器运行于Mac正式应用工厂的合成环境，不是Ubuntu跨机浏览器或真实iPad。
Mac及Ubuntu前端各41套件499项通过，Mac Chromium/WebKit T2各14项、Task12浏览器1项通过。
从该候选至 `07ffca67` 的 frontend/web 和 tests/e2e 无源码差异，可复用该独立证据。

本次逐项核对原85份归档哈希一致；原始日志/截图继续本地保留，不上传Git。可携带证据指纹：

| 原文件 | SHA-256 |
| --- | --- |
| REPORT.md | `7ff50bf2fcebf4df629350adf262d7ecd358e976c756f8b566742d2001147b84` |
| results.json | `7c293b0131ca59042e284a58539bab0305c1e0addb9d794b6ef136fc8ee2516f` |
| manifest.json | `f93289af03ecc55db297e6c3c89e7cdeaa82257e6bc9d8a9e5342d8864cc5456` |
| verification.json | `fabc19494655c088a5e53b2a2312908082943d5de1de77089f3c78a7aa176a1c` |

原R1报告整体仍为 NOT_ALL_GREEN：当时D2B readiness为141通过/1超时；本次不改写该失败。
D2B预算问题的后续修订、独立复审和用户批准另见 §4 及预算续项，不能追溯抹去R1失败。

本次授权：文档验证、提交推送当前分支，等待新提交CI通过后将PR #27转为Ready，使用merge commit合入main，再检查main的CI。
此为条件授权而非已合并声明；提交SHA、PR及main的最终CI结果分别在PR记录，不修改历史批准快照。
DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、D01/T2-G、D2b剩余/D3/D4/E、C-CACHE-P3及高级恢复/新回收REMAINDER_DEFERRED保持。
不部署、不启用后置能力、不访问真实数据或NAS，默认关闭配置和旧客户端升级拒绝不变。

## 6. 四项最终独立 QA 与本地收口（2026-10-25）

**Current independent QA:** VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE（四项，非产品/真机/发布批准）
**Current authorization:** COMMIT_PUSH_PR_SYNC_ALLOWED / NO_MERGE_DEPLOY

用户此前选择“先补齐四项独立 QA 的证据与文档，仅本地修改，暂不合并”，取代 §5 尚未执行的条件合并安排；本次复审通过后的提交推送授权见 §6.2，不恢复合并授权。
此前已按当时授权提交推送三份记录 `a9e21fe60e362658d3af87401f2e45698b75db6a`，不回滚或改写。
PR #27 仍为 Draft / OPEN，无自动合并；main未合并本PR。本次仅允许验证后提交推送、同步PR和检查CI，CI成功也不恢复合并授权。

四项的问题与根因见 §1，前三项R1独立关闭见 §5；D2B最终独立关闭补充如下：

| QA ID | 最终独立结论 | 原失败到关闭的证据链 |
| --- | --- | --- |
| QA-T2-FOCUS-001 | VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE | 焦点丢失 → 动态焦点/入口恢复 → R1两地前端及双浏览器键盘/嵌套弹窗验证；不是实机辅助输入认证 |
| QA-T2-WEBKIT-FIXTURE-001 | VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE | multipart重放夹具错误 → resource真实201后丢响应 → R1双浏览器9到10图、落库和精确绑定断言；不是原生Safari产品缺陷或iPad认证 |
| QA-T12-INVITATION-WAIT-001 | VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE | 标题早于preview完成 → 等待真实家庭信息 → R1延迟promise、完整前端499项及Task12浏览器，身份/fragment保护保留 |
| QA-T2-D2B-BUDGET-001 | VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE | R1完整readiness141通过/1超时 → 消除两处重复完整校验/编码 → R2最终深隔离版本同限额串行独立全量及正式HTTP通过 |

持久可携带索引：[四项独立证据](evidence/t2-synthetic-2026-10-24/pr27-independent-qa-closure.json)。
记录R1/R2来源、清单指纹、关键文件原始/归档SHA-256、精确候选、命令、计数、退出码和变异结果；不是原始日志的完整备份。
R1全部85份、R2全部60份归档均核对一致。R2 verification统计59份因其不计自身，最终manifest为60份，并不矛盾。
sourceSha256为空的文件是源归档内新建/派生文件，其归档哈希仍核验；没有伪造不存在的远程原始哈希。

R2于2026-10-25 12:04:41至12:43:38（北京时间）执行，基础4dff6871加最终九文件快照，
candidateDigest为 `5ba84f8668e8f0adc679ee7e4d5cfd4a6c8cf2f429935a5cb70f4d8df3b66547`。
当前三个实现、Jest注册和最终测试共五份文件与受测快照逐字哈希一致；完整当前工作树不是原九文件身份，后续文档及文档门禁/测试须按各自验证理解。
R2从开始到结束都使用最终双向深隔离测试，不同于开发早先全量后补四条断言的自测轮次。

R2原目标1项（141项按名未选）、完整readiness142项、四套件331项、家庭144套件3972项、正式T2 HTTP两套件14项均通过；完整套件0失败/0跳过，docs/lint退出0。
原大图在单例/readiness/家庭全量中的Jest duration为108240/111855/113363ms；含前后钩子，不据此计算测试体精确余量。
原120000ms/5000ms预算、真实超过16MiB但未达100文件的负向图、只读和拒绝保护均保留；通过不代表允许超限恢复或启用高级恢复。
19份远程源报告匹配和六份Jest结果未改由R2完整性报告记录；直接别名及浅拷贝的独立内存变异均被最终永久反例拦截。

原R1 NOT_ALL_GREEN、旧Mongo code50、原批准失败及开发各轮红灯保持原样，不能用R2或后续CI回填。
R2临时容器自然退出、原10个容器身份未变、SSH关闭的收尾证据留在索引；本次不重启服务器测试或访问真实数据。
DEVICE_PENDING与全部REMAINDER_DEFERRED保持；当前人工/后置清单见[服务器测试边界](family-self-directed-learning-t2-server-test.md#当前独立验收与待验证边界)。

### 6.1 本地收口自查与验证

2026-10-25，Node22.15.0；本轮不重跑服务器/浏览器或业务全量，仅核对既有独立证据和文档：

- `npm run docs:family:check`：通过。
- `npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js --json --outputFile=/tmp/t2-independent-four-qa-local-docs.json`：80项通过、0失败/跳过，exit0，7.998秒。
- 本地Node只读校验：R1 85份、R2 60份、原QA 162份及开发预算54份归档哈希一致；索引内原始/归档指纹匹配源清单，R2计数与原Jest JSON一致，九文件快照和五份当前代码身份核对通过。
- JSON解析、文档围栏/本地链接、三处唯一LOCAL_DOCUMENTATION_ONLY状态、原批准JSON与HEAD逐字一致检查通过；`git diff --check`通过。
- Gitleaks8.30.1对七份本地变更文档全文扫描，零命中；原始日志、截图、服务器地址和凭据没有加入索引。

自查未发现新的状态/身份/计数/证据链接矛盾。保留59份verification统计与60份最终manifest的范围说明，区分各轮原始失败、开发补验、R2最终全量及后续CI。
上述结果不改变DEVICE_PENDING或后置范围；七份本地文档修改不暂存、不提交、不推送，PR条件合并仍暂停。

### 6.2 四项文档收口复审通过及提交授权

2026-10-25，用户确认复审通过，授权更新本记录、验证后提交推送当前 `codex/t2-synthetic-acceptance` 分支、同步 PR #27 并检查新提交 CI；暂不合并、不部署，保持 Draft，不设置自动合并。
§6.1 的仅本地限制保留为上轮历史记录；本次不改变四项自动化合成关闭范围，不更改任何冻结证据或原批准 JSON。

本次文档复审未发现新的候选身份、计数、哈希或关闭状态问题：

- R1固定4dff6871，三项关闭与D2B readiness 141通过/1超时分开；R2固定最终九文件候选，摘要和九份快照、当前五份代码/测试/注册逐字匹配。
- R1 85份、R2 60份归档哈希一致；原始来源分别73份/40份核对一致。14份Jest报告按既有脱敏规则对照，状态、顺序、计数和耗时一致；R2 59份verification不含自身的口径明确。
- 原QA 162份、开发预算54份归档及原批准JSON未改。开发自测及补验、R2最终全量与后续CI分别留证，没有拼接或回填历史失败。
- 复审本地执行 `npm run docs:family:check`、80项 `familyDocumentationGate.test.js`（9.969秒，0失败/跳过）、只读证据核对及 `git diff --check` 均通过；未重跑服务器/浏览器/业务全量。

新提交的CI按其SHA在PR单独记录；a9e21fe6的CI成功不代替新提交验证。保留历史失败、DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED及全部REMAINDER_DEFERRED，不启用高级恢复或新回收。

批准后提交前验证：Node22文档门禁通过；同一文档测试套件80项通过、0失败/跳过（8.134秒，exit0，输出 `/tmp/t2-four-qa-approved-docs-20261025.json`）；R1/R2归档、候选身份、原批准快照及三处当前授权的只读校验通过。本轮无业务源码、工作流或默认配置修改，CI结果另在PR按最终提交SHA记录。
