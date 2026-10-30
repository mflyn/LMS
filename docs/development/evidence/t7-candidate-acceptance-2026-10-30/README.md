# T7 候选镜像验收与缓存保留

本轮仅分离七镜像验收与自动缓存清理，详见Gate §27.38–27.39。保留原smoke、受限串行构建、
输入摘要、固定镜像ID、未知资源拒绝及原停止边界；新schema2 VERIFIED记录不授权删除中间对象。
准备任务与正式服务固定镜像ID，不使用可变tag；中间对象保留并继续计入原累计12GiB预算。

开发自查：Node26.9.0及显式`/usr/local/bin/node` v22.15.0分别执行6个deployment套件，均265项通过。
范围为releaseRetainedBuild、releaseIsolation、releaseBuildLedger、releaseBuildInput、releaseGate、
releasePreparation；既有断言保留，覆盖未知/越限资源、输入与镜像漂移、不完整记录、清理拒绝、
固定ID启动及失败停止。四个修改JS定向lint、文档状态校验、diff检查通过。

本地原始证据保存在`release-gate-artifacts/t7-candidate-acceptance-2026-10-30/`：
`tests.log`、`node22-tests.log`、`lint.log`、`docs-check.log`、`local-adjustment.patch`及`RESULT.md`。
补丁SHA-256：`d88b1a0ef7eeda186833378aab04fbfab456b445bedc9e6512c4e081139fa6c0`。
该补丁是四文件增量，不冒充完整运行候选。`source-freeze.json`保存当时1459文件源码快照；
后续授权/运行时说明修改了文档，旧快照与哈希保留为历史，不声称始终等于最新工作区。

本次仅本地提交与干净检出、限定接线及一次14–17已获批准；执行工具须另行绑定固定候选。
本机自查不是独立复评或Ubuntu运行证据，未取得新的14–17/完整01–18通过结果。
T4/T7 OPEN、DEVICE_PENDING、历史Docker INCOMPLETE_FAILED、两项OPEN_NONBLOCKING及
REMAINDER_DEFERRED保留。不推送、创建PR、合并或部署，原始日志和凭据不纳入本提交。

后续执行（历史未运行快照保留）：固定本地提交`5d8c0fafa0143059b4f69f62f66782329e5cceeb`，
限定接线经本地验证/独立复核后使用一次14–17授权。14通过；15在Gateway构建成功后的原容器
Mounts顺序比较失败，16–18未执行，未重跑。证据位于
`release-gate-artifacts/t7-candidate-run-sfsrip-2026-10-30/`，含`RESULT.md`、`execution-freeze.json`、
`full-source.json`、本地测试及初次失败日志、实际阶段日志和失败账本。13个执行文件、1878个源码
文件冻结；独立复核范围与实际服务器失败分列，不将本地测试或离线排序诊断替代服务器通过。
远端监控/转发/凭据已收尾；FAILED账本拒绝自动资源清理，6个停止builder及缓存保留并继续计费。
详见Gate §27.39；T4/T7和原后置状态不变，新增结果记录仅本地保存。

Mounts顺序误报随后完成最小本地修复：安全投影排序保留全部既有字段和重复数量，不修改严格比较、
限额或清理条件。10项永久用例，Node22开发验证6套件275项；独立复核两套件88项，冻结哈希一致，
未发现阻断问题。原红灯1项及加强后2项失败日志保留。证据为
`release-gate-artifacts/t7-mount-order-2026-10-30/RESULT.md`、`freeze.json`及`fix.patch`，补丁SHA-256
`70bc65b1a4abc0fab2f2c174f4be42f2ba624776c0f74281f576df4042d9d09a`。
仅未提交两文件增量，不冒充完整运行候选；旧账本不迁移、历史失败不改写，后续服务器运行待授权。

