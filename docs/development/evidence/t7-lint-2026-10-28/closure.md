# T7 lint 问题限定关闭

日期：2026-10-28。用户经独立评审线程明确授权补齐本轮 lint 关闭记录与测试证据，
剩余 Docker/Git clean 方案待批准执行。QA-T7-LINT-COVERAGE-001：CLOSED / USER_APPROVED。
这不关闭 T7/T4，不把旧完整 release 失败改成通过。旧七项 P2 继续保持其既有批准关闭。

## 固定身份与独立证据

- 基线 7d519d20b5f4409a4f6fb66a756a8f571e55b68b 本身不含未提交 T7。
- 六文件增量 SHA-256：082876d9f0378ae74806b7e9ea585265f4c0fc0db9fa2d763a2225d68b78089f。
- 完整候选 SHA-256：515043584142e9819af05016a57d99eef3812b54ba763a403bb1a302aaa6a310。
- 开发 validation SHA-256：bb5c954db53fb062b6dfcbd97a9cc2dea6e05412360b0863dd082a1bc0e49bfb。
- 独立 manifest SHA-256：43b2dc1b25323c230d1ed74ab803418d99c776e00f5e18cda31c5070a8a14830。

独立原件目录：
`/Users/REDACTED/.codex/visualizations/2026/06/18/019ed96b-6785-7492-bf22-9f7fd60fbfb5/t7-lint-followup-2026-10-28/r1`。
其 38 项清单和 manifest 共 39 文件按原字节复制到
`release-gate-artifacts/t7-lint-closure-2026-10-28/independent`；源/副本哈希另绑定于
[closure-evidence.json](closure-evidence.json)，不修改原独立封存目录。

独立报告结果为 INDEPENDENT_REVIEW_PASSED / VERIFIED_FIXED，未发现新增问题：

| 独立 Node 22.15.0 / macOS 合成执行 | 结果 |
| --- | --- |
| 原目录及包含44份实物历史错误夹具的快照，原 npm run lint | 均 exit 0 |
| 质量/文档联合 | 280 passed / 0 failed/skipped |
| 周报模型 | 33 passed / 0 failed/skipped |
| 正式 HTTP | 35 passed / 0 failed/skipped |
| 两周报实际规则和正反对照 | 各61规则；no-undef/error；坏值各1error，合法值0error/0warning |
| 五个独立 QA 副本回退 | 2/4/4/1/1目标断言失败；runtimeError/pending0 |

独立副本未复用开发 preload，AST 等价及服务只删未用局部行再次核实。开发 Node26 结果见
原 README/validation，不能把两类证据混为同一次运行。本次文档收口不重复业务回归。

## 文档增量与保留边界

本轮只更新 Gate 当前行并追加 §27.11–27.13、更新实施计划当前状态，以及新增本摘要/索引。
冻结 README/self-review/validation 和两个补丁保持原字节；其中待独立复评表述是当时快照，
当前状态以本摘要和 Gate 最新节为准。关闭后 Gate/计划新哈希作为文档增量独立列出，不冒称
仍等于冻结候选。关闭前原件另存本轮 before/。

保留原44错误、配置后3错误、首轮断言失败、旧394/47证据、旧独立119项及manifest和七项旧P2批准。
本批新的38项独立证据也不改写。当前 lint 阻断已解除不代表完整 release 通过；03–18、07b/13b
仍缺原完整入口证据。Docker/Git clean 方案仅提出，状态 PROPOSED_WAITING_APPROVAL。

文档与状态实际验证的命令、退出码和日志另存本轮 validation/ 并由新索引绑定；
不把本次文档校验当成业务回归或 Docker 已执行。
首次收口校验因新增 closure-evidence.json 尚未生成而发生本地链接失败，原输出完整保留于
validation/。补齐新索引后重新校验的结果另存 validation-complete/，不覆盖首轮记录；
新索引仅在收口结束时冻结，不改动之前已冻结的 validation.json 或其他历史索引。

T4/T7 OPEN、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、REMAINDER_DEFERRED、T8/T9未启动不变。
未提交、推送、改PR、合并、部署、自动stash/清理或启动新执行阶段。
