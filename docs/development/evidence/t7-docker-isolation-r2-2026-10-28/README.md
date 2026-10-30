# T7 Docker 分项 R2：14/15 通过，16 索引准备阻断

日期：2026-10-28。用户授权使用修订固定候选从14重新验证，沿用合计2 CPU/3 GiB、
新增磁盘12 GiB、既有legacy Docker builder串行构建及异常立即停止约束。
状态：STOPPED_AT_16 / INDEX_COMPATIBILITY_REVIEW_REQUIRED；不是完整发布通过。

## 候选与阶段结果

基线 `7d519d20b5f4409a4f6fb66a756a8f571e55b68b` 叠加未提交T7候选；
入口三个文件与[上轮最终候选](../t7-docker-isolation-2026-10-28/candidate.json)逐项一致。
实际构建上下文378文件，相对上轮首次上传只有check-release-isolation.js空IPAM修订不同。
传输后完整文件集合及全部SHA-256一致，额外文件/符号链接均0，未携带AppleDouble或.env。
本轮新项目 `family-growth-isolated-t7-eb3f2e08`，未借用原项目、端口、数据卷或数据库。

| 阶段 | 退出码 / 结果 | 实际执行边界 |
| --- | --- | --- |
| 14 | 0 / PASS | Ubuntu Compose2.27配置及实际隔离JSON验证通过；1.9 CPU/2816 MiB配置、唯一回环gateway端口、Mongo不发布端口 |
| 15 | 0 / PASS | 七个Node服务镜像全部串行构建；原Dockerfile与package-lock不改；实际基础镜像摘要和最终镜像ID已归档 |
| 16 | 1 / FAILED_STOPPED | 新Mongo4.4副本集/角色初始化、fresh库检查通过；用户服务模型索引准备错误85；立即停止本轮Mongo |
| 17 | NOT_RUN | 原compose-family-smoke.js未执行；没有成功HTTP或页面验收声明 |
| 18 / 完整release | NOT_AUTHORIZED / NOT_RUN | 不以本轮分项替代Git clean、完整发布或T7总门禁 |

阶段15使用`DOCKER_BUILDKIT=0 docker build --pull=false --platform=linux/amd64
--cpu-period=100000 --cpu-quota=180000 --memory=2816m --memory-swap=2816m --force-rm`，
逐服务Dockerfile、独立tag/iidfile和退出码见原始commands。采集的运行容器HostConfig证明限额生效。
这限制的是构建RUN容器，不是共享daemon全部工作；未修改daemon或原容器，主机压力另行监测。
没有安装服务器软件或增加buildx。构建所需基础镜像下载和容器内npm ci是本次授权构建的一部分。

## 阻断定位与待批修订建议

`16-index-user.log`保留原始`{"error":85}`。本轮辅助bootstrap只记录错误code，没有保存
完整errmsg，因此不虚构更详细的数据库错误响应。Mongo日志显示familyparentinvitations已创建
普通familyId_1、tokenDigest_1和familyId_1_status_1_expiresAt_1，未见条件唯一索引创建成功。
模型schema静态输出确认同键`{familyId:1}`同时声明普通索引和pending条件唯一索引。

上述证据优先指向既有FamilyParentInvitation索引声明与MongoDB4.4兼容性，而非资源不足。
官方说明普通/唯一同键索引共存从MongoDB5.0开始支持：
[MongoDB Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/)。
本轮未重新启动数据库做额外重现，不把推断写成已完成修复/永久反例。

建议下一步经批准做最小修订：移除冗余单字段普通索引声明，保留pending条件唯一索引和
familyId/status/expiresAt复合索引；以Mongo4.4合成库固化从空库建索引、重复建索引、
同家庭pending重复拒绝及历史终态多条允许的永久反例，再冻结新候选重做分项验收。
不得跳过该模型/唯一约束来通过bootstrap，不提高预算/超时，不借本次测试升级原Mongo、
删除真实索引或运行真实迁移。用户服务模型本轮未改；完整错误诊断应随下一次反例补齐。

## 预算、证据与收尾

- 构建与准备阶段共105次预算采样：最低主机MemAvailable约4.99 GiB，最大观测磁盘增量
  约0.49 GiB，无内存/磁盘/持续swap停止触发。该数据不代表九服务正式运行容量验收已通过。
- 本轮先停止Mongo，再归档日志、镜像摘要、临时资源身份、退出码与限额；38份远端证据
  传回后逐项SHA-256复核通过。临时凭据不归档，针对实际生成凭据的日志扫描命中0。
- 定向清理1个本轮停止容器、4个本轮卷、1个本轮网络、7个本轮镜像tag和新下载基础镜像tag，
  没有prune或强制删除；随后仅删除本轮唯一临时目录和临时凭据。
- 收尾后原11容器的ID、镜像、启动时间、重启计数、挂载、端口和资源限额，以及原卷/网络/
  镜像集合均一致。只按身份/挂载目标排序比较，不删字段，不声称读取过真实业务数据。

原始证据：`release-gate-artifacts/t7-docker-isolation-r2-2026-10-28/`。
[evidence.json](evidence.json)绑定源码清单、命令、阶段结果、预算、收尾和本地分析脚本。
所有一次性执行脚本只属于合成验收记录，不是新增生产发布框架。

收尾文档验证：`npm run docs:family:check`和`git diff --check`通过；现有
familyDocumentationGate/task5QualityGate两套测试280项通过。入口三文件和378项构建源码
在收尾再次核对哈希一致；FamilyParentInvitation、原smoke和family Compose与HEAD无差异。
本轮没有重复执行未变化的业务回归，也不把文档测试作为阶段16/17通过证据。

本轮仅追加门禁/计划/证据说明；业务实现与上轮冻结入口均未修改。历史首轮14失败、原发布
lint失败及其他历史证据均保留。T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收REMAINDER_DEFERRED保持。
未提交、推送、合并、部署或访问真实孩子数据；新回收/高级恢复未启用。
