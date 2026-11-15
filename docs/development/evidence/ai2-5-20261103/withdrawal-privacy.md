# AI2 撤回历史与隐私删除竞争补验

日期：2026-11-04。范围：WITHDRAW-01、WITHDRAW-02、MEDIA-04。
当前状态：ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY。AI2-5及AI-2随后经用户单独批准CLOSED / ENGINEERING_SYNTHETIC_ONLY。
用户本轮明确批准本批及[上一批PUB-02/VIEW-01](publication-visibility.md)，绑定[批准与复验证据](closure-readiness.md)；下方待审和“继续”授权表述保留为历史快照，不据其覆盖最新批准。

## 本批范围

仅三份既有测试新增7项，没有改业务实现、API、schema、原断言或超时；不扩展高级恢复/新回收。

| 原矩阵行 | 新永久反例 | 层次与边界 |
| --- | --- | --- |
| WITHDRAW-01 | `ai2FormalHttp.test.js`两例：approve/revise后撤回、同AI1来源重新发布；新包空历史/空指针，旧Attempt ID不能借新包读取、旧媒体URL拒绝；新包实际上传和提交仍从Attempt版本1开始，旧Package/Attempt/Command/绑定/operation/Asset全对象不变，首次审核/撤回审计及Task不变 | Gateway/homework/resource正式HTTP、Mongo事务和真实PNG文件；AI1批准状态及JWT为合成夹具，不冒称重新执行AI1生成或PIN登录 |
| WITHDRAW-02 | `ai2SubmissionHttp.test.js`两例：真实prepare已持久成功，其client返回值尚未交给homework时暂停；家长HTTP撤回成功后放行，分别commit响应正常/丢失；后者保留锁、原映射和零Attempt，租约过期、重建service、off模式显式原命令恢复，最终精确解绑、FAILED且不回传包/Attempt，原撤回审计保留 | 真实签名身份HTTP和resource协议HTTP；屏障只延迟真实prepare结果交付，不伪造成功响应。包和Asset元数据是夹具，无Gateway/实际文件上传，不称网络层prepare响应丢失 |
| MEDIA-04 | `completionMediaClientContract.test.js`两例：分别暂停commit或delete事务的真实Asset快照读取后续执行，让对方先提交，再恢复原事务；断言发生真实事务重试，删除先胜整组ABORTED无假凭证、commit先胜保持COMMITTED并仅释放被删图的精确代次，另图状态正确；重复delete/commit保持全对象和日志字节不变 | 实际MongoMemoryReplSet事务/索引及本地文件，operation client transport为JSON契约适配器，不是HTTP。spy只延迟真实查询返回，不替换查询结果；不执行高级恢复 |
| MEDIA-04 | 同文件一例：两套不同家庭真实记录和绑定；本家庭家长/孩子删除对方图片均403、全部集合不变；合法删除本家庭图片后，对方Asset/Reference/Operation/Tombstone/Receipt、原文件字节不变且无对方删除日志 | 服务层实时家庭权限；不是本轮正式浏览器。结合已有正式删除/重复DELETE、同图跨Attempt凭证及教学状态不变证据 |

所有屏障在try/finally释放并等待已启动Promise收尾，spy最后恢复；被测操作提前结束不能假装已到达屏障。
持久集合比较不是数据库命令级零写；resource的正常status读取及媒体访问不冒称全进程零出站。
前端及产品源码未改，本轮不重跑前端或浏览器；既有证据保留原候选和执行身份。

## 验证与失败历史

