# T7 lint 聚焦修订

## 实施前核实与方案自查

2026-10-28，按独立评审线程传递的用户批准执行 Gate §27.9 最小方案。
独立报告 QA-T7-LINT-COVERAGE-001 为新增质量覆盖 P2，不重开已批准关闭的七项业务/测试 P2。
原独立清单列出的 119 份归档只读保留，含 manifest.json 自身共 120 文件；来源和逐文件哈希
见本批 before.json。不覆盖原候选或证据，原实施前表述另存 pre-result-README.md。

实施前实际调用 ESLint API：weeklyReportService.js、weeklyReports.test.js 均 ignored=false、
ruleCount=0，注入未定义调用为 0 error；正式 weeklyReflection HTTP 对照 61 rules、1 error。
原根 lint 的 44 个历史 JSX 错误已由两线程分别复现。本批红灯命令另存，不以报告代替新测试结果。

聚焦方案：根全局 ignores 精确增加 release-gate-artifacts/**；将两份周报文件显式匹配既有
Node/Jest sharedRules。复用 task5QualityGate.test.js，通过实际 ESLint API 检查归档与正式路径、
有效 no-undef error 和合法语法/全局变量；不新增测试框架，不修改规则级别或加入 eslint-disable。
按删除归档排除、扩大正式源码排除、分别撤销两份覆盖做独立内存变异，不能靠静态字符串断言蒙混通过。

方案自查：PASS，发生于添加永久反例及配置修订之前。影响面限静态检查与测试；配置可独立回滚，
无需数据迁移。不会删除/修改归档、放宽源码范围或启动 Docker。若新增 lint 暴露真实源码问题，
再做最小修复和受影响业务回归；未经需要不重构业务。测试先红、配置后绿，阶段原件按顺序保存。

原始新证据目录：release-gate-artifacts/t7-lint-remediation-2026-10-28。
本批状态：IMPLEMENTING；最终结果追加于下方，不覆盖本节的实施前顺序。

T4/T7 OPEN、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、两项 OPEN_NONBLOCKING、
T8/T9 未启动及 REMAINDER_DEFERRED 保留。不提交、推送、改 PR、合并、部署或运行完整 release。

## 开发验证与自查结果

当前：FIXED_PENDING_INDEPENDENT_REVIEW。独立复评由原评审线程继续，本文件不代替其结论，
QA-T7-LINT-COVERAGE-001 不提前关闭。上述 IMPLEMENTING 是实施前记录，原件另存 pre-result-README.md。

配置严格按获批范围新增一条根归档忽略和两条周报规则路径，规则级别不变。新规则暴露三项源码错误：
两处 test.each 调用换行、一个未使用的局部 weekEnd。修订前后测试 AST 相等，生产源码只删该行，
没有削弱原断言、变更快照算法或修改接口；核对见 minimal-source-review.json。

| 证据名称（原始目录内） | 结果 |
| --- | --- |
| red-quality | 4 failed / 8 passed，含初版断言 TypeError，保留但不作为有效变异依据 |
| red-quality-assertions | 4 failed / 8 passed，归档及缺失规则的有效断言失败 |
| red-root-lint | 44 errors，exit 1 |
| green-quality | 12 passed / 0 failed/skipped |
| configured-root-lint | 3 errors，exit 1；新覆盖揭示的真实源码错误 |
| fixed-root-lint | exit 0，0 errors/warnings |
| fixed-weekly-model | 1 suite / 33 passed，exit 0 |
| fixed-http | 6 suites / 35 passed，exit 0，58.310 秒 |
| mutations-summary | 五种变异全部被永久反例拦截；config/测试磁盘哈希未变 |
| final-quality-doc-gate | 2 suites / 280 passed，0 failed/skipped，exit 0；12 质量 + 268 文档 |
| final-docs / final-root-lint / final-diff | 三条原命令均 exit 0 |

五次独立变异分别撤销根归档忽略、误忽略 backend、误忽略 frontend、撤销周报服务覆盖、撤销
周报测试覆盖，失败数依次 2/4/4/1/1，均为预期断言失败，无跳过；不以运行时异常充当变异有效。
`runner.cjs`、`mutation-preload.cjs` 为本轮一次性证据工具副本，不是新增项目框架。
原命令、退出码、时长分别记录在各 `*-command.json`，最终文档和质量联合验证见 `final-*`。

环境：本机 macOS、Node 26.9.0；业务测试使用既有合成 harness / 临时 Mongo 副本集和正式 HTTP
工厂，未访问真实家庭数据。不把本轮结果冒称 Node 22、Ubuntu、iPad 或浏览器重跑；页面实现未变，
未重跑前端 739、浏览器 54、家庭后端 4506 或完整 release。历史失败和旧独立报告仍原字节保存。

自查结论：当前未发现新增问题。核对了精确忽略边界、两个文件的实际 no-undef/error、合法全局变量、
嵌套同名目录不被误忽略、五个回退反例、AST/单行差异及周报/正式 HTTP 回归。仅开发自查通过，
不得写为独立验收通过。总门禁仍 OPEN，后续完整 release 环境与 Git clean 不属于本批授权。

## 冻结与独立复评入口

- `incremental.patch`：相对于本批 before/ 的六份代码/门禁/计划增量；不替换旧 T7 冻结补丁。
- `candidate.patch`：基于既有 Git HEAD 的当前完整 T7 非证据文件候选，含新增质量测试；供核对组成。
- `validation.json`：上述补丁、当前文件、实施前文件、历史归档与独立原件的哈希索引。
- 本 README 及 `self-review.md` 也绑定于新索引，避免循环将 validation.json 自身列入其内容。

原完整补丁 61e4591c8eb4520395d9e27e029cf14b6c8918db333acb614e025f86f3d898f7、
旧 validation 19ab93679c2695373efc5c9de5edffbed8f9f5cbbe1350f007dc698c85b8af8f 及七项关闭
索引保持不变。新候选不能倒写成七项关闭时的原候选；旧关闭摘要中的未实施描述保留为历史快照。
