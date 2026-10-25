# T2 候选版本服务器隔离测试

**状态：** 固定4dff6871已执行隔离复验（2026-10-25），存在预算失败；结果及聚焦续项见[同限额记录](family-self-directed-learning-t2-d2b-budget-followup.md)。本清单不是部署授权或服务器通过证据。
候选来自 PR #27 的 `codex/t2-synthetic-acceptance`；必须固定完整提交 SHA，不能直接使用移动中的分支或 main。
DEVICE_PENDING、高级恢复和新回收 REMAINDER_DEFERRED 不变。

## 1. 前置条件与隔离

- 另建空的测试目录和独立 clone，不修改已有 LMS checkout、Compose、服务、数据卷、密钥或 NAS。
- 执行人先记录现有服务 ID、启动时间、健康状态和端口；测试后逐项核对，不重启现有服务。
- 使用 Node 22、lockfile 安装依赖；浏览器版本跟随仓库 Playwright。工具准备可联网，实际低配预算测试使用离线隔离容器。
- 预算复验沿用原 QA 环境：`node:22-bookworm@sha256:63538dfe497cc29dfafdda25ada09b46db68a3f4cc205abf1f5d6bf0913f3384`，Node 22.23.4、MongoDB 7.0.14、2 CPU / 3 GiB。记录镜像、架构和工具版本，不把 Mac 或无资源限制的 CI 当作等价结果。
- 容器非 root、只读根文件系统、独立可写测试工作目录及临时 `/tmp`、`--cap-drop=ALL --security-opt=no-new-privileges --network=none --cpus=2 --memory=3g`；不挂 Docker socket、真实 `.env`、宿主 Mongo 数据或家庭媒体。
- 依赖、浏览器、Mongo 二进制及 dry-run 测试用 kubectl 应提前准备并校验。`KUBECONFIG=/dev/null`；不执行集群写操作。缺少工具造成的条件跳过须单独记录和补验，不能写零跳过。

## 2. 固定版本与依赖

以下命令在新建的独立测试目录执行。`CANDIDATE_SHA` 由 PR 最新 head 核实后填写，不接受分支名代替。依赖只能在Linux容器中安装，不复用Mac node_modules。

```bash
git clone --branch codex/t2-synthetic-acceptance --single-branch git@github.com:mflyn/LMS.git source
cd source
export CANDIDATE_SHA='<已核实的40位提交SHA>'
git checkout --detach "$CANDIDATE_SHA"
test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"
test -z "$(git status --porcelain)"
cd ..
export QA_ROOT="$PWD"
export QA_IMAGE='node:22-bookworm@sha256:63538dfe497cc29dfafdda25ada09b46db68a3f4cc205abf1f5d6bf0913f3384'
test "$(id -u)" -ne 0
mkdir -p cache/mongodb tools tmp evidence
chmod 700 tmp evidence
docker run --rm --user "$(id -u):$(id -g)" --cap-drop=ALL --security-opt=no-new-privileges \
  --mount "type=bind,src=$QA_ROOT,dst=/qa" --workdir /qa/source \
  -e HOME=/qa/cache -e npm_config_cache=/qa/cache/npm \
  -e MONGOMS_DOWNLOAD_DIR=/qa/cache/mongodb -e MONGOMS_VERSION=7.0.14 \
  "$QA_IMAGE" bash -euc '
    npm ci --no-audit --no-fund
    npm ci --prefix frontend/web --no-audit --no-fund
    node -e '\''require("mongodb-memory-server").MongoMemoryReplSet.create({replSet:{count:1}}).then(r=>r.stop())'\''
  '
```

上面是联网准备，不计验收结果。将经官方校验的Linux kubectl放入 `$QA_ROOT/tools/kubectl`（可复用原QA已校验工具），不复制主机kubeconfig。正式测试前必须核实工具存在，否则停止准备，不以缺失导致跳过来验收。

### 2.1 进入离线限额容器

```bash
test -x "$QA_ROOT/tools/kubectl"
docker run --rm -it --name "lms-t2-qa-$(date +%s)" \
  --user "$(id -u):$(id -g)" --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --network=none --cpus=2 --memory=3g --memory-swap=3g \
  --mount "type=bind,src=$QA_ROOT,dst=/qa" \
  --mount "type=bind,src=$QA_ROOT/tmp,dst=/tmp" --workdir /qa/source \
  -e HOME=/qa/cache -e npm_config_cache=/qa/cache/npm -e TMPDIR=/tmp \
  -e MONGOMS_DOWNLOAD_DIR=/qa/cache/mongodb -e MONGOMS_VERSION=7.0.14 \
  -e KUBECONFIG=/dev/null "$QA_IMAGE" bash --noprofile --norc
```

此时才执行下节命令。容器内 `export PATH="/qa/tools:$PATH"`，核实 `id -u` 非0、Node22.23.4、Mongo缓存及kubectl；记录 `/sys/fs/cgroup/cpu.max`（quota/period=2）、`memory.max`（3221225472）、`memory.swap.max`（0）及`/proc/net/route`无外部路由，宿主用docker inspect复核NetworkMode=none、ReadonlyRootfs=true、无PortBindings。任一不符停止，不声称限额测试。
所有可写挂载只在新建QA目录；临时Mongo/media/journal落在专用tmp，没有指向真实服务的 MONGO_URI。无宿主网络、端口发布或Docker socket挂载。

## 3. 验证顺序与证据

