# DeepTutor v2 限定本地验收与旧 accepted 重放 P2 关闭

日期：2026-11-23。依据：用户明确批准本批限定本地验收及旧 accepted 重放 P2 关闭。

| 对象 | 当前批准状态 | 边界 |
| --- | --- | --- |
| DeepTutor v2 本批 | ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY | 受限Provider、持久operation与正式装配的本地合成验证 |
| 正式AI1旧v1 accepted重放P2 | CLOSED / USER_APPROVED | 原记录只读重放，不再次派发或改变历史记录 |
| 下一批页面与正式接线闭环及两项页面P2 | USER_ACCEPTANCE_PENDING | 本次批准不覆盖 |
| AI-1总门禁及真实发送 | OPEN / NOT_AUTHORIZED | 精确计数资格后置，费用估算不是硬上限 |

## 原候选与独立证据

本记录为独立追加，不修改原候选、补丁、manifest、历史报告或当时的PENDING状态。
本机只读证据包名称：`ai-manual-trial-deeptutor-final-20261123`，位于本开发线程的可视化证据目录。
本记录与原包的`candidate.json`、`README.md`、`FINAL_IDENTITY_REVIEW.md`及`independent/`共同构成批准依据。

| 身份 | 固定值 |
| --- | --- |
| DeepTutor base | `d5a30cbd95c7fbed53f7423dd046915a0eb1ebf6` |
| 17文件完整补丁SHA-256 | `72edd3e34816811e8da724afa4a097325060b258a996fd7adff7bd8126229aa6` |
| 相对旧d1装配的增量SHA-256 | `3c39822fa1fab97749f94e2d942155fd595f33516189462b73c3fb2fe9df81d6` |
| 原84文件manifest SHA-256 | `0e42015d3a1fddaab6ce71ccfff06e645ccf713ac07c9b329139d84a41a5d27b` |
| 独立复验证据manifest SHA-256 | `c16899fec94236146aaaa86ca1100d05eae879ea09b25cc76ae183e45095336d` |

本次关闭记录前只读重验原84份归档的大小与SHA-256、当前DeepTutor17份候选源码及两份补丁摘要，全部一致。
完整/增量基线重建及最后身份复核沿用原证据，不冒称本轮重新执行重建或测试。

## 评审结论与验证分层

旧v1 accepted经正式入口重放只返回原持久结果，不因重复PUT或重启进入派发。
修复已有正式入口永久反例及重开历史派发的变异反例；原命令、UNKNOWN、权限隔离及默认关闭保护保持。
原独立评审未发现本批剩余P1/P2阻断，本次用户批准关闭上述单一P2，不关闭其他问题或总门禁。

- 开发最终相关回归：298通过、0失败/错误/跳过，pytest77.05秒，wall77.966秒。
- 独立正式复验：新v2 36 + 原AI3正式装配12 + 原AI1运行时26 = 74通过，0失败/错误/跳过；
  JUnit69.856秒，wall70.758秒；原180秒外层及30秒正式子进程预算不变。
- 8类内存变异：12项预期失败、7项合法对照通过；独立方审阅注入、日志及JUnit，未重复执行变异。
  usage-cap变异为误套v1上限导致拒绝，store-zero为返回投影补零，不冒称SQLite持久写变异。
- 正式main/lifespan使用本机ASGI及合成配置，SDK/httpcore网络I/O为替身；原2项回环HTTP使用合成Provider。
  不等于真实模型、Ubuntu新版部署、真人或iPad验收，也不与历史Ubuntu267项或下一批253/282项混算。

298项不含原5项leader缺插件失败，不写成DeepTutor全仓全绿。保留首轮288通过/2失败、
283通过/5项缺插件失败、30秒/180秒历史超时、缺可选依赖及其他历史失败；历史超时根因仍缺证。

## 当前状态与自查

同步入口：[门禁](../../family-self-directed-learning-mvp-gate.md)、
[设计中的后续批准记录](../../../superpowers/specs/2026-11-21-ai-manual-trial-fee-design.md#75-deeptutor-v2-本批用户验收与p2关闭2026-11-23)。
原设计§7.3、§7.4及下一批冻结包中的待批准描述保留为历史时点；本追加记录仅使§7.3对应批次获得批准。

本次只改文档，现有业务实现和下一批在途增量不动；自查核对批准范围、旧证据身份、分批计数和未关闭状态。
复用`node scripts/check-family-docs.js`与`git diff --check`校验，不新增测试或治理框架。
本次两项命令均exit 0；另核验本批原84份归档、下一批165份归档未变化，设计旧正文前缀完全一致。
文档校验沿用既有412项契约夹具与38项需求检查，不把本轮文档校验计入298/74项产品验证。
T4/T8/AI-1 OPEN、DEVICE_PENDING、SERVER_TIMING_UNVERIFIED、Docker INCOMPLETE_FAILED、
精确计数资格后置、历史失败、非阻断补测及其他未关闭/后置状态不变。
不调用模型、不操作服务器、不提交推送、合并或部署，不把本次批准当作真实试用授权。
