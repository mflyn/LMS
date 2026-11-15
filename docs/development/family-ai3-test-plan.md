# AI3-1 测试方案与设计自查

**Document status:** APPROVED (2026-11-04)
**AI3-1:** ACCEPTED / USER_APPROVED
**AI-3 gate:** CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY

2026-11-05批准AI3-E及后续工程验收和限定合成总门禁关闭；[批准及证据](evidence/ai3-integration-20261105/closure-review.md)。
同候选原家庭入口213套6408项一次通过，exit0；历史失败、DEVICE_PENDING、T4/T8/AI-1 OPEN、
Docker INCOMPLETE_FAILED、非阻断补测及后置范围不变。下文批次待审记录保留历史，不授权真实模型/Git/部署。
配套：[设计](../superpowers/specs/2026-11-04-family-ai3-minimal-design.md)、[API](../api/family-ai3-api.md)。
矩阵是完整目标，首批结果另见§6及批次记录；未在批次记录中实跑的用例仍为PLANNED_NOT_EXECUTED，不把旧AI2测试当AI3通过。

## 1. 测试边界

复用现有Jest副本集、真实HTTP harness、组件测试、Playwright自主学习入口和文档检查；不新建框架或独立守护执行器。
单测/组件允许替身；最终HTTP/浏览器使用正式Gateway、homework、resource、analytics、progress、user及真实媒体/权限。
模型端必须明确：DeepTutor受限operation实现若参与则是真实本地HTTP/store，Provider/计数/价格是合成替身，不连接公网或付费API。
禁止seed人工批准、绕过启动预检或mock成功媒体；从AI1人工修订批准→AI2发布订正审核→AI3的最小连接用现有合成Provider准备。
只用临时数据库/目录和合成账号；不操作Ubuntu/NAS，不读密钥，不执行高级恢复/自动回收。触控/WebKit不替代真机DEVICE_PENDING。

## 2. 永久用例矩阵

U=单元/契约，H=真实Mongo事务/HTTP，C=组件，B=浏览器；多条件允许同一套件覆盖，不为每行开独立门禁。

