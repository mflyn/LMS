# T2 执行、测试与评审记录

**Status:** T2 CLOSED / ENGINEERING_SYNTHETIC_ONLY / T2-G REMAINDER_DEFERRED
**Design approval:** APPROVED（2026-10-23，含原设计与退出恢复/安全回收补充设计）
**Implementation:** T2-1、T2-R 后端 CLOSED；T2-2 至 T2-6 合成工程验收 CLOSED（§17）；T2-G REMAINDER_DEFERRED；T1 CLOSED，T3–T9 未启动
**Production:** NOT_AUTHORIZED；**Device:** DEVICE_PENDING
**Latest acceptance:** §17 限定合成工程原批准不变；§18 用户批准单独关闭 D2B-05 查询超时。修复提交 e744cba1 的 CI 全量通过，§16–§17 原批准时的 FAILED 快照保留。
**Current follow-up:** DEVICE_PENDING；T8_PENDING / NOT_AUTHORIZED；高级恢复与新回收 REMAINDER_DEFERRED。不自动启动 T3–T9。

下文历次批次中的 OPEN/待批准为当时事实；工程批准以 §17 为准，查询缺陷关闭及专用分支 Git 授权以 §18 为准。§11 范围裁决及所有未关闭义务继续有效。

## 1. 权威输入与版本

目标为用户提供的 44 条 T2 工程要求，涵盖设计、实现、测试、QA、评审和批准，不把设计文档完成当作整个目标完成。
[详细设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-design.md)已获用户批准；
[原计划](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md)和
[总 Gate](family-self-directed-learning-mvp-gate.md)保留正式任务状态。
2026-10-23 用户批准开始 T2-1 基线修复，同步 T2 实施状态和校验器。本轮不提交或推送 Git。
2026-10-23 用户选择补齐两项设计，不接受原限制默认交付；新增
[退出恢复/安全回收补充](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-recovery-retention-design.md)
及 T2-R/T2-G 前置批次。随后用户批准补充设计的新增接口、模型、专用凭据、24 小时保留期及每批 50 个参数；
本轮仅授权 T2-1，原 44 条目标保持，后续批次仍需验收，不提前关闭 T2。

工作树基底 HEAD：`79b346155abf4fefd2afdabe12c7e5a87db1448e`，分支 main，继承未提交 T1 变更。
不能用 HEAD 单独代表当前实现；本轮读取时清单 `/tmp/lms-t2-design-source-manifest.json` 记录 1592 文件哈希及工作区状态。
执行 Node v22.23.3，不安装/升级依赖，构建输出与测试报告放临时目录，不覆盖历史 T1 归档。

## 2. 分批计划与退出条件

2026-10-24 用户批准调整范围，当前顺序和退出条件以 §11 为准，覆盖下文历史的串行前置和逐小步审批要求。
普通页面按标准模式实现并运行受影响测试；权限、幂等、审核版本及真实删除保持重点验证。
在一个可交付页面闭环完成时做综合验收，不为每个内部子步骤增加审批、独立计划或全仓冻结。

| 批次 | 主要落点及交付 | 退出条件 | 当前状态 |
| --- | --- | --- | --- |
| T2-1 | 本设计/执行记录、两项旧测试修复及状态校验 | 基线重跑、设计/测试矩阵经自查与独立评审、修复旧断言并回归 | CLOSED（2026-10-23 用户批准，含 P2） |
| T2-R（新增前置） | homework 公开只读发现、原actor显式恢复、Gateway边界 | 补充设计 T2-R-001..004 后端证据；UI/CT 层在 T2-2/4/5/6 验收，不冒称本批已完成 R005 | CLOSED（2026-10-23 用户批准，含 owner/pending P2） |
| T2-G（未完成范围后置） | 保留已接入上传/删除保护；新回收及高级恢复独立储备 | 未来启用时完成原安全验收；不作为 T2-2 至 T2-6 开发前置 | REMAINDER_DEFERRED，未验收关闭 |
| T2-2 | childApi/familyApi、familySession 与 Auth/ChildAuth/FamilyContext、completionCommandStore、useTaskCompletion | 正文冻结、存储、重试/刷新、过期/退出区分、跨标签发送身份及迟到401隔离、响应校验通过 | CLOSED（§17，限定合成工程） |
| T2-3 | privateMediaRules、集合控件/受限适配、完成媒体生命周期 | 十图/格式/大小/部分失败、删除/授权失效与异步隔离通过，原 PDF 能力不回归 | CLOSED（§17，限定合成工程） |
| T2-4 | ChildTaskPage、ChildTodayPage、ChildTaskCompletion 测试 | 完成/修改/回看/反馈/只读、版本与离页状态正确 | CLOSED（§17，限定合成工程） |
| T2-5 | TasksPage、TaskCompletionReview 测试、家长代录 | 详情审核所见版本、共管恢复、首次审计及防串孩子正确 | CLOSED（§17，限定合成工程） |
| T2-6 | T2 enabled 合成运行器、浏览器/集成测试、关闭材料 | 真正的新协议 HTTP + 页面闭环、完整回归/QA、独立评审、用户总裁决 | CLOSED（§17）；D2B-05 查询缺陷单独关闭见 §18，原失败保留；DEVICE_PENDING |

T2-1 和 T2-R 原关闭不变；T2-2 至 T2-6 依据最新明确批准关闭，证据及排除项见 §16–§17。
文档校验锁定唯一 T2 CLOSED 行、明确批准及 ENGINEERING_SYNTHETIC_ONLY 范围，拒绝漏行、矛盾状态、改绿历史失败快照或扩大设备/部署授权；T1 CLOSED 和 T3–T9 NOT_STARTED 不改变。

## 3. 可追踪测试矩阵（原计划；当前证据与后置范围见 §12）

每行是永久测试义务；参数化分支需在报告可识别。UT=单元/API，CT=组件，IT=真实服务 HTTP，UI=浏览器，D=真机。
前置权限/参数拒绝断言目标错误及零业务副作用；提交后故障断言阶段允许的持久事实与恢复元数据保留，
重放不重复版本/引用/账本且首次审计不变，不能要求合法提交后的故障“零副作用”。
例如 PREPUBLISH 失败不能发布版本；PUBLISHED_CLEANUP 丢响应可已有新版本/绑定但旧解绑待收敛；
发星丢响应可已有唯一账本而任务仍 pending；删除日志应答失败可已有墓碑/精确凭证但清理待重试。
每个故障用例分别标明注入阶段与上述预期，不只检查失败状态；高风险用例按风险做提交后故障注入/变异。

| 用例 | 批次/层级 | 步骤与关键断言 |
| --- | --- | --- |
| TC-T2-BASE-001 | 1/CT | 前端全量重现基线；核实中文来源文案与多节点查询原因；保留原测试意图后修复，不 skip |
| TC-T2-API-001 | 2/UT | 孩子/家长 complete 全部必填字段、零值、空数组、备注规范化；未知/内部/审计字段不传 |
| TC-T2-API-002 | 2/UT | confirm 带所见版本；历史版本 0 明确支持；缺失新 GET 字段不伪装版本 0；拒绝 null/非法类型 |
| TC-T2-CMD-001 | 2/UT+CT | 双击只创建一个原命令；先保存回读再发；存储不可用/配额/损坏则零 HTTP |
| TC-T2-CMD-002 | 2/CT+IT | 超时/断链/畸形 2xx/503 后重试逐字段相同且 ID 不变；pending 禁改图/版本/正文 |
| TC-T2-CMD-003 | 2/CT+UI | 页面刷新恢复同 envelope；GET 零写入；显式点击才原 PATCH；丢原命令走T2-R只读发现+显式POST，不换 UUID |
| TC-T2-CMD-004 | 2/CT+UI | 401 重登同 actor 恢复；换身份不可展示/执行他人命令；登出清 UI/存储，新会话经T2-R恢复已持久意图 |
| TC-T2-CMD-005 | 2/CT+IT | 多标签复制同命令安全重放；不同 actor/命令竞争，另一方 503 不接管；旧响应不污染新 scope |
| TC-T2-CMD-006 | 2/CT+IT | 成功旧投影重放后 GET 最新任务；GET 失败不得再次提交新命令；成功响应 task/version/集合错配保持未知 |
| TC-T2-CMD-007 | 2/CT+IT | 按设计 §4.0 状态码/错误体分类；首次400 MEDIA_ATTACHMENT_LIMIT_EXCEEDED 退出后允许用户改数量重提；503→404 RESOURCE_NOT_FOUND 清本命令后 GET；503→409 EXPIRED/ABORTED 收敛；503→403 保留；畸形404/裸错误保持未知；KEY_REUSED 不换 ID；新意图须用户确认且 GET 稳定可编辑 |
| TC-T2-CMD-008 | 2/CT | 真实 API→过期事件→Auth/ChildAuth/FamilyContext 链；401 保留原命令，显式退出清命令；不能把 expiry 误接 logout；旧请求迟到401不得清新登录的 session |
| TC-T2-CMD-009 | 2/CT+UI | A保留家长甲页面，B切同家庭家长乙；即使 storage 事件延迟，A发送时身份不符零HTTP；正常同步清旧视图；孩子身份对应场景及非完成请求的迟到401也覆盖 |
| TC-T2-MEDIA-001 | 3/UT+CT | 0/1/10/11 张、重复 ID、三种格式、HEIC/PDF、10 MiB 等于/超出边界、取消选择 |
| TC-T2-MEDIA-002 | 3/CT+UI | 第 N 张失败保留成功项，上传期间禁提交；失去上传响应不冒充绑定，无自动重复完成 |
| TC-T2-MEDIA-003 | 3/CT+IT | 移除旧作品仅提交引用变更，不 DELETE；取消/卸载/unknown 不自动删新媒体；确认前有序修改 |
| TC-T2-MEDIA-004 | 3/CT+IT | 隐私删除明确确认；confirmed/archived 仍可删；删除/日志响应丢失同 DELETE 重试，版本/审计/星星不变 |
| TC-T2-MEDIA-005 | 3/CT+UI | 删除/401/403 后立即清 DOM/URL；迟到 access 响应不复活预览；过期重授权有界、单张失败不遮蔽其余 |
| TC-T2-MEDIA-006 | 3/CT | 换孩子/任务/账号、组件卸载、重新可见时的 cache/对象 URL 生命周期；旧 finally 不改变新页面 busy |
| TC-T2-MEDIA-007 | 3/CT | 原材料/错题图片/PDF 上传预览下载用例完整保留；task_completion 无 PDF 扩展 |
| TC-T2-MEDIA-008 | G+3/IT | 原deleted cleanup不冒充孤儿回收；新T2-G对已入库丢响应孤儿安全回收，引用/本地意图受保护；已知ID显式删除及GC竞态通过，fixture teardown不替代产品证据 |
| TC-T2-CHILD-001 | 4/CT+UI | 五维任务 completed/confirmed 可进入详情；已绑定作品刷新找回、反馈可看、无作品与不可用占位区分 |
| TC-T2-CHILD-002 | 4/CT+IT | pending/completed 可提交，confirmed/cancelled/archived 不可编辑完成；隐私删除独立于冻结 |
| TC-T2-CHILD-003 | 4/CT | 原自评初始化、空清单/版本0、勾选版本与当前快照一致；409 刷新重审，无隐藏新命令 |
| TC-T2-CHILD-004 | 4/CT | 切任务/身份时加载及变更响应乱序，旧 task/错误/busy 不进入新页面；错误可操作且不无限 loading |
| TC-T2-PARENT-001 | 5/CT+IT | 从列表打开后重新 GET 详情、看图；confirm 使用所见版本而非最新偷偷替换；并发孩子更新返回409 |
| TC-T2-PARENT-002 | 5/CT+IT | 两位家长及同版本重试不重复发星；首次人/时间/反馈保留，重试新反馈不冒称已保存 |
| TC-T2-PARENT-003 | 5/CT+IT | STAR_AWARD_PENDING 后 GET 分别为引用稳定的completed（无首次审计）、confirmed/pending、confirmed/awarded、失败；不由503推断已确认或到账；MEDIA_REFERENCE_PENDING+completed/pending_recovery 转原完成恢复/只读而非重复确认，旧材料pending走原材料流程；稳定后重读核对版本；确认不新增 operationId、不增版本 |
| TC-T2-PARENT-004 | 5/CT+IT | 家长代录完整新命令、真实 actor 审计；历史 completed 版本0确认；孩子不能确认 |
| TC-T2-PARENT-005 | 5/CT | 切孩子时审核/代录表单及旧异步结果清除；详情加载失败/不可用媒体不得伪称看过作品 |
| TC-T2-E2E-001 | 6/IT+UI | 明确 enabled 正式工厂+真实 Gateway，上传→完成→确认→回看；任务/引用/唯一星星账本与页面一致 |
| TC-T2-E2E-002 | 6/IT+UI | 公开/远程提交后丢响应、刷新原 PATCH、终态重放与旧代次解绑；无重复版本/引用/账本 |
| TC-T2-E2E-003 | 6/IT+UI | 兄弟姐妹/跨家庭/离家家长拒绝；UI 切换隔离，后端仍是权限权威；内部凭据不暴露 |
| TC-T2-E2E-004 | 6/IT+UI | 删除确认作品并回看占位，旧内容 URL 拒绝；教学状态、首次确认与账本不变 |
| TC-T2-COMPAT-001 | 6/IT | 旧 complete/confirm 仍 CLIENT_UPGRADE_REQUIRED，错误后无旧请求 fallback；默认配置唯一且关闭 |
| TC-T2-COMPAT-002 | 6/IT+UI | 原 Task11/12 回归路径明确装配版本，保留旧协议后端用例；不得旧 router 忽略新字段后伪绿 |
| TC-T2-QA-001 | 6/UI | 四种视口非空、无遮挡/横向溢出、键盘焦点/滚动/触控、完整图查看、控制台无未解释错误 |
| TC-SL-IPAD-001..004 | D/单独授权 | 沿系统设计原四用例验收；未执行 DEVICE_PENDING，不以 accept/模拟截图或错误提示代替真机可用路径 |

## 4. 执行命令与证据规则

前端全量：`CI=true npm run test:ci --prefix frontend/web -- --runInBand --json --outputFile=/tmp/<unique>.json`。
前端构建：`CI=true BUILD_PATH=/tmp/<unique-build> npm run build --prefix frontend/web`。
文档：`npm run docs:family:check`、修改文档的路径/围栏/状态核对和 `git diff --check`。
后端：沿用 `npm run test:family-regression`，每批可先定向，T2-6 在冻结候选上完成全量及前端全量/构建。
T2 正式 HTTP 使用 `npm run test:t2:integration`；浏览器使用 `T2_WEB_BUILD=/tmp/<build> npm run test:t2:e2e`，必须先构建。
浏览器默认单 worker、retries=0；仅在 macOS 沙箱不允许启动 Chromium 时申请本地浏览器权限，不更改产品权限。
截图/trace/报告只含合成数据，归档前脱敏；不保存真实学习内容/Token/访问URL。不覆盖旧文件，不能以定向通过代替全量通过。

## 5. 目标条款与交付对应

| 目标条款 | 交付/证据位置 |
| --- | --- |
| 1–5 | §1 基线/清单、本执行记录与 AGENTS 模式/工作树保护 |
| 6–10 | 详细设计 §1、§3、§7；API/MEDIA/COMPAT 用例 |
| 11–17 | §2 每批流程和 §7 问题闭环；自查、独立评审与用户批准分别记录 |
| 18–19 | T2-1 基线、设计、旧断言修复；未获批准不进入编码 |
| 20–23 | T2-2 / API、CMD；存储/退出恢复边界须用户批准 |
| 24–26 | T2-3 / MEDIA；移除与隐私删除区别 |
| 27–28 | T2-4 / CHILD；保留五维适用性 |
| 29–30 | T2-5 / PARENT；版本确认/共管/首次审计 |
| 31–32 | T2-6 / E2E、COMPAT；正式 enabled HTTP 持久事实 |
| 33–38 | §3–§4 分层验证/QA/设备与版本证据 |
| 39–44 | §6–§7 批次状态、失败保留、总审批准和禁止越界 |

## 6. T2-1 设计准备证据

本节及 §7 保留批准前的历史过程与失败证据，不代表当前状态；最新设计批准和批次验收见 §8。

2026-10-23 重跑结果（Node v22.23.3，未安装或升级依赖）：

| 验证 | 实际命令（均在仓库根执行） | 结果 |
| --- | --- | --- |
| 前端全量 | `CI=true npm run test:ci --prefix frontend/web -- --runInBand --json --outputFile=/tmp/lms-t2-design-baseline.json` | exit 1；27/29 suites、181/183 tests，2 failed、0 pending；17.676 s |
| 前端构建 | `CI=true BUILD_PATH=/tmp/lms-t2-design-build npm run build --prefix frontend/web` | exit 0，Compiled successfully；Browserslist 数据陈旧警告保留，未升级依赖 |
| 文档基线 | `npm run docs:family:check` | exit 0；23 baseline / 4 self-directed documents、388 contract fixture cases |

上述命令均使用 `/tmp/lms-node22-cache/_npx/52027bd8fc0022aa/node_modules/node/bin` 作为 PATH 首项。
原始报告名为 `lms-t2-design-baseline.json`、`lms-t2-design-baseline.log`、`lms-t2-design-build.log`、
`lms-t2-design-baseline-docs.log`；原始临时文件保留，持久归档目录为 `release-gate-artifacts/t2-design-2026-10-23/`。

两项失败均已对照当前组件核实，尚未修复：
- `ChildTodayTasks.test.js` 的来源断言寻找 `mistakes`，`FamilyDataState` 当前输出为“错题数据”。
  批准后改为可访问区域内的实际来源标签，仍断言任务失败不影响已有提醒展示。
- `Task9ReportsRemindersRewards.test.js` 的文本查询同时匹配标题与段落；批准后按 heading 角色限定。
  同一用例下一条 `mistakes` 断言也已过时，须一并核实修订，保留免打扰设置嵌套请求断言，
  不能只修首个失败点便宣称该用例完整通过。

