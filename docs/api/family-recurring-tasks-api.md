# 重复计划 API 增量

**状态：** APPROVED / FINAL_INTEGRATION_ACCEPTED / SYNTHETIC_ENGINEERING_GATE_CLOSED；2026-11-15。用户已批准关闭重复计划限定合成范围工程总门禁，四批及最终收尾P2均已验收。正式接口仅在本机合成环境验证，默认关闭，真人/真机待验，未授权部署；其他门禁和后置状态不变。
**P2 修订：** 最小标记、同身份重登及原命令终态化设计已复审批准，DESIGN_P2_CLOSED；未批准新接口上线。
配套：[设计](../superpowers/specs/2026-11-15-family-recurring-tasks-design.md)、[测试方案](../development/family-recurring-tasks-test-plan.md)。
沿用[现有 API](family-learning-tracker-api.md)认证、家庭隔离、LocalDate、公共错误包络；不删除现有 repeatRule 拒绝和历史记录。

## 1. 入口与共同规则

新增路径由 Gateway 依既有身份封装转发 homework；仅已登录且实时仍有权限的家长使用。familyId/actorId 均取服务端，不接受正文覆盖。
跨家庭、失去孩子权限、未知目标统一 `403 CHILD_ACCESS_DENIED`；孩子调用管理接口 `403 FORBIDDEN`，失效身份沿用现有认证错误。先鉴权再返回命令/计划详情。

| 方法与路径 | 请求 | 成功 |
| --- | --- | --- |
| POST `/api/recurring-task-plans` | 创建命令 | 201，首次及原命令重放一致 |
| GET `/api/recurring-task-plans` | childId 必填，page/pageSize 可选 | 200 列表，默认1/20，最大50 |
| GET `/api/recurring-task-plans/:planId` | 无正文/查询 | 200 当前计划 |
| PATCH `/api/recurring-task-plans/:planId` | 完整替换未来规则命令 | 200，原命令重放历史结果 |
| POST `/api/recurring-task-plans/:planId/stop` | 停止命令 | 200，保留首次停止事实 |
| GET `/api/recurring-task-plan-commands` | childId、page/pageSize | 200 当前 actor 的终态命令索引，按 settledAt 倒序 |
| GET `/api/recurring-task-plan-commands/:operationId` | childId 必填 | 200 原 actor 的 succeeded/aborted/not_found |
| POST `/api/recurring-task-plan-commands/:operationId/abort` | childId、action、targetPlanId、requestDigest | 200 原成功结果或持久 aborted；不是撤销计划 |

不公开任意日期补生成、直接发星、删除计划/命令记录接口。所有 GET 零业务写、零生成、零恢复。
正文、query 均严格白名单，重复 query 键/未知字段拒绝，不接收客户端 status、planRevision、生成健康等服务端字段。

## 2. 创建

合成示例（日期仅说明格式，实测需随固定测试时钟生成）：

```json
{
  "operationId": "6193a7ef-43da-4a5e-a120-c0a95140c1c2",
  "childId": "507f1f77bcf86cd799439011",
  "startDate": "2026-11-16",
  "endDate": null,
  "schedule": { "kind": "weekly", "weekdays": [1, 2, 3, 4, 5] },
  "template": {
    "dimension": "physical",
    "area": "体育锻炼",
    "title": "跳绳",
    "taskType": "exercise",
    "description": "按自己的节奏完成",
    "estimatedMinutes": 10,
    "targetAmount": 500,
    "unit": "次",
    "priority": "medium"
  }
}
```

operationId 为合法 UUID。schedule 为 daily（不得带 weekdays）或 weekly（1=周一至7=周日，非空、去重整数数组）；重复星期拒绝，合法不同顺序规范排序。
startDate/endDate 严格有效 YYYY-MM-DD，endDate 为 null 或不早于 startDate。家庭时区服务器读取并固定，禁止正文 timezone。
template 仅设计 §3 白名单；可选字段省略与 null 按既有任务字段校验处理，不将不合法输入静默变成默认。空字符串/负数/非法维度/图片或奖励字段均按既有校验或未知字段拒绝。

成功包络：`{success:true,data:{operationId,plan,generatedTaskId}}`。plan 为下节 DTO；generatedTaskId 仅创建事务当日确实生成时为 ID，否则 null。重放返回原结果，即使实例后来已完成/计划已停止；UI 随后 GET 当前详情，不将历史快照覆盖当前页面。

## 3. 计划 DTO、修改与停止

