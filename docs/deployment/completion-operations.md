# T1 完成作品启用条件与运维准备

**Status:** CLOSED（R1–R4 及 T1 后端工程总门禁，2026-10-23 用户批准）；仅限合成验收，不授权真实环境部署。

本说明对应[验收归并 R2](../development/family-self-directed-learning-t1-acceptance-reconciliation.md)。
命令从仓库根目录使用 Node 22 运行。它们不是发布开关，不代替 R3 装配审批、R4 正式入口验收或 T8 真实备份恢复。
R2 只在合成数据库与临时目录演练；R3 第四步另准备仓库 Compose 示例，不修改真实库、密钥或部署。
R3 四步方案已获批准；resource/homework enabled 已装配并仅做合成验证，见 [R3 方案](../architecture/family-self-directed-learning-r3-assembly-proposal.md)。
新协议业务路由已在 enabled 模式装配，默认仍为 legacy，真实环境未部署。

## 1. 操作前提

2026-10-24 MVP 调整：高级删除恢复与新孤儿回收未完成范围后置，不阻塞页面合成开发，
不等于允许真实环境启用。现有 enabled 仍要求专用凭据、日志目录、索引和预检，即使
`COMPLETION_ORPHAN_CLEANUP_ENABLED=false` 也不能移除这些依赖。保留默认配置不变；
页面测试不运行清理/恢复 CLI。真实试点前必须验证备份、隔离恢复和删除事实，无法证明安全则不开放恢复环境。
完整边界见[执行记录 §11](../development/family-self-directed-learning-t2-execution.md#11-2026-10-24-mvp-范围调整与页面运行依赖)。

1. 操作者实际停止相关写入和清理工作，等待在途请求结束，记录停写窗口；涉及 resource 引用的生产切换必须协调 homework/resource 及相关旧写入口。
2. 确认当前版本、数据库归属和备份可恢复。每个服务只使用自己的 `MONGO_URI`，不由一个服务跨库写入。
3. 使用秘密管理或权限受控环境注入 `MONGO_URI`，不要把 URI 写入命令行、日志或 shell 调试输出。
4. `--writes-paused` 是操作者声明，**不是分布式锁**。检查期间到批准启用之间持续停写；退出码 0 不会自动开放路由。
5. 索引缺失、构建中、冲突、错误 collation、映射/证据不一致均须停止启用并单独评审，不自动修复或删除历史命令。

## 2. 存储配置

resource 环境需要以下配置；示例路径不是仓库内默认启用的挂载：

```dotenv
PRIVATE_MEDIA_ROOT=/srv/family-growth/private-media
COMPLETION_DELETION_JOURNAL_ROOT=/srv/family-growth/deletion-journal
COMPLETION_STORAGE_CONFIRMED=true
```

- 两个目录由运维人员预先创建并挂载持久介质，必须是规范化绝对路径，不允许符号链接、相同目录或互相嵌套。
- 目录属主为实际运行进程 UID，权限 `0700`；到文件系统根的整条祖先链属主只能是 root 或运行进程 UID，且不可被组或其他用户写入。
  例外是这些可信属主持有的 sticky 目录；受保护子项的属主也必须可信，其他用户不能重命名该子项。
  容器和宿主机 UID 映射须事先核对，不通过脚本自动 chown/chmod。
- 媒体与日志必须分别挂载，例如两个独立的宿主机 bind mount/持久卷；禁止使用容器可写层、临时文件系统或公开静态目录。
  删除日志应纳入独立备份链路，先于任何正文清理可靠保存；备份中不得用旧日志覆盖新删除证据。
- `COMPLETION_STORAGE_CONFIRMED=true` 表示运维已核实持久挂载与备份，不是程序检测出的事实。
  程序只验证目录属性以及临时文件写入、文件 fsync、硬链接发布、目录 fsync 和删除权限；不能证明断电可靠性或备份可恢复。
- 探针使用随机 `.completion-probe-*.tmp` 名称与固定合成内容，不读取学习正文，不覆盖现有证据，正常或可清理失败后移除自身文件。
  探针异常则失败退出；清理自身文件失败也不报告 ready。崩溃残留需停写后人工核实，不能通配删除其他运行的文件。
- R2 当批未修改 Compose；R3 第四步的配置准备见 §8，真实介质及备份恢复仍留给 T8。

## 3. 显式预检

分别在各服务的受控环境中执行，不共享数据库凭据：

```bash
node scripts/completion-operations.js check homework --writes-paused
node scripts/completion-operations.js check resource --writes-paused
```

homework 复用本地 operation 唯一索引、remoteOperationId 和事务能力检查；resource 顺序复用
operation、隐私证据、完整引用集合预检，再检查存储。数据库访问只读；**resource 存储检查会写入并删除自身的合成探针**。
不导入生产 server，不启动端口，不改变租约/终态，不自动创建集合/索引；数据库连接设置 `autoIndex=false`、`autoCreate=false`。
连接建立失败也尝试断开；断开失败不得输出成功。

成功输出单行 JSON，退出码 0：

```json
{"success":true,"ready":true,"service":"resource-service","protocol":"task-completion-v1","productionEnabled":false}
```

失败退出码 1，仅输出固定 code，无 URI、路径、对象身份、堆栈或学习内容。
包括 `INVALID_OPERATIONS_ARGUMENTS`、`COMPLETION_CONFIGURATION_REQUIRED`、`COMPLETION_PROTOCOL_NOT_READY`、
`COMPLETION_REFERENCES_NOT_READY`、`COMPLETION_STORAGE_NOT_READY`、`COMPLETION_OPERATIONS_FAILED`、`COMPLETION_DISCONNECT_FAILED`。
详细问题的调查应在受控环境调用已有只读预检，不将原始异常发送到公共接口或日志。

## 4. 索引准备与回滚

新账本的必要唯一键如下；现有媒体集合索引继续以既有 schema 和只读预检为准，不重建现有集合。

| 服务/集合 | 必要唯一键 |
| --- | --- |
| homework / growthtaskcompletionoperations | familyId, childId, taskId, actorId, action, operationId |
| homework / growthtaskcompletionoperations | remoteOperationId |
| resource / mediareferenceoperations | familyId, childId, resourceType, resourceId, field, operationId |
| resource / mediadeletiontombstones | mediaId |
| resource / mediadeletionreceipts | familyId, childId, mediaId, resourceType, resourceId, field, bindingOperationId |

要求非 partial、非 sparse、simple collation，不允许 TTL 或额外窄键约束，不把构建中/prepareUnique 当作已完成唯一约束。
缺失集合/索引不会自动初始化；真实环境先备份、导出索引清单，评审单独的创建计划再执行。禁止 `syncIndexes()`、drop 全部索引或重建账本来“通过”预检。

合成测试演练以下顺序：缺索引预检失败且不变更原库 → 显式按 schema 创建索引 → 预检成功但不启用 writer →
停止检查进程 → 仅撤回演练新建索引 → 比对原始索引及数据。测试代码不是生产迁移工具。

生产回滚分两种情形：

- **尚未接收新协议写入**：停止新增运维入口；保留既有数据和日志；若需撤回索引，仅撤回本次创建且确认没有 operation 使用的索引，并再次核对备份与原索引清单。
- **已接收新协议写入**：先停写，保留所有映射、终态账本、引用、删除凭证和日志，使用支持新协议的版本恢复 pending；不得回退旧 writer 绕过版本/冻结/终态约束。优先前进修复，任何数据回退单独批准。

## 5. 显式保留清理

仅在独立合成环境或将来获准的运维窗口运行；本批不设置 cron、不增加 HTTP 清理路由：

```bash
node scripts/completion-operations.js cleanup resource --writes-paused --execute --limit=100
```

`--execute` 必须显式提供；limit 为 1–1000，默认 100。每次重新预检数据库与存储，不复用过去的 ready 结果。
随后调用既有 `createCompletionMediaCleanupService`，不实现第二套清理状态机：

- 只处理已记录隐私删除且达到 30 天保留及最后释放门槛的完成作品；活跃/未释放引用不可清理。
- 先持久化精确删除日志，再删除正文，再事务清理可回收元数据；保留 tombstone/receipt/operation 及首次删除审计。
- 成功只输出 `{"success":true,"cleaned":N}`，不输出 mediaIds 或 storageKey。
- 失败输出 `COMPLETION_CLEANUP_FAILED`、退出码 1；一次批次可能已完成前面的条目，不能把失败理解为整批回滚。
  不自动重跑；保留所有证据，核实故障后由操作者重新执行，同一条目按已有幂等语义恢复。
- 正文已删但元数据提交未知时，不恢复旧正文或删除日志；修复后重新调用已有清理与恢复流程。

## 6. 验证入口

```bash
npm run test:family-regression -- --runTestsByPath \
  backend/common/deployment/__tests__/completionOperationsCli.test.js \
  backend/services/resource-service/__tests__/completionStorageReadiness.test.js \
  backend/services/resource-service/__tests__/completionOperations.test.js \
  backend/services/resource-service/__tests__/completionProtocolIsolation.test.js
node scripts/check-family-docs.js
```

全量及失败记录见 [Gate](../development/family-self-directed-learning-mvp-gate.md) 的 R2 节。

## 7. R3 启动门禁与服务装配

以下仅描述代码及合成验证结果，不是现在执行真实环境切换的指令。`startServer` 在读取模式后、监听前执行门禁：

| `COMPLETION_PROTOCOL_MODE` | 当前行为 |
| --- | --- |
| 未设置或 `legacy` | 原路由；原生只读检查本服务新协议账本和持久字段，有历史终态/删除凭证也拒绝降级 |
| `maintenance` | 阻断任务、媒体和内部引用，包括旧 GET 恢复及签名 content，不推进业务状态 |
| `enabled` | 要求 `COMPLETION_WRITES_PAUSED=true` 和明确的本服务 `MONGO_URI`；resource 完成本地预检、存储探针和 scanner 初始化后监听；homework 完成本地预检和必要 MQ 初始化后装配监听 |

- 显式空值、拼写或大小写错误返回 `INVALID_COMPLETION_MODE`；不自动切回 legacy。
- 两端先校验自身现有凭据配置；数据库连接禁用 autoIndex/autoCreate。homework 仅查本地任务/operation，
  resource 查本地账本/证据/引用并执行 §2 存储探针。检查失败不修数据、索引或权限。
- 正式工厂仅支持模型所属的默认 Mongoose 连接，非该连接返回 `COMPLETION_CONNECTION_MISMATCH`；
  不允许在 B 库预检后继续用 A 库模型。legacy/maintenance 的显式注入 app/自定义工厂是可信测试宿主，不是生产多连接配置。
  enabled 不允许注入 app；两端还拒绝自定义启动工厂和替代媒体依赖/路由工厂，不能绕过正式组合。
- maintenance 的任务/媒体 API 保留 Gateway 身份校验，内部引用保留服务凭据校验；通过后返回
  `503 COMPLETION_MAINTENANCE`。签名 content 不要求 Gateway JWT，直接返回同一 503，不读取正文。
  `/health` 返回 `status=maintenance` 和 `completion={mode:maintenance,ready:false}`，不可将 HTTP 200 当成业务就绪。
- scanner/MQ 初始化在监听前；失败收尾尝试关闭本次获取的监听器、队列和数据库连接，不关闭注入的外部资源。
  只报告固定 `COMPLETION_STARTUP_FAILED` / `COMPLETION_STARTUP_CLEANUP_FAILED` 或预检 code，不输出原始连接异常。
  RabbitMQ 局部初始化的清理失败也保留后一个 code；关闭失败不能宣称连接已经释放。
- 防降级拒绝为 `COMPLETION_LEGACY_UNSAFE`；查询不确定为 `COMPLETION_PROTOCOL_NOT_READY`；
  缺停写声明为 `COMPLETION_WRITES_NOT_PAUSED`；enabled 缺 URI 为 `COMPLETION_CONFIGURATION_REQUIRED`。
- 三模式不是跨服务锁。真实切换仍必须封闭所有相关入口并等待在途请求，不能滚动混跑来代替停写。
  本步没有新增恢复执行器、清理调度或客户端兼容降级；旧客户端升级拒绝保持原契约。
- 回滚仍按 R3 §6：无新状态时可撤回本批代码；已有新状态必须保留门禁/账本/日志，不能换旧 writer。

第 2 步 resource enabled 挂载既有内部协议分流器，公共 DELETE 在实时家庭/孩子范围内按 Asset/Tombstone
选择旧删除或整组隐私删除，墓碑优先且错误不回退。非空 DELETE body 拒绝，查询失败固定脱敏 503。
上传/访问/签名内容保留既有安全规则，两种安全 profile 均有合成 HTTP 验证；secure-production 使用本地 TCP
扫描协议桩，不代表真实 ClamAV、Linux 或家庭低配置设备性能验收。清理仍仅显式 CLI，不新增调度。
第 3 步 homework 正式组合及材料快照/空更新 P2 已获用户复审批准，读取不自动恢复，材料恢复必须使用原意图，旧完成/确认客户端明确升级拒绝。
重读快照已被推进或替换时返回可恢复的 503，不代替其他请求接续新意图；不改变启用和回滚条件。
此约束包括空更新的最后一次只读加载；该分支的补充修订及验证见 Gate §18.36.2，仍不构成启用批准。
第 4 步及控制键 P2 已获用户复审批准关闭（Gate §18.37.2）；R4 G1/G2 及两项 P2 测试保护缺口已批准关闭（§18.38.1）。
T1 后端工程总门禁及 R4 汇总项已批准 CLOSED（Gate §18.40）；T2 未完成，不能据此开放完整业务或部署真实环境。

## 8. R3 配置准备与合成演练

[家庭最小栈](../../docker-compose.family.yml)与 [Ubuntu 栈](../../docker-compose.ubuntu.yml)统一从环境读取以下配置：

| 配置 | 默认值 | 使用者 |
| --- | --- | --- |
| `COMPLETION_PROTOCOL_MODE` | `legacy` | homework、resource，共同设置 |
| `COMPLETION_WRITES_PAUSED` | `false` | homework、resource；只是停写声明，不会替操作者停止流量 |
| `COMPLETION_STORAGE_CONFIRMED` | `false` | resource；仅核实持久存储及备份后声明 |
| `COMPLETION_DELETION_JOURNAL_ROOT` | `/var/lib/family-growth/completion-journal` | resource，独立命名卷 `completion-journal` |

媒体仍使用原私有媒体卷；journal 不挂给 Gateway、homework 或前端，也不增加内部服务的宿主机端口。
直接运行服务时，路径按 §2 注入；示例配置见 [backend 环境模板](../../backend/.env.example)和
[Ubuntu 环境模板](../../docker-compose.ubuntu.env.example)。学校参考 Compose/Kubernetes 不是此次新协议启用入口。

两份环境模板的三个控制键必须各自恰好声明一次，使用单行标量，解析后严格为 `legacy` / `false` / `false`。
模板门禁同时检查声明次数和最终解析值：相同值重复、冲突值前置或后置、交换声明顺序均不能绕过；
合法引号、空白、行尾注释、`export` 以及 CRLF/CR 换行不改变此要求。
这是仓库示例模板的检查，不是运行时禁止运维显式覆写配置，也不代表批准启用；真实切换仍按 §2 和 R3 方案审批。
本次使用合成环境文件和清除控制键的子进程环境，另核对两份 Compose 的实际渲染值，避免宿主机变量遮蔽模板。
重复键可能被 Compose 按最后声明值接受，因此 `config -q` 成功不能替代模板唯一性门禁，证据见 Gate §18.37.1。

**新命名卷并不自动满足启用条件。** 两个根目录均须由运维预先配置为实际运行 UID 所有、`0700`，
并满足完整祖先链检查；现有镜像/空卷的默认目录权限不能当作已合规。当前启动不自动 mkdir/chown/chmod。
目录、索引、停写声明或存储确认任一未就绪，enabled 启动必须失败；不能为启动成功而放宽预检。
真实挂载、备份、镜像发布和切换继续单独审批，本轮没有运行 `up`、build、pull 或真实迁移。

仅使用合成变量对两份 Compose 的 default/maintenance/enabled 三组配置执行 `config -q`，
另解析渲染配置核对共享模式、默认关闭和独立卷，不将渲染出的凭据输出到日志。
HTTP 演练使用临时副本集、受保护临时目录和回环监听：Gateway 已签发的合成 JWT → 正式 homework →
正式 resource/progress；没有覆盖真实登录、独立物理数据库、容器重启或真实扫描器性能。
启动回滚用实际 `startServer` 验证：未写新协议状态时 enabled 可停机并以受保护 legacy 启动；
完成写入后两服务均以 `COMPLETION_LEGACY_UNSAFE` 拒绝 legacy，保留全部状态与日志，不尝试删除数据降级。
证据见 [Gate §18.37](../development/family-self-directed-learning-mvp-gate.md)，不替代 R4 归档和最终关闭评审。

## 9. T2-G 合成运维准备

本节为尚待 T2-G 批次验收的实现说明，不授权真实登记、删除、备份恢复或部署。

- enabled 的 homework/resource 必须配置独立 `COMPLETION_RETIREMENT_SERVICE_TOKEN`（至少32字符，不复用其他凭据）。
  Gateway/前端不注入该值。resource 使用 `HOMEWORK_SERVICE_URL` 调用只读 status 或显式退休接口。
- `COMPLETION_ORPHAN_CLEANUP_ENABLED` 默认 false，只控制显式孤儿回收；不关闭 enabled 新上传的固定身份与日志保护。
- 原受保护 journal 根下，`uploads-v1/` 保存最小上传收敛记录，`orphan-retirements-v1/` 保存系统删除证明。
  T1 用户删除记录仍在原命名空间，两者不可覆盖或互相冒充。启动不创建目录；已有子目录也检查完整祖先链、权限及同步探针。
- 新模型/索引及分服务只读预检是 enabled 前置条件。预检不建索引、不修数据、不调用写退休接口。
  已有 FENCED/DELETED/PURGED 系统记录还需要精确的 homework retired status；停止所有其他写入后先启动 homework。
  两端重建和预检全部完成前仍不得开放业务流量；停写参数只是操作者声明，不是分布式锁。

仅在隔离合成环境使用以下命令，均通过本服务 MONGO_URI 定位数据库：

```sh
node scripts/completion-operations.js orphan-inventory resource --writes-paused
# 默认50，显式上限100；还需 enabled 模式与 COMPLETION_ORPHAN_CLEANUP_ENABLED=true。
node scripts/completion-operations.js orphan-cleanup resource --writes-paused --apply --limit=50
```

inventory 只输出 eligible/missing_policy/retained/in_use/inconsistent 计数，不输出学习内容或代表删除许可。
cleanup 输出 inspected/purged/skipped/failed；部分失败非零退出，保留持久 retirementId、阶段和日志，显式重试原记录。
轮转位置保存在资产的 orphanLastCheckedAt；长期 in_use 项不能永久阻挡后续候选，进程重启后仍可继续轮转。
显式恢复资格与启动就绪分开：完整冻结证据一致时允许 DELETED 缺日志进入原日志重试，但损坏/冲突日志及PURGED缺日志拒绝。
该恢复检查不表示 ready，不开放业务；先完成同ID收敛，再通过严格预检。
未绑定不等于孤儿：任何已提交历史、prepared/bound 引用、尚未终结本地意图或证据矛盾均不能按年龄删除。
无 policy 的历史资产不自动登记。内部 enrollment helper 只做合成验证，完整重新给24小时宽限，不挂公开路由或自动调用。

旧备份恢复必须保持停写并保存当前快照/两种日志；系统恢复 helper 按日志恢复完整 ABORTED 组和精确代次、删除状态及上传屏障。
它不自行删除正文、不开放写入；homework 仍 pending 时必须由当前有权的原actor通过持久映射恢复，不能由运维冒充代交。
这只描述系统回收日志恢复。旧用户删除日志不含完整终态组和上传身份，尚无已验收的恢复helper；
不得拿系统演练结果宣布用户旧备份恢复通过。其版本化补充设计先独立评审和用户确认，见
[用户删除恢复设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-user-deletion-recovery-design.md)。
返回 `ready:false` 是刻意保留的边界，仍需两服务及完整存储预检。无法重建规范元数据的未知上传/无映射文件保持隔离，
不扫描目录后按“数据库查不到”删除。真实备份工具、物理隔离部署、掉电和设备性能不在本次合成证明范围。

回滚不能清除 guard/retirement/journal 后恢复旧writer；已有新状态时 legacy 启动拒绝，保持兼容服务停写并前向修复。
