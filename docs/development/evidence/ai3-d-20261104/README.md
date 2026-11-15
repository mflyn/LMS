# AI3-D 受限远端 operation 与生成候选

**Status:** IMPLEMENTED / USER_REVIEW_PENDING
**AI3-C:** ACCEPTED / USER_APPROVED
**AI-3:** OPEN

## 范围

接续[C批原冻结](../ai3-c-20261104/README.md)，仅本机合成库、远端受限HTTP协议与Provider替身。
LMS保存profile绑定的完整请求摘要/独立远端UUID；首次持久claim后至多一次PUT，显式恢复只GET同一映射。
查询未知、not-found或过期不退款、不重新发送。远端已claim证据单独持久化，矛盾未发送退款拒绝并暂停费用账户。
可信终态在同一事务结算、精确释放发送槽、生成未发布Content、结束原命令与更新Round。
已收费但Content结构非法记失败，保留受控原响应；没有usage继续保留未知费用，不虚构成本。
祖先撤回后允许查询与结算原调用，候选不自动发布；发布仍走原人工审核与祖先检查。

未装配AI3公共路由、不启用真实Provider、不开发孩子提交/审核/效果/页面。本地无operation port时recover仍只返回未决状态，
不能将其当作远端恢复成功。双仓缺任一协议支持都不能启用。真实计数资格仍待验。

## 执行和回退边界

先登记C批准，再实现闭合AI3 wire profile、持久映射与结果结算；复用AI1共享账本，不新增预算体系或后台恢复框架。
修改前保留当前未提交文件快照，T8及其他既有修改不覆盖；原C补丁、验证与历史失败不重写。
本地仅临时Mongo/SQLite与合成输入；未来一旦写入本批记录不能回退为不识别该映射的二进制或手动清空费用。
当前可通过撤回本批增量回退代码；没有真实数据迁移、安装或部署。

## 开发过程证据

首轮新增远端编排8例失败、1例通过（尚无runGeneration），保留原红灯。
初次实现54通过/1失败：旧无transport的C恢复原本只读；保留该兼容入口，已接入port才执行远端GET，不放宽原断言。
自查P2：终态结果引用仍指预留版本、持久摘要缺失仍会出站；两例先红后修复。
自查P2：并发旧accepted响应迟到会误停预算；永久屏障例先红，修复为旧非终态不倒退，矛盾failed_not_sent仍拒绝。
定向、全量、变异与独立复评将分别记录，不互相替代。

独立复评P2：6001字符的3000层数组在递归clean时溢出，导致有usage的非法输出长期占槽；永久例先红，
修复为递归前验证闭合类型/字段/最多三题结构，再沿用原规范化和完整内容校验。
复评继续发现长度语义P2：若前置即执行maxLength，会拒绝CRLF规范化后合法的500/1000字符边界；
永久例先红后修复，原始响应保持审计，保存的Content采用与人工修订一致的CRLF→LF语义。
两处修复不笼统吞异常、不放宽长度、费用或原断言；深度拒绝和CRLF成功分别有移除/回退变异。

## 两端实现与验证边界

LMS六个源码/测试文件与API/测试进度为本批增量；C批准/门禁记录单独归档。DeepTutor仅十二文件增量，
包括四个AI1共享文件的封闭适配、三AI3模块及五个测试/夹具/golden；AI1 Provider/runtime未改。
远端新工厂不接入公开应用，默认off，无AI3默认Provider、密钥或配置回退，旧AI1 Provider不具AI3发送资格。
同一SQLite journal跨profile UUID拒绝，锁内摘要/报价/截止点校验；旧accepted的AI3 PUT重放不补发，GET只读。

开发DeepTutor 242项 = 170旧AI1 + 66AI3 + 6显式跨语言HTTP。另单跑66项及6项，不能相加冒充新增覆盖。
跨语言6项调用LMS真实client、Node buildRequest、Python真实HTTP工厂/service/SQLite，重启Python后query-only恢复，
Provider及其用量是合成替身；这不是LMS公共路由、Mongo结算和Python同时运行的完整链路，也不是浏览器或模型验收。
开发该6项使用Node26，独立复验另使用Node22核验；独立结果须以本轮原始记录为准。
请求golden hash为`2856039624ffc5127ce782bbcc43d2b076bb13ad4ae1fa7238667a52b81e5fb4`。

