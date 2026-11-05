# AI3-D 完整请求32KiB修订候选

**Status:** FIXED_AND_INDEPENDENTLY_REVIEWED / USER_REVIEW_PENDING
**AI3-D:** USER_REVIEW_PENDING
**AI-3:** OPEN

## 问题与最小修订

原[D冻结](../ai3-d-20261104/README.md)复审发现：LMS完整请求可能超过远端32KiB限制，
本地claim后远端413拒绝且无operation，后续原UUID查询404不能释放未知费用与共享槽。
新修订在buildRequest中按实际JSON.stringify输出的UTF-8字节数（包括hash/封装/转义）检查32768上限，等于上限允许。
generate先构造完整请求，再创建命令和预留；claim事务在占槽及持久DISPATCHING前验证原映射与同一字节限制。
远端协议/错误处理/未知恢复不变；不把413或404当作未发送凭证，不替换UUID。旧超限RESERVED只拒绝claim，原预留保留，不自动迁移。
历史超长UNKNOWN也会在本地拒绝恢复，零新增GET/PUT；原UUID/hash、费用和槽保留，不能据此宣称历史挂起已解决。
回滚仅撤回本轮局部代码增量且保持AI3未装配；本轮无真实数据或迁移，不能以清空费用/槽位作为回滚手段。

## 验证范围

使用本机Node22、现有依赖、临时Mongo副本集、回环HTTP；无真实Provider、服务器或生产配置访问。
永久反例在原测试文件追加，原断言保留：UTF-8多字节、JSON转义、完整正文32767/32768/32769、
实际HTTP边界、费用预留零写、旧RESERVED零claim、拒绝后AI1和AI3共享槽可用、远端413/404仍保留未知。
首轮红灯、夹具失败与修正后红灯、开发回归、变异、独立复评分别归档，不互相替代。
首轮夹具普通Mongoose更新被immutable字段忽略，修正为显式合成原始写入和读回断言；
另一夹具创建第二活动Round触发既有版本冲突，改为在原未预留Round上取得合法预览后验证槽位。
两类夹具修订不放宽业务约束。正确夹具在旧源码临时重建上仍实际红灯，不以最早夹具失败代替缺陷复现。

## 交付与保留边界

本轮为原D候选之上的增量，不改写原candidate.json、补丁或verification.json。DeepTutor无本轮修改。
冻结文件与哈希见[candidate.json](candidate.json)，七文件增量见[candidate.patch](candidate.patch)，
本地原始证据、重建及校验结果见[verification.json](verification.json)。原D完整候选及双仓前置仍须一并保留，本补丁不能替代全部AI3交付。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测、QUALIFIED_COUNTER_PENDING及REMAINDER_DEFERRED保持。
本P2及AI3-D待用户验收，AI-3总门禁不关闭；不调用真实模型、不提交推送、合并或部署。

## 开发自查与验证

- 原D两份源码临时重建运行正确夹具：10失败/3通过（未选择86项），明确拦截旧缺陷；不覆盖原冻结代码。
- 四类临时模块变异：移除大小校验10条失败；误按UTF-16字符计数5条失败；只计messages漏计封装/hash两条失败；移除claim前复核一条状态快照失败。
  最后新增UNKNOWN永久反例后再移除大小校验，11条失败/3条通过（未选择86项），新增反例也实际拦截；不以未选择项冒充测试跳过或删除。
- 首轮完整回归因沙箱EPERM写既有日志目录停止（退出130）；获准本机执行上下文重跑原命令，未改断言或Jest排除配置。
- 完整homework开发回归53套1858项通过，280.27秒；此时尚未新增最后的历史超长UNKNOWN永久反例和祖先快照断言。
  最终业务源码与该全量一致，最后仅补测试；最终定向回归另列，不将1858项冒充最终全部新测试的全量。
- 五套首次定向143项通过；最终补测后五套144项通过，26.509秒，退出0，不将旧次数冒充最新。
- 跨语言真实HTTP六项通过，9.35秒；LMS真实client、Python工厂/service/SQLite、Provider替身，不是公共应用/浏览器或真实模型验收。
- 初次文档检查因缺NODE_PATH找不到现有dotenv，补正确已有依赖路径后通过；不安装依赖。四文件ESLint、差异检查通过。
- 生产改动仅完整请求构造、generate预留前构造顺序、claim前持久映射复核；事务/权限/CAS/未知错误处理未放宽。

## 独立复评

第一轮独立两套99项通过，19.138秒，退出0；另用真实服务临时探针验证双重转义的32767/32768/32769边界及含祖先的零副作用、
历史超长UNKNOWN状态保留和旧golden/hash一致。未发现剩余P1/P2；提出非阻断P3：历史超长UNKNOWN探针尚未固化。
本轮已固化该永久反例并补祖先快照断言，生产源码未变；最终独立结果如下，不自动关闭用户验收。

最终独立两套100项通过（service 68、operation 32），18.867秒，退出0，0 failed/0 pending。
新增历史UNKNOWN例与祖先快照保护通过；独立核对移除本轮新增测试文本后可精确还原上轮测试文件，未削弱旧断言。
两份生产源码及operation测试相对首轮独立复评未变，最终四文件运行前后哈希一致。
独立复评确认本P2及随后P3测试缺口满足修复条件，无剩余P1/P2/P3发现；状态为FIXED_AND_INDEPENDENTLY_REVIEWED，待用户批准验收/关闭。
独立没有重跑完整homework或跨语言六项；这两项属于本轮开发验证，不能冒充独立全量。

## 复验入口

沿用原homework Jest配置、Node22和现有依赖，NODE_PATH指向已有依赖目录，MONGOMS_RUNTIME_DOWNLOAD=false。
完整开发回归使用`node <existing-node_modules>/jest/bin/jest.js --config backend/services/homework-service/jest.config.js --runInBand`。
最终定向同一入口加`--runTestsByPath`，指定ai3Service/ai3Operation/ai3Budget/ai3GenerationPreview/ai3Contract五个原测试文件；
独立两套仅指定前两项并加`--no-cache`。跨语言六项沿用原D的显式`tests/services/ai3/lms_acceptance.py`入口和临时HOME。
四文件ESLint、`npm run docs:family:check`、`git diff --check`均实际执行；命令失败、警告及修正重跑分别保留，不声称零警告。
