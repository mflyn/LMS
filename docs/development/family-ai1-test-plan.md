# AI-1 测试方案与评审清单

**Document status:** APPROVED / A_ACCEPTED / B_IMPLEMENTING / C_IMPLEMENTING
**Profile:** AI1-MIN-1
**Cases:** A_LOCAL_VERIFIED; B_LOCAL_REVIEW_PASSED; C_LOCAL_VERIFYING; cross-layer B/D INCOMPLETE
**Gate:** OPEN / B_IMPLEMENTING / C_IMPLEMENTING

**Current engineering audit:** 以§17的35项归并及Gate §29.22为当前入口；上列批次标签保留审批边界，
§11是D5历史快照，不能用其旧待办否定后续实际远端证据，也不能用工程通过替代外部启用资格。

**Approval update (2026-11-01):** 用户已批准三份设计及 A 批本地无模型实现；执行证据按批次记录，不把定向测试数量等同于35项跨层矩阵全部完成。
归档及后续任务见 [Gate §29.2](family-self-directed-learning-mvp-gate.md#292-三项修订复审结论归档与任务盘点2026-11-01)，不以设计审阅替代永久反例或独立运行复验。

依据：[最小设计](../superpowers/specs/2026-10-31-family-ai1-minimal-design.md)、
[API 契约](../api/family-ai1-api.md)、[主线计划 §9](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md#9-deeptutor-与-k12-最小对接路线2026-10-26-补充)。
下列为整体永久用例矩阵，部分跨 A/B/C/D；具体已执行范围见批次记录，文档校验不能证明费用/权限实现正确。

## 1. 方法与夹具

复用现有 Jest/共用 MongoMemoryReplSet 生命周期、Gateway 签名身份、正式工厂 HTTP、
前端 Testing Library 和现有 Playwright；不增加测试框架、长期 QA 服务或通用 Agent 平台。
familyA 含 parentA/共管 parentA2/childA1/childA2；familyB 含 parentB/childB；
合成任务与错题均带 family/child，另含非数学任务、已删除来源及媒体-only 错题。
使用固定时钟、价格与可控 Provider 替身，记录真实请求计数；Mongo 事务与并发不得只靠 mock 证明。
成本用整数微元，对账检查 Job、预留、周期桶、outstanding、实验总额以及外部发送次数。

单元可用 mock；HTTP 验收须区分真实 Gateway/homework/analytics/operation 服务和 Provider 替身，
不把替身通过写成真实 DeepTutor/付费模型验收。真实模型调用及对外发送单独批准，没预算则保持待验。
故障注入置于持久提交前后、发送前后、响应返回前后；日志不含真实凭据或孩子数据。

## 2. 最小永久反例矩阵

每行需保留明确的输入、操作、状态/金额/外部请求次数断言；修复问题必须先出现红灯再通过，
不要只增加“页面可渲染”断言。ID 用于既有测试名和证据索引，不新建测试编排器。

| ID | 场景/操作 | 必须断言 | 层级/批次 |
| --- | --- | --- | --- |
| AI1-SCOPE-01 | task/mistake 双入口，媒体-only 错题 | 同孩子来源核验；必须人工题目文字，零媒体读取/上传/OCR；无 K12 假节点 | API/UI A/C |
| AI1-SCOPE-02 | 输入带课程证据、URL、未知字段、过长/空白、非数学来源 | 闭合拒绝；零预留、零请求；旧 v1 不能被解释为本 profile | schema/API A |
| AI1-AUTH-01 | 未登录、孩子、兄弟姐妹、跨家庭 ids；已知幂等 key/Job/Artifact | 401/403/404 按契约；无正文、无新发送、无预算变化；所有读写和重放覆盖 | DB/HTTP A/D |
| AI1-AUTH-02 | 共管被移除、token 仍有效；source 503/删除 | 实时拒绝；503 不降为404；发送前再次核验；历史候选仅当前同家庭权限可读 | DB/HTTP A/B |
| AI1-AUTH-03 | 伪造身份头、内部凭据缺失、借旧服务 token/管理员接口 | Gateway 信任边界有效；窄路径拒绝，模型/管理请求计数为0 | Gateway/HTTP B |
| AI1-BUDGET-01 | 精确边界、差1微元、输入8192/8193、输出上限、舍入 | 上界含system/模板；不足零发送；价格/模型/计数失效失败关闭 | unit/API A/B |
| AI1-BUDGET-02 | 两共管并发抢最后一份额度；事务回滚/提交未知 | 只有一个预留和发送；多计数原子更新，无孤立Job/额度扣减；读回原结果 | Mongo A/B |
| AI1-BUDGET-03 | 午夜/月初、时区或预算修改，旧 unknown 未结算 | outstanding 跨期仍占用；结算期正确；缩额后不能再发；实验总预算不重置 | fixed-clock Mongo A |
| AI1-BUDGET-04 | 429/5xx/断网、Provider key轮换、SDK/代理默认重试；租约到期后另一worker发送 | 实际序列化参数受控；一次 claim 最多一次请求；unknown持有全局槽，不跨worker并发；错误不退预留 | transport B |
| AI1-BUDGET-05 | usage缺失/超限、价格漂移、not_sent与unknown | 缺失保留占用；超限停新发送；只有可靠not_sent释放；租约/404/退出不退款 | DB/HTTP B |
| AI1-BUDGET-06 | 预览后文本/hash/模型/价格改变或过期 | 409无发送、不静默涨价；明确新预览；客户端改价/并发数拒绝 | API/UI A/C |
| AI1-IDEM-01 | 同key同正文重试、异正文、两个actor同UUID | 原结果不重发；异正文409；独立映射不串用，仍共享来源锁/预算 | DB/HTTP A/B |
| AI1-IDEM-02 | 同来源两个Cycle竞争/unknown时关闭再建/失败后同Cycle新key生成 | 唯一活动来源约束；未知不可关闭解锁；一个Cycle最多一个Job，不能借新key重开终态 | Mongo A |
| AI1-RECOVER-01 | 预留提交后发送前崩溃；发送claim后崩溃 | 前者仅同Job明确未发时显式续接；后者unknown且不重发，记录未消费不等于允许推断 | restart B |
| AI1-RECOVER-02 | Provider成功/远端持久成功后分别丢响应；LMS落盘结果未知 | 原映射GET收敛；后者Artifact/费用各一次；Provider成功但未持久结果仍unknown | real HTTP B/D |
| AI1-RECOVER-03 | 两端重建、远端404/存储回滚、终态冲突、错误hash/profile、状态/result/claim矛盾 | 不建新operation、不退费、不接受错误正文；明确阻断，不假装成功 | DB/HTTP B |
| AI1-RECOVER-04 | owner竞争、lease到期、晚到终态、GET轮询 | CAS不覆盖新状态/首次actor；GET无写/零发送；租约不代表供应商失败 | concurrent DB B |
| AI1-RECOVER-05 | 退出清理后重登原actor；另一个共管尝试recover | 服务端发现原Job；显式同operation；共管403，不冒名发送 | API/browser C/D |
| AI1-REV-01 | 原文含数位错误，人工修订并保存 | 原文hash不变，新candidate版本+editor+派生链；无模型调用/额外费用；尚未批准 | DB/UI A/C |
| AI1-REV-02 | 保存与审核竞争、两个家长同时审核、旧hash/版本 | 只有一个CAS成功；409后必须重新看详情，不能自动批准新版本 | concurrent DB/UI A/C |
| AI1-REV-03 | 相同正文/空白修订、遗漏人工检查、拒绝无理由 | 拒绝且不新增空版本；拒绝原因保留；审核不能信任客户端actor/time | schema/API A |
| AI1-REV-04 | 批准成功丢响应后同key重试；批准后原地修改/关闭 | 首次审核不变；已批准不可修订；关闭不删除证据/改变教学奖励 | DB/HTTP A/D |
| AI1-REV-05 | 原版、修订、已批准、已关闭通过孩子/普通任务API读取 | 均不得泄漏AI正文；批准不自动发布学习包/写掌握度 | HTTP/UI D |
| AI1-SESSION-01 | 切换家长/孩子/跨标签后旧成功及旧401到达 | DOM/暂存清除；晚到响应不能污染新身份/使新会话退出 | component/browser C |
| AI1-SESSION-02 | 当前身份恢复/详情刷新403后晚成功；普通网络失败 | 403私有内容清空并封旧请求；网络失败仍保留原命令入口，无自动POST | component/browser C |
| AI1-OUTPUT-01 | 模型返回脚本/HTML、外链、超长、格式错误、提示注入 | 纯文本不执行/加载；无工具/网络副作用；无效内容不自动批准，费用不凭错误释放 | unit/browser B/C |
| AI1-FLOW-01 | 家长两入口→预览→生成→刷新→修订→共同家长按版本审核 | 正式HTTP/页面闭环；来源与版本可追踪；孩子、任务/错题、奖励状态未变 | browser/HTTP D |
| AI1-OFF-01 | 缺预算/专用凭据/持久目录/索引/default-off；生成中关闭开关 | 拒绝新发送，既有未知证据/额度不丢；授权只读与查询收敛可用；人工流程不回退 | startup/HTTP B/D |

### 2.1 首轮评审三项缺口的补充用例

以下7项连同上表共35项；本段最初编制时涉及B批的发送/恢复场景为PLANNED / NOT_EXECUTED，当前结果见§17。
复用既有 fake clock、事务并发及可计数的 Provider 替身，不建设真实灾备或通用恢复框架。

| ID | 前置/操作 | 必须断言 | 层级/批次 |
| --- | --- | --- | --- |
| AI1-RECOVER-06 | 保存 accepted/sendClaimed=false 快照；随后实际发送一次；恢复旧快照并启动 worker，再 PUT 同key/异key及 GET | 恢复隔离在 worker 扫描前生效；Provider累计仍为1而非2；不新增预留、不释放旧预留/全局槽；PUT/GET 为 AI_STORE_ISOLATED，不仅检查operation数 | storage/HTTP B |
| AI1-RECOVER-07 | 恢复本地 reserved、远端 sending/成功/failed_not_sent 快照或空库；连续性未知 | 旧标记/旧终态均不能绕过隔离；不发送、不结算/退款；不伪造 sendClaimed；历史记录不被重写；无自动重新启用 | storage/HTTP B |
| AI1-RECOVER-08 | 正常进程重启、未换库/恢复且连续性已证明；持久 accepted 或 sending | 有效报价下 accepted 唯一claim后最多发送一次；sending不重发；与恢复隔离分开；缺连续性证明即拒绝，不能拿数据库内enabled标志证明自身 | restart/HTTP B |
| AI1-BUDGET-07 | 本地预留成功后时间跨 sendNotAfter，再原actor recover；并发worker准备dispatch | 最后时钟等于/大于截止点均零发送；仅未发送CAS胜出才failed/AI_PREVIEW_STALE并原子释放一次；CAS失败/提交未知先读回；不自动续期/补差/新UUID | fixed-clock Mongo B |
| AI1-BUDGET-08 | 远端accepted后报价到期/profile变化或撤销/上界增加；另一路同时claim；以及claim后transport前到期 | accepted拒绝与claim事务互斥；拒绝胜出产生failed_not_sent/PREVIEW_STALE；claim后到期不调用Provider但unknown保留占用；丢拒绝响应按原ID GET收敛，费用仅释放一次 | fixed-clock HTTP B |
| AI1-BUDGET-09 | 请求已在有效报价内完成，读取/结算时当前报价已过期；构造被延长截止点、过大允许上界、时钟不可信 | 有效原终态仅按冻结快照结算一次，不重发；篡改截止点/hash、报价无法覆盖有界调用窗口或时钟不可信均拒绝发送；恢复隔离优先于旧成功 | contract/HTTP B |
| AI1-SCOPE-03 | task/mistake分别使用数学、math、Math及首尾空白；其他学科/空值/数学练习/mathematics/全角math；客户端伪造chapter；创建后源学科改变 | 仅显式别名接受、原值及映射版本保留；不修改来源、不调用模型识别；其他值AI_SOURCE_SUBJECT_UNSUPPORTED且无初始预留；实际发送前再次校验，可靠未发送拒绝按CAS释放；源503保持依赖错误 | source API/UI A/B |

反例有效性要求：实施时分别移除恢复准入检查、local/remote/transport 任一报价复核、
或将精确别名改为只认 math/子串识别，对应用例必须失败。正常连续重启、有效报价终态读取和
中文数学来源是正向对照，防止用“一律禁止”伪装修复。此处是待实施验证要求，不是变异测试通过记录。

## 3. 人工内容审核与价值验收

沿用 AI-0 三组原创场景，不上传教材、不自动引入真实孩子作答。数位/计数单位错误保留为负向教学样例：
完整部分积末位零在个位；省略个位零时相应数位正确；206×3=618 与206×30=6180明确区分。
程序不能以“数值答案正确”代替解释正确。家长实际核算数学、年龄可理解性、章节范围及提示质量，
明确记录哪些原文采用、哪些人工修订、哪些拒绝；必须显示未经人工批准不可使用。
不要求为所有输出强制制造无意义编辑，但任何已发现错误必须修正后才能批准。

计时区分输入准备、等待、审核修改；成本区分预留、接口用量估计、供应商账单（未核对标未知）。
不把 AI-0 的15/5分钟或3个样本外推为AI-1端到端收益，也不声称孩子效果改善。
真实模型少量验收须再次核实模型/价格/重试并获预算授权；自动化 tests 禁止使用真实 API key。

## 4. 验证入口与交付证据

批准编码后，在既有项目增加定向用例，使用实际文件路径执行，不使用 passWithNoTests：

```bash
npm run docs:family:check
npm run test:family-regression
npm run test:ci --prefix frontend/web -- --runInBand
npm run build --prefix frontend/web
npm run test:family-flow:integration
npm run test:family-flow:e2e
git diff --check
```

定向 AI-1 文件形成后把准确命令/退出码填入本节或现有 Gate 对应批次，不提前编造文件名/通过数量。
API/schema 改动采用既有契约 fixtures 和校验入口，不削弱旧 Tutor v1 断言；共享会话变更扩展所有调用方回归。
关键缺陷补永久红绿反例，必要时针对性移除CAS/预留/响应代次保护验证能拦截；不机械重跑所有历史变异。
证据最少含候选SHA/本地补丁hash、文件清单、命令/退出码、服务真伪边界、失败原始摘要、修订及复验。
不在公开证据包含凭据、真实家庭/题目或机器路径；保留真实失败而非重跑覆盖。

## 5. 准入、退出与本轮自查

- 设计准入：三项方向及本设计/API/测试稿于2026-11-01获用户批准；仅 A 批本地无模型实现获授权。
- 实现准入：最小profile、operation持久能力及价格/预算边界通过设计评审，复用点及差异明确。
- 工程退出：矩阵永久用例、受影响回归、正式HTTP/browser、失败恢复及聚焦独立复评证据具备；
  外部DeepTutor/Provider替身与真实验收分开，不能用mock完成最终接入判定。总门禁关闭另待批准。
- 真实使用：T8验收、真实资料合法性及数据发送另授权；DEVICE_PENDING不能写成通过，不能自动开始AI-2/3。

2026-10-31设计轮自查检查设计与API字段/状态、费用/权限/未知结果/修订版本的反例映射及旧草案差异。
该轮未执行模型、业务回归或浏览器，只运行文档/路径/状态/diff检查，历史结果保留于主线Gate §29。
该轮独立评审状态为PENDING；之后的A批独立复核与开发测试分别见§6及Gate §29.3，不把作者自查写成独立通过。
2026-10-31 首轮文档复审提出恢复旧accepted的P1、延迟发送报价P2、学科衔接P2；
该轮仅补齐契约和上述7项测试设计。文档复审与后续运行时验证分开记录于主线Gate §29.1，
不能将修订完成等同于35项测试已执行或AI-1总门禁已关闭。
T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收 REMAINDER_DEFERRED 不变。

## 6. A 批执行范围（2026-11-01）

设计已批准；本地实现与本轮证据以[Gate §29.3](family-self-directed-learning-mvp-gate.md#293-ai-1-设计批准与-a-批本地无模型实现2026-11-01)为准。
§2的35项是跨层验收矩阵，不是与Jest test数量一一对应的完成计数。
本批覆盖SCOPE-01/02/03、AUTH-01/02、BUDGET-01/02/03/06、IDEM-01/02、REV-01/02/03/04及OFF-01的本地域部分；
HTTP、UI、实际Provider发送、持久远端恢复和对应故障窗口仍PLANNED / NOT_EXECUTED。
RECOVER-06/07/08和BUDGET-07/08/09不能因内部continuity/claim断言通过而记为已验收。

准确定向入口（使用项目现有Jest，临时Mongo副本集；不请求模型）：

```bash
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/ai1Contract.test.js backend/services/homework-service/__tests__/services/ai1Service.test.js
npm run docs:family:check
npm run test:family-regression
git diff --check
```

来源读取与候选结果为合成替身，模型请求数为0；没有Adapter/远端进程/HTTP路由或前端变更。
已补URL形式拒绝P2、首次同命令并发、审核竞争后的版本链完整断言；红灯及独立复核分别记录，不将作者自查冒充独立通过。

## 7. B 批本地候选与尚未实现范围

A批已获用户验收，URL P2及两项测试保护缺口CLOSED；冻结候选及独立日志哈希见Gate §29.4。
B_IMPLEMENTING，当前本地交付覆盖LMS client、专用凭据发送、闭合响应、Job恢复/费用终态、独立路由工厂及真实回环HTTP。
永久反例增加：发送前持久摘要校验、halt阻断旧预留claim、未发送截止点释放与dispatch竞争两种胜者、
claim后跨截止点、来源503/删除、重启后只GET原映射、可靠失败结算/释放、远端隔离不退款、
远端claim证据持久后矛盾退款（重启/并发）、原始空白及Unicode转义体积、parser误装拒绝、完整详情版本链。

HTTP测试的远端是持久Mongo协议替身，Provider计数为合成行为；重建HTTP工厂不是实际DeepTutor进程崩溃测试。
恢复旧accepted的场景只证明LMS正确处理远端隔离错误；替身自己拒绝旧快照不证明真实远端能识别/阻止恢复发送。
真实DeepTutor现有源码尚未修改：其SQLite或其他事务介质、worker原子claim/报价三次复核、
真实完整序列化请求计数/Provider参数/底层重试限制、启动前外部存储连续性证明、专用凭据启用和正式装配仍待实现/验收。
因此RECOVER-06/07/08、BUDGET-07/08/09只有明确列出的LMS侧子项得到验证，不标记整项完成。
不关闭B或AI-1总门禁，不以protocol替身代替外部接入。C/D尚未开始；所有既有未关闭/后置状态不变。

### 7.1 本地复审关闭与永久详情保护（2026-11-01）

用户批准本地 P1/P2 CLOSED；B_LOCAL_REVIEW_PASSED / EXTERNAL_IMPLEMENTATION_PENDING，B 与 AI-1 总门禁 OPEN。
冻结候选、独立 8 suites / 540 tests 及两组退出1的预期变异证据绑定于
[关闭记录](evidence/ai1-b-20261101/closure.json)。不覆盖原 manifest/verification 的历史待复审快照。
三版本探针已固化为 `AI1-B detail preserves three-version lineage, first review and authorized read-only access`：
核对 1/2/3 顺序、superseded/parent_approved、原文/hash、derivedFrom 链、editor/reviewer、当前/批准版本、Job，
并比较读取前后全部 AI 集合快照，拒绝跨家庭及撤权后读取。该测试为本次后续增量，不冒充旧冻结候选已含此用例。
旧家庭全量161通过/2失败套件、4980通过/2失败用例、退出1不变；相关通过不代表全量全绿。

## 8. C 批页面及当前验证边界（2026-11-01）

用户持续目标已授权 LMS 本地 B/C/D，C_LOCAL_VERIFYING；本节替代§7当时的“C/D尚未开始”，不覆盖历史记录。
家长任务/错题双入口、完整预览、显式生成、原命令重试、本人任务发现、人工修订/审核/关闭已有页面实现。
身份或孩子变化清理、当前403与迟到成功隔离、同会话焦点保稿、StrictMode重放均纳入永久组件测试。
不完整成功信封/动作结果、未知HTTP错误或404不能清除原命令；只有已知结构化拒绝或精确结果才能收口。
三版本持久详情增加 revisionReason 只读投影，页面展示原文/hash、派生关系和原因；不新增模型调用或修改计费状态机。

| 矩阵关联 | 本轮可证明部分 | 仍待验收 |
| --- | --- | --- |
| SCOPE-01/03、FLOW-01 | 两个真实页面入口与手工文字；浏览器所有API为合成替身 | 正式Gateway/服务来源权限、实际远端及全链路 |
| BUDGET-06、IDEM-01、RECOVER-05 | 完整预览及显式确认；保存原命令/刷新后显式重试；重登发现组件 | 真实报价变化、远端恢复、真实HTTP重登 |
| REV-01/02/04、OUTPUT-01 | 人工版本、所见CAS、冲突清理、批准/关闭只读、纯文本 | 正式HTTP共管竞争、业务零副作用与全部输出边界 |
| SESSION-01/02 | 当前拒绝清理、换身份/孩子、迟到响应；普通网络故障保留命令 | 正式链路浏览器切换、失效JWT/权限撤销组合 |
| 其他矩阵行 | 保留A/B既有证据，不因本轮UI通过升级状态 | B实际远端、D装配与跨层矩阵逐项收口 |

沿用既有入口，不添加测试框架：前端 `npm run test:ci -- --runInBand`，`CI=true npm run build`；
后端 homework Jest 的 ai1Contract/ai1Service/ai1Operation/ai1Http 四套件；
`T2_WEB_BUILD=<绝对构建目录> playwright test --config=playwright.t2.config.js tests/e2e/t2/ai1ParentPage.spec.js`。
浏览器测试自建临时回环静态站，所有API拦截为合成响应，显式拒绝外部网络；三条用例不代表D正式集成。
详情、状态及证据汇总见Gate §29.7。本轮不存在真实模型、真实孩子、外部服务修改或部署授权。

## 9. D 批部分装配验证（2026-11-01）

D_IMPLEMENTING / SEND_ACTIVATION_PENDING；cross-layer B/D INCOMPLETE。
正式 Gateway 保留原始 JSON、拒绝超限/未知键/无效身份、剥离专用凭据，不代理内部 operation。
永久测试包括压缩后膨胀大小、数学比较符、10至32 KiB合法正文、畸形输入仍限流/鉴权、普通路径限制不变。
独立复审修复分块双头和编码边界两项P2；永久用例覆盖32768/32769、gzip+chunked、非UTF-8和损坏字节，
两端校验及proxy分块头清理的五组独立变异均触发预期失败，不靠另一端400或非法schema假通过。
Gateway 传输套件的上游使用真实签名 AI 路由及业务 service 替身，不将其计为实际业务验收。
`ai1Production.test.js` 则运行正式 Gateway/homework 工厂、真实 AI service 与临时 Mongo 副本集；
用本地 fixture 预置历史 Cycle，未构建远端服务或 Provider。覆盖默认关闭零写、完整预览读取、重建工厂后读取、
孩子/兄弟姐妹/非成员/撤权拒绝、普通任务路由不消耗额外身份 nonce。
该组仅补 AUTH/OFF 及传输子项，不关闭35项矩阵中的任何跨层整项；新发送、回滚查询收敛、实际DeepTutor、
正式全闭环浏览器、付费及人工价值验收仍待完成。C冻结包、历史全量失败与DEVICE_PENDING继续保留。

## 10. D2 运行准入与查询回滚证据（2026-11-01）

D2_LOCAL_RUNTIME_REVIEW_PASSED仅指本地运行逻辑及两项测试补强聚焦复核；B/D/AI-1总门禁仍OPEN。
§9保留D1当时的SEND_ACTIVATION_PENDING；D2当前EXTERNAL_ACTIVATION_PENDING，不宣称已完成外部服务接入。
`ai1Runtime.test.js`保护四模式、闭合配置、专用凭据、同连接、真实事务/索引就绪、启动失败借用/新建DB收尾。
`ai1Production.test.js`通过真实Gateway/homework及Mongo验证生成、重放、共管修订/审核、query-only收敛与隔离保锁。
远端为带凭据的协议替身，不是实际DeepTutor；没有Provider调用，工厂重建不等于外部进程持久重启。

| 矩阵关联 | 新增可证明部分 | 仍待验收 |
| --- | --- | --- |
| AUTH-01/02、SCOPE-03、FLOW-01 | 正式任务来源及数学别名；私有读取和共管版本闭环，Task零变更 | 错题跨服务正式浏览器及完整权限矩阵 |
| IDEM-01、RECOVER-02/05 | 丢响应后原actor GET原映射收敛；共管403；原命令重放不重复发请求/结算 | 真实远端进程/Provider故障及正式页面重登组合 |
| REV-01/02/04 | 修订版本、旧审核409、新版明确批准、首次审核及重建回看 | 浏览器并发组合及完整业务零副作用 |
| OFF-01、RECOVER-07 | 默认关闭，实际连接/索引检查，query-only无PUT，reserved三入口零发送，隔离保锁 | 外部连续性证明、远端运行时及恢复隔离验收 |
| BUDGET-09 | 当前profile不参与query-only历史成功结算，原映射与原快照不变 | 真实远端报价/计数/传输重试和外部恢复边界 |

作者9套件220项与独立2套件49项是不同候选/不同范围，不能相加为单次全量。完整命令和红绿证据见Gate §29.9及后续D2冻结索引。
两项测试补强：active替代装配在completion legacy下仍必须拒绝；首次批准及重建后明确检查Artifact/Cycle批准状态和approvedArtifactId。
这些是测试隔离与明确断言，不放宽正式新协议验收、不改业务状态机。未运行真机或真实外部环境。
补强后作者2套件54项通过；独立2套件3项通过、51项未选中，factory/批准状态变异分别2/1项预期失败。
不把该限定复评计作完整54项独立执行，详情绑定[D2冻结证据](evidence/ai1-d2-20261101/README.md)。

## 11. 35项矩阵的当前证据与剩余条件（2026-11-01）

LOCAL_PASS不是总验收关闭：仅该行不依赖实际外部实现的本地工程行为已有直接证据；
PARTIAL表示仅部分层次有证据，未完成子项明确保留。该表是D5时点的分层证据快照；
后续实际DeepTutor本地实现与跨仓组合增量见§12～§14，不再将源码实现整体视为EXTERNAL_IMPLEMENTATION_PENDING。
B/D及AI-1总门禁仍OPEN，尚未证明的跨层条件不能随实现进展自动关闭。
该表为逐项核对，不以Jest数量计算覆盖率，也不把协议替身当作真实Provider或远端持久进程。

证据简称均指现有入口：Contract=`ai1Contract.test.js`及六类契约fixture；Service=`ai1Service.test.js`；
Operation=`ai1Operation.test.js`；HTTP=`ai1Http.test.js`；Production=`ai1Production.test.js`；Runtime=`ai1Runtime.test.js`；
UI=`TutorPage.test.js`/`ai1Client.test.js`及既有会话回归；Browser=`ai1FormalPage.spec.js`。
前六个后端文件位于homework-service的`__tests__/services/`，UI位于frontend/web的`src/__tests__/family/`，
Browser位于`tests/e2e/t2/`。A/B/C/D1/D2分别使用其冻结结果；D3新增正式浏览器结果单独归档，不改写旧包。

| 要求 | 当前状态 | 已有直接证据 | 剩余条件或边界 |
| --- | --- | --- | --- |
| AI1-SCOPE-01 | LOCAL_PASS | Service双来源；Browser真实任务/图片-only错题入口、人工空白输入、零媒体访问及准确source/child | 不含OCR/教材上传；实际模型不在此行证明 |
| AI1-SCOPE-02 | LOCAL_PASS | Contract闭合字段/URL/长度/学科；Service拒绝零预留 | 不允许旧profile或隐式课程证据 |
| AI1-AUTH-01 | LOCAL_PASS | Service所有getter/重放及错误孩子；Production正式401/403；D4撤权；D5 Browser短期JWT真实过期401持有后换actor取消、有效新token访问新家庭 | 浏览器取消与组件晚回调隔离证据分开；不代替实际远端发送前权限检查 |
| AI1-AUTH-02 | PARTIAL | Service发送前撤权/source503或删除；Production撤权读拒绝 | 实际远端发送窗口联调待验 |
| AI1-AUTH-03 | PARTIAL | Gateway签名/剥离凭据/内部路径拒绝；Operation专用token、窄路径 | 实际DeepTutor凭据及管理员边界待验 |
| AI1-BUDGET-01 | PARTIAL | Contract输入/输出/报价/舍入，Service四预算差1微元拒绝 | 实际Provider完整序列化计数和参数控制待验 |
| AI1-BUDGET-02 | PARTIAL | Service最后额度并发、事务回滚、提交未知读回、首次同命令竞争 | 外部实际claim单发送仍待验 |
| AI1-BUDGET-03 | LOCAL_PASS | Service跨日/月/时区/缩额占用、结算期与实验总额不重置 | 仅本地预算账本，不声称供应商账单核对完成 |
| AI1-BUDGET-04 | PARTIAL | Operation真实HTTP无重试/重定向；Service未知锁和全局槽；远端受限SDK/最后transport护栏局部证据见Gate §29.15 | SDK使用传输替身；正式组合及实际模型前置仍待验，不将计数替身当硬限费 |
| AI1-BUDGET-05 | PARTIAL | Service缺失usage保留占用、矛盾退款暂停、invalid终态拒绝 | 远端真实not_sent证据与Provider usage可信性待验 |
| AI1-BUDGET-06 | LOCAL_PASS | Service报价改变/过期；UI完整预览与显式确认；Browser逐条messages及费用文本 | 执行时真实报价仍需外部核验与费用授权 |
| AI1-IDEM-01 | PARTIAL | Service同/异正文与跨actor UUID、首次并发；Browser丢公开响应原命令完整重试 | 实际远端去重与持久映射联调待验 |
| AI1-IDEM-02 | LOCAL_PASS | Service来源Cycle并发、未知不能关闭/换key、一个Cycle一个Job | 不增加自动重开周期能力 |
| AI1-RECOVER-01 | PARTIAL | Service reserved恢复、claim后unknown及最终截止点 | 实际DeepTutor进程崩溃窗口待验 |
| AI1-RECOVER-02 | PARTIAL | HTTP及Production丢PUT恢复；Browser公开/远端丢响应、单Artifact/结算 | Provider已成功但远端未落盘、两端真实进程重启待验 |
| AI1-RECOVER-03 | PARTIAL | Service/Operation hash/profile/终态/claim矛盾及404不退款 | 实际外部存储回滚/空库/重启待验 |
| AI1-RECOVER-04 | PARTIAL | Service并发恢复CAS、lease、只读GET零调用 | 实际远端worker竞争和晚终态待验 |
| AI1-RECOVER-05 | PARTIAL | Browser真实登出清理/共管无恢复与API403/原actor显式GET原映射 | 真实远端实现联调待验；不将协议替身计为完成 |
| AI1-REV-01 | LOCAL_PASS | Service版本不可变；Browser原文/hash及修订/派生/原因/记录者 | 数学是否适用仍需人工审核 |
| AI1-REV-02 | LOCAL_PASS | Service修订/审核及双审核竞争；Browser旧版409、清详情、重新读取勾选后批准 | 不自动批准未查看新版 |
| AI1-REV-03 | LOCAL_PASS | Contract及Service同文/空白/缺检查/拒绝无原因零写 | 保留人工审核责任 |
| AI1-REV-04 | LOCAL_PASS | Service/Production首次审核重放；D5 Browser批准/拒绝响应丢失后完整原命令重试、版本只读、关闭后审核/Job精确不变 | D5最终复验状态见Gate；人工审核责任不变 |
| AI1-REV-05 | LOCAL_PASS | D4 Browser各阶段附带真实HTTP矩阵：原文/修订/批准/拒绝/关闭全部artifact拒绝孩子、兄弟姐妹、跨家庭；父子普通Task/Mistake详情/列表成功且无AI正文 | 权限矩阵为API客户端，不冒充四种角色浏览器页面；D4独立复验状态见Gate |
| AI1-SESSION-01 | LOCAL_PASS | UI/共享会话晚成功/401回调；D4跨标签；D5 Browser切孩子清暂存但原Job可发现恢复、同document换actor取消真实过期旧401 | 请求被取消不是错误已进入应用回调；后者由共享会话组件反例独立证明 |
| AI1-SESSION-02 | LOCAL_PASS | UI403后忽略晚成功；D4真实撤权清视图；D5 Browser普通GET网络失败保原命令及unknown费用/详情，恢复GET不自动POST | D5最终复验状态见Gate；未知生成仍须显式原命令/原Job收敛 |
| AI1-OUTPUT-01 | PARTIAL | Operation无效/超限输出；Browser脚本纯文本、零外部请求 | 实际Provider畸形/提示注入端到端待验 |
| AI1-FLOW-01 | PARTIAL | Browser双入口真实LMS、预览、生成、刷新、共管修订审核和重登；源业务及文件不变 | 实际DeepTutor/Provider及人工端到端价值验收待验 |
| AI1-OFF-01 | PARTIAL | Runtime真实预检/默认关闭/凭据/索引；Production query-only三入口保锁与收敛 | 实际外部目录、连续性、启用与回滚仍待验 |
| AI1-RECOVER-06 | PARTIAL | Service/HTTP远端隔离响应保锁，无新发送/退款 | 真实远端恢复旧accepted、worker启动前隔离和请求计数待验 |
| AI1-RECOVER-07 | PARTIAL | Service本地旧成功隔离；Production store-isolated保映射/费用及可读 | 真实两端备份恢复/空库隔离待验 |
| AI1-RECOVER-08 | PARTIAL | Service/HTTP正常工厂重建按持久映射查询；Runtime连续性声明必要 | 实际远端进程重启、唯一claim及外部连续性证明待验 |
| AI1-BUDGET-07 | LOCAL_PASS | Service未发送截止点CAS两胜者、claim后跨截止点不PUT、费用释放一次 | 仅LMS侧准入；远端另见BUDGET-08 |
| AI1-BUDGET-08 | PARTIAL | Operation契约边界及LMS拒绝/未知处理 | 实际远端accepted与claim事务竞争、transport前时钟复核待验 |
| AI1-BUDGET-09 | PARTIAL | Service冻结快照结算；Production query-only不需当前报价且不重发 | 真实远端时钟/profile/截止点篡改拒绝待验 |
| AI1-SCOPE-03 | PARTIAL | Contract显式别名；Service发送前学科/source复核；Browser任务数学与错题Math真实HTTP | 与实际远端发送前权限/学科窗口联调待验 |

本轮Browser作者6项通过（41.6秒）；包括一项异常收尾而不是六个业务闭环。独立复评结果见Gate后续记录。
复用C已构建页面前，12个前端候选文件与C冻结哈希一致；本轮重新构建通过，8个产物与测试所用构建逐字节一致。
未重复前端全回归，不把C原59套件788项标为新执行；当前正式联调范围见Gate §29.10。
保留历史家庭全量失败、T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED。真实模型/预算/人工使用均未新增授权。

## 12. DeepTutor 正式 main 本地装配增量（2026-11-01）

见 Gate §29.16 及独立冻结包。本批覆盖 OFF-01/RECOVER-08 的远端生命周期子项，不升级上述35行矩阵状态。
真实 main 在临时 HOME、core/server 模块及启用既有认证下启动；专用凭据不能进入 `/api/settings`，Bearer不能替代服务凭据。
实际受限 SDK 使用合成计数器/MockTransport，首进程HTTP终态作为固定基准，第二个真实新进程query-only精确重放且库字节不变。
应用其他模块启动失败必须清空runtime/ready；配置、service token和Provider key三类FIFO必须快速拒绝。
FIFO旧版三项超时红灯、启动失败残留与测试准备失误均保留；原SDK/store/wire包不改写。
独立6套163项通过、3 warnings、exit0，17文件运行前后hash一致；不是拼接旧137项结果。
保留非阻断观察：现有缺唯一索引反例同时移除PK/NOT NULL，尚未单独保护唯一索引检查分支；未发现实际准入绕过。
实际LMS client到正式main的TCP组合、完整v4计数上界与人工/付费验收仍待完成；B/D/AI-1 OPEN。

## 13. 实际 client TCP 组合增量（2026-11-01）

Gate §29.17补实际client/main TCP边界，明确不含LMS业务账本或页面；不升级35行矩阵整体状态。
显式执行DeepTutor `tests/services/ai1/lms_acceptance.py`，必要的跨仓路径缺失即失败，不skip；复用pytest而非新框架。
永久用例覆盖持久终态丢响应、accepted/claim/Provider返回后进程退出、只查询重启与隔离、原请求摘要和计数不变。
作者5项及一次性168项通过，临时副本三类变异均被拦截；独立5项通过，41项源码/依赖指纹不变，无新增P1/P2。
独立未重复变异；收尾退出码分类作为非阻断观察保留，原冻结包和失败不改写。

## 14. 实际业务与浏览器跨仓增量（2026-11-01）

Gate §29.19及`evidence/ai1-remote-business-20261101/`绑定最新候选；旧§11各行保留历史证据，不覆盖失败。
使用真实Gateway、七个LMS服务、临时Mongo副本集、DeepTutor main/SQLite及受限SDK；仅Provider网络/响应、
完整输入计数器和远端报价时钟为合成。不使用远端协议替身，也不调用实际模型。
业务永久反例增加家庭/全局/Reservation三方结算、丢响应后仅GET、共管无恢复、原actor重登、
同键异正文零写、逐个版本/ID/hash条件及并发审核。请求并发不冒充确定性事务交错。
浏览器覆盖任务/图片-only错题入口、准确外发预览、修订、共管审核、刷新及重登回看；
丢响应场景验证原持久映射且不换UUID、无额外PUT。来源child/source在创建及回访精确核对。
Chromium/WebKit均用820x1180布局；这是浏览器模拟，DEVICE_PENDING不变。
执行器永久反例要求部分日志保留、非零传播、超时及短命Node helper收尾、浏览器原生强制关闭。
测试全局100秒、外层120秒兜底，原业务断言及单项/expect时限不放宽；两者差值不是保证完整20秒hook预算。
该批补SCOPE-01/REV/RECOVER-05/FLOW-01的实际远端子项；并不自动关闭需要实际计价、
完整序列化token上界、真实存储恢复或人工价值证据的PARTIAL行。独立结果以Gate最终记录为准。

## 15. 旧快照隔离的分层恢复增量（2026-11-01）

Gate §29.20及`evidence/ai1-remote-recovery-20261101/`记录测试候选，不改变历史矩阵状态。
真实main/SQLite/LMS client补旧accepted已发送后回滚、sending/成功/未发送/空库回滚，
由外部明确声明store-isolated，原/新ID读写全拒绝且库字节与Provider替身计数不变。
远端缺连续性启动反例经移除检查变异验证；过期报价仍能精确只读查询历史终态。
LMS正式工厂补BSON reserved/unknown快照恢复，明确正预留、家庭/全局账本与unknown发送槽，
先完成真实本地结算再回滚，隔离后原/新命令不变更任何AI模型记录。
该LMS套件使用远端协议替身；不是双端同轮灾备演练，也不新增恢复或自动解除隔离能力。
初版作者远端8项、LMS最终11项分别通过；复评补强成功基线、启动拒绝正对照及缺失连续性字段。
修订后作者10项、最终独立10项远端通过，66项指纹未变；LMS44项源码指纹一致，复用此前独立11项通过。
三项测试保护完成限定复评，变异及原失败分类以Gate为准，B/D/AI-1仍OPEN。

## 16. 实际双端合成恢复组合（2026-11-01）

Gate §29.21及`evidence/ai1-dual-restore-20261101/`补同轮实际双端证据，独立新7项通过且68项指纹一致。
五场景将真实LMS Job/mapping/BSON预留与实际DeepTutor main/SQLite的accepted、sending、成功、
可靠未发送和空库快照关联。远端快照后实际推进；LMS正式HTTP查询恢复先核对正确结算/释放/未知占用，
随后停旧进程/监听并恢复两库，显式隔离启动。原/新命令不能改账本或槽，四次原/新远端GET/PUT全部拒绝，
SQLite字节、Provider替身次数、全部AI模型、学习业务及私有文件不变。
局部预留由实际事务服务和实际来源读取准备，不冒充该阶段走公开生成路由；远端额外不同ID仅证明快照变旧。
不新增生产恢复工具或自动连续性判定。当前条目映射（不改写§11的D5历史快照）：

- `AI1-RECOVER-06`：LOCAL_PASS（合成工程）；同一持久映射的旧accepted在一次发送后恢复，两端隔离，原/新读写拒绝，费用/槽不变。
- `AI1-RECOVER-07`：LOCAL_PASS（合成工程）；本地reserved与实际远端sending/成功/可靠未发送/空库的同轮恢复，隔离优先、零结算/退款/新发送，原记录不变。

LOCAL_PASS不是总验收关闭，也不是生产灾备、真实模型或自动重新启用授权。
RECOVER-08复用§13/§15中连续重启、缺失/false拒绝与正对照的独立证据，不重跑后冒称新证据。
首次sending错误预期200保留，按既有契约修正为精确202；callback沙箱失败不算有效红灯。
新增callback跨截止且子进程正常退出的永久反例，保持原预算、返回后复核而非宣称抢占同步调用。
作者13项为新7项加既有6项回归；独立只执行新7项，两项P2完成限定复评，作者变异未由独立重复。

## 17. 当前35项工程归并与外部待验（2026-11-01）

LOCAL_PASS不是总验收关闭。此表只判断已批准的本地合成工程要求；B/D/AI-1 OPEN。
2026-11-01用户已批准本表对应的限定合成工程候选验收（ENGINEERING_SYNTHETIC_ACCEPTED，Gate §29.24）；外部待验条件不随之关闭。
§11历史行和原冻结包不改写，当前表结合§12～§16及本轮7项缺口补证。
同一要求可由单元、真实数据库、正式HTTP、浏览器证据共同证明，不要求每个参数排列重复浏览器测试。
Provider网络/输出、计数器和报价为合成；实际main/SQLite、LMS事务、SDK请求构造与HTTP不是协议替身。
本轮Service补证的来源和operation响应使用替身；实际双端HTTP/browser另由§14～§16证明，不将所有测试一概称为实际远端组合。
新增测试独立复验LMS50项、DeepTutor76项通过且68项指纹一致，详见Gate §29.22；不将作者或旧执行混称本次独立结果。

证据简称延续§11。远端Store/Provider/Runtime为DeepTutor `tests/services/ai1/test_operation_*.py`；
Client为`lms_acceptance.py`，Business为`lms_business_acceptance.py`及LMS `ai1ActualRemote.acceptance.js`，
实际Browser为`lms_browser_acceptance.py`及LMS `ai1ActualRemote.acceptance.js`浏览器文件；
Restore为`lms_recovery_acceptance.py`/`lms_dual_restore_acceptance.py`和LMS `ai1RestoreRemote.acceptance.js`。
各批执行清单、源码指纹、原失败及命令退出码见§29.3～§29.22，不把累计次数相加为一次全量。

| ID | 工程状态 | 直接证据与范围 |
| --- | --- | --- |
| AI1-SCOPE-01 | LOCAL_PASS | Service + 实际Browser双入口、媒体-only必须人工文字、完整预览及零媒体读取 |
| AI1-SCOPE-02 | LOCAL_PASS | Contract闭合字段/URL/长度/profile及Service零预留拒绝 |
| AI1-AUTH-01 | LOCAL_PASS | Service/Production/Browser当前家庭孩子权限、重放拒绝、撤权及真实JWT过期 |
| AI1-AUTH-02 | LOCAL_PASS | Service新增claim持久提交后撤权、PUT前403零调用且保留占用；既有source503/删除及Production实时读权限 |
| AI1-AUTH-03 | LOCAL_PASS | Gateway/HTTP剥离伪造凭据、窄路径；实际Runtime main拒绝服务凭据访问管理员及Bearer代替服务凭据 |
| AI1-BUDGET-01 | LOCAL_PASS | Contract整数上界/差1微元，Provider完整规范字节、8192/8193及计数器缺失/失配关闭；真实计数资格另待验 |
| AI1-BUDGET-02 | LOCAL_PASS | Service真实Mongo最后额度并发/回滚/提交未知；Store单claim竞争及实际Business精确一次结算 |
| AI1-BUDGET-03 | LOCAL_PASS | Service跨日/月/时区/缩额outstanding、结算期和不重置实验总额 |
| AI1-BUDGET-04 | LOCAL_PASS | Provider实际SDK错误不重试/禁止重定向和隐式代理；新增轮换合成凭据后持久unknown重建仍零新请求；Service全局槽 |
| AI1-BUDGET-05 | LOCAL_PASS | Provider原始usage边界；Service缺usage保留、超额暂停、矛盾退款拒绝；Restore可靠未发送释放与隔离不退款 |
| AI1-BUDGET-06 | LOCAL_PASS | Service过期/改价409、Browser精确消息和费用预览；真实价格授权仍待验 |
| AI1-IDEM-01 | LOCAL_PASS | Service同key/异正文/不同actor同UUID独立映射；Client持久重放与实际Business原映射恢复 |
| AI1-IDEM-02 | LOCAL_PASS | Service唯一活动来源、一个Cycle一个Job、unknown不能关闭或换UUID解锁 |
| AI1-RECOVER-01 | LOCAL_PASS | Service持久预留；实际Client accepted/claim后进程退出及正常重启仅原accepted可单次接续 |
| AI1-RECOVER-02 | LOCAL_PASS | Client Provider返回前后崩溃与丢响应；Service新增结算提交应答丢失，原Job读回且Artifact/双账本各一次 |
| AI1-RECOVER-03 | LOCAL_PASS | Service/HTTP摘要及claim/终态矛盾；实际Restore两库回滚、空库隔离且无新operation/退款 |
| AI1-RECOVER-04 | LOCAL_PASS | Service owner/CAS/lease；Store并发claim/首终态/只读查询及Client跨进程sending不重发 |
| AI1-RECOVER-05 | LOCAL_PASS | 实际Business/Browser退出后原actor发现并显式GET同映射，共管403无接替发送 |
| AI1-REV-01 | LOCAL_PASS | Service版本链与原文hash；实际Browser修订不生成、不收费、不自动批准 |
| AI1-REV-02 | LOCAL_PASS | Service修订/审核竞争；实际Business逐字段CAS和并发审核；Browser冲突重看 |
| AI1-REV-03 | LOCAL_PASS | Contract/Service同文空白/缺人工检查/无拒绝理由零写，真实actor审计 |
| AI1-REV-04 | LOCAL_PASS | Service/Production首次审核重放及Browser审核丢响应原命令重试、批准只读、关闭留证 |
| AI1-REV-05 | LOCAL_PASS | Browser附带正式HTTP各版本对孩子/跨家庭拒绝、普通学习API不泄露AI正文 |
| AI1-SESSION-01 | LOCAL_PASS | Browser跨标签/账号/孩子清理和请求取消；UI共享会话永久反例补晚成功/401回调隔离 |
| AI1-SESSION-02 | LOCAL_PASS | UI晚响应永久反例；Browser撤权403清视图、普通网络失败保原命令且无自动POST |
| AI1-OUTPUT-01 | LOCAL_PASS | Provider原始畸形/工具/思考/超限输出拒绝；Browser恶意文本仅文本显示、零外部请求 |
| AI1-FLOW-01 | LOCAL_PASS | 实际Business/Browser任务错题→预览→生成→修订→共管审核→刷新重登；学习状态/文件不变，教学价值另待人工验收 |
| AI1-OFF-01 | LOCAL_PASS | Runtime双端默认关闭/凭据/目录/索引/连续性失败关闭；Production与Client query-only保锁收敛及只读历史 |
| AI1-RECOVER-06 | LOCAL_PASS | 实际Restore同一映射旧accepted发送后双库回滚隔离，Provider次数/费用/槽不变 |
| AI1-RECOVER-07 | LOCAL_PASS | 实际Restore HTTP reserved与sending/成功/未发送/空库旧快照隔离，原新GET/PUT拒绝、无结算退款 |
| AI1-RECOVER-08 | LOCAL_PASS | Client连续重启accepted唯一claim、sending不重发；Runtime缺失/false连续性拒绝及同库正对照 |
| AI1-BUDGET-07 | LOCAL_PASS | Service截止点CAS两胜者及新增claim/释放提交应答丢失，重建后读回、零PUT/只释放一次 |
| AI1-BUDGET-08 | LOCAL_PASS | Store拒绝/claim竞争、Provider最后传输时钟；远端Service新增accepted后撤销/增价；LMS Service丢拒绝响应GET后只释放一次 |
| AI1-BUDGET-09 | LOCAL_PASS | Provider/Contract篡改及调用窗口；Client过期报价历史成功查询；Service新增当前报价过期/替换仍按原价结算2250微元一次 |
| AI1-SCOPE-03 | LOCAL_PASS | Contract精确别名，Service新增task/mistake原学科及映射版本保存、预览后漂移零发送释放一次；Browser实际中文/Math来源 |

### 17.1 未完成条件与最小下一步

- QUALIFIED_COUNTER_PENDING：没有经模型profile资格验证的完整输入token上界，真实enabled仍拒绝；合成8192计数器不能用于真实限费。
- CURRENT_PRICE_AND_BUDGET_PENDING：公开模型映射和当前报价已只读核实（Gate §29.23）；完整输入计数资格、本轮费用授权及真实启用仍待验。价格仅代表核验时点，发送前仍需复核；不沿用AI-0的10元，也不声称具备真实费用硬上限。
- HUMAN_VALUE_PENDING：实际家长端到端核算、修订及时间收益未验收，AI-0的15/5分钟不能外推；已发现数学错误必须修订再批准。
- 工程审批与发布：B/C/D限定合成工程候选已获用户验收批准；B/D/AI-1 OPEN，不将候选验收当成总门禁关闭。未提交工作区不能通过Git-clean发布条件；本轮不提交推送、操作服务器或调用真实模型。
- 完整回归历史：家庭161/2套件、4980/2用例失败快照保留。2026-11-02新增原家庭全量168套件通过、5135项通过/0失败/1条件跳过；已有kubectl补验部署套件18项通过、0跳过，不能拼成一次无跳过全量。DeepTutor原根夹具入口16项通过、1 warning，不代表其整仓通过；历史markdown_it失败不删除。详见[本轮回归收尾](evidence/ai1-regression-20261102/README.md)，完整发布仍未验收。
- 真实使用：DEVICE_PENDING、T4/T8 OPEN、T9 NOT_STARTED、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED保持。

工程候选已完成限定复审并获用户验收；公开模型/价格只读核验已完成，可靠完整输入计数依据仍不足，不能证明上界则停在准备阶段。
补缺步骤1已获批准并完成限定只读核对；用户随后批准官方问询，已发送并回读确认（Gate §29.25～§29.26），当前SENT_AWAITING_REPLY。
这不代表计数依据已获认可；counter实现、真实费用授权和模型验收尚未完成，不据此开启真实发送。
无须继续增加孤儿回收、通用灾备、自动解除隔离或重复全部历史浏览器排列。

### 17.2 本地交付范围核对（2026-11-02）

当前状态为 ENGINEERING_SYNTHETIC_ACCEPTED / QUALIFIED_COUNTER_PENDING，B/D/AI-1 OPEN。
本节为用户批准的等待期最小收尾，不重写旧批次状态或重新生成冻结补丁。

| 分类 | 已核对范围 | 交付边界 |
| --- | --- | --- |
| LMS 实现、测试及运行依赖 | 当前矩阵 manifest 的45项指纹全部匹配；HEAD为 `1d49abb11580172fa86a7e282cb31588bf682027` | 复用现有冻结候选，不把本轮文档整理称为新业务修复 |
| DeepTutor 实现、测试及依赖 | 23项指纹全部匹配；HEAD为 `f7aed0744c36c5afef16a4261c31ebee1208cac2`；全部23项未提交路径均在指纹清单内 | 是独立仓库交付，不能只提交LMS就声称远端实现已发布 |
| 契约 fixtures | 6个 `docs/contracts/fixtures/ai1-*.cases.json` 与A批冻结hash一致 | 不因其位于docs而遗漏业务契约测试数据 |
| 活文档 | API、设计、测试方案、架构、计划、门禁与导航 | 属于持续追加记录；不要求与历史文档hash相同，也不覆盖旧失败 |
| 证据 | 37个manifest/patch文件；33项补丁或父manifest摘要引用，以及4条明确父manifest路径/hash均匹配 | 本轮只核验文件hash/引用，不冒称重新应用所有补丁、重验全部原始日志或业务测试 |
| 本地依赖 | `frontend/web/node_modules` 是指向本机依赖目录的未跟踪软链接 | 排除交付；本轮不删除、不改链接或依赖 |

矩阵manifest SHA256仍为 `7d67a6c535b0c85014bc4e6b36c30ffebff6aee1588248b6f10d8fa2b68b0fa2`；
补丁身份及完整历史依赖入口见[现有矩阵归档](evidence/ai1-matrix-20261101/README.md)。
两仓当前非文档实现路径未发现超出上述源码指纹清单的增量；这不是一次新的完整安全审计。
将来提交前仍须复核届时差异及公开证据脱敏；本轮没有提交、推送、CI或Git-clean发布验收。

### 17.3 小批真实验收准备清单（未授权执行）

本清单复用§3和现有正式页面/HTTP路径，不新增框架、不配置真实密钥、不实现counter。
准备完成不等于可发送；以下待填项任一未落实均保持真实发送关闭。
本节原文查找状态保留为准备时快照；2026-11-02随后只读查找结果见§17.4，不将历史封装直接作为AI-1发送候选。

| 步骤 | 执行前必须落实 | 当前状态 |
| --- | --- | --- |
| 完整计数资格 | 官方依据覆盖托管模型、tokenizer、system/角色/生成前缀及额外计费开销；固定版本/hash；实现及永久反例经复评 | QUALIFIED_COUNTER_PENDING；不能用合成8192计数器代替 |
| 三组输入 | 沿用AI-0已批准的三组原创场景，逐组取回并核对原文；仅适配为本轮短讲解，不带入批量变式题要求 | 原文取回及逐字比对待完成；本轮未找到可直接引用的三组原始输入，不重造内容冒充原批准版本 |
| 完整请求 | 每组登记来源类型、合成family/child/source、完整system/user文字、规范请求hash、profile/counter版本、输入上界 | 待counter具备后冻结，家长在页面核对完整预览；不只保存题干摘要 |
| 费用及隔离 | 重核当前官方价格/有效期和全部收费项；核实凭据使用边界；明确家庭单次/日/月及实验总额 | CURRENT_PRICE_AND_BUDGET_PENDING；不继承AI-0的10元或剩余额度 |
| 执行规模 | 建议最多3组、每组1次底层生成尝试，串行且全局付费并发1；不自动重试/换key/追加Cycle | 只是待批准方案；失败/未知不以“补齐3组”为由重发 |
| 实际运行 | 本地合成家庭、正式LMS及本地DeepTutor v1.7.1路径；Provider才是经批准的真实外发 | 须另行取得费用及调用授权；不得操作Ubuntu原服务或真实孩子资料 |
| 人工验收 | 原文、数学核算、数位/计数单位、章节及分龄、修订理由/版本、所见版本审核 | HUMAN_VALUE_PENDING；已知错误必须修订后才可批准，不强制无意义修改 |

费用申请须给出整数微元计算：每次预留按既有契约的完整输入上限8192、输出上限4096和最高适用单价计算，
3次总预留不得超过另行批准的实验额度，并同时满足单次/日/月限额和已有outstanding占用。
既有条件算例不是本轮报价或授权；当前不写死真实验收费用，不声称供应商账户已有自动硬上限。
发送前及最终claim复核报价有效性、权限及sendNotAfter；等待/过期不能沿用失效报价发送。

执行顺序：家长从同孩子任务/错题入口预览并显式生成，核对原Job/remoteOperationId、输出及usage，
再刷新/重登读取，人工修订或拒绝，按所见版本批准；普通任务/错题状态和孩子可见范围不得随之改变。
正常成功可继续下一组；超时、断网、429、费用或计数矛盾、权限异常、日志缺失立即停止新增生成。
未知结果仅显式查询原Job/映射，保留额度及发送槽；不换UUID、不手工退款或把未知写成未发送。
真实小批不注入丢响应来制造额外付费风险；已有合成恢复反例继续作为故障边界证据。

每组记录输入准备、模型等待、人工核算修订的独立耗时，以及直接人工准备同等内容的可比基线
（实测或自报须注明，不清楚记未知）；记录采纳/修订/拒绝及原因，不以生成速度替代减负结论。
费用分别记录预留、usage按冻结报价计算值和供应商账单；账单无法核对则标未知，不声称已对账。
保留原始输出及首次错误，不以修订稿覆盖；只形成家长备课资产，不开放孩子AI入口或推断学习效果。

最小交付为现有证据索引中的一次运行记录及家长结论，不新建验收平台。
计数资格、预算授权、真实运行、人工价值和发布各自给结论；不把页面演示或少量usage一致当计数上界证明。
输入原文恢复可在等待期继续，但不得扩大到扫描真实孩子内容或读取模型密钥；无法取得时再请用户确认替代输入。
T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED及AI-0人工审核限制不变。本轮到文档准备为止，B/D/AI-1 OPEN。

### 17.4 已批准输入的只读找回与差异核对（2026-11-02）

用户已批准§17.2～§17.3的最小收尾复审，未授权真实发送或总门禁关闭。
从原对话找回2026-10-30 20:59:22（北京时间）的完整原创草案，及22:06:55明确
“同意这三组原创输入和审核清单”的用户记录。以下仅为定位摘要，不是新拟输入或完整外发正文：

| 组 | 原批准内容定位 | 历史封装与原文的区别 |
| --- | --- | --- |
| concept | 23盒彩色卡片、每盒124张；解释124×3和124×20及部分积对齐 | 保留124×23及数位主题，但省略文具室情境和显式拆分算式 |
| mistake | 人工模拟206×34错误：824+618=1442；先给不揭晓结果的提示；一道变式保留中间0 | 保留错误算式及引导问题，但省略明确的首提示不揭晓结果和一道变式保留中间0要求 |
| application | 24套材料包、每套78元、预算1900元；估成1920不能据此判断不够；两题分别够/不够 | 保留原数字、错误估算判断及准确核验，但省略两题分别覆盖够/不够的明确要求 |

原草案共用要求、三组拟发送文字及家长核对依据均已读到；家长答案原本标明不发送。
历史封装另设system文字，并非对话草案的逐字副本；当时record.md也明确这一点。
随后23:18:53的首轮执行批准，以及23:47:40“人工修订后适合备课”的家长反馈，是不同阶段的授权/结论，不能混为字节一致性证明。

原临时目录已不存在；本轮未创建替代文件或覆盖旧材料。只在内存读取历史fileChange中未截断的
`inputs.json`全文并重算SHA256，得到 `1df9c3764429b287c347e9448a8419cafca9cd57b1c96239d6ae8161149ce7d6`，
与历史执行前shasum及发送入口固定输入断言一致。该核对证明找回的是当时冻结的输入文件内容，
不是本轮重新发请求、取得网络抓包或复验AI-0计数依据。原批准草案完整对话消息的UTF-8摘要为
`72bba5bbf61f31c82ae599cae9a722f05217a1a7c15c71fd0b10fc0d8695eddf`，与封装文件摘要口径不同，不直接相互比较。

状态：APPROVED_TEXT_LOCATED / HISTORICAL_PACKAGE_HASH_MATCH / AI1_REQUEST_PENDING。
“完全找不到原文”缺口已解除，但AI-1完整system/user、单份短讲解适配、逐字预览和新请求冻结仍待完成。
不得直接沿用AI-0的两道变式题要求或其省略约束的封装，不自行替换输入；后续适配需展示准确差异供确认。
历史离线计数/字节余量、费用和模型成功记录均不能解除QUALIFIED_COUNTER_PENDING；AI-0人工审核限制、
历史失败、DEVICE_PENDING及全部后置状态保留，B/D/AI-1 OPEN。

### 17.5 已批准适配文本与请求正文冻结（2026-11-02）

用户已批准三组AI-1适配system/user及本地冻结，未授权真实发送。
当前文本状态为APPROVED_TEXT_FROZEN，归档候选为FROZEN_PENDING_REVIEW_NOT_AUTHORIZED；
§17.3～§17.4的原文待找回/适配待完成是历史快照，当前以本节为准，不覆盖旧记录。
完整文字、与原草案的准确差异、完整Provider正文及分层hash见
[输入冻结候选](evidence/ai1-inputs-20261102/README.md)、
[manifest](evidence/ai1-inputs-20261102/manifest.json)及
[本地验证](evidence/ai1-inputs-20261102/validation.md)。
三组维持原题数字、模拟作答及教学关注点，明确删除全部变式题要求；不发送人工标准答案或教材。
正文使用现有ai1-prompt-v1与规范user JSON，max_tokens=4096、stream=false、thinking=disabled。
正文UTF-8字节数1556/1561/1551不是token数，不能解除QUALIFIED_COUNTER_PENDING。
本次仅冻结Provider正文；实际来源记录、权限预览、profile/counter版本、报价及sendNotAfter、
完整远端operation信封与生产generationInputHash/requestHash须在资格和费用批准后落实，不能以body摘要替代。
合成profile只供本地纯函数比对，不是正式报价，不继承AI-0的10元或发送权限。
所有输出仍只供家长，保留原始输出、修订理由及所见版本审核；未知保留原Job/映射与费用占用，禁止换UUID或自动重发。
本轮3组契约/预览/正文hash通过，68项源码指纹未变；现有文档矩阵定向2 passed、311未选，非业务全量重跑。
B/D/AI-1 OPEN，计数资格、真实费用与发送、人工价值和发布待验；历史失败、DEVICE_PENDING和所有后置边界保持。

### 17.6 输入候选独立复核及当前阻断（2026-11-02）

§17.5候选已完成主线程复审和独立有界复核，未发现新增P1/P2；不将此结果写成用户验收或发送批准。
冻结manifest仍为5205bcee316e319d8bae60e3cd55960b22764cb2e14558b8581ef67067fd9a43，
原5个归档文件不改，FROZEN_PENDING_REVIEW_NOT_AUTHORIZED保留为冻结时状态；后续评审结果记录于本节及Gate §29.31。
主线程比对原批准适配稿并重算原草案消息摘要；独立复核者未读取原会话，故不独立背书历史溯源。
独立执行现有归档JS及额外字段/角色/答案/BOM/末尾换行检查，3组正文、2文件摘要、分层hash、68项源码指纹通过；
现有文档状态校验exit0。Provider为源码静态比对，未运行真实Provider或counter；独立复核未重跑Jest或全量业务测试。
主线程此前矩阵定向2 passed/311未选与独立检查分开记录，不改变原业务全量及历史失败结论。

2026-11-02北京时间19:55的只读邮件检查：原询问会话仍仅1封SENT，
全部邮件范围（含垃圾邮件/垃圾箱）相关发件域名/主题搜索仅返回原发件，相关退信搜索为空。
未取得新的官方计数依据，未回复或催询、不创建新轮询。本次结果不是对未来来信状态的保证。
当前可独立完成的限定合成工程和输入准备已完成；剩余顺序仍为计数资格依据与受控实现/反例复评、
当前报价及本轮费用批准、实际页面小批调用与家长价值验收、独立发布授权及总门禁批准。
不得用固定字节数、合成8192计数器、旧10元或只跑替身消除这些前置条件。
本轮不新增实现、发送入口或计数器；B/D/AI-1 OPEN及所有未关闭/后置状态保持。

### 17.7 双仓合成工程保存交付授权（2026-11-02）

用户授权先整理双仓提交/PR，保存已完成的限定合成工程；技术依据暂缓核验并保留记录，
不是取消QUALIFIED_COUNTER_PENDING或同意以替身/字节数启用真实发送。
本授权替代此前“不提交推送”的本轮交付限制，不授权合并、部署、读取真实密钥或付费调用。
三组冻结候选不变，仍需人工审核、原命令未知保护及另行真实费用/调用批准。
LMS候选基于尚未合并的T8交付，使用依赖该分支的Draft PR，避免把T8改动冒充AI-1增量；
DeepTutor交付使用用户随后明确批准创建的公开fork mflyn/DeepTutor，PR仅向个人fork的main，不向HKUDS上游推送或提PR。
提交前核对完整文件清单、公开敏感信息和既有证据引用，排除依赖软链接及私有原始日志；
CI只执行测试，不启用性能/安全外部扫描、镜像发布或部署。CI与本地结果按实际范围记录。
B/D/AI-1 OPEN、历史失败、DEVICE_PENDING及全部未关闭/后置状态保持，不能将PR创建当总验收通过。
本轮交付范围、基线、公开检查及验证索引见[双仓交付记录](evidence/ai1-delivery-20261102/README.md)。
