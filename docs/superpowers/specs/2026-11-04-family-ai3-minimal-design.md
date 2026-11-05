# AI3-1 少量变式题与复习记录最小差异设计

**Document status:** APPROVED
**Profile:** AI3-MIN-1 (`ai3-min-v1`)
**AI3-1:** ACCEPTED / USER_APPROVED (2026-11-04)
**AI-3 gate:** OPEN / ENGINEERING_VERIFIED / USER_ACCEPTANCE_PENDING

用户已批准三稿及§1取舍，授权首批本地合成实现；不授权真实模型、Git或部署。基线 `a4f051e26f3514da051910a3495e11b149a32c45`。
配套：[API](../../api/family-ai3-api.md)、[测试及自查](../../development/family-ai3-test-plan.md)。
依据：[路线§9](../plans/2026-10-21-family-self-directed-learning-mvp.md#93-正式集成的最小交付与验收)、
[AI2设计](2026-11-03-family-ai2-minimal-design.md)、[AI1设计](2026-10-31-family-ai1-minimal-design.md)。
设计阶段仅新增三稿；首批实现只向共享Gate追加本批记录，不改写既有T8及AI1/AI2状态增量。

## 1. 目标与待批准取舍

家长看过并通过AI2订正 → 显式准备2或3道同章节变式题 → 家长修订并批准发布 → 孩子纸上/iPad作答上传 →
家长按所见版本退回或通过 → 保存不可变练习证据、家长选择的复习日期，符合条件时写入掌握证据。
只做四年级上册多位数乘两位数；教材/章节沿用parent_declared，不声称检索过教材或拥有新增资料许可。

以下取舍于2026-11-04获用户明确批准：

| 产品点 | 最小选择 |
| --- | --- |
| 入口 | 仅当前家庭中published且approved的AI2包，其当前Attempt已人工approve；task/mistake两种原来源均保留 |
| 题量 | 家长选2或3题；无自动加题、自动难度调整或无限生成 |
| 准备方式 | 新受限AI3生成profile，或家长手工录入同结构候选；本轮工程只用Provider替身，未知生成不能用手工绕过占位 |
| 内容 | 每题纯文字题干、家长专用答案和判定要点；不含题目附件、链接、Markdown/HTML、课程节点或OCR |
| 批准 | 家长审阅完整题目/答案和孩子预览后，一次“批准并发布”；无需新增先approve后publish的中间状态 |
| 提交 | 孩子本人整组提交1–10张JPEG/PNG/WebP及可选说明；不按题拆图片、不加家长代录/自动评分 |
| 退回 | 必须反馈，产生新的Attempt；submitted不能编辑，passed只读，原审核不覆盖 |
| 掌握 | 通过练习与确认掌握分开；只有家长明确masteryConfirmed且关联有效本地KnowledgePoint才写掌握事件，不推断K12映射 |
| 来源无知识点 | 仍可完成练习并保存人工通过证据；mastery标为not_requested，不创建虚假KnowledgePoint或MasteryEvent |
| 复习 | 家长可选合法LocalDate；null表示本轮不安排，不清空错题已有日期；不自动计算间隔或创建GrowthTask/发星 |
| 次数 | 同AI2包同时最多一个未收敛轮次；通过并完成/明确拒绝后续写回，或取消/撤回并清理完毕后，才可显式新建下一轮 |

不做题库平台、通用Outbox/队列、新常驻服务、聊天、自动判题、跨章节、PDF/打印或高级媒体恢复。
两种替代方案：直接扩展AI2包会混淆订正与练习版本；照搬旧Tutor全平台需强制错题/知识点/K12及更多状态。
推荐独立最小轮次，复用实现机制而不冒充旧契约兼容；正常流程不增加内部小步骤审批。

## 2. 已核实的实现与差异

路径相对仓库根目录；这是代码核查，不是新功能已实现。

| 现有实现 | 可复用 / 必要差异 |
| --- | --- |
| `backend/services/homework-service/models/Ai2.js`、`services/ai2Service.js` | Package/Attempt审核CAS、角色DTO与命令记录可参照；AI2通过明确不写掌握/错题，不能修改其语义 |
| `services/ai2SubmissionService.js`、resource AI2读/删分派 | 可复用持久映射、RESOLVING、精确代次、认证blob和删除占位机制；新增封闭AI3类型，不冒用ai2_attempt ID |
| `services/ai1Contract.js`、`models/Ai1.js`、`services/ai1Operation.js` | 当前prompt禁止练习、Artifact仅text、Job绑定cycle；需新profile/内容类型，不能直接调用explanation-jobs产出题组 |
| DeepTutor `deeptutor/services/ai1_operation.py`、`ai1_contract.py` | 当前只认ai1-provider-operation-v1；复用单次持久claim/未知结果/只读查询机制，不修改旧profile或调用线上服务 |
| `backend/common/services/learningSource.js` | 仅返回id/family/child/subject/title；没有复习日期、knowledgePointId、CAS版本，不能据此构造写回条件 |
| analytics `models/FamilyMistake.js`、`FamilyMistakeStateEvent.js`、`routes/familyMistakes.js` | 已有reviewReminderDate/reviewed/mastered及不可变事件；普通PATCH用新随机operationId，无跨服务稳定回执，不可直接当可重试consumer |
| progress `models/KnowledgePointMasteryEvent.js`、`routes/knowledgePoints.js` | 事件必须有knowledgePointId；普通PATCH按masteryLevel变化写事件，不能保证每轮通过都有一次证据或安全重放 |
| `frontend/web/src/services/ai2Commands.js`、`ai2MediaApi.js`、`components/family/Ai2Media.js`、`pages/family/Ai2LearningPage.js` | 复用原命令暂存、身份代次、草稿/只读媒体分离；新增AI3字段/路由，保留旧AI2/任务/错题PDF回归 |

旧`practice-content.schema.json`要求课程节点，旧`mastery-evidence-command-payload.schema.json`的finalReview要求
sourceMistakeId和knowledgePointId；AI3同时支持task与无知识点来源，不能直接声称满足旧v1。
实施时新增版本化AI3 schema，保留旧schema/fixtures原样；本轮只交文档，不增加可执行schema或测试代码。

## 3. 最少持久状态

四种homework记录即可；不新建通用任务引擎或额外常驻消费者：

- **Ai3Round**：familyId/childId、sourcePackageId、sourceAttemptId/version/reviewHash、原source和章节快照，
  exerciseCount、可空knowledgePointId与来源选择快照；stateVersion、activeCommandId、active，
  preparation=`ready|generating|candidate|rejected`，visibility=`draft|published|withdrawn`，
  learningState=`open|submitted|revise|passed`，cancelledAt可空，当前Content/Attempt指针、发布/撤回审计、finalReview可空。
- **Ai3Content**：round/version、2–3题完整不可变正文、contentHash、origin=`ai_generation|parent_manual|parent_revision`、
  derivedFromContentId、创建者/时间；发布保存确切contentId/version/hash及孩子投影hash，之后不可换题。
- **Ai3Attempt**：round/version、submitCommandId、原actor/time、不可变note/mediaIds/精确bindings/payloadHash、一次追加review。
- **Ai3Command**：family/child/actor/endpointOperation/operationId、requestHash/规范payload、结果引用和首次审计；
  生成附完整预览/预算reservation/独立remoteOperationId/claim/owner/lease；提交附预分配Attempt及媒体映射；
  最终审核附不可变finalReview及两项写回的固定effectId/hash/目标版本/回执。未使用字段按操作类型拒绝，不允许任意Mixed输入。

索引：Round `(familyId,childId,sourcePackageId)`在active=true部分唯一；Content `(roundId,version)`唯一；
Attempt `(roundId,version)`和submitCommandId唯一；Command `(familyId,actorId,endpointOperation,operationId)`唯一、
remoteOperationId非空唯一，以及按family/child/actor/phase/createdAt发现命令的普通索引。
原actor UUID不是remoteOperationId/effectId，后两者由服务器首次占位产生并持久化。

```text
draft/ready -> generating -> candidate -> published/open -> submitted -> revise -> submitted
                 |              |                             |
                 |              +-> rejected                  +-> passed (不可改写)
                 +-> failed/unknown (分别按生成命令管理)
draft且无未决操作 -> cancelled；published任意学习状态 -> withdrawn
```

每轮最多一次生成Job（用generate Command承载）；失败终态可手工候选或取消，不能同轮再发模型。
candidate/rejected可人工新版本；发布后不修改题干/答案，出题错误只能撤回后显式新轮次，不迁移历史Attempt。
passed仍可回看和撤回；active只在待处理写回已收敛、未决媒体/生成不存在后释放。
cancelledAt非空为终态：拒绝生成、修订、拒绝候选、发布、提交及新审核；仅保留当前权限允许的历史读取与原终态重放。
退回不立即创建空Attempt，由孩子下一次显式提交创建新版本；不得将退回本身当作孩子已作答。

## 4. 来源、可见性与竞争

创建与发布都检查AI2仍published/approved、当前Attempt审核approve且绑定快照一致。原来源404阻止新创建/生成/发布，
503保留依赖错误；已发布内容不因源题改写而变化，历史详情标记available/missing/unavailable。
原AI2包撤回是更强可见性边界：其AI3子包即使自身仍published，孩子也不能读/提交/审核；家长保留历史。
不批量改写所有子记录，使用每次实时祖先授权；媒体access及正文也检查该条件，不缓存可见性。

创建、发布、提交最终落地、审核等本地事务，除了Round CAS，还必须对AI2 Package做条件写以与其withdraw竞争；
采用现有stateVersion递增保护并验证visibility/learningState/currentAttempt，不改变AI2审核内容。
仅snapshot read后插新集合不足以防write skew。先前已成功finalReview不因之后撤回而删除或再次发星。
媒体检查与本地审核不是跨服务原子锁；记录检查时间/完整引用摘要，事后删除显示占位而不伪造从未提交。

家长可看本家庭孩子所有候选、答案和历史；孩子只看有效published的题干、自己的已提交作答与家长反馈。
家长答案/判定要点即使passed也不自动给孩子。发布预览展示准确的孩子投影，纯文字题干仍需家长确认没有泄漏答案。
自己的未提交草稿仅本人可见；孩子不能查询生成/费用/其他actor命令。列表和详情均采用明确DTO白名单。

## 5. 生成、费用与未知结果

新增`ai3-practice-v1`受限Provider profile及版本化请求/响应；只允许2–3题纯文字结构，不能泛化旧AI1接口。
完整两条system/user消息及固定参数必须预览并绑定hash；不读取/发送订正图片、孩子答案、姓名、ID、审核者或私有家长上下文。
外发仅家长确认可用的原题、已批准讲解、章节、题量。完整输入过长直接拒绝，不能静默截断或附加隐式消息。
复用AI1规范化/JCS摘要、报价过期复核、整数CNY micros预留/结算及持久单次claim的规则。

**预算必须共用原家庭/日/月Account和全局SendSlot**，不能给AI3另开同额预算绕过限额。
现有Reservation.jobId/Slot.jobId的解析假定AI1 Job；实施需增加闭合ownerProfile分派（旧记录缺省ai1，新增显式ai3），
新Ai3Command ID全局唯一，所有对账/slot恢复/启动预检识别两种owner，未知profile拒绝，旧账本键/旧预留不变。
这是固定两类协议适配，不建可插拔注册平台。跨日/月未知占用继续计费，关功能、撤权、租约过期都不能释放未知费用。

每次最多1个底层发送尝试，SDK/HTTP/Provider自动重试全部禁用。旧accepted、claim后断联、超时或未知结果只能GET查询，
不能再POST来试探；未发送的安全失败必须有可信未claim证据。报价在真正claim前复核，过期未claim才可释放；
claim后不因后续not-found/过期/矛盾退款释放费用。有效用量结算一次；已收费但输出格式非法记生成失败，不生成孩子内容。
父母人工修订保留原输出，生成未知时不允许另开轮次/手工完成来丢掉未决锁。
生成等待期间祖先AI2撤回：尚未取得发送资格时拒绝发送；已经claim则仍按原命令查询/结算，不撤销实际费用。
返回内容只存家长候选审计，不自动发布；祖先不再合法时发布仍拒绝。原生成收敛后才允许取消并释放本轮活动占位。

真实profile的完整输入计数资格仍未满足：QUALIFIED_COUNTER_PENDING，真实发送默认拒绝。
本设计不沿用AI-0的10元作为新授权，也不宣称已具自动硬上限；实施只用明确标注的合成profile/Provider替身。
DeepTutor仅核对本地实现；后续跨仓修改需实施授权，不能操作现有Ubuntu服务。

## 6. 提交、人工最终审核与复习

图片使用新增purpose=`ai3_practice`、resourceType=`ai3_attempt`、field=`practiceMediaIds`的封闭三元组。
复用AI2事务operation/client/认证正文/精确删除证据，新增对应分派、readiness和日志类型；不改变旧摘要或允许交叉组合。
原actor提交占位保存Attempt ID/version、remote ID和全引用集；只允许当前owner按阶段CAS前进。
孩子提交只携带其实际可读的contentId/version和childSnapshotHash，服务端验证发布投影后绑定完整ContentHash；
不要求孩子计算或取得包含家长答案的摘要。家长审核仍匹配完整ContentHash，原提交重放保持首次绑定不变。
失租者不能补偿；必须先持久RESOLVING再abort/精确解绑；提交未知先读回，不能解绑可能已成功的Attempt。
正常移除/离开/撤回不自动DELETE媒体；隐私删除显式确认，删除后占位不改审核/掌握/奖励历史。

审核只能匹配当前Round版本、所见Content与Attempt版本/hash、review=null、无活动提交；两共管家长只一个CAS胜者。
revise必须反馈，不写任何掌握/复习副作用；approve前检查完整图片可读，再原子保存Attempt.review、Round.passed、finalReview、
命令及写回意图。审核成功确认不依赖第二次读取媒体；成功后媒体暂不可读不得将写确认改报失败。
finalReview含真实审核actor、UTC时间、每题人工判定均通过的确认、evidenceSummary、masteryConfirmed、reviewReminderDate，
源题/AI2/Content/Attempt的精确引用；只允许追加一次，不可PATCH旧审核。

reviewReminderDate为真实日历YYYY-MM-DD或null，不限制必须未来（补录复习允许历史日期）；显示与T6家庭时区规则一致。
源为mistake：仅关联原mistake，不接受任意换目标；其现有knowledgePointId若为空，则本轮不允许强行选择新知识点。
源为task：可由家长显式选择同家庭同孩子的数学KnowledgePoint，也可null；不得猜测或新建错题/课程映射。
review-context只读返回这些本地目标的实时状态版本与可执行效果，家长从所见快照确认，不由客户端伪造family或actor。

## 7. 必要的跨服务写回边界

不直接写其他服务数据库。需要两个封闭的服务凭据保护consumer，详见API§6：

- analytics：原mistake上写reviewed=true；masteryConfirmed时写mastered=true，否则保留原值；有选定日期才设置
  reviewReminderDate，null不清空。保持corrected及其他题目/图片/家长字段不变；同事务写FamilyMistakeStateEvent和幂等回执。
- progress：仅masteryConfirmed且有效knowledgePoint时，将masteryLevel设为skilled，并写一次带AI3来源/最终审核引用的
  KnowledgePointMasteryEvent；即使原本skilled也写该轮独立证据，但不能重复。其余练习次数等不自动增加。

不满足条件的效果记not_requested；无错题的task轮次仍保存本轮复习日期，并在AI3列表可筛选，不伪装已写T6错题日期。
源为mistake但没有知识点，可保存练习通过/复习记录，不宣称已写知识点掌握证据。

旧普通PATCH没有足够CAS，不能直接重试它。最小增量：FamilyMistake与KnowledgePoint新增stateRevision（旧缺省0），
其相关状态写路径必须在实际落库事务原子递增，含错题媒体混合修改的最终状态落地，不能只改AI3入口。
新consumer先实时授权原审核actor及family/child，再查固定effectId/hash回执，再比较expectedStateRevision及目标身份/关联。
媒体pending的错题拒绝本次效果，避免覆盖尚未落地的状态；与pending开始/结束争用同一实体条件写。
回执/事件/当前状态同事务；丢响应同effect只读回执，不能按新状态重复写历史。只比较updatedAt不足以防同毫秒/ABA。

消费者从homework受凭据保护的只读final-review接口核对完整不可变摘要、目标与原actor，不相信客户端上传证明。
新凭据仅homework到两个consumer及反向核验，Gateway剥离并不公开代理内部路由；不借AI1 Provider凭据写学习状态。
homework将两个效果及回执存原review Command，不声称三服务原子事务，不新增调度器：首次请求尝试交付，网络未知由原actor显式recover接续。
已applied一侧不补偿删除、不重写，另一侧pending仍明确显示“审核通过，记录同步待确认”。
CAS失败/目标删除/关联变化记`not_applied_conflict|not_applied_missing`永久回执，不自动换版本追写；
家长可在现有T6/知识点页面单独核对修改，本轮历史记录仍如实标未应用，不能用新UUID伪装旧证据成功。
原审核actor撤权时停止接续，不自动由另一家长冒充；保留锁/预留和未决证据供后续明确处理，沿用AI2边界。

所有写回收敛到applied/not_requested/not_applied_*才允许释放本轮active；终态包括不应用，不能把终态等同掌握已更新。
`finalReview`本身从本地提交起不可变；无须两服务同时成功才能显示人工反馈，但“已写入掌握”只看progress实际applied回执。
AI2/AI3随后撤回不删除已合法产生的审核证据；撤回先胜则不允许新的finalReview。日期/关联/知识点更改不能被旧命令恢复覆盖。

**时间口径：**finalReview.reviewedAt保留家长首次审核时间；各consumer在首次成功应用的事务内采样服务器时间appliedAt，
对应状态事件effectiveAt=appliedAt，并与回执一同持久化。事务重试重新采样，未知提交先读原回执，已提交重放不改时间。
不把周一才应用的状态回填到周日审核时间；两个服务允许不同appliedAt，周报按各自真实状态生效时间统计。
原审核时间作为事件的来源审计字段保留，不代替effectiveAt。not_applied_*仅记录回执决定时间，不产生状态事件。

## 8. 页面与会话

复用家长AI2详情的“准备变式练习”入口；孩子现有学习入口增加已发布练习列表/详情，不扩展全新工作台。
家长：查看已通过订正 → 选2/3题 → 完整生成预览或手工候选 → 修订 → 孩子预览 → 批准发布 → 看图片逐题判断 → 最终审核。
孩子：看题 → 作答拍照 → 上传/部分失败处理 → 提交 → 等待/按反馈重交 → 回看反馈及复习日期。
家长答案永不随孩子DTO下发；不在浏览器下载完整家长对象后隐藏字段。

复用sessionStorage原命令及服务端原actor命令发现；坏JSON也按前缀清理。切身份/孩子/跨标签失效先撤销响应代次、
清私有DOM/blob及暂存，迟到401不能退出新身份；当前403/404先清正文并封旧响应，网络失败保命令与未知锁。
草稿媒体刷新与只读作品分离；焦点/手动刷新不能清除成功上传项和失败项，失败未显式处理不能提交。
未知写入时关闭表单不能当作取消成功，重登先发现原命令；GET不存在不证明未写，不自动新建UUID。
确认冲突后重新看详情/审核上下文，不自动确认新版本。写响应与媒体详情分离；无PDF/HEIC新增能力。

## 9. 启用、回退与验收边界

新增AI3_MODE=off|enabled，默认off；各受影响服务明确支持新profile、索引/事务、日志/凭据/上传guard、账本owner分派后才能启用。
不因AI2启用就启用AI3。off阻止新创建/生成/发布/提交/审核与新purpose上传；历史读、撤回和显式隐私删除保留。
原生成recover只查询，不新发送；原媒体recover遵循AI2 off规则；已持久审核效果可显式接续，不能创建新审核。
连续性未知时沿用维护隔离，不能通过普通recover越过备份恢复门禁。两种媒体类型混合的正常读删预检须通过。
有AI3数据后回退只能关闭功能并保留兼容reader/删除/账本分派，不能直接换回不认识AI3类型的旧二进制。
无新数据才可匹配版本回滚；数据回滚、旧备份恢复另行评审，不扩展高级恢复/新回收。

实施可按协议及状态 → 页面及正式接线 → 合成闭环三批推进，复用既有Jest/Playwright/文档门禁；
设计批准后才编制具体实施顺序，不为每个端点重复审批。每批自查、聚焦评审和缺陷永久反例，重要契约变化再报批。
真实Provider实现/JSON模式支持、完整消息计数和当前报价要单独验证，不把本地替身作为真实成本或模型兼容证明。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测、
QUALIFIED_COUNTER_PENDING、REMAINDER_DEFERRED及T9 NOT_STARTED保留。AI-3总门禁未经批准不关闭。

## 10. 批准与首批实施入口

2026-11-04用户批准三稿及§1取舍，孩子提交摘要P1、事件生效时间P2在设计层CLOSED / USER_APPROVED。
首批实施范围、真实验证与替身边界见[测试计划§6](../../development/family-ai3-test-plan.md#6-后续批准与首批边界)
及[批次记录](../../development/evidence/ai3-a-20261104/README.md)。AI-3仍OPEN；批准设计不等于实现验收。
