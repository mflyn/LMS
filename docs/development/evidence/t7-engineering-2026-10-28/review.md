# T7 自查与独立复验

当前状态（2026-10-28）：用户已批准下列七项 P2 为 CLOSED，详见 [批准关闭记录](p2-closure.md)
及 Gate §27.8。T7 gate OPEN；本批准不关闭 T4、T7 或任何后置事项。
以下实现审阅和失败叙述保留为批准前历史快照，不覆盖其当时状态。

## 实现审阅

独立评审 Beauvoir 的设计审阅及代码复评与作者自测分列。前三项代码问题已修复并获得独立复评，
当前记录为 VERIFIED_FIXED / PENDING_USER_ACCEPTANCE，不冒称用户批准关闭。

| 编号 | 问题与永久保护 | 独立结论 |
| --- | --- | --- |
| T7-REFLECTION-P2-001 | 周切换不应重置当前身份拒绝；旧周 403 拒绝新周，但旧身份 403 不能拒绝新身份 | 复评 PASS |
| T7-REFLECTION-P2-002 | 全周核对后不能把历史行当作当前周可编辑行；当前周读取 pending/失败/成功三类反例 | 复评 PASS |
| T7-REPORT-P2-003 | 保存反馈前/中开始的旧 GET 不能在 PATCH 后回填；拒绝仍优先 | 复评 PASS |
| T7-COVERAGE-P2-004 | 空历史快照不足以证明冻结；25 分钟历史源改为 90，报告身份、生成时间与统计不变 | 六项 HTTP 独立复验 PASS；M1 杀死 |
| T7-COVERAGE-P2-005 | 只验证不变不足以证明当前统计正常；两完成任务、一错题、反思前后记录天数 0→1 | 六项 HTTP 独立复验 PASS；三个 M2 均杀死 |
| T7-COVERAGE-P2-006 | 补外家庭家长周报 GET/PATCH 拒绝及反馈、actor、时间、统计不变 | 六项 HTTP 独立复验 PASS；M3 杀死 |
| T7-REPORT-P2-007 | 当前统计/冻结提升/唯一键竞争不得覆盖人工反馈，迟到请求返回冻结赢家 | 模型 33、HTTP 8 独立复验 PASS；F1/F2 两层变异命中 |

独立页面运行 3 suites / 24 tests PASS（ReflectionPanel 当时 12、Reports 7、Navigation 5）；
随后作者补五项输入/存储反例，最终前端全量 739 项。不能称独立评审执行过这五项新增用例。
独立 HTTP 6/6 PASS，11.025 秒。五轮内存变异均一次命中目标，目标 1 failed / 5 非目标 skipped，
runtime errors 0，合计 43.736 秒，三个监测源码前后哈希不变；没有修改共享生产文件。
M1 在原有 toMatchObject 处已被杀死，不能把它称为随后严格 toEqual 的独立变异保护。
独立结果原文、准确命令和 44 文件哈希清单保留于 preserved/lms-t7-independent-mutation-20261028-3BDHpr。

## 失败证据不覆盖

- 初始反思代码/导航反例及三项代码 P2 红灯计数保留在 Gate 阶段记录；仅有工具输出的部分不伪造文件日志。
- HTTP 统计补强首轮 2 failed / 4 passed：错误预期整数 67，修正为现有契约的两位小数 66.67；未改生产统计或放宽断言。
- 早期浏览器缺失 build、Chromium 沙箱启动拒绝、textarea 标签包含预填值问题分别保留；最后一项修正 htmlFor/useId 并补永久标签反例。
- 数学链路三次失败为重点项名称、家长残留求助筛选和 select 精确定位；修改真实 UI 操作，没有更改预算或业务断言。
- 补强浏览器曾 1 failed / 5 passed：同期 build 清空共享目录造成执行候选不稳定，不能据此证明生产缺陷；改用固定构建后 6 passed，再全量 54 passed。无网络 trace，不杜撰精确网络失败记录。
- 根 lint 历史观察 44 错误均为 release-gate-artifacts 的 JSX 备份解析；代码目录 lint 通过不代替根命令。不得删除历史或放宽规则。

## 发布门禁

首次实际 release:family 在 01-root-clean-install 失败（exit 255，默认 npm cache EPERM），未进入测试或 Docker。
使用独立临时 npm cache 再执行原脚本，安装成功后在 02-lint 退出 1，44 项错误均为既有历史归档 JSX
解析；03--18 阶段未执行，Docker 未启动。没有修改全局权限、删除归档、放宽规则或跳过阶段。
两次输出分别保留 release-attempt 和 release-isolated-cache。后续阶段未运行不标记通过。
安装报告 48 项依赖漏洞（12 low / 10 moderate / 24 high / 2 critical）及安装脚本允许列表提示；
本次未运行 audit fix、升级依赖或修改允许列表，不能据此宣称依赖安全审查通过。
该报告是 npm ci 的输出，不是逐项漏洞可达性结论；生产启用仍需 T8 的运行时/安全核对。

## 自查边界

最终归档一致性独立核对通过：29 候选文件、210 原始证据、197 preserved 原件、五个构建文件及
九个源码映射均一致。但另发现 T7-REPORT-P2-007 服务端反馈覆盖竞争，原候选不再是修订后最终候选。
修订方案及红绿结果见 Gate §27.6；尚待独立复评和修订后完整验证，不关闭该问题。

后续独立复评已通过：最终回环 harness 模型套件 33/33、正式 HTTP 8/8；F1 旧读回写和 F2 忽略
整份审计两个内存变异在模型与 HTTP 两层均出现预期业务失败，未改共享源码。准确计数和限制见
Gate §27.6，原件保留于 lms-t7-feedback-independent-20261028-Vz2Cb1。状态 VERIFIED_FIXED /
INDEPENDENT_REVIEW_PASSED，仍待修订后完整回归和用户批准，不将早期归档通过代替新候选。

无新增后端生产 API/schema/index、无时长/奖励写入、无真实数据或 Git 操作。
T4 OPEN、T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5 非阻断补测、REMAINDER_DEFERRED 保留。
上述归档核对为修订前快照。修订后完整结果已于 Gate §27.7 追加：家庭 4506、正式 HTTP 35、
Task11 HTTP 6、Chromium 54、Task11 Chromium 4，均通过；前端未变，739 与固定构建证据继续适用。
最后补入真实过期 JWT 后独立 HTTP 8/8 通过，完整 HTTP 35 项再跑通过；没有 mock 过期成功或改签名验证。
最终候选第三次执行原 release:family，独立 cache 安装成功，02-lint 仍为历史 JSX 44 errors，
exit 1，28.771 秒；03--18 未执行，Docker 未启动。原两次失败均保留，不增加忽略或放宽规则。
七项 P2 均提交用户验收；本文件不构成批准关闭。
最终候选及证据的一致性复核记录单独放在 final-review.md，不把自查替代独立复核。
