# T7 R5 Ubuntu 14–17 分项验证

日期：2026-10-28。状态 `STAGES_14_17_PASS / FULL_RELEASE_NOT_RUN`。
项目 `family-growth-isolated-t7-ed4d5611` 已全部收尾；不代表真实发布或T4/T7总门禁关闭。

## 候选与真实执行

未提交基线HEAD为 `7d519d20b5f4409a4f6fb66a756a8f571e55b68b`。源码清单SHA-256：
`6e2e813c4d68d763c7f8d2688185efa649a128703b3f913131f265429acb2bec`。
原始材料在 `release-gate-artifacts/t7-docker-isolation-r5-2026-10-28/`，其中source-manifest、
frozen-candidate、工具、完整已跟踪补丁及工作区哈希保留冻结时的真实内容，后续文档不冒称旧快照。
379项运行源码与实际传输一致：R4的378项不变，新增已复审的smoke辅助脚本；旧冻结索引不重写。

服务器x86_64、Docker29.1.3、Compose2.27.0、宿主Node22.22.1；容器基础镜像摘要另记base-node.json，
不将宿主Node版本冒称容器版本。新目录、项目、网关回环端口、网络和卷均独立，不挂载真实数据。

| 阶段 | 直接证据 |
| --- | --- |
| 14 | 14-result.json/14-compose-config.log：实际9服务配置通过，379项源码匹配 |
| 15 | 15-result.json/build-commands.jsonl：7镜像全部exit0，legacy串行、1.8 CPU/2816 MiB限制 |
| 16 | 16-result.json及各16-日志：空库/索引/存储/两服务预检通过；compose原240秒健康启动通过 |
| 17 | 17-compose-smoke.log/runtime-commands.jsonl：原smoke真实文件入口exit0，唯一成功输出91字节 |

网关日志独立于CLI输出验证了七次请求，verified-stage-results.json保存脱敏路由顺序与状态：
注册、家庭、孩子、上传、任务绑定均201；媒体access和content均200。不是本机HTTP夹具或mock服务。
旧R4只有空日志和exit0的INVALID_EVIDENCE仍保留；不把本轮成功倒写到旧结果。

## 预算、收尾与边界

164次预算采样均无触发；最低MemAvailable为5151821824字节，最大观测磁盘增量528908288字节。
九个Compose容器配置合计1.9 CPU/2816 MiB，另加smoke0.1 CPU/128 MiB，总额2 CPU/2944 MiB；
memory-swap=memory，无OOM。宿主原有swap及daemon没有更改，不声称整台机器无swap或性能认证。

59份远端封存文件哈希复核；凭据扫描没有真实临时secret/token值匹配。原始日志只含合成测试，
不含真实孩子数据。定向停止8个运行容器，然后仅清理本项目9容器、4卷、1网络、7候选tag及本轮
新增node基础tag，最后删除临时目录和凭据。原11容器、挂载、端口、版本、运行/重启字段和
卷/网络/镜像清单前后一致；没有global prune、强制删除或修改原服务。

收口前Gate和计划原字节保存为本目录对应raw inputs快照，供旧收口索引哈希核对；新索引单列。
完整release01–18没有运行，Git clean和提交未获授权；本次不关闭T4/T7。
保留历史失败、DEVICE_PENDING、Docker INCOMPLETE_FAILED历史事实、两项OPEN_NONBLOCKING
及高级恢复/新回收REMAINDER_DEFERRED。独立证据复评结果将单独追加，不等同重新运行服务器。

后续独立QA代理Mill已完成只读复评，未发现阻断问题，见[复评摘要](independent-review.md)。
复核17项冻结文件、59项远端封存文件及379项源码，并从原网关日志重算七请求；其来源和
收尾证据未被较早远端索引覆盖、未归档图片正文等边界明确保留。最终本地evidence.json
单独覆盖后生成的收尾记录和文档，不替换旧冻结/远端索引。
