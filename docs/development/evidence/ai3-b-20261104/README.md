# AI3-B 共享费用账本与发送占位基础

**Status:** ACCEPTED / USER_APPROVED (local shared-budget foundation only, 2026-11-04)
**AI3-A:** ACCEPTED / USER_APPROVED，readiness P2已关闭
**AI-3:** OPEN
**Base:** `a4f051e26f3514da051910a3495e11b149a32c45` + 已批准AI3-A候选

## 范围与实施顺序

### 本轮批准与独立复验

用户批准限定合成批次验收；绑定原候选补丁
`83eb9d63f92833b48b00a79e398c142fe261d392186d644e8dfee1bac3f8bad8`，不改写冻结清单或历史日志。
本轮独立复审核对26项源码/文档/补丁/日志哈希，反向补丁检查通过；账本及AI1服务73项、AI1 runtime 47项通过。
独立重跑两项变异，移除owner校验3项拒绝断言失败，无条件释放槽位2项断言失败；是有效拦截，不计候选失败。
八文件ESLint、文档状态校验、diff check通过。开发51套1776项全量不冒充本轮独立全量。
本批自查游标收尾及保护补强随批次通过；冷初始化确定性重试继续由下一批实际AI3调用方补齐。
下文待审表述保留为当时快照；本节为当前状态。AI-3总门禁仍OPEN，其余未关闭/后置范围不变。

