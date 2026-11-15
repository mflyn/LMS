# AI3 当前28项覆盖归并

Status: COVERAGE_RECONCILED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY。
2026-11-05用户批准AI3-E及后续工程和AI-3限定合成总门禁关闭，见[批准与新全量证据](closure-review.md)。
原28项要求不变；下文待批准及原计数保留为历史，新全量为213套6408项一次通过，exit0。
对应[原测试矩阵](../../family-ai3-test-plan.md#2-永久用例矩阵)，原28项不删除或重定义。
本表保留原实现和可核对证据层级；批准只覆盖既定合成工程，不替代真实模型、真机或部署验收。
原只读盘点指出的历史读取、来源三态及跨周报告缺口已补齐；旧失败报告保留。

本次完整候选复审补强见[修订记录](review-fixes.md)：AI3-GEN-03增加超限历史RESERVED在过期/报价变化时不退款，
AI3-MEDIA-02增加manual/focus的pending往返失败项保留，AI3-RECOVER-01增加分页空页不解除已知未决锁。
CONS两套与analytics启动收尾已加入现有家庭回归，真实发现反例保护三条入口。
下方210套6331项、159文件和历史浏览器时间均为原候选快照；新候选结果单列，不回写旧计数。

## 证据简称

- S、R、SUB：homework `ai3Service`、`ai3Review`、`ai3Submission`/`ai3SubmissionHttp`测试；
  真实Mongo事务，来源/证据等端口按各测试明确替身。HIST为新增`ai3ContentHistory`真实HTTP及独立探针。
- CONS：analytics `ai3MistakeEffects`/`ai3MistakeRevision`和progress `ai3MasteryEffects`/`knowledgePointRevision`；
  实际事务/事件/回执，证明查询可为替身。WEEK为原`weeklyReports`跨周组合，proof为替身。
- MEDIA：resource `ai3MediaProtocol`/`ai3PrivateMediaHttp`及旧媒体回归；资源HTTP/图片/日志真实，部分homework访问端口替身。
- C：前端AI3 API、命令、页面、草稿刷新、历史及媒体永久组件测试；API替身。
- F：`backend/tests/t2/ai3Runtime.integration.test.js`和`ai3ReviewRuntime.integration.test.js`，正式应用/HTTP；
  后者seed已审核AI2前置，不冒充人工批准页面。后者已有独立10项实际执行。
- B：`tests/e2e/t2/ai3_bridge_acceptance.py`与`ai3PracticeFlow.js`/`ai3BrowserRecovery.js`；
  正式页面和LMS应用，从AI1人工修订批准及AI2订正审核进入AI3，双来源/双引擎。
  DeepTutor operation/store为真实本机实现，Provider/计数/价格为合成替身，外部socket拒绝。
- 具体作者/独立结果见[当前进展](README.md)与[独立复评](independent-review.md)；
  “独立读取日志”不称为“独立执行”。B的历史零写检查为四张AI3表，最终效果重放为六张相关表。

## 逐项归并

| ID | 永久保护与当前证据 | 层级边界 |
| --- | --- | --- |
| AI3-SOURCE-01 | S/sourceReader的双来源、别名、范围、零副作用；来源三态独立31项和在途权限反例；F/B双来源 | 三态非available分支由服务/组件覆盖，不伪称全部浏览器化 |
| AI3-SOURCE-02 | S/SUB/R条件写祖先与发布、提交、审核竞争；来源读取后再次检查祖先 | 真实事务屏障，不以只读快照替代写互斥 |
| AI3-CONTENT-01 | contract/operation/raw UTF8输入封闭、完整32KiB；C/B实际2/3题 | 字节反例包括多字节、转义、封装；拒绝后共享槽保护沿用D |
| AI3-CONTENT-02 | S不可变修订、拒绝、取消、未知锁；HIST/C/B旧版本私有读取 | 旧版本读取不替换当前发布预览；历史API不写库 |
| AI3-GEN-01 | preview golden、operation wire及S完整预览；B合成生成 | 不发送孩子身份/图片，不代表真实计数资格 |
| AI3-GEN-02 | ai3Budget共享AI1/AI3账户和slot竞争、旧owner、跨期占用 | 原账本事务级，不新增第二预算池 |
| AI3-GEN-03 | S/operation/DeepTutor截止点、报价、off、claim持久与GET-only恢复 | 保留端口、受控HTTP、远端store各自边界；不以正常B代替所有故障 |
| AI3-GEN-04 | 计费非法输出、一次结算、零候选和无自动重试 | 合成Provider，不真实付费制造故障 |
| AI3-PUB-01 | S共管CAS、旧预览拒绝；C旧历史隔离；B明确预览批准 | 冲突后不自动批准新版本 |
| AI3-VIEW-01 | S/R/SUB孩子白名单；HIST家长历史权限；C/B私有字段隔离 | passed也无答案，历史孩子403/跨家庭404为真实HTTP |
| AI3-SUBMIT-01 | SUB孩子投影/原内容绑定、旧版/角色拒绝、占位竞争；B退回重交及1/10图 | 不要求孩子计算家长私有内容hash |
| AI3-SUBMIT-02 | SUB真实事务及资源HTTP丢响应、BSON、owner/lease/RESOLVING | B丢最终响应结果与资源commit丢响应分别记录 |
| AI3-MEDIA-01 | MEDIA类型/大小/用途/身份；C及B认证媒体；旧PDF/任务/AI2回归 | 不扩HEIC、PDF作答或匿名访问 |
| AI3-MEDIA-02 | C部分失败/手动焦点刷新/锁；MEDIA代次、墓碑、删除竞争；F真实删除 | 普通移除和离开不DELETE，组件替身不冒充实际删除 |
| AI3-REVIEW-01 | R/C精确tuple、共管、迟到409；F真实共管；B两轮审核 | 首次actor/time与旧审核保留 |
| AI3-REVIEW-02 | R不可读零审核、成功确认不重读；F事后删除；B实际完整可读作品 | 审核前拒绝和事后删除分别在对应层验证 |
| AI3-EVIDENCE-01 | R/S/CONS noKP/false mastery/原关联；B task选KP和mistake无KP | not_requested不伪报applied，不造知识点 |
| AI3-EVIDENCE-02 | R本地原子审核/回滚/未知；CONS proof篡改拒绝；F真实证明请求 | 不声称跨服务原子事务；伪证明反例为受控端口 |
| AI3-EVIDENCE-03 | F已提交效果丢响应、原回执恢复；CONS already-skilled；B目标/事件/回执关联 | 独立F10已执行；B重放六表不变，不靠计数证明关联 |
| AI3-EVIDENCE-04 | CONS revision/ABA/媒体pending/关联/删除；F真实目标更新屏障 | CAS冲突不换版本追写 |
| AI3-EVIDENCE-05 | CONS先回执再CAS、持久时间；WEEK周日审核周一应用的首份报告及建议 | WEEK实际consumer/repository，proof替身；不重算冻结旧周报 |
| AI3-DATE-01 | R日期/null/范围查询；CONS日期保留；B存储和展示 | task无错题仅保本轮日期，无自动任务或星星 |
| AI3-WITHDRAW-01 | S/SUB/R/MEDIA自身和祖先撤回、多绑定；HIST父母历史；F删除 | 保留合法历史，不迁移Attempt，不全局删共享媒体 |
| AI3-IDEM-01 | contract/S/SUB/R/evidence client原UUID、actor/path/body；F/B重放 | 不据此声称所有组合均重复跑浏览器 |
| AI3-RECOVER-01 | C坏JSON/原正文/撤权；B真实提交后刷新退出重登、发现和显式原恢复 | B结果不可验证与F真实响应断链、Mongo提交未知区分 |
| AI3-SESSION-01 | C迟到401/403、blob、身份及跨标签；来源在途授权；F真实PIN；B退出重登 | 旧响应不得恢复私有数据；各交错在相称层级验证 |
| AI3-OFF-01 | activation/assembly/runtime/legacy冷加载；HIST off历史；原启动反例及新await/拒绝 | 已保留全量3失败及冷夹具1失败，兼容22项/冷夹具4项独立通过；最终家庭210套6331项通过 |
| AI3-FLOW-01 | B双引擎/双来源各手工2题与生成3题、人工修订/发布/退回/通过/回看与效果 | 最后双仓修订后四组116.21秒为开发实跑；不冒充独立浏览器或真机 |

## 尚需收口

最终家庭210套6331项、正式HTTP入口107项（50应用/HTTP加57纯断言）、最后浏览器四组已通过；
DeepTutor关闭竞态独立复评242项及两个取消屏障变异有证据，完整目标逐要求只读复核未发现工程阻断。
累计159文件源码候选与最终192文件私有验证归档见验收准备，文档增量和交付引用单独冻结。
以上不是靠静态检查推定测试成功，也不将共享入口的helper数目计为真实HTTP场景数。
AI3-E用户验收及AI-3总门禁批准独立待办；保留T4/T8/AI-1 OPEN、DEVICE_PENDING、
Docker INCOMPLETE_FAILED、历史失败、非阻断补测、QUALIFIED_COUNTER_PENDING和REMAINDER_DEFERRED。
