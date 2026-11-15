# AI3-C 本地生成预览与原命令准备

**Status:** ACCEPTED / USER_APPROVED
**AI3-B:** ACCEPTED / USER_APPROVED
**AI-3:** OPEN

## 范围与边界

## 当前批准（2026-11-04）

用户批准AI3-C限定合成批次验收及最终claim开关/报价/截止点P2关闭。
绑定原九文件补丁`48b5d5cf71a23dd3062eed5a8797b25fc82f67d7674f93a78cd563b90a235c89`，不改写原candidate/verification快照。
本轮复审核对28个哈希、两份补丁反向校验及九文件重建一致；原23条测试正文未削弱。
独立重跑两套46项通过（10.74秒，退出0）；独立移除末端重检及禁用冷初始化重试，分别3条反例失败（4.199/4.198秒，退出1）。
这与开发完整52套1799项（258.17秒）分开，复审未重跑开发全量。docs:family:check与diff check通过。
以下待审文字是冻结当时的历史记录，当前批次和P2以本节用户批准为准；AI-3总门禁仍OPEN。

本批接续[AI3-B](../ai3-b-20261104/README.md)，依据[API§3/4](../../../api/family-ai3-api.md#3-内容生成和角色-dto)。
仅未装配的homework本地服务：完整messages预览、生成正文校验、共享账本预留、原actor持久命令/独立远端UUID、
一次本地claim、未claim时安全过期释放、只读发现/重放。恢复当前仅返回原命令状态，不调用远端。
没有HTTP路由、Provider、后台恢复器或真实发送；远端映射协议/请求摘要、GET查询和终态结算属下一批，不能声称完整generate/recover已交付。
本地模板和golden是待本批评审候选，不是已获真实发送批准；8192/4096仅配置上限，不是已证明完整token计数。
QUALIFIED_COUNTER_PENDING、AI-0人工审核与真实发送另行批准的边界不变。

## 最小执行安排

1. 登记B批批准，原候选/原始失败不覆盖；新增C增量基线。
2. 预览只取AI2不可变childSnapshot中的原题/已批准讲解/章节和本轮题量，保存完整预览，不带孩子作答/图片/身份。
3. 生成最终事务检查祖先与Round版本，账户/命令/活动锁同提交；原UUID重放先鉴权，即使off也不重新报价或另扣款。
4. 固定ID只对已知Account/Slot冷初始化重复键做一次本地重试；其他重复键、未知提交错误不盲目重试。
5. 合成副本集测试、反例/变异、自查和独立复评后冻结；不提交、不部署、不提前关闭总门禁。

只在临时合成库运行，不修改真实索引/数据。回退可移除本批增量；若未来已写本批持久命令，必须保留认识该记录的查询/恢复代码，
不能切回旧二进制后清费用或丢弃命令。所有历史和不相关T8增量原样保留。

## 开发检查记录

首轮新增7例因尚未实现generationPreview失败，原23例通过。实现后旧夹具使用假childSnapshotHash，被完整性校验正确拒绝；
改为创建时计算实际不可变hash，不放宽校验。后续撤权夹具使用已有其他家庭owner撞唯一索引，改用新的合成owner。
自查发现slot等待跨截止点仍可claim，永久反例先红1/35；修复为持久DISPATCHING前重采样截止点并回滚。
输入边界新增四例先红4/2，补齐来源文本/章节闭合结构、UTF-16、题量和既有长度边界。
开发相关19套462项通过发生于新增preview六例前；新增preview六例另行通过。不能相加冒充一次完整运行。

## 保留状态

T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、两项非阻断补测和REMAINDER_DEFERRED保持。
无真实模型、外部写入、Git提交推送、合并或部署。本批已完成独立复评并冻结，待用户批次验收；AI-3总门禁不关闭。

## 独立复评与修订

独立复评发现P2：slot await后仅重新采样时钟，未重验开关/报价。两条永久反例先得到2 failed / 4 passed / 34未选，
保留该轮红灯；修复为slot完成后同步重验continuous/enabled、当前profile构建的完整preview和截止点，随后才调用命令CAS。
复评补强：冷初始化同时断言commandId/reservationId/remoteOperationId及恰好两次；generate/claim各一条祖先快照后撤回竞争。
修订后开发40+6项通过。独立复评重跑同两套46项通过、0跳过、退出0、约12.5秒，未发现新的实质问题；
此独立结果不冒充全homework、HTTP、浏览器或真实Provider验收。
P2状态为FIXED_AND_INDEPENDENTLY_REVIEWED，仍随C批待用户批准；不提前写C批或AI-3总门禁关闭。

开发隔离变异：移除末端完整重检导致off/报价/截止点三条反例失败；禁用冷初始化限定重试导致family/experiment/slot三条失败。
两轮各3 failed / 37未选，均为实际行为断言拦截；临时模块不覆盖源码。独立复评本轮跑正常候选，没有重跑这些变异。

## 冻结与验证入口

[九文件候选](candidate.json)及[增量补丁](candidate.patch)以前两批原冻结为前置；
补丁SHA256 `48b5d5cf71a23dd3062eed5a8797b25fc82f67d7674f93a78cd563b90a235c89`。
范围是六个源码/测试、API进度、测试计划和[完整合成预览](synthetic-preview.json)，不含无关T8改动。
合成预览generationInputHash为`25804e795c039293a52e13efa134d2cfaa7eb3d9078430c541fadb80a825737d`，
模型名称synthetic-only，不沿用任何已批准真实输入，也不声称托管模型计数已合格。

实际测试使用既有Node22、Jest、MONGOMS_RUNTIME_DOWNLOAD=false和临时Mongo副本集：

```sh
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/ai3Service.test.js backend/services/homework-service/__tests__/services/ai3GenerationPreview.test.js
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand
npm run docs:family:check
git diff --check
```

原23条AI3服务反例保留；原配置排除列表未改，无延长超时或跳过原测试。既有Mongo弃用警告保留，不写零警告。
第一轮完整homework为52套1799项通过，但运行期间发生末端复评修订，不能绑定为全程冻结候选验收；另跑冻结后完整验证。
初版补丁缺新文件mode头，临时重建失败（dev/null），不计重建通过；修正归档格式，源码哈希未变，旧补丁保留本机。

冻结后原完整命令：52 suites / 1799 tests passed，退出0，258.17秒；运行前后九文件哈希一致。
这是原homework配置的完整回归，不是全家庭后端、完整release或AI3正式链路验收。
六JS ESLint、文档状态门禁、diff check通过；最终21个本地Markdown链接路径存在。
补丁反向检查、临时目录九文件重建及哈希比对通过（非全仓干净检出执行）；原37项无关文件/符号链接哈希保持。
[验证摘要](verification.json)绑定历史红灯、开发回归、独立结果及原始日志哈希；
[批准与门禁增量](approval-records.patch)仅含B批当前批准和C批待审状态，不修改历史冻结。
下一批实施远端受限operation替身、原映射查询/终态结算与生成输出候选，仍不允许真实模型调用；
本批本地命令在DISPATCHING/UNKNOWN时只能只读发现，不能再次取得claim，不能声称远端结果已经收敛。

独立测试原始来源为评审工具会话67448、输出块ef03fb（46项、12.477秒、退出0），未另行生成本机原始日志。
独立测试当时未同步保存源码hash快照；之后独立核对当前六源码hash与静态内容，并从base+A+B+C在内存重建六源码一致，
从本轮before快照+C重建九文件一致。此后置一致性核对不冒充独立测试当时已有hash绑定，也不冒充重跑变异/全量。
