# 家庭成长跟踪开发与测试

本目录保存家庭成长 MVP 的详细设计、实施计划、测试用例、评审记录和发布证据。
当前实现候选是 FGT-MVP-1.7，包含 38 项需求；Task 12 新增第二家长共管、
成员治理和家长成员关系原子性。

## 当前基线

- [MVP 当前待办与 DeepTutor CI 暂缓记录（2026-11-21）](./mvp-current-followups.md)：工单5036799保留，DeepTutor PR #2仍Draft，Actions暂缓未解决；优先真人登录/业务失败取证，不关闭现有门禁或改写历史证据。
- [登录 429 契约与提示限定本地验收](./login429-local-acceptance.md)：已批准，公开交付索引见[本批证据](./evidence/login429-local-acceptance-20261117/README.md)；共享额度风险和 8 次业务 503 缺证仍保留，不代表现场或发布验收。
- [FGT-MVP-1.6 基线候选](./family-growth-baseline-v1.6-manifest.md)
- [统一发布 Gate](./family-growth-v1.6-release-gate.md)
- [38 项需求追踪矩阵](./family-growth-requirement-traceability.md)
- [Task 1-12 设计资产索引](./family-growth-design-asset-index.md)
- [家庭成长测试策略](./family-growth-test-strategy.md)
- [测试质量修订记录](./family-growth-test-quality-remediation.md)
- [配置与基础设施修订记录](./family-growth-config-infra-remediation.md)
- [历史基线和废弃文档说明](./archive/README.md)

## Task 设计与验证

| 范围 | 设计/计划 | 测试与 Gate |
| --- | --- | --- |
| Task 1-4 | [设计归档说明](./family-growth-task1-4-design-archive.md) | [初始基线](./family-growth-baseline-manifest.md) |
| Task 5 | [详细设计](../superpowers/specs/2026-06-19-family-growth-task5-design.md) | [测试用例](./family-growth-task5-test-cases.md) / [Gate](./family-growth-task5-gate.md) |
| Task 6 | [详细设计](../superpowers/specs/2026-06-20-family-growth-task6-design.md) | [测试用例](./family-growth-task6-test-cases.md) / [Gate](./family-growth-task6-gate.md) |
| Task 7 | [详细设计](../superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md) | [测试用例](./family-growth-task7-test-cases.md) / [Gate](./family-growth-task7-gate.md) |
| Task 8 | [详细设计](../superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md) / [实施计划](../superpowers/plans/2026-07-10-family-growth-task8-parent-shell.md) | [测试用例](./family-growth-task8-test-cases.md) / [Gate](./family-growth-task8-gate.md) |
| Task 9 | [详细设计](../superpowers/specs/2026-07-10-family-growth-task9-parent-pages-design.md) / [实施计划](../superpowers/plans/2026-07-10-family-growth-task9-parent-pages.md) | [测试用例](./family-growth-task9-test-cases.md) / [Gate](./family-growth-task9-gate.md) |
| Task 10 | [详细设计](../superpowers/specs/2026-07-11-family-growth-task10-child-web-design.md) / [实施计划](../superpowers/plans/2026-07-11-family-growth-task10-child-web.md) | [测试用例](./family-growth-task10-test-cases.md) / [Gate](./family-growth-task10-gate.md) |
| Task 11 | [详细设计](../superpowers/specs/2026-07-12-family-growth-task11-e2e-design.md) / [实施计划](../superpowers/plans/2026-07-12-family-growth-task11-e2e.md) | [测试用例](./family-growth-task11-test-cases.md) / [Gate](./family-growth-task11-gate.md) |
| Task 12 | [详细设计](../superpowers/specs/2026-07-16-family-growth-task12-co-parent-design.md) / [实施计划](../superpowers/plans/2026-07-16-family-growth-task12-co-parent.md) / [设计评审](./family-growth-task12-design-review.md) | [测试设计与用例](./family-growth-task12-test-cases.md) / [Gate](./family-growth-task12-gate.md) |
| 错题 PDF 与多附件增量 | [详细设计](../superpowers/specs/2026-07-15-family-growth-mistake-pdf-multi-attachments-design.md) | [测试设计与用例](./family-growth-mistake-pdf-multi-attachments-test-cases.md) / [Gate](./family-growth-mistake-pdf-multi-attachments-gate.md) |

