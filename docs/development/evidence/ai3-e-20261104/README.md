# AI3-E 孩子提交与私有媒体候选（2026-11-04）

Status: IMPLEMENTED / USER_REVIEW_PENDING。AI-3总门禁OPEN，不代表正式应用或页面验收。
AI3-D及32KiB P2/历史UNKNOWN P3已由用户批准，见[批准记录](../ai3-d-size-20261104/acceptance.md)。
本批以该工作区快照为前置，增量补丁不代替A～D完整实现；旧冻结及失败证据不覆盖。

## 冻结候选

- [47文件增量补丁](candidate.patch)：`9b39877f657c01b21d73abbb5758e7faf1213a6cb8438f01b5cf5e1a12a14146`。
- [逐文件前后哈希清单](candidate.json)：`c8debf79ca3fd477b7ccaa171c20d46ab98f5183bbeb832a7527bb901d65368d`。
- 基础HEAD为`a4f051e26f3514da051910a3495e11b149a32c45`，另依赖既有本地AI3 A～D冻结增量。
  本补丁在本批开始时快照上重建47文件全部匹配，不声称可独立应用到干净main。
- 原始重建基底、命令、原始日志和独立证据保留在本机私有`release-gate-artifacts/ai3-e-20261104`，
  不混入无关T8/AI1/AI2文件。README与证据索引在补丁之外记录最终验证，不形成自引用哈希。

## 实现范围

- 孩子提交1～10张唯一有序图片和可选说明；只接受所见发布内容ID、版本及孩子快照hash，
  服务端补全不可变完整内容绑定。家长不能代录孩子作答；Attempt和原提交者审计不可覆盖。
- 原UUID、独立远端UUID、完整引用集合及摘要先持久化；owner/phase/lease CAS、重启恢复、
  提交未知读回和精确代次补偿，不通过换UUID、退款或盲目重发掩盖未知结果。
- 占位及最终发布都与祖先撤回竞争；自身Round可在活动提交期间撤回，立即阻止发布但保留
  原命令和活动槽，精确清理成功后才释放，重放不恢复槽位。
- `ai3_practice` / `ai3_attempt` / `practiceMediaIds`为封闭媒体类型，独立默认关闭。
  复用既有上传日志、UploadGuard、事务operation、墓碑/精确删除凭证和认证正文读取。
  只读作品不是公开URL；未绑定草稿仅原孩子可读，普通解绑不会变回草稿。
- 私有正文最后一次远端授权后，使用本地事务快照复核PIN/家庭、资产、墓碑及完整绑定集合；
  inspect全部文件读取后再以同一快照复核整批，防止后项等待期间前项失效。
- 正常隐私删除后保留原作答集合，以精确凭证显示删除占位，不变更教学状态。
  无新高级恢复、自动回收、调度器或历史数据迁移。

## 自查与独立复评问题

| 项目 | 修订及保护 | 状态 |
| --- | --- | --- |
| P1 自身Round撤回被活动提交阻塞 | 仅允许经持久映射校验的submit保留占位撤回；最终发布CAS与精确清理；真实HTTP丢响应反例 | FIXED_AND_INDEPENDENTLY_REVIEWED |
| P2 原命令读取吞掉祖先503 | 仅对确认的不可见结果裁剪；依赖503及可见命令损坏拒绝；原命令不变 | FIXED_AND_INDEPENDENTLY_REVIEWED |
| P1 最后一次远端授权等待期间撤权/删除 | 发送正文前单一本地事务快照重验；对暂停的原请求断言拒绝 | FIXED_AND_INDEPENDENTLY_REVIEWED |
| P2 inspect字节等待/批次前项失效 | 完成文件读取后整批快照重验身份、精确代次和状态；不返回陈旧available | FIXED_AND_INDEPENDENTLY_REVIEWED |

本批问题修复与开发自查不等同用户批准关闭，批次等待复审验收。

两侧独立复评未发现新的可确认缺陷。homework复验139项（提交60、真实组合HTTP7、授权72），
UTC 15:21:22～15:21:51；resource复验118项（AI3及AI2定向兼容），UTC 15:23:26～15:23:40。
两者均退出0，无失败或跳过，不是全仓回归。前后哈希分别核对960/633文件一致。
resource独立变异仅在临时副本禁用两处最终复核，九项原反例全部业务断言失败、退出1；
三个原正文HTTP请求错误200，六个原inspect请求错误available，不是超时或依赖失败。
该竞态组access client为替身，inspect为直接服务调用；不能与七项真实内部HTTP组合混称同一种证据。

## 验证范围与历史失败

真实HTTP组合使用本地临时Mongo副本集、实际图片文件/上传删除日志、resource operation与inspect工厂、
homework媒体授权工厂及既有客户端。AI3创建/修订/发布/提交为服务调用，来源查询为合成替身，
不是Gateway公开路由/完整页面验收；无Provider调用。七项组合覆盖1/10图片、commit丢响应原命令恢复、
祖先及自身撤回、删除后恢复和身份/异正文拒绝。

