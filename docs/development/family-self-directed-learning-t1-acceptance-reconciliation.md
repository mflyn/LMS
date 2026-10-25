# T1 验收清单归并

**Recorded at:** 2026-10-23
**Status:** APPROVED / CLOSED；T1 后端工程总门禁经用户批准，关闭索引见 §6.4，不是发布批准
**T1:** CLOSED
**R4:** CLOSED
**Closure scope:** BACKEND_SYNTHETIC_ONLY

**R1 update:** 2026-10-23 用户复审通过，R1 及监听失败清理 P2 CLOSED；复审新增全量 109/109 套件、2103/2103 用例。历史失败保留，不改变 T1 或生产接入状态，详见 Gate §18.31。

**R3 历史记录（当前状态见本段末及 §4）:** 第 1–2 步已复审关闭；第二步 115 套件/2254 用例及 P3 单次响应变异证据保留（Gate §18.35.1）。
第 3 步 homework enabled 统一正式组合已实现并提交复审；最终证据见 Gate §18.36，不自行关闭 R3/T1。
最终全量 117 套件/2303 项通过，第二步原 2254 项完整保留，新增 49 项，冻结源码运行后无变化。
以上为第三步初次交付证据；后续复审发现材料重读接续替代意图的 P2，修订及新验证见 Gate §18.36.1，待复审而非已关闭。
§18.36.1 复审另发现空更新最终重读遗漏；补充修订、永久负向用例与变异证据见 Gate §18.36.2，第三步及 P2 仍待复审。
两端仅合成验证，未部署真实环境；第四步 Gateway 正式链路与配置准备仍未完成。
2026-10-23 用户批准关闭第三步及空更新 P2（Gate §18.36.3），以上保留历史证据，第四步进展见 §18.37。
**第四步送审时：** 第四步已补正式 Gateway/三服务 HTTP 链路及默认关闭的配置准备，提交复审；无真实环境部署，R4-G1/G2 及 T1 仍待验收。
第四步复审发现控制键重复覆盖的 P2；现已补两份环境模板的三键唯一性与最终默认值检查、顺序交换负向用例和 Compose 实际生效值验证。
修订及自审证据见 Gate §18.37.1，P2 修复提交复审，不自行关闭第四步、R3 或 T1；历史失败记录保留。
以上保留第四步历史进展。2026-10-23 用户批准关闭控制键 P2 及第四步，R3 四步范围完成（Gate §18.37.2）；当前进入 R4 G1/G2 验收，不提前关闭 T1。

**当前裁决（2026-10-23）：** 用户在 G1/G2 和两项 P2 复审关闭后，另行批准关闭 T1 后端工程总门禁及 R4 汇总项。
前文及 §3 保留各阶段记录；当前结论以 Gate §18.40 及本表 §6.4 为准，仅限既定合成验收，不授权真实部署。

## 1. 统计口径（归并时历史快照）

