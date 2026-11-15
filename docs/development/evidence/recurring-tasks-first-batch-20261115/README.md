# 重复计划首批核心服务候选

状态：FIRST_BATCH_PENDING_ACCEPTANCE。设计及原P2设计问题已获用户批准；本批仅本地合成服务层交付，不是可供家长使用的完整功能，也不是总门禁关闭。

基线：`3816c3f2a45daff8b66221cfffb322de11bdce33`。只使用临时Mongo副本集和合成账号；未操作服务器或真人入口，未提交/推送/部署。

## 候选与证据

- `candidate.patch` 与 `candidate-files.json`：9份源码/测试/配置和3份设计/API/测试记录，包含原未跟踪文件的完整新增内容。文件SHA-256及补丁SHA-256以清单为准。
- `verification.json`：由实际Jest JSON提取各批计数、逐项断言及失败详情，附原始结果SHA-256；不是独立复验的替代。原临时路径只用于本机排查，归档去掉工作区绝对前缀。
- 初始缺模型和日期校验未导出的失败为本轮工具输出记录，未声称具有完整原始日志文件。后续旧回归EPERM和两项P2红灯均有JSON归档摘录。
- 变异仅通过临时Jest transform改内存加载源码；没有修改冻结业务文件。回退水位保护对应3负例，移除未来规则提升对应2负例，各退出1，断言失败如预期。

## 验证命令

使用本机已有依赖的 `NODE_PATH` 和 Jest/ESLint可执行文件，不安装依赖。以下路径均相对项目根，`jest`/`eslint`指这些已有可执行文件。

```sh
jest --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/recurringTaskPlan.test.js --json --outputFile=/tmp/recurring-first-batch-final.json
jest --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/models/GrowthTask.mediaReferences.test.js backend/services/homework-service/__tests__/services/growthTaskSources.test.js backend/services/homework-service/__tests__/services/growthTaskChecklist.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionService.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionConfirmationService.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionMutationService.test.js backend/services/homework-service/__tests__/growthTasks.test.js --json --outputFile=/tmp/recurring-affected-regression-r2.json
eslint backend/common/utils/familyDate.js backend/services/homework-service/models/GrowthTask.js backend/services/homework-service/models/RecurringTaskPlan.js backend/services/homework-service/models/RecurringTaskPlanCommand.js backend/services/homework-service/services/recurringTaskPlanCommand.js backend/services/homework-service/services/recurringTaskPlanService.js backend/services/homework-service/__tests__/services/recurringTaskPlan.test.js eslint.config.js
npm run docs:family:check
git diff --check
```

开发专项51项通过；原受影响7套件308项通过。两者分批，不能写为家庭全量359项一次通过。既有Mongo驱动废弃选项警告保留。文档原门禁未自动收录本新增接口；另做本轮文档链接/JSON/围栏/空白和候选哈希检查，不冒充行为证明。

最终本地检查：lint退出0；既有docs门禁退出0；12个候选文件哈希一致，8个相对链接、1个JSON示例及围栏/行尾空白通过；`git apply --reverse --check candidate.patch`退出0；`git diff --check`退出0。本机Node v26.9.0，复用已有依赖；这不是Ubuntu低资源或真机验证。补丁SHA-256：`30dcffb21678db42faa96f410a6abe4f102113bb08a0072596900bcebc939bbe`。

## 独立评审

首轮独立审查发现2项实现P2：已评估计划回退到开始日前绕过保护；未来开始的已到期规则未折叠即被新pending覆盖。开发已修订并固化5个失败后转绿的真实副本集用例。首轮reviewer只做静态及内存诊断，不冒充Mongo实跑。

2026-11-15第二轮独立复评通过，结论为两项P2修复有效、限定范围内无新发现，建议关闭；本批工程及新P2最终用户验收仍待确认。评审方以 `--no-cache --coverage=false` 重跑同一专项，真实临时Mongo副本集51/51通过、0 skipped，报告为 `recurring-independent-review.json`，已计入verification独立条目；运行前后六个被审查源码/测试哈希一致。另静态核对5项红灯及47项修订后报告。

独立复评没有重跑开发的原7套件308项，也没有重做两项变异；其结果不能合并成独立359项或独立变异通过。开发/独立均未执行新HTTP、页面、定时器或正式接线。

## 尚未交付

正式HTTP及分页/列表、启动索引检查、定时及公平扫描、失败健康记录、页面本地标记/同actor重登恢复、真实媒体与发星集成、浏览器与真人/真机均未计入本批。无需将这些预定后续批次扩展为新框架。

T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、历史失败与后置范围不变。两项新实现P2的修订不等同于用户已批准工程关闭。