后续获批执行完成：固定本地提交`0bddeb7e18200d3fd9e5879c096dd7229df538a2`，新干净候选的
14–17及限定收尾均通过，原smoke输出91 bytes。证据见
`release-gate-artifacts/t7-mount-run-gr4xby-2026-10-30/RESULT.md`，包含完整1878文件清单、9个
执行描述/源码哈希、实际阶段日志、VERIFIED七镜像记录和原资源不变/凭据/转发收尾结果。
26个新停止builder及缓存按批准保留继续计费；不冒称全清。旧失败和未提交快照均按时间保留。
本轮没有执行18或完整01–18，T4/T7仍OPEN；新增结果记录未提交、不推送或部署。

后续一次完整01–18已获授权并执行，固定同一`0bddeb7e`，证据为
`release-gate-artifacts/t7-full-run-ww9pzk-2026-10-30/RESULT.md`，详见Gate §27.40。
01–11及07b通过（后端158套件4805通过/1既有跳过，前端57套件739通过）；12四项在Chromium
MachPortRendezvous启动权限处失败，13/13b/14–18未执行，最终退出1，没有重跑或拼接历史结果。
远端监控/凭据/转发已收尾，最终只读原容器/卷/网络/镜像一致；自动清理因尚无构建记录退出1的
证据原样保留，不写成全绿。冻结12项执行文件和1878项源码未变；T4/T7及全部历史/真机/后置状态
保持，新增记录仅本地、不提交或部署。

随后获批的一次本机权限对照通过：同一Node22/目录/Chromium在受控非沙箱上下文完成单目录监听
及空白页启动，1724ms、退出0、进程组已消失。证据见上述完整失败归档中的
`local-permission-comparison/`；原主哈希清单未修改。此结果仅定位执行上下文边界，不代替产品
浏览器或完整release通过；未改配置/业务代码、未重跑服务器或release，T4/T7 OPEN不变。

后续新一次完整运行获批并通过：同一固定0bddeb7e、新项目full-native-trhe5i，原01–18含07b/13b
连续执行且最终runner/外层收尾均退出0。证据见
`release-gate-artifacts/t7-full-native-trhe5i-2026-10-30/RESULT.md`及Gate §27.41：158后端套件
4805通过/1既有跳过、前端739、07b35、浏览器4/1/54、七镜像及正式启动、原smoke91bytes、18干净。
1878源码/11执行文件及本轮前端构建绑定，预算/原资源/凭据/转发收尾记录具备。26停止builder、
2匿名卷、7镜像清单条目保留计费；依赖安全告警保留，不表示真实发布安全许可。旧失败与原哈希
清单不覆盖，T4/T7 OPEN及真机/非阻断/后置范围不变，新增记录仅本地。

## 当前关闭决定（2026-10-30）

用户已明确批准 T7 限定合成工程总门禁关闭，当前为 APPROVED / CLOSED /
ENGINEERING_SYNTHETIC_ONLY，见 Gate §27.42。绑定0bddeb7e及上述完整运行、独立证据复核。
1607文件归档的SHA256SUMS摘要为
`8cd954959daa2cfdf382f5cb1b3c89ccab452bc927185a7a8496aa446b0884c9`。
上方日期化记录及归档OPEN快照不改写；T4 OPEN、DEVICE_PENDING、历史失败、Docker
INCOMPLETE_FAILED、两项非阻断、依赖告警及后置范围不变。没有Git提交、推送、合并、清理或部署授权。

后续Git授权见Gate §27.43：用户已授权提交推送并在最新CI通过后merge commit合并，不部署、
不删除分支、不清缓存。此前未授权描述保留为当时快照；本索引不预先声明交付已完成。

最新决定见Gate §27.44：用户要求先脱敏交付历史、再评审合并；当前候选不推送或合并。
[公开副本说明及摘要映射](../t7-public-redaction-2026-10-30/README.md)区分原始证据和脱敏表示，
未将旧公开历史或缓存视为已清除。T7工程关闭及所有保留边界不变。
