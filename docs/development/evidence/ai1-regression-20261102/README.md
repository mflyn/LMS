# AI-1 等待外部依据期间的回归收尾

状态：REGRESSION_EVIDENCE_REVIEWED；ENGINEERING_SYNTHETIC_ACCEPTED保持，B/D/AI-1 OPEN。
用户授权等待官方回复时继续不依赖该回复的工作。本轮仅补回归证据，不修改业务、测试断言、依赖或已冻结候选。
候选沿用 `ai1-matrix-20261101` 及其依赖链；68项源码指纹在本轮前后核对一致。

## 实际执行

| 范围 | 命令 | 本轮结果 |
| --- | --- | --- |
| 原家庭后端八项目全量 | `npm run test:family-regression -- --json --outputFile=<private-report>` | exit0；168套件通过，5135项通过，0失败，1项既有条件跳过；Jest 828.388秒 |
| 部署契约补验 | `node <existing-jest> --config=backend/jest.family-common.config.js --runInBand --coverage=false --runTestsByPath backend/common/deployment/__tests__/task5Deployment.test.js --json --outputFile=<private-report>` | exit0；1套件18项通过，0跳过；0.452秒 |
| DeepTutor原根夹具入口 | `python -B -m pytest -p no:cacheprovider tests/services/ai1/test_operation_store.py -q --junitxml=<private-report>` | exit0；16项通过，1 warning；1.55秒；未使用confcutdir或noconftest |
| 全仓ESLint | `node <existing-eslint> .` | exit0；无诊断输出 |

家庭全量使用现有Node22.15.0、ARM Git2.55.0和临时Mongo7.0.14，禁止Mongo运行时下载。
历史两失败 `releaseBuildInput` / `checkGitClean` 在本次全量内均通过，未修改断言。
本轮PATH未包含已有kubectl所在目录，导致原条件分支跳过 `TC-T5-DEPLOY-002 Secret dry-run`。
核实已有kubectl v1.34.1后，以临时HOME、修正PATH执行整个部署契约套件；没有安装工具或访问集群。
原全量中的1项跳过保留；不能把补验结果相加成一次5136项全通过的全量结果。

DeepTutor后续阶段已补齐core/server依赖，本轮未安装任何依赖；加载原根夹具时未再出现历史markdown_it错误。
只证明当前16项持久层用例的根入口兼容性，不证明DeepTutor整仓通过。使用新临时HOME及DEEPTUTOR_HOME，
白名单环境不继承模型凭据；用例操作临时SQLite，没有Provider发送路径。warning原样保留。

## 证据准确性与收尾

`verification.json`绑定本轮原始日志/JSON/XML及一次性执行脚本hash；原始记录仅存既有本地私有目录。
原家庭启动记录的 `providerCalls: 0` 是预设范围声明，不是实测计数；独立复核指出后，本记录明确更正含义，
不覆盖原始记录，也不以该字段证明网络硬阻断。执行未传入父环境模型凭据；家庭测试保留原HOME和既有测试配置，
不能扩大表述为文件级凭据隔离。范围为已有合成回归路径，不包含真实模型验收。
一次性汇总脚本将包含pending用例的文件列入 `failures` 数组；这是非passed行列表，非业务失败数。
准确判定以Jest报告的0失败、1 pending及逐用例状态为准；两个JSON均保留。

临时根node_modules链接已移除；本轮已知npm/Jest进程ID退出已核验，不据此宣称审计了全机所有后代或未知资源。
未修改68项产品/测试指纹，未重建或覆盖既有candidate.patch。此次只追加验证证据，无新的产品补丁。
独立只读复核确认12份原始文件、3份执行脚本hash及当前68项源码指纹一致；逐用例JSON、JUnit和日志计数吻合，未发现新P1/P2。
两处证据措辞已更正；独立审查没有重跑测试。已知进程退出仍为主执行线程核验，独立ps受沙箱限制；ESLint未作独立重验。
文档状态及diff检查通过，3份变更Markdown的相对文件链接有效；更新后AI-1矩阵定向测试2项通过、311项未选，不冒称重新执行313项。

## 保留边界

历史家庭161/2套件、4980/2用例及DeepTutor根夹具14项setup error保留，不改写旧快照。
完整输入计数资格、发送前价格复核、本轮费用授权及人工价值验收仍待完成；官方问询不等于费用上界认可。
AI-0人工审核限制、T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING和高级恢复/新回收REMAINDER_DEFERRED保持。
没有模型调用、依赖安装、服务器操作、Git提交推送合并或部署；不关闭B/D/AI-1总门禁。