旧 Task Gate 只证明对应历史范围。FGT-MVP-1.7 发布判定使用已纳入 Task 12 的统一
发布 Gate；目标环境启用前还必须完成 Task 12 Gate 规定的数据修复检查。

## 自主学习 MVP 增量计划（T0 已关闭，T1 后端工程已关闭，T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5 合成工程已关闭，T6 合成工程已关闭，T7 合成工程已关闭，T8 本地准备，T9 待执行）

### 2026-11-21 本地文档接续（文档已批准）

已只读核对测试线程后续归档：11月17日晚网关及前端另已更新到`9bf042c8`；原诊断5份、后续更新142份文件哈希均匹配。
详见[登录事实、缺口和文档接续](mvp-current-followups.md#5-登录事件证据复核与文档接续2026-11-21)。
未取得新的原请求级根因证据，共享额度风险和8次业务503仍OPEN；本次不查询服务器、不改限流、不重放原命令。
SRS、指南及待办记录已复审通过并获用户批准，状态为DOCUMENT_REVIEW_APPROVED / USER_APPROVED，见[批准记录](mvp-current-followups.md#6-文档复审与用户批准2026-11-21)。
下方11月17日早期摘要保留其收口时点（包括当时的待复审状态），不改绑255份原证据；本次不关闭任何现场事件或总门禁。

### 当前交付与受测摘要（2026-11-17）

[功能规格SRS（待复审）](../product/family-learning-tracker-current-srs.md)逐项盘点账号共管、任务/重复计划、
提交审核、错题复习、周复盘及默认关闭AI扩展，分别记录实现、启用和验收状态，不代替原Gate或冻结证据。

**当前代码：** main `9bf042c8f631edd82aa6807fcc8e192bd6c5cb23` 已合并[PR #59](https://github.com/mflyn/LMS/pull/59)，
[合并后CI](https://github.com/mflyn/LMS/actions/runs/44025279785)成功；跳过的可选作业不算通过。
登录429契约与提示已获限定本地验收，不表示共享额度风险已修复；8次业务503仍 `OPEN / EVIDENCE_MISSING`。

**历史受测：** 测试线程在[PR #58](https://github.com/mflyn/LMS/pull/58)对应的 `7da928e7` 上，
按单独授权完成Ubuntu**仅前端**更新与选定隔离回归；该版本[原CI](https://github.com/mflyn/LMS/actions/runs/43986403569)另行保留。
见[历史证据与版本分层](evidence/ubuntu-frontend-update-20261117/README.md)：当时前端为 `7da928e7`，
7个后端保留相对该历史目标业务/依赖等价的 `e9147b61` 镜像且未重启，不将等价结论扩展到 `9bf042c8`。
该批Mac两引擎经SSH访问Ubuntu临时正式服务，各AI1相关32项、常用项2项、前后健康各1项通过，
与登录429开发两引擎各45项、复审各1项及历史失败分别记录；真人／真机仍待验。
本次未实时查询或更新实例，不以最新main或CI成功推断真人入口已包含登录429修订。
2026-11-17本批4份测试证据文档复审通过并获用户批准，状态 `DOCUMENT_REVIEW_APPROVED`；
复审与批准记录绑定上述历史SHA、最新main及原冻结manifest，见历史证据索引；不包含SRS或指南验收。
本摘要仅核对已结束的执行证据，不授权再次更新入口或执行测试；T4/T8/AI-1 OPEN、
SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、原请求缺证、历史Docker失败及后置状态不变。

### 当前交付摘要（2026-11-15）

以下保留当日快照，“当前”及禁止更新入口的表述指当时授权；最新受测范围见上方2026-11-17摘要，不追改旧结果。

**已合并、自动化通过、真人／真机待验。** 当前固定代码候选为 main
`1abb623da7eed3bd27b159da3216189952586f1e`，与本轮核对的 origin/main 一致。

| 最近交付 | 合并提交 | CI 与证据边界 |
| --- | --- | --- |
| [PR #49](https://github.com/mflyn/LMS/pull/49)：求助焦点、WebKit 导航测试、44px 触控区域 | `a1cf74f3` | [原分批验收](evidence/functional-p2-followup-20261114/README.md)保留；[合并后 CI 43614031778](https://github.com/mflyn/LMS/actions/runs/43614031778)曾失败，13b 为 94 通过／3 失败，不改写 |
| [PR #51](https://github.com/mflyn/LMS/pull/51)：合成任务日期按家庭时区生成 | `5c1bec39` | [CI 43623034340](https://github.com/mflyn/LMS/actions/runs/43623034340)通过；[日期夹具修订](evidence/t2-seed-date-20261115/README.md)保留原失败，不是业务功能或真人验收 |
| [PR #50](https://github.com/mflyn/LMS/pull/50)：T5 补测、计划及知识点接续 | `1abb623d` | [main CI 43665482647](https://github.com/mflyn/LMS/actions/runs/43665482647)通过；[冻结补丁与分批证据](evidence/t5-nb-page-continuation-20261114/README.md)不改绑 |

上述最新 main CI 的前端为 78 套件／1279 项，07b 为 10 套件／113 项，13b 为 102 项通过；
这是该次自动化结果，不与旧开发、独立复验或分批结果相加。可选性能、安全扫描、镜像发布和部署任务跳过，不计为通过。
T5-NB-001／002 当前为 **SCOPED_AUTOMATION_COMPLETE**，已移出当前自动化待办；
历史 OPEN_NONBLOCKING 快照保持，AI2-VIEW-NB-001 及其他非阻断项不因此关闭。

[当前差异交接](family-child-entry-test-plan.md#8-main-1abb623d-差异验收交接2026-11-15)只准备测试／评审线程后续接续，
不更新真人入口、不重跑浏览器、不改变现有合成数据。原 `2ac06898` 三页面证据不转记为本候选受测结果。
T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、MANUAL_PENDING、DEVICE_PENDING、历史 Docker INCOMPLETE_FAILED、历史失败及后置范围不变；
不扩展 WP1/T8 执行器，不新增 Git、模型、服务器或部署授权。

### 2026-11-14 交付摘要快照

以下按原日期保留，旧“当前”指当时状态，不覆盖上方 2026-11-15 摘要。

**当前交付摘要（2026-11-14）：专属入口＋PIN 已合并、真人待验。**
[PR #46](https://github.com/mflyn/LMS/pull/46) 已使用 merge commit 合入 main
`2ac0689881a62d97bd79b731a8712ca4023406b5`；[合并后 CI 43554728658](https://github.com/mflyn/LMS/actions/runs/43554728658)
的家庭发布回归和证据上传通过。可选性能、安全扫描、镜像发布及部署未启用，不计为通过。
合并树与已验收 head `4c3ad7b96c83594d15f421d80b932e9cd990a216` 一致；
[原候选与分批验证](evidence/child-entry-20261113/README.md)、冻结补丁/manifest 哈希及历史失败保持原样。
使用步骤见[快速开始](../user-guide/quick-start.md)、[家长指南](../user-guide/parent-guide.md)和[孩子指南](../user-guide/child-guide.md)。
本机真人入口由测试／评审线程先核对并保留既有合成数据后更新，实际版本与结果以该线程记录为准；
不将代码合并、CI 或本次文档更新写成入口已更新、真人通过或部署完成。
T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测及后置状态不变。

2026-11-14 测试线程另交接[三页面业务闭环自动浏览器证据](evidence/browser-business-loop-20261114/README.md)：
固定受测 SHA 仍为 `2ac06898`，复用已登录家长及两个孩子页面，完成求助、两版作品、按所见版本审核和回看；
结果 PASS_BROWSER_BUSINESS_LOOP，25 份冻结文件核验通过，26 条基线文档未变。2026-11-14 复审通过并获用户批准本批证据收口，绑定原受测 SHA 及索引中的原 manifest 哈希；仅文档状态已批准，
不是新的专属入口登录测试、真人/iPad 验收或全量通过，不改绑最新 main、不关闭门禁；[测试记录](family-child-entry-test-plan.md#6-后续三页面业务接续记录2026-11-14)区分原专项与本轮范围。

### 历史交付与授权快照

2026-11-14 T5 非阻断建议后续：T5-NB-001／002 已补齐固定候选内自动化覆盖并纳入永久回归，
仅记 SCOPED_AUTOMATION_COMPLETE，见[补测、今日计划与知识点接续记录](evidence/t5-nb-page-continuation-20261114/README.md)。
该记录区分测试线程分批结果、开发纳入复验及历史失败；不关闭真人／真机或其他总门禁，不更新原测试入口。
知识点加载态误判 P2 已补真实响应与稳定页面校验，并新增错误响应永久反例；2026-11-14 用户批准本批限定自动化验收及 P2 关闭，ACCEPTED / USER_APPROVED、P2 CLOSED，受验补丁和 44 份冻结证据绑定见同记录第 7 节。第 6 节待验收文字保留为历史快照，不将旧 R1 通过当作该缺口已被保护，也不将自动化通过写为真人／真机通过。
下方旧记录中的两项 OPEN_NONBLOCKING 保留为当时快照，其他非阻断及后置义务不变；本批不提交推送或改写 PR #49。

2026-11-14 后续功能复评：求助焦点恢复、WebKit 业务导航与 44px 触控区域三项 P2
已获限定关闭授权，见[固定候选、独立复评及关闭记录](evidence/functional-p2-followup-20261114/README.md)。
受验身份为 `e5aea7e5` 加九文件未提交补丁，不是已合并版本；本轮仅补文档收口。
两引擎原 65 项与新增 7 项分别运行，开发端口冲突与补验、独立 QA 记录错误均保留。
现有真人入口仍是旧构建、没有应用修复；自动浏览器通过不等于真人或 iPad 验收，也不关闭总门禁。

以下各日期内容保留当时身份，其中 Draft PR／未授权合并等描述不覆盖上方已合并事实，也不授予新的执行权限。

2026-11-14 [孩子专属入口 + PIN 最小设计](../superpowers/specs/2026-11-13-family-child-entry-design.md)及[测试方案](family-child-entry-test-plan.md)对应的限定合成工程已获用户验收，两项测试保护缺口批准关闭；[本批证据与评审记录](evidence/child-entry-20261113/README.md)区分开发实跑、独立复评与历史失败。现授权专用分支、Draft PR 和 CI，不授权合并或替换真人入口；下列已合并快照及 OPEN/DEVICE_PENDING 等状态不变。

**当前交付摘要（2026-11-13）：已合并、真人待验。** 本次核对的 main 代码基线为 `ce264b9dec6fb469dd78154f507bba8e997b7e90`。

| 已合并范围 | PR | merge commit |
| --- | --- | --- |
| MVP 两项 P2 与使用指引 | [#42](https://github.com/mflyn/LMS/pull/42) | `01a61c63` |
| 任务列表分页与回看 | [#43](https://github.com/mflyn/LMS/pull/43) | `a383eb30` |
| 孩子标签页隔离与在途 PIN 响应保护 | [#44](https://github.com/mflyn/LMS/pull/44) | `ce264b9d` |

PR #44 及合并后 main 的 CI 已通过，固定 SHA 与分批验证依据见[交付证据索引](./evidence/child-tab-session-20261113/README.md)。
真人测试由测试／评审线程核对并保留既有合成数据后继续，入口和实际结果以该线程记录为准；Git 合并和 CI 通过不等于真人、iPad 或部署验收。
T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测及后置状态不变，WP1/T8 执行器不恢复开发。
以下按日期保留候选及授权快照；其中“待复评／不合并”等不覆盖对应模块的后续批准和已合并事实，也不授予新的执行权限。

2026-11-08任务列表交付快照（合并前）：[任务列表分页与回看P2验收关闭](./evidence/mvp-task-list-20261108/acceptance.md)。
基于已合并PR #42的main `01a61c63`，仅提交本次三文件修订、关闭记录及脱敏证据索引；专用分支/Draft PR/CI已授权，合并与部署未授权。以下MVP两项P2及其交付权限保留为上一批快照。

2026-11-08本批已验收：[MVP两项P2及使用指引关闭记录](./evidence/mvp-closeout-20261108/acceptance.md)。
反思跨入口未知写入保护及错题日期清空两项P2已关闭，原冻结、开发分批及独立复验证据分别保留。
当前[MVP优先级摘录](./t4-t8-joint-acceptance.md#0-mvp-优先与后置范围2026-11-08)将WP1执行器未完增强后置，不取消必要恢复/回滚、真机和真实启用验收。
本轮只授权[专用分支/Draft PR交付](./evidence/mvp-closeout-20261108/public-delivery.md)，不合并、部署、调用模型或操作服务器。
T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、历史失败、非阻断补测及后置状态不变。

[T7 限定合成工程关闭记录](./family-self-directed-learning-mvp-gate.md#2742-t7-限定合成工程总门禁批准关闭2026-10-30)
经用户批准关闭，不连带关闭T4、真机或后置义务；T7 脱敏交付已合并（Gate §27.45），未部署。
当前 T8 本地交付范围与证据见[本地验收清单](./evidence/t8-local-preparation-2026-10-30/README.md#本地交付验收与范围清单)，总门禁 OPEN；已授权专用分支及 PR（Gate §28.4），不合并、不部署。

[T6 工程总门禁关闭记录](./evidence/t6-reload-denied-p2-2026-10-27/engineering-closure.md)
仅关闭合成工程范围；DEVICE_PENDING、Docker INCOMPLETE_FAILED、非阻断补测及后置责任不变。

[自主学习 MVP 开发计划](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md)
将最新[系统设计](../architecture/family-self-directed-learning-system-design.md)中的六个工作包
拆成 T0–T9，包含代码落点、依赖、验证、家庭发布和四周试点。SL 编号仅为计划追踪编号，
不属于当前已实现的 38 项需求。DeepTutor、K12、长期项目等继续留在 MVP 验证后的储备范围。

[自主学习 MVP 增量 Gate](./family-self-directed-learning-mvp-gate.md)记录 T0 契约基线、
SL-01 至 SL-07 的 planned 状态、既有测试失败、T1 至 T9 证据以及工程完成与家庭验证的
独立结论。T0 不提供功能实现证据，不能据此开放新增写接口。

[T1 验收清单归并](./family-self-directed-learning-t1-acceptance-reconciliation.md)对应第 1–26 批与
原 35 个历史条目，区分独立实现、正式装配与后续任务边界；四个收尾工作包现已关闭，
不将历史复选框重复计为新开发任务，也不将混合条目的后续责任计为已完成。

[T1 总门禁关闭评审材料](./family-self-directed-learning-t1-acceptance-reconciliation.md#6-t1-总门禁关闭评审材料)
已核对 A01–A35；T1 后端工程总门禁及 R4 汇总项已获用户批准 CLOSED，裁决见 Gate §18.40 和归并表 §6.4。
仅限既定合成验收，不代表前端、真实家庭部署或 Git 发布完成。

[T2 详细设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-design.md)与
[T2 执行、测试及评审记录](./family-self-directed-learning-t2-execution.md)已获用户设计批准，
T2-1 基线修复与门禁 P2、T2-R 公开恢复后端及 owner/pending P2 已获用户验收关闭。
2026-10-24 用户批准 T2-G 未完成高级恢复/新回收后置，不再阻塞 T2-2 至 T2-6 页面开发；保留既有运行安全依赖。
当前批准见[执行记录 §17](family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)：三项 P2 CLOSED，T2 工程总门禁 APPROVED / CLOSED，关闭范围 ENGINEERING_SYNTHETIC_ONLY。最新全量仍 FAILED（3942/3943通过，D2B-05 后置），历史失败分别保留。真实设备 DEVICE_PENDING，T8_PENDING / NOT_AUTHORIZED，后置范围 REMAINDER_DEFERRED；不自动启动 T3–T9。
[T2 退出恢复与安全回收补充设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-recovery-retention-design.md)
原已批准接口、模型、专用凭据、24 小时保留期及每批 50 个参数保留在历史设计；T2-G 已有部分实现，未完成部分后置，不代表真实环境已启用。

## 后续 AI 学习扩展边界

2026-10-26 已补充[DeepTutor/K12 最小路线](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md#9-deeptutor-与-k12-最小对接路线2026-10-26-补充)：
AI-0 可提前做单章节能力验证；AI-1～AI-3 和 K12-1 按基础闭环、家庭需求及独立授权启动。
T1～T9 不因此增加 AI 验收；本次只有路线文档，没有已执行的验证或接入。正式使用仍满足 T8，默认 T9 后启动。

上述为路线建立时的历史状态。2026-10-31：AI-0 单 Provider 小样本经家长确认，人工核验并修订后
有条件可作备课候选；完整 Agent/页面及 K12 未验证。2026-11-01 AI-1 已获设计批准及 A 批本地实现授权：
[最小设计](../superpowers/specs/2026-10-31-family-ai1-minimal-design.md)、
[API 契约](../api/family-ai1-api.md)、[测试方案](family-ai1-test-plan.md) 均 APPROVED，
仅本地无模型实现，不开放孩子使用、不沿用 AI-0 预算，未注册接口；AI-1 总门禁 OPEN。当前状态见主线 Gate §29；其他门禁不变。

[家庭 AI 学习平台设计](../architecture/family-ai-learning-platform-design.md)是后续
DeepTutor、K12-KGraph 和家长人工审核教学闭环的设计草案。
它不属于 Task 1～12 或当前 38 项需求；其中路由、模型和 feature flag 只有在新增
Requirement、详细设计、测试用例、迁移/回滚和独立 Gate 后才能进入实现基线。

## 环境要求

- Node.js 22，与 CI 和家庭服务生产镜像一致。
- 与根目录和 `frontend/web` lockfile 匹配的 npm。
- Docker Engine 与 Docker Compose v2。
- Git；完整发布 Gate 还需要安装 Playwright Chromium 的网络和系统能力。

家庭最小栈通过 Compose 提供 MongoDB 副本集和各 API 服务，本地开发不要求单独
安装 MongoDB、Redis 或消息队列。

## 安装依赖

```bash
npm ci
npm ci --prefix frontend/web
```

需要单独运行浏览器测试时安装 Chromium：

```bash
npx playwright install chromium
```

Linux CI 需要浏览器系统依赖时，按发布文档使用
`RELEASE_GATE_INSTALL_BROWSER_DEPS=1 npm run release:family`。

## 本地开发

启动家庭 API 栈，并把 Gateway 暴露到 Web 默认使用的 8000 端口：

```bash
FAMILY_GATEWAY_HOST_PORT=8000 npm run docker:family
npm start --prefix frontend/web
```

Web 默认运行在 `http://localhost:3000`。查看日志或停止服务：

```bash
npm run docker:family:logs
npm run docker:family:down
```

Compose 内置密钥只用于本地隔离开发。Ubuntu、Kubernetes、外部 Secret、数据备份
和生产边界见[部署入口](../deployment/README.md)。

## 测试命令

| 验证范围 | 命令 |
| --- | --- |
| 文档契约 | `npm run docs:family:check` |
| ESLint | `npm run lint` |
| 家庭后端回归 | `npm run test:family-regression` |
| 前端回归 | `npm run test:ci --prefix frontend/web -- --runInBand` |
| Task 11 集成与浏览器 E2E | `npm run test:task11` |
| Task 12 集成与浏览器 E2E | `npm run test:task12` |
| 旧学校兼容回归 | `npm run test:legacy-regression` |
| 完整发布候选 | `npm run release:family` |

前端默认测试排除 `frontend/web/src/__tests__/legacy/` 中的学校版遗留测试；新增家庭
功能测试必须进入默认 `test:ci` 通道。Task 11 E2E 使用真实内存 MongoDB 副本集、
真实 Gateway/API 和 Chromium，不以静态页面 smoke 代替业务验收。

## 目录职责

| 路径 | 职责 |
| --- | --- |
| `backend/gateway` | 家庭 API 入口、认证和服务代理 |
| `backend/services` | 用户、任务、进度、媒体、分析和提醒服务 |
| `backend/common` | 跨服务契约、模型、中间件和只读仓储 |
| `frontend/web` | 当前家长与孩子 Web 应用 |
| `frontend/mobile` | 旧移动端代码，不属于当前家庭 MVP Gate |
| `tests/e2e/task11` | 家庭业务浏览器验收 |
| `deployment/kubernetes` | 受控 Kubernetes 清单与外部 Secret 流程 |

## 变更流程

1. 从当前 `main` 建立隔离分支或 worktree。
2. 需求变化先更新 PRD、总体设计、详细设计和测试设计并完成评审。
3. 行为修改先增加能失败的聚焦测试，再实现并运行相关回归。
4. 提交发布候选前执行 `npm run release:family` 并保存失败诊断或成功摘要。
5. 通过 Pull Request 合并；不得把历史 Gate、跳过状态或人工口头确认当作发布证据。

当前仓库的 Compose 和 Kubernetes 资产是开发、验收与受控发布能力，不表示生产
环境已经部署。容量、TLS、监控、备份恢复、k6/ZAP 和回滚演练仍需目标环境签署。
