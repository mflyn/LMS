# AI1 人工修订批准到 AI2 的合成连接验收

日期：2026-11-03。当前（2026-11-04）：用户复审批准本批限定合成连接验收，ACCEPTED / USER_APPROVED；三项测试保护P2 CLOSED / USER_APPROVED。
AI2-5 IMPLEMENTING，AI-2 OPEN；本次没有总门禁关闭授权。
矩阵归并见 [31项矩阵](matrix-reconciliation.md)，此前批准及失败快照见 [浏览器记录](browser-acceptance.md)。

## 范围与真实边界

- 新增两份显式跨仓验收文件：[JS](../../../../tests/e2e/t2/ai2Ai1Bridge.acceptance.js)、
  [Python入口](../../../../tests/e2e/t2/ai2_ai1_bridge_acceptance.py)。不改业务实现、旧测试断言、配置默认值或 DeepTutor。
- 真实运行本机 DeepTutor main、operation、SQLite store、受限 SDK，复用既有 `local/serve/run_lms`；
  Provider HTTP transport、计数器、时钟及测试凭据为明确合成替身，不是付费模型或计数资格验收。
- LMS 使用生产构建、正式 Gateway/user/homework/resource/progress 及现有 analytics/notification 应用、
  真实登录/PIN、临时 Mongo 副本集、文件媒体与 journal。媒体为 trusted-local profile，不声明 ClamAV 验收。
- 同一运行先从 task 或 media-only mistake 进入 Tutor，实际生成原候选、父母修订、共管父母批准，
  再点击真实“预览孩子可见内容”链接发布；不调用预置 approved 状态的 `createAi2Fixture()`。
- 随后实际孩子上传订正、家长看图退回、再次提交、家长看图通过、孩子刷新回看。
  精确检查两次 Attempt、当前指针、第一版正文/图片绑定/review不变，以及发布者、修订者、批准者和审核者。
- DeepTutor 子进程阻断出站 socket；浏览器只允许本机 origin；当前 Node worker 临时限制 TCP connect 为本地地址/本机 IPC。
  该测试保护不是系统级防火墙或通用网络沙箱。不读取真实密钥，不上传教材，不调用真实模型。

## 反例与不变量

1. 原 candidate 和人工 revision 未批准时，preview 和合法 publish 请求均为 `409 AI2_PUBLICATION_STALE`，
   AI2 各集合仍空、AI1完整持久快照不变；不是靠缺字段导致的400假阳性。
2. 批准本身不自动创建学习包；在当前 Cycle 版本下，原制品整组及单独旧 id、version、hash 均不能替代批准 revision。
3. 发布预览、原命令、持久 Package 和孩子 DTO 的制品、childSnapshot/hash、task/mistake source 精确一致。
   孩子详情/Attempt/media 子对象按白名单检查；孩子读原/批准 AI1 artifact 与 Cycle 仍为403。
4. AI2 阶段 DeepTutor operation 没有新增请求，Provider transport 没有新增尝试；整个测试仅前置 AI1 一次 PUT/一次合成尝试。
   预算、Job、Command、Artifact 不变；Cycle 只允许发布锁定的一次 stateVersion CAS 和对应 updatedAt。
5. 正式 HTTP 服务的教学/奖励写入口只观察不替换响应。无凭据 stars/award 的401探针证明拒绝的调用也会计数；
   批准后基线到AI2结束零新增教学写调用，同时 Task/Ledger/Mistake/MistakeStateEvent/DailyPlan 精确快照不变。
6. Node 三种非本地 TCP 参数形态在原始 connect 之前被拒绝；运行后记录只含这三个探针，不容许被吞掉的额外尝试。
   探针不发送网络请求，Node wrapper 和环境在 finally 恢复；独占 runtime/context 按既有机制收尾。

## 冻结与原始证据

归档标识相对原项目根目录，仅本机忽略目录，不代表 Git 提交或上传：
`release-gate-artifacts/ai2-5-bridge-20261103/`。

| 对象 | SHA-256 / 边界 |
| --- | --- |
| 基线 | `4655d30f1b61b55f400b67f16f9143dd191de1d2` |
| 累计94文件 candidate.json | `b2f1632a44d08145be938cabf4e46e9fa5d0222293dbe200c2eb5f711c709f16` |
| 累计 code-candidate.patch | `2cbf4a01a4ecb5d1ceca398325c4a45d7ebeae26bdbee51f631b4f5a48bd9dc7` |
| 作者98文件 evidence-manifest.json | `bd4b915face20a116037ecc078882a3ba0d1047c65bd942e1b7e3de8e86da7c4` |
| 上批92文件候选 | `54fac3b191715cb90343774aac7c8e87691201018852017d0986665e5e3c219a`，源码逐字节未改 |
| DeepTutor固定检出 | `a5e64ca49667ddba2a0ba80c02ac1c59959dc2f9`，工作区干净，4个复用helper哈希在candidate中 |