| ID | 场景及必须断言 | 层级 |
| --- | --- | --- |
| AI3-SOURCE-01 | AI2已approve的task/mistake均能新建；未审/退回/撤回、假Attempt/hash、换孩子拒绝，零Round/预算/模型副作用；数学别名只接受原精确映射 | U/H |
| AI3-SOURCE-02 | 创建/发布/最终提交/审核与AI2撤回交错，争用同一父Package条件写；撤回胜出无新可见内容，非仅snapshot read；已成功审核不被后续撤回删除 | H |
| AI3-CONTENT-01 | 2/3题合法；0/1/4题、重排/重复ID、空白、超长、URL/HTML、稀疏、未知字段、坏UTF8及32KiB边界；非法输入零副作用 | U/H/C |
| AI3-CONTENT-02 | 手工初版无调用；人工修订新版本保留旧文、理由和actor；生成unknown禁止手工/新轮绕过；发布后不能改题/答案；拒绝后人工修订再发布；取消终态拒绝新业务写入但可历史重放 | H/C |
| AI3-GEN-01 | 完整system/user/选项/profile/hash与预览一致，无孩子ID/答案/图片/隐藏消息；AI1旧prompt及schema仍拒绝练习输入，AI3不复用explanation-jobs | U/H |
| AI3-GEN-02 | AI1与AI3并发争同预算/slot，一个胜者；旧无ownerProfile兼容，新/未知owner分派；跨日/月unknown保占用，无第二预算池 | U/H |
| AI3-GEN-03 | 截止点前后、报价变化、计数资格不足、关闭模式；未claim失败可释放，claim持久后accepted/丢响应/重启只GET零再次发送；矛盾退款/404不释放；祖先撤回后已claim仍结算且输出不得发布 | U/H |
| AI3-GEN-04 | 原始输出与结构超限/错题量/非法格式、真实返回已收费但无合法candidate；结算一次，不将失败输出发布给孩子；SDK/HTTP所有隐式重试为零 | U/H |
| AI3-PUB-01 | 家长全文及孩子预览hash/版本匹配，批准与发布原子；两个共管同/不同UUID仅一胜者，旧预览409，发布不改AI2审核或触发模型/发星 | H/B |
| AI3-VIEW-01 | 孩子列表/详情/历史/命令完整白名单；答案/rubric/费用/生成输入/存储路径从未下发，passed也不放开；猜测草稿/他人ID拒绝 | U/H/B |
| AI3-SUBMIT-01 | 仅用孩子DTO构造childSnapshotHash提交成功，服务端绑定完整ContentHash；错投影/旧版本/额外contentHash拒绝且零占位；初交→退回→再交→通过，Attempt递增/原review不覆盖；submitted/passed再交拒绝，新UUID竞争只一个占位；家长代录拒绝 | H/B |
| AI3-SUBMIT-02 | prepare/commit成功丢响应及BSON重建；原remoteID/完整引用集/代次恢复；失租旧owner不abort，持久RESOLVING后只清理不可再发布 | H |
| AI3-MEDIA-01 | 1/10图、10MiB边界、错purpose/type/field/PDF/HEIC/跨孩子拒绝；新增认证正文旧匿名URL拒绝；原task/AI2/错题PDF行为不变 | U/H/C |
| AI3-MEDIA-02 | 部分上传失败后的焦点/手动刷新保成功项、失败项及提交锁；普通移除/离开不DELETE；删除与提交竞争、同图多代次、清理后精确墓碑占位 | H/C/B |
| AI3-REVIEW-01 | Round/Content/Attempt/hash任一旧值拒绝；两共管竞争首个actor/time不变，迟到成功/409不能自动审核新版本；revise必有反馈无任何效果 | H/C/B |
| AI3-REVIEW-02 | approve完整图片不可读/依赖故障零审核；通过确认不再次依赖媒体读取；事后删除不改审核/掌握，退回/撤回不因旧图缺失受阻 | H |
| AI3-EVIDENCE-01 | masteryConfirmed=false或无KP不写MasteryEvent；非法true/null拒绝；task仅所选同孩子数学KP，mistake只原关联，不能猜测K12/新建错题 | U/H |
| AI3-EVIDENCE-02 | approve原子保存finalReview及两个固定effect；事务回滚零效果，提交未知先查原命令；消费者拒绝伪造/未提交/错误摘要/跨家庭证据 | H |
| AI3-EVIDENCE-03 | 一侧成功另一侧丢响应/503后原命令接续，只写一次事件/回执；原本skilled仍有一条该轮证据，not_requested不伪报applied；GET零写 | H/B |
| AI3-EVIDENCE-04 | 预览后/本地审核后普通T6状态更新、媒体混合pending、关联变化、KP更新及目标删除；版本冲突永久not_applied，不能覆盖新状态；同毫秒/ABA有revision保护 | H |
| AI3-EVIDENCE-05 | 已applied后目标再次改变再重放，先回执后CAS不重写旧状态；同effect异正文409；未知回执不能换ID，off仍可原命令收敛；周日审核/周一应用不回填上周，effectiveAt=首次appliedAt，两侧可不同；回滚重采样，提交未知/重放不改持久时间，未应用零事件 | H |
| AI3-DATE-01 | 闰日/不存在日期/格式/类型，合法历史/未来日期；null不清原错题日期，复习按范围可查；task无mistake只存本轮日期，无自动任务/星星/次数 | U/H/C |
| AI3-WITHDRAW-01 | 自身/祖先撤回后孩子正文/媒体不可读，有其他合法绑定不全局删图；parent可看历史；pending先收敛再释放active，新轮不迁移旧Attempt | H/B |
| AI3-IDEM-01 | 所有POST同key异正文含终态拒绝；多actor同UUID隔离；旧命令重放指原结果，endpointOperation/路径不同不能串用 | U/H |
| AI3-RECOVER-01 | 响应丢失刷新/重登，原actor发现/显式恢复原payload；坏JSON退出清理；无记录不自动重POST；他人恢复及原actor撤权拒绝保未决证据 | H/C/B |
| AI3-SESSION-01 | 当前403/404清私有视图并封迟到成功；旧401不退出新身份；账号/孩子/跨标签切换清DOM/blob/暂存，网络失败保原命令 | C/B |
| AI3-OFF-01 | 所有服务默认关闭；缺索引/凭据/日志/guard/混合owner或类型不支持拒绝启动；off旧读删/撤回/原命令规则，旧类型摘要与回归不变 | U/H |
| AI3-FLOW-01 | 从正式AI1人工修订批准和AI2审核起步，2题与3题各验证准备/批准/提交/退回/通过/回看/复习及真实审计；Provider替身之外真实HTTP，零额外模型请求 | H/B |

关键修复必须保留失败复现、同一永久反例及修复后结果。对漏掉CAS/权限/零副作用保护的测试，做最少逐项变异，
不机械重跑已完成的所有旧变异；不得删断言、增加超时或把重跑通过当根因解决。屏障/deferred用finally收尾。

## 3. 实施后的验证顺序

