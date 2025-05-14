# Ubuntu 虚拟机后端环境配置指南

本文档提供了在 Ubuntu 虚拟机上配置小学生学习追踪系统后端环境的详细步骤。

## 虚拟机设置

### 系统要求

- **推荐配置**：
  - CPU：至少 2 核心
  - 内存：至少 4GB
  - 存储：至少 20GB
  - 网络：桥接模式

### 安装 VirtualBox 和 Ubuntu

1. **安装 VirtualBox**
   - 在 MacBook Pro 上下载并安装 [VirtualBox](https://www.virtualbox.org/wiki/Downloads)

2. **下载 Ubuntu 镜像**
   - 下载 [Ubuntu 22.04 LTS 桌面版](https://ubuntu.com/download/desktop)

3. **创建虚拟机**
   - 打开 VirtualBox，点击"新建"
   - 名称：`LMS-Backend`
   - 类型：Linux
   - 版本：Ubuntu (64-bit)
   - 内存大小：4096 MB
   - 创建虚拟硬盘：20 GB

4. **配置虚拟机设置**
   - 选择创建的虚拟机，点击"设置"
   - 系统 > 处理器：设置为 2 核心
   - 网络 > 适配器 1：设置为"桥接网卡"
   - 显示 > 显存大小：设置为 128 MB

5. **安装 Ubuntu**
   - 启动虚拟机，选择下载的 Ubuntu ISO 文件
   - 按照安装向导完成安装
   - 创建用户名和密码（例如：`lmsadmin`）

## 基础环境配置

### 系统更新与基础工具安装

```bash
# 更新软件包列表
sudo apt update
sudo apt upgrade -y

# 安装基本工具
sudo apt install -y curl wget git build-essential net-tools htop nano
```

### 配置网络

1. **查看网络接口**
   ```bash
   ip addr show
   ```

2. **配置静态 IP（推荐）**
   ```bash
   sudo nano /etc/netplan/01-netcfg.yaml
   ```

   添加以下配置（根据您的网络环境调整）：
   ```yaml
   network:
     version: 2
     ethernets:
       enp0s3:  # 您的网络接口名称可能不同
         dhcp4: no
         addresses: [192.168.1.100/24]  # 选择一个静态 IP
         gateway4: 192.168.1.1
         nameservers:
           addresses: [8.8.8.8, 8.8.4.4]
   ```

3. **应用网络配置**
   ```bash
   sudo netplan apply
   ```

4. **验证网络配置**
   ```bash
   ip addr show
   ping -c 4 google.com
   ```

### 安装 Docker 和 Docker Compose

1. **安装 Docker**
   ```bash
   # 卸载旧版本（如果存在）
   sudo apt remove docker docker-engine docker.io containerd runc

   # 安装依赖
   sudo apt install -y apt-transport-https ca-certificates gnupg lsb-release

   # 添加 Docker 官方 GPG 密钥
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

   # 设置稳定版仓库
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

   # 更新软件包索引并安装 Docker
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io
   ```

2. **安装 Docker Compose**
   ```bash
   # 安装 Docker Compose 插件
   sudo apt install -y docker-compose-plugin

   # 验证安装
   docker compose version
   ```

3. **配置 Docker 权限**
   ```bash
   # 将当前用户添加到 docker 组
   sudo usermod -aG docker $USER

   # 应用组更改（需要重新登录）
   newgrp docker
   ```

4. **验证 Docker 安装**
   ```bash
   # 运行测试容器
   docker run hello-world
   ```

## 部署后端服务

### 克隆代码库

```bash
# 创建项目目录
mkdir -p ~/projects
cd ~/projects

# 克隆代码库
git clone https://github.com/mflyn/LMS.git
cd LMS
```

### 配置环境变量

```bash
# 复制示例环境变量文件
cp .env.example .env

# 编辑环境变量
nano .env
```

修改以下关键配置：
```
# 数据库配置
MONGODB_URI=mongodb://mongodb:27017/education
REDIS_URI=redis://redis:6379

# JWT 配置
JWT_SECRET=your_strong_secret_key_here
JWT_EXPIRES_IN=1d

# 服务配置
PORT=3000
NODE_ENV=development

# 日志配置
LOG_LEVEL=info
```

### 使用 Docker Compose 启动服务

```bash
# 进入部署目录
cd deployment/docker

# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 验证服务状态

```bash
# 检查 API 健康状态
curl http://localhost:3000/api/health

# 检查 MongoDB 连接
docker compose exec mongodb mongosh --eval "db.stats()"

# 检查 Redis 连接
docker compose exec redis redis-cli ping
```

## 开发环境配置（可选）

如果您需要在虚拟机上直接开发，而不仅仅是运行 Docker 容器，请按照以下步骤配置开发环境：

### 安装 Node.js

```bash
# 使用 NVM 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

# 加载 NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装 Node.js LTS 版本
nvm install --lts

# 验证安装
node --version
npm --version
```

### 安装 MongoDB（本地开发用）

```bash
# 导入公钥
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# 创建列表文件
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# 更新软件包列表
sudo apt update

# 安装 MongoDB
sudo apt install -y mongodb-org

# 启动 MongoDB 服务
sudo systemctl start mongod
sudo systemctl enable mongod

# 验证 MongoDB 状态
sudo systemctl status mongod
```

### 安装开发工具

```bash
# 安装 VS Code Server（用于远程开发）
wget -O- https://aka.ms/install-vscode-server/setup.sh | sh

# 启动 VS Code Server
code-server
```

## 性能优化

### Docker 性能优化

1. **调整 Docker 守护进程配置**
   ```bash
   sudo nano /etc/docker/daemon.json
   ```

   添加以下配置：
   ```json
   {
     "default-address-pools": [
       {"base": "172.17.0.0/16", "size": 24}
     ],
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "10m",
       "max-file": "3"
     }
   }
   ```

2. **重启 Docker 服务**
   ```bash
   sudo systemctl restart docker
   ```

### 系统性能优化

1. **调整 Swappiness**
   ```bash
   # 检查当前值
   cat /proc/sys/vm/swappiness

   # 设置更低的值（减少使用交换空间）
   sudo sysctl vm.swappiness=10
   
   # 使设置永久生效
   echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
   ```

2. **增加文件描述符限制**
   ```bash
   sudo nano /etc/security/limits.conf
   ```

   添加以下行：
   ```
   *       soft    nofile  65535
   *       hard    nofile  65535
   ```

## 安全配置

### 基本安全设置

1. **配置防火墙**
   ```bash
   # 安装 UFW
   sudo apt install -y ufw

   # 设置默认策略
   sudo ufw default deny incoming
   sudo ufw default allow outgoing

   # 允许 SSH
   sudo ufw allow ssh

   # 允许 Web 服务
   sudo ufw allow 80/tcp
   sudo ufw allow 3000/tcp

   # 启用防火墙
   sudo ufw enable

   # 检查状态
   sudo ufw status
   ```

2. **安装和配置 Fail2ban**
   ```bash
   # 安装 Fail2ban
   sudo apt install -y fail2ban

   # 创建配置文件
   sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
   sudo nano /etc/fail2ban/jail.local
   ```

   修改以下设置：
   ```
   [sshd]
   enabled = true
   port = ssh
   filter = sshd
   logpath = /var/log/auth.log
   maxretry = 5
   bantime = 3600
   ```

   重启服务：
   ```bash
   sudo systemctl restart fail2ban
   ```

## 故障排除

### 常见问题和解决方案

1. **Docker 服务无法启动**
   ```bash
   # 检查 Docker 服务状态
   sudo systemctl status docker

   # 查看 Docker 日志
   sudo journalctl -u docker.service

   # 重启 Docker 服务
   sudo systemctl restart docker
   ```

2. **容器无法访问网络**
   ```bash
   # 检查 Docker 网络
   docker network ls
   docker network inspect bridge

   # 重新创建默认网络
   docker network rm bridge
   docker network create bridge
   ```

3. **磁盘空间不足**
   ```bash
   # 检查磁盘使用情况
   df -h

   # 清理 Docker 资源
   docker system prune -a --volumes

   # 清理日志文件
   sudo find /var/log -type f -name "*.log" -exec truncate -s 0 {} \;
   ```

4. **内存不足**
   ```bash
   # 检查内存使用情况
   free -h

   # 清理缓存
   sudo sync && sudo echo 3 | sudo tee /proc/sys/vm/drop_caches
   ```

## 备份与恢复

### 数据备份

1. **创建备份脚本**
   ```bash
   nano ~/backup.sh
   ```

   添加以下内容：
   ```bash
   #!/bin/bash
   TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
   BACKUP_DIR=~/backups

   # 创建备份目录
   mkdir -p $BACKUP_DIR

   # 备份 MongoDB 数据
   docker compose exec -T mongodb mongodump --archive --gzip > $BACKUP_DIR/mongodb_$TIMESTAMP.gz

   # 备份环境变量
   cp .env $BACKUP_DIR/env_$TIMESTAMP.bak

   # 备份 Docker Compose 配置
   cp docker-compose.yml $BACKUP_DIR/docker-compose_$TIMESTAMP.yml

   echo "Backup completed: $TIMESTAMP"
   ```

2. **设置执行权限**
   ```bash
   chmod +x ~/backup.sh
   ```

3. **设置定时备份**
   ```bash
   crontab -e
   ```

   添加以下行（每天凌晨 2 点执行备份）：
   ```
   0 2 * * * ~/backup.sh >> ~/backup.log 2>&1
   ```

### 数据恢复

1. **从备份恢复 MongoDB 数据**
   ```bash
   # 恢复 MongoDB 数据
   cat ~/backups/mongodb_TIMESTAMP.gz | docker compose exec -T mongodb mongorestore --archive --gzip
   ```

2. **恢复环境变量和配置**
   ```bash
   # 恢复环境变量
   cp ~/backups/env_TIMESTAMP.bak .env

   # 恢复 Docker Compose 配置
   cp ~/backups/docker-compose_TIMESTAMP.yml docker-compose.yml
   ```

---

如需更多帮助，请参考[完整部署文档](./README.md)或联系开发团队。
