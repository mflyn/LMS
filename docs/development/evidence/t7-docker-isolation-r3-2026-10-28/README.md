# T7 Docker 分项 R3：索引修订通过，resource 预检阻断

日期：2026-10-28。范围为已批准的索引兼容最小修订及固定候选14–17重跑。
当前 `STOPPED_AT_16 / RESOURCE_STORAGE_PREFLIGHT_REVIEW_REQUIRED`，不是完整发布通过。

## 固定候选与实际结果

基线 `7d519d20b5f4409a4f6fb66a756a8f571e55b68b` 加当前未提交 T7 候选。
实际构建上下文378文件，相对 R2 仅 FamilyParentInvitation 移除冗余普通 familyId 索引。
[索引修订记录](../t7-index-compatibility-2026-10-28/README.md)包含完整4.4错误、红绿测试及自查。
R3 `index-fix.patch`、`source-manifest.json`、`frozen-candidate.json` 绑定修订和运行源码；
传输后全部378文件哈希、完整集合匹配，额外文件与符号链接均0。收尾再次验证候选未漂移。
唯一项目 `family-growth-isolated-t7-6b21bba1`，临时凭据在构建上下文之外，不使用现有服务或数据卷。

| 阶段 | 退出码 / 结果 | 证据边界 |
| --- | --- | --- |
| 14 | 0 / PASS | 从14重新执行；实际Compose隔离配置1.9 CPU/2816 MiB、仅gateway回环独立端口，Mongo无宿主端口 |
| 15 | 0 / PASS | 七个服务按原Dockerfile/lock、既有legacy builder串行构建；RUN容器1.8 CPU/2816 MiB、memory-swap=memory |
| 16 | 1 / FAILED_STOPPED | 新Mongo副本集/角色/fresh库、六组模型索引、存储探针及homework预检通过；resource预检失败并立即停止本轮Mongo |
| 17 | NOT_RUN | 未启动全体正式业务服务，未运行原smoke，不声称HTTP闭环通过 |
| 18 / 完整release | NOT_AUTHORIZED / NOT_RUN | Git clean和完整发布仍另行批准，不以分项通过替代 |

实际构建命令仍为 `DOCKER_BUILDKIT=0 docker build --pull=false --platform=linux/amd64
--cpu-period=100000 --cpu-quota=180000 --memory=2816m --memory-swap=2816m --force-rm`，
逐镜像ID、基础镜像摘要、限额采样和退出码归档。限额针对构建RUN容器，不冒充共享daemon全局限额。
Mongo4.4.30 为原缓存固定摘要；未安装软件、buildx，未修改daemon或原容器配置。

## 新失败与最小后续方向

`16-preflight-resource.log` 返回 `COMPLETION_STORAGE_NOT_READY`；该阶段退出1，原smoke未运行。
`16-storage.log` 在先前独立探针容器中已返回 ready=true；失败进程的六个非秘密环境值单独留证：
enabled、writesPaused=true、storageConfirmed=true、cleanup=false，媒体和日志路径匹配。
没有因此切换legacy、放宽目录权限要求、关闭预检或重试到成功。

当前只能确认 resource 组合预检在存储检查处拒绝，不能从通用错误码确定是哪一个目录、
祖先链、权限/属主或同步探针失败。优先排查两次容器挂载之间目录元数据是否保持，
以及正式镜像目录初始化与独立探针的差异；这仍是待验证方向，不写成已证明根因。
辅助bootstrap已补充本轮合成模型的完整索引错误输出；存储生产错误继续脱敏，不扩大公开诊断。

后续最小建议：另行批准后在新隔离复现中记录挂载前后目标目录及祖先的 mode/uid、
安全配置和探针步骤，只输出合成元数据；确定是验收入口准备问题还是正式镜像问题，再决定修订。
如需修订应保留0700/属主/祖先/fsync要求及原smoke断言，补相应永久反例后冻结重跑。
本轮按“异常立即停止”结束，没有实施该后续修订或重新启动测试资源。

## 预算与收尾

- 171次预算采样：最低主机MemAvailable 5,351,497,728 bytes（约4.98 GiB），最大观测磁盘
  增量527,052,800 bytes（约0.49 GiB），没有预算或持续swap触发。
- 尚未启动全体业务服务，不能据此宣称正式九服务运行容量通过；2 CPU/3 GiB及新增12 GiB预算不变。
- 停止后采集46份远端哈希绑定证据并逐项复核；实际临时凭据扫描命中0，env文件不归档。
- 仅清理本轮1个停止容器、4个卷、1个网络、7个候选镜像tag和本轮新下载基础镜像tag；
  无prune、无force删除。归档后仅删除本轮唯一目录及临时凭据。
- 原11容器ID/镜像/启动/重启/挂载/端口/限额，以及卷、网络、镜像集合前后均一致。
  仅排序容器和挂载列表，不删比较字段；没有读取或修改真实业务数据。探针的独立收尾另见索引记录。

原始证据：`release-gate-artifacts/t7-docker-isolation-r3-2026-10-28/`，本目录
[evidence.json](evidence.json)绑定源码、脚本、阶段结果、失败日志、预算和收尾；一次性工具不是生产发布框架。
自查确认索引修订的约束保留、阶段按失败停止、候选未漂移、原资源一致；新存储阻断未关闭。
独立复评待进行，不凭开发自查关闭问题。

历史R1/R2失败不改写。本轮14/15通过、索引准备通过不等于16/17或完整发布通过。
T4/T7 OPEN、Docker INCOMPLETE_FAILED、DEVICE_PENDING、T5-NB-001/002 OPEN_NONBLOCKING、
历史失败及高级恢复/新回收 REMAINDER_DEFERRED 均保留。不提交、推送、合并或部署。
