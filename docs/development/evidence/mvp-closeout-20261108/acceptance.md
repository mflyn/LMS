# MVP 局部修订及使用指引验收

日期：2026-11-08。依据本轮独立复审及用户随后明确批准。

**Batch:** ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY
**Reflection cross-entry P2:** CLOSED / USER_APPROVED
**Mistake review-date P2:** CLOSED / USER_APPROVED
**Guides:** ACCEPTED / USER_APPROVED
**Retained gates:** T4 OPEN / T8 OPEN / AI-1 OPEN
**Server timing:** SERVER_TIMING_UNVERIFIED
**Device:** DEVICE_PENDING
**Docker audit:** INCOMPLETE_FAILED
**Historical failures:** PRESERVED
**Nonblocking tests:** RETAINED
**Deferred scope:** REMAINDER_DEFERRED
**Real model / server / Git / deployment:** NOT_AUTHORIZED

## 验收范围与关闭依据

- 成长记录页与周反思复用现有未决写入标记，保存前再次检查；未知结果不跨入口重发。
  读取失败保留标记，须完整重读并明确人工核对；400/409/422只释放匹配的本次标记。
  当前身份403同步拒绝后续回调并清理私有视图；换账号/孩子后旧响应不回填或清除旧标记。
  缺失或非法记录ID不能作为成功回执。没有新增恢复协议。
- 错题编辑清空日期明确发送空字符串；新建未填仍省略。重新读取及刷新后保持为空。
  未掌握且无日期仍按既有规则提醒，不自动修改订正、复习、掌握状态或奖励。
- [快速开始](../../../user-guide/quick-start.md)、[家长指南](../../../user-guide/parent-guide.md)、
  [孩子指南](../../../user-guide/child-guide.md)已核对独立求助、所见版本审核、原审核重试、发星恢复和T7限定验收说明。
  本轮复审未发现新增可复现问题，未删除原测试、放宽业务断言或增加超时。

## 冻结与复验证据绑定

本地证据根为原始项目目录下的 `release-gate-artifacts/mvp-closeout-20261108/`，不是公开交付包。
原 `candidate-files.json` 的SHA-256为 `7e2eb4c34e3ca3a6e3c54d76c1ee3d2ecdfd6db8c27cd1112065f37f5fc87cad`。
10个候选文件及68个开发证据均已核验大小和摘要；两页面、反思服务、ReflectionPanel及会话服务
与归档构建的sourcemap内容一致。未重新生成或修改原冻结清单及其待审状态。

记录批准前，将10个候选文件原文保存至证据根 `frozen-source/<原仓库相对路径>`。
其中联合清单此后只追加§0.2，原§0.1及历史正文保留；其旧哈希以 frozen-source 核验，
不能要求追加批准后的当前文件仍等于旧哈希。其余9个实现、测试和指南文件没有因本次批准变更。

独立复审原件从临时目录原样归档至证据根 `independent-review/`，如下摘要只绑定原件，不包含私有路径正文：

| 文件 | SHA-256 |
| --- | --- |
| components.json | `d5be41b7f36e73fca426fc6ae7b8f7585b47e22464793f0f399220cfd0e55d98` |
| components-restored.json | `4db24e43b92b1fe3bbb974e5a33d30c466ae24490568619ee461b3bdacecee76` |
| mutation-cross-entry.json | `701bd6cfdc10b02542646c247ab615efc4022ba4d1f62df9c4096ebdd1a9dd76` |
| mutation-denied.json | `6ef9bc0a466109f9349be177918e6808be4dd6d20a447b0b4491e5e98dd990d3` |
| mutation-id-date.json | `5dc48f6225faa163afcdb462693a78520cfc1913625b232eb95e7bb5a7c7e601` |
| browser-review.log | `fb630cc20bb6b8c35a83e80dd2c57b1978b5052bcefdf22eb2d21e69e54fc343` |
| browser/.last-run.json | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |

## 分批结果与限制

| 上下文 | 证据结论 |
| --- | --- |
| 开发组件与完整前端 | 定向3套47项、完整72套1182项通过；定向是全量子集，不相加；本轮独立复审未重跑完整1182项 |
| 开发构建及独立HTTP套件 | 构建通过，旧Browserslist提示保留；HTTP两套13项通过，属于开发归档，不改称本轮独立13项实跑 |
| 开发浏览器 | 原10项及新增2项分批通过；保留10通过/2失败、11通过/1失败及最后新增2项通过，不写成一次12项全绿 |
| 独立组件复验 | 三套47项通过；在临时副本移除跨入口读取、403回调保护、合法ID检查及日期清空修复，4类变异触发5项预期失败；恢复候选后47项再次通过，不累计为94项 |
| 独立浏览器复验 | 两项新增用例通过，17.9秒；本机Chromium、正式应用工厂与真实HTTP、临时MongoDB和合成账号；失败注入不伪造成功响应 |
| 文档和静态检查 | 独立复审已执行六个JS文件ESLint、文档状态校验、三份指南七个相对链接及diff检查；本次关闭记录另做文档与哈希校验，不重跑业务 |

本次关闭记录校验：`npm run docs:family:check`、`git diff --check`通过；4份相关文档的367个相对链接目标存在，
原78项冻结内容、9个未变实现/测试/指南及7份复验原件哈希匹配，联合清单除新增§0.2外与冻结原文一致。

首轮沙箱MachPort失败（7失败/1中断/4未执行、退出130）、后续定位/创建状态误期望失败保留。
中断前丢失的临时日志仍只按对话事实说明，不补造归档。独立组件首次直接执行因缺少前端依赖链接
未启动测试，随后在临时源码副本复用已安装依赖；未安装、修改项目依赖或以该次失败计通过。
复审期间原候选、历史证据和项目文件未改，变异仅发生在临时副本；独立浏览器不等于WebKit或iPad。

本记录仅关闭两项局部P2及本批修订/指引验收，不关闭MVP整体、T4/T8/AI-1、服务器或真机门禁。
历史失败、Docker INCOMPLETE_FAILED、非阻断补测和所有后置范围继续保留；不恢复WP1底层开发，
不调用模型、不操作服务器、不提交推送或部署。原待审快照见[联合清单§0.1](../../t4-t8-joint-acceptance.md)。
