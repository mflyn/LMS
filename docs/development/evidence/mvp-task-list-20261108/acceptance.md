# MVP 任务列表分页与回看验收及交付

日期：2026-11-08。用户在本轮复审通过、下一步范围明确后批准执行局部收口及专用分支交付。

**Batch:** ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY
**Filtered/off-page saved-detail P2:** CLOSED / USER_APPROVED
**Delivery:** DEDICATED_BRANCH / DRAFT_PR / CI_AUTHORIZED
**Merge / real model / server / deployment:** NOT_AUTHORIZED
**Retained gates:** T4 OPEN / T8 OPEN / AI-1 OPEN
**Server timing:** SERVER_TIMING_UNVERIFIED
**Device:** DEVICE_PENDING
**Docker audit:** INCOMPLETE_FAILED
**Historical failures / nonblocking tests:** PRESERVED / RETAINED
**Deferred scope:** REMAINDER_DEFERRED
**Real model counter:** QUALIFIED_COUNTER_PENDING

## 范围与关闭依据

基线为 `01a61c63fddee7f97fa50c307780cc3fba3830c6`（PR #42已合并）。完整候选仅有三份实现/测试文件：

- `frontend/web/src/pages/family/TasksPage.js`：创建成功后重读服务端列表及分页；详情回传只更新当前列表已有行，不插入筛选外或页外任务。
- `frontend/web/src/__tests__/family/Task9TodayTasks.test.js`：保留原断言，补齐创建分页、筛选外回看、页外20行边界及创建后读取失败仅重试GET；当前行完成、确认和归档仍受正例保护。
- `tests/e2e/t2/checklist.spec.js`：真实页面创建、过滤、查看已保存任务、关闭、切回全部，验证总数及POST次数。

当前行更新不是空回调，也不依赖额外列表GET。原编辑/恢复/取消归档入口及家庭/孩子/会话保护未改动。
没有后端业务、API、模型、部署默认值、依赖、CI工作流或WP1/T8执行器变更。
本轮复审未发现新增可复现问题；两份测试的原expect调用链逐项比对保留，未放宽断言、超时或增加重试。

## 冻结身份

本地批准的完整候选补丁SHA-256：
`450737162a45107e84a1779b715effb1db79e51d8e3b9e9e2e3eb9d907eb4503`。
补丁相对上述main基线，包含原分页修订和本次P2修订，不只是未提交候选上的增量。
当前源码哈希、基线重建、复用构建均与批准候选一致。公开[证据清单](manifest.json)绑定源码、构建及分批原件摘要。

公开[candidate.patch](candidate.patch)使用同一基线的零上下文表示，避免补丁中的空白上下文行触发提交空白检查；
其独立摘要记录为清单中的 `publicPatchSha256`，不冒充原冻结补丁哈希。使用 `git apply --unidiff-zero`
从固定基线重建三文件并逐一核验批准源码哈希；原完整补丁不改写，空白检查规则未放宽。

本机归档批次标识为 `mvp-walkthrough-20261108`、`mvp-walkthrough-review-20261108`、
`mvp-filter-fix-20261108` 和 `mvp-filter-rereview-20261108`，分别62、27、35、18份清单条目。
旧候选补丁 `b64143d333eeb05c8322fc64b3b6072d8fbd7f14a538c6e650e283483c328987` 及旧失败记录原样保留。
公开包不复制原始日志、截图、合成媒体、数据库、机器路径或账号/服务凭据；原件及其哈希在本地保留。

## 分批验证

| 上下文 | 结果与边界 |
| --- | --- |
| 修复前定向组件红灯 | 两个反例失败、原正例通过；失败为筛选外标题仍在列表及20行变成21行。按名称筛选的22项未执行，不计整套回归 |
| 修复前浏览器红灯 | 1项失败；使用修复前构建，关闭详情后错误标题仍存在，不是环境启动失败 |
| 开发相关组件回归 | 6套97项通过，覆盖任务、求助、计划导航、清单、完成身份和来源入口 |
| 开发正式HTTP浏览器 | 8项通过，包含分页、分龄、编辑冲突、原命令恢复、身份和审核版本隔离及周复盘 |
| 开发构建 | 通过；保留既有caniuse-lite过旧提示，未更新依赖 |
| 本轮复审组件 | 6套97项通过，与开发结果不相加 |
| 本轮复审正式HTTP浏览器 | 4项通过：筛选外回看、四年级求助/提交/审核/回看、兄弟姐妹身份及迟到图片隔离、旧版本审核拒绝 |
| 本轮复审静态/文档 | 三文件ESLint、`npm run docs:family:check`、`git diff --check`及原档案哈希/补丁重建通过 |

组件使用API替身，正式HTTP浏览器使用既有Gateway及业务应用工厂/路由、临时MongoDB副本集和合成账号媒体。
完成协议在合成夹具中enabled，AI及新回收关闭；本机Chromium不是WebKit或iPad真机，也不是独立进程备份恢复或目标机验收。
页外20行场景由组件测试覆盖，真实HTTP浏览器不宣称已经做过41条任务的分页边界实跑。
复审使用哈希一致的开发构建，未重新构建；所有测试子进程正常结束，无收尾失败。
本次分批结果不覆盖既有历史失败，也不改写为一次全量通过。最新提交的完整CI结果以PR为准，提交前不预先宣称通过。

## 本次交付复验

在相同代码候选的专用分支执行 `CI=true npm run test:ci --prefix frontend/web -- --runInBand`：
72套1186项通过、0跳过，52.732秒；属于交付复验，不与上表97项相加，不冒称重跑全部历史后端或浏览器。
三文件ESLint、`npm run docs:family:check`及相对链接/候选哈希校验通过。构建和浏览器复用本次已复审证据，源码未变。
敏感信息检查覆盖完整提交文件及新增diff；门禁文档一条既有临时证据目录引用与main逐字相同，保留历史原文。
新增内容不包含私有机器路径、主机信息、真实凭据或孩子数据。公开清单只列原件逻辑名称、大小和摘要，原件不上传。

## 公开交付边界

本专用分支只加入上述三文件、四个现有导航/计划/门禁文档的最小追加、此记录、候选补丁及摘要清单。
原始混合工作区中的WP1/T8增量不移动、不删除、不提交；既有依赖软链接不加入提交。
既有历史记录及默认关闭配置保持；不新建测试或治理框架、不启动服务器演练或真实模型。
用户此次授权不包含合并、部署或MVP整体关闭；本批通过不关闭T4/T8/AI-1或真机/服务器门禁。
