# T7 短命容器监控竞态：本地修订与复核

日期：2026-10-29。状态：`LOCAL_REVIEW_PASS`，`SERVER_NOT_RUN`；T4/T7 `OPEN`。
本次用户仅授权本地实现、永久反例、自查与独立复核，之后另行申请服务器验证。
未访问服务器、未安装软件、未提交/推送/合并/部署，未改变真实数据或服务。

## 候选与保护范围

运行源码基线仍为`6166a3e958ef335cc09ddb82a76dce615d78b8c6`，原工作区HEAD为
`ba6ee315fed7f6734f61dc2010e5b7eade2cd82e`。本次只修订外部隔离监控工具；未改变产品代码、
原release入口、smoke断言或服务器配置。候选不是已执行的完整服务器检出。

补丁：[monitor-race.patch](monitor-race.patch)。monitor基线为上轮已复核的classifier候选；
run.js和runner-test基线为Full R5冻结工具。完整工具/测试/日志在Git忽略的
`release-gate-artifacts/t7-monitor-race-2026-10-29/`，原R5及classifier归档未覆盖。

| 文件 | SHA-256 |
| --- | --- |
| monitor.py | `752c3a4720b92a7e03c95d9821ab9ddfbbc8f3f836442d3e312dc4836e28c2a3` |
| run.js | `00f948492a597334b791a681fc688b64373e7edbe9a18fcba06dc7d47da4cf5a` |
| race-test.py | `2e8794bb08863248f019a938c8d477e5109ce4caa37360c740ea6c004f6a94f0` |
| race-loop-test.py | `90282d290566c54d9fd844cdcc6232eac4aba42b1305b6fcfbbe28ef208e2917` |
| runner-test.cjs | `7ea4ecb48c0f3482c374858aeb5f3401d0eb70e992946e2eb7aefc8fc71e2240` |
| monitor-race.patch | `aa567536aa575f15b4ec5a7897fe3a07dd628f8489c9cce9fd1ab27c8dced1d4` |

## 接受条件

1. 只处理exit1且每一行均为受支持missing-object错误的inspect响应；使用完整64位ID。
   有效返回行与缺失ID必须无重复、无交集，精确组成原请求；原容器缺失直接失败。
2. 缺失ID必须有此前成功inspect且预算检查通过的同轮限额缓存；不得以标签或日志代替限额。
   缓存仅保留上一成功快照的本轮、限额合规对象，不能累积任意历史归属或回填未知对象。
3. 按缺失ID查询所有container事件，要求实际run标签和Compose project均精确匹配。
   只接受明确列举的release-prepare任务名，或具有真实one-off标签的mongo-init；应用服务不放行。
4. 完整核心生命周期必须为create/start/die(exitCode=0)/destroy；attach/detach可出现，但仍核对
   全部原始事件顺序、时间、同一身份与标签。kill、OOM、restart、update、commit及不完整序列均拒绝。