1. 协议/状态层：新增闭合schema/fixtures接既有文档及契约校验；homework/analytics/progress/resource相关单测和真实副本集事务测试。
   AI1预算owner分派改变必须跑AI1原预算/操作恢复和DeepTutor本地现有服务测试，不只跑AI3。
2. 页面：API与组件反例；共享会话/媒体变动扩大到全部调用方。用正式应用测试提交/权限/跨服务效果，不以组件mock代替。
3. 组合：真实Provider入口接替身transport，正式HTTP及当前前端生产构建在Chromium/WebKit分别验证；记录真实服务与替身边界。
4. 交付：`npm run test:family-regression`、`npm run test:ci --prefix frontend/web -- --runInBand`、
   `npm run build --prefix frontend/web`，按已有自主学习浏览器入口加入必要场景；低配置目标机/真机另行授权。

设计阶段仅`npm run docs:family:check`、`git diff --check`和新增文档链接/内容对照；
旧状态校验器未包含AI3语义，不以它通过证明新契约已可执行。实施时再纳入明确profile探针，不在本批改程序。
不自动新增完整release、Git clean授权，不安装依赖/新增服务器。完整功能门禁关闭须有实际覆盖与用户批准。

## 4. 设计自查与需求追踪

| 必需需求 | 设计/API对应 | 测试 |
| --- | --- | --- |
| 订正通过才发起少量练习，父母批准 | 设计§1/4，API§2/3 | SOURCE、CONTENT、PUB |
| 人工审核、题/答案/作答/首次审计保留 | 设计§3/6，API§3/4 | SUBMIT、REVIEW、IDEM |
| 掌握与通过分开，复习可追溯、重试不重复 | 设计§6/7，API§4/6 | EVIDENCE、DATE |
| 家庭/孩子权限和认证私有媒体 | 设计§4/6/8，API§1/5 | VIEW、MEDIA、SESSION |
| 原命令、未知费用/提交/效果恢复 | 设计§5/7/8，API§2/4/6 | GEN、RECOVER、EVIDENCE |
| 不扩张平台、默认关闭与历史兼容 | 设计§1/2/9，API§5/7 | OFF、FLOW及受影响旧回归 |

初次自查已明确：AI1无练习profile、旧practice schema强制课程节点、旧finalReview强制错题/KP、
两个状态服务缺稳定effect回执；这些是实施差异，不伪装为当前已有。真实发送计数/价格/授权仍独立阻断。
待用户评审的产品选择集中在设计§1，尤其无KP的证据语义、整组作答、一次批准发布和冲突后不强行追写。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测、
QUALIFIED_COUNTER_PENDING、REMAINDER_DEFERRED及T9 NOT_STARTED不变；AI3-1未批准前不得编码。

## 5. 本轮设计检查记录（2026-11-04）

本轮只新增上述三份设计文档，工作区起点为main `a4f051e26f3514da051910a3495e11b149a32c45`。
对开始时18项未提交文件/符号链接逐项比对SHA256，全部保持原值；T8、AI1/AI2状态增量及共享Gate/计划不纳入本批修改。

| 来源 | 发现与修订 | 当前结论 |
| --- | --- | --- |
| 作者自查 | 补明取消后的终态限制、退回不立即创建Attempt、生成期间祖先撤回的查询/结算及禁止发布边界 | 已写入设计/API及对应计划用例 |
| 独立builder check P1 | 孩子submit原要求完整ContentHash，但孩子DTO无法取得；改用childSnapshotHash，服务器绑定完整内容，保持孩子白名单 | 修订后限定独立复核确认设计层闭环；SUBMIT-01计划补正反例 |
| 独立builder check P2 | 延迟写回缺少事件生效时间定义；分离reviewedAt/appliedAt，effectiveAt取首次成功应用事务时间，不回填此前周报 | 修订后限定独立复核确认设计层闭环；EVIDENCE-05计划补跨周/回滚/重放反例 |

独立复核为只读文档与必要代码核对，未运行AI3业务测试，不替代用户批准。修订后未发现上述限定范围内新的重要缺口。

实际执行的文档验证：

- 使用现有Node22及依赖执行`npm run docs:family:check`，退出0；旧基线/AI2/契约校验通过，未增加AI3可执行探针。
- `git diff --check`退出0；另用只读Node检查三份未跟踪新增文档，9条本地链接/锚点存在、代码围栏闭合、无尾随空白。
- 矩阵计数28项，全部PLANNED_NOT_EXECUTED；检查孩子submit字段与可见DTO衔接，不将文本检查当作运行时契约通过。