| 执行 | 实际结果 |
| --- | --- |
| 首轮homework新增 | 4失败/30未选中，退出1；新断言误将尚无Attempt的currentAttemptVersion写为0，模型实际为null。只修新断言，未改模型或旧断言 |
| 首轮resource新增 | suite加载失败、0项执行；工作树缺少相对路径node_modules。重建副本链接现有依赖，不安装、不改Jest配置 |
| 首次homework回归筛选 | 临时目录名ai25命中宽泛ai2路径正则，误选其他套件；主动中止退出130，无完整汇总，不计通过。原日志保留；中止Jest及其Mongo watchdog最终均已退出 |
| 精确homework AI2回归 | 10套224通过，0失败/跳过，51.242秒，退出0；原220完整保留 |
| resource完整受影响契约套件 | 1套53通过，0失败/跳过，9.738秒，退出0；原50完整保留，不是resource全仓 |
| 独立定向复验 | homework 2套4通过/30未选中，15.904秒；resource 1套3通过/50未选中，4.702秒；均退出0，detectOpenHandles，不冒称独立重跑224/53 |
| 隔离变异 | 去除历史package过滤2项失败；跳过撤回后清理1项失败；跳过整组隐私释放2项失败；跳过家长成员校验1项失败；均退出1、runtime-error=0，临时源码逐项恢复 |

旧AST检查器首轮把describe内部插入测试视为整个表达式变化，退出1；修订驱动仅移除本轮两条具名MEDIA-04测试声明再比较，
其余原AST逐项精确匹配。不是放宽产品断言。首次进程检查把诊断命令自身计为watchdog，修订为精确脚本参数后确认0匹配；两份记录均保留。
三文件ESLint与原AST保护通过；所有开发/独立/变异证据分别归档，首轮失败不被后续通过覆盖。

```sh
# 重建副本使用已有Node22、固定mongod，MONGOMS_RUNTIME_DOWNLOAD=false
node "$LMS_DEPENDENCIES/jest/bin/jest.js" --config backend/services/homework-service/jest.config.js \
  --runInBand --testPathPattern='/__tests__/services/ai2[^/]*\.test\.js$' --json --outputFile="$RESULT_ROOT/homework-ai2-final.json"
node "$LMS_DEPENDENCIES/jest/bin/jest.js" --config backend/services/resource-service/jest.family.config.js \
  --runInBand --testPathPattern=completionMediaClientContract --json --outputFile="$RESULT_ROOT/resource-suite.json"
```

## 冻结候选

本机忽略目录`release-gate-artifacts/ai2-5-withdrawal-20261104/`；未提交、未公开，不覆盖旧候选。
基线`4655d30f1b61b55f400b67f16f9143dd191de1d2`，沿用94文件范围，仅三测试变化；无关T8不纳入源码候选。

- candidate：`4398c4efadfb6269f4e7a34edcf87c7f560a5fc30012a50f2e97eebf2efaae80`
- 累计patch：`54308baf6746a225842f991b3e6c1e77561dedb6fcba1cb7fcba9f6b978bf8cb`
- 相对上一批增量：`18b2b113bc2ae32c51b879aa616efbd78695a313bd237ff40f573281ecbc58b2`
- 基线加补丁重建94文件一致；validation/review分别保存开发及独立证据，源码/文档/证据分别计算哈希。

## 状态边界

Mill独立复评（`01a1a530-ba54-7a13-9f28-f6e655c64bc1`）未发现本批P1/P2；已实际运行上述4/3目标用例，
两个进程均退出0、openHandles为空、无runtime-error suite。独立移除四条新增测试声明后，三文件旧AST完全相同；
冻结source、重建目录、工作树94文件运行前后匹配。开发224/53和四项变异仅只读核对，不冒称独立重跑。
四项变异共2/1/2/1失败中包含一个业务AppError拒绝，并非全部是matcher失败；均非套件加载/运行错误。

独立支持最新矩阵 **31 = 31 CORE_PASS_SCOPED + 0 PARTIAL**：既有28行证据加本轮三行补齐，
不是本轮独立执行全部31行，也不是31项新用例，更不代表总门禁关闭。
下一步是评审PUB-02/VIEW-01及本批候选，再核对限定合成工程总门禁关闭材料；无需因此扩展新能力。
文档状态校验412 fixtures/38 requirements、三测试ESLint、原AST、内部链接及git diff --check通过。

本批及PUB-02/VIEW-01仍待用户验收。原AUTH-01/RECOVER-04/SESSION-02批准及P3关闭不回退。
AI2-VIEW-NB-001、原两项非阻断补测、历史失败、DEVICE_PENDING、T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、
计数资格待验、高级恢复与新回收REMAINDER_DEFERRED保持。不调用真实模型、不提交推送合并或部署，不提前关闭AI-2总门禁。
