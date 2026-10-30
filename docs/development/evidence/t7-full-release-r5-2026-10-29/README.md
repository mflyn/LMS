# T7 Full R5 完整隔离验证记录

日期：2026-10-29。状态：`FAILED_STOPPED`，T4/T7 `OPEN`。

## 候选与范围

- 用户批准一次原01–18连续验证；本次一次授权已使用，没有自动重跑。
- 固定代码：`6166a3e958ef335cc09ddb82a76dce615d78b8c6`。
- 合成项目：`family-growth-isolated-t7-full-55ea888c`。
- 执行：`/usr/local/bin/node /private/tmp/t7-full-release-r5-5LHJzb/run.js`，内部调用原
  `/bin/bash scripts/release-family-gate.sh`，不是14–16诊断脚本。
- 本机Node v22.15.0；Ubuntu既有legacy builder串行，合计2 CPU/3 GiB、新增12 GiB。
- 仅临时合成资源；不安装服务器软件、不改原服务、不提交/推送/合并/部署。
- `stages.sh`仅为保留的旧监测测试夹具，没有在本轮执行；其测试不能证明完整入口覆盖。
- 原始日志和临时工具归档到Git忽略的`release-gate-artifacts/t7-full-release-r5-2026-10-29/`。
  不归档checkout、node_modules、浏览器二进制、synthetic.env或转发socket。

## 实际执行

| 阶段 | 结果 |
| --- | --- |
| 01–03 | 原依赖安装、lint、文档校验通过 |
| 04 | 家庭后端155 suites / 4607 tests通过 |
| 05–07 | Task11 HTTP 4 suites / 6 tests；Task12两轮各1 suite / 2 tests通过 |
| 07b | 自主学习正式HTTP 6 suites / 35 tests通过 |
| 08–11 | 前端原安装、57 suites / 739 tests、构建、原浏览器准备通过 |
| 12/13/13b | 浏览器4/1/54项通过，13b无重试、失败、跳过 |
| 14 | Compose配置通过 |
| 15 | 三镜像完成后MONITOR_EXIT；本阶段未完成 |
| 16–18 | NOT_RUN |
| 总结 | release status143、runner exit1、FAILED_STOPPED |

根目录安装报告48项、前端73项漏洞告警，留存原日志，不称安全审计通过。
历史Full R4及其他失败仍保留，不能用本轮局部PASS改写历史或拼接完整发布通过。

## 失败归因与局限

原始`monitor.stderr`记录inspect exit1、stderrBytes=36、分类`UNCLASSIFIED`，随后失败关闭。
stderr SHA-256：`39d2029c2f39762f54987fe2bda0274ec7c80b45c4b6cba475a106b25f790cef`。
本地推导的`error: no such object: c55bd84f78b6\n`字节长度和哈希均精确一致；同轮
`15-compose-build.log`132–133行记录该中间容器创建及删除。见`evidence/inspect-error-attribution.json`。
该文件是派生解释，不是原stderr或服务器审计。支持本轮list/inspect间正常删除竞态，不能证明人工清理，
不能追溯解释旧inspect失败或Full R4换页。大写专用分类遗漏小写格式，没有绕过停止策略。

427组采样和观察配对，换入24/换出0页、无连续阈值命中；峰值配置1.8 CPU/2816 MiB，
最低可用内存5599834112字节，最大观测新增磁盘289628160字节。短命cgroup可能完全未采到；
祖先和子组不求和，采样也不覆盖最终失败及清理尾段，不能写成零性能影响。
`full-analyze.cjs`是运行后本地派生分析，单独保留；不改写运行前冻结的`analyze.cjs`。

## 收尾与身份核验

外层定向清理exit0；原11容器选定元数据及镜像/网络/卷清单一致，两转发取消、临时凭据移除。
清理时扫描36个文件无临时凭据匹配；扫描范围不是整个最终归档的安全审计。
1855源码文件、16冻结工具/日志、两项外部依赖哈希运行前后核验一致，固定检出git status为空。
原`identity.json`的RUNNING与`result.json`的remainingCleanup是过程快照，以后续清理证据为准，不修改原文件。