5. create须在监控启动后，缓存观察时间须处于生命周期内，destroy须不早于本次列举。
   查询不按有利action过滤；超时、非零、stderr、非法JSON、重复键、异常ID、256条及以上、
   超过1MiB响应均拒绝。Docker历史事件仅保留最近256条，因此缺失create等证据不能补猜。
   参见[Docker事件文档](https://docs.docker.com/reference/cli/docker/system/events/)。
6. 先检查已知原容器状态与主机预算，异常优先停止。证据成立后仅允许一次新的list/inspect，
   再次消失或失败不得递归重试；新快照继续比较原始基线及全部预算，不重置swap历史。
7. 单轮共享10秒成功接受截止，事件查询不超过2秒，成功输出前再次核对截止；原20秒外层看护、
   2 CPU/3 GiB/12 GiB及原swap规则不放宽。保留原inspectionFailure，另记证据摘要和处理决定。

不引入事件常驻收集器、调度器、安装或新测试框架。只使用现有Python unittest和Node执行器夹具。
run.js只注入当前唯一项目身份，并预留新候选项目名；该项目未实际创建。

## 开发验证与独立复核

开发自测实际命令（在完整工具目录执行）：

```sh
python3 -B race-test.py
python3 -B race-loop-test.py
python3 -B inspect-test.py
python3 -B monitor-test.py
node runner-test.cjs
```

结果：20项证明判定、15项实际监控循环、原12项诊断、原6项监测，以及9项执行器进程测试通过。
包含不预置缓存的连续两轮监控、失败前后预算、原容器消失、未知归属、限额缺失、二次inspect失败、
过期成功输出、swap历史保留及实际项目注入。全部Docker/SSH调用为本地替身；部分字节与进程控制
用例执行真实本地子进程，不等同于真实Docker或Ubuntu验证。旧stages.sh仅为历史14–16测试夹具。

自查变异逐项移除归属、缓存限额、成功exit、完整集合、新快照失败、原容器状态、project存在、
成功终态和最终截止保护，9/9均被永久反例以断言失败拦截；见mutation-final-results.json。
另移除run.js项目身份注入，原项目断言拦截（mutation-runner-project.json/log）。
以上9个监控变异及1个执行器变异是开发验证，未冒称独立代理重新执行了这些变异。

独立代理Avicenna先发现两项P1和一项P2：不可靠的builder角色推断、prepare缺少成功运行/project、
最终成功截止检查缺失。保留review-r1.md及2项策略/1项截止的真实断言红灯；已删除builder放行分支，
补齐严格生命周期/project及最终截止。review-r2.md记录对最终monitor哈希的复核，实际独立执行
20+15+12+6共53项通过，原12/6用例及stages.sh与classifier基线字节一致，无剩余本地阻断项。
R2未重跑runner9、变异或服务器；后续R3独立复跑最终runner9通过，见下节。
本地P1/P2修订复核通过不等于服务器问题关闭。

首次测试夹具因输出过大返回status=null，未计作有效红灯；原red.log保留。缩短subtest标签后，
red-requirements.log取得12项缺少实现的预期失败。attach-red.log及早期候选通过记录同样保留，
不替代后续复核发现和修订后的最终证据。

### 执行器夹具失败与最终复核

第一次归档组合验证的verification-runner.log在release-stopped断言失败，未记录具体case；
verification.json保留exit1，不以最后通过覆盖。随后runner-startup-red.log在stalled-monitor失败，
runner-startup-green.log虽名为green，实际在stop-log-failure失败；不能将首次无标签失败反推为其中一项。
最终只修正进程控制夹具：Bash入口exec Node，先注册信号处理器再发布ready；抵抗TERM的真实子进程
也先注册处理器再发布ready，模拟监控待release就绪后才停采样。原9项用例、断言及200ms看护、
20ms轮询、300ms强停、5秒上限不变，实际run.js和monitor.py未因夹具修正改变。
runner-process-fixture.log开发9项通过，review-r3-runner.md独立9项通过；是同9项两次运行，不是18项。
该夹具不执行原release的Bash陷阱、外部命令信号延迟、EXIT清理或真实Compose收尾，不能替代服务器验证。

## 仍然不能声称完成的部分

最终归档清单绑定85份文件，另加manifest.json自身，共86份文件；manifest.json SHA-256为
`c5ea3930006ebe4483668f43d6d5197173e06db194bdcacc0c78704f1c07de9a`。
清单由主代理在源码独立复核后生成。随后Avicenna对最终交接物另行只读核验：85个唯一条目的
长度及SHA-256全部一致，除清单自身外无漏列文件；文档补丁与归档补丁逐字节相同，candidate的
9个哈希全部一致。该轮没有重跑测试、修改归档或访问服务器；清单内生成时的provenance保留为
历史快照，不回写已冻结清单。独立核验同时确认三份runner失败记录和原verification exit1保留，
最终通过记录未倒写历史，未知builder仍停止，T4/T7未关闭。
verification-r2.json记录最终53项监控、9项执行器、Node语法、文档检查、268项文档状态测试及
git diff --check全部exit0；首轮verification.json的runner exit1及三份失败日志均保留。
patch-verification-final.json记录五文件从各自基线应用补丁后逐字节一致。
prior-archive-verification-final.json确认Full R5的140份、classifier的12份及各自清单哈希未改变。

- **R5的c55bd84f78b6没有已观察限额和可靠角色证据，仍会停止。** 本次没有让未知builder消失通过；
  当前legacy builder标签在末步才应用，不能保证所有中间容器可证明归属。未新增构建来源证明机制。
- 实际daemon事件/标签兼容性尚未服务器验证，mongo-init缺少所需标签时也必须停止。
- 事件只能证明与正常结束删除一致的生命周期，不能识别发出删除请求的人或客户端。
- 1MiB是读取后接受限额，不是分配内存硬上限；10秒是接受成功样本的截止，并非能中断所有本地读取。
  原20秒外层看护仍必要。采样不能证明未观察到的瞬时总峰值，不宣称原服务零性能影响。
- 不因本地测试通过而重写Full R5 FAILED_STOPPED、历史R4或旧inspect失败；完整01–18仍未通过。

下一次服务器运行需明确授权和新冻结身份。应先验证监控实际兼容性；若遇未证明的builder竞态继续
停止留证，不把未复现当旧问题关闭，也不盲目重复完整release。需要更强构建来源证明时另提最小方案。
T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项OPEN_NONBLOCKING及REMAINDER_DEFERRED保留。
