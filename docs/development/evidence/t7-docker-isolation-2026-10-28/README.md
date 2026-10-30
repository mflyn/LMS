# T7 Docker 分项隔离：首轮停止记录

日期：2026-10-28。状态：STOPPED_AT_14 / LOCAL_FIX_VERIFIED / SERVER_RETRY_PENDING。
用户批准 Ubuntu 隔离 14–17、合计不超过 2 CPU / 3 GiB、新增磁盘 12 GiB，阶段15允许
现有 legacy Docker builder 受限串行构建；不是业务协议降级。不含完整发布或 Git clean。

## 候选与实现

- 基线 HEAD `7d519d20b5f4409a4f6fb66a756a8f571e55b68b`，叠加当前未提交 T7 修改。
- [candidate.json](candidate.json) 与 [candidate.patch](candidate.patch) 绑定三个入口修订文件。
  这是入口增量，不替代完整 T7 候选；实际上传的378个白名单文件另由原始 source-manifest.json
  逐项绑定。最终本地候选包含服务器失败后的空 IPAM 兼容修订，没有再次上传或运行。
- 原 `release:family` 全部阶段保留。source 只定义函数；显式 init 后才初始化目录、参数和端口。
  override/env-file 与项目参数传递给每个 Compose 子命令，包括失败收尾。拒绝复用已有项目资源。
- 对 Compose 实际 JSON 核验独立资源名、回环唯一端口、无 Mongo 宿主端口、显式卷和 init tmpfs、
  无 bind/外部资源/特权配置、合计 CPU/内存、禁用容器 swap、enabled 协议和关闭新回收。
  验证失败不输出环境凭据，且不会进入构建/启动或执行 down。

## 实际执行

| 项目 | 本轮事实 |
| --- | --- |
| Ubuntu | x86_64；Docker29.1.3 / Compose2.27.0 / Node22.22.1；原服务未改 |
| 隔离配置 | 七个 Node 各0.2 CPU/256 MiB；Mongo0.4 CPU/896 MiB；init0.1 CPU/128 MiB；合计1.9 CPU/2816 MiB，容器 memory-swap 等于 memory |
| 14 | `config --quiet` 成功；随后隔离校验误拒 Compose 生成的空 `ipam: {}`，退出1，本轮立即停止 |
| 15 | NOT_RUN；未拉镜像、未调用 legacy builder，没有构建限额生效证据 |
| 16 | NOT_RUN；未创建数据库、卷、网络、容器；未执行索引准备或存储探针 |
| 17 | NOT_RUN；未执行 HTTP smoke，不宣称 T7 产品闭环复验 |
| 18 / 完整发布 | 未授权且未执行；不能以分项或本地测试替代 |
| 收尾 | 仅删除本轮唯一新目录；本轮 Docker 容器/卷/网络均0，无 Docker 删除命令 |

原始日志：`release-gate-artifacts/t7-docker-isolation-2026-10-28/`，
[evidence.json](evidence.json) 绑定日志、脱敏配置、前后快照与本地修订验证。
临时目录约4.23 MiB，未触及12 GiB预算；原服务11个（10运行、1历史退出）的 ID、镜像、
启动时间、重启计数、挂载、端口及所有卷/网络/镜像集合一致。比较只按身份/挂载目的地排序，
不删除字段；初次直接数组比较的顺序差异不冒充服务变更或服务健康测试。

## 缺陷修订与自查

1. source 零副作用、参数透传、失败退出码保留、已存在项目拒绝已加永久测试。
2. 缺 Mongo 显式卷、错误挂载目标、init 匿名卷风险和 deploy 限额覆盖先见红灯后修订。
3. Ubuntu 空 IPAM 误拒新增永久反例；只允许空对象，非空自定义网段仍拒绝。
   最终4 suites / 89 tests通过；取回的脱敏真实配置本地校验通过，不能改写14的退出1。
4. 首轮归档携带 macOS AppleDouble/xattr，产生455个 `._*` 文件及 tar 警告；尚未构建。
   后续打包准备已改为 `COPYFILE_DISABLE=1` / `--no-xattrs`，本地列包确认0个 metadata文件。
   原包和警告保留，新包未上传，不能把新包说成服务器已验证候选。

本机首次红灯用例错误地直接 source 旧入口，触发本机 `npm ci`；已终止确认属于该测试的
子进程，并先加 npm 测试桩，再重跑红灯。该次终止记录在本会话，完整初次子进程日志未归档，
不能声称本轮完全没有安装尝试；没有服务器安装。后续归档红灯使用 npm 桩，原安装命令未改。
本机最终 lint 和相关测试可执行，但未以此宣称重做全量安装/业务回归。

文档收尾验证：`npm run docs:family:check`、`npm run lint`、`git diff --check`及
`bash -n scripts/release-family-gate.sh`通过；现有 familyDocumentationGate/task5QualityGate
两套状态测试280项通过。新索引逐文件SHA-256与最终三个代码文件复核一致，未覆盖历史索引。

自查：没有改变业务协议、测试时限、原 smoke 断言、真实环境配置或任何旧候选证据。
失败后的修订仅本地通过，服务器尚待新一轮固定候选验证；本轮不自行继续15–17。
下次仍需先验证打包文件集合/哈希、实际配置及预算监视，再受限串行构建；fresh索引、可信存储
目录与正式预检必须在健康启动前完成，不因 cleanup=false 删除依赖。

T4/T7 OPEN、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、历史失败、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收 REMAINDER_DEFERRED 均不变。
未提交、推送、合并、部署，未安装服务器软件、访问真实数据或运行 cleanup/restore。
