# Ubuntu 前端更新与选定回归证据索引

## 状态与身份

2026-11-17，测试／评审线程已按用户单独授权完成前端更新和隔离测试，原结果为
`UPDATED_HEALTHY_ALL_SELECTED_REGRESSION_PASS`。本索引仅做本地证据核对与文档收口，
当前状态 `LOCAL_EVIDENCE_CHECKED / DOCUMENT_REVIEW_APPROVED`：2026-11-17复审通过并获用户批准，
仅关闭本批4份测试证据文档收口，不是新一次执行或总门禁关闭。

- 历史执行时固定 GitHub/main：`7da928e7d4aee992eb1507e3b898572fcbb012ca`，不是收口时最新 main。
- 固定快照：2386 文件，sourceDigest `618ce0563acca473ee004e74ffc5057922c49d6e6b6f4b078a1f0ae99aa0a099`。
- 私有冻结包别名：`ubuntu-frontend-update-2026-11-17/r1`，255 份文件；manifest SHA-256
  `31da08fda26d060fe3fcc1042c0bc714f02863a25380fe3c025770865275867d`。
- 原始入口：包内 `REPORT.md`、`results.json`、`verification.json`、`manifest.json`；
  `archive-inputs.json` 记录249份输入与脱敏对应，114份JSON指标保持；170份远程报告下载哈希核验见 `finish.json`。
- 首轮文档核对记录已验证255份文件的大小/哈希、249份归档输入哈希、2386份候选源码，
  并对照逐阶段原始JSON核实下表计数。`verification.json` 记录421份旧归档、139份前次独立证据、
  6份原诊断共566份历史文件保留；不把该历史核验写成本轮重新执行旧测试。

本仓库只收录摘要、别名与哈希，不搬运原日志、截图、连接信息、凭据或学习内容。

### 历史执行与当前代码分层

本文件下文的“本轮”、health、启用开关、资源与收尾结果，均指上述已结束的历史执行，不是本次实时服务器核验。

