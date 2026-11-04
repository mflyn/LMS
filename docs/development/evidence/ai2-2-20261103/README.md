# AI2-2 本地合成候选

日期2026-11-03，基线 `4655d30f1b61b55f400b67f16f9143dd191de1d2`；仅本地，不提交推送部署，不调用真实模型。
AI2-1已获批准；两项设计P1 CLOSED_DESIGN，实施保护仍分批验收；AI-2总门禁OPEN。

范围：新增学习包/Attempt/命令模型、校验、事务/索引就绪检查、发布/撤回/审核及只读服务、独立HTTP工厂。
共8个新增源码/测试文件，现有setup仅添加AI2副本集选择，eslint仅将AI2纳入既有规则，共10个代码文件。
不含其他线程T8代码或历史证据增量；设计/计划/门禁中的本轮说明不作为业务补丁内容。
正式server/Gateway未接入，AI2-3媒体提交/认证正文/恢复及AI2-4/5页面闭环未实现。

本机归档位于原项目忽略目录 `release-gate-artifacts/ai2-2-20261103/`：

| 文件 | SHA-256 / 用途 |
| --- | --- |
| code-candidate.patch | `071e5d390662a3c3b637567789d7c90513466396ee592be212954368a34ec46b` |
| candidate.json | `f99e397ddf5e72fc8e282cb325b044451ae0d57c0cf20816663b8538f8ff9b7d`；10文件哈希、补丁与13份初始验证日志/结果哈希 |
| targeted.json / targeted.log | 3 suites、33 passed、0 failed/0 skipped；实际签名HTTP与临时副本集，媒体为只读端口替身 |
| doc-regression.json / doc-regression.log | 1 suite、313 passed、0 failed/0 skipped；文档回归，不是AI2业务全量 |
| red.log / http-red.log | 初始模块尚未实现的失败；不是业务反例已执行 |
| empty-red.log / review-p2-red.log | 空图片审核1 failed；成功确认依赖媒体3 failed；修复后全定向通过 |
| http-first.log / http-second.log | 沙箱日志EPERM导致suite失败；故障注入路径错误1 failed，均保留 |
| http-final.log | 修正执行上下文及故障注入后4 passed，含真实ECONNRESET与原命令重放 |
| full-regression-evidence.json | `c535f543030b410caf8b8ac12e31c26216643d4cee4807c954627767f4d6a360`；后续全量记录补充，不覆盖初始候选索引 |
| homework-regression.json | `9dc797d9adc388af3c8ef3001903b8caa8fd2bf1c0fbe91d594d1c7de782ded1`；41 suites / 1519 passed，0 failed/0 skipped |
| homework-regression.log | `ffcfaf2c23044412f38b712e54bdf16525962479e2aacf2175e4f71e8a4e85b9`；exit 0，214.139秒，既有driver弃用警告保留 |

验证使用已有Node22/Jest依赖，无安装。可复验命令：

```sh
node /path/to/existing/node_modules/jest/bin/jest.js \
  --config=backend/services/homework-service/jest.config.js --runInBand \
  --runTestsByPath backend/services/homework-service/__tests__/services/ai2Contract.test.js \
  backend/services/homework-service/__tests__/services/ai2Service.test.js \
  backend/services/homework-service/__tests__/services/ai2Http.test.js
node scripts/check-family-docs.js
git diff --check
```

全量受影响服务命令：`jest --config=backend/services/homework-service/jest.config.js --runInBand`。
仅称homework当前全套，不宣称全仓、前端、正式Gateway或AI2-3协议验证通过。当前批次READY_FOR_ACCEPTANCE，待用户验收。

独立评审及修复说明见[测试方案§6](../../family-ai2-test-plan.md#6-ai2-2-批次)。
后续用户批准本批验收及本次P2关闭，当前AI2-2 ACCEPTED；上文READY_FOR_ACCEPTANCE保留为送审快照。
独立复跑33项全部通过（17.407秒，0 failed/0 skipped），结果`/private/tmp/ai2-2-review-targeted.json`；
本轮复核重建补丁、10个源码哈希及15份归档结果/日志哈希一致。1519/313项仅核对归档，未冒称独立重跑。
AI2-3已获实施授权，仍不能以本批媒体替身和独立HTTP结果关闭AI-2总门禁。
独立复验原件已复制到同一忽略归档目录，不依赖临时文件存续：
`independent-review-targeted.json` SHA-256 `7c829c64006d10ba444c46e0a0caf4a9cb9629438da9bd89beaf4af5de3dbd57`；
`independent-review-targeted.log` SHA-256 `be1bd3b132d0e85d6c19e7041e3551e61dd0762e148178bfffd880c886dddb38`。
源服务、媒体端口替身不等同真实媒体内容读取；HTTP夹具不等同正式Gateway或浏览器验收。
保留T4/T8/AI-1 OPEN、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED、T9 NOT_STARTED。不以本候选关闭总门禁。
