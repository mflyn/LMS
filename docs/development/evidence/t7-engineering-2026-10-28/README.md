# T7 合成工程交付候选

状态：工程候选提交复评；T7 总门禁 OPEN，未获用户验收关闭批准。T4 仍 IN_PROGRESS / OPEN。
2026-10-28 更新：用户已批准本候选七项 P2 为 CLOSED，见 [关闭记录](p2-closure.md)；
不等于 T7 工程总验收批准。原 candidate.patch/validation.json 保持原字节，本轮文档收口与
新复验证据使用 [追加索引](p2-closure-evidence.json)，不重新冻结或冒称旧文档哈希仍对应新记录。
服务端反馈覆盖 P2 已修复并经独立复验；下表为修订后结果，未变化的前端注明沿用证据。
修订前候选和计数保留于 pre-server-feedback-p2 及 Gate §27.5，最新结果见 Gate §27.7。
本候选仅本地合成；没有提交、推送、合并、真实部署、服务器或 NAS 操作。

## 实现与验收范围

- 孩子 Today 的本周反思入口、受保护页面、按周分页读取、选择既有记录修改反思或新建成长记录。
- 家长指定孩子/周次查看和真实代录；成长记录导航至对应周报，周报反馈保存和回看。
- 未知 POST/PATCH 的非正文保护标记、显式完整重读/人工核对；不自动重发、不承诺服务端幂等。
- 当前身份拒绝优先、换周/换账号/迟到响应隔离；家长反馈保存前后旧 GET 不得覆盖编辑结果。
- 两家庭、三孩子（两个一年级、一个四年级）、两共管家长：排序/估时、求助/处理、自检、图片完成、
  所见版本确认、错题、订正、到期复习、反思和周报的真实 HTTP/页面链路。
- 非零当前周统计、非零历史冻结、真实 actor、权限拒绝与奖励不变性；没有新增后端生产模型或 API。

## 已核实结果

| 验证 | 实际结果 | 证据类型 |
| --- | --- | --- |
| 前端最终全量 | 57 suites / 739 passed / 0 failed / 0 skipped | Jest JSON；此前 734 项快照另保留 |
| 家庭后端全量 | 153 suites / 4506 passed / 0 failed / 0 skipped | post-feedback-family.json |
| T2--T7 正式 HTTP | 6 suites / 35 passed / 0 failed / 0 skipped | post-expiry-http.json，含 T7 八项及真实 JWT 过期反例 |
| Task11 HTTP | 4 suites / 6 passed | Jest JSON |
| T2--T7 Chromium 全量 | 54 expected / 0 unexpected / 0 flaky / 0 skipped，294.128 秒 | post-feedback-checks/formal-browser.json；固定构建，无重试 |
| Task11 Chromium | 4 passed，17.3 秒，exit 0 | post-feedback-checks/task11-browser.log、commands.json |
| 前端构建 | exit 0，main.cc6bee40.js | 工具执行观察；固定构建 manifest 哈希见下 |
| 独立 HTTP 复验 | 最终 8 passed，10.924 秒，exit 0 | expired-http-independent 归档；此前六项及竞争八项证据保留 |
| 五项定向变异 | 五项均被目标断言杀死；每轮目标 1 failed / 5 非目标 skipped | 独立变异报告；非基础回归跳过 |
| 反馈竞争独立复验 | 模型 33 passed、HTTP 8 passed；F1/F2 在模型与 HTTP 两层均被业务断言杀死 | feedback-independent 归档，准确选择计数见 review 与 Gate §27.6 |
| 最终文档/状态 | docs:family:check、git diff --check、代码目录 ESLint exit 0；状态门禁 268 passed，21.216 秒 | final-revised-checks/commands.json、doc-gate.json；不是根 lint 全绿 |

前端 739 项和构建沿用最终前端源码未变的证据；修订后的后端、HTTP 和浏览器均实际重跑。
过期 JWT 补测位于既有权限用例内，不增加 test 数量；HTTP 最终 35 项在补测后执行。
浏览器不是该八个过期 HTTP 请求的执行证据，不能混写。

本机 Node v26.9.0，项目 engines 为 >=18；这不是 CI Node 22 或 Ubuntu 同限额执行证据。
正式服务为 Gateway、user、homework、resource、progress、analytics、notification，使用隔离临时 Mongo
副本集和私有文件；共享合成数据库，不宣称独立数据库部署验收。扫描 profile 为 trusted-local，不代表
ClamAV。组件测试允许 mock；正式链路仅故障注入代理拦截丢响应，不伪造业务成功。