| 身份层次 | 固定版本与结论 |
| --- | --- |
| 本批历史受测候选 | `7da928e7`；原255份冻结包、源码摘要、静态包及下表计数不改绑 |
| 历史活动实例 | 当时仅前端更新到 `7da928e7`，7个后端保留 `e9147b61`；等价性结论仅相对历史目标 `7da928e7` |
| 文档收口时 GitHub/main | `9bf042c8f631edd82aa6807fcc8e192bd6c5cb23`，已合并 [PR #59](https://github.com/mflyn/LMS/pull/59) 的登录429修订 |
| 最新 main CI | [44025279785](https://github.com/mflyn/LMS/actions/runs/44025279785) 的 Family Regression及证据上传成功；可选性能、安全、镜像发布和部署作业跳过，不计通过 |

最新 main 的代码和CI不能转记为本批Ubuntu受测结果，也不能证明历史后端与 `9bf042c8` 仍等价。
本次没有更新或实时查询实例，不据仓库合并宣称真人入口已包含登录429修订。
登录429已获[限定本地验收](../../login429-local-acceptance.md)，但共享额度风险未修复，
8次业务503保持 `OPEN / EVIDENCE_MISSING`；本批正常health和人工求助回应不能关闭这些事件。

## 实际更新与保护边界

| 层次 | 本轮实际状态 |
| --- | --- |
| LMS 前端 | 北京时间2026-11-17 09:35:39切换到固定 `7da928e7`；image `sha256:3ac6432b340beefa0906af97c39e94ee660395981fef87d3c75a1b9dcc632159` |
| HTTPS index | SHA-256 `19aa299318398a5017ee1139401e291047e2d19170c3d9b368588f040655ff50` |
| 7个后端应用 | 保留 `e9147b61e5c96c8501933bffef2fd47ecf5e13e1` 镜像，业务源码/依赖与历史目标 `7da928e7` 无差异，未重建或重启 |
| 其余运行对象 | Mongo、DeepTutor、TLS代理及全部10个非前端容器的ID/Image/StartedAt/Config/HostConfig/挂载未变 |
| 配置 | 原环境文件、override、端口、HTTPS证书保持；重复计划true，T1/T2 enabled，AI1/2/3 off，高级恢复和新回收关闭 |

这是最小前端更新，不是Ubuntu系统升级或8个应用全部重建。旧前端镜像和配置备份已实际完成
docker save/load及静态可读性验证，保留仅前端回退材料；未触发活动实例回退，也不是数据库恢复演练。
本轮没有导出、迁移、恢复或删除活动数据库/真实家庭内容，没有清浏览器marker、自动重发或终止原命令。
QA不挂载原数据卷不等于今天全库逐条哈希审计；不沿用昨日集合/记录数，不宣称合法扫描器或用户写入停止。

7个后端health均200/ok。开始及结束各7条入口检查：登录页/manifest为200，未登录业务为401，
证书校验开启且指纹不变；这些只读检查不是原账号真实登录或iPad验收。

## 本轮选定自动化结果

| 分项 | 原始结果 | 包内直接证据 |
| --- | --- | --- |
| 前端完整单元 | 85套件 / 1395通过，0失败/跳过 | `qa/reports/offline/frontend.json` |
| T2正式HTTP | 12套件 / 120通过 | `qa/reports/offline/http-t2.json` |
| Task11 HTTP | 4套件 / 6通过 | `qa/reports/offline/http-task11.json` |
| Task12 HTTP | 1套件 / 2通过 | `qa/reports/offline/http-task12.json` |
| docs、lint、独立build-check | 各退出0；既有构建警告保留 | `qa/reports/offline/run.json`及对应日志 |
| AI1完整相关 | Chromium 32/32、WebKit 32/32，0skip/retry | `qa/reports/browser-{engine}-full/results.json` |
| 常用下拉／重复计划 | 每引擎2/2：旧自定义值、隐藏学科、保存读回、丢响应及重登原命令保护、360/768布局 | `qa/reports/browser-{engine}-options/results.json` |
| 求助→人工回应→孩子回看 | 每引擎前后各1项，共4/4，真实临时正式服务 | `qa/reports/browser-{engine}-health-{pre,post}/results.json` |
| 链路contract/static-contract | 两引擎均PASS；不另算业务覆盖 | `results.json`的contracts及逐阶段报告 |

HTTP/单元环境是Ubuntu临时正式服务与独立合成家庭、临时Mongo 7.0.14，未使用iPad当前家庭数据。
固定官方Node镜像，实际Node 22.23.4、UID1000、合计2 CPU/3 GiB、swap=0、只读根和源码。
浏览器是Mac桌面Chromium/WebKit，经SSH同端口回环访问这些服务，不是Ubuntu原生浏览器或iPad Safari。
AI1 operation使用回环协议替身，无真实Provider/模型调用。原120000/10000/15000ms预算、workers=1、retries=0保持。

浏览器实际使用从活动前端只读复制的精确静态包：index/manifest/main JS/map/CSS与线上字节相同；
独立编译另放build-check，369份source-map输入及5个关键模块SHA一致，
见 `qa/reports/served-build-proof.json`。不以另一个构建冒充受测页面。

## 分批证据与失败保留

每引擎32项为原19项＋契约/导航8项＋收尾5项，包含纯契约、辅助收尾及API替身页面，
不能写成32个真实后端页面。原AI1十三个WebKit失败用例本轮在两引擎逐项通过，映射见
`results.json`的 `originalAi1Thirteen`；这不等于完整家庭后端、全部T2或所有旧WebKit失败全绿。

- [既有WebKit候选及初始化收尾记录](../ai1-webkit-20261116/README.md)：开发13项专项、两引擎各32项开发回归、
  独立13项专项和相应变异保持分列；旧冻结文档、补丁、manifest及失败不改写。
- 前次本机独立7项变异／139份归档只核对保留，不算在Ubuntu重跑过；本轮Ubuntu选定回归单列。
- [常用项原工程证据](../task-common-options-20261116/README.md)及其原开发/独立/分批结果保留，
  本轮每引擎2项是后续真实正式服务专项，不倒改原批准时点。
- QA首次辅助脚本缺右括号，已被本机 `node --check` 以exit1阻断，远程QA和业务测试执行数为0。
  初始源码/失败目录保留，只修QA语法，不算产品失败，也不把未执行记通过；见 `qa-preflight-failure.json`。

## 收尾与仍待验范围

14个容器阶段串行及资源守卫PASS。本轮QA容器为0；浏览器、broker、PID、租约、正逆转发、
私有连接配置和本轮tmp已收尾，源码/缓存/构建/证据保留。专用SSH在北京时间10:08:20关闭且socket移除，
见 `finish.json`、`connection-cleanup.json`、`deployment/reports/final-audit.json`。
本次文档处理没有复连、更新实例、重跑脚本或清理任何资源。

`REAL_REQUEST_EVIDENCE_PENDING`、`DEVICE_PENDING / MANUAL_PENDING`、`T4/T8/AI-1 OPEN`、
`SERVER_TIMING_UNVERIFIED`、历史Docker `INCOMPLETE_FAILED`、非阻断补测及其余后置状态不变。
预览反馈和初始化收尾P2原 `LOCAL_ONLY` 批准范围不扩大；本轮自动化不替代真人/真机，
人工求助回应不等于AI备课/外发生成，不能据无模型健康闭环认定AI原请求已解决或已启用。
后续复审、提交及任何执行仍分别按授权进行。

## 本次文档收口自查（2026-11-17，送审时快照）

范围仅为本索引、AI1测试计划§19.3、Ubuntu部署说明的历史记录段及开发入口相关摘要；
SRS、使用指南和总文档入口的另一批未提交增量不在本批验收范围。
本次只读复核原manifest哈希、255份冻结文件大小/哈希及 `results.json` 的分批统计与范围标记；
未重新执行249份输入重建、2386份源码重建、历史变异或业务测试，不将首轮核验冒充本次重跑。
前端1395项、HTTP120/6/2项、两引擎各32项及各2项、健康共4项继续按原批次记录；
登录429开发1417项、两引擎各45项及复审各1项另见其验收记录，不合并计数或覆盖历史失败。
送审时文档状态为 `LOCAL_EVIDENCE_CHECKED / DOCUMENT_REVIEW_PENDING`；自查不代替用户批准或独立复审，
不关闭T4/T8/AI-1、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING或其他后置义务。

## 文档复审与批准记录（2026-11-17）

复审结论：通过，未发现阻断本批文档验收的新问题；用户已批准上述4份文档收口。
当前状态为 `DOCUMENT_REVIEW_APPROVED`，SRS、指南及开发入口中既有SRS引用不在批准范围。

- 历史受测身份仍为 `7da928e7d4aee992eb1507e3b898572fcbb012ca`；原manifest
  `31da08fda26d060fe3fcc1042c0bc714f02863a25380fe3c025770865275867d`及255份文件大小/哈希复核全部匹配。
- 收口时最新main为 `9bf042c8f631edd82aa6807fcc8e192bd6c5cb23`；复审只读核对PR #59合并后CI
  `44025279785`绑定该SHA且Family Regression成功，可选作业skipped不计通过，不改绑历史实例与证据。
- 原JSON核对：前端85套件/1395项、HTTP120/6/2项；Chromium/WebKit各32项、各2项和健康共4项分别通过，
  不与登录429开发1417项、两引擎各45项及复审各1项合并；不将历史全部测试或真人/真机写成通过。
- 本轮文档复审实际执行 `npm run docs:family:check`、`git diff --check`及120个本地文件链接存在性检查，均通过；
  登录429验收记录及其 `review-receipt.json` 与main字节一致。此处是文档/归档复核，不是业务或服务器重跑。
- 历史失败、共享额度风险、8次业务503的 `OPEN / EVIDENCE_MISSING`、原请求缺证及其他未关闭/后置状态不变。
  本次批准不授权提交推送、服务器操作或真人入口更新，不扩大实例更新范围或既有验收结论。
