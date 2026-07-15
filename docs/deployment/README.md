# 家庭成长跟踪部署文档

本目录是部署资料入口。部署命令必须以仓库中的实际 Compose、Kubernetes 清单和
当前基线为准，不使用历史文档中的示例域名、虚构目录或未部署基础设施。

## 发布前统一 Gate

家庭 MVP 的唯一仓库级发布前验证入口是：

```bash
npm run release:family
```

运行环境必须提供 Node.js 22、与 lockfile 匹配的 npm、Docker Engine、Docker Compose
v2，以及安装 Playwright Chromium 所需的网络和系统能力。Linux CI 如需
同时安装浏览器系统依赖，设置：

```bash
RELEASE_GATE_INSTALL_BROWSER_DEPS=1 npm run release:family
```

该命令从 root/frontend clean install 开始，依次执行 lint、家庭文档契约、70-suite
backend family regression、Task 11 integration、25-suite frontend test、production
build、4 个 Chromium E2E、Compose config/build/start/health、真实 gateway 私有媒体
smoke 和 Git hygiene。任一步骤失败都阻断发布，不能用单个服务或历史 Task Gate
代替。

默认诊断目录是 `release-gate-artifacts/`，可用
`RELEASE_GATE_ARTIFACT_DIR=/absolute/path` 覆盖。目录包含分阶段日志、Compose
状态/日志/teardown 日志和带实际 commit 的 summary。脚本在成功、失败和中断时
都会清理本次容器及网络，但不删除持久卷；需要删卷时必须由操作者另行确认。

## 私有媒体安全配置

默认 `docker-compose.family.yml` 和 `docker-compose.ubuntu.yml` 显式使用
`MEDIA_SECURITY_PROFILE=trusted-local`，不启动 ClamAV。该配置面向可信家庭成员和
私有局域网：图片/PDF 仍执行类型、大小、页数、主动内容检查和规范化，但没有恶意
软件扫描，不能对外宣称文件已扫描或用于不可信上传入口。

`secure-production` 通过 [`docker-compose.security.yml`](../../docker-compose.security.yml)
叠加启用。ClamAV 只连接内部 scanner 网络，不发布宿主机端口；resource-service
等待扫描器健康并在扫描器不可用时拒绝上传，不会自动降级。该叠加层为扫描器限制
4 GiB 内存和 1 CPU，运行完整家庭栈的主机应有至少 10 GiB 可供 Docker 使用。

真实扫描验收是独立的受保护命令，不属于低资源发布 Gate：

```bash
RUN_FAMILY_SECURITY_SCAN=1 npm run test:family-security-scan
```

命令检查 Docker 内存、构建并启动安全叠加层，验证安全 PDF 的上传/绑定/下载以及
运行时生成测试内容的 `MALWARE_DETECTED` 拒绝，随后无条件删除本次容器和卷。只有
在容量充足的隔离 runner 上执行；不要在 8 GiB 家庭服务器上运行。未通过该命令的
候选版本可以按 `trusted-local` 私有家庭边界验收，但不能批准为 `secure-production`。

## 当前入口

| 场景 | 入口 | 说明 |
| --- | --- | --- |
| 本地家庭 MVP | [`docker-compose.family.yml`](../../docker-compose.family.yml) | 最小家庭成长服务栈，适用于开发和验收 |
| Ubuntu 家庭服务器 | [部署指南](local-ubuntu-deployment.md) / [`docker-compose.ubuntu.yml`](../../docker-compose.ubuntu.yml) | 8GB 级家庭服务器的局域网部署、备份、恢复和安全边界 |
| 统一发布证据 | [v1.6 Release Gate](../development/family-growth-v1.6-release-gate.md) | 命令、通过条件、运行证据、失败诊断和审批边界 |
| 当前候选基线 | [FGT-MVP-1.6 manifest](../development/family-growth-baseline-v1.6-manifest.md) | 当前证据提交、35 项需求状态和签署状态 |
| 本地演示边界 | [总体架构第 9 节](../architecture/family-learning-tracker-architecture.md#9-本地演示部署) | 说明副本集、服务范围和非生产边界 |
| Kubernetes | [Kubernetes 部署说明](../../deployment/kubernetes/README.md) | 外部 Secret、最小工作负载和安全创建流程 |
| 配置与基础设施评审 | [修订记录](../development/family-growth-config-infra-remediation.md) | Compose、Kustomize、Secret 和发布门禁证据 |
| PDF 与多附件安全 Gate | [增量 Gate](../development/family-growth-mistake-pdf-multi-attachments-gate.md) | 两档安全配置、自动化证据和真实扫描审批边界 |

## 部署边界

- `docker-compose.family.yml` 用于家庭 MVP；根目录 `docker-compose.yml` 保留学校版
  兼容服务，不是家庭 MVP 的最小验收拓扑。
- Kubernetes 部署前必须从外部安全注入 Secret，不得提交真实凭据或渲染后的
  Secret 清单。
- 构建、性能、安全和生产部署由显式发布流水线控制。普通 PR 中的跳过状态不等于
  已完成生产发布验收。
- 当前仓库清单用于开发和验收。生产环境仍需要托管数据库或多成员副本集、外部
  Secret、监控、备份和独立运维评审。

## 本地验收与故障处理

只需要启动服务进行人工验收时，可执行：

```bash
docker compose -f docker-compose.family.yml up -d --build --wait
docker compose -f docker-compose.family.yml ps
docker compose -f docker-compose.family.yml down --remove-orphans
```

这不是统一发布 Gate 的替代入口。若启动或 smoke 失败：

1. 查看 `docker compose -f docker-compose.family.yml ps --all` 和 `logs --no-color`。
2. 区分镜像构建、MongoDB replica-set 初始化、应用 healthcheck 和 gateway smoke
   的首个失败点。
3. 使用 `down --remove-orphans` 清理容器和网络；不要把 `--volumes` 加入自动失败
   路径。
4. 修复后从 clean install 重新执行 `npm run release:family`，不能只重跑失败步骤
   作为发布结论。

## Secret、数据与回滚

- 本地默认 Secret 仅用于隔离开发/验收，严禁用于共享或生产环境。
- Kubernetes 使用外部 Secret 工作流；真实 JWT、身份信封、服务凭据、媒体签名
  密钥和数据库凭据不得提交到 Git、普通日志或渲染产物。
- Family、Child、GrowthTask、奖励和私有媒体均为持久业务数据。发布失败不能通过
  自动删卷“恢复”；必须根据目标环境备份、迁移和恢复手册处理。
- 应用回滚以已验证镜像/清单版本为单位。兼容回滚可停用家庭路由，但不删除家庭
  或学校数据。数据库/契约存在不可逆变化时，必须先完成独立迁移评审。
- 生产发布还需要目标环境的 TLS、容量、监控告警、备份恢复、灾备、k6/ZAP 和
  回滚演练证据；本地 Compose Gate 不代表这些运维签署已经完成。

历史 Ubuntu 虚拟机、移动端和完整学校兼容栈资料不能作为家庭 MVP 的发布依据。