## 命令与入口

```sh
npm run test:ci --prefix frontend/web -- --runInBand
npm run test:family-regression -- --json --outputFile=release-gate-artifacts/t7-engineering-2026-10-28/post-feedback-family.json
npm run test:t2:integration -- --json --outputFile=release-gate-artifacts/t7-engineering-2026-10-28/post-expiry-http.json
npm run test:family-flow:integration -- --json --outputFile=release-gate-artifacts/t7-engineering-2026-10-28/post-feedback-checks/task11-http.json
npm run build --prefix frontend/web
# T2_WEB_BUILD 指向已固定的合成构建目录，不在浏览器运行中重建
npm run test:t2:e2e -- --reporter=list,json
npm run test:family-flow:e2e -- --output=release-gate-artifacts/t7-engineering-2026-10-28/post-feedback-checks/task11-browser
npm run docs:family:check
git diff --check
```

全浏览器的 T2_WEB_BUILD 为临时固定构建 `lms-t7-build-qhlXvv`；asset-manifest.json SHA-256：
`0c9b88bdbf32da9bf75beb2bb53639c4064cfa3ac8b38884c38608ccb8e96556`。
固定构建 source map 中九个本轮前端实现文件与当前源码逐项相同，结果归档于 final-checks/build-source-match.json。
Jest 的 t2 glob 纳入 weeklyReflection.integration.test.js；Playwright t2 testDir 纳入两份 weekly spec；
原 release-family-gate.sh 的 07b/13b 阶段调用这两个入口，Task11 入口仍保留。

完整 release:family 的实际尝试和失败阶段另见本目录 review.md 与原始 release 日志。
独立缓存安装成功后停在 02-lint：既有归档 JSX 44 errors，exit 1；后续阶段未执行，Docker 未启动。
最终后端候选再次执行原脚本仍为同一结果，28.771 秒，保留于 release-final-candidate，不用旧结果代替。
不能将上表独立命令通过写成完整发布 Gate 通过，也不为 Git clean 检查擅自提交或清理工作区。

## 候选与证据

[candidate.patch](candidate.patch) 包含本次全部已跟踪和新增代码、测试及相关文档，排除本证据目录避免自引用。
[validation.json](validation.json) 记录基线、每文件哈希、完整补丁哈希和原始证据索引；基线 SHA 不是含未提交修改的候选身份。
原始 JSON、截图、失败上下文和独立变异输出按原字节保留于忽略目录
`release-gate-artifacts/t7-engineering-2026-10-28/`；不将原始测试账号、日志作为公开提交材料。
早期仅有工具输出而无文件日志的自测只能列为执行观察，不能后造原始日志。

## 需求证据映射

| 要求 | 当前直接证据 | 未被替代的责任 |
| --- | --- | --- |
| SL-01 作品/确认 | weeklyMathLoop 三孩子真实上传、查看、确认；既有 completion 全套同轮回归 | 真机、真实启用 |
| SL-02 求助 | 三孩子真实求助/共管处理；既有 help 竞争/拒绝/未知结果同轮回归 | 家庭使用效果 |
| SL-03 清单/分龄 | 三孩子实际重点项勾选与完成；既有 checklist 同轮回归 | T4 总门禁批准、真机 |
| SL-04 排序/估时 | 三孩子实际排序/估时；既有 dailyLearningPlan 同轮回归 | T5 两项非阻断补测不自动覆盖 |
| SL-05 来源/订正/复习 | 三孩子作品来源错题、订正、到期提醒；既有 learningSources 同轮回归 | 不把提醒作为已掌握 |
| SL-06 反思/复盘 | ReflectionPanel/Reports/Navigation/API/状态反例；weeklyReflection HTTP 八项与页面三项；周报竞争 15 项永久反例 | 用户验收、T9 价值验证 |

## 剩余验收条件

T7 用户验收/关闭批准、T4 总门禁批准及人工项仍未完成；SL-01--06 保留综合证据映射但不自动整体 COVERED。
DEVICE_PENDING：iPad Safari 横竖屏、触控、键盘输入、后台返回、刷新/重登、原未知写入核对和共管回看。
Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、所有历史失败保持。
高级恢复与新孤儿回收 REMAINDER_DEFERRED 且关闭；T8 部署/备份恢复、T9 家庭价值不属于本轮。
