# 重复计划最终集成批准与独立复验绑定

状态：`FINAL_INTEGRATION_ACCEPTED`、`CLEANUP_P2_CLOSED`；用户于2026-11-15批准。重复计划整体门禁仍`OPEN`，关闭材料为`SYNTHETIC_GATE_REVIEW_PENDING`，见[当前记录§12/13](../../family-recurring-tasks-test-plan.md)。本目录是验收后的新增记录，不替换任何旧冻结归档。

## 已批准候选

- 基线：`3816c3f2a45daff8b66221cfffb322de11bdce33`。
- [37文件候选清单](../recurring-tasks-final-integration-20261115/candidate-files.json)及[原补丁](../recurring-tasks-final-integration-20261115/candidate.patch)。补丁SHA-256：`dd58f6480900ab1bec1679043e7441ebae5cfb732a98f5569a5332df0807756b`。
- 复审时37文件重建一致、7归档文件与29条原始证据匹配、第三批30个非文档文件不变。验收后3份当前文档追加批准与待审条件，不改业务/测试，不重写旧文档快照。
- 历史[最终候选README](../recurring-tasks-final-integration-20261115/README.md)中的待复审、前轮独立只核浏览器日志等描述保留；以下是随后实际执行的独立复验，二者不互相覆盖。

## 本轮独立证据

`verification.json`记录原文件名、原SHA-256及脱敏摘录；原始文件仍在本机临时目录，摘录不冒充原始字节。`archive-files.json`绑定本目录文件（不含自身）。

| 原文件 | 结果与边界 |
| --- | --- |
| `recurring-final-user-review-audit.json` | 复审核验汇总；其当时“待批准”措辞保留，当前批准以本README和§12为准 |
| `recurring-final-review-18.json` | 原T2入口4套件18项通过，包含15项HTTP/相关业务与3项控制流夹具，不是全仓回归 |
| `recurring-final-review-mutant-audit.json` | 首次确认审计变异，1项预期断言失败、退出1，其他未选用例不算通过 |
| `recurring-final-review-mutant-date.json` | 跨日去重变异，1项预期断言失败、退出1 |
| `recurring-final-review-mutant-cleanup.json` | 移除完整调用等待，3项预期断言失败、退出1；非超时假阳性 |
| `recurring-final-review-browser.log` | 正式Chromium5项实跑通过，零重试，42.4秒；不是仅核日志，也不是WebKit/真人/iPad |

独立回归和浏览器复用既有Jest/Playwright入口及依赖，真实Gateway、user/homework/resource/progress、动态回环端口与独立临时副本集/媒体目录。正常响应未以mock替代；丢响应和屏障是限定故障注入。跨日显式注入服务日期，不是自动timer跨午夜。收尾3项用受控异步替身，不冒充真实数据库网络故障。

关闭的P2仅为测试异常收尾：所有已进入调用在完整execute/endSession完成后才恢复方法，正文断言与执行错误均保留。永久反例、合法正例及变异已独立验证，用户已批准关闭。

## 剩余与授权

§13列明限定合成总门禁仍需用户批准；原计划完整家庭后端回归尚无执行证据，需要补跑或用户明确接受已验收分批证据作为限定收口依据，不在此自动豁免。前端历史全量及后续专项、原开发8/5项与本轮独立5项保持分列，不累计为全量一次全绿。

保留历史失败、自动timer多周期非阻断补测、真人/真机待验、T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、Docker INCOMPLETE_FAILED和后置范围。真实启用前索引/凭据/事务/媒体预检及安全上下文待另行授权。本次只更新批准记录、证据索引和关闭材料，未重新跑业务测试，未提交推送、部署、更新真人入口或操作服务器/模型。
