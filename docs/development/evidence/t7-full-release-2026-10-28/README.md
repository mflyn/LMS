# T7 完整隔离发布与关闭申请材料

当前：FULL_RELEASE_FAILED_STOPPED / SERVER_SWAP_DIAGNOSIS_REQUIRED / T7 OPEN。
本文件不构成用户关闭批准，完整发布两项要求仍未满足。
文件哈希与运行身份见[evidence.json](evidence.json)，只读独立复评见[review.md](review.md)。

## 候选与授权

完整业务与发布入口候选为本地提交 `6166a3e958ef335cc09ddb82a76dce615d78b8c6`，
分支 `codex/t7-engineering-release`。用户批准本地提交、干净检出及连续01–18合成验证；
没有推送、创建PR、合并或真实部署授权。后续记录文件不冒称已包含在上述运行SHA中。

原入口 `npm run release:family` 保留01–18及07b/13b，Node22执行本机验证，Ubuntu仅执行
独立Docker项目的受限构建及正式启动/smoke。新容器合计不超过2 CPU/3 GiB，新增磁盘12 GiB；
legacy构建串行，既有daemon不改。私有Unix socket和网关回环转发不构成公网开放。

## 历史运行

| 运行 | 原始结论 | 后续边界 |
| --- | --- | --- |
| Docker R5分项 | 14–17通过，独立证据复评通过 | 不是完整发布，见相邻R5证据目录 |
| Full R1 | 04原Git clean反例命中Intel Git报-86；154/155套件通过 | 05–18未运行；改用既有native Git，原失败保留 |
| Full R2 | 04期间因一次性执行器安全复评受控停止，exit143 | 非业务通过/失败结论；停止和收尾逻辑补强后重验 |
| Full R3 | 01–10及07b通过；11默认Playwright缓存锁mkdir EPERM，exit1 | 12–18未运行；04原条件跳过1项，不改写为零跳过 |
| Full R4 | 01–15及07b/13b通过；16触发SUSTAINED_SWAP并停止 | 17–18未运行，不能与Docker R5分项拼接成完整PASS |

前三轮原始证据分别在本地忽略目录 `release-gate-artifacts/t7-full-release-r1-2026-10-28/`、
`release-gate-artifacts/t7-full-release-r2-2026-10-28/`、
`release-gate-artifacts/t7-full-release-r3-2026-10-28/`，各有archive-manifest.json。
R1/R2后续定向收尾记录为scopedCleanup PASS；R3自动收尾exit0。
三轮原四类资源核对一致，临时凭据/转发已清除，不将R1/R2后续操作冒称runner自动执行。

R4使用独立临时浏览器副本和既有kubectl；仍实际执行原安装和全部浏览器用例。
整个验证执行器在执行沙箱外运行，以允许Chromium正常Mach IPC；不是仅浏览器单独提权。
不安装系统软件，不改操作系统配置。R3→R4差异由Avicenna只读复核，控制/清理逻辑不变；
其复核不等于重跑浏览器、服务器或完整发布。

## Full R4 实际结果

本轮项目`family-growth-isolated-t7-full-73da62f1`，原始证据在
`release-gate-artifacts/t7-full-release-r4-2026-10-28/`。固定代码未改，使用Node22.15.0、
native Git2.55.0和既有kubectl1.34.1。日志与截图保留在本地忽略目录，不作为公开原始数据。

| 阶段 | 实际结果 |
| --- | --- |
| 01–03 | 根依赖安装、lint、文档校验通过 |
| 04 | 155 suites / 4607 passed，零失败、零跳过；R3所缺kubectl用例本轮执行 |
| 05 / 06 / 07 | Task11 HTTP 4 suites/6 tests；Task12 HTTP两轮各1 suite/2 tests |
| 07b | 自主学习正式HTTP 6 suites/35 tests，包含weeklyReflection集成及三个孩子数学链路 |
| 08–11 | 前端安装、57 suites/739 tests、构建和原Playwright准备通过 |
| 12 / 13 | Task11浏览器4 passed；Task12浏览器1 passed |
| 13b | T2–T7浏览器54 passed，原retries=0；三个数学链路、一/四年级反思代录、未知写入恢复均实际执行 |
| 14 / 15 | 实际隔离配置通过；七个候选镜像legacy受限串行构建通过 |
| 16 | fresh、各服务模型索引、存储探针和预检完成；正式健康启动等待期间被预算看护终止，未通过 |
| 17 / 18 | NOT_RUN；无本轮smoke或Git clean阶段通过证据 |

524份预算采样中最大新增容器配置合计1.8 CPU、2816 MiB，最大观测磁盘增量526512128字节；
最低MemAvailable约4.924 GiB。末尾连续三次`pswpin+pswpout`增量3686/1128/1143页，
均大于原1024页门槛，正确触发SUSTAINED_SWAP。容器无观测OOM、memory-swap=memory；
聚合主机换页未区分页入/页出或进程归属，不能据此归因产品、容器或认定误报。
原阈值未修改，不能因其余预算未超就豁免停止条件。

release进程组被SIGTERM终止，runner结果status=null/signal=SIGTERM、monitorFailure=true。
原脚本summary、Compose日志/teardown三个文件缺失，原shell EXIT收尾未完成，不补造退出码或summary；外层定向收尾exit0，
原容器选定元数据、卷/网络/镜像清单均一致，凭据实际值扫描0匹配且已删除，两转发取消。
收尾后六次、间隔三秒的只读采样中pswpin/pswpout均稳定；这是事后状态，不是故障期间归因。

下一步只建议增加只读归因证据：启动前稳定窗口、分开的主机pswpin/pswpout、各隔离cgroup的
memory/swap事件与压力；不读取个人数据，不改sysctl、不swapoff、不停止原服务、不提高预算。
应先复评诊断方案，再决定有状态复验；诊断或单阶段成功仍不能替代同候选完整01–18。

## 工程范围与保留事项

- SL-01–06合成链路沿用既有真实HTTP/页面测试：排序与估时、求助/处理、自检、图片完成、
  所见版本审核、来源错题、订正/复习、孩子反思、家长代录及周报反馈。
- T7七项P2、lint及索引/目录/smoke修订的批准与复评见Gate §27；新完整入口四项修订见
  [入口证据](../t7-full-release-entry-2026-10-28/README.md)。不重写历史候选补丁和证据哈希。
- T4总门禁OPEN；M01–M08人工/真机条件未通过，T2 iPad项仍DEVICE_PENDING。浏览器模拟不是设备验收。
- T5-NB-001/002仍OPEN_NONBLOCKING。高级删除恢复、新孤儿回收及对应验收仍REMAINDER_DEFERRED。
- T8真实家庭启用、备份恢复、容量与回滚，T9学习效果验收，以及AI/K12均不在本次完成范围。
- 根依赖132项、前端374项npm审计告警原样记录；没有完成依赖安全整改，不据工程通过批准公网或真实发布。
- 历史Docker INCOMPLETE_FAILED及无效smoke证据保留。历史归档中8条可变文档哈希缺少原字节快照，
  限制见入口证据；不得宣称全部历史记录可逐字重建。归档patch保留原字节与whitespace提示。

当前仍缺有效连续01–18、17真实smoke和18 Git clean；独立证据复评完成后也只能确认本轮失败
及已通过阶段的真实性，不能提交T7关闭批准请求。服务器原因处理及完整验证通过后再申请关闭。
