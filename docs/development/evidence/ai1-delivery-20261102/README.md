# AI-1 双仓限定合成工程保存交付

用户授权保存已完成的双仓工程：专用分支、提交推送、Draft PR和CI检查；不合并、不部署。
计数技术依据暂缓，不是取消准入；QUALIFIED_COUNTER_PENDING和真实发送关闭保持。

## 范围与基线

- LMS基线为T8交付 `1d49abb11580172fa86a7e282cb31588bf682027`。
  T8 PR #36尚未合并，AI-1 Draft PR以 `codex/t8-local-delivery` 为base，仅展示AI-1增量。
  此安排不批准合并T8，也不把其功能算作AI-1新增。
- DeepTutor基线为v1.7.1 `f7aed0744c36c5afef16a4261c31ebee1208cac2`。
  用户明确批准公开fork `mflyn/DeepTutor`；只向个人fork的main提Draft PR，不向HKUDS上游提交。
  交付提交为 `8b71e281683dd5070a4d97ad4bf1582e8feb9560`，见
  [个人fork PR #1](https://github.com/mflyn/DeepTutor/pull/1)。
- 两仓使用 `codex/ai1-synthetic-delivery`，保留原分支和工作区。
  DeepTutor原origin不改，新增delivery远端仅指向个人fork。

## 候选与公开信息检查

原LMS候选160文件、DeepTutor实现/测试23文件已完成限定独立只读检查。
DeepTutor额外交付README为第24文件，由主线程检查；本目录是本轮验证索引，不改业务实现。
双仓68项矩阵源码指纹、6项契约fixtures均匹配；原37个manifest/patch文件加本次输入manifest为38个。
19份补丁全文含上下文/删除行已检查，33项摘要引用及4条父路径/hash匹配。
新增内容未发现真实凭据、个人绝对路径、私网地址或原始日志；命中的个人路径属于LMS HEAD既有内容，
不是本批新增。本次不保证全历史无泄露，也未修改或删除既有历史。
排除根及前端node_modules软链接、构建产物、临时数据库、原始日志及真实配置。
私有原始结果保留本地，仅公布去标识化结果和摘要。

## 本轮本地验证

- DeepTutor原根夹具AI-1目录：166 passed、3 warnings，exit0；临时HOME/DEEPTUTOR_HOME及合成Provider，无继承模型凭据。
- 前端现有非Legacy全量：59 suites、788 tests passed，exit0；没有新增跳过或改断言。
- 前端生产构建：exit0，Compiled successfully；Browserslist数据过旧提示保留，未顺手升级依赖。
- 全仓ESLint：exit0；文档状态及双仓diff检查通过。
- 家庭后端原全量：168套件通过，5135项通过、0失败、1项既有条件跳过，exit0；827.866秒。
  TC-T5-DEPLOY-002 Secret dry-run因本轮PATH缺kubectl而保持条件跳过；不修改断言或把旧补验拼入本次结果。
  前后68项源码指纹不变，本轮临时依赖链接已移除。原始结果摘要见[verification.json](verification.json)。

初次启动家庭回归时，沙箱拒绝创建本轮临时依赖链接，exit1，尚未执行测试；该失败保留在对话工具记录。
随后通过受控本机执行运行原命令，未更改测试断言或超时。依赖链接由原脚本限定收尾。
本轮候选没有业务变化，未重复全部历史HTTP/浏览器/变异测试；此前证据链保持原样。

## CI与验收边界

LMS现有CI仅自动匹配main的PR；此依赖型PR需在固定head手动运行现有ci-cd工作流，
run_performance/run_security/build_images均false、deploy_environment=none，不触发外部扫描、发布或部署。
DeepTutor新fork初次核查工作流列表为空，tests.yml存在但dispatch/enable返回404；
不得把没有check-run解释为通过，须待fork Actions初始化后检查同一SHA的CI。
最终CI状态以各PR和工作流为准，未在本记录预先承诺通过。

三组输入及manifest保持冻结，不含标准答案或旧变式题要求；人工核验、修订版本和未知原命令保护不变。
B/D/AI-1 OPEN，费用/真实调用/人工价值待验；AI-0的10元与15/5分钟不转移。
保留历史失败、DEVICE_PENDING、T4/T8 OPEN、T9 NOT_STARTED、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED。