- source-manifest SHA-256：`b10caf70f0f2eedeb03d5d2a72bea97ebc9b4255b385ec21267f0158b67ef702`。
- frozen-tools SHA-256：`18a7033fc1361c227f0717592a8c80f9c7ab9616805bc29266038eca4a0ce667`。
- 开发自测：执行器9项、原监测6项、inspect字节留证8项通过；错误SHA夹具红灯未删除。
- 运行前独立复核见归档`pre-run-review.md`；运行后见`post-run-review.md`。Avicenna仅本地核验
  1855源码、16冻结项、两项依赖及135归档副本，并重算427组采样/16组cgroup汇总，未重跑服务器。
  确认失败和收尾记录有效；分类器漏识别小写格式登记P2 OPEN，冻结工具未修改。
- 原`analysis-test.cjs`仅测试`analyze.cjs`；`full-analyze.cjs`的新提取和范围没有该夹具的测试覆盖，
  本数据集已由独立复核重算核对一致，不冒称新分析器经过原夹具测试。
- 最终归档清单由主代理在补入复核与文档验证后生成并校验，不冒称已经独立复核该最终清单。
  清单`manifest.json`绑定140文件，SHA-256：
  `37540851f0681b56f109de4f847280ff6dd9344d2d10b140edcf11d22002b8c1`。
- 文档校验、`familyDocumentationGate.test.js` 268项及`git diff --check`通过，命令/退出码及
  完整本地输出见`post-validation.json`和`post-*.log`；它们不是重新执行服务器发布的证据。

## 保留与下一步

T4/T7 OPEN、历史失败、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项OPEN_NONBLOCKING及
高级恢复/新回收REMAINDER_DEFERRED不变。服务器未部署、Git未提交/推送/合并。
后续应最小修订监控竞态，不可忽略所有missing对象、泛化放行新增容器或关闭预算看护；
需要明确授权后再调整安全策略和进行下一次服务器运行。本轮未执行这些动作。

## 后续本地分类修复（不改变停止策略）

另建本地候选，仅补齐准确诊断，不修改R5冻结文件、原始UNCLASSIFIED或失败结论；
竞态放行策略和下一次服务器运行仍待授权。补丁见[classifier-only.patch](classifier-only.patch)，
对应完整工具和日志另存`release-gate-artifacts/t7-inspect-classifier-2026-10-29/`。

- 基线monitor SHA-256：`796cc6aa29c05daf932b34123340ecfabc78ab7e1b3993ff0f75a1738718273c`。
- 修订monitor SHA-256：`76d46fac7b7da177f569fe6855b922fdbf196fe4f3a07b6c86d47714e98c412c`。
- 修订测试SHA-256：`2ba8a47d2ded7350767cf1ea4148e85117c34d20e4bd50ac5c5c07cf927b7140`。
- 补丁SHA-256：`9f77a2f678b3b82c73b1cab89322691aa8d3c8a9a2b99575d6b8dfda7b690c4e`。

生产执行路径只改一处分类正则，精确增加`error: no such`前缀；未增加忽略错误、重试、继续构建
或预算豁免。完整stderr行匹配、ID白名单、原始字节哈希和所有inspect非零/超时立即停止均保留。
原8项诊断测试不变，新增4项覆盖真实本地子进程的小写字节、部分stdout仍停止、未请求ID不外露、
额外前后缀不信任。红灯为12项中3项预期分类断言失败；修复后12项及原6项监测测试通过。
原6项中的stages.sh测试仍只是旧14–16夹具，不代表完整release范围验证。
独立代理Avicenna实际执行12项诊断和原6项监测测试通过，随后只读核对补丁、候选文件及
R5冻结哈希一致；见新归档`independent-review.md`。本地分类修复已复核，不关闭运行时竞态或T4/T7。
文档校验、268项状态测试及补丁重建验证通过；原R5归档140项哈希未改变。
分类修复独立归档的最终manifest绑定12文件，SHA-256：
`291c1e97f7bf4da412eba737cb645ea11efaec96592f2e216c68a1941635975c`。
该最终清单由主代理生成/校验，不冒称复核者已验证最终清单。
