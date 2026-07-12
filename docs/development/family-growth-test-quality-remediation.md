# 家庭成长测试质量修订关闭记录

**Status:** VERIFIED
**Date:** 2026-07-12
**Scope:** Task 1-7 测试质量评审遗漏的选择性迁移
**Branch:** `codex/task1-7-remediation-closure`

## 审计结论

Task 1-6 的功能、需求追踪、基线标签和门禁均已进入 `main`。Task 7 的通知功能、v1.5 基线和后续代码评审修复也已通过 PR 合并。未合并内容仅存在于旧主工作区的未提交改动中，不存在于 stash 或未合并功能分支中。

本次没有复制旧工作区的整套前端测试改动。Task 8-11 已建立并合并新的 family-growth 前端测试基线，当前 `frontend/web` 默认 CI 通道包含 23 suites / 149 tests，旧版单一 smoke 和 legacy 文件命名已被替代。

## 已采纳内容

- 补充 `errorHandler` 的 MongoDB 连接错误、重复键和 timeout 边界测试。
- 补充 `familyAccess` 的空身份、非法 ID、student/parent 家庭范围和 lookup miss 测试。
- 补充 `starAwardClient` 的 4xx 不重试、重试耗尽和退避上界测试。
- 补充 notification source 的环境变量校验和超时降级测试。
- 修复 `notification-service` 默认启动参数，使 `ENABLE_RABBITMQ=false` 能关闭 RabbitMQ 连接。
- 删除没有被脚本或 CI 引用的 `jest.config.simple.js` 和 `jest.setup.simple.js`。
- 为五个已实测的关键文件设置文件级覆盖率阈值，不设置会混入 legacy 缺口的全局阈值。
- 新增 `scripts/check-git-clean.sh` 和临时 Git 仓库行为测试，并在 CI 全部测试完成后执行。

## 未采纳或已替代内容

- 不覆盖当前 `.github/workflows/ci-cd.yml`，仅追加洁净工作区步骤，保留 Task 11 浏览器门禁和失败证据上传。
- 不复制旧 `frontend/web/package.json`、lockfile、setup、smoke 或 legacy 文件名；这些内容已被 Task 8-11 的后续版本替代。
- 不从 Jest 主矩阵移除 `notification-family`；旧工作区中的该删除会降低回归覆盖。

## 已完成验证

| 检查 | 结果 |
| --- | --- |
| `errorHandler` + `familyAccess` | 2 suites / 33 tests passed |
| `starAwardClient` | 1 suite / 9 tests passed |
| notification focused | 2 suites / 17 tests passed |
| family-common coverage gate | 23 suites / 157 tests passed |
| clean-worktree behavior | clean、tracked dirty、untracked dirty 三种状态通过 |
| family regression | 62 suites / 713 tests passed |
| frontend CI | 23 suites / 149 tests passed |
| Task 11 integration + browser | 4 suites / 6 tests；4 browser tests passed |

测试质量修订已经在最新 `main` 基线的隔离分支上完成验证。PR 合并后，旧主工作区中对应的未提交副本不再代表待交付内容。
