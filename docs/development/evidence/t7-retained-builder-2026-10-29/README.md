# T7 Legacy Builder 保留与精确登记（本地候选）

## 授权与边界

2026-10-29 用户批准本地实现、永久反例、自查和独立复核；未授权新的服务器运行、提交、推送、合并或部署。
这是 Gate §27.30 失败后的新候选，不修改或替换 kwdbg6、Full R5 等历史日志与冻结补丁。
T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项 OPEN_NONBLOCKING 及 REMAINDER_DEFERRED 保持。

## 变更与运行前提

- 只适配当前七个已知 Dockerfile。基础镜像必须已存在于 daemon，Linux/amd64、无 ONBUILD；
  由 RepoDigest 固定实际 FROM，再核对 digest 的 image ID，不在本地验证中下载或构建镜像。
- 将受控源文件复制到独立上下文，凭据、证据、日志和运行目录不进入上下文；原 `.dockerignore` 保留。
  生成的 Dockerfile 位于上下文之外，首个 FROM 后立即加入同轮 nonce、项目、builder 角色和上下文摘要。
  生成文件的哈希另存，避免自引用。原七个 Dockerfile 和业务实现不修改。
- 构建仍为 legacy、受限串行，1.8 CPU / 2816 MiB / 相同 memory-swap；显式 `--rm=false --force-rm=false`。
  本轮合计上限仍为 2 CPU / 3 GiB，新增磁盘 12 GiB。保留中间层不保证一定适合原磁盘预算。
- 每次成功响应后检查实际 daemon 对象：完整 ID、时间窗口、身份、基础镜像祖先链、实际 HostConfig、停止状态、
  Mounts 和匿名卷。最终重新枚举完整对象集合，关闭登记后才允许正式启动；不是仅靠轮询缓存或 stdout 认领。
- 构建请求中断或客户端失败留为 UNKNOWN；来不及落盘的强制终止可能保留 IN_FLIGHT，同样拒绝继续。
  进程组退出不能证明 daemon 已终止；不继续后续阶段，
  不自动清理未完成登记的 builder，也不把部分镜像完成算作阶段 15 通过。
- 运行时容器即使继承相同镜像标签，也不能加入已经关闭的 builder 登记。

