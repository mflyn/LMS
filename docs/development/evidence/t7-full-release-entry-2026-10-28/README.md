# T7 完整发布入口最小接入

状态：IMPLEMENTATION_REVIEW_PASSED / FULL_RELEASE_NOT_RUN。用户已批准本地专用分支提交
及完整隔离验证，不推送、不创建PR、不合并或真实部署。T4/T7 OPEN。

## 范围

- 原release入口01–18及07b/13b全部保留；只在显式隔离override下替换15/16的准备方式。
- 七镜像legacy串行构建，RUN限1.8 CPU/2816 MiB，memory-swap=memory；共享daemon不改。
- 仅新项目空库：精确合成URI、roles-only验证、逐服务自身模型索引、两个空私有卷0700检查、
  持久化探针及原正式预检。现存数据/权限不修复、不删除；失败不进入正式启动。
- 原17真实文件入口及断言不变，18仍要求真实Git clean，不能以分项日志拼完整PASS。
- 配置和凭据在干净检出外；Docker socket私有Unix转发，无公网Docker端口；网关仅回环。

## 验证

原始证据：`release-gate-artifacts/t7-full-release-entry-2026-10-28/`。
`red.log`保留缺失接入时失败，`targeted.log`为4 suites/134 tests通过，`lint.log`为exit0。
测试包括串行预算、构建/准备失败停止、危险配置零写、空库拒绝、索引失败收尾、权限拒绝且
不chmod、不删除已有文件。Docker边界单测使用命令替身，不能当Ubuntu实际运行证据。
首次独立评审发现3项P1和1项P2：stdin准备未执行、继承外部smoke URL、同名无标签资源绕过、
raw准备容器不受Compose收尾。`review-red.log`记录7项负例失败；修复后准备改真实文件入口、
source摘要与唯一完成输出，隔离URL强制本轮回环端口，fresh检查包含停止容器和四类资源名字，
收尾显式双标签stop/rm并复核残留。原smoke无修改。

`review-targeted.log`保留positive预载夹具括号错误导致的1项失败，修订后Node22.15.0执行
4 suites/147 tests通过，见`review-targeted-fixed.log`；未放宽原断言。
独立代理Avicenna（`01a18282-fc69-7052-927c-ead7dad6296f`）复评2 suites/72 tests通过，
另做cleanup查询/stop/rm/down失败、两类残留及原退出码23保留的控制流注入，均符合预期。
代理结论是四项代码/本机验证闭环、未发现新阻断，不是重跑服务器；主线程在此整理摘要，
不冒称代理签署或实际Docker中断演练。真实Docker、全量release及全部资源收尾仍待运行。

提交检查扫描未发现私钥、GitHub/AWS token、JWT或连接串凭据模式；变更列表无AI/K12文件，
原始日志/临时凭据均不进入提交。531条历史文件记录中，旧入口两项通过冻结补丁重建核对，
另8条R1–R4门禁/计划哈希指向当时可变文档，未找到独立原字节快照；不宣称逐项全匹配，
不重写旧哈希。其原始运行/失败日志仍保留，见raw目录archive-check-final.json。

## 历史和保留边界

R5证据及其索引原样保留；旧门禁/计划原字节快照位于本轮raw目录inputs，SHA-256见snapshots.json。
保留R1–R4失败和R4未执行smoke的INVALID_EVIDENCE，不将R5成功倒写到历史。
DEVICE_PENDING、Docker INCOMPLETE_FAILED历史事实、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复和新孤儿回收REMAINDER_DEFERRED不变。T4人工M01–M08未关闭，T8/T9未实施。
