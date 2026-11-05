# T8 不依赖 NAS 的本机恢复与认证验证

日期：2026-11-03。状态：LOCAL_SYNTHETIC_VERIFIED / RELEASE_NOT_READY；T8 总门禁 OPEN。
用户明确授权本地合成测试夹具和文档修订；不改业务实现，不访问服务器/NAS，不提交推送或部署。
基线为 `4655d30f1b61b55f400b67f16f9143dd191de1d2`，在已有四份合并状态文档增量之上工作，未覆盖它们。
原 [2026-10-30 交付](../t8-local-preparation-2026-10-30/README.md) 的 manifest、冻结结果和失败历史不改写。
同日后续[真实浏览器补验](../t8-browser-20261103/README.md)已完成本机 Chromium/WebKit 闭环；
下文原轮次与冻结摘要仍为认证 HTTP 批的历史快照，不能据当前夹具重写其哈希。

## 本轮新增及实际边界

- 扩展既有 `familyProductRestore.drill.js`，将正式 user-service 纳入 Gateway/homework/resource/progress
  装配。源库账号经真实模型保存密码/PIN 哈希；真实 dump/restore 到全新空副本集后清空会话，
  重新经过 Gateway 的家长登录/孩子 PIN 接口获取 JWT。全部正常 Bearer 请求禁止自签 token 兜底。
- 三个孩子分别登录，第二、第三个孩子读取/写入第一个孩子任务及访问媒体被拒绝；另覆盖跨家庭、
  错误密码/PIN/家庭、匿名、过期及 tokenVersion 不符。不是三个孩子各自完整页面流程验收。
- 原六场景保留：已确认作品/反馈回看、只读发现、同 UUID 不同 actor、原命令及 remoteOperationId
  恢复、完整引用代次、旧审核版本拒绝、首次共管审计、重复发星保护、撤权、正常删除及删除恢复阻断。
- 重置 PIN 只允许目标孩子 pinHash/tokenVersion/updatedAt 变化；其余用户字段、全部 users 索引及其他
  集合完整比较。另两孩子旧会话和旧 PIN 仍有效；目标旧 token 的读、complete、recover 均返回
  401 / STALE_CHILD_TOKEN，旧 PIN 拒绝，新 PIN 登录后仍能读取原作品。五种比较变异固化为永久反例。
- `familyLocalBackup.drill.js` 复用现有 `createToolOwner` 异步工具执行，保持 30 秒超时配置并使用 SIGKILL，
  不阻塞 mongod 管道消费；最终先等待工具收尾再停止本轮实例。没有新增恢复框架或生产执行器。
  execFile 的非零退出通过 error.code 体现，因此两个预期负例明确断言 code/status=1；
  超时、信号终止或启动失败仍判失败，不混为这两个预期负例。

环境：macOS arm64、Node 22.15.0、MongoDB 8.0.10、Database Tools 100.12.1、系统 tar。
禁用二进制下载，实例仅监听 127.0.0.1，源停止后才启动目标；私有临时根 0700，证据文件 0600。
五个正式应用工厂使用真实 HTTP 和事务，共用同一临时 Mongo 连接；不是五个独立进程/容器重启。
仅注入一次远端 commit 成功后丢响应；认证、数据库及媒体不使用成功替身。
没有浏览器、iPad、NAS、Restic 或 Ubuntu 验证；少量样本耗时不等于生产 RPO/RTO。

## 执行与失败保留

沿用现有 Jest，无依赖安装、测试跳过、超时增加或产品断言放宽：

```sh
LOG_LEVEL=error NODE_PATH=<existing-dependencies> \
MONGOMS_RUNTIME_DOWNLOAD=false MONGOMS_VERSION=8.0.10 \
T8_MONGOD_BINARY=<existing-mongod> T8_MONGODUMP_BINARY=<existing-mongodump> \
T8_MONGORESTORE_BINARY=<existing-mongorestore> T8_TAR_BINARY=<existing-tar> \
<node22> <existing-dependencies>/jest/bin/jest.js \
  --config=backend/jest.family-common.config.js --runInBand \
  --testMatch '**/familyLocalBackup.drill.js' '**/familyProductRestore.drill.js' \
  --json --outputFile=<private-evidence>/drills-reviewed.json
```

| 轮次 | 实际结果 | 说明 |
| --- | --- | --- |
| auth-red | 2 failed / 5 passed，另有 suite 错误 | 新登录返回 503；沙箱日志目录 EPERM 混入，不冒充纯行为红灯 |
| auth-red-controlled | 1 failed / 6 passed | 受控本机权限下，新登录仍 503；原六场景全过，证明旧夹具未装配 user-service |
| auth-first | 9 passed | 原六项加三项；尚未包含独立审查补强，不作为最终候选 |
| drills-final（历史文件名） | 5 failed / 9 passed | 原归档夹具 spawnSync restore ETIMEDOUT 后仍等待；核对 PID/父进程/路径后仅终止本轮挂起工具，保留失败及收尾 |
| drills-reviewed | 2 suites / 15 passed，0 failed/0 skipped，17.203 秒 | 异步归档 5 项、认证及权限补强后正式恢复 10 项；每个成功工具 exit 0，两次负向工具 exit 1 |

最终两套报告的 instancesStopped/toolsStopped 均为 true，正式应用 httpClosed=true。
正式应用 report 的 restoredRealLoginVerified=true 仅证明恢复后认证步骤；全套是否通过仍以 Jest 为准。
删除恢复仍精确拒绝 `LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`，未开放删除前快照或运行后置 writer。