独立复核进一步要求：标签和时间窗口不能单独证明 builder 角色。候选使用**只读 API 1.44 原始 image inspect**
取得 legacy `Container` 提交来源，逐个双向校验容器 ID、镜像 Parent 与源 Image；无来源的普通容器必须拒绝。
允许集合还必须是已完成 candidate 精确 image ID 反向到 base 的祖先并集；额外的诊断提交后代分支不能认领。
COPY 直接生成镜像、没有容器来源时，只接受受控 COPY 指令元数据。缺失字段或不支持 API 的 daemon/store
直接阻断，不能降级为标签推断。该兼容性依据为
[Moby 29.1.3 的 image inspect 兼容字段](https://github.com/moby/moby/blob/docker-v29.1.3/daemon/server/router/image/image_routes.go#L386)
及 [Docker CLI 29.2.0 的原始 JSON 输出](https://github.com/docker/cli/blob/v29.2.0/cli/command/inspect/inspector.go#L182)，
不是已执行的 Ubuntu 验证结果。构建与清理写操作不切换旧 API。

容器和镜像时间以 RFC3339 纳秒精度比较；仅卷的秒级 CreatedAt 允许下界按秒取整。
Linux legacy builder 的实际网络值按 daemon 规范化后的 `bridge` 校验，不把 CLI 的 `default` 夹具当真实值。
匿名卷必须带 daemon 实际生成的唯一 `com.docker.volume.anonymous=""` 标记；该标记仅是必要条件，
不能替代完整 ID、独占挂载、时间窗口和原资源排除。缺失、错值或额外标签均拒绝。
原对象的任意 Labels、Binds、volume Options、legacy 命令及环境不原样落盘，比较所需的非白名单内容使用摘要。

`RELEASE_GATE_BUILD_DIRECTORY` 必须位于源码树之外、由本轮独占；其 `build-ledger.json` 保留精确登记及状态。
目录不可跨轮复用。启用前同一记录必须为 CLOSED，且重新读取的对象与登记一致。
此变量在 `release_gate_init` 中导出，不能在 `run_step ... | tee` 的子 shell 内首次设置。
默认 artifact 目录若位于源码树内，将拒绝隔离构建；必须显式指定独占的外部证据目录，不自动改写现有目录。

## 清理顺序

外层执行器必须先确认 release 进程组结束、等待监控退出，再清除本轮 Compose 运行资源；Docker 回环连接仍需可用。
随后执行 `scripts/cleanup-release-build.js <build-directory> <project> --monitor-stopped`：

1. 重新校验 CLOSED 登记与对象全集。未知、新出现、丢失或变化的对象均拒绝，不重新认领。
2. 按完整 ID 删除已登记停止容器；卷证据在容器删除前已持久保存。
3. 删除已证明为新建且专属的匿名卷，不删除原有卷、bind mount 或共享卷。
4. 按子到父顺序清理本轮镜像，使用 `image rm --no-prune`，不隐式清除共享基础镜像。
5. 核对最终容器、卷、镜像基线。失败保持 CLEANUP_INCOMPLETE，禁止 prune、force 或扩大扫描清理范围。

清理入口不挂在仍有监控运行的 release EXIT trap 上。外层执行器与原清理工具的适配也须通过本地反例，
不能直接复用旧执行器的“先取消 Docker 转发、再清理”顺序。基础镜像缺失、状态 UNKNOWN 或预算超限均停止，
不以自动 pull、无限重试或扩大限额解决。

## 证据与评审

服务器 14–16、17–18、完整 01–18 均未因本次授权而运行；
本地模拟通过不等于 legacy daemon 兼容性已通过，也不关闭历史运行故障或 T7 总门禁。

修订过程见 [自查和独立复核记录](review.md)。第一轮完整本地 family-common 为 48 suites / 1184 tests，
但独立复核随后仍找出 bridge 夹具与 candidate 祖先边界问题，因此该轮不能代替最终修订的验证。
首轮内存变异漏检及既有服务器失败原始证据保留，不重写成“始终全绿”。其余开发过程红灯见评审记录与
本轮工具执行记录，不将未归档的交互输出冒称独立的原始日志文件。

### 最终本地结果

- 最新源码补丁 SHA256：`5b6edb9c774fa5f47195d1883c6e5ae487c5a3e441e605503dbce21c76106bd1`；
  基于 `ba6ee315fed7f6734f61dc2010e5b7eade2cd82e`，10 个源码/测试文件逐项重建哈希一致。
- `node node_modules/jest/bin/jest.js --config=backend/jest.config.js --coverage=false --selectProjects family-common --runInBand --no-cache`：
  48 suites / 1189 tests PASS；`npm run lint`、`node scripts/check-family-docs.js`、Bash 语法和 `git diff --check` 均 exit 0。
- 最新 13 项保护变异均被测试拦截，包含匿名卷标记、实际限额、提交来源、反向祖先集合、UNKNOWN 和限定清理。
- 仓库独立复核：最终 4 suites / 214 tests PASS，无未关闭的阻断发现；匿名卷负例先证明正例有效，
  修复了缺少 RW=true 导致错误原因提前拒绝的 P2。此前 211、1186 等计数仅属于旧候选。
- 外层独立复核：runner 14、cleanup 24、candidate 12、Python phases 6，共 56 项本地 mock PASS。
  开发验证使用 Node 22；独立外层测试使用 Node 26，不能冒称实际 Node 22/服务器兼容性验证。
- 外层工具已归档；`source-hashes.json` 是原工具基线，不是新工具哈希。新哈希及报告见 [证据索引](evidence.json)。

状态为 `LOCAL_REVIEWED / NOT_SERVER_READY_PENDING_FIXED_CANDIDATE`。未创建 `approved-candidate.json`；
旧 `6166a3e9` 被入口拒绝，未授权或执行新提交。外层验证要求新候选的固定 SHA、干净检出及六个 helper 哈希，
清理必须调用该固定检出的 helper。监控退出的本地证明来自 SSH 子进程退出，不等于远端 PID/子进程已经核实停止；
这一点及实际 daemon API/存储兼容性、保留层磁盘成本必须在另行授权的受控复验前确认。
局部本地结论不关闭 §27.30 的运行故障，也不满足完整发布 01–18 或 T4/T7 总门禁。
