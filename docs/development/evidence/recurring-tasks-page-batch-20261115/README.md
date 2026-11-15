# 重复计划第三批：家长页面与最小命令恢复

状态：`THIRD_BATCH_PENDING_REVIEW`。第二批已由用户批准；本批实现、自查、独立复评已完成，等待用户验收。重复计划总门禁仍 OPEN。

## 固定候选

- 基线：`3816c3f2a45daff8b66221cfffb322de11bdce33`。
- [累计候选补丁](candidate.patch) SHA-256：`f29db32dbbc9fec703f39363a52a79dde44544b199322c6fc5bd7641547d0632`。
- [33文件清单](candidate-files.json)：包含已批准前两批和本批前端/测试/文档增量，逐文件标出相对第二批变化；用基线文件重建补丁，33份哈希全部匹配。后端文件均与第二批冻结一致。
- 第二批补丁仍为 `88ae98bad4acf08c3380b7cb19f602b633cfc68998e9ec9898c1b778f23efdfb`，首批和第二批归档、旧 `superseded` 快照均未改写。
- 本目录不纳入自身补丁，避免循环哈希；最终归档文件哈希另列 `archive-files.json`。
- 最终独立重建核验见 `independent-final-r2-binding.json`：33文件三方一致、18个后端文件与B2一致。其当时核对的59份证据索引保留在 `verification-prefinal.json`；之后仅追加最终源码8组变异和收尾报告至当前 `verification.json`，旧变异原报告另存 `*-previous`，由原始哈希对应。首次独立文档诊断的子标题匹配错误保留r1，不当作业务失败或通过。

## 已实现

任务页进入重复计划管理；按孩子分页查看、每天/指定星期、明日起修改、立即停止但保留已生成任务。默认工作日，不处理节假日。显示固定时区和生成缺口，停止前规则不再承诺生成。

发送前保存并回读独立 UUID 最小标记；正文仅当前会话。原命令重试、完整终态校验、not_found保锁、原actor退出重登只读查询/显式中止、跨账号/孩子和迟到响应隔离。多标签两个意图互不覆盖，终态仅移除自身标记。确认中止绑定打开时的意图。

Web Crypto需要安全上下文；普通远端HTTP未具备该条件时失败关闭，不发送、不回退弱摘要。需在后续启用前核对HTTPS等入口条件。本批不改部署或真人入口。

## 开发与独立验证（分批，不累加）

原始报告的SHA-256、脱敏结果和逐项用例名在 [verification.json](verification.json)，原始日志仍保留本机临时证据；归档不含Token、真实账号或孩子资料。
累计补丁沿用历史测试方案中的本机依赖绝对路径，未改写该历史记录；本次仅本地归档。若后续授权公开交付，应单独审查环境路径脱敏，不能将本次检查当成公开推送批准。

| 验证 | 实际结果和边界 |
| --- | --- |
| 前端全量第一次 | 81套件1307项通过；尚未包含之后的修复与补测 |
| 修复后前端全量 | 81套件1312项通过；后续新增hash等待及两项页面测试另跑专项，不称最终一次全量全绿 |
| 开发最终专项 | 3套件36项通过，`recurring-b3-final-targeted-r2.json` |
| 独立复评阶段一 | 五专项55项通过，9项服务诊断通过；不是正式HTTP，也未重跑全前端 |
| 独立最终补验 | 3套件36项通过；六文件前后哈希一致，见 [最终独立绑定](independent-coverage-r1-binding.json) |
| 定向变异 | 8组分别捕获1/1/3/1/1/1/1/1项失败；聚焦选择之外的用例不算运行或跳过回归。变异退出1为预期，不列绿色测试 |
| 最终构建 | `CI=true BUILD_PATH=<temporary-build> npm run build` 退出0 |
| 静态验证 | 受影响文件ESLint、`git diff --check`；文档另跑现有 `docs:family:check` 和新文档链接/结构检查 |
| 正式浏览器 | Chromium 3/3；正式HTTP和临时Mongo，不使用成功响应替身。开发实跑，不声称独立方重复浏览器 |

正式浏览器通过既有 `playwright.t2.config.js` 自动纳入 `test:t2:e2e`，新增文件 `tests/e2e/t2/recurringPlans.spec.js`。每次仅新临时数据库、媒体目录及动态回环端口，测试结束关闭。Gateway、user/homework/resource/progress使用正式工厂，analytics/notification使用现有测试运行时的原应用；本批不测试其业务、模型或新回收。

三项分别验证：
1. 页面创建后刷新、修改明日起、停止，实际只生成当天1任务且原实例字段不变；1280/768/360无横向溢出，按钮44px。截图为本目录三份 `recurring-*.png`。
2. Gateway实际提交成功后丢响应；退出重登清正文、保原UUID，GET恢复，业务POST仍1、实例1、账本0。
3. 浏览器阻断未到达POST；重登not_found保锁，真实abort终态后可新建，迟到原POST返回409且无实例。不伪造服务端成功。

复跑方式（已具备仓库依赖时）：

```sh
cd frontend/web
CI=true npm test -- --runInBand --runTestsByPath src/__tests__/family/recurringCommands.test.js src/__tests__/family/RecurringPlansPage.test.js src/__tests__/family/recurringApi.test.js
CI=true BUILD_PATH=/tmp/recurring-review-build npm run build
cd ../..
T2_WEB_BUILD=/tmp/recurring-review-build npm run test:t2:e2e -- recurringPlans.spec.js
npm run docs:family:check
```

## 发现及修订

- 独立初审三项P2：单槽覆盖另一个UUID、同actor再认证只隐藏未删除正文、成功回执缺结果孩子/目标核验。已先留红灯再修复，最终独立复核无新可复现P1/P2；问题关闭等待本批用户批准。
- 自查补确认中止的原意图绑定，防弹窗打开后误终止新标记。页面补草稿403、stopped行只读、真实挂起业务调用切孩子，旧GET测试保留并准确改名。
- 初版late测试的变异存活，保留 `recurring-b3-mutation-late-old-survived.json` 证据；新测试在摘要计算中明确换session，再释放结果，捕获失去最终会话保护的变异。未放宽断言/timeout。
- 保留首轮模块红灯、初始页面等待失败、沙箱Chromium启动拒绝，以及真实浏览器40px断言失败和恢复夹具误要求新建可用的失败。首次CRA入口依赖缺失和首轮构建lint错误记录在会话/本摘要，未留独立完整原日志，不能宣称已归档它们的原始输出。不是单纯重跑掩盖问题。

## 未完成范围

RP-17/19的重复实例图片提交、真实发星幂等/共管接续/跨日独立奖励和孩子回看留最终集成批；RP-15a提交前屏障与重登的单一浏览器组合、修改/停止丢响应组合尚未运行，不以分层用例冒充全部组合完成。自动timer多周期补测仍非阻断待办。

T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、历史失败及后置范围不变。不提交推送或部署、不调用模型、不操作服务器、不更新真人测试入口。
