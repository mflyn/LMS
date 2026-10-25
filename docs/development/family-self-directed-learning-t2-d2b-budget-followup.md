# T2 D2B 同限额预算复验与聚焦修订

状态：APPROVED / CLOSED / SYNTHETIC_ONLY，2026-10-25；仅关闭本次预算问题及组合结果双向隔离 P3，见 §6。

## 1. 固定候选与失败

固定提交 `4dff6871d2d3bec2d4c34729fe3ae20a35317e97`。独立 QA 在 Ubuntu
2 CPU / 3 GiB / swap 0、Node 22.23.4、MongoDB 7.0.14 下复验：
单例 119260ms 通过；完整 readiness 141 通过 / 1 失败，原大图 121371ms
超过既有 120000ms。此后家庭全量、前端、正式 HTTP、构建退出码 0 不覆盖该失败。
原失败快照、旧 QUERY_ONLY 关闭记录、DEVICE_PENDING 和高级恢复/新回收
REMAINDER_DEFERRED 保留，不提前关闭服务器预算缺陷。

## 2. Ubuntu 实测

前一 QA 容器退出后，独立目录 `lms-d2b-dev-diagnostic-20261025-r1` 使用相同
固定镜像、2 CPU / 3 GiB / swap 0、非 root、只读 rootfs、无网络/端口发布，
仅挂本轮合成数据。未复用或修改 QA 目录；原有 10 个服务身份/启动时间前后相同。

临时 AST 包装原函数，去除包装后的 AST 与固定源码一致；未改测试体、夹具、
断言、120000ms 或查询 5000ms。记录调用次数、耗时、进程 CPU、cgroup；
诊断插桩增加开销，其通过不作验收结果。单例诊断 119445ms：

| 阶段 | 墙钟毫秒 | 说明 |
| --- | ---: | --- |
| graphFixture | 18565 | 20 份真实连通证明，每份 80 个填充组，未缩图 |
| sizes | 7160 | 原序列化及大于 16 MiB 断言 |
| 前/后 snapshot | 5681 / 5379 | 原数据库及文件无副作用断言 |
| firstClosure | 82134 | 进程 CPU user 60408ms，含数据库等待 |
| processEvidence | 41824 | 闭包内 113 次，包含 detach/结构/摘要/规范编码 |
| bounded mediareferences | 26199 | 16 次，返回 11520 行；本次不改查询 |
| readProtected / decode | 12211 / 11923 | 包含关系；差值不是精确磁盘延迟 |

父子函数统计包含重叠，不直接相加；异步区间 CPU 不冒充纯函数独占 CPU。
诊断原始文件保留在本轮独立 reports 中，不能用 Mac 剖析代替这些测量。

## 3. 实现前方案与自查

最小修订：内部 codec 暴露一次完整校验得到 `{proof, encoded}` 的组合结果，
复用现有 processEvidence；仅 Reader 的 v2 decode 和 ProofCache 入库消费它。
现有 validateEvidence/serializeEvidence 入口保留。版本链、outbox、各节点审计、
查询及所有 BSON/scope 校验不动；不新增全局、跨轮或跨节点信任缓存。

自查通过后实施：组合结果必须已经执行原 descriptor/深度/字节预算、完整结构、
引用集、scope、摘要和最终大小校验，且 proof 为 detached JSON 副本。
Reader 仍比较原始字节与规范编码，ProofCache 仍在无 await 区间内计费，
返回每次独立副本；不提供跳过校验标志。风险是误把未校验输入当作可信结果，
用篡改摘要、getter、跨孩子、调用方修改和调用次数反例保护。

先加入反例并保留红灯，再改三个实现文件。相关 codec/reader/proof/cache/
readiness 回归后，在 Ubuntu 同限额串行执行原单例、完整 readiness 和家庭全量。
新旧轮次分别归档；独立 QA 仍需复评。若失败继续 OPEN，不提高预算或缩减断言。
回滚仅撤销本次局部源码修订；没有数据迁移、部署或真实 cleanup/restore。

本次不提交、推送、修改 PR、合并或部署；不改变正式默认开关和既有审批。

## 4. 修订与验证终态

仅三个实现文件改变：`userDeletionRecoveryEvidence.js` 新组合入口调用原 processEvidence；
`userDeletionRecoveryReader.js` 的 decode、`userDeletionRestoreProof.js` 的缓存入库
复用其 proof/encoded。版本链、数据库查询及原大图测试源码没有修改。
新增 `userDeletionEvidenceEncodingBudget.test.js` 六项测试并加入原家庭 Jest 项目，
不是新测试框架。初次未注册时出现 no tests found，补入正常白名单后六项均红；
其中两个消费者反例明确观测到重复的 validateEvidence/serializeEvidence 调用。
实现后相关四套件 331 项通过。

