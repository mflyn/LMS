# AI3逐次费用确认P2修订冻结候选

2026-11-23。FIXED_REVIEWED / USER_REVIEW_PENDING。用户仅批准修复，未批准页面批次或本P2关闭。

## 身份与范围

LMS base `548ceda8b713cde00e93d1b1ae5fdeebb0e8eca0`。
完整19文件补丁SHA256：`3c07bc2bf7d5c04f37c086f64697cac17b546043fe7362510813e3ed2aebc3a2`。
相对旧页面候选的两文件代码/测试增量：`2983ea3778cbfe05dfd555bc0a10bca33baded8aa4f7c1a53f40769fad7612fb`。
完整补丁包括此前页面批次、已批准的DeepTutor验收记录和本次修订文档，不把19文件都称为本次新增业务。
完整与两文件增量分别重建成功，逐文件哈希一致；旧165文件冻结包不改写。
当前DeepTutor17文件仍匹配原完整补丁，不改动对端。候选与源码见candidate.json/source。

## 修订

唯一产品增量：Ai3PracticePage成功保存generate原命令后清除页面sendConsent。
拒绝后必须重新确认，才允许新的UUID；已持久保存的estimateAcknowledged、正文与UUID不变。
UNKNOWN保持原命令查询/恢复，不再次generate。新400/413用例包括合法重新确认发送对照。
原丢响应用例加强勾选清空与保存正文相等检查；所有相关存储断言改用真实AI3_COMMAND_PREFIX。

## 实际验证

- 永久红灯：页面16通过/3预期失败，exit1，3.727秒。
- 首轮修复后相关回归：254通过/1失败，exit1，7.898秒。失败为测试用了错误存储键片段，保留原日志。
- 修正取证后：12套件255通过、0失败/跳过，exit0，8.380秒。
- 独立：页面19通过（wall3.793秒），命令/身份隔离4套件99通过（wall3.550秒），均exit0。
- 独立进程内回退一行：16通过/3预期失败，exit1，wall2.924秒。回退产品文件与旧冻结哈希一致。
- 新构建、受影响两文件eslint、文档门禁、git diff --check均通过。Browserslist旧数据警告保留，未安装升级。

开发相关命令（cwd frontend/web）：

```sh
CI=true npm test -- --watchAll=false --runInBand --testPathPattern='(aiTrial|ai[13]|Ai3|Tutor|familySession).*\.test\.js$' --json --outputFile=<TEMP>
CI=true BUILD_PATH=<TEMP> GENERATE_SOURCEMAP=false npm run build
```

独立命令、退出码、耗时、12文件前后哈希和变异方法见independent/REPORT.md及对应run.json；
独立manifest原摘要`f414a39d41e610fc288d6210d7d14432004c7219cd4014cf4045f93d6030baea`。
开发/独立计数不相加。本次不重跑后端或浏览器；旧253/282、217/109及两引擎证据属于旧候选。

## 保持边界

旧诊断失败和原归档全部保留；精确计数资格后置、估算不承诺费用硬上限。
T4/T8/AI-1 OPEN、DEVICE_PENDING、SERVER_TIMING_UNVERIFIED、Docker INCOMPLETE_FAILED及其他未关闭/后置状态不变。
不调用模型、不操作服务器、不更新真人入口、不提交推送/合并/部署。未更改既有数据、原命令或费用配置。
