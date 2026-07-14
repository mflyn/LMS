# 家庭成长跟踪部署文档

本目录是部署资料入口。部署命令必须以仓库中的实际 Compose、Kubernetes 清单和
当前基线为准，不使用历史文档中的示例域名、虚构目录或未部署基础设施。

## 当前入口

| 场景 | 入口 | 说明 |
| --- | --- | --- |
| 本地家庭 MVP | [`docker-compose.family.yml`](../../docker-compose.family.yml) | 最小家庭成长服务栈，适用于开发和验收 |
| 本地演示边界 | [总体架构第 9 节](../architecture/family-learning-tracker-architecture.md#9-本地演示部署) | 说明副本集、服务范围和非生产边界 |
| Kubernetes | [Kubernetes 部署说明](../../deployment/kubernetes/README.md) | 外部 Secret、最小工作负载和安全创建流程 |
| 配置与基础设施评审 | [修订记录](../development/family-growth-config-infra-remediation.md) | Compose、Kustomize、Secret 和发布门禁证据 |

## 部署边界

- `docker-compose.family.yml` 用于家庭 MVP；根目录 `docker-compose.yml` 保留学校版
  兼容服务，不是家庭 MVP 的最小验收拓扑。
- Kubernetes 部署前必须从外部安全注入 Secret，不得提交真实凭据或渲染后的
  Secret 清单。
- 构建、性能、安全和生产部署由显式发布流水线控制。普通 PR 中的跳过状态不等于
  已完成生产发布验收。
- 当前仓库清单用于开发和验收。生产环境仍需要托管数据库或多成员副本集、外部
  Secret、监控、备份和独立运维评审。

历史 Ubuntu 虚拟机、移动端和完整学校兼容栈资料不能作为家庭 MVP 的发布依据。
