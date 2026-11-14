# T2 合成夹具家庭日期修复

日期：2026-11-15。范围仅为合成任务夹具、永久日期反例和本索引；不是产品日期逻辑、导航、发布或总门禁修改。

## 原失败与原因

PR #49 已合并至 `a1cf74f3d593275690ad805b0e42d164d2603b25`。
[合并后 CI 43614031778](https://github.com/mflyn/LMS/actions/runs/43614031778) 失败，13b 原浏览器矩阵为 94 通过、3 失败，不能改写为全绿。
失败是孩子 pending/completed 导航和来源作品回看在“今天的任务”中找不到夹具任务。夹具以 UTC 截取到期日，而两个合成家庭及业务查询使用 `Asia/Shanghai`；UTC 16:00 后夹具日期比家庭日期早一天。合并树与原 PR 头部树相同，不将时间边界问题误称为合并冲突。

最小修复复用 `familyDate.formatLocalDate`，家庭创建和任务日期共用同一显式时区。未更改页面、权限、API、导航定位、document identity 断言、原超时或重试。

## 分批验证

| 批次 | 结果及边界 |
| --- | --- |
| 修复前永久反例 | 2 通过、4 失败；四项均为 UTC 日期落后家庭日期。保留 RED，不将预期红灯改为通过。 |
| 修复后夹具测试 | 默认时区 6/6；另一次 `TZ=UTC` 6/6。固定时间覆盖跨日之前、跨日之后、跨年和闰日，逐项核对两个家庭、三个孩子及 seed 复用。HTTP 为替身，不冒充正式接口验收。 |
| 独立复核 | 未发现问题，独立 `--no-cache` 运行六项通过；复核实际差异和 RED/GREEN。独立复核未重跑浏览器实例。 |
| 开发 Chromium | `childEntry.spec.js`、`functionalBoundaries.spec.js`、`learningSources.spec.js`，16/16，通过原失败的全部三项。 |
| 开发 WebKit | 相同三个文件，另批 16/16。不是 iPad 或真人验收。 |
| 静态检查 | 两个 JS 文件 ESLint、`git diff --check`、现有文档状态校验通过。 |

浏览器使用新建本机源码副本、临时数据库／存储、正式应用与真实 HTTP；只在故障用例中按原 spec 注入丢响应等故障。两引擎串行，零 skip/retry，原 worker 1、test 120000ms、expect 10000ms、action 15000ms 不变。
业务前端源码未修改，复用原已验证构建，index SHA-256 为 `61080bc6924f3e3da942732a023d3093cacc036e412fedefe5dce8f3e246e6ac`，不称为本轮新构建。未更新或连接真人测试入口。新测试被既有 `test:t2:integration` 的 `*.integration.test.js` 匹配，进入原 release 07b；CI 全量结果需按新交付 SHA 另查。

可复现命令（使用现有依赖，浏览器需设置独立 TMPDIR、T2_WEB_BUILD 和输出目录）：

```sh
npm run test:t2:integration -- --runTestsByPath backend/tests/t2/syntheticSeed.integration.test.js
TZ=UTC npm run test:t2:integration -- --runTestsByPath backend/tests/t2/syntheticSeed.integration.test.js
npx playwright test --config=playwright.t2.config.js --browser=chromium functionalBoundaries.spec.js learningSources.spec.js childEntry.spec.js
npx playwright test --config=playwright.t2.config.js --browser=webkit functionalBoundaries.spec.js learningSources.spec.js childEntry.spec.js
npx eslint backend/tests/t2/syntheticSeed.js backend/tests/t2/syntheticSeed.integration.test.js
npm run docs:family:check
git diff --check
```

## 冻结与交付范围

基底为上述 main SHA。私有归档 `t2-seed-date-20261115-r1` 保存原 CI 失败摘要／13b 日志、RED/GREEN、两引擎日志与 JSON、候选、补丁和独立复核回执摘要；公开只交本索引，不交原始输出或本机路径。

| 对象 | SHA-256 |
| --- | --- |
| 13 文件 manifest（不含自身） | `266f0c149ae0b406c07482270b0173042ccbbdef236814bb1615a680035af717` |
| 两文件候选补丁 | `3825a91260da509c973ae8d8184937641b9f993d43010a0509a4ffd1998c80be` |
| `syntheticSeed.js` | `a5fda9b9235e3e93ed2fb6def11d09b9fcdb117122b769b710afd28fbf75d8a5` |
| `syntheticSeed.integration.test.js` | `88a1d79953fa1d2792206a794218d17820d88e9dffdd341ce4922d701146373b` |

交付限定上述两个测试相关文件和本索引，不带入 PR #50、WP1/T8 执行器或其他增量。候选补丁不包含本索引，旧冻结证据、历史失败和快照不改写。后续是否合并以及 main 是否恢复通过必须按实际 PR、SHA 和 CI 单独确认；#50 仍待 main 修复后再转向，不提前合并。

T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、MANUAL_PENDING/DEVICE_PENDING、Docker INCOMPLETE_FAILED、非阻断补测和 REMAINDER_DEFERRED 保持。本轮不调用模型、不操作服务器、不部署、不删除分支。
