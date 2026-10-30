# T7 监控器 14–16 兼容性复验

日期：2026-10-29。结果：`FAILED_STOPPED`；T4/T7 `OPEN`。
本次一次性授权已执行；没有继续17–18、完整release或重跑。未安装、提交、推送、合并或真实部署。

## 身份与范围

- 固定产品提交：`6166a3e958ef335cc09ddb82a76dce615d78b8c6`。
- 唯一项目：`family-growth-isolated-t7-compat-kwdbg6`。
- 本地工具：`/private/tmp/t7-compat-kwdBg6`。
- 监控器SHA-256：`752c3a4720b92a7e03c95d9821ab9ddfbbc8f3f836442d3e312dc4836e28c2a3`，与前次独立复核候选字节相同。
- run.js SHA-256：`39e6f806287050fd9f278417c5977d6b5b2f18235cc7bc06376ea22d1fc95274`。
- 完整工具及证据位于Git忽略的`release-gate-artifacts/t7-monitor-compat-2026-10-29/`。

装配增量见[assembly.patch](assembly.patch)，SHA-256为
`38afaf1690fd441f6469064d0a6c4672f49093d7afa3040a11e0bf9d74487098`。
run/runner-test基于前次冻结监控候选，cleanup基于Full R5；完整工具归档不是仅有该增量。
最终清单绑定48份文件，另有manifest.json自身，SHA-256为
`2dd9ddbbc5d2973b7ddeca464c5635346d051fcb92b1c0e66edcf48636f0fac2`。
清单由主代理在独立证据复核后生成并逐项验哈希，不冒称最终清单也经独立复核。
verification.json记录文档检查、268项状态测试及git diff --check全部exit0；这些文档验证不改变
本轮服务器FAILED_STOPPED结果。

本次先检查旧复用检出，发现22个ignored合成审计/压缩日志未被Docker忽略规则排除。
`tools/context-extra-check.json`是该旧目录的失败检查，不是最终候选结果。
随后从相同固定提交创建全新本地detached clone，不新建提交、分支或修改忽略规则；主代理
逐项核验1855个源码文件哈希、Git clean且无ignored/untracked。最终使用该新检出，旧文件不传输。
`tools/fresh-source-check.json`和`source-manifest.json`绑定源码；构建上下文为4.695 MB。

runner只适配本轮目录/项目/SSH、既有stages.sh入口和分项结果字段；monitor及预算不变。
原字段断言失败和macOS路径别名失败分别留在runner-scope-red.log及runner-scope-green.log，
后者虽名为green实际失败。最终完整路径realpath断言、分项失败断言及原进程/时间保护保留，
runner-scope-final.log九项通过；stage-scope.json以实际stages.sh加本地替身验证仅调用14–16。
Avicenna独立检查装配和日志，未独立重跑这些用例或新clone源码核验；见pre-run-review.md。

## 实际执行结果

启动命令：在本轮工具目录执行`/usr/local/bin/node run.js`。SSH认证完成后进行只读审计，
确认x86_64、11个原容器、无其他隔离测试容器；本项目测试线程空闲。运行前可用内存约5.46 GiB，
磁盘约43.07 GiB。运行器再次取基线，保留2 CPU/3 GiB、12 GiB和原换页/原容器停止规则。

| 阶段 | 结果 | 证据 |
| --- | --- | --- |
| 14 配置及隔离校验 | PASS | 14-compose-config.log及进入15的日志 |
| 15 受限串行构建 | FAILED_STOPPED | 15-compose-build.log、monitor.stderr、stop-reason.json |
| 16 预检及正式启动 | NOT_RUN | 无16日志，15被看护终止 |
| 17–18 | 未授权且NOT_RUN | 本轮入口未调用；无对应阶段日志 |
| 完整release | NOT_RUN_COMPATIBILITY_ONLY | result.json |

已成功打标五个镜像：gateway、user-service、progress-service、homework-service、resource-service。
analytics-service的CMD中间容器`9f9bd6e21781cf03b0b7654077eef95fde20cbd680bea47c354dbeda219bf8ce`
出现在本次list请求后、inspect前消失。日志记录同短ID的Running/Removed；88字节missing-object
诊断的SHA-256为`7dc0ebd888a3169bf4993c8c3ae5f41db7dbf3c7211114be5b8872b720173980`。
重建精确错误字符串后哈希匹配，但这不替代限额/角色证明。该ID在此前44组成功预算快照中从未出现。
监控按既定规则抛出`MISSING_LIMIT_EVIDENCE`，外层记录`MONITOR_EXIT`，release退出143、runner退出1。

本次没有发生成功的deletionEvidence/inspectionReconciled处理，因此不能声称已验证允许角色的真实
daemon事件兼容性，更不能关闭旧R5未知builder故障。停止是保护规则生效，不是阶段15通过。

## 预算与收尾

主代理重算记录在evidence/compatibility-summary.json：44组预算样本及44组cgroup观察，
最大观察限额1.8 CPU、2816 MiB，最小可用内存约5.15 GiB，最大磁盘增长约283.23 MiB。
主机计数增加换入42页、换出1592页，未触发既定持续换页阈值；不能写成“没有换页”。
采样不证明瞬时总峰值，主机增量也不证明原因或原服务零性能影响。

automatic-cleanup-result.json退出0；原11个容器的已选元数据以及卷、网络、镜像清单与运行前一致。
定向清理未使用prune；两条临时转发取消成功，socket和synthetic.env移除，21份被检查证据无合成
凭据命中。源码检出仍clean。只清理本轮有证据归属的资源，未修改原服务或真实数据。

## 后续边界

Avicenna独立只读重算44组配对样本、限额/磁盘/换页、错误哈希、五镜像和收尾快照，主要结果一致；
未重跑服务器或测试。见归档review.md。独立复核还确认原服务cgroup存在换出：gateway376页、
notification353页、analytics339页、user289页、frontend28页；不能宣称原服务零性能影响或据此
单独归因。最后样本到inspect失败约3.202秒、最终收尾快照约7.843秒，尾部无连续预算采样覆盖。
监控拒绝与定向收尾符合边界，但本轮兼容性仍失败；独立复核通过不是运行通过。

这是已知限制的实际复现，不再用相同候选盲目重跑。下一步应先提出legacy builder生命周期与
限额证据的最小处理方案：在不放行未知容器、不提高预算、不改变产品代码的前提下解决证明缺口，
经批准后实施与永久反例验证，再单独申请服务器运行；本记录不授予这些操作权限。
历史Full R4/R5失败保留，T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
两项OPEN_NONBLOCKING及REMAINDER_DEFERRED不变。