权威要求仍是[实施计划 T1](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md#t1-acceptance)和
[增量 Gate](./family-self-directed-learning-mvp-gate.md)。本表不修改 API、数据契约或已批准范围。

- 归并前 T1 有 35 个未勾选条目：7 条历史汇总/门禁，28 条原始实现及验收要求。
- 前 26 批的实现与相关缺陷评审已有关闭记录，但第十批整体门禁及全量稳定性仍未关闭。
- 原条目混合独立实现、正式入口、部署恢复，不能把 35 当成未开发功能数，也不能用勾选比例计算完成率。
- 本次完成此前建议的第 1 项“验收清单归并”。之后只按 §4 的 **4 个剩余工作包**安排工作，
  其中包含 **3 项稳定性问题**及 **2 项证据待补场景**，不另算 5 个工作包。
- 清单归并当次只读取代码、测试及既有 JSON 报告，未重跑业务测试；后续 R1 新运行证据单独列在 §5，始终未执行迁移或生产操作。

状态词：**独立已实现**表示代码及独立测试证据已定位，不代表正式入口已经启用；
**混合**表示原条目中仍有装配、未来任务或环境验收；**证据待补**不等于已确认运行时缺陷；
**待关闭**表示整体判定仍未满足。下表 A01–A35 按原 35 条顺序建立稳定编号，原文不删除、不自动勾选。

## 2. 证据索引

表内 E 编号指向以下文件及 Gate 历史章节。测试文件是可复现入口，Gate 是历次运行/审批记录。
本表只归并 T1 范围，不为每个文件再新建测试命令。

| 编号 | 实现与测试入口 | Gate 证据 |
| --- | --- | --- |
| E1 | [本地编排](../../backend/services/homework-service/services/growthTaskCompletionService.js)、[模型](../../backend/services/homework-service/models/GrowthTaskCompletionOperation.js)、[服务测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionService.test.js) | §18.1、18.7 |
| E2 | [远程 operation](../../backend/services/resource-service/services/mediaReferenceOperationService.js)、[事务/租约/解绑测试](../../backend/services/resource-service/__tests__/mediaReferenceOperationService.test.js) | §18.2–18.3、18.6 |
| E3 | [completion client](../../backend/common/services/completionMediaReferenceClient.js)、[client 测试](../../backend/common/services/__tests__/completionMediaReferenceClient.test.js)、[解绑 client 测试](../../backend/common/services/__tests__/completionMediaUnbindClient.test.js)、[homework 媒体恢复测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionMediaService.test.js) | §18.5–18.6 |
| E4 | [确认服务](../../backend/services/homework-service/services/growthTaskCompletionConfirmationService.js)、[确认测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionConfirmationService.test.js)、[真实发星 HTTP 测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionStarHttp.test.js) | §18.8、18.17 |
| E5 | [隐私删除](../../backend/services/resource-service/services/completionMediaPrivacyService.js)、[保留清理](../../backend/services/resource-service/services/completionMediaCleanupService.js)、[隐私测试](../../backend/services/resource-service/__tests__/completionMediaPrivacy.test.js)、[日志测试](../../backend/services/resource-service/__tests__/mediaDeletionJournal.test.js)、[隐私 HTTP 测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionPrivacyHttp.test.js) | §18.4、18.15、18.25 |
| E6 | [编辑/取消归档](../../backend/services/homework-service/services/growthTaskCompletionMutationService.js)、[mutation HTTP 测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionMutationHttp.test.js)、[材料互斥测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionAttachmentIsolation.test.js)、[协议分流测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProtocolDispatch.test.js) | §18.9–18.10、18.12–18.13、18.19–18.20 |
| E7 | [内部 HTTP 组合](../../backend/services/homework-service/__tests__/services/growthTaskCompletionHttp.test.js)、[公开 HTTP 组合](../../backend/services/homework-service/__tests__/services/growthTaskCompletionPublicHttp.test.js)、[三服务/BSON/清理组合](../../backend/services/homework-service/__tests__/services/growthTaskCompletionThreeServiceHttp.test.js) | §18.11、18.14、18.18、18.20、18.26–18.29 |
| E8 | [详情/列表服务](../../backend/services/homework-service/services/growthTaskCompletionReadService.js)、[只读 HTTP 测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionReadHttp.test.js) | §18.16 |
| E9 | [homework 预检](../../backend/services/homework-service/services/growthTaskCompletionReadiness.js)、[resource operation 预检](../../backend/services/resource-service/services/mediaReferenceOperationReadiness.js)、[隐私证据预检](../../backend/services/resource-service/services/completionPrivacyReadiness.js)、[引用预检](../../backend/services/resource-service/services/completionReferenceReadiness.js) | §18.21–18.24；四个同名测试文件均在各服务 `__tests__` 下，homework 位于 `services/` |
| E10 | [homework 正式装配](../../backend/services/homework-service/server.js)、[resource 正式装配](../../backend/services/resource-service/server.js)、[homework 隔离测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionIsolation.test.js)、[resource 隔离测试](../../backend/services/resource-service/__tests__/completionProtocolIsolation.test.js)、[resource 正式组合测试](../../backend/services/resource-service/__tests__/completionProductionAssembly.test.js)、[homework 正式组合测试](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js) | Gate §18.34–18.37.2：R3 四步及对应 P1/P2/P3 用户批准关闭；legacy 冷加载断言保留；不等于真实部署或 R4/T1 关闭 |
| E11 | [显式回环 HTTP 测试工具](../../backend/common/test/httpTestHarness.js)、[传输/清理负向回归](../../backend/common/test/__tests__/httpTestHarness.test.js) | §18.31；36 套件统一适配，两轮 109/109 套件、2103/2103 用例，R1 及清理 P2 已经用户批准 CLOSED |
| E12 | [正式入口 G1/G2 验收](../../backend/services/homework-service/__tests__/services/growthTaskCompletionProductionAssembly.test.js)中的 `R4-G1` 两分支及 `R4-G2` | Gate §18.38–18.38.1；G1/G2 及两项 P2 已批准 CLOSED；同 UUID 活动阻断到终态接续、abort 丢响应及 BSON/正式工厂重建后的原 PATCH 恢复；合成环境，不是主机重启或真实备份恢复 |

R2 新增证据：独立[CLI](../../scripts/completion-operations.js)、[存储检查](../../backend/services/resource-service/services/completionStorageReadiness.js)、
[清理适配](../../backend/services/resource-service/services/completionOperations.js)及[运维说明](../deployment/completion-operations.md)，
执行与自审记录见 Gate §18.32；不替代 E9 原预检或 R3 正式装配。

## 3. 原 35 条逐项对应（归并与补验收阶段留档）

“剩余归属”引用 §4 的 R1–R4；多个原条目指向同一工作包时只执行一次。
这里保留独立实现阶段的判断及工作包归属，不把其历史待办重复计入当前缺口。
包括 A11 的“预检未启用”、各行“R4 复审”等阶段表述，当前均由 §6 的核对结论更新；不删除原证据索引。

| 编号 | 原条目识别内容 | 当前判断及已有证据 | 剩余归属 |
| --- | --- | --- | --- |
| A01 | 接入事务/CAS、摘要、终态/租约、隐私及恢复 | E1–E5 独立实现，E10 正式合成装配 R3 已关闭；E12 补验收，真实启用未完成 | R4 复审；真实部署归 T8 |
| A02 | 完成下列端到端验收 | E7 独立组合与 E10 正式 Gateway/app 全链路已验证；E12 补 G1/G2，整体待关闭 | R4；前端归 T2/T7 |
| A03 | 隐私事务/凭证/清理后注册生产内部路由 | E2/E3/E5 实现及 E10 正式组合已复审关闭；真实启用未完成 | R4 复审；真实部署归 T8 |
| A04 | 依赖注入、DELETE/status/abort、client、恢复、日志介质 | E3/E5/E7 独立测试及 R2/R3 合成配置、存储探针已验收；真实介质未验收 | R4 复审；真实家庭介质归 T8 |
| A05 | 第十批整体门禁关闭 | 待关闭：材料实现/P2 已通过，不再重复开发 | R1、R3、R4 |
| A06 | growthTasks socket hang up 稳定性 | CLOSED：R1 用户复审通过；E11 移除地址族错配，历史报告保留 | R1 |
| A07 | 第十四批全量稳定性 | CLOSED（稳定性修复范围）：R1 用户复审通过；不虚构旧失败的具体进程归因，不替代 T1 总验收 | R1、R4 |
| A08 | 0/1/10、11/重复/purpose/越权/软删除、冻结及旧读 | 独立已实现：E1 参数化拒绝和完成测试，E7 实际 HTTP，E8 旧读 | R3、R4 |
| A09 | 同版本竞争、确认竞争、重放、同 key 异正文 | 独立已实现：E1 并发/幂等，E4 双向确认竞争，E7 重放 | R3、R4 |
| A10 | 授权后命令去重、最小 pending patch、原子占位 | 独立已实现：E1 scope、claim 回滚、授权及隐私字段检查 | R3、R4 |
| A11 | remoteOperationId 分离、持久化、碰撞及不外泄 | 独立已实现：E1 碰撞/提交未知/缺失映射，E7 异 actor/BSON；E9 预检未启用 | R2、R3、R4 |
| A12 | 内部命令映射及精确旧代次 unbind | 独立已实现：E2、E3、E7；纯删除不创建空远程命令 | R3、R4 |
| A13 | 不可变 successResponse、旧命令重放仍授权 | 独立已实现：E1、E7 的 A/B、确认/归档后重放 | R3、R4 |
| A14 | 每任务单 owner、全写入口互斥、清单/求助边界 | 混合：E1、E4、E6 已覆盖现有写入；清单版本冲突有测试，但新清单编辑/独立 help 尚属 T4/T3 | R3、R4；T3/T4 实现时验证局部写及版本互斥 |
| A15 | 新增/保留/移除集合、纯重排/删空/非媒体更新 | 独立已实现：E1、E3、E7 检查原代次及不发送空命令 | R3、R4 |
| A16 | 先持久化不确定标记，再远程调用及原 PATCH 恢复 | 独立已实现：E1 提交未知、E7 丢响应/BSON、E8 GET 无副作用 | R3、R4 |
| A17 | 稳定业务拒绝收敛与未知结果保持 pending | 独立已实现：E1 fail 事务未知/裸冲突，E3 终态验证 | R3、R4 |
| A18 | resource 账本/唯一索引/status/abort/凭据/分流 | 混合：E2、E3、E6、E7 已实现；索引定义不等于实际启用 | R2、R3、R4 |
| A19 | PREPUBLISH 对账、ABSENT abort、精确凭证 | 独立已实现：E1 延迟提交胜出，E3 终态分支，E5/E7 错代凭证拒绝 | R3、R4 |
| A20 | 到期整组中止、不续租、重新采样、只读 status | 独立已实现：E2 截止点/跨截止点、E7 到期恢复 | R3、R4 |
| A21 | 无 TTL、历史终态/解绑不反转、旧回收隔离 | 独立已实现：E2、E5，E9 检查索引/历史数据 | R2、R3、R4 |
| A22 | 软删除与 PREPARED/COMMITTED 竞争整组事务 | 独立已实现：E5 整组回滚及 prepare/commit/abort 竞争，E7 删除后恢复 | R3、R4 |
| A23 | TC-SL-PRIVACY-001..003：授权、首次审计、凭证恢复 | 独立已实现：E5、E7 权限/禁读/清理前后恢复及缺失/错代反例 | R3、R4；页面占位归 T2 |
| A24 | TC-SL-PRIVACY-004：30 天/最后释放、多任务精确释放 | 独立已实现：E5 多任务/字段拒绝/保留门槛，E7 第24–26批清理故障交错 | R2、R3、R4；不是旧备份恢复证据 |
| A25 | PUBLISHED_CLEANUP、发布不可回滚、精确旧代次 | 独立已实现：E1、E3、E7 发布后恢复和混合引用 | R3、R4 |
| A26 | 材料与作品互斥、旧 pending 接续、恢复后版本 | 独立已实现：E6 统一互斥/持久 fence/分流；生产未启用 | R3、R4 |
| A27 | 确认所见版本 CAS、复用星星幂等 | 独立已实现：E4、E7 真实账本、丢响应及共管首次审计 | R3、R4 |
| A28 | 历史版本 0、pending 发星恢复 | 独立已实现：E4 legacy completed/confirmed；E8 读取不落库 | R3、R4 |
| A29 | 事务前后中断、拒绝收敛、集合变化/归档竞争 | 独立已实现：E1 回滚/未知提交，E6、E7 三服务组合 | R3、R4 |
| A30 | 发布后解绑未知、删空、混合状态与错代阻断 | 独立已实现：E2 混合 bound/released/absent，E3 拒绝分支，E7 重建前后解绑 | R3、R4 |
| A31 | 终态竞争、迟到 prepare、停机到期、终止丢响应 | E1/E2/E7 覆盖终态/竞争/到期；E12 G2 补齐 abort 提交后丢响应、重建、失败收敛及迟到 prepare 无复活 | R4 复审；真实停机归 T8 |
| A32 | TC-SL-REMOTE-ID-001：A 终态后 B 同 UUID | 独立已实现：E7 `different actors reuse a public UUID after %s` 及 BSON historical COMMITTED/ABORTED | R3、R4 |
| A33 | TC-SL-REMOTE-ID-002：A 活动时 B 同 UUID，结束后 B 接续 | E12 G1 在 COMMITTED/ABORTED 两分支串联 B 零占位/零远程调用、A 不变、B 独立映射及终态重放 | R4 复审 |
| A34 | TC-SL-REMOTE-ID-003：占位/prepare/abort 未知、重启/碰撞 | E1/E7 保留原占位、prepare/commit、碰撞及 BSON；E12 G2 补正式 HTTP abort 丢响应后 BSON/工厂重建恢复 | R4 复审；实际主机恢复归 T8 |
| A35 | TC-SL-REMOTE-ID-004：旧代次/映射、备份恢复及回滚 | 混合：E1/E3/E7 有精确解绑、BSON和公开字段拒绝；无真实备份/停写回滚证据 | R2–R4 应用准备；真实恢复与生产回滚归 T8 |

## 4. 收尾工作包关闭索引

本节四个收尾工作包现已批准关闭；历史批次/原 35 条不再作为独立新增批次排队。
R1–R4 不授权修改真实数据、生产接入、提交、推送或部署。发现新问题必须关联原验收条目，
写明缺口及最小验证，不再仅因可以组合更多故障而自动增加批次。

| 工作包 | 当前状态 | 范围与退出条件 | 依赖/审批 |
| --- | --- | --- | --- |
| R1 稳定性收口 | CLOSED | 2026-10-23 用户复审通过，监听失败清理 P2 同步关闭。两轮冻结版本及复审重跑均 109/109 套件、2103/2103 用例；原用例及历史失败保留，历史归因限制仍有效。详见 E11 / Gate §18.31 | 仅关闭 R1，不改变生产隔离或 T1 总门禁 |
| R2 启用条件与运维接口准备 | CLOSED | 2026-10-23 用户复审批准，fsync P2 同步关闭。分服务预检、完整存储祖先链与发布探针、显式清理及部分失败恢复已验证；最新全量 112/112 套件、2154/2154 用例，复审 5 套件/60 用例及六种变异有效，见 Gate §18.32.2 | 仅关闭 R2，不授权真实挂载、迁移或启动接入；历史失败保留 |
| R3 正式应用装配 | CLOSED | 2026-10-23 用户批准关闭第四步及控制键 P2（Gate §18.37.2）；原第 1–3 步及对应 P1/P2/P3 关闭记录保留 | 仅合成验证，不扩大前端范围；保持旧客户端升级拒绝，真实启用仍需 R4/T2/T8 验收与单独发布授权 |
| R4 正式入口验收及 T1 关闭 | CLOSED | G1/G2 及两项 P2 已关闭；用户另行批准 T1 总门禁及 R4 汇总项，见 Gate §18.40 和本表 §6.4 | 仅限后端合成验收，不代表真实家庭发布或前端完成 |

### 4.1 两项原证据缺口（现已批准关闭）

这两项是已批准原清单的验收证据缺口，不是新增产品要求，也不是已确认代码缺陷。以下保留归并时的缺口描述；E12 补强及批准关闭记录见 Gate §18.38–18.38.1，不再作为待补场景排期。

- **R4-G1 / A33**：A 以 UUID X 进入活动状态；有权限的 B 以同一 X 请求，得到 503，
  B 命令数和远程调用数均不增加，A owner/映射不变；A 终结后 B 使用当前版本重提同一 X，
  获得独立映射并正常结束，A 终态重放不变。证据定位参照 E1 的
  `same key different body precedes active lock`（其中第二 actor 使用新的 body/UUID）与 E7 的终态后同 UUID 用例；
  两者尚不能替代完整串联。如果能定位完全等价的现有测试，补链接和断言位置即可，不必重写。
- **R4-G2 / A31、A34**：远程 abort 已持久化 ABORTED 后丢 HTTP 成功响应，homework 仍保留 pending；
  重建后原 PATCH 查回同一 remoteOperationId/摘要/终态，失败收敛并释放本地 owner，不发星、不复活引用。
  E7 当前 HTTP 丢响应参数化主要覆盖 prepare/commit/unbind，abort 正常成功及到期终态已有测试；
  本次未定位到上述完整组合。若已有等价证据先复用，否则补最小用例并在发现缺陷时修复。

### 4.2 不并入 T1 的后续责任

- **T2**：iPad 作品选择/提交/回看、家长审核页面、删除占位和缓存清除；不是本次正式后端链路验收的替代物。
- **T3/T4**：独立 help 的局部写入，以及清单编辑与 completion owner/版本互斥，在各自实现时回归 A14。
- **T7**：完整数学闭环前端/E2E 和 SL-01–06 发布 Gate；T1 仅交付其后端前提，不提前声明 SL-01 完整交付。
- **T8**：真实家庭环境/受保护介质、NAS、删除前旧快照合并删除日志、跨服务恢复与生产回滚。
  TC-SL-REMOTE-ID-004 的应用协议部分留 T1，真实备份恢复部分留 T8；BSON 测试不替代后者。
- T0 记录的两项前端基线失败未在本次复核现状，不能据旧记录宣称已修复或仍复现；后续前端/发布验收重核，
  不混入本节三项已跟踪的后端稳定性问题。

### 4.3 R4 分层验收对应

不把原独立测试改称全部穿过 Gateway；复用原事务/故障矩阵，加正式装配验收及 E12 补缺，避免重复实现业务。

| 原条目 | 保留的细粒度证据 | 正式装配/补强对应与边界 |
| --- | --- | --- |
| A01–A03、A05 | E1–E10 | E10 正式 HTTP 全链路及启动门禁；工程证据齐备后提交复审，不自动关闭汇总项 |
| A04、A06–A07 | E11、R1 历史全量 | 新全量保留原用例与历史失败，不重新归因或删历史 |
| A08–A13、A15–A17 | E1/E3/E7/E8 | E10 完成、读取和丢响应重放；E12 同 UUID 互斥、独立映射、不可变终态 |
| A14、A26、A29 | E1/E4/E6/E7 | E10 材料 pending、编辑/归档及旧 pending 接续；T3/T4 未交付入口不算已完成 |
| A18–A21、A25、A30–A34 | E1/E2/E3/E7/E9 | E10 正式内部协议调用；E12 G1/G2 补活动锁、精确旧代次、终止丢响应和迟到 prepare；真实重启归 T8 |
| A22–A24 | E5/E7/E9 | E10 正式媒体上传、签名内容和删除分派；整组事务、精确凭证、30 天清理仍由原故障矩阵验证，不宣称实际经过 30 天 |
| A27–A28 | E4/E7/E8 | E10 正式 progress HTTP、共管发星/首次审计及只读；历史版本 0 保留原服务层用例 |
| A35 | E1/E3/E7/E9 | E10 停写与写入前后 legacy 回滚限制，E12 BSON 数据/索引重建；真实介质及备份恢复仍属 T8 |

## 5. 证据与限制（历史记录，当前证据见 §6）

- 已核对既有最终全量 `/tmp/lms-t1-recovery-before-cleanup-final-family.json`：108/108 套件、2094/2094 用例，零跳过。
- 已核对第二十六批复审 `/tmp/lms-t1-recovery-before-cleanup-rereview.json`：7/7 套件、166/166 用例，零跳过。
- 历史 `/tmp/lms-t1-cleanup-commit-final-family-v2.json` 仍为 107 通过/1 失败套件、2089 通过/1 失败用例，
  TC-T5-POINT-006 socket hang up；更早 star-http/material-replay 失败及两项偶发 401 记录不覆盖。
- `/tmp` 报告为本机临时证据，不是永久发布归档；R4 关闭前必须保存可追溯版本及持久报告位置。
- 本次不以 2094 通过推导全部契约已闭环；A33、A31/A34 的证据缺口、正式装配和稳定性分别保留。
- 归并完成只关闭文档整理工作，不关闭上述 R1–R4，不重写历史审批或失败事实。
- R1 后续执行更新：新增两轮 `/tmp/lms-t1-r1-family-3.json`、`/tmp/lms-t1-r1-family-4.json`
  与 `/tmp/lms-t1-r1-final-evidence.json`；均 109/109 套件、2103/2103 用例，零失败/跳过，
  仅新增 9 项测试。R1 及清理 P2 已经用户复审关闭；R2–R4 仍是后续执行工作，不提前关闭 T1。
- R2 后续执行更新：新增 `/tmp/lms-t1-r2-family.json/.log`、源码清单及 final-evidence 汇总；
  112/112 套件、2142/2142 用例，原 2103 个用例全部保留，新增 39 个；两项自审 P2 已修订，R2 待用户复审。
- R2 复审追加 P2：原目录 fsync 移除后测试仍绿的证据保留；新增媒体/日志两根目录三个同步阶段的
  12 个故障/等待用例，逐处移除 fsync 或 await 的六种变异均被对应测试拦截，见 Gate §18.32.1。
  最新 `/tmp/lms-t1-r2-fsync-family.json/.log` 全量 112/112 套件、2154/2154 用例通过，
  原 2142 用例无丢失；自审及独立只读复核无新增可行动问题，本次 P2 待用户复审。
  不覆盖上一轮证据，不改变 R1 已关闭状态、生产隔离或 T1 总门禁。
- 2026-10-23 最终用户裁决：R2 及 fsync P2 CLOSED，复审证据见 Gate §18.32.2。
  上述待审表述为历史阶段记录；当前以 §4 为准。R3 后续已获批并实施第 1 步，R4 和 T1 总门禁保持 OPEN。

## 6. T1 总门禁关闭评审材料

以下 §6.1–§6.3 为送审时材料，保留当时待批表述和证据；后续批准及执行结果见 §6.4，当前不再等待总门禁批准。

**Prepared at:** 2026-10-23。**Status:** READY_FOR_REVIEW。**Approval:** PENDING。
T1 仍为 IN_PROGRESS / OPEN。本节仅申请已批准边界内的后端工程关闭，不申请生产启用或完整产品发布。

### 6.1 逐组核对结论

下表覆盖 A01–A35 恰好一次，沿用 §2 的 E1–E12 可执行测试及 Gate 批次记录；
不是把独立单测都改称 Gateway E2E，也不是从全量通过数字反推所有需求通过。

| 原条目 | 当前验收结论 | 证据及剩余边界 |
| --- | --- | --- |
| A01–A03、A05 | 正式装配与后端组合证据齐备；历史第十批汇总项 A05 随 T1 总裁决关闭，当前不提前勾选 | E1–E10、R3 四步 CLOSED；E12 和 R4 G1/G2 CLOSED；前端及真实部署不在本项关闭范围 |
| A04、A06–A07 | 运维准备、分服务预检及稳定性验收已批准；无当前未关闭的同类缺口 | R1/R2 CLOSED，E9/E11；实际日志介质/恢复归 T8，历史 socket hang up/401 证据保留 |
| A08–A13、A15–A17 | 数据边界、权限、幂等、版本竞争、持久映射及成功/失败恢复证据齐备 | E1/E3/E4/E7/E8/E10/E12；A11 预检已纳入 R2/R3 启动门禁，纠正 §3 留档中的未启用阶段描述；真实环境未启用 |
| A14、A26、A29 | 现有任务写入口互斥、原意图材料恢复、旧 pending 接续、事务回滚与最终 CAS 已验收 | E1/E4/E6/E7/E10；T3 help、T4 清单新写入口仍需实现并回归互斥，不能算已完成 |
| A18–A21、A25、A30–A34 | 账本/索引启动检查、终态/租约、完整集合、精确代次与结果未知恢复证据齐备；G1/G2 缺口已关闭 | E1/E2/E3/E7/E9/E10/E12；BSON 数据/索引与工厂重建是合成恢复，不是主机重启 |
| A22–A24 | 隐私整组事务、当前权限、首次审计、精确凭证及保留清理证据齐备 | E5/E7/E9/E10；30 天使用受控时钟验证，页面删除占位归 T2，真实旧备份合并删除日志归 T8 |
| A27–A28 | 所见版本确认、共管接续、首次确认审计、历史版本 0 及星星账本幂等已验收 | E4/E7/E8/E10；实际 progress HTTP 与账本断言，读取不发星/不恢复 |
| A35 | 应用层映射持久化、旧代次解绑、字段不外泄及写入前后回滚门禁已验收 | E1/E3/E7/E9/E10/E12；物理分库、真实备份/停写恢复仍归 T8，不因 T1 关闭免除 |

**剩余判定：** 在上述 T1 后端合成验收范围内，未定位到新的待实现项或缺失验收证据。
剩余的是总门禁审批及获批后的状态同步，不新增技术批次。若后续复审发现缺口，应关联原 A 编号重新打开对应项，
不能以本申请代替问题修复。T2/T3/T4/T7/T8 责任沿用 §4.2，不转为本次已完成事项。

### 6.2 版本与验证证据

- 工作区基底 HEAD：`79b346155abf4fefd2afdabe12c7e5a87db1448e`。实现尚在未提交工作区，不能把 HEAD 单独当作受测版本；
  必须结合 `lms-t1-r4-code-manifest.json` 的 771 文件哈希与归档覆盖层重建，依赖另安装。
- 上轮最终全量：`npm run test:family-regression -- --json --outputFile=/tmp/lms-t1-r4-family.json`，
  Node v22.23.3，118/118 套件、2390/2390 项通过，零失败/跳过，退出码 0，321.8 秒。
  本次核验报告、归档与冻结文件，未重新运行该业务全量。原 2387 项全部保留，仅新增 G1 两分支和 G2。
- 上轮独立复审定向运行：`lms-t1-r4-review-focused.json/.log`，1/1 套件、68/68 项通过，零失败/跳过，退出码 0，15.215 秒。
  六种复审变异分别产生 2/2/1/2/2/1 项预期失败、无加载错误；65 项为明确筛选未运行，不是零跳过全量。
- 全量 JSON SHA-256：`21adb6e63baba0ea3ed0b81cea5b189fac7e0eacf3a53a7c01f312039e8ddb8b`。
  冻结清单 SHA-256：`b0d802b33aaefd0901d6a7e7793057cf273e508f84401ba3a8caa1e14e0ebb4c`。
- 原不可变归档：`release-gate-artifacts/t1-r4-2026-10-23/`；788 个源码/文档、765 个报告、6 个辅助文件。
  `archive-manifest.json` SHA-256：`fce9c7251fa876ad31fb32f5fb432be6d324ba4d0ddcb1e3d878ebbcf856c45d`；
  `source.tar.gz` SHA-256：`469b59ec66b68e7e1649b9cab066c82f3a218ee24e899d7f7199bed0fa637129`。
- 补充归档：`release-gate-artifacts/t1-close-review-2026-10-23/`，保存复审报告、本次五份文档快照、
  文档校验及源码未变核验结果，并以 manifest 关联原归档；目录 0700、文件 0600，Git 忽略。
  文档与原快照的差异是本次状态/评审更新，不覆盖受测代码、原报告或历史失败；本机归档不等于异地备份或 GitHub 发布。

### 6.3 待批准裁决及执行边界

建议裁决文本（**尚未获批**）：批准关闭 T1 后端工程总门禁和 R4 汇总项，仅限现有合成验收范围；
保留历史失败、旧客户端升级拒绝、默认关闭配置及写入后不可回退旧 writer 的限制，不授权真实部署、前端扩展或 Git 发布。

批准后才执行：在 Gate 追加裁决并更新 T1/R4 状态，给 A05 等历史汇总项添加关闭索引，
同步实施计划/导航及文档门禁中目前要求 `T1 IN_PROGRESS` 的状态断言和相应测试，再做文档验证。
原分批日志、失败记录和本次送审归档不改写。本次仅准备申请，不执行这些关闭动作。

真实家庭启用仍需完成相应 T2/T7/T8 验收并取得单独发布批准。T0 两项前端基线失败本次未重核，
既不声称已修复，也不据旧证据认定仍复现；不得将本次后端 Gate 当作前端、真实登录、Linux/ClamAV 或家庭价值验收。

### 6.4 批准关闭及历史汇总索引

2026-10-23 用户明确批准关闭 T1 后端工程总门禁及 R4 汇总项。**T1 / R4：CLOSED**，仅限 BACKEND_SYNTHETIC_ONLY。
Gate §18.40 为本次裁决记录。§6.1 的 A01–A35 核对结论和 §6.2 的历史证据继续有效；§6.3 待批准步骤现按授权执行。

- A01–A05 的 T1 工程汇总范围及 A07 的总验收依赖现已满足；A05 第十批整体门禁不再单独挂起。
  A06/A07 稳定性修复沿用 R1 已关闭裁决，不删除原失败或扩大发生原因的结论。
- A08–A35 的 T1 部分按 §6.1 的逐组证据关闭；混合条目中的 T2/T3/T4/T7/T8 后续责任仍按 §4.2 执行。
  原 35 条历史复选框不批量勾选，避免把真实备份恢复、前端或尚未新增的写入口误算完成。
- Gate 当前状态表、实施计划、开发导航及运维说明同步为关闭；文档校验要求 T1 当前状态唯一且 CLOSED，
  R4 已关闭、合成范围及无生产授权明确，同时保留 T2–T9 NOT_STARTED 和 SL-01–SL-07 PLANNED。
- 原 `t1-r4-2026-10-23` 与 `t1-close-review-2026-10-23` 归档保持不可变；批准后材料和验证报告另存
  `release-gate-artifacts/t1-closed-2026-10-23/`。本机归档不是 GitHub 发布或异地备份。

至此没有因本次审批遗留的 T1 开发工作；未来发现缺陷仍需关联原 A 编号重新打开对应项。
保留旧客户端升级拒绝与默认关闭配置；不部署真实环境，不扩大前端范围，不自动启动下一任务或提交/推送。