LMS开发定向最新3套104项通过（16.786秒），包括当前CRLF修订；完整homework旧一轮53套1844项通过（297.203秒）
发生于最终CRLF修订前，不绑定最终冻结全量。首次沙箱全量EPERM写日志失败后中止（退出130），完整原日志保留。
不改权限规则或产品断言，仅用已批准的本地测试执行上下文重跑。最终全量与独立结果待下节绑定。

## 最终独立复评

独立复评两项P2（深度输出、CRLF长度语义）状态FIXED_AND_INDEPENDENTLY_REVIEWED，随本批待用户批准，不提前写CLOSED。
最终独立LMS两套86项通过（14.834秒），DeepTutor常规236项通过（14.83秒）及单独跨HTTP六项通过（8.29秒）。
独立两端均使用Node22；Python3.13。首次目录+文件调用只收集236，六项明确补跑，不把预期数量当已执行。
独立未重跑完整homework，也未重跑开发变异；通过静态与补充边界探针确认无剩余P1/P2。
独立源码检查LMS8项、DeepTutor23项一致，远端冻结12项匹配；之后仅API历史状态说明与证据文档变动，六JS源码不变。

开发变异共六处：移除映射前检、允许矛盾退款、移除实际结果引用、回退迟到accepted保护、移除有界结构前检、回退为规范化前长度校验。
每处目标反例均实际失败；深度变异同时保留另外三条非法输出通过。未选择测试不当成删除/跳过原测试。
变异只生成临时模块，不覆盖生产源码；原A的23条测试正文与C冻结逐字节一致。

## 冻结交付与最终验证

[候选清单](candidate.json)、[LMS八文件增量](candidate.patch)、[C批准与门禁增量](approval-records.patch)、
[DeepTutor十二文件增量](deeptutor.patch)及[原始日志哈希与结果](verification.json)分开归档。
LMS补丁SHA256 `8d59ea59bc5d6b3f5c1d37b2ccdaab2c82ba8c2cf6bc0c19603dc2223289f05e`，
远端补丁SHA256 `685075d998702babacf9e68b038ec39dfbcde4aefc80a9007c9cecf35f4b22cf`。
LMS以前三批冻结为前置；DeepTutor基准为已合并AI1的`a5e64ca49667ddba2a0ba80c02ac1c59959dc2f9`，不是旧AI-0运行环境。
不改原冻结快照。三份补丁反向校验、LMS临时目录八文件重建/哈希一致，45项原有非本批文件及符号链接保持。
这不是完整双仓干净检出运行，也不是提交/PR交付。

最终开发完整homework：**53 suites / 1845 tests passed，257.197秒，退出0**，六个JS源码/测试运行前后哈希一致。
原Jest配置及既有五项legacy排除未改；这不是全家庭后端或完整release。独立86项与此开发全量不可相加。
六JS ESLint、docs:family:check及两仓diff check通过；Mongo弃用与Python既有警告保留，不声称零警告。

复验命令（使用现有Node22、Python环境、依赖和合成夹具，不安装、不读取真实配置）：

```sh
NODE_PATH=/path/to/existing/node_modules MONGOMS_RUNTIME_DOWNLOAD=false node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand
NODE_PATH=/path/to/existing/node_modules MONGOMS_RUNTIME_DOWNLOAD=false node node_modules/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/ai3Service.test.js backend/services/homework-service/__tests__/services/ai3Operation.test.js
npm run docs:family:check
git diff --check
# 在DeepTutor目录；HOME/DEEPTUTOR_HOME指向临时私有目录，Python为已有测试环境。
python -B -m pytest -p no:cacheprovider tests/services/ai1 tests/services/ai3 -q
# 显式跨语言六项，不依赖默认发现；AI3_NODE指定Node22，AI3_NODE_PATH指定已有依赖目录。
AI3_LMS_ROOT=/path/to/LMS AI3_NODE=/path/to/node22 AI3_NODE_PATH=/path/to/node_modules python -B -m pytest -p no:cacheprovider tests/services/ai3/lms_acceptance.py -v
```

实际绝对路径、命令和本机原始日志保存在验证索引；临时日志未作为公共交付上传。源码、补丁和golden已保存在双仓本地。
下一批才是孩子提交/审核与复习效果；本批仍须用户验收，不能从这些证据推断真实Provider计数或AI-3总门禁已通过。

## 保留状态

历史失败、T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项非阻断补测、QUALIFIED_COUNTER_PENDING和REMAINDER_DEFERRED保持。
不调用真实模型，不提交、推送、合并或部署，不提前关闭AI3-D或AI-3总门禁。
