# AI2 新命令竞争与终态重放补验

日期：2026-11-04。范围：AI2-ATTEMPT-03、AI2-REVIEW-02、AI2-IDEM-01剩余子条件。
AI2-5 IMPLEMENTING、AI-2 OPEN。本增量已获用户限定合成验收，屏障异常收尾P2 CLOSED / USER_APPROVED；不影响[连接批次及三项P2的批准关闭](bridge-acceptance.md#2026-11-04-用户批准及本轮复验证据)。下文原待批准状态保留为历史快照，最新批准见末节。

## 变更和真实边界

只新增两个既有测试文件中的9个用例，不改业务源码、schema、索引声明、既有断言、配置或超时：
- [ai2Submission.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Submission.test.js)：open/revise两个新UUID事务竞争、单侧屏障前失败收尾、submitted/approved/withdrawn三个新命令拒绝，共6个用例。
- [ai2Service.test.js](../../../../backend/services/homework-service/__tests__/services/ai2Service.test.js)：approve/revise两个审核终态以及撤回终态，逐字段异正文重放，共3个用例。

MongoMemoryReplSet与本地事务/CAS/索引真实执行。提交服务的授权/resource端口和远程媒体client为既有合成替身；
审核/撤回使用真实家庭授权与事务、来源和媒体读取替身。审核用例的已提交Attempt是明确夹具，
不得把这些新反例写成真实媒体HTTP或浏览器端到端。既有正式HTTP套件另行回归，不冒称新反例均经过HTTP。

正常竞争用例在事务读后、写前设置屏障，明确两参与者读到同一版本；不靠sleep凑竞争。
一方赢得唯一新Command及Package锁后，合成status丢响应保留未知结果，另一方准确409 AI2_COMMAND_PENDING。
未准备/提交远程绑定、不新增Attempt；原UUID显式恢复后只新增一个Attempt、一个版本，精确引用代次和历史不变。
替换_id和submitCommandId后尝试同包同Attempt版本插入仍11000，排除误命中其他唯一键。
三种非法状态都使用当前包版本、新UUID，要求准确409 AI2_STATE_CONFLICT、所有AI2集合不变、媒体client零调用。

review成功后分别修改decision/comment/包版本/Attempt版本/hash；withdraw成功后分别修改reason/包版本。
在重建服务实例后复用同key，均准确409 IDEMPOTENCY_CONFLICT；AI1/AI2全持久快照和首次审计不变、无新增媒体读取。
原正文重放仍成功，命令/审核结果不变。

## 自查及独立复评

独立评审指出并发测试的异常收尾P2：若只在allSettled之后释放屏障，单侧提前失败会让另一事务等待。
修订为每个提交finally释放，再drain两个提交；增加单侧在事务读后、进入屏障前抛错的真实副本集反例。
五秒屏障截止只是失败收尾，不是通过条件：最终必须deadlineReached=false，正常竞争仍要求arrived=2；
故障例要求arrived=1及准确故障原因，不冒称正常双事务竞争。未提高Jest原30秒超时。
移除单侧finally时，永久故障例在截止释放并drain后命中失败断言，而不是遗留等待事务。
本项P2修订已自查并独立复评通过，FIXED_REVIEWED / USER_REVIEW_PENDING；未经用户批准不记CLOSED。
独立复评者Aristotle（`01a1a3cc-9dba-7f73-a4e8-749a9bbb3f39`）实际运行新增9项：2套9通过，73项因过滤未选中，
10.634秒，退出0；启用detectOpenHandles，未使用forceExit。另核对主执行方188项及五项变异的逐项失败信息，
确认非启动/语法错误假红；屏障移除例5053ms在deadlineReached断言失败，产生完整结果并退出，不是Jest超时。
94候选源码哈希独立核对一致，未重复主执行方基线重建或全量/变异运行；最终聚焦复评未发现新增可操作P1/P2。
独立9项运行当时未指定JSON/log落盘，证据来源为独立线程工具输出及最终确认；归档`review/independent-record.md`
由主线程忠实转录其结论与命令，明确非独立原始日志，不以主执行方188项JSON替代独立运行。
独立补充核对§8三行升级与限定证据一致，当前20核心/11部分；其早先14部分描述保留为§7历史口径。

## 验证证据

归档相对原项目根目录：`release-gate-artifacts/ai2-5-concurrency-20261104/`。
继承已批准连接候选 `b2f1632a44d08145be938cabf4e46e9fa5d0222293dbe200c2eb5f711c709f16`；不覆写旧证据。

| 项目 | 结果与边界 |
| --- | --- |
| 首轮新增反例 | 2套8通过，73项因testNamePattern未选中；不是完整套件结果 |
| 异常收尾新增前受影响回归 | 4套88通过，0失败/跳过，25.370秒 |
| 最终homework全部AI2 | 10套188通过，0失败/跳过，44.952秒，包含新增9项及原正式/提交HTTP |
| 独立新增反例复验 | 2套9通过，73项未选中，10.634秒；detectOpenHandles，无forceExit；不冒称完整套件 |
| 五项临时副本变异 | 活动锁2失败、状态限制2失败、终态hash3失败、单侧屏障释放1失败、Attempt版本唯一索引3失败；均命中预期断言且退出1 |
| 静态 | 两测试ESLint通过；后续文档/哈希检查单独记录 |

首轮变异脚本误预期状态限制移除会有3失败，实际2失败，脚本退出1；withdrawn仍被独立CAS拒绝。
原状态断言不改，历史JSON/log保留；最终变异工具按实际保护层次记录2失败，不将该初次工具失败冒称通过。
所有变异仅在重建临时副本内进行并逐次恢复，没有改动工作区业务代码或删减断言。

实际执行复用Node22、既有NODE_PATH、固定本机mongod（禁止下载）、既有homework Jest配置：

```sh
# MONGOMS_SYSTEM_BINARY 指向既有本机mongod；NODE_PATH指向既有依赖，不安装。
node "$LMS_DEPENDENCIES/jest/bin/jest.js" \
  --config backend/services/homework-service/jest.config.js --runInBand \
  --testPathPattern=ai2 --json --outputFile="$RESULT_ROOT/final-homework-ai2.json"
```

未重跑家庭后端全量、前端全量、构建或浏览器；这些实现没有变化，旧结果保留原身份。

## 冻结和门禁

- 基线：`4655d30f1b61b55f400b67f16f9143dd191de1d2`。
- 新累计94文件candidate：`5d796b39cdf89977d4222bfd3fe7793717d076a1267621aebd53a7218f4e7fbf`。
- 累计patch：`f6140504459c1a0291c700001e8d721c8627ed7a3f0d93d7aabd737906d73992`。
- 两测试增量patch：`98ff1273da3c8a80ef6afd5f9131e844678609147f95f2bc9d23221423b9ef1b`。
- 相对已批准连接候选只有两测试文件改变，另92文件逐字节不变；从基线重建94文件匹配。

本批补证不自动关闭总门禁；剩余矩阵子条件、真实模型计数资格、DEVICE_PENDING、历史失败、
T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收 REMAINDER_DEFERRED、T9 NOT_STARTED均保留。不提交、推送、合并或部署。

## 2026-11-04 用户批准及本轮复验证据

用户复审通过并批准本补验ACCEPTED / USER_APPROVED、屏障异常收尾P2 CLOSED / USER_APPROVED。
绑定上列94文件candidate `5d796b39cdf89977d4222bfd3fe7793717d076a1267621aebd53a7218f4e7fbf`、累计patch及两测试增量patch，旧归档不修改。
最新复审独立执行2套9项通过，73项因过滤未选中，11.392秒、退出0；detectOpenHandles且无forceExit，openHandles为空。
JSON SHA-256 `25ad64d06cd367ca1e34eff809ab863fa2a00bdba8dc09ef24393bac19ce62c4`，
log SHA-256 `1908f569abc31dace3e0441462e2ce98b22d0ca999527d84299a01662b37f9c2`；
复制归档于新发布补验目录`release-gate-artifacts/ai2-5-publication-20261104/approval-review/`。
独立静态复评Dalton（`01a1a3d6-2b83-74c2-bd47-df38782500b3`）未发现可操作问题，没有冒称其再次执行运行/哈希检查。
复审重建94源码一致，10文档及45证据匹配；原测试顶层语句40/48条逐项保留。
188项为开发完整homework AI2回归；最新9项为独立聚焦复验，两者不混为同一次全量。
此前10.634秒独立运行的转录、首次变异工具失败及所有历史证据不覆盖。
活动锁变异证明错误契约，不单独冒称证明整个重复写入防线。AI2-5 IMPLEMENTING、AI-2 OPEN不变。
