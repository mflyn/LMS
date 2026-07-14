# 历史文档归档

本目录保存仍有追溯价值、但不再定义当前产品或工程行为的文档。归档内容不得
作为需求、API、架构、测试或部署的现行依据。

## Task J 迁移记录

| 原路径 | 处理 | 原因 | 当前依据 |
| --- | --- | --- | --- |
| `docs/api.md` | 删除 | 包含示例域名及学校版学生、成绩、作业接口，与当前契约冲突 | [家庭成长 API](../../api/family-learning-tracker-api.md) |
| `docs/deployment.md` | 删除 | PM2、手工 Nginx 和旧目录命令未被当前部署清单验证 | [部署入口](../../deployment/README.md) |
| `docs/dependencies.md` | 删除 | 与中文副本重复，版本清单会偏离实际锁文件 | 各工作区 `package.json` 和 lockfile |
| `docs/项目依赖说明.md` | 删除 | 与英文副本重复，包含手工安装整组依赖的过时建议 | 各工作区 `package.json` 和 lockfile |
| `docs/设计文档.md` | 归档并标记 `SUPERSEDED` | 保存学校级 LMS 的历史设计背景，但不再是家庭成长基线 | [历史设计](./legacy-school-lms-design-v1.2.md)、[当前架构](../../architecture/family-learning-tracker-architecture.md) |
| `docs/test-coverage-management.md` | 迁移并修订 | 内容仍有工程价值，但应归属开发文档并纠正 npm `precommit` 说明 | [覆盖率产物管理](../test-coverage-file-management.md) |

## 归档规则

1. 归档文件必须在顶部标记 `SUPERSEDED`，说明原路径、归档日期和替代文档。
2. 现行 README、API 和架构索引不得链接到归档内容作为权威来源。
3. 需要恢复历史设计中的能力时，应重新进入需求和设计评审，不直接恢复旧契约。
