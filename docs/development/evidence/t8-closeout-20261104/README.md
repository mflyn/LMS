# T8 当前 main 本地收口候选

> 当前公开交付准备见[2026-11-05交付记录](public-delivery.md)。下文是已批准的历史候选及权限快照；新授权仅允许专用分支与Draft PR，不关闭T8或授权部署。

日期：2026-11-04。基线：`a4f051e26f3514da051910a3495e11b149a32c45`。
状态：ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY；T8 OPEN / RELEASE_NOT_READY。
迟到浏览器关闭失败传播 P2：CLOSED / USER_APPROVED。
本批只整理既有未提交增量并做相称复验，不包含提交、推送、分支创建、真实模型或部署授权。

## 范围与历史核对

- [认证恢复归档](../t8-nonnas-20261103/README.md)64件、[浏览器恢复归档](../t8-browser-20261103/README.md)126件的文件大小和SHA-256全部匹配原清单。
  原清单摘要分别为`4bcf262b65bfd325c65ee64dd2bf20494d0dc0115e8e4bb82c248e8e089f1fce`、
  `ec1996bbbbf7e55da123dfa48c09900a32dcc5008b8157497db0d775cae2bc6a`，没有覆盖原失败或冻结记录。
- 进入本批时四份浏览器夹具/测试与原候选一致；归档夹具也与前序冻结一致。
  本批只因独立审查修订收尾helper及其测试，不修改业务实现、前端功能、权限或恢复协议。
- 当前main重建前端，使用既有MongoDB8.0.10、Database Tools100.12.1、Node22.15.0和Playwright浏览器。
  流程在当前版本生成合成备份并恢复到同版本空库；**不是历史4655提交备份到a4版本的跨版本迁移验收**。
  真实HTTP、七个正式应用工厂、原命令和图片字节检查沿用原夹具，不以成功API替身代替。

## 本批 P2 与复评

独立审查发现：`stop()`先调用close时浏览器尚未attach；随后迟到attach的close失败被work的catch吞掉，
可能把失败收尾记录为成功。最小修订为等待work后再次等待已有closing promise；普通业务错误仍由run报告。

新增两项永久反例，不删改原11项：
1. stop早于attach，关闭未完成时必须等待；迟到关闭失败传出，重复stop仍拒绝，close只执行一次。
2. 普通业务失败但关闭成功时，不把业务异常误报成收尾失败。

旧实现红灯为1失败/12通过，新实现13通过。独立复核实际另跑13项（0.503秒、退出0），确认修复有效，未发现新增P1/P2。
送审时本P2状态为FIXED_REVIEWED / USER_ACCEPTANCE_PENDING；该历史记录不覆盖下方用户批准关闭。
独立复核没有启动浏览器、HTTP或Mongo，不能称为独立双引擎复验；原浏览器报告与本批双引擎均属于开发实跑。
最终独立只读复核已核对本批候选、补丁重建、97件清单、408项报告和文档边界，未发现新增P1/P2。
上述独立13项实跑与随后仅阅读证据的复核分开记录，不把文档复核计为重复运行测试。

## 当前候选验证

| 验证 | 结果与边界 |
| --- | --- |
| 前端生产构建 | 退出0；保留既有Browserslist数据过旧提示，未安装/升级依赖 |
| 首轮归档/正式HTTP | 2套15通过；收尾P2修订前的开发证据单独保留 |
| 首轮Chromium | 11通过；不替代修订后的验证 |
| P2红灯/绿灯 | 1失败12通过 / 13通过；红灯不抹除 |
| 修订后Chromium | 11通过、0跳过，18.483秒 |
| 修订后WebKit | 11通过、0跳过，24.114秒 |
| 修订后归档/正式HTTP | 2套15通过、0跳过，18.501秒；浏览器开关不设置 |
| 独立复核 | 限定helper及单测，13通过；不与开发浏览器混计 |
| 最终定向回归 | 4套408通过、0跳过，47.359秒；文档、备份预检、实例/工具生命周期及浏览器owner |
| 状态校验/ESLint/diff | 均退出0；保留42项AI-2关闭状态探针和412项契约夹具 |

两引擎均完成重登/原命令恢复、旧版本拒绝、审核回看、跨标签迟到真实媒体响应后私有视图不再显示；
pageErrors为空、无console warning，指定路径预期409/403保留。原导航取消记录保留，不声称零网络错误。
最终report均记录browser/owner/tools/HTTP/Mongo关闭成功；严格删除恢复仍返回
`LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`。不新增上传按钮或删除按钮浏览器覆盖，不扩展高级恢复。