待用户评审设计§1产品取舍和完整三稿。AI3-1仍DESIGN_REVIEW_PENDING，AI-3仍OPEN/NOT_IMPLEMENTED；
无业务实现/自动化测试改动，无真实模型调用、提交、推送或部署。

## 6. 后续批准与首批边界

2026-11-04用户明确批准设计、API、测试方案及§1取舍；AI3-1 ACCEPTED / USER_APPROVED。
孩子提交摘要P1与事件生效时间P2 CLOSED / USER_APPROVED，绑定§5修订及后续只读复审结论；历史待审记录不覆盖。
首批为未接正式路由的家长手工候选状态服务：创建、不可变修订、拒绝、预览、发布、取消/撤回、角色只读和原命令重放。
采用现有Jest副本集，验证实际Mongo事务和实时权限；来源读端口使用标明的替身，AI2已批准来源为隔离前置夹具，
不是从AI1开始的正式HTTP/浏览器验收。模型费用、孩子媒体提交、最终审核及复习写回、页面/正式装配均仍待后批。

## AI3-C 本地生成准备补验

GEN/RECOVER的本地子集见[AI3-C记录](evidence/ai3-c-20261104/README.md)。
在原AI3服务测试中增加完整预览、原actor预留/重放、同UUID共管竞争、提交未知及claim未知、过期未claim释放、
祖先快照后撤回竞争、权限拒绝和手工写入互斥。完整system/user及固定选项有独立golden用例。
冷初始化不依赖随机调度：在真实事务写入后注入已知family/experiment/global重复键，
断言回滚、恰好两次尝试和三个原ID保持；未知重复键/重试耗尽不继续执行。
最终slot await后必须重验启用状态、当前profile与截止点；分别注入off、报价替换和跨截止点，断言零持久claim与完整回滚。
本地原命令恢复只读，不代表远端GET/终态编排已完成；原GEN/RECOVER整行仍待远端、正式HTTP和页面验收。
首批不产生真实模型/远端媒体调用，不迁移真实数据；回退只需保持模块未装配，无生产数据回滚。
批次证据与独立评审见[首批记录](evidence/ai3-a-20261104/README.md)。总门禁保持OPEN，不提前将完整28行标为通过。

## AI3-D 远端与结算补验

见[D批记录](evidence/ai3-d-20261104/README.md)。新增闭合profile/摘要/凭据及有限响应HTTP测试，Provider仍是替身。
永久反例覆盖PUT丢响应后原GET、旧accepted/not-found不重发或退款、持久claim与矛盾退款、无usage跨期保留、
非法已计费输出不生成Content、事务回滚/提交未知、并发结算一次、祖先撤回后审计候选、实时撤权与原actor拒绝。
补强缺失持久摘要零出站、成功结果引用实际Content版本、迟到accepted不倒退终态；各对应独立变异。
无公开页面/孩子提交/人工效果验收，不将此服务批次算作GEN/RECOVER全链路或AI-3总门禁通过。

### AI3-D 完整请求32KiB补验

复审发现旧客户端允许64KiB，而远端在32KiB超限时尚未持久化operation；不得在本地claim后才发现正文过大。
补验记录见[32KiB修订候选](evidence/ai3-d-size-20261104/README.md)，原D冻结、开发全量及历史失败不覆盖。
永久反例覆盖：完整请求含hash的32767/32768/32769字节、中文UTF-8多字节、引号和反斜杠转义膨胀；
实际HTTP收到恰好32768字节，超限零额外请求；长来源新预留零写，同原命令重试仍拒绝；拒绝后AI1/AI3分别取得共享槽。
历史RESERVED超限重建夹具必须在claim前拒绝，账户/预留/命令/槽保持不变；远端413后404仍UNKNOWN、原映射GET，不退款、不补发PUT。
独立复评补强历史超长UNKNOWN本地413反例：零新增GET/PUT，原UUID/hash、祖先、命令、未知费用和槽均保留，不误记恢复成功。
移除字节检查、改数UTF-16字符、漏计封装/hash及移除claim前复核分别做临时模块变异，不改生产文件或放宽原断言。
夹具对不可变来源仅用合成数据库原始写入并读回断言，不将此写入方式用于产品路径或真实数据。

## AI3-E 孩子提交与私有媒体补验

D批及32KiB P2/历史UNKNOWN P3已获用户批准，见[批准记录](evidence/ai3-d-size-20261104/acceptance.md)。
本批仅实现SUBMIT、MEDIA、WITHDRAW、IDEM、RECOVER、VIEW和OFF的后端子集；不将整行页面、审核或效果写回标为完成。

