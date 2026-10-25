# T2 服务器 QA 后修订评审

**日期：** 2026-10-25。**范围：** 四项 QA P2 的本地修订、验证和 PR #27 交接。
**基线：** `548865738e8b5fb9ac67f20f51e4edb05df0a2f7`。
原限定合成批准及 QUERY_ONLY 关闭不变；本轮不自行关闭 Ubuntu 预算缺陷或高级恢复验收。

## 1. 核实、方案与自查

| QA ID | 核实和修订 | 永久保护与边界 |
| --- | --- | --- |
| QA-T2-FOCUS-001 | 审核后表单移除会丢失焦点。FamilyDialog监听焦点及DOM变化、隔离背景、处理Tab/Escape并恢复入口；Safari点击入口显式聚焦 | 移除/禁用/隐藏、空弹窗、内层Escape、卸载、入口移除与身份切换；审核成功/冲突/丢响应后焦点仍在详情 |
| QA-T2-WEBKIT-FIXTURE-001 | route.fetch重放multipart破坏WebKit上传；改用现有resource响应提交后丢失故障点 | 原始真实201及10份active资产/正文，UI保留9项、补传10项、版本2移除引用不删正文；不接受400代替故障 |
| QA-T2-D2B-BUDGET-001 | 原Ubuntu2CPU/3GiB出现测试级120秒预算超限，与旧Mongo code50缺陷分开。闭包内去重发现、使用已校验键Map，减少重复线性序列化查找 | 原139项及完整大证明图不删；新增一次闭包每成员只发现一次、跨检查不缓存外孩子/错误BSON；审计、全引用、5000ms和120秒不变 |
| QA-T12-INVITATION-WAIT-001 | 静态标题出现不等于异步preview就绪；等待实际家庭名称并增加受控延迟promise | 保留登录回跳、身份、接受邀请、fragment清理及本地不泄漏token断言，无随意sleep |

实现前已给出聚焦方案和自查：仅修现有组件、测试故障点及既有只读校验性能，不新增接口/框架/配置、不接入后置功能。
闭包去重仅限同一次暂停写入的检查；每节点审计与当前状态仍读取，下次检查重新建立集合。Maps使用已验证的唯一键，不提前按孩子过滤掉损坏证据。

## 2. 验证证据

本机Node22.15.0/macOS，Mongo7.0.14临时副本集。原QA归档162项哈希复核不变。
本轮原始证据保存在本地 `release-gate-artifacts/t2-ubuntu-p2-development-2026-10-25/`；可入库脱敏摘要见 [证据摘要](evidence/t2-synthetic-2026-10-24/pr27-ubuntu-p2.json)。原日志和截图不上传Git。

- 前端完整：`npm run test:ci --prefix frontend/web -- --runInBand`，41套件499项通过；构建通过。
- 只读预检完整：resource-family 的 `userDeletionRecoveryReadiness.test.js`，142项通过，0失败/跳过。
- T2正式浏览器：`T2_WEB_BUILD=<最终构建绝对路径> npm run test:t2:e2e -- --browser=chromium` 和 `--browser=webkit`，分别14项通过，retries=0。
- Task12真实邀请浏览器：`npm run test:task12:e2e`，1项通过。
- T2正式HTTP：`npm run test:t2:integration`，两套件14项通过。
- 家庭后端全量：`npm run test:family-regression`，142套件通过/1失败，3965项通过/1失败/0跳过，exit1，728.959秒；D2B所在142项套件通过。唯一失败为checkGitClean测试spawn Git报-86，PATH误选本机旧x86 Git。Jest随后因该异常对象循环引用未生成JSON，完整日志为证据，不能伪造JSON或将本轮写为全绿。
- 修正本轮Node22入口、保留原生ARM64 Git后，`npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false` 公共套件41/667通过，exit0，30.526秒。另启动相同8项目的完整复验，提交前尚在运行，终态单独归档/同步PR；不修改产品、测试或lint规则，不用公共补验拼接成一次完整全绿。新提交CI另行核对。
- 文档门禁64项通过；干净跟踪文件加本次新文件导出副本的lint、文档校验通过；新增文档链接/围栏、diff检查通过。增量Gitleaks8.30.1扫描无命中；工具官方SHA-256校验通过。敏感扫描不是完整安全审计。
- 独立只读代码评审无可执行新问题；审查员阅读10份JS修改及既有证据、自行执行diff检查，未声称重跑全部测试。
- 文档独立评审另发现两项P2：浏览器默认目录会互相覆盖、限额容器缺少可执行入口。已补每轮独立目录/退出码及明确的准备和离线容器命令，复审无剩余问题；四段Bash独立及合并语法校验通过，未执行服务器命令。只关闭这两项文档审查问题，不关闭服务器QA预算缺陷。

保留红灯：前端6失败/4通过，入口移除1失败/7通过，闭包发现47次而非13次的反例失败，原WebKit故障点及焦点复现失败。
中间Chromium使用Gateway丢响应未得到预期9/10，WebKit未回到触发按钮，两轮各13通过/1失败；分别改为resource提交后丢响应和显式触发聚焦，最终完整14/14通过。失败文件单独保留，不覆盖。
初次CPU剖析误用Node26，不能与Node22耗时作受控性能对比；归档脚本PATH误选旧x86 Git的-86错误改用原生Git，不涉及产品。

## 3. 待验收和发布边界

本地绿灯不等于原Ubuntu限额复验。`QA-T2-D2B-BUDGET-001` 保持 `IMPLEMENTED / SERVER_VALIDATION_PENDING`；其他三项为 `IMPLEMENTED / READY_FOR_QA`，独立代码评审不冒充独立服务器QA或用户验收。
[服务器步骤](family-self-directed-learning-t2-server-test.md)要求固定新SHA、相同限额串行执行大图、142项预检及143套件全量，并保留每轮退出码和失败。
DEVICE_PENDING、高级恢复/新回收及D01/T2-G、D2b剩余/D3/D4/E、C-CACHE-P3的REMAINDER_DEFERRED继续保留。
本次用户仅授权整理、验证、提交推送当前分支、同步PR并检查CI；PR保持Draft，不合并、不部署、不变更真实数据、密钥或默认开关。