公共回归 `--config=backend/jest.family-common.config.js --runInBand --silent --json`：
52 suites / 1388 passed，0 failed/0 skipped，78.741 秒。该轮在最后夹具补强之前执行，
此后公共实现及公共测试没有改动；两类显式 drill 不属于默认公共 testMatch，不能拿公共通过代替它们。
最终两夹具定向 ESLint 通过。文档完成后重新运行 familyBackupPreflight、familyDocumentationGate、
localBackupDrillLifecycle、localProductRestoreSupport：4 suites / 402 passed，0 failed/0 skipped，
37.851 秒。`node scripts/check-family-docs.js`、`git diff --check` 及 199 个本地链接目标检查通过。
只读进程核对未发现 T8 临时 mongod/dump/restore 残留。未执行全家庭后端、前端或完整 release。

独立只读复核确认 users 比较 P2、真实旧 token 写入补测 P3 已修复，异步工具收尾未发现新增
阻断性问题；核对了最终 15 项结果、源码/补丁和归档哈希。文档复核的 exit-1 表述建议已收窄到
两个预期负例。复核未独立重跑真实实例，后续 402 项为开发复验，不冒称独立实跑；
reviewer `01a1a040-9898-7da1-aa9a-1e2e5759c8d4`。本轮提交用户验收，不关闭 T8 总门禁。

## 冻结与归档

| 对象 | SHA-256 |
| --- | --- |
| familyProductRestore.drill.js | `dfda8c3f9583db30476a9f57f1df19f984c68d07a0f9bbd106b7a0ba5277b239` |
| familyLocalBackup.drill.js | `52f5c59eb7b4a0ace33294bc286044c93fc208d37890e38da6ea082d16967156` |
| 两夹具 candidate.patch（相对上述基线） | `702252547e3f106604f3235275871b740aff7e49a89dfe196353fbdbb25070b7` |
| auth-red-controlled.json | `14fd6df89d75339661e33305f8a778f23de2507fd8105d71d0e4d4ecd5bf45f0` |
| drills-final.json（失败） | `6eb59a8754edc253226a41c9795696925fe4f3323007a857a34013ddccda1ed7` |
| drills-reviewed.json | `c117331a729447258fb11b833b70ad139fbb0b2aee36017ec29a2554e8faafeb` |
| artifact-reviewed/result.json | `701ef09ebf88328895bb62cb018ce418601f991ad48b75d52994f4d1fadd6807` |
| artifact-reviewed/manifest.json | `2f022a1a2e80f5ba51295f1b217b9ea80708f649c4a01e246e307256ac3a29ca` |
| product-reviewed/result.json | `5ae8b20197298e8410b5c4ef9c35b0647407fc3e49cc0c54d899af8a958f691e` |
| product-reviewed/manifest.json | `83052b154830aecaf8ce2f6f66f492d8dd38aefce5b3c4148b692726a3aca9eb` |
| common-regression.json | `684e94414fd389d07a7d900a02dda80009a088f49c18f493a69e468b76b572d2` |
| final-targeted.json | `24f4bb1991474357e7280e074d72e50e27ec608488a40d03c645542ae8425956` |

原始日志、JSON、补丁及上述同轮 manifest/result 逐件复制到原始检出的 Git 忽略目录
`release-gate-artifacts/t8-nonnas-20261103/`，64 件、868129 bytes，权限 0700/0600；不移动原件、不复制
数据库或媒体正文到公开目录。私有 archive-index.json SHA-256：
`4bcf262b65bfd325c65ee64dd2bf20494d0dc0115e8e4bb82c248e8e089f1fce`。
这仍是同机证据归档，不是异机备份。final-targeted.json 随后单独以 0600 归档至同一根目录，
不覆盖此批 64 件清单；摘要见上表。

## 剩余发布条件

| 项目 | 当前判定 | 下一步及边界 |
| --- | --- | --- |
| 恢复后登录/PIN、原命令/作品/审核/权限 | 本机正式 HTTP 及后续浏览器已验证 | 同日 Chromium/WebKit 完成登录、重登、切换身份后的页面闭环；见后续独立候选，真机和目标环境不在此结论内 |
| 目标 Ubuntu 与资源预算 | PENDING | 固定候选、既有 Mongo 6.0.28/Tools/卷权限/索引及独立服务重启兼容；另行授权隔离执行及预算，不能搬用 macOS 结果 |
| 备份完整性及失败传播 | 本机 dump/tar/restore 已验证；上传未验 | NAS 尚未准备，真实 Restic 加密上传、断连/容量/挂载失败及异机恢复仍待验；不得以本地目录替代 NAS |
| 删除前快照的隐私安全 | BLOCKED | 正式 v1 日志缺完整终态和 UploadGuard 恢复证据；严格检查必须拒绝开放。需另行决定安全恢复方案，不扩展 D2b/D3/D4/E 或把后置当完成 |
| RPO/RTO 与保留策略 | PENDING | 先确认目标，再用约定数据量记录备份点、恢复至业务可用时间及删除重放结果；测试耗时不作承诺 |
| 发布/回滚 | PENDING | 停写和隔离演练；无新写入时匹配镜像/已验证快照，新写入后先停写备份并优先前进修复；旧镜像不能直接继续写新协议数据 |
| 安全及真机 | PENDING / DEVICE_PENDING | 目标环境入口暴露、访问保护、当前依赖风险核查；实际 iPad Safari 触控/文件选择/回看及账号切换，不以模拟代替 |
| 上游/最终批准 | T4/T8/AI-1 OPEN | T4 人工未验先解决或经明确范围裁决；T8 满足对应证据后单独申请关闭/发布，不自动启动 T9 |

继续保留历史失败、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复与新孤儿回收 REMAINDER_DEFERRED。AI 默认关闭，本轮不调用模型。
