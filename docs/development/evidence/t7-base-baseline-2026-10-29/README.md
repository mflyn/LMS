# T7 完整镜像基线与14–16兼容性复验

- 产品提交：`e78ef415a4ae5551557c9e3f97a3c0085dad6c27`，干净clone，1875个跟踪文件核对一致。
- 本轮项目：`family-growth-isolated-t7-base-o6gdae`。
- 本地归档：`release-gate-artifacts/t7-base-baseline-o6gdae-2026-10-29/`，不包含外层临时凭据文件。
- 结果：准备和14通过；15登记失败；16–18及完整release未运行。T4/T7 OPEN。

## 本地修订与复核

`tools/`、`tool-hashes.json` 绑定实际操作工具。产品代码未修改；采集器与基础镜像收尾位于独立操作目录。
Unix socket只读GET获取完整image summary、全部容器Id/Image、目标tag/digest的精确inspect；
双快照检测变化，精确404之外的错误不能冒充不存在。无归属证明就保留全部对象，不做tag-only删除。
收尾仅在完整新实体证明、原容器集合不变和已关闭生命周期成立时，按精确Id请求删除整个新实体；
删除后精确tag/digest/Id缺失及原集合一致都必须有证据，不用命令退出码代替后验。

独立报告 `independent-local-review.md` 复验decision 15项、collector 5项、prepare 15项、finish 11项，共46项。
删除前原容器集合检查的P2有两份 `predelete-p2-red-*.log` 红灯及修订后绿灯。
`readonly-inventory.json` 的格式化Parent错误及 `readonly-inventory-raw-api144.json` 的15秒超时保留，
最终 `readonly-inventory-api.json` 才是成功的193镜像/11容器只读证据。
初版decision测试的对象共享夹具错误和随后静态正则误匹配属于本地测试失败，不改称业务红灯。
`local-results.json` 是较早本地套件快照；最终增量以 `*.final.log` 和独立报告为准，不混合版本计数。

## 实际运行

- `base-preparation/`：完整新鲜before/after为193→194，固定digest成功回执、监控身份/停止证明、PREPARED。
- `evidence/14-compose-config.log`：原配置门禁通过。
- `evidence/15-compose-build.log`：Gateway构建成功后阶段失败，未完成七服务构建。
- `evidence/retained-build/build-ledger.json`：FAILED，含before/lastObservation，owned未能登记。
- `evidence/validation-replay.json`：不改快照，本地重放准确拒绝于 `release-build-ledger.js:79`。
- `evidence/diagnostic-summary.json`：8个新增镜像的Container为空、BuildCommand不可用及预算统计。
- `evidence/result.json`、`release-gate-summary.txt`：退出1，FAILED_STOPPED，不是完整release结果。

当前daemon即使在API1.44 inspect下也没有提供本次需要的legacy来源字段。
Docker官方已将Container/ContainerConfig列为弃用字段，但这不能代替本机实际证据，也不意味着所有旧API
实现都相同：[Docker弃用说明](https://docs.docker.com/engine/deprecated/)。不得直接删掉来源校验获取通过。

## 保留对象与边界

`evidence/final-state.json` 和 `final-full-inventory.json` 核对原11容器已采集字段、193原镜像summary、42卷及5网络一致。
新增6个中间容器均非运行状态；9个镜像实体保留，其中1个基础镜像、8个构建链镜像。
原账本未CLOSED，`cleanup-incomplete.json` 保持失败；`base-finish/result.json` 为缺少证据而拒绝，未执行镜像删除。
`independent-final-review.md` 已独立重放同一登记拒绝点、重算预算、比较实际原资源快照；结论为失败后保留，
不把分项 `resources-only PASS` 写为完整收尾。`manifest.json` 绑定全部候选工具及最终归档证据。
末次磁盘相对准备前增量352276480 bytes；采样最大362217472 bytes，均在12 GiB内。
监控及临时转发已停止，临时凭据已删除；凭据扫描1485文件、零匹配。远端本轮回执目录仍保留。
未运行安装、真实部署、推送或合并，不声称原服务零性能影响或全部清理完成。

本次14–16授权已使用。后续先评估真实可用的构建来源证明和精确收尾方案，再决定固定候选及重新验证。
历史失败、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项OPEN_NONBLOCKING及REMAINDER_DEFERRED不变。

## 来源字段兼容性分析（只读，未授权新运行）

2026-10-29 后续仅核对现有归档、产品校验器及官方源码，没有再次连接服务器、构建或删除对象。
归档服务端是 Ubuntu Docker `29.1.3-0ubuntu4.1`；以下对应上游 `docker-v29.1.3`，不是发行版二进制逐字验证。
本机实际字段缺失以本轮 API1.44 快照为准，上游源码用于解释机制，不替代现场证据：

- [containerd ImageInspect](https://github.com/moby/moby/blob/docker-v29.1.3/daemon/containerd/image_inspect.go)
  返回 Parent，但不填写 Container/ContainerConfig；协商旧 API 不会凭空生成这些来源字段。
- [containerd CommitBuildStep](https://github.com/moby/moby/blob/docker-v29.1.3/daemon/containerd/image_commit.go)
  不记录 container commit 事件；[镜像创建路径](https://github.com/moby/moby/blob/docker-v29.1.3/daemon/containerd/image_builder.go)
  的 image create 事件也不能单独提供容器到产物的双向关联。因此不能把增加普通 events 监听当作已验证修复。
- [传统镜像存储 ImageInspect](https://github.com/moby/moby/blob/docker-v29.1.3/daemon/images/image_inspect.go)
  与 [CommitImage](https://github.com/moby/moby/blob/docker-v29.1.3/daemon/images/image_commit.go)
  有保留旧来源字段的实现。此差异只支持考察兼容环境，不保证任意 Docker 版本或新环境必然满足现有全部门槛。

建议先评审环境选择，而不是继续补共享 daemon 的来源推断：优先考察已有、独立且可提供所需字段的
Linux 构建环境，沿用原 Dockerfile、固定来源、限额、完整基线和精确清理规则。没有合适环境时再由用户
决定是否提供专用 VM/测试机；不默认安装 daemon、运行 privileged DinD、切换原服务器存储驱动或增加预算。
现有阶段15校验器不删除来源断言，不用标签、时间邻近、stdout或事件排序冒充关联。
若选择新的 containerd 证明适配，必须另行评审其真实证据来源；当前没有已证明等价的最小适配。

当前6个容器及9个镜像保持失败保留，不能为新环境准备而自动删除，也不因未来新运行通过而倒写本轮收尾。
新环境的阶段15结果不能直接拼入原完整release；最终仍需固定候选、经批准的执行环境和完整01–18证据。
下一项决策是兼容环境及只读核验范围；未批准前不执行新构建、迁移、安装或服务器清理。