设计编辑前对初始 1592 个文件逐项 SHA-256 对照，全部未变化。后续只编辑本设计、执行记录和开发文档导航；
未修改前端、后端、配置或测试实现。原 T1 归档不覆盖，未提交工作树保留。
此处前端失败是当前未通过的基线，不是 T2 新实现验证；后端业务全量、浏览器及真机 QA 本轮未执行。
独立设计评审结果和修订在 §7 追加，不能用自查代替独立结论。

## 7. 设计审查与批准

设计自查（初稿）：接口沿用 T1、写入前保存原命令、GET 无副作用、完整 scope、媒体未知不自动删除、
确认首次审计/发星恢复、真实设备与合成范围已逐项说明。重点提交独立评审：退出后的恢复限制是否可接受、
错误终态判定是否足够精确、媒体异步竞态与旧 E2E 接线是否存在遗漏。
独立评审：已完成首轮及修订复核，设计层结论见 §7.1。用户设计批准：PENDING。
设计审查不等于功能 QA 或实现通过；T2-1 及 T2 总门禁未关闭。

### 7.1 首轮独立设计评审及修订

评审者 Boyle（独立子代理），只读核对设计、API 和实现，未执行测试；结论为修订后再批准。
以下是设计问题，不是未实施的 T2 代码回归。本轮仅修订文档；独立复核已完成，用户裁决仍待定。

| 编号 | 严重度/根因 | 修订及保护 | 当前结论 |
| --- | --- | --- | --- |
| D01 | P1：错误假定 active 孤儿已有回收 | 原文已纠错；用户要求T2-G补安全回收，新增双服务设计/测试 | 补充设计评审中，实现验收前未关闭 |
| D02 | P1：过期与退出共用 logout | §4.2 纳入 session/上下文事件原因；CMD-008 测实际事件链 | 独立复核确认设计修订有效，实现待批准后验证 |
| D03 | P1：共享 token 跨标签变化/迟到401 | §4.2 请求身份快照、发送核对、跨标签同步及条件失效；CMD-009 | 独立复核确认设计修订有效，实现待批准后验证 |
| D04 | P2：STAR_AWARD_PENDING 误推已确认 | §6 增加确认状态机/GET 三状态及未知；补媒体阻断转原完成/材料恢复，PARENT-003 保护 | 最终独立复核确认设计闭环，实现待批准后验证 |
| D05 | P2：公开稳定失败分类含糊 | §4.0 明确错误/存储分类；补首次 MEDIA_ATTACHMENT_LIMIT_EXCEEDED 拒绝；CMD-007 | 最终独立复核确认设计闭环，实现待批准后验证 |
| D06 | P2：错误要求所有负向测试零副作用 | §3 分前置拒绝与提交后阶段事实，保留版本/引用/账本/凭证/首次审计断言 | 独立复核确认设计修订有效，实现待批准后验证 |

历史待裁决项已于2026-10-23获用户方向回复：两项均先补设计，不接受原限制默认交付。
补充设计尚未获批准，D01 实际缺口仍未关闭；其他原设计复核结论不构成对新增协议的背书。

2026-10-23 最终独立复核：D02/D03/D06 在第一轮修订复核确认有效，D04/D05 补充分支后再次核实闭环；
没有发现这些修订引入新的设计问题。D01 仅纠正了文档事实，实际缺口与两项用户裁决保持开放。
自查另核对了 CLIENT_UPGRADE_REQUIRED=400、前端原提醒测试的第二处过时来源断言、
T1 默认关闭/旧客户端拒绝边界与当前批准状态，未触发任何业务代码修改。

### 7.2 设计包校验与下一步

文档门禁及 `git diff --check` 通过；三份本轮文档的 68 个本地链接目标和围栏检查通过，
设计引用的 API §14.2 与系统设计 §8.2 锚点已对照标题核对。新增详细设计/执行记录不在原门禁固定文档列表内，
上述局部结构/路径检查为补充，不冒称它们已有完整自动契约测试。
对初始 1592 文件复核，仅开发导航 README 改变；新增两份设计文档，不改变既有前后端或测试实现。
首轮文档快照、初始清单、基线报告及校验结果归档在 `release-gate-artifacts/t2-design-2026-10-23/`，
`design-artifacts.json` 记录最终设计快照与证据 SHA-256；历史 T1 归档保留。

下一步先完成新增恢复/回收设计独立评审并取得用户批准，再修复旧断言、执行相关回归并提交 T2-1 批次复审。
尚未进行编码、实现独立评审、浏览器 QA、真实设备验收或 T2 总门禁关闭；不提交、不推送、不部署。

### 7.3 用户要求补充恢复/回收设计

用户答复原文：“先补充退出后恢复设计，再编码”“先补充安全回收设计，再实施媒体批次”。
已新增补充设计 §2 公开恢复、§3–5 双服务屏障/回收/历史/回滚、§6 15条新增验收用例。
新增后端前置不重开 T1 历史关闭结论，也不能把新模型/端点记录为已实现。
独立评审完成：补充设计 §7.1 记录 E01–E05 及修订复核，均为设计层通过，15条新增用例待实现验证。
原D01安全回收和已核实的上传未知结果误删代码风险均未因设计通过而关闭。
用户设计批准 PENDING，未开始编码；执行顺序为 T2-1 基线修复及批次复审 → T2-R → T2-G → 原T2-2至T2-6。
旧归档保持不变；新文档/复核结果/校验归档位于 `release-gate-artifacts/t2-recovery-retention-design-2026-10-23/`。
本次文档门禁、差异检查及7份文档166个本地链接目标/围栏检查通过；相对初始源清单只改变文档，未修改业务代码/测试/配置。
未重复跑前后端业务测试、构建或浏览器QA；本次只有设计/文档证据，原前端基线失败仍按§6保留。

## 8. T2-1 基线修复与批次验收（2026-10-23）

### 8.1 授权与范围

用户批准原设计与补充设计，包括新增接口、模型、专用凭据、24 小时保留期、默认每批 50 个参数。
仅授权本轮完成 T2-1 基线修复、补测、自查和独立评审后提交批次验收；不开始 T2-R/T2-G 或后续页面能力。
T2 总状态 IN_PROGRESS / OPEN，T1 CLOSED、T3–T9 NOT_STARTED；仅合成环境，不部署、不提交或推送 Git。
设计批准不等于实现缺口关闭：原 D01、E04 及补充设计验收义务留待后续批次实现验证。

### 8.2 根因与最小修订

- `ChildTodayTasks` 原断言期待原始 `mistakes`，实际组件已显示中文“错题数据”。改为来源列表内定位并断言恰有一个来源，
  保留任务稳定错误、可用提醒仍可见、无无效重试按钮等原断言。
- `Task9ReportsRemindersRewards` 原全文查询同时命中标题和正文，改为二级 heading；来源列表也校正为中文并断言数量。
  保留开始/结束时间实际输入、保存操作和嵌套 `quietHours` 请求断言；不改页面、API、重试/超时配置或测试发现范围。
- 文档状态按批准同步；校验器仅允许当前表中的唯一 T2 IN_PROGRESS 行，T3–T9 仍为 NOT_STARTED。
  原提前关闭负向用例更新为新状态；新增 12 条反例：未启动、缺行、重复行、前/后矛盾行，以及 T3–T9 各自未授权启动。
  没有靠历史记录中的状态词补足当前表，没有删除旧测试或跳过失败用例。

### 8.3 实测证据

所有命令使用 Node v22.23.3；报告与构建产物不含真实家庭数据。

| 验证 | 命令/条件 | 结果 |
| --- | --- | --- |
| 修复前定向复现 | `CI=true npm run test:ci --prefix frontend/web -- --runInBand --watchAll=false --testPathPattern='ChildTodayTasks\|Task9ReportsRemindersRewards'` | exit 1；2 suites 失败，14 passed / 2 failed，原失败保留 |
| 门禁先红 | 新状态与负向用例先落地，校验器尚为旧规则；下述 Jest 命令 | exit 1；21 passed / 8 failed，确认旧规则不能处理批准后的状态 |
| 前端全量 | `CI=true npm run test:ci --prefix frontend/web -- --runInBand` | exit 0；29/29 suites、183/183 tests，零失败/跳过 |
| 文档门禁回归 | `node node_modules/jest/bin/jest.js --config=backend/jest.config.js --coverage=false --selectProjects family-common --runInBand --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js` | 首轮 exit 0；1/1 suite、29/29 tests；P2 补测结果见 §8.5 |
| 前端构建 | `CI=true BUILD_PATH=/tmp/lms-t2-1-build npm run build --prefix frontend/web` | exit 0；保留 caniuse-lite 数据陈旧告警，不升级依赖 |
| 文档审计 | `npm run docs:family:check` | exit 0；388 contract fixture cases、38 requirements |
| 格式与变更范围 | `git diff --check`；相对本批前 1595 文件哈希清单核对 | 格式通过；仅 2 前端测试、1 门禁测试、1 校验脚本及 8 文档变化，无业务代码/默认配置变化 |

原设计阶段 27/29 suites、181/183 tests 的全量失败报告及两轮设计归档完整保留；本轮定向红/绿报告另行归档。
本批不修改 UI 行为，不把组件测试当作浏览器或 iPad 实测；后端业务全量、真实 HTTP E2E、浏览器和真机 QA 未执行，留待相应批次。

### 8.4 自查、独立评审与裁决

自查：原 183 个前端测试保留，未新增 skip/only 或放宽运行范围；两处定位限定语义角色而非选首个匹配。
当前 T2 状态校验与历史 T1 关闭保护同时有效；新增端点仍未实现，不改部署默认值或旧客户端升级拒绝。
独立评审：Boyle 首轮发现 T2 空白变体行漏计 P2，修订后独立复核通过，已审范围无剩余确证问题，详见 §8.5；未将首轮记录改成无问题通过。
用户批次验收：PENDING；不得把本次设计批准当作 T2-1 或 T2 总门禁关闭。
下一批为 T2-R，须在本批复审/验收后另行开始。

回滚本批仅需逆向恢复上述 12 个文件的本批差异；保留继承的 T1 修改和历史失败归档，禁止整体重置工作区。
本批无业务 schema、真实数据或运行配置变化，不需要数据迁移/恢复操作。

### 8.5 独立评审 P2：Markdown 空白变体状态行

根因：`/^\| T2 \|.*$/gm` 只识别精确空格，正常行后增加 `| T2  | CLOSED |` 会漏计，无法保障承诺的唯一状态行。
修订：仍只读取当前执行状态表，先逐行解析单元格并 `trim()`，按任务标识统计，再要求唯一 T2 且状态为 IN_PROGRESS。
新增四个永久负向用例覆盖空白重复、tab 前置冲突、空白后置冲突及单行空白 CLOSED；新增一个合法空白正向用例。
先红报告 `p2-red.json/.log`：exit 1，30 passed / 4 failed；三种重复/冲突漏检与合法行被误拒均有效复现，单行 CLOSED 原规则已能拒绝。
仅修复本批 T2 新保护；既有 T3–T9 测试只覆盖单行状态替换，不宣称已覆盖这些任务的重复/冲突行，另行改进不混入本批。
第一轮修订报告 `p2-green.json/.log` 实际 exit 1，33 passed / 1 failed，不能因文件名含 green 冒称通过。
合法空白正向揭示前置任务存在性检查仍用精确字符串；现改为复用当前表的规范化单元格，避免第二套识别规则。
最终 `p2-final.json/.log`：exit 0，34/34 tests，零失败/跳过。Boyle 独立复核通过并对最新脚本重跑 34/34（exit 0），
确认存在性、唯一性和状态复用当前表的规范化解析，修订范围无新问题。P2 工程修复及独立复核完成，连同本批提交用户验收，不自行标记用户验收 CLOSED。

本轮原始报告、12 文件修订前后快照、独立评审结论及 SHA-256 清单另存于
`release-gate-artifacts/t2-1-baseline-2026-10-23/`；`artifacts.json` 可逐项验证，不覆盖原设计/T1 归档。

### 8.6 用户批准关闭 T2-1

2026-10-23 用户答复“批准 T2-1，进入 T2-R”，确认本批及独立评审 P2 验收通过。
§8.1–8.5 为提交验收时记录，原归档不改；T2-1 CLOSED，T2 总门禁保持 OPEN。

## 9. T2-R 公开恢复接口实施

用户已批准本批，沿用补充设计 §2，不新增产品取舍。只在 enabled 正式组合装配三个接口，默认模式不变。
顺序：真实 HTTP 失败测试 → 复用本地意图校验/恢复 → 只读分页发现和实时权限 → 回归、自查、独立评审与批次验收。
验证 R001–004 的后端层：跨日发现、原 actor、完整映射、无写 GET、租约/删除、历史终态、丢响应和精确代次。
R001/002/004 的浏览器/组件层及 R005 保留到前端批次，不以本批 HTTP 证据替代。
风险控制：只公开原 operationId，不公开远程标识/正文；不换 UUID、接管 owner 或恢复材料；拒绝身份/正文覆盖。
回滚撤销本批路由装配与服务增量，保留 T1 原协议、持久命令/映射/凭证；不做数据迁移或删除，不切回旧协议写入。
仅合成环境验证，不部署、不提交、不推送；T2-G 未开始，本批及总门禁待验收。

### 9.1 实现与用例关联

- `growthTaskCompletionService` 新增 `discoverRecovery` / `listRecoveries`，仅在快照事务读取；`recover` 增加空输入校验与完整 actor scope 不存在时的 404。
- `growthTaskCompletionRecovery` 负责认证、no-store 和响应转发；正式组合在通用详情路由前挂载，Gateway 复用原受保护代理，不增加内部公开入口。
- 原完成/确认/媒体状态机、部署控制键和前端保持不变；未新增模型、索引、凭据或清理逻辑，这些属于 T2-G。

| 用例组 | 本批真实 HTTP/持久事实证据 | 后续责任 |
| --- | --- | --- |
| T2-R-001 | 跨日默认列表及稳定分页；BSON 重建后新 Gateway 无原 body 恢复；原映射/hash/作品集合、目标版本持久不变 | 新浏览器 UI 登录/待恢复入口在 T2-2/4/5/6 |
| T2-R-002 | GET 前后全部相关集合相同、远程/发星调用不变；other_actor 不泄露标识；同家庭其他家长恢复404；兄弟姐妹/跨家庭/离家家长/失效孩子token/匿名拒绝；额外scope查询拒绝；legacy/maintenance隔离 | 组件状态与身份切换的界面行为留前端批次 |
| T2-R-003 | PREPUBLISH/PUBLISHED_CLEANUP；prepare/commit/unbind成功后丢应答；POST成功后公开丢应答；租约终态稳定重放；隐私删除后精确凭证恢复；旧绑定代次、账本和首次删除证据不变 | 浏览器断网/刷新和完整 UI 闭环留 T2-6 |
| T2-R-004 | 同 UUID 不同 actor 独立映射；A历史终态不推进B活动/稳定状态；未知命令404；正文/版本/远程标识覆盖拒绝；缺owner/账本/hash/集合/映射损坏503；无权限优先于参数校验 | 畸形响应与页面解锁策略留 T2-2/4/5 |
| T2-R-005 | 本批不实施 UI，也不以 HTTP 覆盖该项 | 迟到401、不自动POST、成功历史投影后GET及confirm恢复归属留前端批次 |

38 项新增 HTTP 用例均使用 T2-R 编号；原正式组合 68 项、原服务 65 项完整保留，合计两套件 171 项。
合成运行器使用正式 Gateway/homework/resource/progress 工厂、回环 HTTP、临时副本集、临时媒体与日志；未使用全 mock 替代跨服务证明。

### 9.2 失败、自查与独立评审

1. 先添加 22 项真实 HTTP 用例，未实现入口时定向运行：13 failed / 9 passed，另68项因过滤未运行，exit 1。
   部分拒绝用例原有404/参数路由已拒绝，不将它们的先红通过当作新接口已存在；正向/完整恢复和错误契约实际失败。
2. 首轮实现后 21 passed / 1 failed，exit 1：失效孩子 token 的测试预期误写403，既有 `authenticateGateway` 正确返回401 `STALE_CHILD_TOKEN`。
   核对实现后修订为既有稳定契约，并增加错误码断言；没有改变鉴权实现或把历史401稳定性缺陷重新打开。
3. 扩展33项后 32 passed / 1 failed，exit 1：自查 P2，owner/pending 同时丢失且任务投影 stable 时发现误报 none、列表漏项。
   补查同scope非终态账本；分页在同服务同scope只读lookup纳入孤立账本，统一核验 owner/阶段/hash/集合；不修库、不自动续租或释放锁。
   永久反例同时断言单任务/列表503、数据库及远程调用无变化。修订后原33项及旧回归通过，再加5项边界测试。
4. 自查核对空对象与数组body、查询白名单、安全分页、授权优先、历史终态、旧 pending 不接管、默认关闭和回滚边界。
   相对本批前文件清单核对，不覆盖继承 T1/T2-1 修改；未修改前端或部署配置。
5. 独立评审者 Boyle 只读复核本批差异，独立重跑新增38项通过，确认自查P2有效修复，已审后端范围无剩余确证问题。
   独立评审不代替用户批准；当时完整家庭回归未结束，最终结果见 §9.3，不追改独立评审当时的证据范围。

### 9.3 验证命令与证据

Node v22.23.3，固定现有依赖；报告放 `/tmp/lms-t2-r-*` 后归档，不覆盖以前各批记录。

```sh
node node_modules/jest/bin/jest.js --config=backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js backend/services/homework-service/__tests__/services/growthTaskCompletionService.test.js --json --outputFile=/tmp/lms-t2-r-regression-final.json
npm run test:family-regression -- --json --outputFile=/tmp/lms-t2-r-family.json
npm run docs:family:check
git diff --check
```

定向最终：exit 0，2/2 suites、171/171 tests，零失败/跳过；此前33项增量的两套件回归166/166也保留。
前三次失败使用 `--testNamePattern=T2-R`，未执行的68项明确为定向筛选，不是删除/skip；最终定向两套件无筛选。
文档审计、两份新增/修改运行时代码 `node --check`、差异检查通过。
完整家庭回归实际完成：exit 0，118/118 suites、2459/2459 tests，零失败/跳过，347.521秒；不含 legacy 隔离项目，不冒称全仓所有历史测试。
未修改前端，本批不重跑前端全量/构建或浏览器，不借用 T2-1 的结果宣称本批 UI 已通过；真机 DEVICE_PENDING。