命令复用[原浏览器命令](../t8-browser-20261103/README.md#验证与失败历史)：设置`T8_BROWSER_ENGINE=chromium`或`webkit`，
`T8_WEB_BUILD`指向本批构建目录，Jest `--testMatch '**/familyProductRestore.drill.js'`。
默认HTTP/归档复验去掉浏览器变量，使用`--testMatch '**/familyLocalBackup.drill.js' '**/familyProductRestore.drill.js'`。
全部以`env -i`仅传本机工具与测试变量、`--runInBand`串行执行；不继承真实模型凭据，不下载依赖。

定向回归使用同一Jest配置，`--runTestsByPath`指定`familyBackupPreflight.test.js`、
`familyDocumentationGate.test.js`、`localBackupDrillLifecycle.test.js`和`localProductRestoreSupport.test.js`。
状态检查为`NODE_PATH=<existing-dependencies> <node22> scripts/check-family-docs.js`；首轮遗漏NODE_PATH导致
`Cannot find module 'dotenv'`退出1，原日志保留，补齐既有依赖路径后通过，未安装依赖或修改断言。
ESLint检查上述5源码/测试及状态校验器；`git diff --check`通过。没有重跑完整发布或所有历史业务测试。

## 冻结候选

本机Git忽略目录`release-gate-artifacts/t8-closeout-20261104/`归档97件：5份源码/测试、累计补丁、
原始日志/JSON、工具结果、合成截图与构建摘要；不复制数据库、媒体正文或备份tar到该证据包。
archive-index.json SHA-256：`b7da682e0295e22dfb28af779625dee7e405fcb33910d358d50078fc7442ced4`。
后续文档校验与独立评审单独追加，不回写此冻结清单。
追加索引`followup-index.json`保存最终定向/状态校验、AI-2只读GitHub结果、独立复核转录摘要、
文档快照和分组清单；原始97件索引及前序190件归档保持不变。证据包仅本机保存，尚未公开提交。

| 候选 | SHA-256 |
| --- | --- |
| familyLocalBackup.drill.js | `52f5c59eb7b4a0ace33294bc286044c93fc208d37890e38da6ea082d16967156` |
| familyProductRestore.drill.js | `fb9edd398d9b8301a1a743bf19ee1c5b376684a9fccc68f595a5b5b82f96683b` |
| localProductRestoreBrowser.js | `f34661eb9a1d9ecd8b3a1fa4c540adbc3a1323cbdd55114014b86ab00f3af9f1` |
| localProductRestoreSupport.js | `12fa3050ff9faf7fd95cbfd81cc09c916c61a86cd05a8f85e3ca2dbca7f2797d` |
| localProductRestoreSupport.test.js | `a2b340d5bf7e2304de82d5ea16ff101be2c78bd96dd4743262c212a8787a3e89` |
| candidate.patch（相对本批main） | `8a9831bc8fb51dc5905998fe6266ec21952990815c32abf1ebf54ecd0c1b66ee` |

## 后续交付分组

| 分组 | 文件/章节边界 |
| --- | --- |
| T8本地恢复 | 上述5份代码/测试；t8-local-preparation索引增量；t8-nonnas、t8-browser、本目录索引；Gate §28.5–28.7；计划T8后续验证段 |
| AI-2合并后记录 | ai2-5 README、closure-readiness、delivery、postmerge；Gate首页当前Git状态；计划首页AI-2状态；check-family-docs.js中对应状态及原42项探针 |
| AI-1独立文档增量 | ai1-delivery-20261102/README.md，本批未修改；不归入T8业务测试或AI-2实现 |
| 排除 | frontend/web/node_modules既有本机依赖链接；原始日志、数据库、媒体和忽略目录不整包公开提交 |

Gate和计划是共享文件，后续按上述章节分开审查/暂存，不使用`git add .`。当前不创建分支或提交。
AI-2合并身份见[PR #38](https://github.com/mflyn/LMS/pull/38)；该独立状态文档增量不随本次T8交付，CI通过和入库不关闭其他门禁。
5文件累计补丁已从本批main重建且逐文件hash匹配；AI-1文档与进入本批前备份字节一致，SHA-256
`c5aae9d517a31b8ab22b2c91e4618504b5825d9d37e3f0a178f075b54b6e10a2`。不删除本机依赖链接或历史分支。

## 用户批准及本轮复验证据

2026-11-04用户在复审通过后明确批准本批T8本地收口验收及迟到浏览器关闭失败传播P2关闭：
批次ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY，P2 CLOSED / USER_APPROVED。
不关闭T8总门禁，不新增Git交付、真实模型调用或部署授权。

批准绑定上述5文件候选及累计补丁`8a9831bc8fb51dc5905998fe6266ec21952990815c32abf1ebf54ecd0c1b66ee`，
97件原索引摘要`b7da682e0295e22dfb28af779625dee7e405fcb33910d358d50078fc7442ced4`及27件追加索引摘要
`5cb88032265f3e11083f3100425a457c9516858b1e52bef74c62f8b21324d385`。前序64/126件归档及上述两个索引不回写；
追加索引中的待验收文档是批准前快照，与本次批准后的当前文档分开解释。

本轮复审重新逐件核对64/126/97/27件大小及哈希，并从`a4f051e2`重建5文件补丁，全部一致；
确认原11项单测逐字保留。实际使用既有Node22/Jest、`--runInBand --no-cache --runTestsByPath`
运行`backend/common/deployment/__tests__/localProductRestoreSupport.test.js`：1套13通过、零跳过、0.521秒、退出0。
本轮状态校验通过（42项AI-2状态探针、412项契约夹具），`git diff --check`退出0。
以上为本对话复审工具执行结果的转录，不冒充97/27件归档中另有本轮原始JSON。
此前独立13项0.503秒与本轮13项0.521秒分别记录；开发浏览器各11项、HTTP15项、定向408项只核验证据，
本轮未重新启动浏览器、HTTP或Mongo，未重新联网查询CI。复审未发现新增阻断问题。

AI-2合并后状态和三组交付范围保持；AI-1文档增量未改。历史红灯、浏览器失败及依赖路径失败保留，
不把本批批准写成全部发布条件通过。当前仅同步批准文档并执行文档/状态检查，不重跑无源码变化的业务回归。

## 剩余发布条件

本批本地增量已获验收且无需等待NAS，但NAS/Restic真实上传及失败传播、异机恢复、目标Ubuntu资源与独立服务重启、
删除证据安全恢复、约定数据量RPO/RTO、停写/回滚、真实iPad和人工验收仍未完成。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项非阻断补测、AI2-VIEW-NB-001、
QUALIFIED_COUNTER_PENDING、REMAINDER_DEFERRED及T9 NOT_STARTED保持；没有全量发布或真实家庭启用结论。
