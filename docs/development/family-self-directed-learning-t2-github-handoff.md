# T2 GitHub 提交核查

**Scope:** ENGINEERING_SYNTHETIC_ONLY；T2 APPROVED / CLOSED。
**Git authorization:** 2026-10-24 用户授权整理提交范围、核查敏感信息与证据、提交并推送专用分支、创建PR；不合并、不部署。
**Retained:** D2B-05 FAILED / REMAINDER_DEFERRED；DEVICE_PENDING；T8_PENDING / NOT_AUTHORIZED。

## 提交范围

基底 `79b346155abf4fefd2afdabe12c7e5a87db1448e`；专用分支 `codex/t2-synthetic-acceptance`。
本地既有变更是T1/T2累计工作，不仅是上一轮关闭文档；按以下逻辑分组保存，最终分支整体为验证对象：

1. 后端事务协议、版本确认/发星、上传/删除保护、恢复接口、运行预检与测试，以及默认关闭配置和运行依赖。
2. 孩子提交/修改/回看、家长按所见版本审核、命令恢复及会话隔离、组件与正式HTTP/浏览器验收。
3. 设计/执行/门禁/追踪/指南、状态校验、脱敏证据索引和本次提交核查。

高级恢复和新回收的已有代码/测试保留，避免破坏现有依赖和历史成果；未完成范围仍后置，不把“已提交”写成“已验收/已启用”。
排除 `.playwright-mcp/` 两张本地合成截图、原始 `release-gate-artifacts/`、运行数据、node_modules、日志、真实.env/密钥及构建产物，不删除这些本地文件。

## 证据可移植性

上传前确认6处Markdown链接指向被忽略的本地归档。原有测试只禁止读取归档，没有模拟目录缺失。
将永久测试增强为同时模拟归档文件/目录不存在，先复现失败，再将6处链接改指[可入库脱敏索引](evidence/t2-synthetic-2026-10-24/README.md)。
不豁免或放宽本地链接检查。已从暂存区导出干净副本，不含 `release-gate-artifacts/`；文档校验通过。
增强反例在修订链接前失败、修订后通过；全部59项文档测试及41套件662项公共模块测试通过。
可携带摘要覆盖37份历史Jest报告及148份原始归档哈希，原报告未修改。
其中历史 `t2-engineering-closure-2026-10-24/build/manifest.json` 为空白、不能解析；只保留哈希并列入 unreadableJson，不用它证明构建通过。本轮已重新实际构建并通过。

## 本轮提交前验证

Node22.23.3，源码与已批准基线一致；本轮只修改提交说明、索引、根README进度和忽略归档的测试保护，没有修改产品逻辑。

| 验证 | 结果 |
| --- | --- |
| 文档门禁 Jest 套件 | 59通过，exit0；无本地归档正例先红后绿 |
| `npx jest --config=backend/jest.family-common.config.js --runInBand --coverage=false` | 41套件662项通过，exit0 |
| `npm run test:ci --prefix frontend/web -- --runInBand` | 40套件490项通过，exit0 |
| `BUILD_PATH=/tmp/lms-t2-github-build npm run build --prefix frontend/web` | Compiled successfully，exit0 |
| `npm run test:t2:integration` | 正式应用工厂及真实HTTP，2套件14项通过，exit0；全部合成数据 |
| `T2_WEB_BUILD=/tmp/lms-t2-github-build npx playwright test --config=playwright.t2.config.js --reporter=list,json` | 授权环境14项通过，0重试；不是iPad真机 |
| 两份Compose的 `config -q` | 使用显式合成环境变量和 `/dev/null` 环境文件，通过；不启动真实服务 |
| 干净暂存区导出的 `docs:family:check` | 无本地证据目录，仍通过 |
| 干净检出的 `npm run lint` | **FAILED：53 errors / 0 warnings，21个文件**，未豁免 |

原工作区lint还扫描到被忽略的历史JS快照，共57项错误；干净副本排除快照后仍有53项。
规则为 no-unexpected-multiline、no-unused-vars、require-yield；详单随提交前验证摘要保存。
这些是新发现的PR/CI待处理项，本次归档不顺带批量修改代码，也不删除/放宽规则，不能写成CI已绿或可合并。

