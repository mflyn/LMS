# T7 Docker R4：16通过，17入口证据无效

日期：2026-10-28。用户授权定点复现存储问题、最小修订、反例和自查后重跑14–17。
当前 `STAGE_16_PASS / STAGE_17_INVALID_EVIDENCE / ENTRYPOINT_REVIEW_REQUIRED`。
这不是完整发布通过，不关闭T4/T7。

## 候选与范围

基线 `7d519d20b5f4409a4f6fb66a756a8f571e55b68b` 加当前未提交T7候选；R4实际运行378文件
相对R3仅resource Dockerfile改变：构建期准备两个0700目录。根因及永久反例见
[存储修订](../t7-storage-compatibility-2026-10-28/README.md)。不改预检、UID、Compose、原smoke、
业务实现或既有数据。新项目 `family-growth-isolated-t7-ff969474`，源码集合/哈希传输后及收尾均匹配。

`storage-fix.patch`和`frozen-candidate.json`绑定Dockerfile及两份测试；自查增加测试umask022后
保留旧测试补丁/哈希，并重新冻结测试。此调整不改变378项运行源码或服务器候选。

## 分项结果与更正

| 阶段 | 原始退出码 | 审核结果 |
| --- | --- | --- |
| 14 配置 | 0 | PASS，实际Compose隔离配置通过 |
| 15 构建 | 0 | PASS，七服务原Dockerfile受限串行构建 |
| 16 启动 | 0 | PASS，索引/存储/homework及resource预检、正式Compose健康等待通过 |
| 17 smoke | 0 | **INVALID_EVIDENCE：CLI主入口未执行，不计通过** |
| 完整release/Git clean | 未运行 | NOT_AUTHORIZED，另行批准 |

阶段16为实际enabled模式；八个长期服务（含Mongo）运行，mongo-init退出0，九个容器的
实际CPU/memory/swap限制和OOM状态均通过运行器断言。Compose `up --wait` 使用原240秒，
没有调大预算、超时或放宽健康检查。resource预检及正式启动均不再出现存储权限错误。

**17更正：** 运行器将原 `compose-family-smoke.js` 通过stdin交给 `node -`，但原脚本使用
`if (require.main === module)` 启动CLI。stdin模式下require.main为undefined，函数只被定义而未执行。
原17日志为0字节，退出0没有触发业务验证。只读诊断在本机Node26.9.0及Ubuntu宿主Node22.22.1
都确认mainEqualsModule=false；宿主诊断不是容器smoke替代执行。

原始 `17-result.json`、`16-17-console.log` 中的成功标记保留不覆盖，但由
`17-adjudication.json` 明确作废其通过结论。不能据此声称注册、上传、绑定或签名访问已经通过。
开发过程中的即时“17通过”判断在发现空日志后已更正。原smoke业务断言未改。

收尾附加live-health快照还因mongo-init没有Health字段而发生模板错误；保留
`live-health-capture-failure.json`及原脚本，标记AUXILIARY_CAPTURE_FAILED，不能写成采集成功。
阶段16依赖实际Compose健康等待日志和runtime-limits，而不是这份失败的附加快照。
发现证据异常后未重启或重跑，已仅收尾本轮资源。

## 下一步最小范围

阶段17问题属于隔离执行器CLI调用，不是已证实的产品API失败。应先修正执行方式：在本轮
容器内以真实文件入口执行原脚本，或等价地显式调用已导出的runFamilySmoke并正确传播异常，
不得只定义函数。保持原业务代码/断言和网络路径。复用现有smoke测试补CLI触发请求、失败非0、
空日志/未调用不得计PASS的永久反例，再冻结候选重新验收；不增加测试框架。
本轮没有实施该下一项修订，没有以重跑掩盖无效证据；需接续确认后执行。

## 预算、归档与收尾

- 构建RUN限额1.8 CPU/2816 MiB、无额外swap；正式Compose合计1.9 CPU/2816 MiB，
  辅助smoke容器0.1 CPU/128 MiB，合计不超过2 CPU/3 GiB。共享daemon未改，不冒充全局CPU硬限额。
- 160次预算采样最低MemAvailable 5,161,021,440 bytes（约4.81 GiB），最大观测磁盘增量
  529,100,800 bytes（约0.49 GiB）；无预算触发。这不是实际业务负载容量验收。
- 59份远端证据传回逐项SHA-256复核，临时凭据扫描0命中，env文件不归档。
- 先停止自己的8个运行容器，再归档，定向清理9个容器、4个卷、1个网络、7个候选镜像tag、
  新下载基础镜像tag和唯一临时目录/凭据；不prune或强制删除。
- 原11容器选定元数据及卷/网络/镜像集合前后完全一致；全部378运行源码和最终冻结项未漂移。

原始证据：`release-gate-artifacts/t7-docker-isolation-r4-2026-10-28/`，
[evidence.json](evidence.json)绑定阶段原始结果、17作废裁决、附加采集失败、预算和收尾。
自查确认存储修订有效且未放宽安全边界，同时发现并保留17入口保护缺口，不将它遗漏为通过。
存储修订独立复评待进行。历史R1/R2/R3、T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
两项非阻断补测及高级恢复/新回收REMAINDER_DEFERRED保持；无提交、推送、合并或真实部署。