### 9.4 批次裁决与归档

本批后端实现、回归、自查及独立评审完成，READY_FOR_REVIEW / PENDING_USER_ACCEPTANCE；自审 P2 工程修复及复核完成，随本批验收。
Boyle 最终只读核对完整家庭报告与 §9/Gate §20 一致，无验证范围夸大或状态冲突；其未重复执行全量，独立执行证据为38项定向复跑。
归档 `release-gate-artifacts/t2-r-recovery-2026-10-23/` 包含原始红/绿/全量报告、独立评审记录、本批前后快照及 `artifacts.json` 哈希清单。
仅变更三个运行时文件（其中一个新路由）、一个既有 HTTP 测试文件及八份文档；T1/T2-1 历史档案和无关工作区修改保留。
默认关闭、旧客户端升级拒绝、真实部署未授权和无 Git 发布保持；T2 总门禁 OPEN。用户批准本批后再进入 T2-G，不自行推进。

### 9.5 用户验收与复审确认

2026-10-23 用户答复“批准 T2-R，进入 T2-G”，批准本批后端及 owner/pending 丢失 P2 修复。
本轮复审实际重跑两套件 171 项全部通过、零失败/跳过，文档门禁通过；40 个归档文件和12个当前文件哈希匹配。
复审报告 `/tmp/lms-t2-r-review-regression.json`、`/tmp/lms-t2-r-review-docs.log`；原不可变归档保留。
T2-R 后端标记 CLOSED；不包含 R005/前端交互，不关闭 T2 总门禁。

## 10. T2-G 孤儿媒体安全回收实施

用户已授权按补充设计 §3–6 实施，仅合成环境；不部署、不提交、不推送。
复用本工作区，基线快照 `/tmp/lms-t2-g-before/`；不改写任何历史证据。

| 增量 | 内容与验证 | 状态 |
| --- | --- | --- |
| G-A | 上传固定身份/删除终态 UploadGuard、homework 使用屏障；事务竞争、scope、未知结果和专用凭据负向测试 | 独立复核通过；正式装配仍属 G-C |
| G-B | resource 回收、系统 journal、普通清理排除与删除分派；整组证据、物理删除顺序、失败重试 | 限定实现独立复核通过；最终组合仍属 G-C |
| G-C | 历史预检、显式 CLI、备份重建组合；默认关闭、部分失败、跨代次恢复与端到端证据 | IN_PROGRESS |

每个增量测试先行、自查和独立评审，最后统一提交 T2-G 用户验收；不额外增加内部增量审批点。
回滚保持原默认关闭；写入 retired 后保留 guard/retirement/journal 和兼容恢复，只能前向修复，不能退回无屏障 writer。
旧无 policy 资产不自动登记或删除；本轮仅合成历史夹具。T2-G 尚未验收，不关闭 D01 或任何未证实的上传缺陷。

### 10.1 G-A 自查与独立评审

Boyle 独立复核 homework 屏障：首轮发现活动账本尚存但任务 owner/pending 丢失时可能错误授予退休（P1）。
已在同一事务交叉核验任务与全部非终态账本，损坏返回503并回滚guard；补充已有/缺失guard、反向孤立任务意图、
真实事务重叠及11000首次插入竞争。定向三套件210项通过；Boyle 独立重跑同范围通过并确认修复。

Popper 独立复核 resource 上传：修复历史大写storageKey被新guard拒绝（P2）、缺省scan状态在JSON丢失导致日志不可恢复（P2）。
自查补充 BSON身份归一、REGISTERED缺资产隔离、终态先于正文读取、迟到提交响应重读，以及可选mediaService adapter
不进入旧的未知结果删文件补偿路径。新增scope撤销、独立RETIRED证据、真实guard竞争、隐私回滚和日志权限/符号链接反例。
共享事务runner显式指定primary/snapshot/majority：新增测试先红（配置undefined），修复后四套件114项通过。
Popper 独立复核以上变更通过，另重跑引用协议92项通过；此为合成单节点副本集，不冒称多节点故障切换或掉电演练。

日志fsync的文件/发布目录/父目录失败与等待用例完成，六项逐处删除fsync或await的隔离变异均被断言捕获。
变异仅改/tmp副本；初版变异出现file closed的失败日志也保留，最终版本用同步等待断言明确识别，不以未处理异常作为证据。

证据暂存：`/tmp/lms-t2-g-guard-*`、`/tmp/lms-t2-g-homework-*`、`/tmp/lms-t2-g-upload-*`。
首次家庭回归120套件/2514项通过对应`/tmp/lms-t2-g-increment-a-tested/source.json`快照，
早于上述资源评审补强，不能当作最新源码全量证据；G-B/C后须重新执行最终家庭回归并归档。
初期模块缺失是测试脚手架红测；safety首次18项失败为家庭fixture未包含owner，修正后有效红测3项失败才用于证明产品缺口。
本节不关闭整个T2-G，不宣称系统回收、启用预检或正式server组合已完成。

### 10.2 G-B 自查与独立评审

实现完整 ABORTED 历史证据与系统 journal、CANDIDATE/FENCED/DELETED/PURGED 恢复、普通清理排除、
公开删除分派及 UploadGuard 终态优先。系统删除不生成用户墓碑或精确解绑凭证，不改首次用户删除审计。
独立评审发现两个 P2：用户删除先提交后 CANDIDATE 被远程 in_use 阻塞，以及公开删除分类读取与系统提交竞争。
前者在远程调用前重查真实用户墓碑并 SUPERSEDED；后者只对特定 MEDIA_OPERATION_INCONSISTENT 做一次重新分类，
重新实时鉴权，不对任意409回退。保留完整证据校验及原操作标识。

自查补强合法迟到、从未 PREPARED 的 ABORTED 账本兼容；原日志中每条完整账本必须仍精确存在，
新增账本必须 version=0、合法失败码、不早于删除且整组无代次引用，不能替代历史证据。
系统证据另保留固定 uploadMetadataHash，供旧备份重建同一 UploadGuard，不从缺失元数据猜造资产。

Popper 独立复核 runtime/client/journal 通过，独立154项通过；后续主线程定向44项和真实HTTP4项共48项通过。
HTTP丢响应在真实 homework retired 事务提交后销毁连接，验证同 retirementId 接续；不等于正式启动验收。
三项移除 journal/remove/directory-sync await 的隔离变异均由相应同步等待断言捕获，原源码未作变异。
历史红测、首次HTTP fixture空值断言失败、storageKey大小写失败均保留，不用重跑覆盖失败。

### 10.3 G-C 实施与只读契约批准

2026-10-23 用户追加批准 `POST /api/internal/completion-media-retirements/status`：同专用凭据、四字段身份，
同一只读事务返回 absent/available/retired；仅精确同 retirementId 的 retired 可证明跨服务屏障，
缺失/available不等于许可，异退休ID返回409。预检不得调用写退休接口，也不增加浏览器访问。

G-C 实施中：分服务只读预检、受保护子目录探针、显式回收CLI、默认关闭/旧writer拒绝、
合成历史登记及旧备份恢复。restore helper 的61项由Popper独立复跑通过；远端 in_use 时返回
RESOURCE_RESTORED_PENDING_HOMEWORK，要求原actor恢复，任何helper结果均不自行声明 ready。
正式装配及跨服务最终恢复/全量验收尚在进行；不得把上述局部结果当作 T2-G 用户验收。

独立组合审查复现并修订三项 P2：REGISTERED guard 缺资产仍被当就绪、严格预检阻断缺日志后的显式恢复、
以及重建 guard 缺时间字段不符合预检契约。新 guard 记录真实重建时刻，原删除事实和已有 guard 时间不变。
生产预检保持严格；显式 recovery 仅接受证据完整的 DELETED 缺日志、待 SUPERSEDED 两类过渡状态，仍拒绝冲突/损坏日志。
额外 P2 为长期 in_use 前缀饥饿，采用资产上的持久轮转时间；每批仍默认50/上限100，不输出媒体ID、不改保留期或首次审计。
修复须经最终独立复核及固定源码回归，本段不单独关闭问题。

### 10.4 尚未关闭的用户删除日志恢复契约

自查核对 `mediaDeletionEvidence.js` 与既有 T1 journal 后确认：旧用户删除日志仅有 tombstone 和目标媒体 receipts，
没有系统回收日志所持有的完整 ABORTED operation 组、原 scope/hash/集合/终态，以及固定 UploadGuard 摘要。
因此现有系统 restore helper 与新用户删除事务写 guard，并不能证明“用户删除前旧备份 + 外部用户日志”安全恢复闭环。
不得把系统 helper 的 G007 通过结论扩大到该路径，不能从缺失证据猜造旧终态、元数据或首次审计。

用户已答复“先补充设计并评审，再实施用户删除恢复”。已起草
[用户删除恢复补充设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-user-deletion-recovery-design.md)，
本轮已完成独立设计评审及修订复核；随后用户明确“批准设计，按计划分批实施”，授权新增模型、日志、helper及容量。
当前实施分批按§10.7推进，旧日志不改写，
旧证据不足时继续隔离/拒绝自动恢复。此项阻止整个 T2-G 及 D01 提前验收关闭；已实现范围可分别验证和归档，
但不能跳过本项进入依赖完整回收/恢复能力的媒体批次。T2 总门禁仍 OPEN。

### 10.5 G-C 固定源码验证检查点（非批次验收）

当前实现追加两项 P2 修复：完整用户证据的 CANDIDATE/FENCED 收敛不再要求远端 status 在线；
持久轮转时间推进到整个候选集合最大值之后，避免时钟回拨使后续候选永久饥饿。
真正系统 FENCED/DELETED/PURGED 的远端精确 retired 预检仍严格，不把恢复资格等同生产就绪。
HTTP离线组合12项通过；轮转真实CLI进程12项通过，包含无asset的SUPERSEDED混合候选、日期类型/越界/上限零写。
前者 `/tmp/lms-t2-g-offline-http-green.json`；后者 `/tmp/lms-t2-g-fairness-clock-frozen.json`。
轮转初红7失败/4通过及中间Invalid Date快照比较失败保留，最终采用原始BSON快照验证无写，不覆盖原报告。

最终非文档源码冻结在 `/tmp/lms-t2-g-tested-source.json`，1156项非文档文件验证前后SHA-256无漂移。
Node22执行 `npm run test:family-regression -- --json --outputFile=/tmp/lms-t2-g-family-frozen.json`，
exit 0；134/134 suites、3143/3143 tests，零失败/跳过，523.724秒。仅8个家庭项目，不冒称legacy或前端全量。
此前配置定向两套件108项通过，family/ubuntu Compose各三种合成变量场景共6次config-q和6次实际值校验通过；
默认关闭/专用凭据注入范围保留，未启动或部署Compose服务。最终文档门禁与差异格式检查通过。
Popper 最终只读复核源码、测试和报告哈希，确认上述两项P2修复及保护有效，限定范围未发现新增确证问题；
该次未启动Mongo或重复执行测试，不冒充独立重跑。记录 `/tmp/lms-t2-g-checkpoint-review.md`。
首次G-C组合全量130通过/2失败套件、3086通过/2失败测试，报告
`/tmp/lms-t2-g-family-integration-first.json`：新guard预检缺测试mock与缺journal恢复被严格入口拦截，
均已定向修复；该轮与实施交叠，不作为冻结源码最终通过证据。
用户删除恢复设计、旧日志不足和真机DEVICE_PENDING仍是明确未完成项。
不可变归档 `release-gate-artifacts/t2-g-checkpoint-2026-10-23/` 保存本轮检查点源码/原始红绿报告/变异/独立复核和哈希清单，
不替代T2-G用户验收。基线未收录的4份根Compose/env文件在scope清单标明beforeUnavailable，不冒称完整前态快照。

### 10.6 用户删除恢复补充设计评审

历史设计评审阶段为NOT_STARTED / PENDING_USER_APPROVAL；2026-10-23用户随后批准，最新实施状态见§10.7。
Dalton首轮发现三项P2设计缺口：历史ABORTED没有本次before的重放规则、同组不同版本删除日志的依赖顺序、
outbox原_id和创建时间的文件证据不足。修订为完整历史终态断言、单目标逆序零写pending与有界依赖链、
显式UUID主键evidenceId及evidenceCreatedAt；UDR-006/007/009补对应验收条件。
第二轮独立复核三项在设计层闭合，限定范围无新增确证阻断。测试清单尚未执行，不作运行时通过承诺。
新增证据/容量参数已获用户批准；细分实施、测试、自查、独立代码/QA评审和批次验收按§10.7推进。

### 10.7 用户删除恢复实施

用户2026-10-23答复“批准设计，按计划分批实施”；[细分计划](../superpowers/plans/2026-10-23-t2-user-deletion-recovery.md)。
A证据模型/纯校验内部增量COMPLETE：定向修订、独立复核及固定源码家庭回归通过（非T2-G用户批次验收）；
B日志/删除事务、C受控恢复、D只读预检/装配、E组合验收NOT_STARTED。
本轮A不接入server/用户删除/cleanup，不自动创建真实集合或目录；仅合成验证，不Git发布。
既有检查点归档保持不变，T2-G/D01/T2仍OPEN；不得将A通过等同恢复流程已完成。

A实现：纯v2证据校验/规范化/摘要与100组、1000效果、2MiB含换行上限；
UUID主键、mediaId唯一索引、无TTL的append-only模型，保留原evidenceCreatedAt与可选独立restoredAt。
数据库历史完整性、文件重复JSON键、跨日志依赖和实际恢复分别留B/C/D，不以纯对象校验代替。
json-canonicalize固定3.0.0从开发依赖移至生产依赖，未更新版本或增加新库。

A自查/独立评审修订：strict:false额外字段存储绕过补保存前实际字段白名单（含validateBeforeSave:false）；
复用引用行允许createdAt早于新operation，同时要求PREPARED本代次updatedAt不早于operation创建；
迟到version0仅限批准失败码，合法删除前历史保留；字节上限改用合法证据和隔离VM逐处移除检查验证。
定向纯测试106/106通过、模型及依赖清单34/34通过；Dalton独立重跑纯测试106/106并确认修订无新增确证阻断，
模型仅独立只读复核，不冒称独立Mongo重跑。首次模块缺失、跨realm夹具错误和各缺陷RED均保留。
生产依赖隔离安装`npm ci --omit=dev --ignore-scripts`通过，四类证据实际seal/validate加载通过；
该结果不等于镜像构建/部署，未执行安装脚本。首次默认npm缓存EPERM退出255后改用/tmp独立缓存，未修改用户缓存。
首轮全量为处理新评审意见主动中断exit130，不能计作全量通过；修订后重新冻结运行。

最终Node v22.23.3执行`npm run test:family-regression -- --json --outputFile=/tmp/lms-t2-udr-a-family-final.json`，
exit0，136/136套件、3283/3283测试、零失败/跳过，515.535秒；仅8个家庭后端项目，不冒称前端或legacy全量。
1163个受测非文档文件逐项SHA-256验证无漂移；新增导入仅位于模型及测试/测试配置，无正式装配。
文档状态门禁及差异格式检查通过。不可变归档`release-gate-artifacts/t2-udr-a-2026-10-23/`保存A前后快照、
全部红绿/中断/环境失败记录、独立评审、依赖加载、字节变异和哈希清单；不覆盖§10.5历史检查点。
UDR-001/007/008/009/010仅完成A层契约/模型验证，完整事务、日志、恢复、只读预检及HTTP验收仍待B-E。
下一增量B按已批准计划实施，不新增内部审批点；最终T2-G仍须用户批次验收，默认关闭和真实部署/Git限制不变。

### 10.8 用户删除恢复增量B

状态INTERNAL_COMPLETE；实现、定向验证、两项P2独立复核及最终固定源码回归完成，不计T2-G用户批次验收。
显式recoveryJournal注入下，同一事务捕获所属scope完整历史与实际before/after变化并保存固定UUID outbox；
事务外确认v1/v2持久性，清理再等待正文目录同步，最后元数据CAS。正式server/operations装配仍留D。
旧helper原生只读识别v2 outbox后拒降级，不加载新模型；已注入v2且发现外部日志但outbox缺失也拒绝。

设计内兼容澄清经Dalton只读核实：version0失败的terminalAt可能早于数据库插入时间，不改原审计；
只豁免该关系，其他日期/终态规则保留。外scope合法失败审计不归owner证据，但跨scope实际引用或异常历史仍阻止删除。
两项均有真实operation factory/临时副本集失败复现及修订正反用例。
当前自测capture/删除/清理61项、journal真实临时文件64项通过；两项评审P2修订后的六套件319项通过，零跳过，exit0。
七处写点回滚、真实重叠commit/abort/另一个媒体删除、原UUID与首次审计、双日志等待、正文已删后的元数据回滚/未知提交均已定向验证。
媒体目录sync移除调用/await的隔离变异及journal逐处fsync/await变异另存原报告，不改真实文件/数据库。
日志和报告统一前缀`/tmp/lms-t2-udr-b-*`；先前A归档保持不变，原始红测保留。C/D/E仍未实施。

独立首轮评审（Dalton）发现B-P2-1外部v2存在而DB回退active时可能先生成新审计、
B-P2-2未变化的历史同代次引用被effects过滤前缺少终态一致性校验。新增四项负向用例全部先红，
随后修订：事务外预读受保护v2、事务内鉴权后在任何写入前拒绝缺失/冲突证据；完整规范证据比较，
不自动修补回退的guard。收集的before/after引用在筛选前校验原集合、终态、精确释放与租约；
version0不能有同代次行，PREPARED要求全集，历史终态允许合法后代次覆盖和清理，不制造effects/receipt。
追加日志读错鉴权优先、guard回退零写，保留双家长external=null并发重读及首次审计正例。
两项P2经Dalton对修订源码、四项红测与319项绿测独立复核后CLOSED，限定范围无新增确证阻断；
首轮独立纯/journal复跑171项通过不代替本次代码复核，也不冒称独立Mongo复跑。
保留一项非阻断P3用例精度建议：当前guard回退用例不是external/frozen规范比较的独立反例；
下一增量C增加合法重签但内容冲突的外部证据负向测试，B现有完整比较实现保留，不扩大本批冻结源码。
首轮冻结全量为处理上述问题主动中断exit130，不能作为全量通过证据。
第二轮全量exit1，137/138套件、3408/3409项；唯一失败为checkGitClean临时仓库启动git报系统错误-86，
随后Jest序列化循环错误导致无JSON报告，完整文本保留。根因为主线程重建PATH遗漏Homebrew而选中旧Intel Git，
直接Node spawn复现；仅改为Node22前置原PATH，原测试1项通过，不改项目/系统配置。
同一1167文件冻结快照下另跑family-corrected-env全量，最终结果见下；两轮报告不能混作一次全绿。

