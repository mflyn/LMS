# T7 固定候选与基础镜像准备证据

- 产品候选：`e78ef415a4ae5551557c9e3f97a3c0085dad6c27`，本地专用分支提交；未推送、合并或部署。
- 本地归档：`release-gate-artifacts/t7-retained-compat-gto3de-2026-10-29/`。
- 状态：`BASE_PREPARATION_FAILED`；14–16、17–18、完整 release 均未运行。
- 保留：T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、两项 OPEN_NONBLOCKING、REMAINDER_DEFERRED。

## 候选与验证

`assembly.json` 是初始装配快照，不是后续工具的最终 hash。
`remote-stop-final-execution/manifest.json` 绑定本次实际准备前的工具、六个源码辅助文件及完整 1875 文件核验。
`remote-stop-r2/results.json` 保留此前 93 项本地结果；随后两条 ENOSPC 反例补为永久用例，准备测试达到 10 项。
独立报告区分本地 mock、独立补测和真实执行，不以之前的报告替代更新源码的核验。

## 实际准备与失败

`base-preparation/operation-terminal.json` 证明固定 Node digest 的本轮 CLI 正常成功；
`identity.json`、`remote-stop.json` 绑定真实远端监控身份及停止证明。
`result.json` 为 `FAILED / BASE_TAG_IDENTITY`，不修改为成功。
`budget.jsonl` 仅含两次真实采样，不能据此证明连续峰值。
`image-after-failure.json` 记录额外 RepoTags 元素恰好为已批准的固定 digest，不是任意外来 tag。

## 收尾纠正与未关闭项

`reconcile-base-failure.executed.cjs` 保留实际执行版本。
`base-preparation/remove-added-tag.log` 显示删除 tag 同时删除 digest/实体；
`after-tag-digest-verification.json` 记录两次精确 inspect 退出 1，纠正原“保留成功”输出。
只请求 tag 删除并不能保证 digest 存活，因此这不是已通过的精确收尾验收。
原普通镜像清单未涵盖完整 digest-only 引用，不足以证明实体此前不存在。
`after-tag-cleanup.json` 核对已采集原服务和资源；`remote-receipt-final.json` 确认远端回执仍在。
未重新拉取或执行新测试阶段。旧清理入口已停用；停用检查只证明零操作拒绝，不能冒充安全删除测试。

## 本地后续修订

`digest-alias-red.log` 为真实红灯；`prepare-base-test.cjs.final.log` 为 13 项 mock 通过，
包括固定 alias 允许及其他 tag/digest 拒绝。只改变精确 alias 核验，不改变监控阈值、未知结果或清理权限。
`reconcile-base-retired-test.cjs.final.log` 是停用入口检查。
最终修订及证据清单由 `final-local-manifest.json` 绑定；实际准备失败使用的是更早的冻结版本，不混称同一候选。
`independent-review-latest.md` 已独立复验 13 项准备 mock、旧判断 RED 到新判断 GREEN、3 项停用检查，
核对实际执行清理脚本归档 hash；结论只接受本地修订，不认可完整安全收尾或新的服务器执行。

下一步必须先解决完整镜像基线与精确收尾边界，取得对应复核后再决定服务器准备及14–16，
不自动把原失败覆盖为成功，不提前关闭门禁。
