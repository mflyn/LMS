# AI2 实时权限、原命令恢复与迟到响应补验

日期：2026-11-04。范围：AUTH-01、RECOVER-04、SESSION-02。
状态：2026-11-04用户批准本批ACCEPTED / USER_APPROVED；P3 CLOSED / USER_APPROVED。AI2-5 IMPLEMENTING、AI-2 OPEN。下文首次待审及修订证据保留原阶段身份。
上一批发布/快照/输入补验已获用户批准，见[批准记录](publication-boundaries.md#2026-11-04-用户批准及本轮复验证据)。

## 本批变更

### 2026-11-04 用户批准及本轮复验证据

用户批准AUTH-01、RECOVER-04、SESSION-02批次验收及P3关闭。绑定最终94文件候选
`55dccf04033d0a2fbf89275d2bde0fa71b0444084a59db25cc5270a480ab9735`，累计补丁
`607e3388451f6eb5dd4cb402157d5d9d661085d250397d547f8ed2b65bb4b089`，四测试增量
`8ec942f8a13f87449fafe5cb1544a1ca9a2d664863bb098a571089174c8315c8`，不替换首版候选或历史失败。
本轮复审目录`ai25-auth-rereview-vgXY9q`的review/verification/post-verification及实际输出，
归入下一批`release-gate-artifacts/ai2-5-visibility-20261104/approval-review/`并单独计算证据哈希。
独立重建检查94源码、12文档、78原证据匹配；真实执行后端9项通过（21.640秒）、组件7项通过（5.262秒）。
另在临时副本对三处前置等待注入异常，6项预期失败及6个awaited release标记，Jest退出1、驱动退出0；
这是异常收尾探针，不计为6个通过的产品测试。开发215/211、此前独立复验和本轮9/7分开保留。
状态校验412 fixtures/38 requirements通过；P3关闭仅依据用户批准，不关闭AI2-5汇总或AI-2总门禁。

仅四份既有测试新增16例（后端9、组件7），没有改业务源码、原断言、API、配置、schema、索引或超时。

- [正式HTTP](../../../../backend/services/homework-service/__tests__/services/ai2FormalHttp.test.js)：实际user-service设置PIN、PIN登录签发JWT、上传PNG、发布订正、读取认证图片；实际重置PIN后，旧JWT在详情/列表/命令发现/命令详情/原提交重放/recover/media access/正文八入口精确401 STALE_CHILD_TOKEN。旧PIN登录拒绝，新PIN重新登录的原actor能读详情并恢复同一成功命令，AI1/AI2/媒体持久集合不变。
- [提交HTTP](../../../../backend/services/homework-service/__tests__/services/ai2SubmissionHttp.test.js)：pending/terminal乘以家庭孩子移除/tokenVersion变化/账号删除，共6例。原命令已持久，owner租约到期后重建service，发现/详情/recover/原submit全部拒绝；AI2及媒体集合不变、resource HTTP零请求。家庭移除403 CHILD_ACCESS_DENIED；token变化或账号删除在共享认证层401 STALE_CHILD_TOKEN。
- [服务](../../../../backend/services/homework-service/__tests__/services/ai2Service.test.js)：共管家长完成review/withdraw后被移除，原终态命令重放和命令读取均403；持久集合与首次审计不变、mediaReader零调用。
- [页面组件](../../../../frontend/web/src/__tests__/family/Ai2LearningPage.test.js)：recover 403/404拒绝后清私有视图并隔离迟到detail/command成功（4例）；detail拒绝后隔离迟到recover成功（2例）；recover网络失败保留私有视图、原UUID及提交锁，只有显式重试原recover，不自动submit（1例）。所有未知原命令精确保留，拒绝后不显示成功提示或作品链接。

权限拒绝清理的是私有界面，不假装远端命令不存在、不生成新UUID。退出/切换身份清理仍由原会话测试保护，本批没有改变该边界。
延迟Promise在finally释放，resource请求观察器finally移除，沿用既有服务器/临时数据库/文件收尾。

## 证据层次及失败历史

| 执行 | 结果 | 解释 |
| --- | --- | --- |
| 首轮后端新增 | 7通过、2失败、54未选中，17.929秒，退出1 | 两个账号删除例误期望403；实际认证优先401，精确修正新断言，未改业务 |
| 首轮新增组件 | 7通过、34未选中，5.782秒，退出0 | 仅新增SESSION-02 |
| homework全部AI2 | 10套215通过，无失败/跳过，52.028秒，退出0 | 原206完整保留 + 新9；不是家庭后端全仓 |
| 首版相关前端 | 5套211通过，无失败/跳过，9.408秒，退出0 | 原204完整保留 + 新7；不是前端全仓 |
| P3收尾修订后相关前端 | 5套211通过，无失败/跳过，7.569秒，退出0 | 仅将前置等待纳入finally；后端及业务字节未变，不重复计数 |
| 隔离副本变异 | 去掉recover拒绝清理4例失败；去掉recover epoch检查2例失败 | 均退出1、无runtime-error suite；临时源码逐项恢复 |
| 自查 | 四测试ESLint、git diff --check、原语句AST顺序校验通过 | 不改旧测试体或断言；90个其他候选源码逐字节不变 |

首轮变异驱动错误地只接受`expect(`消息，将实际4项预期findByText拒绝提示缺失判为工具异常；
保留原JSON/log及驱动失败，不算产品失败或套件异常。后续只修驱动识别精确缺失文本，原测试不改；第二轮分别4/2预期红灯。

真实HTTP新增例包含Gateway、user-service、homework、resource正式工厂、Mongo事务和本地私有文件。
家长JWT及AI1已批准制品为合成夹具；孩子JWT来自真实PIN登录。没有真实模型、真实孩子数据或远端环境。
提交HTTP例是真实签名身份路由及resource operation HTTP，但Asset是metadata夹具；共管服务例的source/media reader是替身。
组件API和媒体为替身，本批未新增或重跑浏览器，不能称正式浏览器覆盖了本批全部交错。
集合快照相等仅证明持久状态不变，不等于Mongo命令级零写；resource请求计数不是全进程出站审计。

```sh
# 使用现有Node22、固定本机mongod、MONGOMS_RUNTIME_DOWNLOAD=false；仅回环监听
node "$LMS_DEPENDENCIES/jest/bin/jest.js" --config backend/services/homework-service/jest.config.js \
  --runInBand --testPathPattern=ai2 --json --outputFile="$RESULT_ROOT/homework-all.json"
# frontend/web
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand \
  --runTestsByPath src/__tests__/family/Ai2LearningPage.test.js src/__tests__/family/Ai2DraftRefresh.test.js \
  src/__tests__/family/ai2Client.test.js src/__tests__/shared/Ai2Media.test.js src/__tests__/shared/ai2MediaApi.test.js \
  --json --outputFile="$RESULT_ROOT/components-related.json"
```

## 冻结与交接

本机原项目最终归档：`release-gate-artifacts/ai2-5-auth-final-20261104/`，不覆盖首版 `ai2-5-auth-20261104/` 或其他历史归档。

- 基线：`4655d30f1b61b55f400b67f16f9143dd191de1d2`。
- 上批candidate：`d46276d8184a525fa4eb960ce7f1ae53c6e60ad08463c3f8b5bae42352053267`。
- 首版94文件candidate：`6b599542c6c29802b272863257974e17328baab8e636c32111fafc57b6ca0bac`，对应首次独立9/7，保留不覆盖。
- 最终94文件candidate：`55dccf04033d0a2fbf89275d2bde0fa71b0444084a59db25cc5270a480ab9735`。
- 最终累计patch：`607e3388451f6eb5dd4cb402157d5d9d661085d250397d547f8ed2b65bb4b089`。
- 最终四测试增量patch：`8ec942f8a13f87449fafe5cb1544a1ca9a2d664863bb098a571089174c8315c8`。
- 94源码从基线加补丁重建匹配，无关T8不纳入；源码、文档、验证证据分别冻结，不自引用哈希。

## 独立复评与最终证据

- Meitner独立静态复评（`01a1a4c2-4426-7740-bf00-51c279841d1f`）确认新增16例直接覆盖三项缺口；没有P0/P1/P2，发现一项P3：两组deferred的前置mock/点击/waitFor在try之外。
- 已将上述步骤纳入try/finally，release在创建Promise时确定；P3后聚焦独立复评确认控制流修订有效，新旧138处matcher的AST、顺序、参数一致。P3仅FIXED_REVIEWED，待用户验收，不记CLOSED。
- Sartre独立运行（`01a1a4c4-b816-7602-868d-02be953313a0`）：首版后端3套9通过、54未选中，Jest 19.489秒；首版组件1套7通过、34未选中，3.205秒。两者退出0、无runtime错误。
- 最终候选重新执行组件1套7通过、34未选中，2.453秒，退出0。新旧93文件相同，仅测试收尾变化；后端三测试、相关业务及依赖配置哈希一致，复用已执行9项证据而不是宣称新跑16项。
- 两候选各自运行前后94/94哈希匹配、patch哈希一致，原14个独立证据文件校验不变。没有forceExit或放宽超时。开发215/211和独立9/7分别保留。
- 两项变异在最终候选临时副本再次分别4/2预期失败，原AST保留、ESLint通过。P3异常路径是控制流/AST复评，不冒称额外执行了前置等待故障注入。

原始失败和通过JSON/log、精确命令与退出码归档`validation/`；独立运行归档`review/`，
静态首版和P3复评报告保存在`validation/static-review*.md`；上批批准复验在`approval-review/`。
首版candidate及patch另存`initial-candidate/`，最终源码在`source/`；`document-manifest.json`绑定12文档，
`evidence-manifest.json`绑定实际归档，最终数量和哈希以`final-verification.json`为准。

矩阵最新31 = 26 CORE_PASS_SCOPED + 5 PARTIAL；PUB-02、VIEW-01、WITHDRAW-01/02、MEDIA-04仍待补验或明确裁决。
覆盖分类不等于本批用户批准或AI-2总门禁关闭；本批不新增浏览器、build或全仓测试声明。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
计数资格待验、高级恢复/新回收 REMAINDER_DEFERRED、T9 NOT_STARTED不变。
本批不调用真实模型、不提交推送合并或部署，不提前关闭AI-2总门禁。