依据[批准设计§5](../../../superpowers/specs/2026-11-04-family-ai3-minimal-design.md#5-生成费用与未知结果)、
[API§3/4](../../../api/family-ai3-api.md#3-内容生成和角色-dto)、[测试计划GEN-02](../../family-ai3-test-plan.md#2-永久用例矩阵)。
首批批准见[AI3-A当前记录](../ai3-a-20261104/README.md#用户批准与复审绑定2026-11-04)，原冻结补丁和历史失败不改。

本批完成共享费用基础，不声称已完成AI3生成业务：

1. 原Ai1Reservation/Ai1SendSlot增加封闭ownerProfile=ai1|ai3；旧字段缺失仅解释为ai1，显式null/未知值拒绝。
2. 从原AI1服务提取现有Account、日/月/实验预算与事务CAS，AI1实际预留/claim/结算/失败释放接同一helper。
3. 新AI3生成Command仅增加账本引用所需的内部模型字段/阶段；合成consumer夹具在真实事务内与AI1竞争同一账户/槽位。
4. AI1 enabled/query-only启动前增加只读owner预检；旧AI1默认关闭不变。预检不自动修数据、不清槽位、不发送请求。

后续顺序：AI3生成预览/受限profile与原命令编排（含实际AI3调用方首次初始化重试）→远端受限operation替身验证→
孩子图片提交与审核/复习效果→页面和正式应用闭环。复用既有工具，按相关范围分批，不新增框架或独立常驻执行器。
本批没有新增API路由；ai3Contract仍拒绝generate请求，AI3公共生成、远端映射/claim/退款证据和未知结果恢复仍待后批。
本批的AI3内部消费夹具不代替上述公开流程；未改DeepTutor、Provider、消息模板或真实发送计数资格。

## 内部契约与兼容

同一Reservation集合保留原jobId唯一索引，不增加profile分区；同一家庭Account和`experiment`账户、`global`槽位不变。
AI3的jobId引用Ai3Command._id，其generation保存reservationId/reservedCeilingMicros；只接受endpointOperation=ai3.generate。
归属读取同时核对profile、owner/预留ID、family/child及金额；AI3预检在同一个homework数据库做固定集合只读查询，
不因AI1冷启动注册/自动创建AI3模型或集合。此检查只证明账本归属，不冒充完整备份恢复/金额汇总校验。

预留和槽位写入必须在调用方事务内；helper不负责公开鉴权、报价、远端证据或业务phase CAS，调用方不得省略这些条件。
AI1现有实时权限/报价复核/持久claim/矛盾退款保护保持。内部helper没有Provider、HTTP或计时回收能力。
claim仅占空槽；释放仅匹配原profile和ID，其他合法owner的占位保留，未知/悬空槽位拒绝而不自动修复。
未决金额跨日/月继续计入全部outstanding；已结算金额按当前家庭时区重分桶，不按profile另开额度或默认为0。

仅临时Mongo副本集与合成账号；不修改真实索引/数据。没有AI3数据的本地候选可回退本批补丁；
若以后已写入AI3预留，不得换回不认识ai3 owner的旧二进制，应关闭发送并保留兼容读取与原命令处理。

## 永久反例与自查

- 原AI1成功结算接口遇ai3/未知/null预留归属必须503且整个数据库快照不变；先红3项再修复。
- 真实AI1与内部AI3消费者争最后额度、全局槽位，仅一个胜者；未决AI3跨日/月仍占额度和槽位。
- 旧缺省profile AI1可正常结算；缺省不能猜成AI3；跨孩子、错误owner、错误金额、非生成Command拒绝且不修复。
- 真实AI1过期释放只退自己的预留，其他AI3槽位不变；AI3合法终态释放自身槽位；相同ID错误profile拒绝。
- claim/release写槽后故障，owner、Slot、Account、Reservation一同回滚；重复jobId不能增加第二预算池。
- 冷初始化竞争不预建Account/Slot；内部fixture遇Mongo重复upsert只在事务回滚后用原ID显式本地重试，无远端调用。
- 只读预检读/close失败均关闭游标并脱敏；enabled/query-only错误owner不获得ready，且不自动创建AI3集合。

自查发现并修复游标close异常绕过脱敏：先得到1 failed / 1 passed / 14未选，之后将finally收尾纳入统一错误边界。
新增过期退款测试初版仅推进60秒，未到真实sendNotAfter，得到1 failed / 19 passed；
修订为读取持久截止点并先断言尚未到期，再设置测试时钟。原槽位/费用断言不变，业务代码未为该夹具修改。
独立评审首轮未发现重要业务缺陷，指出精确释放、写槽后回滚、冷初始化三处覆盖不足；已补四项永久测试。

## 验证与证据归属

实际命令使用现有Node22/Jest与原项目依赖，MONGOMS_RUNTIME_DOWNLOAD=false；无安装、超时放宽或跳过原测试。

```sh
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --testPathPattern='services/ai[123]'
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/ai3Budget.test.js
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand
npm run docs:family:check
git diff --check
```

首轮3套相关验证112项断言通过，但ai1Runtime套件因日志目录EPERM失败，退出1，不能写成全绿。
正常权限19套AI1/AI2/AI3相关回归445项通过，退出0；发生于最后四条补测之前，不冒充最终完整回归。
修正截止点夹具后，新增账本套件20项通过，退出0。
首轮完整homework回归51套中1 failed / 50 passed，1 failed / 1775 passed tests，273.272秒，退出1；
唯一失败是上述已定位的旧过期时钟夹具，不删除或改写该轮失败。
同一原命令、修正夹具后的最终候选：51 suites / 1776 tests passed，310.565秒，退出0。
这是homework完整配置套件，既有排除列表未改，不是全家庭后端、正式AI3 HTTP、浏览器或完整发布验收。
Mongo驱动既有弃用警告保留，不记零警告。原始日志仅留本机临时目录，不复制合成请求日志或机器路径进补丁。

## 独立复核与冻结

独立评审先运行当时的原AI1服务全套和账本套件：67项通过；加入游标两反例后重新运行69项通过，退出0。
最终四项补测及截止点夹具修正后，独立运行账本20项，退出0、4.856秒；不是重新跑全部AI1/AI2/AI3或完整服务。
独立复核未发现本批重要代码阻断，确认四项补测有效；冷竞争的11000条件分支不保证每次调度必触发，
后续真实AI3命令编排仍须覆盖其确定性本地初始化重试，不能以本fixture宣称已完成公开generate恢复。

两项开发隔离变异有效：移除reservation的ownerProfile校验，原AI1三个反例3 failed；
无条件清全局槽位，其他owner保留/相同ID错profile两例2 failed。独立复核读取实际失败断言，未自行重跑变异。
变异只在临时模块中注入，仓库源码不变。早期变异生成器因定位不唯一拒绝、模块未生成导致0项执行，
这些工具失败保留但不计入有效变异；修正定位后才产生上述真正红灯。

[候选清单](candidate.json)冻结8个源码/测试，增量[补丁](candidate.patch)以上述base和AI3-A原补丁为前置。
补丁reverse check通过；另在临时目录重建这8文件，逐项与冻结和当前SHA256一致。不是全仓干净检出或真实部署验证。
AI3-A旧补丁/清单不覆盖；本批Ai3模型变化由新候选标识。批准文档增量另行归档，不混入T8、AI1/AI2旧状态修改。
当前工作区原有30项无关文件/符号链接哈希不变；只变更本批8文件、首批批准记录与共享Gate本轮追加部分。

[验证摘要](verification.json)记录红灯/最终通过/独立结果及原始日志哈希；
[批准文档增量](approval-records.patch)仅绑定首批README与Gate相对本轮起点的变化，不覆盖其既有增量。
最终八JS ESLint、文档门禁、diff check通过；既有文档校验器不包含AI3完整语义，不能替代本批实际测试。
自查close脱敏问题及三项测试保护建议已修订并独立复核，本批仍待用户验收，不自动关闭AI-3。

## 未关闭边界

AI3-B待用户验收、AI-3 OPEN；T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、
两项非阻断补测、QUALIFIED_COUNTER_PENDING和REMAINDER_DEFERRED保持。
没有真实模型、正式AI3 HTTP/浏览器、提交推送、合并或部署，不将本基础批次等同AI3-GEN全部验收。
