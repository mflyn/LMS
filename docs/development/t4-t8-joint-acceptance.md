# T4 / T8 联合验收清单：MVP 交付摘录

> **交付范围说明（2026-11-08）：** 本文件只公开本轮 MVP 优先级、局部修订与批准记录。
> 原本地联合清单的完整 T8/WP1 方案、执行器候选和历史演练章节继续留存在原工作区及冻结归档，
> 未随本 PR 提交；本摘录不等于原整份文档，也不沿用其文件哈希。§0.1、§0.2按原文保留。
> 用户最新授权仅为专用分支提交、推送、Draft PR及CI；下方旧“不提交推送”为历史权限快照。
> 详见[本次公开交付](evidence/mvp-closeout-20261108/public-delivery.md)。

## 0. MVP 优先与后置范围（2026-11-08）

产品主线是任务、自检与独立求助、作品提交、家长按所见版本审核、孩子回看、
错题订正复习和周复盘。复用已交付功能，只修当前闭环的实际缺陷，不新增产品或工具平台。

| 分类 | 当前安排与边界 |
| --- | --- |
| 本批已验收 | 两项局部P2及三份使用指引，限定本地合成验证；批准和分批证据见下文 |
| 必要安全与可靠性 | 家庭/孩子隔离、私有媒体、原命令、审核版本、重复发星及正常隐私删除保护继续保留；不绕过启动预检 |
| 工具后置 | WP1/T8未完成的可信启动、claim/代次、原生监督、持续停止及运输装配继续REMAINDER_DEFERRED / NOT_COMPLETE，不阻塞MVP产品开发；已有源码、测试和证据保留，不授权运行 |
| 真实启用待验 | 真机/真人、独立服务恢复/重启与回滚、备份目标及RPO/RTO仍待验；NAS暂缺不表示完整备份通过，不开始T9 |
| 其他后置 | 高级删除恢复、新孤儿回收、通用恢复/自动清理不扩展；AI真实发送不授权，AI-1默认关闭及QUALIFIED_COUNTER_PENDING保持 |

T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
历史失败、非阻断补测及REMAINDER_DEFERRED均保持。本批不调用模型、不操作服务器、不合并或部署。
删除证据不足仍阻止相应恢复副本开放，不能因高级恢复后置而恢复已删除内容。
原始失败、完整联合清单和未提交执行器增量不删除、不覆盖，不重新归类为完成。

### 0.1 MVP 两项局部修订（2026-11-08，本地待验收）

状态：LOCAL_VERIFIED / USER_REVIEW_PENDING。本段记录产品修订，不关闭T4/T8/AI-1或服务器、真机门禁。

- 成长记录与周反思复用已有写入标记。结果未知时两个入口均不能再次写入，
  只能进入既有周复盘完整重读及人工核对；明确拒绝只释放本次标记，不新增恢复协议。
  会话/孩子切换、同身份403和迟到成功不能清除旧标记；缺少合法记录ID的回执不能计保存成功。
- 错题编辑清空复习日期时显式发送空值；新建未填仍省略。未掌握且无日期的既有提醒规则不变，
  不将清空日期解释为禁用提醒，也不自动修改订正、复习或掌握状态。
- 校正三份用户指南的独立求助、按所见版本审核、原确认重试/发星恢复入口及T7限定验收摘要。

验证复用现有入口，不增加测试框架：

| 本轮执行 | 结果与证据文件名 |
| --- | --- |
| 定向组件：GrowthLogsReflection、ReflectionPanel、Task9LogsMistakes | 3套47项通过；components-resume.log |
| `npm test --prefix frontend/web -- --runInBand` | 72套1182项通过；frontend-full.log；前项为其子集，不相加 |
| `npm run build --prefix frontend/web` | 通过；build-resume.log；保留既有Browserslist数据库过期提示，未更新依赖 |
| `npm run test:t2:integration -- --runTestsByPath backend/tests/t2/learningSources.integration.test.js backend/tests/t2/weeklyReflection.integration.test.js` | 2套13项通过；formal-http.log |
| `npm run test:t2:e2e -- weeklyMathLoop.spec.js weeklyReflection.spec.js learningSources.spec.js`及新增两项定向复验 | 原有10项、新增2项分批通过；browser-controlled.log、browser-final.log、browser-focused.log；不称为一次12项全绿 |
| 受影响6个JS文件ESLint、三份指南7个相对链接、`git diff --check` | 通过；文档状态校验沿用`npm run docs:family:check` |

