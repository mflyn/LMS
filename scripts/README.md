# 脚本使用说明

本目录包含了小学生学习追踪系统的各种实用脚本。

## 依赖安装脚本

### 1. 完整版安装脚本 (推荐)

**文件**: `install-from-official.sh`

**功能**: 
- 完整的官网依赖拉取流程
- 包含网络检查、缓存清理、安装验证等功能
- 详细的日志输出和错误处理
- 安装统计信息显示

**使用方法**:
```bash
# Linux/macOS
./scripts/install-from-official.sh

# Windows
scripts\install-from-official.bat
```

**特性**:
- ✅ 自动检查网络连接
- ✅ 清理旧的缓存和锁定文件
- ✅ 彩色日志输出
- ✅ 错误处理和回滚
- ✅ 安装验证
- ✅ 耗时统计

### 2. 快速安装脚本

**文件**: `quick-install.sh`

**功能**: 
- 简化的快速安装流程
- 适合网络环境良好的情况
- 无额外验证，直接安装

**使用方法**:
```bash
./scripts/quick-install.sh
```

**特性**:
- 🚀 快速执行
- 📦 简洁输出
- ⚡ 适合重复安装

### 3. 多包管理器安装脚本 (推荐)

**文件**: `install-with-manager.sh`

**功能**: 
- 支持 npm、yarn、pnpm 三种包管理器
- 自动检测可用的包管理器
- 提供性能对比和命令参考
- 交互式选择安装方式

**使用方法**:
```bash
./scripts/install-with-manager.sh
```

**特性**:
- 🔧 多包管理器支持
- 📊 性能对比展示
- 🎯 智能检测和选择
- 📋 命令对比表格

## 安装的项目组件

脚本会自动安装以下组件的依赖：

### 前端组件
- **Web 前端** (`frontend/web/`)
  - React 18
  - Ant Design 5
  - React Router 6
  - Chart.js
  - Zustand 状态管理

- **移动端** (`frontend/mobile/`)
  - React Native
  - Expo
  - React Navigation 6
  - React Native Paper

### 后端组件
- **API 网关** (`backend/gateway/`)
  - Express
  - HTTP 代理
  - 安全中间件

- **微服务** (`backend/services/`)
  - analytics-service (数据分析)
  - data-service (数据管理)
  - homework-service (作业管理)
  - interaction-service (交互服务)
  - progress-service (进度跟踪)
  - resource-service (资源管理)
  - user-service (用户管理)

### 测试组件
- **测试框架** (`backend/tests/`)
  - Jest 测试框架
  - 集成测试
  - 性能测试

## 使用前准备

### 1. 网络代理配置 (如需要)

如果您在国内网络环境下，建议先配置代理：

```bash
# 设置 HTTP 代理 (示例)
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890

# 或使用您的代理配置
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
```

### 2. 系统要求

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **系统**: Linux/macOS/Windows
- **内存**: 建议 4GB 以上
- **磁盘**: 建议 2GB 以上空闲空间

## 安装后验证

### 自动验证脚本 (推荐)

使用我们提供的验证脚本快速检查安装结果：

```bash
./scripts/verify-installation.sh
```

该脚本会自动检查：
- ✅ Node.js 和包管理器环境
- ✅ 所有 node_modules 目录
- ✅ 关键依赖包的存在
- ✅ 磁盘使用情况统计
- ✅ 生成详细的验证报告

### 手动验证

安装完成后，也可以通过以下命令手动验证：

```bash
# 验证后端
npm test

# 启动前端 Web
cd frontend/web && npm start

# 启动移动端开发服务器
cd frontend/mobile && npm start

# 启动完整系统 (需要 Docker)
docker-compose up
```

## 常见问题

### 1. 网络超时

**问题**: npm install 过程中出现网络超时
**解决**: 
- 检查网络代理配置
- 使用 `npm config set timeout 300000` 增加超时时间
- 重新运行安装脚本

### 2. 权限问题

**问题**: 在 Linux/macOS 上出现权限错误
**解决**:
```bash
# 修复脚本权限
chmod +x scripts/*.sh

# 如果是 npm 全局包权限问题
sudo chown -R $(whoami) ~/.npm
```

### 3. 磁盘空间不足

**问题**: 安装过程中磁盘空间不足
**解决**:
- 清理系统临时文件
- 清理 npm 缓存: `npm cache clean --force`
- 确保至少有 2GB 空闲空间

### 4. 依赖冲突

**问题**: 出现依赖版本冲突
**解决**:
```bash
# 清理所有 node_modules 和 package-lock.json
find . -name "node_modules" -type d -exec rm -rf {} +
find . -name "package-lock.json" -delete

# 重新运行安装脚本
./scripts/install-from-official.sh
```

## 其他脚本

### 验证脚本
- `verify-installation.sh` - 验证依赖安装结果，生成详细报告

### 清理脚本
- `clean-coverage.sh` - 清理测试覆盖率文件
- `find-coverage-files.sh` - 查找覆盖率文件

### Docker 相关
- `fix-docker-registry.sh` - 修复 Docker 镜像源

## 脚本选择建议

根据不同场景选择合适的安装脚本：

| 场景 | 推荐脚本 | 说明 |
|------|----------|------|
| 首次安装 | `install-with-manager.sh` | 可选择包管理器，提供详细信息 |
| 生产环境 | `install-from-official.sh` | 完整验证，错误处理完善 |
| 开发调试 | `quick-install.sh` | 快速安装，适合重复操作 |
| Windows 用户 | `install-from-official.bat` | Windows 批处理版本 |
| 安装验证 | `verify-installation.sh` | 验证安装结果 |

## 使用流程建议

1. **首次安装**:
   ```bash
   ./scripts/install-with-manager.sh
   ./scripts/verify-installation.sh
   ```

2. **重新安装**:
   ```bash
   # 清理旧依赖
   find . -name "node_modules" -type d -exec rm -rf {} +
   find . -name "package-lock.json" -delete
   
   # 重新安装
   ./scripts/install-from-official.sh
   ./scripts/verify-installation.sh
   ```

3. **快速更新**:
   ```bash
   ./scripts/quick-install.sh
   ```

## 技术支持

如果在使用过程中遇到问题，请：

1. 查看脚本输出的错误信息
2. 检查网络连接和代理配置
3. 确认系统环境满足要求
4. 查看项目的 GitHub Issues

---

**注意**: 首次安装可能需要较长时间，请耐心等待。建议在网络环境良好的情况下进行安装。 