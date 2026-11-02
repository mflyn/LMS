# AI-1 DeepTutor 本地持久层候选

用户批准基线：DeepTutor v1.7.1，`f7aed0744c36c5afef16a4261c31ebee1208cac2`。
LMS 既有 B/C/D 冻结包不变。本目录只绑定本次 DeepTutor 两文件持久层候选，不冒充完整 AI-1 或远端服务交付。
`candidate.patch` 可在该 DeepTutor 基线上应用；`manifest.json` 绑定源码/测试及本次 LMS 状态文档，
`verification.json` 分列作者、独立、预期变异失败和环境失败，原始日志只在本机保留。

## 已验证

SQLite 完整请求快照、同 key 重放与冲突、事务单次 owner claim、终态 CAS、只读访问和直接父目录权限复检。
真实子进程提交 claim 后退出及提交成功后丢确认均不重新取得发送权；并发16请求只有一个claim胜出。
等待事务锁后检查截止点；策略异常回滚；两个终态竞争只有一个生效，后续重放不覆盖首次状态。

原8项模块缺失红灯保留。目录运行时复检补测先出现 DID NOT RAISE，最小修订后最终作者15项通过（0.18秒），
独立15项通过（0.24秒），退出0；独立前后源码/测试hash相同。三项作者变异各预期1项失败、退出1，
分别证明sending不可重新claim、owner CAS和终态不可覆盖，不能记作独立变异结果。

## 未验证与失败

普通pytest根入口在应用公共夹具阶段缺少markdown_it：归档运行14项setup error、退出1，无业务断言执行。
纯存储定向使用 `--confcutdir=tests/services/ai1`，不加载应用夹具，不能代替正式应用测试或完整回归。
pytest报告asyncio_default_fixture_loop_scope配置warning；没有修改原规则或安装依赖来掩盖这些情况。
早期fixture保留名收集错误与文档命令漏设NODE_PATH缺dotenv均属执行准备错误，不计入功能红绿。

此模块尚未挂载路由，不运行Provider。输入JCS/闭合契约、输出hash/usage、profile/时钟、服务凭据、
默认关闭/连续性准入、Provider实际发送及真实LMS联调是后续工作；本层只接受已验证对象。
本次证明普通进程退出，不是掉电、文件系统全面安全或旧备份连续性证明。不得以数据库可打开替代恢复隔离。

B/D/AI-1总门禁OPEN；无服务器、真实模型调用、Git提交推送合并或部署。
保留AI-0人工审核、历史家庭161/2套件4980/2用例全量失败、T4/T8 OPEN、T9 NOT_STARTED、
DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING和高级恢复/新回收REMAINDER_DEFERRED。