原始日志及浏览器截图位于本机证据根的`mvp-closeout-20261108/`，不作为公开交付包；
`candidate-files.json`记录本批文件与日志SHA-256。组件使用API替身；HTTP/浏览器使用正式应用工厂、
真实Gateway与六项业务服务HTTP、临时MongoDB副本集及合成媒体，完成协议enabled，AI及新回收关闭。
浏览器故障注入只中断请求/响应，不以mock成功响应替代服务；Chromium和模拟视口不等于WebKit或iPad真机。

失败保留：中断前的临时日志因执行环境重置丢失，红灯与当时通过数量仅保留于对话，不充当最终归档证据。
恢复后的沙箱浏览器因MachPort拒绝启动，7项失败、1项中断、4项未执行，退出130（browser.log）；
受控本机首轮10通过/2失败（browser-controlled.log），分别为新增用例误期望创建200和刷新后未重开详情；
修正后11通过/1失败（browser-final.log），剩余为带值textarea的label精确定位问题。
最终仅将定位改为明确对话框内的textbox角色后，两项专项通过；未放宽原业务断言、超时或跳过原测试。
独立复评为源码审查和内存诊断，并核对47项日志，不冒充独立浏览器实跑；自查修正的无效ID回执及403迟到响应均有永久反例。

本轮未改后端业务、执行器、部署默认配置或历史证据；未调用模型、操作Ubuntu/NAS、提交推送或部署。
SERVER_TIMING_UNVERIFIED、T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
历史失败、非阻断补测及REMAINDER_DEFERRED均保持。下一步是本批复审与用户验收，不自动启动真机或服务器演练。

### 0.2 MVP 局部批次验收与两项 P2 关闭（2026-11-08）

用户复审通过并明确批准本批 MVP 修订及使用指引验收。当前状态为
ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY；反思跨入口未知写入保护、错题复习日期清空
两项 P2 为 CLOSED / USER_APPROVED。冻结身份、复验和关闭依据见[评审记录](evidence/mvp-closeout-20261108/acceptance.md)。

§0.1 的 LOCAL_VERIFIED / USER_REVIEW_PENDING 及当时下一步描述保留为批准前快照。
原清单的10份源码/文档已按原哈希保存至本地 frozen-source，68份开发证据和原清单不覆盖；
本轮47项组件、4类变异触发5项预期失败、恢复后47项及2项真实HTTP浏览器复验另行绑定，
不重复累计，不将开发分批结果或本次局部验收改写为一次全量通过。

本次只关闭上述局部问题，不关闭MVP整体、T4/T8/AI-1或服务器/真机门禁。
SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、
非阻断补测和REMAINDER_DEFERRED均保持；WP1不恢复开发。不调用模型、不操作服务器、不提交推送或部署。

### 0.3 任务列表分页与回看局部验收（2026-11-08）

本批在main `01a61c63` 合成走查后修订创建成功的服务端分页刷新，复审发现的筛选外/页外任务回看混入列表P2已修复。
详情回调只更新列表已有行；创建后读取服务端总数，当前行完成/确认状态继续更新，查看详情不额外读取列表或重复创建。
用户在复审通过后批准执行收口：批次 ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY，P2 CLOSED / USER_APPROVED。
完整三文件候选、原失败及本轮97项组件/4项浏览器复验证据见[关闭记录](evidence/mvp-task-list-20261108/acceptance.md)。
开发97项/8项、复审97项/4项分开记录，不相加、不宣称一次全量通过；原§0.1/§0.2及原冻结档案不覆盖。

本次专用分支、Draft PR及CI获授权；合并、模型调用、服务器和部署仍未授权。
未带入WP1/T8执行器增量，不关闭MVP整体或T4/T8/AI-1；SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、
Docker INCOMPLETE_FAILED、历史失败、非阻断补测、QUALIFIED_COUNTER_PENDING及REMAINDER_DEFERRED保持。