plan 白名单：id、childId、timezone、startDate、status、version、currentRevision、pendingRevision、createdAt、updatedAt、stoppedAt；不输出内部 fence、数据库日志、其他家长的命令正文。
revision：revisionNumber、effectiveFrom、endDate、schedule、template。尚未生效的明日版本放 pendingRevision，不能把它投影为今日规则。
额外 generationHealth：`lastEvaluatedDate`、`lastSucceededAt`、`lastFailureCode`（脱敏或 null）、`skippedOccurrenceCount`、`lastSkippedRange`。日期为空不能显示“生成正常”；计划结束可由 revision endDate 派生显示，不新增任务终态。
列表包络：`{success:true,data:{items,page,pageSize,total}}`；命令索引采用同包络，items 只含 operationId/action/targetPlanId/state/settledAt（create 的 targetPlanId=null）。成功生成的 planId 在成功 result 内返回，不用它替换原创建命令的空目标。

PATCH 正文为 `{operationId,expectedVersion,schedule,endDate,template}`；四项业务/版本字段都必填，template 是完整替换而非隐式合并。expectedVersion 为正安全整数。
服务端成功事务确定生效日为计划当地明天；不可修改 childId、startDate、timezone。endDate 为 null 或不早于 max(startDate,生效日)。已结束或已停止计划拒绝修改。
成功：`{success:true,data:{operationId,plan,effectiveFrom}}`。不更新今天及任何已生成任务。

stop 正文仅 `{operationId,expectedVersion}`，成功：`{success:true,data:{operationId,plan,existingTasksPreserved:true}}`。
停止与生成共用计划事务栅栏，生效以提交顺序为准；先生成后停止的实例保留。不能用 stop 代替取消任务或归档完成记录。无恢复接口。

## 4. 原命令与错误契约

### 4.1 身份与摘要

requestDigest 为小写64位十六进制 SHA-256，输入为 UTF-8 的规范JSON：`{schemaVersion:1,familyId,actorId,childId,operationId,action,targetPlanId,body}`。复用现有 JSON canonicalize 规则，不按普通JSON键插入顺序计算；action 为 create/patch/stop，create目标为null，其他目标为计划ID；ID/UUID小写。scope取认证身份和实时归属，服务端不能信任客户端提交的actor/family字段。
body 为该业务接口完整规范白名单正文（含原operationId、create的childId及适用的expectedVersion），不含 requestDigest。前后端共同明确：已知字符串按既有规则trim、weekly星期排序、可选字段省略与显式null保留区别、不补动态默认值；未知字段、重复星期及非法输入拒绝而非归一化丢弃。摘要不包含时钟、计划最新版本、服务端生成ID；同命令跨午夜摘要不变。
前端保存最小标记前完成规范化并计算摘要，发送该规范正文；后端独立计算和验证。成功记录必须保存这份规范正文，不能从后来已修改的计划重建。
先鉴权和结构规范化，再查原 actor/ID 终态和摘要，最后验证最新版本/日期；已成功命令不因日期过期被误拒。匹配aborted时返回 `RECURRING_PLAN_COMMAND_ABORTED`；原ID异正文/目标/动作返回冲突。

### 4.2 最小标记及结果查询

localStorage专用键对应 `{schemaVersion:1,familyId,actorId,childId,operationId,action,targetPlanId,requestDigest}`，不存正文/认证凭据；回读校验成功后才发送。退出清会话正文及所有私有UI，但有意保留这份最小标记；未经原actor重新认证和实时授权不加载、不显示、不处理。坏标记或持久化失败不得静默移除/降级后发送。
同actor/child的未决标记阻止新的计划管理意图；原命令查询、原正文还在时的显式原ID重试及显式abort例外。新身份的迟到回调既不能恢复旧UI，也不能删除原标记；storage/focus与写前复核复用既有会话隔离方式。

结果接口的200 data：
- succeeded：`{state,identity,command,result,settledAt}`。identity 为上述标记除schemaVersion外的完整字段；command为原规范正文；result为原业务成功 `{httpStatus,data}`。当前计划另行GET，不能用历史result覆盖当前页。
- aborted：`{state,identity,command:null,result:null,settledAt}`。墓碑没有原正文，不能伪造可重发正文；settledAt为首次中止时间。
- not_found：`{state,identity:{familyId,actorId,childId,operationId}}`。只说明此刻未见终态，不含推测摘要/动作或可解锁标记。

只有succeeded/aborted与本地完整身份、摘要相等且当前会话epoch仍有效时，才条件删除该原标记；not_found、超时、403、503、损坏回执或身份/摘要冲突均不解除。不以相同operationId跨actor/child误匹配。原业务201/200不增加identity字段，客户端成功后也GET命令终态完成核验；GET失败保留结果待核对标记，不重新创建。
重登发现not_found但正文丢失时，仅提供只读重查或下节显式abort，不自动重建正文/换UUID。清站点存储、换设备不保证本地在途标记仍在；不得推荐此操作作为解除办法。命令索引能发现已落盘终态，但不是全量在途查询。

### 4.3 显式终止未确定命令

