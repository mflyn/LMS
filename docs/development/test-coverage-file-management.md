# 测试覆盖率产物管理

本文档说明如何识别、忽略和清理测试生成的覆盖率及报告产物。测试策略、套件范围
和门禁要求仍以[家庭成长测试策略](./family-growth-test-strategy.md)及各 Task gate
为准。

## 1. 当前控制点

| 控制点 | 作用 |
| --- | --- |
| 根目录 `.gitignore` | 忽略 `coverage/`、`.nyc_output/`、`test-results/`、LCOV、Jest 报告等常见产物 |
| 测试目录 `.gitignore` | 对 `backend/__tests__/` 和 `backend/services/user-service/test/` 的局部产物补充忽略规则 |
| `.gitattributes` | 将覆盖率报告标记为生成内容，避免影响语言统计 |
| `scripts/find-coverage-files.sh` | 查找常见覆盖率目录、报告和 Jest 缓存 |
| `scripts/clean-coverage.sh` | 删除工作区中的常见覆盖率目录、报告和 Jest 缓存 |
| `scripts/remove-coverage-from-git.sh` | 从 Git 索引移除已被跟踪的常见覆盖率产物 |

`package.json` 中的 `precommit` 是 npm 脚本，不会自行安装或替代 Git
`pre-commit` hook。提交前需要显式运行清理或依赖 CI 的工作区清洁检查。

## 2. 常用命令

### 查找产物

```bash
npm run find:coverage
```

该命令只列出匹配项，不修改文件。

### 清理本地产物

```bash
npm run clean:coverage
```

也可以直接运行：

```bash
./scripts/clean-coverage.sh
```

清理脚本会递归删除常见覆盖率目录和报告。不要在测试或报告生成仍在运行时执行。

### 执行不生成覆盖率的回归

```bash
npm run test:nocoverage
```

该入口依次执行家庭回归和遗留回归，适合验证功能回归，但不能替代要求覆盖率的
专项门禁。

### 处理已经被 Git 跟踪的产物

```bash
npm run remove:coverage-git
git status --short
git diff --cached
```

确认暂存删除只包含生成产物后，再按正常评审流程提交。脚本不会替代人工检查，
也不应使用强制重置来清理工作区。

## 3. 提交前检查

1. 运行 `npm run find:coverage`。
2. 必要时运行 `npm run clean:coverage`。
3. 运行 `git status --short`，确认没有覆盖率或测试报告被跟踪。
4. 执行当前 Task 要求的测试和 `scripts/check-git-clean.sh`。

更新产物类型或测试工具时，应同步修改 `.gitignore`、清理/查找脚本和本文档。