另保留同媒体双家长新增测试的一次30秒超时：屏障位于Guard写入后，测试自身持锁等待竞争者，形成等待环。
仅将屏障移到真实快照读取后/Guard写前，未增加超时或删断言；单例通过后六套件312项无筛选通过，
再经上述P2修订扩为319项。此为测试编排修正，不归因于历史socket/401，不抹去原失败报告。

最终命令：`env PATH="/tmp/lms-node22-cache/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH" npm run test:family-regression -- --json --outputFile=/tmp/lms-t2-udr-b-family-corrected-env.json`。
Node v22.23.3/arm64、Git2.55.0；exit0，138/138套件、3409/3409项，零失败/跳过，530.238秒。
仅8个家庭后端项目，不冒称legacy/前端/真机全量。1167文件冻结校验及11个独立复审文件哈希一致，
server.js/completionOperations.js与此前G检查点逐字节一致，无正式v2装配漂移；50个相对文档链接有效。
文档门禁及差异格式检查通过。不可变归档`release-gate-artifacts/t2-udr-b-2026-10-23/`保存基线/当前快照、
原始红绿/中断/环境失败、两轮独立评审、环境核验及最终全量，不覆盖A或原G归档。
下一步按已批准计划进入C受控恢复与版本依赖，承接非阻断P3；不新增内部审批点，整个T2-G仍须用户验收。
不部署、不提交或推送；D01/T2-G/T2继续OPEN，默认关闭和旧客户端拒绝不变。

### 10.9 用户删除恢复增量C

当前状态：内部增量完成（最终验收见本节末，T2-G仍OPEN）；以下保留实施过程。按已批准计划实施，不新增公开接口或正式装配。仅独立helper显式execute/writesPaused后
读取受保护v2，事务内先构建完整写集合，再执行精确CAS；成功固定ready:false，不开放业务写入。
新纯辅助模块提供固定operation身份比较、完整无分叉COMMITTED版本链及100份/16MiB依赖缓存。
文件读取在可重试事务外；依赖证据只核验已应用删除事实，不隐式恢复另一媒体。

已定向覆盖：删除前BSON回退后的PREPARED/COMMITTED/无metadata，历史A PREPARED与B中止、
不安全跨阶段B COMMITTED备份拒绝；合法后代次C保留，迟到version0拒绝审计不改原日志；
X/Y逆序零写pending、正序1→2→3、再次X不降版本，缺账本不能跳依赖；普通unbind版本缺口不能猜造。
真实30天清理后两成员正文/元数据不存在的旧凭证重放、系统CANDIDATE/FENCED/SUPERSEDED保持、
系统DELETED/PURGED冲突拒绝；七处实际写后故障整笔回滚、最终CAS失败及提交未知只读确认。
首次墓碑/receipt/outbox ID和原审计保留，新增guard使用恢复时刻，既有guard与首次restoredAt不刷新。

红绿过程：基础缺模块10失败后实现；显式BSON与hash错误分类两项失败后修订；X/Y新增两项失败、
历史/后代次/迟到终态新增三项失败、清理后重放一项失败，均保留报告并逐项补实现。
首批主套件32项、历史44项通过；联合主49+纯82=131项通过；随后普通unbind/外scope/BSON扩展主58项通过。
B保留P3已有合法规范但异正文外部证据反例，guard/outbox完整且拒绝零写零persist；移除比较的隔离变异能观察到错误成功。
另两项主helper变异通过：移除matchedCount检查会发生引用未释放而资产已删的错误成功；
移除依赖已应用事实检查会在Y缺guard时错误确认X。仅VM替身，不修改正式源码，定向筛选的58跳过不计全量。
纯缓存真实16MiB/100文件边界及移除限制变异、终态/版本链负例由辅助套件覆盖。

临时证据前缀`/tmp/lms-t2-udr-c-*`。代码独立评审Dalton、测试独立QA Boole进行中，尚无最终验收结论。
尚未完成C最终冻结回归/归档，D只读预检及正式装配、E三服务HTTP/BSON验收仍待后续。
不把当前定向结果当作T2-G或恢复就绪证明；历史失败保留，T2-G/D01/T2保持OPEN，DEVICE_PENDING不变。

首轮独立评审结论CHANGES_REQUESTED：Dalton确认C-P2-1（未变化COMMITTED组员释放时序校验缺失）、
C-P2-2（合法清理与缺账本重建的组合无法收敛）；其隔离适配器复现不是Mongo事务验证，需真实副本集回归。
Boole另提出五项P2测试保护缺口：缺账本时已应用前置删除、历史A租约/版本、后代次C外部组员、
完整CAS谓词/写入变体、未知提交后的不完整或不可读确认。两类意见分别追踪，尚未标记关闭。
两位评审均独立重跑纯82项通过；Mongo测试仍为作者运行，不冒称独立全量。
自查另发现guard revision/asset版本安全整数溢出，两项负例先红后补前置拒绝通过，待独立复核。
v1/v2现存格式冲突还须在恢复写入前由受保护组合reader拒绝，不能仅依赖恢复后的D预检；
该已批准契约的C/D接缝保持未完成，正核对最小实现，不把当前v2-only helper声称为完整恢复入口。

修订进展：两项代码P2以真实副本集五例复现失败后修订，主套件101项通过。
C-P2-1对未变化COMMITTED引用补充原提交/释放/更新时间关系；C-P2-2先证明候选账本的完整版本链，
再逐项验证全部依赖实际删除事实，最后统一执行写集合；清理后成员验证可使用已证明的事务内候选账本，
不跳过账本验证、不按最大版本猜造、不隐式恢复另一媒体。
QA五缺口追加34项永久用例，其中历史A/C完整组17项由Boole实现并两次定向通过，不冒称自实现自评审。
最终CAS/依赖事实及新增历史租约、只查重叠成员、仅outbox确认共五项VM变异已验证，正式源码未改成变异体。
当前主套件104项含这些变异用例；最新相关回归及Dalton独立复核仍进行中，两项P2/五项QA尚未据自测自动关闭。

后续复核：Dalton确认C-P2-1/2和五项QA缺口已受保护；另发现非重叠later C组员未共用完整日期关系（C-P2-3）。
追加四例，其中early-bound/early-ABORTED两例真实RS先红，合法ABORTED及既有late-created拒绝为通过对照；
随后提取共用引用日期校验并应用于后代次全部组员，主108+纯82=190项通过。
Dalton窄复核PASS关闭C-P2-3，保留此前CHANGES_REQUESTED原报告；未冒称独立Mongo运行。
至此三项代码P2、五项QA保护缺口和B保留P3在局部恢复核心范围闭合，C整体仍IN_PROGRESS。

最新定向回归：Node v22.23.3执行既定Jest配置/--runInBand/--runTestsByPath八套件，
`/tmp/lms-t2-udr-c-checkpoint-targeted.json`及同名.log，exit0，8/8套件、493/493项，零失败/跳过，52.477秒。
包括恢复108、纯证明82、capture61、v2 journal64、evidence107、model34、privacy34、mediaCleanup3。
四个核心源码/测试文件后验SHA-256与独立评审快照一致；此处不是测试前全仓冻结，也不是家庭全量、前端或真机结果。
文档门禁及git diff --check通过；不可变检查点`release-gate-artifacts/t2-udr-c-checkpoint-2026-10-23/`
保存源码/文档快照、原始红绿、独立评审/修订复核及未通过的reader设计评审，不覆盖A/B/历史档案。

剩余reader设计：Pascal指出原方案只计算v2、额外v1未计入依赖预算，结论FINDINGS，未准予实施。
采用保守兼容口径：一次恢复中v1/v2合计最多100个物理日志文件/16MiB内容（含换行），
明确有限limit+1增长检测、请求级预算、并发去重、重试和helper复用；现有v2缓存预算仍是额外约束。
该细分机制仍在方案修订/独立核对，不据当前v2-only实现声称已满足联合预算或完整预写屏障。
不扩大上限、不修改真实环境；C最终回归/验收、D/E和T2-G/D01/T2继续未关闭。

reader后续实施：联合预算细分方案经Pascal独立复核PASS，按原容量保守落实，不新增审批范围。
proof cache每次创建只选择一个受保护读取会话，目标/依赖/事务重试共用，下一次restore重新计费；
畸形会话能力显式拒绝，不回退到无预算read。8项新增用例先行为失败后通过，纯套件90项通过。
首次测试有语法错误未执行用例，单独保留parser失败报告，不将其计为行为RED。
组合reader已进入实现，真实副本集新增7项通过：成对和v2-only、目标原始/已恢复数据库中的v1冲突、
依赖冲突/不可读的零写拒绝、同helper跨依赖发现共享会话而下一次restore使用新会话。
另补3项真实原回收服务接续：CANDIDATE/FENCED转SUPERSEDED、已有SUPERSEDED幂等；
用户删除事实与首次审计完整保留，不调用远程retire、不写系统删除日志、不删除文件或同步目录。
Node22完整核心回归2套件208项通过，零失败/跳过，exit0，38.791秒；
证据`/tmp/lms-t2-udr-c-core-reader-first-green.json`和同名.log。
首次接续测试命令误用不存在的backend/node_modules/.bin/jest，exit127；修正为根依赖后运行，非产品失败。
以上尚非reader独立代码/QA通过或最终冻结回归；C保持IN_PROGRESS，D/E尚未实施。

最终复核与回归：reader65项自测通过，Pascal独立代码/QA PASS并独立复跑65项通过（18.270秒）；
Dalton缓存/恢复集成复核PASS并独立纯90项通过。六个核心源码/测试哈希与相应独立评审快照一致。
reader自查发现共享根目录消失被误作v1缺失，已补永久反例并修复；容量夹具非法失败码已修正，未放宽codec。
原30秒容量测试超时保留；尺寸规划减少重复校验，实际文件仍使用完整合法证据验证精确16MiB和+1边界，
单项超时上限改为120秒，最终65项实际18.295秒；未把名为safety-green的失败报告计入通过证据。
四项reader隔离变异覆盖文件数/字节计费、错误使用路径stat大小、拒绝缓存；正式源码没有变异开关。

Node22执行`npm run test:family-regression -- --json --outputFile=/tmp/lms-t2-udr-c-final-family.json`，
exit0，141/141套件、3682/3682项，零失败/跳过，565.081秒。运行前后1173个源码/脚本/配置文件哈希一致。
相对B新增恢复118、纯证明90、reader65共273项；原138套件3409项的源码与各套件用例数未变。
直接比较fullName首次得到三项表面缺失，原因是用例名内动态UUID/日期；另有既有重复参数标题，不能用Set大小当用例总数。
原比对失败报告保留；改用原测试源码哈希、逐套件数量及全量全部通过证明原用例保留，没有删除或改写用例。
文档状态门禁、50个相对链接及git diff --check通过；归档`release-gate-artifacts/t2-udr-c-final-2026-10-23/`，不覆盖历史失败与旧检查点。

C-CACHE-P3非阻断：当前已有依赖发现再入共享会话，但尚无显式事务回调重试/提交丢应答后会话计数的独立断言；
已在E清单登记两类用例，不冒称本批已关闭该建议。当前实现的缓存作用域经独立检查正确。
C内部增量完成；D仅完成调用链准备，未编码，E待实施。T2-G/D01/T2继续OPEN，DEVICE_PENDING不变。
仅合成环境验证，不部署、不提交或推送、不扩大前端或启用旧客户端。

### 10.10 用户删除恢复增量D

状态IN_PROGRESS。用户明确正常enabled允许经原契约校验的历史v1-only删除记录；严格恢复检查仍以
`LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`拒绝，任何已知v2缺失/冲突/数据库回退不得降级。
实施分D1结构/探针分离、D2双向只读证据预检、D3正式依赖装配、D4回归及交付，不新增公开恢复接口。

D1内部步骤完成：新增`assertCompletionStorageStructure`只读入口，既有readiness复用统一结构检查后显式运行持久化探针；
所有目录检查先于任何探针。严格布尔`userDeletionRecovery:true`要求enabled且安全v2目录已经存在，缺失不创建。
false保留旧命名空间可选行为，同时不能忽略已经存在的不安全v2目录。未修改任何调用方、启动模式或环境默认值。
范围仅storage服务及原测试；实现前独立计划核对PASS，28项新增用例RED，最小实现后原29+新28共57项通过。
追加六项隔离变异，逐处移除文件fsync、发布后/清理后目录fsync及其await均能被同步等待断言捕获；完整63项通过。
Pascal独立代码/QA PASS、独立63/63项通过（1.472秒），前后两文件哈希匹配冻结值。
受影响回归5套件150项通过，零失败/跳过，exit0，26.687秒；报告`/tmp/lms-t2-udr-d1-regression.json`及同名.log。
覆盖storage、operations、production assembly、protocol isolation、common activation readiness；不是D最终家庭全量。
归档`release-gate-artifacts/t2-udr-d1-2026-10-23/`，保留RED及原C全量证据，不改写历史结果。
后续D2-D4未完成，尚未装配v2 writer；T2-G/D01/T2保持OPEN，默认关闭、旧客户端拒绝、DEVICE_PENDING及不部署/Git限制不变。

D2后续准备：复用受保护reader增加流式inventory/readLegacy，原生预检独立在D2b完成。
Dalton实施前分阶段评审先授予D2a reader-only GO，随后D2b方案亦通过独立核对；D2a实现进行中，D2b尚未装配。
D2b依赖准备：根manifest/lock精确声明已有生产传递依赖bson 6.10.3，不升级版本或改变锁定依赖图。
新增一致性用例先RED（缺直接声明），补齐后GREEN；完整模块冷加载及隔离生产加载待D2b实现后验证。
全库逐条扫描不受100份总库容量限制，每条根证据的完整依赖仍共用C预算；已知v2错误禁止legacy降级。
这是进行中记录，不是D2代码评审、测试通过或恢复就绪结论。

D2a内部步骤随后完成：reader新增流式`inventory()`与独立`readLegacy()`，复用受保护文件内核，
保留C组合读取、失败缓存、100物理文件/16MiB联合会话预算。盘点超过100条独立记录不受单根依赖上限限制。
旧writer真实输出、严格编码/语义、目录身份/mtime/ctime、resume/EOF/提前退出和失败收尾均有测试。
56项新接口缺失RED保留，原C65在该RED命令中按名称过滤；完整首次121/121、补强后128/128通过。
原C65测试主体保留，仅共享trace增加可选禁止sync钩子；新增63项，含四项隔离变异保护。
Pascal独立代码/QA PASS，独立128/128通过，零失败/跳过，exit0，24.111秒；两文件哈希前后一致。
主线程联合回归reader、restore、proof及生产依赖声明4套件337项通过，零失败/跳过，exit0，71.765秒。
报告`/tmp/lms-t2-udr-d2a-regression.json`及同名.log；此为受影响回归，不是D最终家庭全量。

D2b依赖准备经Dalton独立复核PASS：两份manifest减去bson新增行后哈希与原基线精确相同，无版本或依赖图变动。
一致性测试独立复跑1/1通过。隔离`npm ci --omit=dev --ignore-scripts`先因默认cache不可写失败（exit255），
保留原报告；改用临时私有cache后安装/探针exit0，bson解析自隔离node_modules、无Jest或模型导入。
此只证明依赖准备，尚未证明未来原生模块完整依赖链；D2b实现后仍需真实模块隔离加载与冷加载验证。
D2a及依赖准备证据归档`release-gate-artifacts/t2-udr-d2a-2026-10-23/`，不覆盖C/D1或本轮失败记录。
D2b原生双向预检、D3正式装配及D4总回归仍待完成；本记录不关闭D、T2-G/D01/T2。

D2b进入有限分段实现：先参数/原生前提/空库和双向扫描/历史兼容，随后完整已应用事实、
依赖闭包及失败/容量边界。新增原生readiness与专用测试两个文件，已接入family测试发现；未装配生产调用方。
中间实现对尚未覆盖的v2事实保持拒绝，不能因阶段测试通过提前报告完整D2b或恢复就绪。

D2b阶段1/2检查点：原生副本集/索引前提、参数和固定输出、双向流式扫描、旧日志兼容及无历史v2事实校验已实现。
54项新模块缺失RED后首轮54项通过；核对发现两项既有资产保留扫描索引未纳入前提，新增真实负例2失败/54过滤，
补齐索引检查后通过。随后1项失败来自夹具将已有evidenceHash再次传给sealEvidence，不是生产回归，修正夹具后57项通过。
再补空日志不得掩盖实际owner账本/引用的两项负例，阶段最终59/59通过、零跳过，exit0，33.169秒。
实际实现代理运行环境Node22.15.0，顺序合成Mongo/临时FS；仅保存JSON报告，不将重建摘要称为原始终端日志。
记录`/tmp/lms-t2-udr-d2b-phase12-checkpoint.md`、对应阶段JSON均保留；这不是完整D2b验收。
主线程另以Node22.23.3对阶段生产模块及真实依赖图执行隔离omit-dev冷加载，exit0，无模型/写恢复器/FS导入；
报告`/tmp/lms-t2-udr-d2b-isolated-module-phase12-preliminary.json`，最终冻结后仍须复跑。
阶段3已建立25项组事实测试，其RED均在合法组正向入口被阶段性pending阻挡，未触达后续损坏断言，
不能冒充这25类损坏均已有独立负向失败证据。完整已应用事实、依赖闭包、失败/容量边界及独立评审在当时仍待实施；当前按 §11 后置。

### D2b暂停检查点（2026-10-24）

