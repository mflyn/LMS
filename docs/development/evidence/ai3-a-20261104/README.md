# AI3-A 首批本地合成候选

**Status:** ACCEPTED / USER_APPROVED (local service batch only, 2026-11-04)
**AI3-1:** ACCEPTED / USER_APPROVED
**AI-3:** OPEN
**Base:** `a4f051e26f3514da051910a3495e11b149a32c45`

当前批准结论见文末“用户批准与复审绑定”；下方原交付正文中的待审表述保留为批准前历史快照，不代表当前批次仍未验收。

## 范围

批准依据：[最小设计](../../../superpowers/specs/2026-11-04-family-ai3-minimal-design.md)、
[API](../../../api/family-ai3-api.md)、[测试计划§6](../../family-ai3-test-plan.md#6-后续批准与首批边界)。
设计两项问题已获用户批准关闭；本实现批次尚未获验收。

本批实现homework独立手工候选服务：实时家庭/孩子权限、创建、不可变内容修订、拒绝、精确版本预览/发布、
取消/撤回、孩子白名单读取、原actor命令发现/终态重放；使用实际Mongo副本集事务、唯一索引与祖先条件写。
模型/校验/预检/服务4文件及2套测试新增，现有setup仅将ai3纳入副本集分支；无生产路由或服务启动入口引用。

明确未实现：生成及共享预算owner扩展、孩子提交及媒体写、最终审核/复习效果、页面和正式HTTP装配。
孩子摘要与事件时间本轮只关闭设计问题，不声称这两条写路径已实现或运行通过。
无新框架、依赖、常驻进程或真实数据迁移；回退保持模块未装配，不删除任何既有数据。

## 验证边界与失败保留

实际数据库/事务/Family/User和AI2模型；来源与知识点只读端口是替身，已批准AI2来源是前置夹具。
不是从AI1真实人工批准开始的全链路，不是正式HTTP/浏览器，不调用任何Provider或付费模型。

- 首次运行：两套因新增模块尚未实现加载失败，0项执行，退出1；不是业务反例通过。
- 初实现：1 failed / 26 passed。失败为故障夹具经Mongoose改不可变childSnapshot被忽略；改为collection限定注入并断言grade=5，保留409/零写原断言。
- 自查补非HTTP链接：4 failed / 14 passed，确认data/javascript/协议相对/mailto遗漏；复用现有AI1拒绝规则后补齐，未放宽断言。
- 修订后AI3定向：2 suites / 36 tests passed。既有Mongo驱动useNewUrlParser/useUnifiedTopology弃用警告保留，不记为零警告。
- 后续完整服务回归及独立评审将在本记录追加，以上初轮失败不覆盖。

## 独立评审与修订

首轮独立评审实际运行2套36项通过，并以临时库删除Content集合、替换hello能力响应复现readiness P2：
底层Mongo code=26/普通Error未转换，均为零业务写入但不符合503错误契约。
新增两个永久反例先得到2 failed，随后仅在mutate预检边界将错误转换为503 AI3_NOT_READY（空details，无底层cause）。
补齐create/publish事务读取祖先后暂停、外部撤回、再继续的真实交错反例；保留原事务前撤回用例。
补齐孩子DTO各层精确键集合、持久投影损坏后预览/发布/读取拒绝、发布失败零成功命令。
屏障finally无条件释放、清定时器、等待请求收敛并恢复spy，不修改生产代码增加测试钩子。

修订后开发定向2套41项通过；独立限定复验5 passed / 36未选（使用明确testNamePattern），退出0。
独立结果不冒充41项重跑；未实施变异测试，不把屏障静态分析写为变异通过。
readiness P2及两项保护缺口 FIXED_AND_INDEPENDENTLY_REVIEWED，随本批待用户验收，不自动批准批次或总门禁。

## 运行命令

使用现有Node22与原项目依赖，不新增安装。正常依赖安装位置下等价入口：

```sh
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/ai3Contract.test.js backend/services/homework-service/__tests__/services/ai3Service.test.js
node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand
npm run docs:family:check
git diff --check
```

本工作树依赖来自既有原始检出：实际执行时用绝对Node/Jest路径及NODE_PATH指向该依赖，不改变测试代码或断言。
独立5项选择器：`missing collection|failed hello|after transaction snapshot|exact child DTO`。
七个受影响JS（模型、三个service、两测试、setup）定向ESLint退出0。
文档检查与新增四稿15条链接/锚点通过；旧文档校验器尚不包含完整AI3状态语义，不冒充新契约运行证明。

## 完整服务回归与候选

首轮完整homework命令退出1：23 failed / 27 passed suites，142 failed / 1609 passed tests，287.058秒。
日志包含工作树backend/logs写入EPERM；保留此轮失败，不将其改写成通过。
同一原命令、原断言在获准的正常本机执行上下文复验，设置MONGOMS_RUNTIME_DOWNLOAD=false：
50 passed suites、1751 passed tests，262.146秒，退出0。该结果是homework服务完整既有套件，
不是全家庭后端、完整发布、正式AI3 HTTP或浏览器验收；既有测试配置中的历史排除项未改动。
本轮未安装依赖、关闭日志、增加超时、删除/放宽断言或跳过新增反例。

[候选清单](candidate.json)绑定7个源码/测试及3份设计文档当前SHA256；
[候选补丁](candidate.patch)仅含这10文件，不包含T8、AI1/AI2或共享Gate旧增量。
[门禁追加片段](gate-append.md)另存，清单记录追加前Gate哈希；验证原Gate全部字节仍是当前Gate前缀。
该片段用于追加到当前保留工作区，不应覆盖共享Gate全文。README与验证摘要是交付元数据，不计入源码候选摘要。
原有17项无关文件/符号链接哈希不变；只按授权追加Gate，并更新本批三份设计状态。

[验证摘要及原始日志哈希](verification.json)区分开发全量/定向、独立36项和独立5项。
原始本机日志留在临时证据目录，仓库只存计数/哈希及必要失败摘要，不复制日志中的本机用户名或请求内容。
初始缺模块、故障夹具、URL红灯来自本线程工具记录，未伪造独立原始日志。

本批自查、限定独立复评及实际验证已完成，提交用户批次评审；AI-3总门禁保持OPEN。

## 未关闭状态

T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测、
QUALIFIED_COUNTER_PENDING及REMAINDER_DEFERRED均保留。无真实模型、提交、推送、合并或部署。

## 用户批准与复审绑定（2026-11-04）

用户在本轮复审通过后明确批准AI3-A限定合成批次验收及readiness P2关闭。
AI3-A ACCEPTED / USER_APPROVED；readiness P2及祖先事务竞争、孩子DTO两项保护缺口 CLOSED / USER_APPROVED。
绑定原[candidate.json](candidate.json)与补丁SHA256 `63b488422575bdc4a63b66c475184040b8e58bf34bdb1a93ce1d43e649d7a0ae`，
不改原补丁、原日志摘要或当时待审文字。后批源码若变化，以新候选为准，不覆盖本批冻结身份。

本轮只读复审独立运行原两套AI3测试：2 suites / 41 tests passed，8.61秒，退出0；
该结果来自评审线程工具输出，与此前独立5项选择器、开发41项及完整homework1751项分开。
核对10文件/补丁/门禁片段/4原始日志哈希全部匹配，补丁reverse check、七JS ESLint、文档校验及diff check均退出0。
首轮23失败suite/142失败test及EPERM、Mongo弃用警告、未运行变异与正式HTTP/浏览器边界继续保留。
AI-3仍OPEN；本批准不包括完整生成、孩子作答、最终审核/复习写回、页面或真实发送。