每次进入容器生成新的证据目录，失败保留原文件，不覆盖重跑结果。大图用例的120000ms和查询5000ms上限不变。
先执行 D2B 目标用例，再完整预检套件，再完整家庭回归；资源受限时串行执行，避免其他测试抢占资源。

```bash
export PATH="/qa/tools:$PATH"
export EVIDENCE="$(mktemp -d /qa/evidence/run-XXXXXXXX)"
run_step() {
  local name="$1" rc
  shift
  date -u +%FT%TZ > "$EVIDENCE/$name.start"
  "$@" > "$EVIDENCE/$name.log" 2>&1
  rc=$?
  printf '%s\n' "$rc" > "$EVIDENCE/$name.exit"
  date -u +%FT%TZ > "$EVIDENCE/$name.end"
  return "$rc"
}
run_step lint npm run lint
run_step docs npm run docs:family:check
run_step budget npx jest --config=backend/jest.config.js --selectProjects resource-family --runInBand --coverage=false --runTestsByPath backend/services/resource-service/__tests__/userDeletionRecoveryReadiness.test.js --testNamePattern='D2B-05 real connected proof bytes exceed 16MiB' --json --outputFile="$EVIDENCE/budget.json"
run_step readiness npx jest --config=backend/jest.config.js --selectProjects resource-family --runInBand --coverage=false --runTestsByPath backend/services/resource-service/__tests__/userDeletionRecoveryReadiness.test.js --json --outputFile="$EVIDENCE/readiness.json"
run_step family npm run test:family-regression -- --json --outputFile="$EVIDENCE/family.json"
run_step frontend npm run test:ci --prefix frontend/web -- --runInBand --json --outputFile="$EVIDENCE/frontend.json"
run_step task11 npm run test:family-flow:integration
run_step task12 npm run test:task12:integration
run_step http npm run test:t2:integration
run_step build env CI=true npm run build --prefix frontend/web
```

新候选预期前端41套件499项，readiness142项，家庭后端143套件3966项，T2 HTTP两套件14项，两浏览器各14项；数量仅用于发现遗漏，不代替逐项结果。目标筛选的其余用例不算执行通过；完整回归不得筛选。
现有 CI release gate 包含额外 Task11/12、合成 Compose 验证；本清单不自动执行 `release:family`，避免未经核对启动 Docker 资源。

## 4. 浏览器、页面与人工复验

固定Node镜像的限额验证不含浏览器系统依赖。浏览器套件在另一个已准备Playwright1.61.1及浏览器依赖的专用环境执行（可使用Mac客户端独立检出），源码仍固定同一SHA，独立构建且不复用Linux node_modules。每次创建新证据目录，复用上面的run_step函数，并分别指定输出目录，避免Playwright清空上一轮截图。

```bash
export EVIDENCE="$(mktemp -d /tmp/t2-browser-XXXXXXXX)"
export T2_WEB_BUILD="$PWD/frontend/web/build"
run_step chromium env T2_BROWSER_OUTPUT="$EVIDENCE/chromium" npm run test:t2:e2e -- --browser=chromium
run_step webkit env T2_BROWSER_OUTPUT="$EVIDENCE/webkit" npm run test:t2:e2e -- --browser=webkit
run_step task12-browser npm run test:task12:e2e -- --output="$EVIDENCE/task12-browser"
```

这些浏览器套件会在执行所在机器启动自己的正式合成服务，不能把Mac结果声称Ubuntu跨机浏览器验收。跨机页面复验按下述preview和SSH隧道步骤另行授权执行，并明确客户端/服务端位置。

既有 `npm run test:t2:preview` 配合绝对路径 `T2_WEB_BUILD` 可启动临时合成页面，进程仅监听127.0.0.1并输出随机端口及一次性合成账号。需要跨机访问时另行确认回环 SSH 隧道，仅转发该端口，不改监听为0.0.0.0、不开放公网。账号输出不写入PR或公开报告。

运行组合：Gateway、user、homework、resource、progress 正式工厂及真实 HTTP；analytics/notification 既有应用；临时数据库、临时媒体/journal。启用新完成协议，保留真实权限、凭据、索引、预检和上传保护；仅观测日志静默。trusted-local 不代表 ClamAV 实扫；新回收、恢复执行、v2 writer 和 D2b 装配关闭。

重点人工检查：提交一张图并刷新回看；按已见版本审核；审核后不用鼠标直接Tab/Shift+Tab/Escape，焦点留在弹窗且关闭后回到任务入口；内层隐私提示Escape不关闭外层；重登显式恢复原命令；切换孩子无旧图闪回；旧版本确认被拒；正常隐私删除后不可读取。
真实 iPad 另测相机/相册、多选、HEIC退路、物理断网、后台恢复及横竖屏。桌面 WebKit 通过不改变 DEVICE_PENDING。

## 5. 收尾与批准边界

使用测试进程自身SIGINT/正常退出收尾，核查临时服务/端口和临时Mongo已停止；只处理本轮创建的资源，不运行全局 prune、删卷或真实 cleanup/restore。保留候选SHA、失败/通过报告、脱敏证据及SHA-256清单。
若失败，冻结本轮报告并将缺陷返回开发，不提高超时或减少图规模。低配预算通过前 `QA-T2-D2B-BUDGET-001` 保持待验收。
复核原有服务身份/健康、源码和配置未变。服务器测试、合并main和真实家庭部署是三个不同授权；本清单最初仅准备，后续授权仅执行隔离合成测试，不合并、不部署。
