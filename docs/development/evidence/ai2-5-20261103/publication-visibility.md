# AI2 发布拒绝与孩子 DTO 补验

日期：2026-11-04。范围：PUB-02、VIEW-01。当前状态：ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY；AI2-5及AI-2随后经用户单独批准CLOSED / ENGINEERING_SYNTHETIC_ONLY。
用户已批准本批，冻结候选与最新独立复验绑定见[批准记录](closure-readiness.md)。下方待审描述为送审快照，不改写历史证据。
上批AUTH-01/RECOVER-04/SESSION-02和P3已获用户批准，见[批准记录](auth-recovery-boundaries.md#2026-11-04-用户批准及本轮复验证据)。

## 变更范围

只在两份既有测试新增5项，不改业务源码、原断言、超时、API、schema或配置。

- `ai2Service.test.js`：合法格式但错误的childSnapshotHash、未确认孩子内容分别直接publish拒绝，AI1/AI2全部集合不变、Package/Command为零、mediaReader零调用。
- 同文件：通过AI1实际create/generate/claim/markUnknown产生Job unknown、Cycle generating及reserved_unknown预留；预览和伪造合法格式制品tuple的publish均409，预留/原Job/槽位/命令等全部AI1/AI2持久状态不变。没有写入不合法的Cycle unknown枚举。
- `ai2FormalHttp.test.js`：正式Gateway/homework/resource HTTP发布、上传PNG、孩子提交及家长审核后，非空包列表/详情、Attempt详情/历史、原actor命令列表/详情逐层完整白名单；命令列表无正文、原详情保存完整原提交，父母命令不可混入。
- 同文件：存在已发布包和真实Attempt的正向前提下，猜测AI1 Cycle/Artifact ID访问AI2包、Attempt和命令返回准确404，孩子出版预览403，父母命令404；AI1/AI2及媒体持久集合不变。

服务层source/media reader为替身，AI1内部outcome/markUnknown不调用Provider；正式HTTP用真实Mongo事务、索引、上传文件和媒体协议，但AI1已批准制品及JWT为合成夹具。
本轮不重跑浏览器、不冒称付费模型、真实PIN登录或每种拒绝的全进程零出站；旧AI1入口孩子403与人工修订批准连接复用既有桥接证据。
集合比较只证明持久状态不变，不等同数据库命令级零写。未修改前端，复用上批211项证据，不写成本轮重跑。

## 验证与历史

首轮新增定向4通过/1失败/41未选中，退出1：unknown夹具的章节名称不符合AI1闭合契约。
只修夹具为已批准章节值，保留原JSON/log，不改产品校验或弱化断言。
修订后homework全部AI2：10套220通过，0失败/跳过，61.572秒，退出0；原215项完整保留。
原语句AST顺序检查与两文件ESLint通过；不是家庭后端全仓回归。

```sh
# 现有Node22、固定本机mongod；禁止下载，临时数据库和回环HTTP
node "$LMS_DEPENDENCIES/jest/bin/jest.js" --config backend/services/homework-service/jest.config.js \
  --runInBand --testPathPattern=ai2 --json --outputFile="$RESULT_ROOT/homework-all.json"
```

## 独立复评与变异

- Averroes（`01a1a521-6b7d-7263-962a-1d7e81c044ae`）在基线加补丁重建副本独立执行新增5项：2套通过、41项未选中，12.516秒，退出0；使用detectOpenHandles，无runtime-error suite、无open handles、无forceExit。
- 运行前后94文件、候选/补丁哈希一致；相对上批只有两份测试新增123行、删除0行；原顶层语句及断言AST顺序保留。业务源码不变。
- 独立结论SCOPED_PASS，无阻断P1/P2；结合既有桥接及服务证据支持PUB-02/VIEW-01为CORE_PASS_SCOPED。开发220项与独立5项分开，不混算、不声称独立重跑全量。
- 三个临时副本变异：移除childSnapshotHash比较、向命令列表泄漏payload、向孩子Attempt泄漏完整review审计，分别精确触发1项断言失败；均退出1、runtime-error=0，最终逐项恢复副本原源码。不是实际业务失败，也不是本轮独立重跑变异。
- 新增一项非阻断建议`AI2-VIEW-NB-001`（P3 / OPEN_NONBLOCKING）：命令详情可补与列表项加原payload的整对象相等断言。当前详情顶层及payload已有精确检查，列表resultReference已有完整白名单且二者共用commandView；不是已发现泄露，不阻断本批覆盖，不冒称已修复。与上批已批准关闭的异常收尾P3及原两项非阻断补测分开登记。

独立报告和原始JSON/log在归档`review/`；本轮自测、三项变异及首轮失败在`validation/`；上批获批复验在`approval-review/`。
文档状态校验412 contract fixtures/38 requirements、两测试ESLint、原AST、相对链接及git diff --check通过。

## 当前状态与下一步

最新覆盖 **31 = 28 CORE_PASS_SCOPED + 3 PARTIAL**。这是实测覆盖归并，不等于用户已验收本增量或总门禁关闭。
仍为PARTIAL：WITHDRAW-01（带订正/审核历史再发布不迁移旧Attempt、完整旧审计不变），
WITHDRAW-02（prepare异步窗口撤回竞争），MEDIA-04（AI2 commit与删除真实交错、跨家庭对象完整不变）。
上述三项不是后置，不用顺序测试或旧growth_task类型用例替代；本轮不擅自继续新批次。

## 冻结候选

本机忽略目录：`release-gate-artifacts/ai2-5-visibility-20261104/`，不覆盖旧归档，不表示已提交或公开。
基线`4655d30f1b61b55f400b67f16f9143dd191de1d2`；沿用94文件源码范围，只有两测试变动、无关T8不纳入。

- candidate SHA-256：`9f73c84f4281ee83d7752d4cbdfb86cc4e4aaa2a42a73eae8cead22de42eab44`
- 累计patch：`2fe2a90931259ee10646de97ec7a0572a5d98d098980b1a773d4b458297eb51d`
- 相对上批增量patch：`34f9de018490561cb36632467916bece8308146cdcc82627f2d8a40817fd257c`
- 从基线加补丁重建94/94文件匹配；源码、文档、验证证据分别冻结，避免自引用哈希。

历史失败、DEVICE_PENDING、T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED、两项非阻断补测及高级恢复/新回收后置不变。
本轮不调用真实模型、不提交/推送/合并/部署；AI-2总门禁不提前关闭。
