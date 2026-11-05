# AI3 完整工程候选复审修订

Status: ACCEPTED / USER_APPROVED / HISTORICAL_FAILURE_PRESERVED。
2026-11-05用户批准本轮三项行为修订及回归入口验收；AI3-E及后续工程验收、AI-3限定合成总门禁关闭，
见[关闭批准记录](closure-review.md)。以下待审、OPEN及旧全量失败为修订时快照，原归档不改写。

## 范围与永久反例

| 问题 | 最小修订 | 永久保护 |
| --- | --- | --- |
| 超限历史RESERVED遇到过期或报价变化自动退款 | 在事务内读取原RESERVED后立即校验完整持久映射，先于祖先触碰、退款和claim | 原current条件加expired/quote_changed；413、命令/轮次/来源/预算不变、零远端调用，UNKNOWN原保护保留 |
| 临时pending重挂载草稿，丢失部分上传失败 | open/revise草稿生命周期与暂时提交资格分离；pending仅禁用，不卸载媒体控件 | manual/focus两类pending→stable后成功项、失败项、说明、提交锁保留；显式忽略失败才可继续 |
| 操作历史翻页或空页解除已知未决锁 | 身份/孩子作用域内记住已核验命令，列表分页不删除已知未决；验证终态才解锁；页外仍可恢复原ID | 已发现pending→空页→焦点刷新→恢复失败仍锁→原ID恢复终态；零新POST，现有403/切换账号清理继续执行 |
| analytics三套未进入家庭回归 | 加入已有analytics-attachments项目及其Mongo生命周期，不新增测试框架 | task5Deployment实际调用Jest listTests，断言三文件分别出现一次；原family/release入口不变 |

遗漏文件为`ai3MistakeEffects.test.js`、`ai3MistakeRevision.test.js`、`startupCleanup.test.js`。
API末尾的“尚未装配”改为历史快照标签并指向当前入口，没有改变API契约。

## 验证与证据

修复前红灯：后端定向3失败/1通过（其余99项因显式定向未选中），前端3失败/7通过。
三项行为失败与测试发现缺口均已真实触发；未放宽断言、增加超时或删除测试。
本轮开发实跑：后端受影响5套177项、前端AI3专项7套153项、前端完整71套1166项通过；
新生产构建及根lint通过。正式HTTP入口9套107项通过（50项正式应用/HTTP、57项效果断言），
新构建任务/错题双来源及Chromium/WebKit四组浏览器通过，123.49秒；属于开发实跑而非独立浏览器复验。
家庭后端全量结束：213套211通过/2失败；6408项6406通过/2失败，exit 1，1017.466秒，无跳过。
失败文件为`releaseBuildInput`与`checkGitClean`，均在Git进程启动时报`-86`。
Jest随后因错误对象循环引用导出JSON失败，原始console日志保留；汇总来源是原日志，不伪造Jest JSON。
原因已作直接对照：本次主线程执行PATH先放`/usr/local/bin`，其Git仅含x86_64/i386，
在本机Node环境连`git --version`都返回`spawn Unknown system error -86`；系统`/usr/bin/git`正常。
只将PATH改为系统Git优先，同一原测试105项通过（6.42秒）；业务、测试断言和超时均未改。
两项失败套件合并定向复验106项全部通过，exit 0，4.545秒。
这是原全量失败加定向入口修正复验，不能合称一次全量通过。

独立复验分层：

- 费用/编排4套142项通过，analytics三套74项通过，discovery与项目选择2项通过。
  恢复旧校验顺序时current通过、expired/quote_changed两项预期失败；逐项移除三条测试入口时
  discovery永久反例均准确失败。没有修改当前源码或放宽原断言。
- 前端AI3及相关会话/AI2共15套399项通过；注册表终态单调、多命令保锁、权限与身份迟到响应
  独立探针12项通过。API边界为mock，不称为正式HTTP或浏览器验收。
- 单独发现链路复核从实际family命令读出213个测试文件，新增三套和discovery测试各一次；
  两条原配置/发现断言通过。这个轻量复核不算重跑213套。

失败如实保留：独立analytics首轮因硬编码日志目录写入只读仓库报EPERM；仅测试进程日志位置
重定向到临时目录后74项通过。前端独立探针首轮1项mock Context未传播重渲染，修正临时夹具后12项通过。
这两项不冒称业务逻辑修复，也不覆盖用户复审原红灯。独立复核未发现本轮新增可操作缺陷。

## 新累计源码身份

LMS从`a4f051e26f3514da051910a3495e11b149a32c45`累计147个源码/测试文件，补丁SHA256：
`5bff86cda287335568f67e790ec0ba510cf34645310cb9fe164de1b83ac2561f`。
相对旧候选恰好六个文件变化：service及其测试、页面及其测试、analytics配置、discovery测试。
后两文件首次纳入累计冻结；不是把本轮增量当作完整AI3交付。
DeepTutor14文件未改变，原累计补丁SHA256保持
`e9d7c05a1285f52feed4e59399c6fd65ce0413dee87c86858c4a450425e7f7be`。
两仓161文件从各自基线重建，逐文件内容与模式一致；源码、Git HEAD和index无漂移。
共享文档/checker仍按原hunk选择，排除T8和AI1/AI2 postmerge增量。原源码与文档冻结包不覆盖。
独立冻结审计43项通过：新旧候选均用`patch --fuzz=0`重建；相对旧145文件候选仅六文件变化，
T8九项与AI1/AI2 postmerge五项排除清单无漂移，checker选择hunk和DeepTutor补丁原字节不变。

本轮私有归档入口为`release-gate-artifacts/ai3-integration-20261105/review-fixes-v1/`：
`source-freeze/`是双仓累计源码与重建记录，`documents/`是新文档补丁及隔离投影校验，
`main/`保留开发红灯、全量失败、定向复验、构建/HTTP/browser结果；`independent-*`区分独立证据，
`original-review/`保留原诊断。`evidence-index.json`逐文件绑定SHA256，旧delivery/final-verification-v2不改写。
原24文件证据引用companion补丁继续使用；新完整候选由各仓base、累计源码、最新文档及原companion构成，
不把临时增量或未包含文档的源码补丁独自称为完整可交付候选。该本机归档未经公开提交授权。

## 本轮结论

三项行为问题及遗漏测试入口已修复、固化反例并通过限定独立复核；原UNKNOWN不退款/不换UUID、
403私有清理、账号/孩子隔离和审核保护未削弱。当前可提交本轮修订复审，不自动关闭问题或总门禁。
总门禁评审须同时阅读本次完整回归exit 1及原生Git定向106项通过，不将其改写为新一轮全绿。
未复跑未变化的DeepTutor全套，也未新增高级恢复、新回收或真实模型验证。

## 保持边界

AI3-E USER_REVIEW_PENDING、AI-3 OPEN；T4/T8/AI-1 OPEN、DEVICE_PENDING、
Docker INCOMPLETE_FAILED、历史失败、非阻断补测、QUALIFIED_COUNTER_PENDING及REMAINDER_DEFERRED不变。
仅本地合成；真实LMS/DeepTutor应用与Provider、计数、价格替身分层记录。
不调用真实模型、不提交推送合并、不部署；高级恢复、新回收和真实模型验证均不扩展。
