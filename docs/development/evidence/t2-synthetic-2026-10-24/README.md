# T2 合成工程证据索引

本目录是可随 Git 检出使用的脱敏摘要，不是新的测试运行，不替换本地完整报告。
T2 为 APPROVED / CLOSED，仅限 ENGINEERING_SYNTHETIC_ONLY；批准时业务全量为 FAILED，原报告保留。
[批准记录](../../family-self-directed-learning-t2-closure-approval.json)和[执行记录](../../family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)保持权威。

## 历史独立验收

原归档目录 `release-gate-artifacts/t2-engineering-closure-2026-10-24/`。
当时独立全量143套件3926项通过是历史事实，不是最新结果；不得用它覆盖下一轮 D2B-05 失败。
更早的 `t2-three-p2-2026-10-24` 中旧JWT断言失败同样保留，不抹去失败历史。

## 最新全量失败

本标题保留历史链接锚点，以下为批准时的失败报告，不代表后续修订的运行结果。

原归档目录 `release-gate-artifacts/t2-p2-approved-acceptance-2026-10-24/`。
`npm run test:family-regression -- --json --outputFile=/tmp/t2-approved-p2-family-20261024.json`：
143套件（142 passed / 1 failed），3943项（3942 passed / 1 failed / 0 pending），exit1。
唯一失败 `D2B-05 real connected proof bytes exceed 16MiB before the 100-file ceiling`：
预期 USER_DELETION_EVIDENCE_INVALID、nativeErrors为空，实际 mediareferences 查询 MongoServerError code50，
返回 USER_DELETION_READINESS_NOT_READY。当时该查询缺陷未修复；后续修订单独记录，不能覆盖本报告。该高级恢复预检未接入当前页面运行路径，仍为 REMAINDER_DEFERRED。

## 限定范围关闭验证

原归档目录 `release-gate-artifacts/t2-synthetic-approval-2026-10-24/`。
关闭文档套件59项、公共模块41套件662项通过；不是一轮新的业务全量。
旧校验器红灯和空白正例夹具遗漏失败均保留，不能称从未失败。

## 可携带摘要与哈希

- [结果摘要](results.json)：从原Jest JSON提取计数和失败断言，保留各轮差异。只替换绝对工作区路径为 `<repository>`，不改断言内容或测试结果。
- [原始归档哈希清单](artifacts.sha256.json)：本地归档的仓库相对路径、字节长度和SHA-256；不包含令牌、日志正文或媒体内容。
- [本次提交核查](../../family-self-directed-learning-t2-github-handoff.md)：提交范围、验证与未授权事项。
- [提交前验证摘要](github-preflight.json)：本轮新跑的组件/HTTP/浏览器结果、保留的失败、干净检出53项lint错误及敏感信息扫描归类；不能冒称CI全绿。
- [PR #27 lint修订验证](pr27-lint-fix.json)：独立记录53项错误修复后的干净检出lint、当前家庭后端回归及历史计数差异；不覆盖上述历史失败或后置状态。
- [PR #27 D2B-05查询修订](pr27-d2b-query-fix.json)：保留上次CI超时结果，独立记录本次查询诊断、永久反例与完整回归；不代表启用/完成高级恢复或真机验收。

完整JSON/日志及浏览器截图仍留在本地忽略目录，不随本次PR上传；远端摘要不是这些文件的完整备份。
文档链接均指向可入库索引，校验器不得依赖本地忽略目录存在，也不得跳过普通链接校验。
后续CI生成自己的运行产物，应明确运行提交和结果，不能据新报告改写此处历史报告。
历史归档中一个空白构建manifest不能解析，已在 results.json 的 unreadableJson 明示；不以该文件证明构建通过，本轮另有实际构建结果。

## 未完成边界

真机 DEVICE_PENDING；真实家庭部署/备份/隔离恢复为 T8_PENDING / NOT_AUTHORIZED；
高级恢复与新回收、D01/T2-G、D2b/D3/D4/E、C-CACHE-P3 均 REMAINDER_DEFERRED。
PR用于保存与评审，不合并、不部署、不启用新回收、不自动开始T3–T9。

## D2B-05 查询缺陷关闭

2026-10-24 用户复审通过并批准查询超时缺陷 APPROVED / CLOSED / QUERY_ONLY；不是 D2B 整批或高级恢复/新回收验收完成。
修复提交 `e744cba1` 对应[CI 40099315976](https://github.com/mflyn/LMS/actions/runs/40099315976)：后端143套件3958项及完整发布门禁通过，上传产物 `release-gate-artifacts` 可核查。
该次CI日志已脱敏归档于本地 `release-gate-artifacts/t2-pr27-d2b-ci-2026-10-24/`，其 `artifact-manifest.json` 记录30份文件哈希；修复诊断/红绿验证另存 `t2-pr27-d2b-fix-2026-10-24/`（19份）。
独立复审重跑相关139项通过、无失败/跳过，报告哈希和用户批准原文见[执行记录 §18](../../family-self-directed-learning-t2-execution.md#18-d2b-05-查询超时复审与批准关闭2026-10-24)。
本轮新增关闭校验的红绿验证另行记录，不修改 `pr27-d2b-query-fix.json` 中提交前的失败/待CI状态，也不修改原 T2 批准文件、旧失败或148份历史归档。
DEVICE_PENDING、REMAINDER_DEFERRED、T8_PENDING / NOT_AUTHORIZED 保持；当前仅授权专用分支提交/推送及PR同步，不合并、不部署。

## 四项 P2 独立复评最终索引

[可携带独立证据索引](pr27-independent-qa-closure.json)区分R1前三项关闭及原D2B失败、R2预算最终关闭和开发自测。
四项当前均 VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE；问题/修订/关闭理由及当前授权见[评审记录 §6](../../family-self-directed-learning-t2-qa-p2-review.md#6-四项最终独立-qa-与本地收口2026-10-25)。
索引记录源归档相对标识、清单哈希、关键文件的原始与归档哈希、九文件候选和命令/结果；不包含真实账号、服务器地址、令牌或原始日志正文。
原始证据仍在独立QA的冻结目录：R1 `t0-t2-p2-independent-2026-10-25`（85份）、R2 `t0-t2-d2b-followup-2026-10-25/r2`（60份）。本次逐项哈希核验，未复制/改写/移动原目录。
这是持久可追溯索引，不是原始证据完整备份；源清单未提供sourceSha256的派生文件以archiveSha256校验，不伪造原始哈希。
R2最终测试包含四条深隔离加强断言，全量3972项是独立一次完整运行；不同于开发早先全量后的单独补验，后续CI3988项也另有文档门禁增量。
四项文档收口复审通过；用户最新授权验证后提交推送当前分支、同步PR #27并检查CI，先前条件合并继续暂停。已推送a9e21fe6不回滚；不转Ready、不合并、不部署。复审记录见[§6.2](../../family-self-directed-learning-t2-qa-p2-review.md#62-四项文档收口复审通过及提交授权)。
历史失败、DEVICE_PENDING、T8待验收和全部REMAINDER_DEFERRED不变。