永久反例、自查、开发完整相关回归及独立复验分别记录，不相互替代。最终结果见本页后续验证表。
以下历史结果必须保留：

- HTTP首轮模块尚未就绪、服务接线未完成及临时上传路径未realpath导致的失败，不能写成产品通过。
- 首轮相关回归因旧测试显式根node_modules路径缺失且源码仍在修订而停止，退出130，INCOMPLETE。
  仅为测试临时链接已有依赖，未安装或改测试断言；最终回归另列。
- 旧资源457项运行455通过/2失败：游标故障注入未匹配新增AI3查询；原断言保留，修正夹具后复跑。
  此运行只有工具输出，归档是重建元数据，不伪称原始raw log。
- 媒体读竞态修复前9项永久反例实际红灯；独立复验首次资源兼容组有日志写权限EPERM。
- 临时模块变异中单独删除RESOLVING读回门槛存活：后续持久phase CAS仍拒绝错误补偿。
  明确保留存活结果，不把所有变异写为已杀死，也不据此删除防御检查。

### 最终相关回归与测试枚举同步

原三项目完整回归：163套中162通过/1失败，5560项中5559通过/1失败，872.341秒、退出1。
唯一失败为`mediaModels.test.js`的精确purpose枚举遗漏本批`ai3_practice`，不是业务异常。
全量失败raw log和JSON原样保留，不能覆盖为成功。该运行前后61个相关JS文件哈希一致。

随后仅修订该测试：保留完整`toEqual`枚举，显式补入新purpose，新增缺childId、PDF和未知purpose三类拒绝断言；
没有更改业务代码、删除/跳过测试、放宽集合断言、超时或重试次数。
开发定向三套46项通过，7.769秒、退出0；后续独立复验另列。
完整三项目回归没有在这次仅测试同步后重新执行，状态为`FULL_RUN_FAILED_THEN_TARGETED_FIX_VERIFIED`，
不能合计或改称“最终全量全绿”。原46文件冻结保留在私有归档`pre-model-test-sync`，新冻结追加该测试文件。

独立复验三套46项、退出0，UTC 15:38:04～15:38:12；逐项确认完整枚举`toEqual`、合法purpose循环及全部旧断言保留。
相比前次独立633文件快照仅该测试文件变化，运行前后无变化，业务源码不变。

| 证据层次 | 结果 | 含义 |
| --- | --- | --- |
| 开发完整相关三项目 | 162/163套，5559通过/1失败，退出1 | 保留旧枚举失败，不是全绿 |
| 测试同步后开发定向 | 3套46项，退出0 | 只补测模型及AI3媒体 |
| 独立homework | 139项，退出0 | 提交/HTTP/授权复验 |
| 独立resource首轮修复后 | 118项，退出0 | AI3和AI2定向兼容 |
| 测试同步后独立resource | 3套46项，退出0 | 包含九项竞态反例，不冒充全量 |
| 独立媒体变异 | 九项原断言失败，退出1（预期） | 两处最终复核的保护有效 |

原始文件与哈希见[证据索引](evidence-index.json)。开发与独立测试存在重叠，不累加为独立覆盖数量。

### 执行入口

使用现有Node22与依赖，`MONGOMS_RUNTIME_DOWNLOAD=false`；无安装、远端服务器或真实模型。
为旧测试的显式根node_modules导入临时链接现有依赖，验证结束移除本轮链接，原前端链接不动。
原始日志和各组完整命令、UTC、退出码见本机私有归档，以下为仓库参数：

```sh
node node_modules/jest/bin/jest.js --config backend/jest.config.js --coverage=false --selectProjects family-common homework-service resource-family --runInBand --json --outputFile=private-evidence/ai3-e-FSwx5k/related-full-final.json
node node_modules/jest/bin/jest.js --config backend/services/resource-service/jest.family.config.js --runInBand --no-cache --runTestsByPath backend/services/resource-service/__tests__/mediaModels.test.js backend/services/resource-service/__tests__/ai3MediaProtocol.test.js backend/services/resource-service/__tests__/ai3PrivateMediaHttp.test.js
node scripts/check-family-docs.js
git diff --check
```

实际Node/依赖路径在本机命令记录中固定；上述`node_modules`路径代表已存在依赖，不暗示提交该临时链接。
源码及测试scoped ESLint按仓库现有规则通过；额外推荐规则扫描的旧readiness四项报告保留，未冒称额外规则全绿。

## 保留边界

未挂载生产/公开路由，未交付最终家长审核、复习效果写回、页面或浏览器闭环。
DeepTutor本批没有修改，未调用真实模型；无Git提交、推送、合并或部署。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测、
QUALIFIED_COUNTER_PENDING和REMAINDER_DEFERRED不变。