实际 Ubuntu 串行验证（无插桩，原限额及断言不变）：

| 命令/阶段 | 结果 | 阶段耗时 / 大图报告耗时 |
| --- | --- | --- |
| resource-family 原 D2B-05 单例筛选 | 1通过，141项未选中 | 112118ms / 106870ms |
| resource-family 完整 userDeletionRecoveryReadiness.test.js | 142通过，0失败/跳过 | 414436ms / 106925ms |
| codec/reader/proof及新增encoding四套件 | 331通过，0失败/跳过 | 80007ms |
| npm run test:family-regression | 144套件 / 3972项通过，0失败/跳过 | 1661643ms / 114844ms |
| npm run test:t2:integration | 2套件 / 14项通过，0失败/跳过 | 48627ms |
| 最终双向隔离断言补验 | 6通过，0失败/跳过 | 单独 supplement-reports，不追溯计入全量 |

完整精确参数、JSON输出、退出码和时序保存在原始 `run.json`；以上各阶段exit0。
Jest assertionResults.duration包含beforeEach/afterEach，不等于测试函数的计时器
预算或剩余余量；原QA完整readiness的明确timeout仍保留。诊断分段统计亦不冒充
完整测试体精确边界。全量的大图耗时仍受环境波动影响，需独立同限额复评。

自查及独立代码复核：完整结构/摘要/BSON/scope检查保留、Reader原始规范字节比较
保留、物理读预算与缓存编码预算不混淆、计费无await、每次返回独立JSON副本。
独立复核提出一项P3：原新增测试只断言编码字符串不变，未证明proof双向隔离。
已补对象及嵌套引用、双向字段修改断言；Node22独立内存变异证明“返回原输入”和
“仅浅拷贝”均被永久测试拦截，复核通过。全量运行中不修改其源码：该轮使用补强
前的六项测试，结束后保留旧测试副本，再对最终六项做Ubuntu同限额补验。三个实现
文件完全相同；最终本地/服务器四份源码哈希一致，不把补验伪称重新跑过全量。

其他检查：受影响文件lint、干净源码导出副本的npm run lint、docs:family:check、
git diff --check通过。原工作区npm run lint失败（4项），原因是历史忽略目录
release-gate-artifacts里的旧JSX副本被全目录扫描；不删除证据、不调整规则，
保留此失败与干净源码检查的区别。前端/页面源码未改，复用固定4dff6871独立QA的
前端499项、Chromium/WebKit各14项与构建证据；浏览器运行于Mac正式合成服务，
不冒称Ubuntu跨机浏览器或真实iPad验收。

## 5. 证据、收尾与交接

本地忽略归档：`release-gate-artifacts/t2-d2b-budget-followup-2026-10-25/`。
含诊断原始统计、红绿报告、Ubuntu原始JSON/log、补验前测试副本、独立变异探针、
脚本、源码与SHA-256清单。固定4dff6871的独立QA失败目录继续只读保留；不覆盖
原批准快照，不把本轮开发通过结果回填到旧失败轮次。

本轮临时容器全部自然退出；诊断、全量、补验结束时原10个服务ID/StartedAt不变，
前端无身份探测HTTP200。没有挂载真实数据库、媒体或NAS，没有公网端口发布，
没有执行真实cleanup/restore、迁移、部署或Git写入。

当前候选是4dff6871加本地未提交修订，以归档source-manifest标识，不冒称新Git提交。
以上为提交复审时的交接快照；最新批准见 §6。DEVICE_PENDING、T8待授权、高级恢复与
新回收REMAINDER_DEFERRED，以及原批准的限定合成范围均保持；服务器测试通过
不等于合并main或真实家庭启用批准。

## 6. 复审通过及批准关闭（2026-10-25）

**D2B budget:** APPROVED / CLOSED / SYNTHETIC_ONLY
**D2B isolation P3:** APPROVED / CLOSED
**D2B retained:** HISTORICAL_FAILURES_PRESERVED / DEVICE_PENDING / REMAINDER_DEFERRED / T8_PENDING / NOT_AUTHORIZED

用户明确批准复审通过，关闭 `QA-T2-D2B-BUDGET-001` 及本次组合结果双向隔离 P3 测试保护缺口。
关闭依据为 §4 的 Ubuntu 同限额结果，以及复审确认的组合校验等价性、独立对象、规范字节比较和预算计费。
复审另执行 Node22 四套件331项（0失败/跳过，19.608秒），原输入别名和仅浅拷贝两种变异均被永久反例拦截；
四类合法证据的新旧规范编码一致，54份归档、26份远程证据哈希及9份候选源码快照核对一致。