浏览器首轮14项失败均为页面执行前 Chromium MachPort `Permission denied (1100)`；调整为经授权的合成执行环境后14项通过，未改测试、页面代码或重试次数。首轮报告哈希和原因保留，不将其冒称通过。
最新业务全量沿用原143套件/3943项报告，仍为3942通过/1失败（D2B-05，exit1）；本轮未重跑全量，不与上述专项计数混算。

## 敏感信息核查

待提交内容不含原始.env、私钥/数据库文件、二进制媒体、运行日志或构建产物；两张合成截图保留在本地忽略目录。
结构和字符串检查发现的模板值、随机生成测试令牌、合成登录密码及非法URL反例均核实为非真实凭据。
Gitleaks 8.30.1 官方发行包经SHA-256校验，使用默认规则扫描完整待提交文件并100%隐藏命中值；原扫描exit1、8条命中，未关闭规则或添加测试目录豁免。
逐条核实为测试专用签名字符串、临时合成账号密码或非秘密UUID存储键，无未解决的真实凭据命中。不能把静态扫描等同于完整安全审计，也不能把原扫描结果改成“零命中”。
可核查的命令/结果、53条lint明细和8条脱敏命中归类见[提交前验证摘要](evidence/t2-synthetic-2026-10-24/github-preflight.json)。

## PR 交付边界

采用草稿PR提交累计成果，不设置自动合并。当前新增提交前验证不替代用户此前的限定范围验收，也不赋予发布资格。
合并前至少处理干净检出的53项lint错误，并核对远端CI实际结果；D2B-05仍按已批准MVP范围后置保留，不可用忽略断言来把全量改绿。
本轮未改业务源码、默认开关或CI规则，未访问真实孩子/NAS，不执行真实cleanup/restore，不部署。

## 授权与撤回

CI的测试在PR上自动运行；镜像发布/部署需要workflow_dispatch及显式输入。本次不触发手动工作流，不设置自动合并。
`main` 保持原提交；需要撤回时可关闭PR或在专用分支追加纠正提交，不强推、不重置工作区，不操作真实数据。
旧验收批准记录里的“不提交Git”是当时边界，此次明确授权只增加分支提交/推送/PR，不改变验收范围和其他禁止事项。

## PR #27 lint 修订（2026-10-24）

用户追加授权：修复53项lint错误，核对相关CI，验证后提交/推送当前分支；仍不合并、不部署。
[首次CI](https://github.com/mflyn/LMS/actions/runs/40093526966)在 `02-lint` 失败，后续回归尚未执行，不是测试已通过。
修复29处参数化测试调用换行、23处刻意剔除字段的未使用绑定，以及1处无yield的异常游标替身。
字段剔除仍保留在对象解构中，只使用既有规则允许的显式未使用绑定名；异常游标改为在异步 `next()` 抛出同一错误，保留关闭及脱敏断言。
不修改ESLint配置、CI工作流、测试集合、断言或超时，不增加跳过/重试。AST比较确认其余20个文件除绑定名/格式外不变。

干净副本从Git跟踪文件的当前内容导出，不包含本地忽略的历史证据；其中 `npm run lint` 和 `npm run docs:family:check` 均exit0。
原工作区的 `npm run lint` 仍会扫描历史证据快照，产生4项JSX解析错误；这些文件不在PR中。未删除快照，也未增加忽略规则来隐藏错误。
前文及 `github-preflight.json` 保留首次53项错误与历史验证，不回写成通过。本次后续验证另行记录。

本次 `npm run test:family-regression -- --json --outputFile=/tmp/t2-pr27-family.json`：143套件、3951项通过，0失败/0待执行，exit0（773.694秒）。
相比历史3943项，多出的8项均为此前已提交的文档关闭边界校验（该套件51→59）；本次lint修复未增删测试或断言。
D2B-05本轮未复现，但没有修改其源码/断言，不能据此关闭稳定性问题或高级恢复范围；原143套件/3943项中1项失败的报告仍保留。
148份历史归档逐一核对SHA-256一致；本次增量Gitleaks扫描exit0、零命中。
命令、计数、差异来源及本次原始文件哈希见[PR #27 lint修订证据](evidence/t2-synthetic-2026-10-24/pr27-lint-fix.json)。
这只证明本次本地运行结果，不代表累计验收全绿，也不替代推送后的CI结果；DEVICE_PENDING、REMAINDER_DEFERRED与不合并/不部署边界不变。
