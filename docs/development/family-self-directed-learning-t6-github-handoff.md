# T6 GitHub 与服务器隔离测试交接

## 最新独立服务器结果

2026-10-27 独立测试已对固定 `a3aa01cf2f2fee99df654592b07f37b901ad2c46` 完成合成回归，
结论 PASS_T6_SERVER_SYNTHETIC_REGRESSION；详见 [独立记录及证据](evidence/t6-server-synthetic-2026-10-27/README.md)。
下文“本次只准备/未执行服务器”和 CI 待验均为 Git 交付当时快照，保留历史，不作为当前服务器结论。
本轮实际为 Ubuntu 宿主的 Debian 容器 2 CPU/3 GiB/cgroup swap0（宿主有 swap），Mac 双引擎回环访问；
不能冒称真机或 Linux 浏览器。环境已收尾，不按本清单自动重启。最新记录不授权本轮新增 Git/PR 写入、合并或部署。
M01–M08、D01–D04、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项非阻断补测及后置范围不变。

**工程状态：** CLOSED / ENGINEERING_SYNTHETIC_ONLY。
**Git 授权：** BRANCH_PR_ONLY / NO_MERGE / NO_DEPLOY。
**保留项：** 历史失败 PRESERVED；DEVICE_PENDING；Docker INCOMPLETE_FAILED；
T5-NB-001/002 OPEN_NONBLOCKING；高级恢复/新回收 REMAINDER_DEFERRED。

## 1. 候选与证据

2026-10-27 用户授权完整 T6 专用分支交付，不自动合并或部署。分支为
`codex/t6-engineering-delivery`，基于 main `62cedfa35dc581c494179f7edda82aba0754b94e`。
提交范围包含来源读取及服务鉴权、任务/错题模型与 API、家长/孩子导航和未知结果保护、
Compose 服务地址配置、组件/正式 HTTP/浏览器测试及设计/指南/关闭记录；不含新的 AI/K12 工作。

历史冻结材料保持原字节，不用最新成功覆盖旧失败：

- [初始工程候选](evidence/t6-engineering-2026-10-27/validation.json)。
- [未知创建 P2 候选](evidence/t6-unknown-create-p2-2026-10-27/validation.json)。
- [拒绝优先 P2 候选](evidence/t6-reload-denied-p2-2026-10-27/validation.json)。
- [批准关闭记录](evidence/t6-reload-denied-p2-2026-10-27/engineering-closure.md)。

原始日志/截图保留在本地忽略的 `release-gate-artifacts/`，提交脱敏记录、补丁及哈希索引，
不将测试账号、请求凭据或运行时输出上传为公开证据。CI 新日志由现有 Actions artifact 归档。
PR 和固定完整 SHA 在本轮交付消息中给出；只有该 SHA 的 Family Regression 通过后，才作为服务器候选。
可选 performance/security/build/deploy 未执行不等于通过，新的 CI 成功也不消除旧 Docker 审计失败。

本次发布前本机验证：家庭后端 152 suites / 4455 tests、前端 52 suites / 678 tests、正式 HTTP
5 suites / 27 tests、当前构建 Chromium 48/48 均通过；全仓 lint、文档状态、四份 Compose 静态配置
和源码/文档 diff 检查通过。暂存全量 `git diff --cached --check` 对三份冻结 candidate.patch
报告 95 行尾随空格，已逐行核实均为统一 diff 的单空格空白上下文；仅这三份补丁保留原字节与哈希，
其余暂存内容检查通过，不修改 Git 规则。Node 22.15.0，使用既有依赖，CI 再验证 clean install；没有本机 Docker 启动。
先前 NODE_PATH 不能满足相对 node_modules 引用的失败、沙箱拒绝 Chromium 启动的
3 failed / 45 did not run 均原样保留；补临时依赖链接、获准本机浏览器执行后使用新日志复验，
未改业务实现、断言或超时。临时链接验证后移除，不提交。证据与候选哈希见
[交付验证索引](evidence/t6-github-delivery-2026-10-27/validation.json)。

## 2. 独立检出

以下为后续执行清单，本次只准备，不连接或操作服务器。先记录现有服务、端口、容器和健康状态，
另建全新的测试目录，不复用正在运行的项目 checkout、`.env`、数据卷、媒体、数据库或 NAS。
不要在现有服务目录执行 `git pull main`、`docker compose up` 或 `release:family`。

```bash
set -euo pipefail
export CANDIDATE_SHA='<本轮 CI 通过的完整 40 位 SHA>'
[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]]
QA_ROOT="$(mktemp -d "$HOME/lms-t6-qa.XXXXXXXX")"
export QA_ROOT
chmod 700 "$QA_ROOT"
git clone --branch codex/t6-engineering-delivery --single-branch git@github.com:mflyn/LMS.git "$QA_ROOT/source"
cd "$QA_ROOT/source"
git checkout --detach "$CANDIDATE_SHA"
test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"
test -z "$(git status --porcelain)"
```