按用户收缩MVP范围并暂停当前工作的指示，停止新增实现、修复和验证，不进入D3。
已运行的定向验证收尾：Node22.23.3，4套件433通过/1失败/0跳过，exit1，247.702秒；
readiness为131通过/1失败，reader128、pure proof90、privacy readiness84通过。
失败位于readiness的16MiB依赖预算用例：预算断言前原生查询触发MongoDB code50超时，
返回拒绝继续的`USER_DELETION_READINESS_NOT_READY`，未得到预期的`USER_DELETION_EVIDENCE_INVALID`。
保留该失败，未重跑或以此前局部通过替代最终结果；不能宣称D2b稳定通过。
新增readiness及测试两文件冻结，未接入正式启动/删除调用方，独立代码/QA未完成；
最终模块隔离加载及全量回归未执行。当前测试发现配置仍包含该未验收套件，不静默跳过失败用例。
正常enabled兼容合规v1-only、严格恢复拒绝及已知v2不降级的裁决保留。
原始报告`/tmp/lms-t2-udr-d2b-final-targeted.json`；源码哈希和全部现有阶段证据保存于
`release-gate-artifacts/t2-udr-d2b-deferred-2026-10-24/`。未部署、未提交或推送Git。
此为未验收交接点，不关闭D/T2-G/D01/T2；后续按用户新任务安排实施。

## 11. 2026-10-24 MVP 范围调整与页面运行依赖

用户批准：取消高级恢复和回收对页面开发的前置阻塞，保留必要安全能力，尽快推进孩子端和家长端；不扩大范围、不增加复杂流程。
本节覆盖此前“T2-G 完成后才进入 T2-2/3”以及逐内部步骤审批要求；历史归档不改写。
T2-G 未完成范围标记 REMAINDER_DEFERRED（未验收，不是 CLOSED）；D01 随该范围后置。
T2 总门禁仍 OPEN。页面实现、真实家庭启用、高级灾难恢复分别验收，不互相冒充。

### 11.1 必须保留与后置矩阵

| 范围 | 本次决定 | 验收节点 |
| --- | --- | --- |
| T1 权限、私有图片、稳定引用、幂等、作品版本和唯一发星 | 保留，不改契约或绕过服务端保护 | 页面闭环集成 |
| T2-R 原 actor 发现/显式恢复；刷新重试、退出清理、账号/孩子切换隔离 | 保留后端，前端按 T2-2/4/5 落实；GET 不写入 | 页面闭环集成 |
| 上传格式/大小/数量、部分失败、隐私删除、首次审计和迟到响应保护 | 保留；0–10 图原契约不缩为新单图协议，不增加解码器/OCR | 页面闭环集成 |
| 已接入上传 guard/journal、服务凭据、retirement guard、引用及存储预检 | 保留真实依赖，不因 cleanup=false 删除 | 合成 enabled 正式链路 |
| 新孤儿回收执行、调度/公平性等追加完善 | 保持关闭，未完成验收后置；不按年龄手工批量删除 | 未来单独启用前 |
| 用户删除 v2 高级恢复 D2b 剩余、D3 装配、D4/E 完整重建验收 | 后置，不继续扩大实现、不装配半成品；保留 A/B/C/D1/D2a 和 D2b 检查点 | 未来启用 v2 writer/恢复前 |
| C-CACHE-P3 精度测试等非阻断建议 | 后置；不能据局部通过标为已关闭 | 对应高级恢复验收 |
| 当前数据备份、隔离恢复、删除后不复活、容量/保留约束 | 不作为页面编码前置；不能省略 | T8 真实试点前 |

后置不改变既有 API 的正常隐私删除语义。任何当前启用路径的越权、误删、重复发布或审核版本缺陷仍阻断交付。
真实数据若已含 v2/retirement 事实，不能删证据、回退旧 writer 或隐藏预检错误来获得就绪。

### 11.2 运行依赖核实与合成环境边界

本次静态核对正式 server、completionOperations、orphanRetentionRuntime 和现有正式装配测试：

- homework enabled 已装配 complete/confirm/read/mutation 及 T2-R recovery；沿用 Gateway 认证和 progress 发星接口。
- resource enabled 已装配安全上传、引用协议和隐私删除；仍创建 retirement 依赖，当前 v2 recoveryJournal 未注入正式删除路径。
- `COMPLETION_ORPHAN_CLEANUP_ENABLED=false` 只关闭新回收执行，不豁免专用 `COMPLETION_RETIREMENT_SERVICE_TOKEN`、
  媒体服务凭据、日志目录、必要索引、MongoDB 事务以及当前引用/存储/retention 预检。
- `checkCompletionOperations` 在 enabled 中仍执行现有 retention 检查；不把尚未验收的 userDeletionRecoveryReadiness 接入启动。
- 页面合成环境显式 enabled，使用临时副本集、合成家庭/图片、受保护临时媒体及日志目录、独立测试凭据；
  新孤儿回收保持 false，不运行 cleanup/restore CLI，不写真实 NAS，不修改真实 Compose/env 默认值。
- 不能以 legacy 模式、stub 成功响应或跳过预检代替最终新协议闭环；组件测试可 mock，T2-6 必须走正式工厂和真实 HTTP。

此依赖边界允许页面开发先行，不宣称未完成回收/恢复已经可用。

2026-10-24 本次依赖定向验证：使用已安装 Node 22 bin 前置 PATH，运行根 Jest 配置，
`--coverage=false --selectProjects homework-service resource-family --runInBand --runTestsByPath`，选择：

- `backend/services/resource-service/__tests__/completionProductionAssembly.test.js`
- `backend/services/resource-service/__tests__/orphanRetentionRuntime.test.js`
- `backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js`

结果 3/3 套件、148/148 用例通过，退出码 0，25.513 秒；报告 `/tmp/lms-t2-page-dependencies-20261024.json`，
日志同名 `.log`。覆盖现有正式启动/HTTP 装配、凭据拒绝、上传/私有读取/删除、版本提交/恢复/确认及协议隔离。
这是受影响依赖验证，不是全仓回归、T2 页面 E2E、T2-G 验收或真实 iPad/Ubuntu 部署证明。
文档门禁与 `git diff --check` 通过；未改运行时代码、配置开关或真实环境。
核实前端 `childApi.completeOwnTask` 仍为旧字段白名单，公共请求的迟到 401 保护仍待 T2-2；
因此可以进入页面开发，但当前旧页面不能直接宣称兼容 enabled 协议。

### 11.3 有限交付顺序与退出条件

1. T2-2 先接现有 API 和最小命令/会话保护；不新增后端接口、离线同步或通用状态机框架。
2. T2-3/4/5 共用媒体控件，先跑通选图 → 孩子提交 → 家长查看并按版本确认 → 孩子回看反馈；
   再覆盖原 0–10 图、部分失败、重试/重登、账号切换、并发确认和已确认只读边界。代录保留真实 actor。
3. T2-6 对上述启用范围运行组件、构建、正式 HTTP/浏览器回归。真实 iPad 结果单列 DEVICE_PENDING 或实测，不能由模拟器替代。
4. T8 再做真实环境授权、备份/隔离恢复演练及容量/保留决定；高级恢复未完成时，恢复环境保持隔离，
   无法证明删除事实安全则不开放访问。关闭回收的短期试点须有复盘节点和磁盘检查，不承诺永久保留草稿。

T2 页面门禁不要求 D01/T2-G 或 D2b–E CLOSED；它要求本节保留能力及页面测试真实通过、后置限制明确记录。
未启用高级恢复的缺陷只阻止该功能启用，不扩大成页面编码阻塞；若缺陷影响实际运行依赖则仍先修复。
普通内部步骤不追加审批或重复全仓冻结；定向测试随改动运行，交付闭环和共享关键路径变更时扩大回归。
保留现有未提交工作及历史证据；本次不提交、推送、部署或操作真实数据。

### 11.4 用户要求暂停：等待重新核实 MVP 与任务安排

本节为恢复授权前的历史暂停检查点，已由用户后续“完成整个 T2 页面开发与工程验收”指令恢复，当前进展见 §12。
当时工作按用户指令暂停，不自动进入下一批；
后续须以用户重新确认的任务安排为准。已有工作区改动原样保留，不回滚、不提交、不推送、不部署。

- 已停止新增实现和测试。会话/API、命令存储、图片控件、孩子页面、家长审核及合成 HTTP 测试代码保留在工作区。
- 协作任务回报的最近定向结果：会话/API 11 套件 88 项；命令存储 164 项；图片控件及兼容回归 44 项；
  孩子页面 34 项；hook/家长审核独立复核 16 项；合成 HTTP 2 套件 13 项，均通过。
  这些结果针对不同检查点，不能相加视为最终全量验收，也不能覆盖此前失败证据。
- 最终统一前端回归、构建结果核实、正式 HTTP 与浏览器联合验收尚未完成；父端编辑/上传与确认互斥的交接风险待核实。
- 已回报的协作测试和临时服务均已收尾；主线程原构建会话已不可读取，不据此宣称构建通过。
- T2 总门禁保持 OPEN；高级恢复/回收维持 REMAINDER_DEFERRED，真实 iPad 与真实部署不视为完成。
- 证据继续保留于既有归档及 `/tmp/lms-t2-*` 报告；本次暂停不将临时报告冒充永久归档。

恢复工作时先对照新的 MVP 清单区分保留、后置和撤销项，再确定首个实施批次；
任何撤销已有代码的操作都应单独明确范围，不能用清理工作区代替范围核对。

## 12. MVP 页面闭环工程交付（2026-10-24）

按用户最新完整目标恢复，采用严格模式处理共享会话、作品命令、版本和私有媒体边界；不增加设计审批链。
复用暂停前实现与已批准的 T2-R 接口，没有继续实现 D2b/D3/D4/E 或新回收。
本节为工程验收申请，不代表 T2 总门禁关闭或用户已批准本次验收。

### 12.1 已实现流程与边界

- 孩子今天页的 pending/completed/confirmed 任务可进入详情。0–10 张 JPEG/PNG/WebP 完成图片独立于任务材料；
  单张上限 10 MiB，拒绝 PDF/HEIC、重复及超限输入。多图部分失败保留成功项；确认前可修改，确认/取消/归档后只读。
- 完成命令先规范化并持久保存到当前标签 sessionStorage，再发送同一 UUID/版本/有序集合；超时或未知结果不另造 UUID。
  刷新保留原命令；退出清理本地私有暂存，重登后可在“待恢复提交”中只读发现跨日期命令，再显式恢复原 actor 的持久意图。
- 家长从列表重新读取详情、查看授权图片及版本后审核。409 刷新并要求重新查看，不自动审核新版本。
  代录与审核互斥，上传期间不能返回审核；共管家长按真实身份代录/确认，丢响应重试不重复发星或覆盖首次审计。
- 共享请求层校验发送/返回时的身份快照，过期与主动退出分开；跨标签切换、迟到 401、旧媒体响应不能覆盖新身份。
  TasksPage 按家庭/孩子/身份代次重建，旧列表、弹窗与编辑状态同步卸载，发送前另校验任务孩子。
- 普通移除仅变更本次引用；取消、离页、上传丢响应不自动 DELETE。明确确认隐私删除后立即隐藏图片；
  旧访问地址拒绝、重登回看显示不可用，任务状态、完成版本、首次确认及星星不变。
- task_completion 受限适配控件不改原任务材料与错题集合控件，原图片/PDF 上传、预览、下载、排序及移除回归保留。

主要代码：`frontend/web/src/services/{familySession,completionCommandStore,childApi,familyApi}.js`、
`hooks/useTaskCompletion.js`、`components/family/TaskCompletion*.js`、`CompletionRecoveryList.js`、
`pages/child/{ChildTaskPage,ChildTodayPage}.js`、`pages/family/TasksPage.js`。

### 12.2 验证结果与八项必需证据

运行环境：已安装 Node 22.23.3、真实 Chromium、临时 MongoDB 副本集及私有临时目录。
`backend/tests/t2/serviceRuntime.js` 使用 Gateway、user、homework/resource enabled、progress 正式工厂；
analytics/notification 复用现有 app/routes。跨服务命令走真实 HTTP；日志静默不替换业务处理。
存储/索引/事务/上传 guard/journal/专用凭据及启动预检保留。共享隔离合成库不冒充多主机部署；
scanner 为 trusted-local，不声称真实 ClamAV。新回收 false、v2 writer/D2b 未装配，无 cleanup/restore 执行。
浏览器静态生产构建经流式代理到真实 Gateway，不 mock 成功业务响应；故障注入仅丢弃已提交响应或延迟真实响应。

| 验证 | 命令与实际结果 |
| --- | --- |
| 前端完整默认通道 | `npm test --prefix frontend/web -- --watchAll=false --runInBand --json --outputFile=/tmp/lms-t2-web-final-expanded.json`：39 套件 / 474 项通过，0 失败/跳过，exit 0 |
| 前端构建 | `CI=true BUILD_PATH=/tmp/lms-t2-final-build npm run build --prefix frontend/web`：exit 0；`main.1760f5fe.js`，与浏览器受测构建相同 |
| 正式 HTTP | `npm run test:t2:integration -- --json --outputFile=/tmp/lms-t2-http-final.json`：2 套件 / 13 项通过，exit 0 |
| T2 页面 | `T2_WEB_BUILD=/tmp/lms-t2-resumed-build T2_BROWSER_OUTPUT=/tmp/lms-t2-browser-acceptance npm run test:t2:e2e`：8 项通过，0 重试，exit 0 |
| 既有 Task11 页面/PDF | `npx playwright test --config=playwright.config.js --project=chromium --reporter=list --output=/tmp/lms-t2-compat-task11-final`：4 项通过，exit 0 |
| 既有 Task12 共管页面 | `npx playwright test --config=playwright.task12.config.js --project=chromium-task12 --reporter=list --output=/tmp/lms-t2-compat-task12-final`：1 项通过，exit 0 |
| 后端家庭全量 | `npm run test:family-regression -- --json --outputFile=/tmp/lms-t2-family-final.json`：143 套件 / 3912 项通过，0 失败/跳过，报告 `success:true`；已确认原进程结束。上下文恢复后原会话句柄失效，无法再次读取其退出码，不伪造 exit 0 |
| 十图评审补强 | `T2_WEB_BUILD=/tmp/lms-t2-final-build T2_BROWSER_OUTPUT=/tmp/lms-t2-browser-removal-proof npm run test:t2:e2e -- --grep "partial upload"`：1 项通过，exit 0；其余七项源码未变，不因补断言重复全部浏览器用例 |

| 必需场景 | 永久证据 |
| --- | --- |
| 提交后刷新仍可读取 | `completion.spec.js` real pages；真实 GET + 授权图片 naturalWidth > 0 |
| 丢响应原命令重试 | lost public response：逐字段同 UUID、完整 DB/文件快照不变；coparent lost confirmation：同版本/反馈、唯一账本及首次审计 |
| 退出重登发现/显式恢复 | remote committed loss：任务改为历史日期，退出清 sessionStorage，从今日页待恢复列表进入；只读前后快照相等、同 operationId/remoteOperationId 收敛 |
| 旧版本审核拒绝 | parent viewing V1/V2：真实并发更新，旧确认后账本仍空；显示新作品后第二次用户确认才发星 |
| 兄弟姐妹/跨家庭/失效身份 | `completion.integration.test.js` 对应拒绝与零业务变更；浏览器跨标签 sibling 和真实 PIN 撤销 401 |
| 切身份后旧异步不复活 | T2 browser 两项迟到响应；sessionApi/sessionContexts、TaskCompletionScope、CompletionRecoveryList 组件永久反例 |
| 隐私删除不改教学/奖励 | real pages + HTTP privacy case：旧 URL 404、Task/Ledger 不变、墓碑与首次删除审计保留 |
| 已确认只读且可回看反馈 | real pages：孩子无修改按钮、反馈存在、授权图片可读；TaskCompletionEvidence 状态组件覆盖取消/归档 |

十图补充场景先真实上传返回 201 再丢响应，显示 9 张成功项；补第 10 张后发布，精确断言 10 条 bound 引用，
随后普通移除并发布 9 张，Asset 完整快照不变、Tombstone 为空。0 图由正式 HTTP 及版本冲突浏览器覆盖。
独立复核后另补精确 9 项 bound 集合、原 `_id`/operationId 引用 released，以及非空媒体文件路径/大小/权限/哈希相等，防止只改正文却未解绑或误删正文文件漏检。
四种视口 768×1024、1024×768、1280×800、390×844 的孩子与家长截图、图片解码、横向溢出、模态滚动及焦点检查通过。
真实页面正常链路无未解释 console/pageerror；故障注入产生的断链不是正常链路错误。

### 12.3 自查、独立复核及失败记录

- 自查修复家长代录/上传与审核并存：先补反例，原实现 1 fail/4 pass，修复后 5 pass；不允许审核未提交草稿。
- 独立评审发现切孩子后旧列表/取消弹窗可能残留的 P2。真实负例 1 fail，按 scope key 卸载并增加 childId 发送保护后通过；
  定向 3 套件/24 项通过，独立复核确认关闭。未扩大成其他页面重构。
- 独立复核未发现恢复列表新增实际错误；建议的同家长切孩子迟到响应、空过滤页继续翻页两项补测均纳入 474 项最终回归。
- 最终独立只读复核确认正式 runtime、真实 HTTP、上传201后丢响应、共管审计与兼容夹具有效；指出十图解绑/文件保留断言P2，
  已补齐并定向验证，复核确认关闭且未发现新增问题。独立 reviewer 读取报告与代码，没有把主线程测试冒称独立重跑。
- 前序浏览器失败原样保留：macOS Chromium 沙箱启动拒绝；测试导航/定位问题；夹具多次登录触发真实 20 次敏感限流；
  十图故障注入未命中、误把 GET 投影字段当数据库顶层字段。分别修订运行权限、真实退出流程、夹具每用例隔离、
  去除兼容 runtime 不必要的 seed、真实 201 后丢响应及持久 evidence 字段断言。未放宽服务端限流、权限或产品断言。
- 上下文恢复后旧全量测试仍在后台但会话句柄失效，误启的重复全量已明确中断（exit 130）；不将其算作完成回归。
  重复轮在中断前也复现后置 D2b 16 MiB code50 失败；较早完整轮继续，失败不掩盖、不删测试。
  最终完整轮143套件3912项通过，不据此删除上述失败或认定后置D2b稳定、已完成高级恢复验收。
- 构建的 caniuse-lite 过期提示和 CRA devServer deprecation 为已记录工具链提示，不在本轮升级依赖。

### 12.4 交付裁决与待办

