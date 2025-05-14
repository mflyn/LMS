# 本地开发环境部署指南

本文档提供了在本地环境中部署小学生学习追踪系统的详细步骤，适用于以下环境配置：
- 后端服务器：Ubuntu 虚拟机
- 前端开发客户端：MacBook Pro
- 移动端测试设备：iPhone

## 快速导航

- [快速设置指南](./local-dev-setup.md) - 简化的本地开发环境配置步骤
- [Ubuntu 虚拟机配置详解](./ubuntu-vm-setup.md) - 后端服务器详细配置指南
- [移动端开发与测试指南](./mobile-setup.md) - iPhone 设备配置与测试指南
- [Docker 配置](./docker/docker-compose.yml) - Docker Compose 配置文件

## 目录

- [环境要求](#环境要求)
- [后端部署（Ubuntu 虚拟机）](#后端部署ubuntu-虚拟机)
- [前端部署（MacBook Pro）](#前端部署macbook-pro)
- [移动端配置（iPhone）](#移动端配置iphone)
- [网络配置](#网络配置)
- [常见问题](#常见问题)

## 环境要求

### Ubuntu 虚拟机（后端服务器）
- 操作系统：Ubuntu 20.04 LTS 或更高版本
- CPU：至少 2 核
- 内存：至少 4GB
- 存储空间：至少 20GB
- 软件要求：
  - Docker 20.10.x 或更高版本
  - Docker Compose 2.x 或更高版本
  - Git
  - Node.js 18.x 或更高版本（可选，用于直接运行服务）

### MacBook Pro（前端开发）
- 操作系统：macOS Monterey 或更高版本
- 软件要求：
  - Node.js 18.x 或更高版本
  - npm 8.x 或更高版本
  - Git
  - Visual Studio Code 或其他代码编辑器
  - Chrome 或 Safari 浏览器

### iPhone（移动端测试）
- iOS 15 或更高版本
- Safari 浏览器
- 可选：Expo Go 应用（用于 React Native 开发）

## 后端部署（Ubuntu 虚拟机）

### 1. 安装必要软件

```bash
# 更新软件包列表
sudo apt update
sudo apt upgrade -y

# 安装基本工具
sudo apt install -y curl git build-essential

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 将当前用户添加到 docker 组（免 sudo 运行 docker）
sudo usermod -aG docker $USER
# 注意：需要重新登录才能生效
```

### 2. 克隆代码库

```bash
# 克隆代码库
git clone https://github.com/mflyn/LMS.git
cd LMS
```

### 3. 配置环境变量

```bash
# 创建环境变量文件
cp .env.example .env

# 编辑环境变量
nano .env
```

修改以下关键配置：
- `MONGODB_URI`：MongoDB 连接字符串
- `REDIS_URI`：Redis 连接字符串
- `JWT_SECRET`：JWT 密钥（请使用强密码）
- `API_URL`：API 服务器 URL（设置为虚拟机的 IP 地址）

### 4. 使用 Docker Compose 启动后端服务

```bash
# 进入部署目录
cd deployment/docker

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 5. 验证后端服务

```bash
# 测试 API 服务
curl http://localhost:3000/api/health

# 查看 MongoDB 状态
docker-compose exec mongodb mongo --eval "db.stats()"

# 查看 Redis 状态
docker-compose exec redis redis-cli ping
```

## 前端部署（MacBook Pro）

### 1. 安装必要软件

```bash
# 安装 Node.js 和 npm（使用 Homebrew）
brew install node

# 验证安装
node --version
npm --version
```

### 2. 克隆代码库

```bash
# 克隆代码库
git clone https://github.com/mflyn/LMS.git
cd LMS/frontend
```

### 3. 配置环境变量

```bash
# 创建环境变量文件
cp .env.example .env.local
```

编辑 `.env.local` 文件，设置 API 地址为 Ubuntu 虚拟机的 IP 地址：

```
REACT_APP_API_URL=http://<虚拟机IP>:3000/api
```

### 4. 安装依赖并启动开发服务器

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start
```

前端应用将在 http://localhost:3000 启动。

## 移动端配置（iPhone）

### 方法 1：使用响应式 Web 应用

1. 在 iPhone 的 Safari 浏览器中访问前端应用的 URL：
   - 如果在同一网络：http://<MacBook的IP>:3000
   - 如果使用 ngrok 等工具进行隧道：https://<ngrok生成的域名>

2. 添加到主屏幕：
   - 点击分享按钮
   - 选择"添加到主屏幕"
   - 输入应用名称并确认

### 方法 2：使用 React Native 应用（如果项目包含）

1. 在 MacBook Pro 上安装 Expo CLI：
   ```bash
   npm install -g expo-cli
   ```

2. 在移动端目录启动 Expo 开发服务器：
   ```bash
   cd LMS/mobile
   npm install
   expo start
   ```

3. 在 iPhone 上安装 Expo Go 应用

4. 使用 Expo Go 扫描 MacBook 上显示的二维码

## 网络配置

### 本地网络配置

1. 确保 Ubuntu 虚拟机和 MacBook Pro 在同一网络中

2. 在 Ubuntu 虚拟机上查找 IP 地址：
   ```bash
   ip addr show
   ```

3. 配置虚拟机网络为"桥接模式"，使其能够获取与主机相同网段的 IP 地址

4. 在 MacBook 上修改 hosts 文件（可选）：
   ```bash
   sudo nano /etc/hosts
   ```
   添加：
   ```
   <虚拟机IP> backend.local
   ```

### 使用 ngrok 进行外网访问（可选）

1. 在 Ubuntu 虚拟机上安装 ngrok：
   ```bash
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update
   sudo apt install ngrok
   ```

2. 配置 ngrok 认证令牌：
   ```bash
   ngrok config add-authtoken <你的ngrok令牌>
   ```

3. 创建 ngrok 隧道：
   ```bash
   ngrok http 3000
   ```

4. 使用生成的 ngrok URL 更新前端配置

## 常见问题

### 后端服务无法启动

1. 检查 Docker 和 Docker Compose 是否正确安装：
   ```bash
   docker --version
   docker-compose --version
   ```

2. 检查端口占用情况：
   ```bash
   sudo netstat -tulpn | grep -E '3000|27017|6379|5672'
   ```

3. 检查 Docker 日志：
   ```bash
   docker-compose logs -f
   ```

### 前端无法连接到后端

1. 确认后端服务已启动并正常运行

2. 检查 API URL 配置是否正确

3. 检查网络连接：
   ```bash
   ping <虚拟机IP>
   curl -v http://<虚拟机IP>:3000/api/health
   ```

4. 检查防火墙设置：
   ```bash
   sudo ufw status
   ```

### 移动端无法访问应用

1. 确保 iPhone 和 MacBook Pro 在同一网络中

2. 检查 MacBook Pro 的防火墙设置

3. 尝试使用 ngrok 创建公共 URL

## 开发工作流程

1. 在 MacBook Pro 上进行前端开发
2. 在 Ubuntu 虚拟机上运行后端服务
3. 使用 iPhone 测试移动端体验
4. 使用 Git 进行版本控制和代码同步

## 性能优化建议

1. 为 Ubuntu 虚拟机分配足够的资源（至少 4GB 内存）
2. 考虑使用 Docker 卷挂载提高开发效率
3. 使用本地网络而非公共网络进行开发，减少延迟
4. 定期清理 Docker 缓存和未使用的镜像：
   ```bash
   docker system prune -a
   ```

## 总结

本文档提供了在特定环境（Ubuntu 虚拟机、MacBook Pro 和 iPhone）中部署小学生学习追踪系统的详细步骤。为了更好地满足不同需求，我们还提供了以下专门的指南：

1. **[快速设置指南](./local-dev-setup.md)** - 简化的步骤，适合快速启动开发环境
2. **[Ubuntu 虚拟机配置详解](./ubuntu-vm-setup.md)** - 后端服务器的详细配置说明
3. **[移动端开发与测试指南](./mobile-setup.md)** - iPhone 设备的配置与测试方法

这种部署方式的优势在于：
- 开发环境与生产环境隔离，避免相互影响
- 虚拟机提供了与生产环境类似的 Linux 环境
- 前端开发可以在熟悉的 macOS 环境中进行
- 移动端测试可以直接在真实设备上进行

建议按照以下工作流程进行开发：
1. 在 Ubuntu 虚拟机上运行后端服务
2. 在 MacBook Pro 上进行前端开发
3. 使用 iPhone 测试移动端体验
4. 使用 Git 进行版本控制和代码同步

---

如需更多帮助，请参考项目文档或联系开发团队。