工具准备使用 Linux Node 22 和锁文件安装，不复用 macOS node_modules。
低配复验沿用已批准的 Ubuntu **2 CPU / 3 GiB / 无 swap** 隔离条件；
容器非 root、独立工作目录和 TMPDIR、无 Docker socket/真实数据挂载、无公网端口。
联网准备依赖与浏览器后，正式自动化可在 `--network=none --cpus=2 --memory=3g --memory-swap=3g`
容器中串行运行，保留 cgroup/inspect 和镜像 digest 证据，不与其他 QA 并发。
具体容器准备复用 [既有隔离规范 §1–2.1](family-self-directed-learning-t2-server-test.md#1-前置条件与隔离)，
仅替换本节分支/SHA/目录；不要沿用旧文档的 T2 测试数量或已执行结论。
浏览器所需系统库必须在准备阶段安装；缺少工具、OOM 或条件跳过都要记录，不能冒称通过。

## 3. 串行工程复验

在独立 Linux 测试环境中先完成 `npm ci`、`npm ci --prefix frontend/web`、
`npx playwright install chromium` 以及 MongoMemoryServer 二进制缓存准备；容器镜像须已具备浏览器系统依赖。
不要读取真实 `.env`，不要设置真实 MONGO_URI。下面使用原测试工厂的临时副本集/媒体和随机回环端口。

```bash
set -euo pipefail
# 若采用 /qa 挂载的隔离容器，在容器内先设置 export QA_ROOT=/qa。
export EVIDENCE="$(mktemp -d "$QA_ROOT/evidence.XXXXXXXX")"
run_step() {
  local name="$1" rc=0
  shift
  date -u +%FT%TZ > "$EVIDENCE/$name.start"
  "$@" > "$EVIDENCE/$name.log" 2>&1 || rc=$?
  printf '%s\n' "$rc" > "$EVIDENCE/$name.exit"
  date -u +%FT%TZ > "$EVIDENCE/$name.end"
  return "$rc"
}
run_step docs npm run docs:family:check
run_step lint npm run lint
run_step family npm run test:family-regression -- --json --outputFile="$EVIDENCE/family.json"
run_step frontend npm run test:ci --prefix frontend/web -- --runInBand --json --outputFile="$EVIDENCE/frontend.json"
run_step http npm run test:t2:integration
run_step build env CI=true npm run build --prefix frontend/web
export T2_WEB_BUILD="$PWD/frontend/web/build"
run_step browser env T2_BROWSER_OUTPUT="$EVIDENCE/browser" npm run test:t2:e2e
```

保留失败即停及每次独立目录，不提高超时、不删断言、不以重跑覆盖失败。
正式 HTTP/浏览器使用真实 Gateway、user、homework、resource、progress、analytics、notification，
完成协议 enabled，真实预检/权限/凭据/上传保护保留，日志静默；数据库和文件均为临时合成数据。
组件测试的 API mock 不替代此链路。`cleanupEnabled=false`，高级恢复和新回收不启用。

## 4. 页面人工测试与收尾

自动化完成后，如需页面人工测试，另起 `T2_WEB_BUILD="$PWD/frontend/web/build" npm run test:t2:preview`。
只使用它输出的一次性合成家庭/孩子，输出不要贴到 PR 或公开日志；页面仅监听随机 127.0.0.1 端口。
跨机访问须确认回环 SSH 隧道到该端口，不改成 0.0.0.0、不改现有反向代理或公网规则。
离线容器不能直接接受宿主隧道；需要人工访问时单独确认仅回环的隔离网络方案，不放宽自动化隔离条件。

- 孩子从任务进入错题，保存图片/PDF，刷新和返回来源；不能用完成作品 ID 绕过 mistake purpose。
- 家长查看错题、补充错因/知识点，明确创建订正任务，审核作品后孩子回看。
- 按复习日期进入既有提醒和错题详情，人工更新掌握状态，不自动改为 mastered。
- 丢失创建响应后保留未知提示，显式重读列表，不自动重发 POST；失败、关闭、重登保留保护。
- 普通重载 403 清理私有内容；迟到成功不能恢复；普通网络失败保留草稿/未知 PATCH 锁。
- 切换孩子/家长、兄弟姐妹/跨家庭来源拒绝；来源不可用不泄露标题或媒体。

停止测试用自身退出/SIGINT，核对临时 Mongo/端口/进程收尾；只处理本轮资源，禁止全局 prune、
真实 cleanup/restore 或删现有卷。再次核对原有服务状态，保留 SHA、命令退出码、日志和哈希。
iPad 真机相册/相机、触控、横竖屏、后台/断网仍为 DEVICE_PENDING；本清单不代表已通过服务器或真机验收。