94文件从基线加累计补丁重建一致，排除无关T8增量。原92文件、旧candidate/manifest/失败记录均不改写。
作者98份归档包含成功、失败、XML、请求计数、截图和执行日志；不复制测试key文件、SQLite正文库或环境配置。
生产构建复用此前已验收的 build，TutorPage/Ai2LearningPage/Ai2Media 的 source map 内容与当前源码一致；
本次未改前端业务，未冒称重新构建或重新执行此前64套1003项/185套5554项全量。

## 本轮实际验证

| 验证 | 实际结果 | 归档标识（相对上述目录） |
| --- | --- | --- |
| Tutor及AI2相关组件/API | 6套224通过，0失败/跳过，10.909秒 | `validation/components.json`、`.log` |
| AI2事务服务与正式HTTP | 2套30通过，0失败/跳过，29.949秒 | `validation/http-service.json`、`.log` |
| 初次收集失败 | importlib把LMS的tests命名空间遮蔽DeepTutor/tests；exit2，0测试执行 | `validation/first.log`、`.xml` |
| 首次运行失败 | 修订textarea文字已可见，但持久POST尚未确认；1失败、3未选中；exit1，收尾SURVIVORS=0 | `validation/first-run.log`、`.xml`及对应目录 |
| 修订等待后四格 | task/mistake × Chromium/WebKit，4通过，101.81秒；是三项保护补强前快照 | `validation/bridge-run2.log`、`.xml`及对应目录 |
| 三项保护补强后四格 | 4通过，0失败/跳过/重试，66.36秒；每格一次合成Provider尝试、零额外写调用 | `validation/protected.log`、`.xml`及对应目录 |
| 独立最终WebKit复验 | task/mistake两格2通过，0失败/error/skip/retry，37.474秒；Chromium两格未选中 | `review/independent-20261103/run.log`、`report.xml`、`verification.json` |

首轮失败只修测试同步：等待真实 `explanation-revisions` 201及article正文，不延长超时、不删除artifact长度断言。
收集失败只改显式执行入口为 `prepend` 并从 DeepTutor 检出运行；不安装包、不修改两仓Python模块。
既有Mongo driver弃用提示保留。上述多次运行不累计成不同需求或不同永久用例。

使用既有环境的核心命令如下。`LMS_ROOT` 为本次工作树，`DEEPTUTOR_ROOT` 为固定的本机DeepTutor检出，
`DEEPTUTOR_PYTHON` 为已有SDK测试环境，`RESULT_ROOT` 每次使用新的本机临时目录，不能覆盖旧失败。
普通 `test:t2:e2e` 运行原三个正式spec；本跨仓入口必须显式执行，缺少前置条件会失败，不skip或fallback为伪造批准。

```sh
# 从 DEEPTUTOR_ROOT 执行；只使用既有依赖和已核对构建。
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$HOME" PYTHONDONTWRITEBYTECODE=1 \
  PYTHONPATH="$DEEPTUTOR_ROOT" AI1_LMS_ROOT="$LMS_ROOT" AI1_NODE="$NODE22" \
  AI1_NODE_PATH="$LMS_DEPENDENCIES" AI1_MONGO_BINARY="$MONGO_BINARY" T2_WEB_BUILD="$T2_WEB_BUILD" \
  "$DEEPTUTOR_PYTHON" -B -m pytest -p no:cacheprovider --import-mode=prepend \
  "$LMS_ROOT/tests/e2e/t2/ai2_ai1_bridge_acceptance.py" -v \
  --basetemp="$RESULT_ROOT/runtime" --junitxml="$RESULT_ROOT/report.xml"
```

组件命令：`react-scripts test --watchAll=false --runInBand --runTestsByPath`，明确选择
TutorPage、Ai2LearningPage、Ai2DraftRefresh、ai2Client、Ai2Media、ai2MediaApi六文件。
后端命令：既有homework Jest配置 `--runInBand --runTestsByPath`，选择ai2Service与ai2FormalHttp两文件。
实际Node22及依赖通过既有 `NODE_PATH` 指定；未安装/升级。新JS ESLint及Python AST检查通过。