T2-2 至 T2-5 实现已完成，T2-6 工程证据提交验收；T2 总门禁仍 OPEN / IN_PROGRESS，未代替用户批准关闭。
TC-T2-MEDIA-008 的新孤儿回收部分、D01、T2-G 未完成部分、D2b/D3/D4/E 及 C-CACHE-P3 均 REMAINDER_DEFERRED，
不因页面通过视为完成。上传响应丢失可留下未绑定媒体；本轮不运行自动回收，也不按年龄手动删除。
真机 DEVICE_PENDING：在真实 iPad Safari 分别验证新拍 JPEG、相册 HEIC 显式导出 JPEG、文件多选/10 MiB边界、
断网重试/重登、横竖屏查看/放大/删除确认及家长审核冲突；记录设备型号、iPadOS 和实际 MIME。
浏览器模拟只证明布局与页面逻辑，不替代这些输入路径。T8 的备份、隔离恢复、容量/保留和真实启用仍未验收。
不部署家庭 Ubuntu、不访问真实孩子数据或 NAS、不提交/推送 Git；真实默认配置与旧客户端升级拒绝保持。

本轮工程证据归档：`release-gate-artifacts/t2-page-mvp-2026-10-24/`，包括报告、截图、源码哈希及结果摘要。
后端完整报告归档副本对合成凭据样式做脱敏，原始报告留 `/tmp/lms-t2-family-final.json`；不记录真实数据或私有访问能力。
浏览器 `.last-run.json` 只证明状态与失败列表，8/4/1及补强1项的数量/exit来自实际运行输出，摘要不冒充原始stdout。

本地体验：先构建，再 `T2_WEB_BUILD=/tmp/lms-t2-final-build npm run test:t2:preview`。
它只启动回环地址、临时副本集/存储及一次性合成家庭，输出本次合成登录信息；按 Ctrl-C 收尾，数据不持久保留。
不得把此测试运行器作为真实部署入口，不把真实孩子图片上传到合成演示。

### 12.5 页面恢复边界两项 P2 修订与自审（2026-10-24）

**Status:** CLOSED（2026-10-24 用户复审通过并明确批准关闭两项 P2；复审记录见 §12.6）。以下保留原修订、自审与失败证据，不等于 T2 总门禁关闭。
本节是 §12 原页面交付的增量，不覆盖原失败记录，也不重新开启高级恢复/新回收范围。

| 评审项 | 修订与永久保护 |
| --- | --- |
| T2-PAGE-P2-403：显式恢复收到权限拒绝仍展示私有详情 | `useTaskCompletion.recover` 在当前身份 401/403 时进入 awaiting_auth、清空 task，禁止继续恢复；保留原 command/recovery，不将拒绝当作远程终态，不换 UUID。仍先做 scope/session 校验，迟到响应不能清除新身份内容 |
| T2-PAGE-P2-STORAGE：损坏命令在退出后残留，重登循环 blocked | `familySession.clearCommands` 校验规范键的六段结构、ID、角色/动作和孩子归属，以键确定所有者，不依赖损坏或冲突正文。主动退出/切账号/挂起标签消费退出标记均可清理；会话过期仍保留原记录，其他 actor/角色不被误删 |

新增 `taskCompletionRecoveryBoundary.test.js` 14 项：家长/孩子的 403 清除任务、自评、反馈和媒体入口；
保留同一 operationId、家长未决确认命令及原 session；不自动 GET/恢复/完成；旧身份迟到 403 不污染新视图；
损坏 JSON、缺失 scope、冲突 scope 在退出后清除，重登只读发现并显式恢复原命令；
过期保留、切账号定向清理、伪装正文不能删除另一规范键、挂起标签只消费一次退出标记。
使用真实 hook/会话/存储/证据组件，API 为组件层替身，不冒充正式 HTTP。

浏览器永久用例在既有 `completion.spec.js` 内补齐，不增加测试框架：
- 原远程 COMMITTED 丢响应场景保留；另加损坏本地 envelope 后刷新 blocked、真实退出/重登、跨日期发现及原 operationId/remoteOperationId 恢复，最终授权图片可解码。
- 共管家长上传后形成待恢复意图，退出重登发现；创建者通过真实成员移除接口撤销权限，原家长恢复收到真实 403；
  弹窗任务标题/详情消失、恢复入口消失、刷新禁用，前后完整数据库/文件快照相等。未 mock 成功或拒绝响应。

验证（Node 22.23.3，命令输出 JSON 在增量证据目录）：
- 红灯：新增套件在旧实现 12 failed / 2 passed，exit 1；失败是清屏/定向清理断言，不是加载错误。
- 定向绿灯：`npm test --prefix frontend/web -- --runInBand --testPathPattern="taskCompletionRecoveryBoundary|sessionApi.t2|useTaskCompletion"`，3 suites / 57 passed，exit 0。
- 最终完整前端：`CI=true npm test --prefix frontend/web -- --runInBand`，40 suites / 488 passed，0 failed/skipped，exit 0。
- 正式 HTTP：`npm run test:t2:integration`，2 suites / 13 passed，exit 0。
- 构建：`CI=true BUILD_PATH=/tmp/lms-t2-p2-build npm run build --prefix frontend/web`，exit 0，`main.6f7b5b6c.js`。
- 浏览器初轮 9 passed / 1 failed；新增权限撤销夹具误用要求 200 JSON 的 expectData，而成员移除契约实际为 204。
  核对 controller 后改为精确 204 断言，定向 `--grep "current recovery 403"` 1 passed，exit 0。产品权限和接口不变，不以重跑掩盖失败。
- 最终浏览器完整回归：`T2_WEB_BUILD=/tmp/lms-t2-p2-build T2_BROWSER_OUTPUT=/tmp/lms-t2-p2-browser-final npm run test:t2:e2e`，10 passed，0 retries，exit 0；真实 Chromium 四种视口，不代表真机 iPad。
- `npm run docs:family:check` 和 `git diff --check` 通过。
- 首次构建因新增表达式触发 `no-mixed-operators` 失败，补明确括号后成功；caniuse-lite 过期和 NO_COLOR/FORCE_COLOR 提示仍保留，不借机升级依赖。

自审：恢复权限拒绝与未知网络/404 分支区分；后者仍允许同 ID 重试，前者清私有视图但不清原命令。
检查了规范键优先于冲突正文、会话过期不清理、退出标记重放、原 actor 重登显式恢复、最终服务端权限和版本校验未改动。
未发现新增阻断项；这是开发自审与测试结果，不冒称用户复审通过或独立审批完成。

增量证据：`release-gate-artifacts/t2-page-p2-2026-10-24/`。旧 §12 归档及其源码清单保持原样，代表修订前历史基线；
本轮新清单标记修订后源码。后端业务未修改，不为形式重复家庭全量 3912 项，也不将旧报告改写成本轮执行。
回滚仅撤销本次前端局部修改，无数据库迁移或真实数据处理；不重置工作区既有变更。
T2 总门禁 OPEN / IN_PROGRESS；两项缺陷已获用户复审关闭，DEVICE_PENDING，T2-G/D01、D2b/D3/D4/E、C-CACHE-P3 继续 REMAINDER_DEFERRED。
新回收关闭、旧客户端升级拒绝、真实默认配置及凭据/预检保留；无真实数据/NAS、部署、Git 提交或推送。

### 12.6 两项 P2 复审与关闭裁决（2026-10-24）

用户批准：“复审通过，更新门禁和评审记录，关闭本次两项 P2。”
仅关闭 T2-PAGE-P2-403、T2-PAGE-P2-STORAGE，不外推为 T2-2 至 T2-6 工程验收或 T2 总门禁批准。

| 缺陷 | 复审结论 | 当前状态 |
| --- | --- | --- |
| T2-PAGE-P2-403 | 清空 task 并卸载私有详情；原命令和 operationId 保留；当前403与迟到响应区分；真实移除共管成员后的403及零业务变更验证通过 | CLOSED，用户批准 |
| T2-PAGE-P2-STORAGE | 三类损坏正文按规范键定向退出清理；过期保留、其他 actor/角色保护及挂起标签标记有效；真实重登发现并恢复同一持久映射 | CLOSED，用户批准 |

复审重新执行（非本次文档更新重新运行）：前端40套件488项、正式HTTP 2套件13项、两项关键真实浏览器反例均通过，exit 0；
`docs:family:check`、`git diff --check`通过。核实旧代码12项反例失败原因确为原缺陷；172个源码哈希及新构建哈希匹配。
复审没有重新构建或重跑全部10项浏览器，不能将定向2项表述为新一轮全套。
复审范围内未发现新增缺陷；原首次构建lint、成员移除204夹具失败、历史后端/恢复失败证据全部保留。
复审JSON和浏览器结果现归档到 `release-gate-artifacts/t2-page-acceptance-review-2026-10-24/`；
原两份交付归档不改写，里面的 FIXED_PENDING_REVIEW 是当时快照，当前裁决以本节为准。

## 13. T2 工程验收及总门禁关闭评审包（待批准）

> 历史申请快照：本节保留申请时的待批准状态和旧证据限制；最新全量证据见 §16，当前批准以 §17 为准，§15 保留此前收口记录。

**Decision status:** PENDING_USER_APPROVAL。
**Current gate:** OPEN / IN_PROGRESS。本材料不执行关闭，不将真机、真实启用或后置功能写为通过。
范围以 §11 已批准的 MVP 裁决为准：拟申请的是 T2-2 至 T2-6 页面工程验收及
“T2 工程总门禁（仅正式 enabled 合成验证范围）”关闭，不是 T2 全部设备/部署/高级恢复义务完成。

### 13.1 退出条件核对

| 条件/批次 | 工程证据与核对结果 | 裁决状态 |
| --- | --- | --- |
| T2-1 / T2-R 后端 | §8/§9 用户批准；不重复开放已关闭批次 | CLOSED |
| T2-2 API、命令和会话 | API白名单/规范正文/先保存后发、同命令重试、刷新及原actor重登恢复；共享会话和迟到响应反例；§12.5/12.6 P2已关闭 | READY_FOR_ACCEPTANCE |
| T2-3 图片与隐私 | 0/1/10/超限、重复、格式/大小、部分失败；普通移除与隐私删除分离；权限失效、文件保留、精确引用及正常删除证据保护；新孤儿回收部分明确排除 | READY_FOR_ACCEPTANCE |
| T2-4 孩子页面 | pending/completed提交或修改；confirmed/cancelled/archived只读；完成作品刷新可读、家长反馈可见；组件与真实页面证据 | READY_FOR_ACCEPTANCE |
| T2-5 家长页面 | 按实际详情版本审核；旧版本409后重新查看而非自动确认；共管真实actor、首次审计与发星幂等；代录/上传与审核互斥 | READY_FOR_ACCEPTANCE |
| T2-6 正式装配与隔离 | Gateway/user/homework/resource/progress正式工厂及真实HTTP；enabled合成运行，凭据、索引、事务、上传guard、日志目录和启动预检保留；新回收false | ENGINEERING_READY_FOR_ACCEPTANCE |
| 身份/权限与未知结果 | 兄弟姐妹、跨家庭、失效身份拒绝；当前403清屏、跨标签及迟到响应；公开/远程丢响应不换ID、不重复发布或发星；§12.2八项必需场景 | 证据具备 |
| 兼容 | 默认前端488项含原材料/错题图片/PDF；此前正式enabled Task11 4项、Task12 1项浏览器通过，明确为原轮证据 | 证据具备，不冒称本轮重跑兼容浏览器 |
| 回归/构建/评审 | §12.2、§12.5及§12.6；最终构建与浏览器受测文件相同，两项最后P2已获用户关闭 | 无已知未解决的当前页面阻断项 |
| 用户工程验收与总门禁裁决 | 本次仅授权整理材料，尚未批准 T2-2至T2-6汇总验收及工程总门禁关闭 | PENDING_USER_APPROVAL |

这些结论是对当前实现与既有证据的核对，不代表本次文档更新重跑业务测试。
关键最终证据：前端40/488；正式HTTP 2/13；新构建 `main.6f7b5b6c.js`；完整浏览器10项；复审定向浏览器2项。
历史后端家庭全量143/3912为较早完整轮，JSON success:true但原会话退出码不可回读；后续只改前端及文档，
复审正式HTTP通过。保留该证据限制及后置D2b容量失败，不把历史全量报告改写成本轮运行。

### 13.2 剩余义务及启用限制

| 未完成范围 | 当前状态 | 后续责任/触发点 |
| --- | --- | --- |
| TC-SL-IPAD-001..004 | DEVICE_PENDING | 用户提供真实iPad后记录型号/iPadOS、真实MIME：新拍JPEG、HEIC显式导出JPEG、文件多选及10 MiB边界、断网/重登/回看/旋转/审核冲突。模拟截图不能替代；真实家庭启用前须完成 |
| T8真实启用前准备 | T8_PENDING / NOT_AUTHORIZED | 后续单独授权备份、隔离恢复、删除不复活、容量/保留限制、Ubuntu/NAS及部署验证；当前不执行 |
| 新孤儿回收、D01/T2-G未完成范围 | REMAINDER_DEFERRED | 默认关闭；未来启用前完成原安全验收。上传丢响应可能留下未绑定媒体，不按年龄手动批量删除，不承诺永久保留草稿 |
| 用户删除高级恢复D2b/D3/D4/E、C-CACHE-P3 | REMAINDER_DEFERRED | 不装配半成品v2 writer，不执行cleanup/restore；未来单独恢复实施及验收。保留原代码与失败检查点 |
| SL-01整体 / T7及其他增量 | 非本次关闭范围 | 不因T2工程通过将跨T1/T2/T7及设备义务的SL-01改为COVERED；不自动启动T3–T9 |

真实默认关闭配置、旧客户端升级拒绝、现有服务凭据和启动预检继续保留；本轮无部署、真实数据/NAS、Git提交/推送。

### 13.3 待用户裁决与获批后动作

建议审批内容：批准 T2-2 至 T2-6 的合成范围工程验收，并关闭该范围的 T2 工程总门禁；
明确保留 DEVICE_PENDING、T8_PENDING/NOT_AUTHORIZED 和 REMAINDER_DEFERRED，不将其作为已通过项。
如果尚未批准，继续保持唯一 T2 IN_PROGRESS 状态，不修改状态校验器以绕过门禁。

获批后只同步执行记录、Gate、实施计划/导航/架构摘要及状态校验器的当前状态和反例，运行文档状态校验及对应测试；
保存批准范围与证据链接，不重新实施已完成页面，不默许真实部署或自动开始后续任务。
当前校验器仍要求唯一 IN_PROGRESS T2 行，保护“先批准后关闭”；本次未改代码或放宽该校验。

本次文档交付验证：`npm run docs:family:check`、`git diff --check` 均 exit 0。
重新核对原172项源码清单，仅上述执行记录/门禁/计划/追踪4份文档变化，其余168项及受测构建哈希不变；
不重写原清单，不将归档报告表述为本次重跑业务测试。

## 14. 独立全流程评审三项 P2（2026-10-24）

**Plan checkpoint（实施前）:** VERIFIED / PLAN_SELF_REVIEW_PASSED。本节方案及自审结论先于修复代码记录；用户已授权方案自审通过后实施。
**Current status:** CLOSED（2026-10-24 独立复审通过及最新用户批准，§16）。本节保留实施、自审和开发轮次的失败记录；各轮全量证据分别见 §14.2、§15.2 和 §16，不相互覆盖。
旧两项 P2 的关闭裁决不变；本次三项 P2 已关闭，T2 工程总门禁保持 OPEN，真机、T8 和后置范围不随缺陷关闭。

| 编号 | 核实、根因与影响 | 聚焦方案 |
| --- | --- | --- |
| T2-P2-JWT | 成立。Gateway把JWT校验失败转成403/ACCESS_DENIED；共享请求层只对401走expired，孩子登录页又因已登录跳走。不是业务权限403清屏问题 | Gateway凭据缺失/失效/过期统一使用既有401/UNAUTHENTICATED，不新增码；JWT校验与内部信封构造错误分开，后者不误归类为凭据失效。共享层继续只在当前session的401过期并保留原命令；403不注销。不改角色/家庭权限及密钥 |
| T2-P2-SNAPSHOT | 成立。publish整体替换completionEvidence，却仅set出现的顶层字段；再次省略时残留旧投影。页面清空数字本就省略字段 | 采用现有完成快照语义：五个可选完成字段省略即本次未填写，publish同一最终CAS事务中unset缺省的顶层兼容字段。不用0/null替代空白，不变更命令规范化/哈希/owner/版本；旧终态重放不改历史记录。GET/刷新及确认应与新稳定证据一致 |
| T2-P2-BODY-SYNC | 成立，既有store风险由当前enabled上传路径复用，非本次新引入。writeFile/link/unlink后直接返回，日志和metadata可先于正文持久化 | 私有store对独占临时文件write/chmod后等待文件sync/close，link原子发布且不覆盖，unlink临时名后等待发布目录sync，再返回storageKey。文件或目录失败不得派发metadata；仅清理本次已取得所有权的路径，清理失败保留失败而非成功。metadata已派发/未知后仍禁止补偿删除，不增加恢复框架 |

方案自审通过：401沿用既有认证码及消费者失效流程，不将所有403作注销；对老403认证语义的契约断言需更新且补真实JWT反例。
快照与现有UI清空、已持久patch及恢复哈希一致，无数据库迁移/历史回填；新增写入清除旧兼容投影，不改已提交终态的重放。
正文同步在metadata之前，不穿透completionUploadService的结果未知保护；保留碰撞不覆盖、文件权限、前置失败收尾。
仅合成验证，不对真实数据/密钥/默认开关做修改；回滚为局部代码回退，不重置既有工作区，不能撤销或重写历史数据。

验证安排：先补JWT/快照/文件与目录sync及await负向用例并观察旧实现失败，再修复；
运行受影响后端、完整前端/构建、正式enabled HTTP和真实页面回归；按共享store风险运行家庭后端全量。
永久反例覆盖家长/孩子真实过期重登、原actor同UUID恢复、迟到过期响应和普通403，
旧值到省略/GET/重放/确认投影一致，文件/目录同步失败与等待、metadata派发顺序及未知结果不删除正文。
独立基线仅供比较：前端40/488、HTTP2/13、浏览器10；后端143/3912中仅后置D2B-05 code50失败。
本次结果另记，不能用基线冒称本轮通过；DEVICE_PENDING和所有既定REMAINDER_DEFERRED不变。

