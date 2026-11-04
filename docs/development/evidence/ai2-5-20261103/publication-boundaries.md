# AI2 发布版本、来源快照与输入边界补验

日期：2026-11-04。范围：AI2-PUB-03、AI2-PUB-04、AI2-ATTEMPT-02剩余子条件。
状态：2026-11-04用户复审批准，ACCEPTED / USER_APPROVED；AI2-5 IMPLEMENTING、AI-2 OPEN。
上一批竞争/终态补验及屏障P2已按用户批准关闭，见[批准记录](concurrency-acceptance.md#2026-11-04-用户批准及本轮复验证据)。

## 变更和边界

只改四个既有测试文件，新增21个永久用例；没有修改业务逻辑、原断言、schema、索引、配置、超时或测试框架。

- [服务测试](../../../../backend/services/homework-service/__tests__/services/ai2Service.test.js)：4项。单独改变reviewVersion、替换批准指针后旧预览准确409，零Package/Command且Cycle不变；显式新预览后发布精确新tuple/snapshot。来源题目/标题变化及404/503不改历史完整快照，新发布拒绝且AI1/AI2持久集合不变。
- [提交HTTP](../../../../backend/services/homework-service/__tests__/services/ai2SubmissionHttp.test.js)：13项。1/10不同图片、空说明、1000普通/补充平面Unicode字符成功，顺序、完整精确引用及同命令重放只生成一次。0/11不同图片、重复、null槽、错类型、1001字符、孤立代理项、null说明和actor注入均400，全部AI2及媒体集合不变，resource HTTP零请求。
- [正式HTTP](../../../../backend/services/homework-service/__tests__/services/ai2FormalHttp.test.js)：1项。真实GrowthTask标题/description修改后，家长/孩子仍读发布时完整快照；实际删除来源后为missing，Package完整对象、命令和Attempt计数不变。
- [组件测试](../../../../frontend/web/src/__tests__/family/Ai2LearningPage.test.js)：3项。发布409清旧预览及命令，不自动读取新版本或再次POST；显式重新预览仍须重新确认。新命令响应未知时保留原UUID重试。来源missing/unavailable在详情区域准确提示且保留题目/讲解，无新写。

审核版本/批准指针变化是明确的持久故障夹具，故意不增加Cycle.stateVersion以避免该保护掩盖artifact检查。
AI1正常API不允许修订已批准稿；本例不虚构新增修订能力或真实用户流程。
sourceReader服务例为端口替身；正式HTTP例使用真实Gateway、homework、resource启动预检与本地Mongo/fs，AI1批准稿是预置夹具。
提交HTTP使用真实路由、签名身份、Mongo事务及resource operation HTTP，图片Asset是合成metadata，不冒称上传/图片字节验收。
null槽不是JSON无法表达的稀疏数组；既有contract稀疏数组反例保留。组件API及媒体为替身，不冒称正式浏览器。

## 运行与自查

| 执行 | 结果 | 范围 |
| --- | --- | --- |
| 初次后端新增 | 2套17通过，32未选中，12.693秒 | formal新增前；不能称全部套件 |
| 最终homework AI2 | 10套206通过，0失败/跳过，60.594秒 | 原188 + 本批18，含正式HTTP及提交HTTP |
| 初次组件 | 1套31通过/3失败，10.373秒 | 新测试定位/异步等待错误，原始JSON/log保留 |
| 修正后页面组件 | 1套34通过，4.319秒 | 新3项及原31项 |
| 相关前端回归 | 5套204通过，0失败/跳过，8.644秒 | 页面、草稿刷新、client、媒体组件/API；不是前端全仓 |
| 四项临时副本变异 | reviewVersion 1失败、来源发布检查2失败、图片上限1失败、note上限2失败 | 全部命中永久断言，退出1，0运行时套件错误；逐次恢复临时源码 |
| 自查 | 四测试ESLint、git diff --check、原语句AST顺序校验通过 | 原断言逐项保留，组件仅增加within导入 |

初次组件两处题目同时存在列表和详情，改为限定详情region；另一次点击重试发生在按钮仍busy，
新增等待enabled后再点击，不修改按钮业务逻辑、不删除重试次数/原正文/原UUID断言。旧31项完整保留。
冻结工具第一次将git show“路径不在基线”误作异常，停止；改用git ls-tree明确基线文件集合后重建成功，未改变产品或验收断言。
历史失败、Mongo驱动旧选项警告保留；未重跑家庭全部后端、前端全仓、build或浏览器，产品源码均未变。

复用现有Node22、既有NODE_PATH、固定本机mongod、禁止运行时下载，真实监听仅127.0.0.1。

```sh
node "$LMS_DEPENDENCIES/jest/bin/jest.js" --config backend/services/homework-service/jest.config.js \
  --runInBand --testPathPattern=ai2 --json --outputFile="$RESULT_ROOT/homework-all.json"
# frontend/web 中，使用现有CRA测试入口
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand \
  --runTestsByPath src/__tests__/family/Ai2LearningPage.test.js src/__tests__/family/Ai2DraftRefresh.test.js \
  src/__tests__/family/ai2Client.test.js src/__tests__/shared/Ai2Media.test.js src/__tests__/shared/ai2MediaApi.test.js \
  --json --outputFile="$RESULT_ROOT/components-related.json"
```

## 冻结候选

本机原项目归档：`release-gate-artifacts/ai2-5-publication-20261104/`，不覆盖上一批归档。

- 基线：`4655d30f1b61b55f400b67f16f9143dd191de1d2`。
- 上批candidate：`5d796b39cdf89977d4222bfd3fe7793717d076a1267621aebd53a7218f4e7fbf`。
- 本批94文件candidate：`d46276d8184a525fa4eb960ce7f1ae53c6e60ad08463c3f8b5bae42352053267`。
- 累计patch：`1a07531f38c9ddf92c814b1eb9e9edf983cebd184c525ee47366d2ba340f3901`。
- 四测试增量patch：`fc83c6b4830e9163818a98873729cb95603bbb398e0395167de2e6b79035c304`。
- 94源码自基线重建哈希匹配；相对上批只有四测试变化，90源码逐字节不变，T8无关工作不纳入。

独立复评、文档及证据清单见下节，不把开发自查写成独立验收。
总门禁不提前关闭，保留T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、真实模型计数资格待验、高级恢复/新回收 REMAINDER_DEFERRED、T9 NOT_STARTED。
仅本地合成验证，没有模型调用、提交、推送、合并或部署。

## 独立复评与最新覆盖

独立复评Huygens（`01a1a3f6-e007-7342-b12d-fa472c7a7c69`）未发现新增缺陷或P2覆盖缺口，
确认PUB-03/04、ATTEMPT-02可升级CORE_PASS_SCOPED；矩阵最新31 = 23核心 + 8部分，不是总门禁批准。

- 独立组件：1套3项通过、31项名称筛选未执行，4.973秒、退出0。
- 独立后端首轮：18项断言虽通过，但logger写工作树日志EPERM导致1个runtime-error suite，退出1；明确失败，不计通过。
- 独立后端副本：94文件经哈希核验后在可写临时目录执行原测试，3套18通过、36未选中，17.016秒、退出0、0 runtime-error suite；没有修改logger、断言或权限逻辑。
- 独立核对candidate/patch/increment、94源码与副本、原AST语句保留；90文件未变。只读核查开发206/204和四项变异，不冒称独立再次执行这些全量或变异。

独立原始JSON/log、执行命令与结果、哈希核验、复评报告归档`review/`；首轮失败也保留。
`validation/`保留开发原始失败与通过结果、变异脚本/逐项JSON/log、静态校验和重建工具。
`document-manifest.json`绑定11份当前文档；`evidence-manifest.json`绑定本批验证及上一批批准复验，
`final-verification.json`记录最终计数和哈希核验；源码与文档分开冻结，无自引用哈希。
本轮不新增P2关闭事项；上批屏障P2为用户已批准关闭。上述待审描述保留为当时快照，最新批准见下节。

## 2026-11-04 用户批准及本轮复验证据

用户复审通过并批准本批发布版本、来源快照和输入边界补验。冻结candidate、累计patch、增量patch保持上节原值，
不重写开发206/204、首轮组件失败或独立后端EPERM失败。

- 最新独立后端：3套18通过、36项名称筛选未执行，24.276秒、退出0；detectOpenHandles无遗留句柄。
  JSON SHA-256：`b8723fd75fbe4437283b12737ce7ac3141fecbedbfaa1468cdb752493ae9e18d`。
- 最新独立组件：1套3通过、31项未选中，7.097秒、退出0；不称全量重新执行。
  JSON SHA-256：`551e6b62aacffde89de4062c66382f3d1679a5522a5f0ac28490c61ba74ec597`。
- 94源码、11文档、46证据及补丁重建一致；原AST语句保留，独立静态复评Faraday无新增问题。
- 本轮复验证据归档到接续批次 `release-gate-artifacts/ai2-5-auth-20261104/approval-review/`，
  保留原 `ai2-5-publication-20261104/` 不覆盖；报告区分运行复验、静态复评与原开发变异。

持久集合前后比较不等同Mongo命令级零写审计，resource请求计数不等同进程全出站审计。
本次批准仅限该批补验；继续AUTH-01/RECOVER-04/SESSION-02，不关闭AI2-5或AI-2总门禁。
