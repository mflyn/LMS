# T4 合成工程候选与 P2 关闭交接

本目录是可随 Git 检出的脱敏证据摘要，不是一次新的测试运行，也不是原始日志完整备份。
当前功能开发完成；求助投影 P2 已批准关闭，T4 总门禁仍 OPEN。权威状态见[Gate §24.9](../../family-self-directed-learning-mvp-gate.md#249-求助投影-p2-批准关闭与完整候选提交2026-10-26)。

## 完整候选

- `candidate.json`：基于原 main 的全部 T4 代码、测试及相关文档的 SHA-256，不只包含四文件修订。
- `closure.json`：批准范围、独立复评依据、已执行结果及未执行/后置事项。
- `artifacts.sha256.json`：两份本地冻结归档的原始清单、逐文件长度及哈希。旧失败日志未改写。
- `preflight.json`：本次提交前校验，不与历史业务回归混同。

候选哈希针对暂存区选取的 T4 内容；共享文档中的 AI/K12 规划不在本 PR 范围，保留在本地。
候选本身不包含本目录的元数据，避免自引用哈希。Git 提交 SHA 则绑定完整检出树，包括此证据索引。
四文件修订 digest `d46c962d81cf2d79ba7efd653602739e3cbe69016c0e55ae165f76f3d12eac43`
只用于对应 P2 的复评，不能代表整个 T4。

## 验证证据边界

原 T4 候选：前端 46 suites / 590 tests、构建、Chromium 28 项、正式 HTTP 3 suites / 18 tests
以及家庭后端 146 suites / 4147 passed / 1 skipped。条件跳过项有独立 18 项补验，
但不能将原全量写成零跳过。原始失败、包括旧 lint 和浏览器失败继续保留。

求助投影修订后：homework 全套 29 suites / 1254 tests / 零跳过；开发定向 191/57/2；
独立复评 229/57/2 及 5 项补充探针均通过。独立前三组只有评审对话中的工具输出，
未另存 stdout；5 项探针有独立日志。开发日志不代替独立输出。
前端生产源码未因该修订变化，沿用已核验构建；不声称修订后重跑了全部浏览器、前端或家庭后端。

本地原始证据位于 `release-gate-artifacts/t4-2-2026-10-26/` 和
`release-gate-artifacts/t4-help-projection-2026-10-26/`，不随 Git 上传。
未来 CI 产物按实际提交另行归档，不替换历史结果。固定服务器候选以 PR 最新通过 CI 的完整 SHA 为准。

## 保留边界

DEVICE_PENDING；真实部署、备份及恢复验收为 T8_PENDING / NOT_AUTHORIZED；高级恢复、新回收、
D01/T2-G 及既有后置内容保持 REMAINDER_DEFERRED。只授权专用分支和 Draft PR，不合并、不部署。
服务器隔离测试尚未执行，需单独授权；不能以本地合成证据冒充 Ubuntu 或真实 iPad 验收。