### 14.1 实施与自审

- JWT：只修改Gateway校验失败的状态码，复用已有401/UNAUTHENTICATED及共享请求层expiry，不改familySession业务逻辑。
  真实过期/无效JWT反例、内部信封构造异常500反例，以及家长/孩子会话保留原命令/迟到401/普通403反例已通过。
  新增两角色真实过期重登页面用例，与原远程COMMITTED丢响应组合，断言原operationId、remoteOperationId、原正文及单次发布；
  迟到真实expired-JWT响应由真实Gateway生成，浏览器仅延迟转发，不伪造401。
- 快照：在原publish事务/owner阶段版本CAS中对缺省PATCH_FIELDS执行unset；命令占位、哈希、远程映射和历史终态重放不变。
  正式HTTP同时断言五字段的原始Mongo记录、GET及completionEvidence，旧/新命令重放零写，确认只发一次星并保留首次家长审计；
  页面清空两数值、刷新及家长确认用例通过。没有数据迁移或历史修复。
- 正文：显式FileHandle.writeFile/chmod/sync/close后link不覆盖发布，unlink后等待目录sync；同步失败绝不进入completion上传日志/metadata。
  收尾只处理本次取得所有权的路径，临时名unlink后释放所有权；覆盖临时名碰撞及后续名字复用，持续目录同步失败以AggregateError报告。
  已有metadata提交未知测试仍验证正文保留，同步改动没有扩大补偿删除边界，也未装配后置恢复或回收。
- 自审已核对错误脱敏、旧客户端拒绝、schema空值语义、原actor权限、首次审计、无覆盖发布及失败收尾；未发现新产品缺陷。
  文件和目录sync/await四个隔离变异分别由永久用例的同步/顺序断言拦截，非加载失败；未修改工作区源码做变异。
  合成sync测试只验证调用与等待契约，不宣称真实断电或T8恢复验收通过。

### 14.2 本轮验证与失败处置

Node 22.23.3。证据归档 `release-gate-artifacts/t2-three-p2-2026-10-24/`；所有测试仅合成数据。

| 命令/范围 | 本轮结果 |
| --- | --- |
| 旧实现新增JWT/正文反例 | 6 failed / 6 passed，exit 1；JWT实际403，文件/目录sync被绕过 |
| 旧实现新增快照正式HTTP反例 | 1 failed，旧actualMinutes=12残留；定向执行未选其他用例，不是跳过全套门禁 |
| Jest定向 productionErrorContract / privateMediaStore / completionUpload | 3 suites / 37 passed，exit 0 |
| homework正式装配完整套件（旧JWT断言同步后） | 1 suite / 106 passed，exit 0；401和稳定码同时断言 |
| `CI=true npm test --prefix frontend/web -- --runInBand` | 40 suites / 490 passed，exit 0 |
| `npm run test:t2:integration` | 最终2 suites / 14 passed，exit 0 |
| `CI=true BUILD_PATH=/tmp/lms-t2-three-p2-build npm run build --prefix frontend/web` | exit 0；main.6f7b5b6c.js，前端产品源码未改 |
| `T2_WEB_BUILD=/tmp/lms-t2-three-p2-build npm run test:t2:e2e` | 14 passed，0 retries，exit 0；家长/孩子及四种视口，非真机 |
| 最终源码冻结后相同浏览器入口复验 | 再次14 passed，0 retries，exit 0；browser-verified报告，包含清理所有权自审后的最终store |
| 现有Task11 / Task12 Playwright配置 | 4 passed / 1 passed，exit 0；正式enabled工厂，原图片/PDF及共管兼容 |
| 隔离移除文件sync、文件await、发布目录sync、目录await | 四轮均exit 1且命中同步/顺序断言；不是模块加载错误或超时 |
| `npm run test:family-regression` | 143 suites / 3926 tests：142套件3925项通过、1项旧JWT403断言失败，exit 1；无skipped。同步契约后该完整套件106项通过；没有重跑第二轮全仓，不宣称最终全仓全绿 |

定向复现入口（Node22，JSON输出参数可按归档文件名增加）：
```bash
npx jest --config=backend/jest.config.js --coverage=false --selectProjects family-common resource-family --runInBand --testPathPattern="productionErrorContract|privateMediaStore|completionUpload.test"
npx jest --config=backend/services/homework-service/jest.config.js --coverage=false --runInBand --testPathPattern=growthTaskCompletionProductionAssembly
```
`npm run docs:family:check`及`git diff --check`通过，exit 0。候选180项SHA-256清单与旧归档分开保存。

失败记录保留：
1. 正式HTTP初轮2失败。临时加了一次非必要的孩子登录触发真实 `429 RATE_LIMITED`，使旧孩子token未更新，后续上传报 `401 STALE_CHILD_TOKEN`。
   通过脱敏status/code诊断重现两项原因；该快照用例只需新GET，删除新增的冗余登录，不删任何原回归用例、不提高限流阈值。
   原重登用例及新增真实过期重登浏览器测试均保留。最终完整HTTP通过。
2. 沙箱Chromium不能注册MachPort，8项启动失败、6项未执行，主动停止exit130；随后获执行权限后用同一配置运行，不修改安全断言。
3. 获权限后的浏览器初轮13通过/1失败。新增迟到JWT夹具仅在单个请求注入过期JWT，第二标签仍有有效凭据，直接打开登录页会被守卫重定向。
   改为第二标签先正常退出再登录兄弟姐妹，保持原401延迟与新身份断言；最终14通过。
4. caniuse-lite、NO_COLOR/FORCE_COLOR及旧开发服务器弃用提示保留，不升级无关依赖。
5. 本轮家庭后端全量发现正式装配套件仍断言“过期JWT=403”。按方案同步为精确`401 UNAUTHENTICATED`，
   未删除测试或放宽断言；该套件完整106项已通过。原全量失败报告仍保留，不替换成绿色报告。
   本轮后置D2B-05所在套件通过，与独立基线的code50失败不同；不据一次通过关闭该历史问题或后置范围。

正式HTTP与浏览器使用Gateway/user/homework/resource/progress正式工厂及真实接口、临时副本集/存储；
媒体安全profile为trusted-local，不冒称ClamAV扫描或真实部署。新回收关闭，旧客户端升级拒绝，凭据/上传guard/日志/索引/预检不删减。
上述是开发提交复评时的历史状态，不自动构成批准；后续独立复审和用户关闭裁决见 §15。原失败记录、DEVICE_PENDING 与 REMAINDER_DEFERRED 保持。

## 15. T2 合成范围工程验收与关闭裁决（2026-10-24）

> 历史收口快照，保留原批准引用及验证证据。该裁决曾由 §16 的待批准要求覆盖；当前限定范围批准以 §17 为准，不能引用本节的旧绿灯覆盖 §16 最新失败。

**Decision:** APPROVED / CLOSED。
**Closure scope:** ENGINEERING_SYNTHETIC_ONLY。
**Approval source:** 本评审线程用户直接指令：“先一次性完成 T2 的缺陷／证据／文档与批准收口”。基于此前独立复审通过，批准 T2-2 至 T2-6 合成工程验收及三项 P2 关闭；不解释为真实设备、部署或全部 SL-01 完成。

### 15.1 缺陷与批次裁决

| 项目 | 独立复核依据 | 当前裁决 |
| --- | --- | --- |
| T2-P2-JWT | 真实过期 JWT 精确 401/UNAUTHENTICATED；家长/孩子重登同 actor 原命令恢复、迟到响应隔离；业务 403 不注销 | CLOSED |
| T2-P2-SNAPSHOT | 五个可选完成字段省略后在原 CAS 事务清除旧投影；原始 Mongo、GET、历史重放、确认及页面清空反例一致 | CLOSED |
| T2-P2-BODY-SYNC | 正文文件和发布目录均等待 sync；同步失败不派发元数据；所有权安全清理与元数据未知时保留正文；四种 sync/await 变异均被断言捕获 | CLOSED |
| 总体设计状态滞后（P3） | 已纠正“前端未实施／T2-1 启动”等当前摘要；执行记录、Gate、计划、导航、追踪及详细设计一致 | CLOSED |
| T2-2 至 T2-5 | 完成/修改、原命令恢复、0–10 图、权限与版本审核、孩子回看/家长反馈及兼容通过 | CLOSED（合成工程） |
| T2-6 / T2 工程总门禁 | 正式 enabled 工厂、真实 HTTP/浏览器、完整回归、独立复核及用户批准齐备 | CLOSED（ENGINEERING_SYNTHETIC_ONLY） |

T2-1、T2-R、原两项页面 P2 及 T1 已关闭裁决保持；不重复打开或以本次裁决覆盖原审批。

### 15.2 最终独立复审证据

