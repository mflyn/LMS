# 重复计划最终集成本地候选

状态：`FINAL_INTEGRATION_READY_FOR_REVIEW`，整体门禁 `OPEN`。第三批及其三项P2已获用户批准；本批屏障收尾P2已修复并独立复评，等待用户本批验收。仅本地合成数据，不改变真人入口。

## 候选与证据

- 固定基线 `3816c3f2a45daff8b66221cfffb322de11bdce33`。`candidate.patch` 为累计37文件候选，不是仅本轮增量；`candidate-files.json` 记录补丁、逐文件SHA-256、相对第三批变更及37文件重建校验。
- 本轮仅变更3份当前文档，新增2个测试套件、1个浏览器测试和1个限定收尾夹具；第三批非文档实现逐文件仍与原冻结一致。前三批归档不改写。
- `verification.json` 保存原报告文件名/哈希、Jest逐项状态及脱敏日志/诊断。原始运行文件在本机临时目录；摘录不是原始文件本身，其哈希不得混用。`archive-files.json` 绑定本目录除自身外的文件。
- 第三批用户复验36项、会话70项、8组变异及审计报告一并绑定，不计作本轮新跑。81套件1312项是第三批开发历史全量，本轮没有重跑全仓或全前端。

## 分批验证

| 报告 | 实际范围与结果 |
| --- | --- |
| `recurring-final-http-r1.json` | 新HTTP首轮1通过/1失败，空反馈夹具预期错误，保留失败 |
| `recurring-final-http-r2.json` | 新正式HTTP2项通过 |
| `recurring-final-http-regression-r1.json` | 新HTTP与原completion/dailyLearningPlan，3套件15项通过 |
| `recurring-final-barrier-r1.json` | 收尾夹具3项控制流反例/正例通过，不是真实Mongo故障注入 |
| `recurring-final-http-regression-r2.json` | 最终组合4套件18项通过，包含上述15项和收尾3项 |
| `recurring-final-browser-r1/*/error-context.md` | 沙箱Chromium启动拒绝，5失败；没有业务通过证据 |
| `recurring-final-browser-r2.log` | 受控本机执行，4通过/1停止弹窗夹具定位失败 |
| `recurring-final-browser-r3.log` | 修正返回步骤后新5+原第三批3，共8通过；在收尾P2修订之前 |
| `recurring-final-browser-r4.log` | 收尾P2修订后受影响新5通过，未重复累计旧3项 |
| `recurring-final-independent-review-http-r1.json` | 独立实际运行新HTTP2项通过 |
| `recurring-final-independent-cleanup-r1.json` | 独立初审P2诊断，按当时工具输出补记，非真实HTTP回滚注入 |
| `recurring-final-independent-cleanup-r2.json` | 修复独立复核与4组Node控制流诊断；浏览器仅核日志，未独立重跑 |
| `recurring-final-mutations-result.json` | 首次审计及跨日去重变异，各捕获1项失败 |
| `recurring-final-mutation-cleanup.json` | 移除完整调用等待，3项失败，均为预期杀死变异 |
| `recurring-final-build-r2.log` | 当前源码新构建成功；Browserslist提示保留，无安装 |

首轮构建因临时源码副本缺public/index.html失败，只有执行输出未存完整原日志；复制仓库public后构建成功。浏览器错误页、失败日志和预期变异失败保留，不改写为一次全绿。截图只证明Chromium合成回看布局，不代表iPad或真人验收。

文档校验首次缺少外置依赖NODE_PATH，因找不到dotenv退出1；使用既有依赖后原门禁通过，见`recurring-final-docs-r2.log`，未安装或放宽规则。前一次失败仅有执行输出未另存完整日志。新增4份JS的lint和git diff --check通过。

## 复用入口

在具有现有依赖的检出中运行，不要求新增安装：

```sh
npm run test:t2:integration -- --runTestsByPath backend/tests/t2/recurringPlans.integration.test.js backend/tests/t2/recurringBarrier.integration.test.js backend/tests/t2/completion.integration.test.js backend/tests/t2/dailyLearningPlan.integration.test.js
T2_WEB_BUILD=<current-build> T2_BROWSER_OUTPUT=<private-output> npm run test:t2:e2e -- recurringFinal.spec.js
npm run docs:family:check
```

本次实际使用既有依赖目录的Jest/Playwright/CRA二进制与`NODE_PATH`，没有增加node_modules或更新依赖。配置保留workers=1、retries=0及原超时，临时副本集/端口/媒体目录每用例独立创建收尾。变异脚本归档已脱敏，复跑时需指向本机既有依赖路径；不直接编辑业务源码。

## 自查与边界

正式链路为真实Gateway、user、homework、resource和progress应用及临时Mongo副本集；上传、读图、发星和删除均真实执行。跨日只对既有生成服务注入日期，不是跨午夜timer；停止后的不变快照仅覆盖任务/媒体/账本等legacy集合，不包含计划/命令。整页退出重登用例验证原UUID持久恢复，不证明已销毁页面的React回调隔离，后者保留第三批组件证据。

独立发现的屏障P2已修复：完整execute结束后才恢复方法，主体失败不被收尾错误覆盖；合法正例和移除等待变异均覆盖。未削弱原断言、超时、权限、默认关闭或精确代次规则。无业务源码变更。

仍待用户最终集成批复审及验收；不提前关闭整体门禁。自动timer多周期为非阻断补测，真人/真机待验。保留历史失败、T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED和全部后置范围。不提交推送、不部署、不操作服务器、不调用模型、不更新真人入口。