- 提交：孩子所见contentId/version/childSnapshotHash绑定服务端完整内容；1/10图、重复/稀疏/非法输入、家长代录、
  旧版本及新UUID竞争；原映射持久化、owner/phase/lease CAS、事务回滚和提交未知，只确认RESOLVING后精确补偿。
- 祖先：占位及最终发布均条件写AI2 Package；快照读后撤回竞争有确定性屏障，失租旧owner不清理成功引用。
- 媒体：独立默认关闭、封闭purpose/type/field、真实图片上传与UploadGuard、认证正文及当前身份、删除墓碑与精确凭证。
  普通解绑不变成草稿预览；删除与COMMITTED恢复保留原作答集合，删除占位不改教学状态。
- 读取：孩子Attempt、命令及媒体元数据白名单；当前家庭/原actor检查，异步读取后重验身份和可见性。
- 回归：复用AI2严格inspect解析器和既有完成媒体协议，须验证AI2、任务材料和错题PDF；不改旧摘要，不新增高级恢复/回收。

服务级测试允许预置已审核AI2来源与媒体端口替身；组合测试的AI3创建/修订/发布/提交服务、资源operation、
认证媒体授权及inspect通过真实本机HTTP连接，图片文件、上传/删除日志和Mongo事务真实，来源查询为合成替身。
它不是正式Gateway全链路、前端或AI1起始验收。实际数量、失败、自查与独立复评以本批最终证据记录为准。
所有临时服务器、屏障与目录在finally收尾；未知结果不换UUID、不隐式重发，不自动删除用户媒体。
AI-3、T4/T8/AI-1 OPEN，DEVICE_PENDING、历史失败、非阻断补测和后置范围保持。

### 后续集成差异补验（2026-11-05，尚未总验收）

原28行与批次历史保留；最新进展见[集成记录](evidence/ai3-integration-20261105/README.md)，
独立证据见[增量复评](evidence/ai3-integration-20261105/independent-review.md)。

- SOURCE-01/VIEW-01：历史来源三态使用原来源读取，不调用家长专用review-context；
  confirmed 404才missing，未知失败unavailable，可信403仍拒绝。PIN/member/ancestor在外部读取结束后重新验证；
  开发两套103项通过、收尾后定向10项通过，独立31项通过；一次移除后重验的变异被三个屏障反例拦截。
- CONTENT-02/VIEW-01：家长私有Content分页与精确旧版本详情已补齐；原后端55项及独立真实HTTP七项通过，
  前端开发与独立24项通过。实际浏览器验证历史零写、孩子拒绝及旧版本不替换当前发布预览；不自动关闭矩阵验收。
- EVIDENCE-05：新增真实consumer及repository组合，周日review、周一应用后首次生成上周报告；
  首轮发现建议文案错误使用当前mastered，修复后作者及独立原周报套件各34项通过。
  proof查询为合成替身，不将该组合记为新的正式HTTP测试；无迁移或冻结历史报告重算。
- FLOW-01：原四组正式双引擎/双来源闭环保留；新增历史读取及375px命令卡高度检查后四组114.85秒通过，
  最后resource/冷夹具/DeepTutor取消修订后四组116.21秒通过。前端完整71套1163项及构建通过，属于开发验证。
- 完整家庭后端首轮209套中46失败/163通过，主要依赖链接及旧架构Git环境失败，另有JSON导出失败；
  已保留文本日志。环境定向修复通过不代替完整回归，当前不能报告全量全绿。

上述为阶段历史；后续完整回归6320通过/3失败发现resource启动兼容及冷加载缺陷，修订/独立复验后，
最终家庭210套6331项通过，正式HTTP入口9套107项通过（50应用/HTTP、57纯效果断言），
最后正式浏览器四组116.21秒通过。DeepTutor原235通过/1超时保留，取消传播修复后独立242项通过。
当前[28项覆盖归并](evidence/ai3-integration-20261105/coverage.md)及[工程验收准备](evidence/ai3-integration-20261105/engineering-readiness.md)
绑定最终候选与分层证据；不将过去失败改写为绿灯，不自动批准E或关闭总门禁。

本批修复与证据归并见[AI3-E候选](evidence/ai3-e-20261104/README.md)：自身Round撤回期间保留待清理槽位、
祖先依赖503不得伪正常裁剪、最后一次远端授权等待期间和整批文件读取期间的权限/删除/解绑竞争均有永久反例。
九项媒体竞态变异针对原在途请求失败，不靠重发请求证明拒绝。既有RESOLVING单门槛变异存活仍保留，
不把后续phase CAS的防御效果冒充该门槛独立敏感性验证。