abort 路径沿用原operationId，无新命令UUID、无额外query。正文严格为 `{childId,action,targetPlanId,requestDigest}`；摘要格式及目标规则同上。create没有已知计划ID，仍须实时家长/孩子授权；patch/stop须验证目标归属。actor/family取当前认证scope，其他字段拒绝。
复用本功能命令集合、唯一键和Mongo事务：若已有相同身份/摘要的succeeded或aborted，返回上节同形状200终态；无记录则插入aborted墓碑，不写计划、任务或奖励。存在同ID异意图返回409，不覆盖任何终态。
所有业务写必须在同一事务中排他插入succeeded记录，禁止upsert覆盖墓碑。业务先提交则abort返回succeeded，不撤销原业务；abort先提交则在途业务最终日志插入冲突，整笔业务回滚，重读墓碑后返回409 aborted。不能只在业务开始查询墓碑，也不能业务提交后再写成功记录。
只有确认事务持久终态后才返回200；abort提交未知为503，原标记保留，原最小正文可重试或GET，无TTL、无“等够时间就未提交”的判断。已确定未发送/回滚但保留标记时，也可通过该墓碑永久禁止原UUID再执行，从而安全解除。
这不是计划stop，也不是撤销已成功命令。UI显式提示“若原操作已成功，将返回原结果，不会撤销”；只有确认aborted后才可由用户新建不同意图/UUID，不自动重发。撤权或功能关闭时不进行abort，保留隔离标记；恢复授权/能力后再处理。

| HTTP / error.code | 意义及客户端动作 |
| --- | --- |
| 400 `VALIDATION_ERROR` | 类型、日期、枚举、字段、分页非法；占位前拒绝 |
| 403 `CHILD_ACCESS_DENIED` / `FORBIDDEN` | 清理当前私有计划/命令视图，迟到响应不能恢复；不自动再写 |
| 409 `RECURRING_PLAN_VERSION_CONFLICT` | 共管或旧预览，重新查看后显式决定；不自动覆盖 |
| 409 `RECURRING_PLAN_STATE_CONFLICT` | 结束/停止状态不允许修改 |
| 409 `RECURRING_PLAN_COMMAND_CONFLICT` | 原 ID 的动作/目标/正文不同，不覆盖已保存结果 |
| 409 `RECURRING_PLAN_COMMAND_ABORTED` | 原业务写已被墓碑终止，禁止再执行；该错误本身不代替完整终态回执，GET核验后才清标记 |
| 503 `RECURRING_PLAN_WRITE_UNKNOWN` | 提交结果未确定；保留原命令，查询或原命令重试 |
| 503 `RECURRING_TASKS_DISABLED` | 新能力未启用；禁止绕过为一组旧 POST，保留未知命令，查询仍可用 |

错误包络 `{success:false,error:{code,message,details}}`，details 不暴露家庭、孩子内容或其他 actor。鉴权失败优先于返回功能关闭/目标状态。
开关关闭时计划及命令 GET 可用，业务写重放和abort均返回功能关闭，不偷偷执行；启用后再处理原命令。发出过请求后收到400/版本冲突也不直接移除标记，避免另一个在途重试仍成功；放弃意图先显式abort取得终态，之后用户才能提交新意图。仅本地校验未发送的表单错误无需创建标记或墓碑。

## 5. 实例与旧客户端兼容

实例 DTO 增加可选 `recurrence:{planId,occurrenceDate,planRevision}`。不增加状态、不替换 taskId、不允许客户端写这三个字段。
任务编辑、取消、完成、确认和原命令恢复沿用既有正式契约，包括确认 expectedCompletionVersion 与媒体代次。plan version 不能用作完成版本。
普通单次任务无 recurrence，旧单次 repeatRule 仍400；既有今日计划/分页/筛选只纳入真实任务，不将计划或未生成日期混入 total。
计划日期缺口不进入任务完成率分母；计划页必须提示“未生成不代表已完成”。生成/修改/停止不调用发星，确认依 taskId 去重。

## 6. 当前客户端实现边界

第三批家长页面候选复用上述接口，未新增服务端契约。最小键使用版本前缀及JSON数组`[actorId,familyId,childId,operationId]`；并发标签各自UUID不会覆盖，处理一项终态不解除其他项。正文仅当前session revision可读，同actor重新认证也清原文；新会话仅凭原标记查询/中止，不能用摘要重建正文。中止确认绑定原marker，终态还核对结果plan.childId及patch/stop目标ID。

规范摘要使用Web Crypto SHA-256，需要HTTPS或localhost安全上下文；不可用或存储失败不发送，不回退为弱摘要。此部署前提尚未在真实家庭入口验证；不修改服务配置。限定合成总门禁批准关闭及完整家庭回归、分批证据绑定以[测试方案§15](../development/family-recurring-tasks-test-plan.md)为准；原阶段及冻结归档保留历史待审/OPEN状态，不等于上线或真人验收。此次仅更新状态，无API契约变更。
