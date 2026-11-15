# MVP 局部收口公开交付

日期：2026-11-08。基线：`fab03283597e053996bbbca5ddd8f4919f690d6a`（已合并AI-3、T8及AI-1/AI-2文档的main）。
状态：DRAFT_PR_DELIVERY / NO_MERGE / NO_DEPLOYMENT。

用户已授权将本批已验收的MVP修订、使用指引和关闭记录提交推送专用分支，创建Draft PR并检查CI。
原[验收记录](acceptance.md)及待审快照按原文保留；其中禁止Git的文字是当时权限，不覆盖本次限定交付授权。
本次不包含合并、模型调用、服务器操作、部署或其他总门禁关闭。

## 提交范围

- 两个页面：成长记录复用反思未知写入锁、拒绝后清理及迟到响应隔离；错题编辑允许明确清空复习日期。
- 两个组件测试文件、两份既有正式HTTP浏览器spec，保留原断言及新增永久反例。
- 三份使用指引、原局部批次验收记录，以及开发索引、计划和门禁的最小相关段落。
- 联合清单只公开MVP范围摘录和原§0.1/§0.2；未复制完整本地T8/WP1方案、执行器或历史演练章节。
  本摘录不与原完整联合清单共用哈希，不能把它解释为已发布的完整T4/T8验收计划。
- 本公开说明及文件/证据摘要清单。原始日志、截图、媒体、数据库、私有目录、本机依赖链接不提交。

从最新main建立专用分支，不包含混合工作区的本地snapshot提交。原工作区未修改、清理或重置；
所有后置WP1/T8源码、测试、文档、原始失败证据及部分候选继续留存。
未修改后端业务、API、模型、依赖、工作流、部署默认配置或恢复执行器。

## 冻结与归档核验

九个实现/测试/指南文件与批准候选逐字相同；原验收记录原样保留。
原`candidate-files.json`摘要为`7e2eb4c34e3ca3a6e3c54d76c1ee3d2ecdfd6db8c27cd1112065f37f5fc87cad`，
十份冻结源码、68份开发证据、七份独立复审原件逐项核对大小与SHA-256通过。
原完整联合清单的旧哈希只绑定本地`frozen-source`原文，不绑定公开摘录。
§0.1、§0.2摘录与批准时原文一致，历史全量、分批浏览器与独立复验证据不相加、不重写。

公开文件与证据摘要见[交付清单](public-delivery-manifest.json)。该清单仅发布相对路径、大小、摘要及结果，
不发布含本机路径的原始日志；本地原件按原路径和哈希保留。公开摘要不是独立重新执行全部历史测试的证明。

## 当前分支验证

本轮在最新main加本交付范围的分支实际执行，复用已安装依赖、Node22和系统Git，不安装新依赖：

| 命令/入口 | 本轮结果 |
| --- | --- |
| `CI=true npm run test:ci --prefix frontend/web -- --runInBand` | 72套1182项通过，0跳过，54.701秒 |
| `CI=true npm run build --prefix frontend/web` | 通过；构建写入本机证据目录，保留Browserslist数据库过期提示，未更新依赖 |
| `npm run test:t2:integration -- --runTestsByPath backend/tests/t2/learningSources.integration.test.js backend/tests/t2/weeklyReflection.integration.test.js` | 2套13项通过，0跳过，21.061秒 |
| `npm run test:t2:e2e -- weeklyReflection.spec.js learningSources.spec.js --grep 'parent clears\|parent reflection lost'` | 两项新增反例通过，16.8秒；原配置，真实正式HTTP及本轮构建，临时MongoDB和合成账号，本机Chromium；不是WebKit/iPad或服务器验收 |
| `npm run docs:family:check`、六个JS文件ESLint、相对链接检查、`git diff --check` | 通过；门禁状态与原冻结/独立复验哈希保持 |

以上均为交付者本轮复验，不改称新的独立复评，也不与原候选结果累加。
使用空环境白名单及既有MongoDB7.0.14，禁止运行时下载，未读取模型凭据。
浏览器使用此前验证可用的受控本机上下文，无服务器操作；没有重跑全部历史浏览器或完整本地release。
PR完整回归以最新提交SHA的CI结果为准，提交前不预先宣称通过。

历史开发前端72套1182项、组件47项、HTTP13项及构建结果仍属于原候选开发验证。
原浏览器10通过/2失败、11通过/1失败、最后新增2项通过均保留，不能改写为一次12项全绿。
独立47项、变异触发5项失败、恢复后47项以及2项浏览器属于独立复验，不能与开发结果累加。
首轮沙箱MachPort失败、中断及日志丢失限制继续按原记录保留。

## 安全检查与保留边界

发布前核对全部新增/修改文件、新增diff及专用分支提交范围，检查凭据、个人信息、本机/服务器定位信息、
数据文件和非授权二进制；仅保留既有合成测试数据及公开仓库身份。原始私有证据不推送。
原CI的发布、性能和安全外部扫描仅可手动启用，本次只触发PR回归，不启动部署。

两项P2为CLOSED / USER_APPROVED，本批为ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY。
T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
历史失败、非阻断补测、QUALIFIED_COUNTER_PENDING及REMAINDER_DEFERRED保持。
WP1不恢复开发；高级删除恢复与新回收不扩展；真机、真人和真实启用继续待验。
