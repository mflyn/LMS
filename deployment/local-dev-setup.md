# 本地开发环境快速配置指南

本文档提供了在特定环境下快速配置小学生学习追踪系统的步骤：
- 后端：Ubuntu 虚拟机
- 前端开发：MacBook Pro
- 移动端测试：iPhone

## 快速启动步骤

### 第一步：配置 Ubuntu 虚拟机（后端）

1. **安装 VirtualBox 和 Ubuntu**
   - 在 MacBook Pro 上下载并安装 [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
   - 下载 [Ubuntu 22.04 LTS 桌面版](https://ubuntu.com/download/desktop)
   - 创建新的虚拟机，分配至少 4GB 内存和 20GB 存储
   - 安装 Ubuntu 系统

2. **配置网络**
   - 设置网络为"桥接模式"，使虚拟机获取与主机相同网段的 IP
   - 启动虚拟机并记录 IP 地址：
     ```bash
     ip addr show
     ```

3. **安装 Docker 和 Docker Compose**
   ```bash
   # 更新系统
   sudo apt update && sudo apt upgrade -y
   
   # 安装 Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # 安装 Docker Compose
   sudo apt install docker-compose-plugin
   
   # 将用户添加到 docker 组
   sudo usermod -aG docker $USER
   
   # 重新登录以应用更改
   su - $USER
   ```

4. **克隆代码库并启动服务**
   ```bash
   # 克隆代码库
   git clone https://github.com/mflyn/LMS.git
   cd LMS
   
   # 启动后端服务
   cd deployment/docker
   docker compose up -d
   ```

5. **验证服务状态**
   ```bash
   # 检查服务状态
   docker compose ps
   
   # 测试 API
   curl http://localhost:3000/api/health
   ```

### 第二步：配置 MacBook Pro（前端）

1. **安装 Node.js 和开发工具**
   ```bash
   # 使用 Homebrew 安装 Node.js
   brew install node
   
   # 安装开发工具
   brew install git visual-studio-code
   ```

2. **克隆代码库**
   ```bash
   git clone https://github.com/mflyn/LMS.git
   cd LMS/frontend
   ```

3. **配置环境变量**
   ```bash
   # 创建环境变量文件
   cp .env.example .env.local
   
   # 编辑文件，设置 API 地址为虚拟机 IP
   echo "REACT_APP_API_URL=http://<虚拟机IP>:3000/api" > .env.local
   ```

4. **启动前端开发服务器**
   ```bash
   npm install
   npm start
   ```

### 第三步：配置 iPhone（移动端测试）

1. **使用 Safari 访问 Web 应用**
   - 确保 iPhone 与 MacBook Pro 在同一 Wi-Fi 网络
   - 在 Safari 中访问：`http://<MacBook的IP>:3000`

2. **添加到主屏幕**
   - 点击分享按钮
   - 选择"添加到主屏幕"
   - 输入应用名称并确认

3. **使用 Expo 测试原生应用（如果适用）**
   - 在 iPhone 上安装 Expo Go 应用
   - 在 MacBook 上启动 Expo 服务：
     ```bash
     cd LMS/mobile
     npm install
     npx expo start
     ```
   - 使用 Expo Go 扫描显示的二维码

## 网络配置优化

### 本地开发网络

1. **配置静态 IP（推荐）**
   - 在 Ubuntu 虚拟机中设置静态 IP：
     ```bash
     sudo nano /etc/netplan/01-netcfg.yaml
     ```
   - 添加配置：
     ```yaml
     network:
       version: 2
       ethernets:
         enp0s3:  # 网络接口名称可能不同
           dhcp4: no
           addresses: [192.168.1.100/24]  # 选择一个静态 IP
           gateway4: 192.168.1.1
           nameservers:
             addresses: [8.8.8.8, 8.8.4.4]
     ```
   - 应用配置：
     ```bash
     sudo netplan apply
     ```

2. **配置 hosts 文件**
   - 在 MacBook Pro 上：
     ```bash
     sudo nano /etc/hosts
     ```
   - 添加：
     ```
     192.168.1.100 backend.local
     ```
   - 在前端配置中使用 `backend.local` 代替 IP 地址

### 外网访问配置（可选）

1. **使用 ngrok 创建隧道**
   - 在 Ubuntu 虚拟机上安装 ngrok：
     ```bash
     curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
     echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
     sudo apt update && sudo apt install ngrok
     ```
   - 配置 ngrok：
     ```bash
     ngrok config add-authtoken <你的ngrok令牌>
     ```
   - 创建隧道：
     ```bash
     ngrok http 3000
     ```

2. **使用 Cloudflare Tunnel（替代方案）**
   - 安装 cloudflared：
     ```bash
     curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
     sudo dpkg -i cloudflared.deb
     ```
   - 登录 Cloudflare：
     ```bash
     cloudflared tunnel login
     ```
   - 创建隧道：
     ```bash
     cloudflared tunnel create dev-tunnel
     ```
   - 启动隧道：
     ```bash
     cloudflared tunnel run --url http://localhost:3000 dev-tunnel
     ```

## 性能优化建议

1. **虚拟机资源分配**
   - 为 Ubuntu 虚拟机分配至少 4GB 内存
   - 分配至少 2 个 CPU 核心
   - 启用 VT-x/AMD-V 虚拟化支持

2. **Docker 优化**
   - 使用卷挂载提高开发效率：
     ```yaml
     volumes:
       - ../../backend:/app
     ```
   - 定期清理 Docker 资源：
     ```bash
     docker system prune -a
     ```

3. **开发工作流优化**
   - 使用 Visual Studio Code 的远程 SSH 扩展直接在虚拟机上开发
   - 配置 Git 钩子自动部署代码更改
   - 使用 Docker Compose 的开发模式：
     ```bash
     docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
     ```

## 故障排除

### 常见问题

1. **后端服务无法启动**
   - 检查端口占用：`sudo lsof -i :3000,27017,6379`
   - 检查 Docker 日志：`docker compose logs -f`
   - 检查磁盘空间：`df -h`

2. **前端无法连接后端**
   - 检查网络连接：`ping <虚拟机IP>`
   - 检查 API 是否可访问：`curl http://<虚拟机IP>:3000/api/health`
   - 检查 CORS 配置

3. **移动端无法访问应用**
   - 确认设备在同一网络
   - 检查防火墙设置：`sudo ufw status`
   - 尝试使用 IP 地址而非主机名

### 快速修复命令

```bash
# 重启所有服务
docker compose down && docker compose up -d

# 清理 Docker 缓存
docker system prune -a

# 重置网络配置
sudo systemctl restart NetworkManager
```

---

如需更多帮助，请参考完整的[部署文档](./README.md)或联系开发团队。