## 自查、独立复评与剩余条件

独立静态评审提出三项测试保护P2：Node出站仅配置未拦截、数据快照无法证明拒绝写调用为零、顶层source未精确比较。
三项均按上述最小测试补强修订，静态复核无新增阻断P1/P2，作者四格通过；独立最终WebKit两格通过。
当时记 **FIXED_REVIEWED / USER_REVIEW_PENDING**；该历史快照由下述2026-11-04用户批准更新，不把开发运行写成独立运行。

独立复验前后核对94工作树及94归档源码、4个DeepTutor helper、98原始证据与8构建文件哈希全部一致；
candidate/patch/manifest匹配。独立未重复基线补丁重建，该项为作者实际执行，不混写。
两格均记录一PUT、一合成transport POST，AI2零新增写调用，`EXIT=0 TIMEOUT=False SURVIVORS=0`；
serve上下文已等待DeepTutor退出。最终聚焦复核无新增阻断P1/P2，未执行Chromium独立重跑、全量回归或新构建。
原报告 `review.md` SHA-256 `14ac67e763b58966ab0e5237f91956e0b162cbd4115b72b16087c21e7c605485`，
`verification.json` SHA-256 `70e4431b65540d4bde912b0ac633b94e43b62c60f26aa445ff2743ac7d75d9bd`；
只追加归档，不改作者98份manifest或原失败。原报告矩阵数字是补验前快照，当前覆盖增量以矩阵§7为准。
后续独立只读补充复核确认ATTEMPT-01新增保护与17核心/14部分计数准确；未再次运行测试，
首次Attempt不变性指完整持久对象，不扩展为媒体文件字节或原始BSON字节比较。重复章节号已整理，旧报告不改。

2026-11-04本次文档收尾：9份Markdown代码围栏及335个本地路径引用校验通过，31矩阵ID唯一，94源码哈希仍匹配；
`check-family-docs.js`通过（412 contract fixture cases、38 requirements），`git diff --check`、新JS lint及Python AST通过。
既有文档状态工具不自动证明AI2全部语义；矩阵覆盖与证据边界另经上述人工自查/独立复核。

本轮只补连接所需反例，不把[矩阵§4.2](matrix-reconciliation.md#42-连接以外的明确闭合缺口)其余PARTIAL扩写成新增大型项目。
连接后PUB-01、FLOW-01和ATTEMPT-01有新增实证；其余子条件继续逐行公开，特别是新UUID提交竞争、
review/withdraw终态异正文、带历史撤回再发布及部分恢复拒绝交错，仍需最小补验或明确验收裁决后才能申请总门禁关闭。
这些是总矩阵闭合待决项，不是本次桥接新发现的业务漏洞；不得自动后置或默认为通过。

保留全部历史失败、DEVICE_PENDING、T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收 REMAINDER_DEFERRED、T9 NOT_STARTED。
无真实模型、服务器/NAS访问、Git提交/推送/合并或部署；不提前启动AI3/K12、不关闭AI-2总门禁。

## 2026-11-04 用户批准及本轮复验证据

用户明确批准本批AI1→AI2连接验收与三项P2关闭：Node出站限制、拒绝写调用计数、孩子DTO顶层source精确白名单。
状态为ACCEPTED / USER_APPROVED、三项P2 CLOSED / USER_APPROVED；仅限本批合成范围，AI2-5汇总IMPLEMENTING、AI-2 OPEN不变。
绑定原candidate `b2f1632a44d08145be938cabf4e46e9fa5d0222293dbe200c2eb5f711c709f16`、
原patch `2cbf4a01a4ecb5d1ceca398325c4a45d7ebeae26bdbee51f631b4f5a48bd9dc7`，不改旧归档及哈希。
本轮重新从基线重建94文件全部匹配；94源码/归档、4 helper、98原证据、32独立评审文件、9文档及45交付文件均核对一致。
独立复审实际运行原四格，4通过79.73秒，0跳过/重试；每格一次合成Provider尝试、零额外教学写调用、三次拒绝探针，收尾SURVIVORS=0。
本轮首次缺临时父目录产生4项setup error、未执行业务，失败XML保留；文档工具首次缺NODE_PATH，使用既有依赖后通过。
本轮复审摘要、四格结果与初始化失败另存本机归档 `release-gate-artifacts/ai2-5-concurrency-20261104/bridge-review/`，
不把这次四格重跑写成全量回归、新构建或变异执行。后续提交竞争/终态重放补证是独立增量，不覆盖本次批准身份。