原全量使用 P3 补强前的六项测试；最终四条更强隔离断言另有 Ubuntu 六项补验及上述复审，不能冒称最终断言重跑过全量。
原批准失败、固定4dff6871的141通过/1超时、实现红灯及工作区历史JSX归档引起的lint失败继续保留。
归档及 source-manifest 是复审候选快照，不随本次关闭文档更新重写；历史结果不改成全绿。

此 P3 不等于后置的 `C-CACHE-P3`。D01/T2-G、D2b剩余/D3/D4/E、高级恢复、新回收及 C-CACHE-P3 仍为 REMAINDER_DEFERRED。
真机 DEVICE_PENDING，真实启用属于 T8 待授权；不改变既有默认关闭和旧客户端升级拒绝。
本次仅同步文档及状态校验，不提交、推送、合并或部署，不执行真实 cleanup/restore。

### 6.1 本次关闭记录验证

Node22.15.0 下实际执行：

- `npm run docs:family:check`：通过；四份当前记录必须各有唯一的预算关闭、隔离 P3 关闭和保留边界状态。
- `npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js --json --outputFile=/tmp/t2-d2b-budget-closure-docs-20261025.json`：80项通过、0失败/跳过，exit0，8.589秒。原64项保留，新增16项内存反例覆盖四份文档的扩大范围、缺失关闭、重复冲突和丢失保留边界。
- `npx eslint scripts/check-family-docs.js backend/common/deployment/__tests__/familyDocumentationGate.test.js`、`git diff --check`：通过；没有放宽规则。
- 四份关闭文档的围栏和本地链接目标检查通过；54份归档字节数/哈希一致，原批准JSON与HEAD逐字一致。

本轮没有重新执行业务全量或服务器测试；§4 是已复审证据，不冒称本轮重跑。仅更新文档、现有校验器及其测试，业务修订保持原样。

## 7. 提交交接授权（2026-10-25）

关闭记录完成后，用户另行授权核对本次代码与文档范围、敏感信息检查、提交推送当前
`codex/t2-synthetic-acceptance` 分支、同步 PR #27 并检查 CI。此前“不提交”是对应轮次的历史边界，
本次授权不包含合并或部署。新的提交及 CI 结果在 PR 中按提交 SHA 单独记录，不回填历史失败。
提交范围仅组合校验优化、永久反例及注册、文档门禁和本次关闭/交接记录；原始日志、截图、
环境文件及本地忽略归档不进入提交。DEVICE_PENDING、高级恢复和新回收后置状态不变。

## 8. R2 最终独立证据及当前收口边界

§4为开发自测，§6为当时复审/批准记录；新增的R2独立服务器回归不可与它们拼接。
R2最终结论为 VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE，四项汇总、根因与原失败追踪见[评审记录 §6](family-self-directed-learning-t2-qa-p2-review.md#6-四项最终独立-qa-与本地收口2026-10-25)，
精确九文件候选、原始/归档哈希及命令见[独立证据索引](evidence/t2-synthetic-2026-10-24/pr27-independent-qa-closure.json)。

R2基础4dff6871，candidateDigest `5ba84f8668e8f0adc679ee7e4d5cfd4a6c8cf2f429935a5cb70f4d8df3b66547`；
最终测试哈希 `99ef1e675574deceeb06b14a99539760986de8d77b7f214cc8551d59521d8e04`，整个独立批次固定最终深隔离断言。
当前五份相关代码/测试/注册与其一致；后续关闭文档及文档门禁变更不属于原九文件全量身份，不能声称整棵树完全相同。
2026-10-25 12:43:38结束：完整readiness142、四套件331、家庭144套件3972、正式HTTP14均通过，完整套件无失败/跳过，docs/lint通过。
三个上下文的大图duration108240/111855/113363ms是包含钩子的Jest记录，不是精确预算余量。原目标筛选仅1项通过，另141项未选；各套件有重叠，不累加覆盖数。
这与§4开发全量3972项后单独补验最终6项是不同轮次：R2无需拼接补验，原开发记录也不因此被改写。

R1的141通过/1超时、旧批准失败以及QUERY_ONLY处置原样保留。60份R2归档哈希核对一致，原归档不修改或移动。
四项文档收口已复审通过，用户最新授权验证后提交推送当前分支、同步PR #27并检查新CI，详见[评审记录 §6.2](family-self-directed-learning-t2-qa-p2-review.md#62-四项文档收口复审通过及提交授权)。不将PR转Ready、不合并、不部署。此前已推送a9e21fe6保留不回滚。
DEVICE_PENDING、T8待授权、高级恢复/新回收及全部后置状态保持；不为文档收口重新启动测试服务或运行cleanup/restore。