本表为此前独立复审实际重新执行的结果，本次收口归档复用，不声称本次文档更新重新执行全部业务测试。
归档：[证据索引](evidence/t2-synthetic-2026-10-24/README.md#历史独立验收)；[批准记录正本](family-self-directed-learning-t2-closure-approval.json)放在可纳入版本管理的 docs 目录，证据归档内保留逐字副本。校验器不依赖被 Git 忽略的本地证据目录。

| 验证范围 | 最终独立结果 | 证据文件（归档目录内） |
| --- | --- | --- |
| 家庭后端全量 | 143 suites / 3926 passed，0 failed/pending，exit 0 | review/family.json、family.log |
| 前端完整回归 | 40 suites / 490 passed，0 failed/pending，exit 0 | review/frontend.json、frontend.log |
| 正式 T2 HTTP | 2 suites / 14 passed，exit 0 | review/http.json、http.log |
| Gateway/正文/上传定向 | 3 suites / 37 passed，exit 0 | review/unit.json、unit.log |
| 前端正式构建 | exit 0；main.6f7b5b6c.js，与浏览器受测包一致 | review/build.log、build/asset-manifest.json |
| T2 真实浏览器 | 14 passed，0 retries，exit 0；家长/孩子四种视口 | review/browser.log、browser/ 中 8 张截图 |
| 原 Task11 / Task12 浏览器兼容 | 4 passed / 1 passed，exit 0 | review/task11.log、task12.log |
| 隔离变异 | 文件 sync、文件 await、目录 sync、目录 await 均 exit 1，分别 1/1/2/2 个预期断言失败；运行错误 0 | review/mutant-*.json/log |

候选基底 `79b346155abf4fefd2afdabe12c7e5a87db1448e` 的未提交工作区，不能仅用 HEAD 代表候选。
独立复审前后 180 项源码 SHA-256 全部匹配原候选清单；本次编辑前再次核对 180/180 匹配。
受测 JS SHA-256：`e930b81cb86dedf1b7be7370aaa2ba9a4eb82d3c3f44f9b70ac439ed03cb5f41`。
保留原候选清单，不将本次文档/校验器更新混入原业务受测快照；本次更新另存 closeout-source-manifest.json。
归档报告/日志副本机械脱敏，不改结果、断言状态或计数；用例名如含合成凭据字面值也脱敏。原文件位于 `/tmp/lms-independent-three-p2-20261024-*`，归档清单记录原始及归档 SHA-256。

§14.2 开发轮全量旧 JWT403 断言失败仍留原归档；本次最终独立全量 3926/3926 覆盖更新后的精确 401 断言，不以 106 项定向替代全量。
历史 D2B-05 code50、HTTP 限流/token、浏览器夹具和构建 lint 失败均保留，不把单轮通过视为后置模块稳定性已关闭。
变异仅定向选择两条同步测试，报告中的 10 项未选用例不是完整门禁跳过；完整家庭全量无 pending。

### 15.3 保留义务与本次验证边界

| 范围 | 保留状态 / 下一次触发 |
| --- | --- |
| TC-SL-IPAD-001..004 | DEVICE_PENDING；真实 iPad Safari 输入、HEIC 退路、断网/重登、回看、旋转和审核冲突，真实家庭启用前完成 |
| Ubuntu/NAS、备份、隔离恢复与部署 | T8_PENDING / NOT_AUTHORIZED；需另行授权和实测，不使用合成浏览器或 sync 调用断言代替恢复/断电演练 |
| T2-G/D01、新孤儿回收、D2b/D3/D4/E、C-CACHE-P3 | REMAINDER_DEFERRED；不装配半成品恢复 writer，不运行新回收/恢复，不因本次关闭改为通过 |
| SL-01、T3–T9 | SL-01 仍 PLANNED；T3–T9 NOT_STARTED，本次不自动开工 |

本次仅更新证据、批准记录、文档和状态校验反例；当前执行的文档门禁、校验器测试、链接/围栏、源码不变性及空白检查结果见证据索引和 closeout-validation.json。
无业务源码、真实数据/NAS、依赖/默认开关、部署或 Git 提交/推送改动。
如需撤销批准，仅回退本次文档/校验器及追加纠正记录，不重置用户工作区、不删除旧失败证据，也不撤销已发生的隐私删除。

## 16. 三项 P2 批准关闭与工程验收再申请（2026-10-24）

> 本节保留申请时的待批准裁决；当前批准见 §17。§16.2 的最新全量失败和原始报告仍有效，不因关闭而改绿。

**Current decision:** 三项 P2 APPROVED / CLOSED；T2 工程验收及总门禁关闭 PENDING_USER_APPROVAL。
**Current gate:** OPEN / IN_PROGRESS。拟关闭范围仅 ENGINEERING_SYNTHETIC_ONLY。
**Engineering review:** READY_FOR_REVIEW_WITH_DEFERRED_FAILURE；不宣称最新全量全绿。

用户最新直接指令：“复审通过，更新门禁和评审记录，关闭本次三项 P2。补跑修订后的家庭后端全量回归，保留旧失败证据，更新 T2 工程验收及总门禁关闭评审材料，待我批准后再关闭。”
本轮开始时工作区已有 §15 / Gate §22.4 的 CLOSED 收口记录。本次遵循最新指令恢复当前待批准状态，
保留原节、原批准引用和原归档，不判定或抹除此前授权事实，不重新打开已批准的缺陷。
[当前结构化裁决](family-self-directed-learning-t2-closure-approval.json)保存 previousDecision；
原逐字批准副本仍在 `t2-engineering-closure-2026-10-24/approval.json`，不再声称与当前正本相同。

### 16.1 本次批准关闭的缺陷

| 编号 | 已复审的闭环与永久反例 | 裁决 |
| --- | --- | --- |
| T2-P2-JWT | 真实过期/无效 JWT 返回401/UNAUTHENTICATED，内部异常500；两角色重登保留原命令/远程映射；业务403和迟到401隔离 | CLOSED，用户批准 |
| T2-P2-SNAPSHOT | 五字段缺省在最终 CAS 事务内 unset；持久快照、GET、旧/新重放及确认一致，首次审计和单次发星保留 | CLOSED，用户批准 |
| T2-P2-BODY-SYNC | 文件及发布目录 sync/await，元数据前失败收尾、路径所有权、未知提交保留正文；四种变异均被有效断言拦截 | CLOSED，用户批准 |

依据为 §14 的实现及永久用例、已通过的独立复审和本次用户确认；旧两项页面 P2、T2-1、T2-R、T1 关闭不变。
本轮不修改产品逻辑、后置恢复/回收实现、运行依赖或真实配置。状态校验和反例只同步最新授权边界。

### 16.2 本轮全量与历史证据对照

Node 22.23.3，仓库根实际执行：
```bash
npm run test:family-regression -- --json --outputFile=/tmp/t2-approved-p2-family-20261024.json
```
完整 stdout/stderr 保存于同名前缀 `.log`。结果 **143 suites：142 passed / 1 failed；3943 tests：3942 passed / 1 failed / 0 pending；exit 1；726.558 秒**。
启动后至全量结束未编辑仓库文件，1686 项文件清单无漂移。完整报告单独归档，不用重跑或定向通过覆盖失败。

| 轮次 | 结果与含义 |
| --- | --- |
| §14.2 开发全量 | 143/3926，3925通过、1项旧 JWT403 断言失败，exit1；原归档保留 |
| §15.2 既有独立全量 | 143/3926全部通过，exit0；原报告/51份归档文件哈希匹配，仍保留，但不是本轮结果 |
| 本轮最新全量 | 143/3943，3942通过、仅 D2B-05 code50失败，exit1；旧 JWT 用例及三项修订相关套件通过 |
| 本次文档状态增量 | 全量结束后更新待批准状态和校验反例，另跑文档套件及 family-common；详见新归档 validation.json，不冒称全量已包含这些后续文档改动 |

3943 与旧3926相差17项，全部来自此前收口增加的文档状态测试（34→51），不是删减、跳过或改名业务用例。
本轮文档更新再增加2项批准记录反例；不把后续公共模块计数叠加为新一轮全量。

唯一失败：`userDeletionRecoveryReadiness.test.js:619` 的
`D2B-05 real connected proof bytes exceed 16MiB before the 100-file ceiling`。
预期 `USER_DELETION_EVIDENCE_INVALID`、无 nativeErrors；实际 `mediareferences` 查询超时（MongoServerError code50），
得到 `USER_DELETION_READINESS_NOT_READY`。与原后置 D2b 容量失败一致，不是 JWT/快照/正文同步回归。
静态检查该模块仅被其测试引用，未装配至正式 server 或当前页面运行依赖；不放宽超时/断言，不跳过，不重跑掩盖，不在本轮扩展修复。
因此该失败继续登记 REMAINDER_DEFERRED，但最新全量状态仍为 FAILED，不能以“后置”将报告改绿。

当前证据索引：[本轮验收材料](evidence/t2-synthetic-2026-10-24/README.md#最新全量失败)。
原三项 P2 归档、原独立绿灯归档、T1及后置失败全部原样保留。本轮只新增独立归档及当前文档状态；归档副本脱敏不改变断言状态/计数。

### 16.3 工程退出条件核对

| 条件 | 证据 / 本次核对 | 当前状态 |
| --- | --- | --- |
| T2-2 API、命令及会话 | §14与独立复审：40套件490项前端、原命令/两角色重登/迟到响应；产品源码未变 | READY_FOR_ACCEPTANCE |
| T2-3 图片及正常隐私删除 | 0/1/10、边界拒绝、部分失败、普通移除不删正文、正常删除凭证与授权失效；本轮上传/权限/私有存储套件通过 | READY_FOR_ACCEPTANCE |
| T2-4/5 提交、版本审核、回看反馈 | 既有正式HTTP2/14、真实Chromium14/0 retries，覆盖按所见版本确认、冲突重看、共管首次审计；产品源码未变 | READY_FOR_ACCEPTANCE |
| 八项必要失败/权限场景 | §12.2矩阵及§14永久反例保留；本轮相关后端回归通过，不用mock替代正式HTTP/浏览器 | 证据具备 |
| 构建与原材料/错题PDF兼容 | 复用已核对的构建哈希、Task11浏览器4项/Task12浏览器1项；本轮未重复构建或浏览器测试 | 证据具备，注明历史轮次 |
| T2-6 全量、QA与用户裁决 | 修订独立复审通过；本轮全量仅后置D2B-05失败；最新状态校验及公共模块另验 | PENDING_USER_APPROVAL，保留全量限制 |
| 真机/真实部署/高级能力 | §13.2及§15.3义务原样保留，不纳入本次工程通过范围 | DEVICE_PENDING / T8_PENDING / REMAINDER_DEFERRED |

### 16.4 待批准事项与限制

提交评审的是 T2-2 至 T2-6 的既定合成范围工程验收，以及同范围 T2 工程总门禁关闭。
需要用户明确批准，且须知悉最新全量中的后置 D2B-05 失败；可按 §11 的范围裁决保留该项而评审页面工程，
但不能称完整后端全量已通过，不能随工程批准关闭该缺陷或启用高级恢复。当前不执行关闭、不自动开始 T3–T9。

真实 iPad 继续 DEVICE_PENDING：实测拍照JPEG、HEIC导出退路、文件多选/大小边界、断网重登、旋转、回看和审核冲突。
T8真实Ubuntu/NAS、备份、隔离恢复、容量/保留与部署需单独授权；合成fsync和浏览器不代替真实断电/设备验收。
高级恢复、新回收、D01/T2-G、D2b/D3/D4/E、C-CACHE-P3维持 REMAINDER_DEFERRED；不执行cleanup/restore，不装配未完成writer。
保持旧客户端升级拒绝、默认关闭配置、现有凭据/日志/索引/上传保护和预检；仅合成验证，不部署、不提交或推送Git。

### 16.5 本次文档更新验证与自查

全量结束后才修改当前摘要、批准记录及文档校验器；T2-1/T2-R/T1和旧缺陷裁决不变。
新待批准反例配旧校验器先得到23失败/30通过，exit1；随后同步校验器。
首轮文档验证5失败/48通过，公共模块首轮13失败/643通过，均因新证据README尚未落盘而链接不存在；
补齐索引后才复验，原两份失败报告独立保留，不删除或放宽链接断言。

最终实际执行（Node22）：
- `npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js`：1套件53项通过，0失败/跳过，exit0。
- `npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false`：41套件656项通过，0失败/跳过，exit0。
- `npm run docs:family:check`、两份JS语法检查、`git diff --check`通过；本轮文档路径/标题链接与围栏另检，结果存 validation.json。

自查：当前唯一T2状态为IN_PROGRESS，批准记录为PENDING_USER_APPROVAL/OPEN，三项P2单独CLOSED；
正常Markdown空白可接受，缺失/重复/冲突状态及未批准关闭被拒绝，设备/部署/后置义务和后续任务不得冒批。
历史§15/§22.4明确标为被最新指令覆盖，不删除原收口、旧失败或原绿灯；不把本轮后置失败改为通过。
归档哈希及1686项前后对照仅允许文档和状态校验/测试变化，未修改业务源码或真实配置。

## 17. T2 限定合成范围批准关闭（2026-10-24）

> 历史批准快照：本节“最新”指原批准时点；原指令、全量失败及禁止事项不回写。后续查询缺陷关闭及当前分支提交/推送授权另见 §18。

**Decision:** APPROVED / CLOSED。**Scope:** ENGINEERING_SYNTHETIC_ONLY。
**Latest full regression:** FAILED / exit1；D2B-05 REMAINDER_DEFERRED，未关闭。

用户明确批准：“批准 T2 限定合成范围的工程验收及总门禁关闭，同步更新门禁、评审记录、实施计划和状态校验。保留本轮 D2B-05 失败证据，不将全量写为全绿；真机保持 DEVICE_PENDING，高级恢复与新回收继续后置，不部署、不提交或推送 Git。”

依据 §11 范围、§12–§14 闭环与复审证据、§16.2 最新全量失败及 §16.3 工程条件核对，
关闭 T2-2 至 T2-6 的限定合成工程验收及同范围 T2 总门禁。T2-1、T2-R、三项 P2 及 T1 原关闭不变。
[批准正本](family-self-directed-learning-t2-closure-approval.json)保留完整指令及前两次裁决链，
最新裁决覆盖 §16 的待批准状态，但不覆盖、改写或豁免其原始测试失败。

### 17.1 验收范围与未关闭义务

- 已验收：孩子提交/确认前修改、家长按所见版本审核、孩子回看反馈；原命令重试及重登恢复、身份隔离、0–10图及正常隐私删除。
- 复用原正式 HTTP、浏览器、组件、构建和复审证据；本轮不修改业务代码，不将旧证据冒称本轮重新执行。
- 最新家庭后端全量仍为143套件142通过/1失败、3943项3942通过/1失败/0跳过，exit1。D2B-05 的 code50 失败保持 §16.2 原报告，不写全绿。
- 真机 DEVICE_PENDING：iPad 拍照/文件选择、HEIC退路、多图边界、断网重登、旋转布局、回看及审核冲突仍需实测。
- 高级恢复、新回收及 D01/T2-G、D2b/D3/D4/E、C-CACHE-P3 继续 REMAINDER_DEFERRED；此次关闭不意味着这些功能完成或可启用。
- T8_PENDING / NOT_AUTHORIZED：真实家庭备份/隔离恢复、容量/保留、Ubuntu/NAS及部署未授权。SL-01仍PLANNED，T3–T9不自动启动。

现有默认关闭配置、旧客户端升级拒绝、服务凭据、上传保护、日志目录、索引和启动预检不变。
只同步批准状态、追踪、实施计划和校验器；不运行真实 cleanup/restore，不部署、不提交或推送 Git。

### 17.2 状态保护与验证

状态校验要求当前状态表唯一 T2 CLOSED、批准正本 APPROVED/CLOSED、T2-2 至 T2-6 CLOSED，
且范围必须为 ENGINEERING_SYNTHETIC_ONLY。永久反例继续覆盖漏行、重复/矛盾状态、空白变体、真机/部署/后置范围和后续任务冒批；
新增对最新全量 FAILED、失败计数、D2B-05 后置以及失败证据路径的保护。

本轮验证及自查结果记录于[关闭验证归档](evidence/t2-synthetic-2026-10-24/README.md#限定范围关闭验证)。实际执行 Node22：

- 文档套件：`npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js`，59项通过，0失败/跳过，exit0。
- 公共模块：`npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false`，41套件662项通过，0失败/跳过，exit0。
- `npm run docs:family:check`、两份JS语法检查、`git diff --check`、8份Markdown的180处本地路径/锚点及围栏检查通过。
- 新关闭测试配旧待批准校验器先得到29失败/30通过；同步校验器后，空白正例夹具漏改旧 IN_PROGRESS 导致文档1失败/58通过、公共模块1失败/661通过。仅将该正例状态改为 CLOSED，保留空白变体及反例断言后通过；三份失败报告分别保留，不冒称首轮全绿。

自查：当前唯一T2行、执行头、批准记录、计划、导航、总体/详细设计及需求追踪一致；六项新增反例保护全量结果/失败计数、D2B-05后置、证据路径、门禁失败摘要及禁止Git操作。
本轮不重跑业务全量、前端/HTTP/浏览器或构建；§16全量失败仍为最新结果，不将662项公共模块计数累加为新的业务全量。
历史三处归档132份文件哈希保留并核对；仅10份既有文档/校验器/测试文件变化，无业务源码或真实配置修改。
回滚仅纠正文档/状态校验，不重置继承工作区或删除历史证据。

## 18. D2B-05 查询超时复审与批准关闭（2026-10-24）

**Decision:** APPROVED / CLOSED。**Scope:** QUERY_ONLY。**Fix:** `e744cba1`。
用户批准：“复审通过，更新门禁和评审记录，关闭 D2B-05 查询超时问题，验证后提交推送当前分支并同步 PR #27。保留历史失败证据、DEVICE_PENDING 和高级恢复及新回收的后置状态，暂不合并、不部署。”
中断后的继续指令再次确认完成关闭记录、保留原批准时失败快照，以及相同的 Git/部署边界。

### 18.1 复审结论和关闭依据

- 查询改写满足布尔分配律，group/ref 字段在调用前已严格校验；完整代次和重绑槽位两类引用均保留。
- 目标媒体和已记录引用ID查询未删除；字符串BSON身份仍被读后严格拒绝，跨孩子异常仍由 ownerScope 拒绝，不通过提前过滤隐藏。
- 保留5000ms上限、读取上限、完整集合/精确代次、游标关闭及只读无副作用；没有接入高级恢复生产路由。
- 新增7项永久回归，结构反例在旧实现失败（预期最多3个分支、实际5），修复后通过；原测试AST完整保留。
- 复审实际运行完整相关套件：139项通过、0失败/跳过，exit0，162.329秒；`npm run docs:family:check` 和 `git diff --check` 通过。未发现新增问题。
- [修复后CI](https://github.com/mflyn/LMS/actions/runs/40099315976) 后端143/3958、前端40/490、集成、构建、浏览器5项、合成Compose及清洁检查均通过；与 e744cba1 匹配。手动性能/安全扫描/镜像发布/部署未运行，不计为通过。

复审报告 `/tmp/d2b-review.json` SHA-256：`e8ab3fca62df4066cd349c53c95c13834c42b9d169996f669d108fffe53ccc5e`。
148份历史归档和修复/CI的19/30份归档哈希均一致；原失败不删除、不改写。修复前后的观测耗时见[修复摘要](evidence/t2-synthetic-2026-10-24/pr27-d2b-query-fix.json)，不是性能SLA。

### 18.2 状态分离及本轮验证

原 `family-self-directed-learning-t2-closure-approval.json` 不修改：其中 FAILED/1项失败/REMAINDER_DEFERRED 是原批准时点事实。
门禁将该快照命名为 `T2 approval-time full regression`，另列修复后CI和 `D2B-05 query timeout: APPROVED / CLOSED / QUERY_ONLY`；不把缺陷关闭扩大为高级恢复能力完成。
在既有校验器内补充正例及缺失/扩大/重复关闭、替换CI证据的4项负向用例；原历史失败不可改绿、DEVICE_PENDING、REMAINDER_DEFERRED 和禁止真实部署等反例继续保留。
新用例配旧状态/校验器先得到6失败、58通过（exit1），用于证明缺少关闭记录和历史/当前分离时不能通过；不删除该红灯证据。
本轮实际验证（Node22.23.3）：

- `npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js`：64项通过，0失败/跳过，exit0（6.68秒）。
- `npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false`：41套件667项通过，0失败/跳过，exit0（31.172秒）。比原662项新增1项正例、4项负向用例，没有删减原测试。
- `npm run docs:family:check` 和 `npm run lint`：干净跟踪文件导出副本中通过，不依赖本地忽略归档；没有修改lint规则或删除历史JS快照。
- `git diff --check`、增量Gitleaks扫描通过（零命中）；原批准JSON逐字不变，148份历史归档哈希一致。

本轮仅文档和门禁校验变化，不用上述公共模块结果冒称新跑业务全量；推送后CI另行对应新提交，结果同步PR。
红/绿及公共模块报告、命令日志与哈希清单独立保留在本地 `release-gate-artifacts/t2-pr27-d2b-close-2026-10-24/`，不覆盖先前修复及失败归档。
自查确认历史失败字段仍严格校验，新增当前查询缺陷状态与已核实CI分离；没有关闭D2B整批、增加产品能力或放宽设备/部署边界。

仅授权提交/推送 `codex/t2-synthetic-acceptance` 并同步 PR #27；不合并、不部署、不操作真实孩子数据/NAS。
DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、高级恢复与新回收及 D01/T2-G、D2b剩余/D3/D4/E、C-CACHE-P3 的 REMAINDER_DEFERRED 保持。默认关闭配置、旧客户端升级拒绝及现有安全运行依赖不变。

## 19. Ubuntu QA 后四项 P2 修订（2026-10-25）

本轮在54886573之后补齐动态弹窗焦点、WebKit真实上传故障点、邀请preview异步等待，并优化既有只读闭包的重复发现/键查找。
修订核实、方案、自查、红绿证据与限制见[评审记录](family-self-directed-learning-t2-qa-p2-review.md)；[服务器隔离步骤](family-self-directed-learning-t2-server-test.md)仅准备，未执行。
独立代码评审未发现可执行新问题，审查范围为9个已跟踪JS及新增FamilyDialog测试；审查员核对既有证据并自行执行diff检查，没有冒称重跑全部测试。
本机前端499项、readiness142项、T2正式HTTP14项、Chromium/WebKit各14项、Task12浏览器1项通过；完整回归和静态检查详见该轮证据摘要。
三项UI/测试问题为IMPLEMENTED / READY_FOR_QA；QA-T2-D2B-BUDGET-001为IMPLEMENTED / SERVER_VALIDATION_PENDING，仍需原Ubuntu2CPU/3GiB预算复验。
§17原批准失败和§18查询缺陷关闭保持原样，不把测试级预算超时混同Mongo code50，不提前关闭新增QA问题或后置能力。
本轮用户授权验证后提交推送当前分支并同步PR #27，暂不合并、不部署；DEVICE_PENDING及REMAINDER_DEFERRED不变。

### 19.1 固定候选 Ubuntu 预算复验续项

固定4dff6871的独立Ubuntu复验出现readiness 141通过/1超时；随后家庭全量通过不覆盖该失败。
基于同限额实测，仅合并两个调用点的重复证据校验与序列化，保留查询、完整校验、预算及所有原断言。
[实测、实现前自查和后续结果](family-self-directed-learning-t2-d2b-budget-followup.md)单独记录；当时预算缺陷保持OPEN，待独立QA，最新批准见 §19.2。
本续项不提交、推送、合并或部署；原批准正本、历史失败、DEVICE_PENDING和REMAINDER_DEFERRED不变。

### 19.2 D2B 预算及隔离 P3 批准关闭（2026-10-25）

**D2B budget:** APPROVED / CLOSED / SYNTHETIC_ONLY
**D2B isolation P3:** APPROVED / CLOSED
**D2B retained:** HISTORICAL_FAILURES_PRESERVED / DEVICE_PENDING / REMAINDER_DEFERRED / T8_PENDING / NOT_AUTHORIZED

按用户本次批准关闭 QA-T2-D2B-BUDGET-001 及组合结果双向隔离 P3，依据见[复审及证据边界](family-self-directed-learning-t2-d2b-budget-followup.md#6-复审通过及批准关闭2026-10-25)。
同限额 Ubuntu readiness142项、家庭144套件3972项、正式HTTP14项通过；最终P3断言另行6项补验，复审331项及两类变异通过。
原批准失败和固定4dff6871超时保留，不改历史归档、不冒称最终断言重新执行过全量；仅更新当前关闭状态。
本次P3不包含后置C-CACHE-P3。D01/T2-G、D2b剩余/D3/D4/E、高级恢复、新回收继续后置，真机及真实部署未验收。
本轮只做文档与状态校验，不提交、推送、合并或部署，不扩大已批准的合成范围。

### 19.3 三项独立 QA 关闭及 PR 合并交接（2026-10-25）

用户批准同步三项已有独立复评：QA-T2-FOCUS-001、QA-T2-WEBKIT-FIXTURE-001、QA-T12-INVITATION-WAIT-001
均为 VERIFIED_CLOSED / AUTOMATED_SYNTHETIC_ONLY。§19 的 READY_FOR_QA 是历史交接，不再是当前状态。
依据为固定4dff6871的独立R1报告；85份归档哈希一致，前端和浏览器源码至07ffca67未变，未重新冒称执行这些独立测试。
详细证据及哈希见[评审记录 §5](family-self-directed-learning-t2-qa-p2-review.md#5-三项独立-qa-关闭与条件合并授权2026-10-25)。
本次只同步文档；验证、提交推送后，须等新提交CI通过，才将PR #27转为Ready，以merge commit合并并核对main的CI。
每个最终SHA及CI结果在PR单独记录；当前授权不表示已合并，不覆盖原批准或R1预算失败快照。
真机DEVICE_PENDING、高级恢复/新回收及全部后置范围不变，不部署、不访问真实数据/NAS，不启用cleanup/restore。

### 19.4 四项独立证据收口与最新授权（2026-10-25）

**Current independent QA:** VERIFIED_CLOSED_FOR_AUTOMATED_SCOPE（四项，非产品/真机/发布批准）
**Current authorization:** COMMIT_PUSH_PR_SYNC_ALLOWED / NO_MERGE_DEPLOY

四项独立QA文档已补齐并经用户确认复审通过；最新授权为验证后提交推送当前分支、同步PR #27并检查CI。§19.3中的条件合并安排仍暂停；已提交推送的a9e21fe6不回滚，不转Ready或合并，CI成功也不解除限制。复审和授权详见[评审记录 §6.2](family-self-directed-learning-t2-qa-p2-review.md#62-四项文档收口复审通过及提交授权)。
R1前三项和R2预算项的结论、源候选、各轮验证和限制见[评审记录 §6](family-self-directed-learning-t2-qa-p2-review.md#6-四项最终独立-qa-与本地收口2026-10-25)，
持久索引见[四项独立证据](evidence/t2-synthetic-2026-10-24/pr27-independent-qa-closure.json)。
R1 85份及R2 60份冻结归档核验一致；当前五份资源代码/注册/最终测试与R2一致，其他文档/门禁变更单独披露。
原预算失败、旧批准和开发补验记录不重写；本次不重跑服务器服务、不改业务实现、不触碰真实数据或后置功能。
DEVICE_PENDING、T8未验收、真实学习效果与高级恢复/新回收后置保持，不能把本次文档验证冒称这些能力已完成。
