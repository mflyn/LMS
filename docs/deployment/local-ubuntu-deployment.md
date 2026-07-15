# 本地 Ubuntu 服务器部署指南

> 文档状态：已按 FGT-MVP-1.6 仓库配置完成静态校验；实际硬件、NAS 和家庭网络仍需按本文执行部署验收。
>
> 适用场景：旧笔记本 / 迷你主机安装 Ubuntu Server，运行家庭成长跟踪 MVP
>
> 硬件要求：x86_64 CPU、4 核、8GB RAM、120GB+ SSD。20GB 磁盘不足以同时保存 Docker 镜像、MongoDB、附件、日志和备份。
>
> 媒体安全边界：8GB 机器使用 `trusted-local`，只允许可信家庭成员在私有局域网上传。该模式会严格检查并规范化图片/PDF，但不运行 ClamAV，不等于恶意软件已扫描。互联网暴露或不可信上传必须迁移到容量充足且通过独立扫描 Gate 的 `secure-production` 环境。
>
> 部署边界：本文只部署家庭成长 MVP（LMS）。DeepTutor、AutoClaw 和本地大模型不是首轮必需组件；DeepTutor 后续应先调用云端模型 API，不在这台旧电脑上部署 GPU 推理。

---

## 目录

1. [系统安装准备](#1-系统安装准备)
2. [Ubuntu Server 安装](#2-ubuntu-server-安装)
3. [基础环境配置](#3-基础环境配置)
4. [部署项目](#4-部署项目)
5. [验证与使用](#5-验证与使用)
6. [系统服务配置](#6-系统服务配置)
7. [长期运行建议](#7-长期运行建议)
8. [安全与远程访问](#8-安全与远程访问)
9. [故障排查](#9-故障排查)

---

## 1. 系统安装准备

### 1.1 制作启动盘

从 Ubuntu 官网下载 Server LTS 镜像：

```
https://ubuntu.com/download/server
```

推荐版本：**Ubuntu Server 22.04 LTS** 或 **24.04 LTS**。

使用 Rufus（Windows）写入 U 盘：

```
设备       → 选择 U 盘
引导类型   → 从 ISO 写入（选择下载的 .iso）
分区类型   → GPT
目标系统   → UEFI
```

### 1.2 BIOS 设置

进入 BIOS（开机按 F2 / F10 / Del），做以下调整：

| 设置 | 值 |
|------|-----|
| 关闭盖子 | **不采取任何操作**（Do Nothing）|
| 通电自动开机 | 启用（Power On AC Restore）|
| 启动顺序 | U 盘优先 |
| 虚拟化（VT-x/AMD-V）| 可选；Linux Docker 不依赖它，但以后运行虚拟机时会需要 |

### 1.3 硬件检查清单

| 检查项 | 备注 |
|--------|------|
| 硬盘类型 | 必须优先使用 SSD；120GB 是下限，240GB 更从容 |
| 内存 | 8GB 只适合 LMS；要同时运行 DeepTutor 容器，建议升级到 16GB |
| 散热 | 清灰、检查风扇；持续运行时观察温度和异常噪声 |
| 电源 | 笔记本电池是否保留应以厂商说明为准；台式机建议配小型 UPS 防止突然断电 |
| 网络 | 优先有线网络；在路由器中为服务器创建 DHCP 地址保留 |

---

## 2. Ubuntu Server 安装

### 2.1 安装选项

- 语言：English
- 键盘布局：Chinese 或 你习惯的布局
- 安装类型：**Ubuntu Server**（不选 Desktop，省 1-2GB 内存）
- 网络：DHCP 或手动配置静态 IP（推荐静态 IP，方便后续访问）

### 2.2 分区方案

```
/boot     → 1GB    ext4    （引导分区）
/         → 剩余全部 ext4    （根分区）
```

不需要单独的 swap 分区。保留或创建 2–4GB swapfile 作为 OOM 缓冲即可；它不能代替内存，也不应用来承载长期高负载：

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.3 用户名

建议创建一个日常使用的用户，后续操作都在该用户下执行。记下用户名，后面会用到。

---

## 3. 基础环境配置

### 3.1 网络设置

优先在路由器中为服务器的 MAC 地址创建 **DHCP 地址保留**，这样不会因网卡名称或网段变化而失联。确实需要手工静态 IP 时，先查看实际接口名：

```bash
ip -br link
ip -br address
```

以下示例中的 `eth0` 必须替换为实际名称：

```bash
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.100/24    # 改为你局域网内的空闲 IP
      routes:
        - to: default
          via: 192.168.1.1     # 你的路由器 IP
      nameservers:
        addresses:
          - 223.5.5.5          # 阿里 DNS
          - 114.114.114.114    # 114 DNS
```

应用配置：

```bash
sudo netplan apply
```

### 3.2 SSH 远程访问（可选）

```bash
sudo apt update && sudo apt install -y openssh-server
sudo systemctl enable --now ssh
```

从你的主力电脑连接：

```bash
ssh 你的用户名@192.168.1.100
```

仅限局域网使用时，先不要在路由器上把 SSH 转发到公网。需要长期远程管理时，先配置 SSH 密钥并确认密钥登录成功，再关闭密码登录；不要在仍依赖密码时修改 SSH 配置。

### 3.3 安装 Docker

```bash
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
```

**重要**：退出当前终端重新登录，或执行 `newgrp docker`，使组权限生效。

验证：

```bash
docker --version
docker compose version
```

如果 `docker compose` 提示 `unknown shorthand flag: 'f' in -f`，说明系统安装了 Docker 但缺少 Compose v2 插件，独立安装：

```bash
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 \
  -o $DOCKER_CONFIG/cli-plugins/docker-compose
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
docker compose version
```

#### 3.3.1 Docker 镜像加速（中国大陆服务器）

在中国大陆直接拉取 Docker Hub 镜像可能超时。配置镜像加速器：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com",
    "https://docker.nju.edu.cn"
  ]
}
EOF
sudo systemctl restart docker
```

配置后验证拉取不再超时：

```bash
docker pull mongo:6.0
```

### 3.4 保持安全更新，并设置本地防火墙

不要为了节省少量内存关闭 `unattended-upgrades`。这台机器保存孩子的账号、学习记录和私有附件，安全更新比节省几十 MB 内存更重要。

以下规则只允许局域网访问 SSH 和 LMS 前端；将 `192.168.1.0/24` 改成自己的 LAN 网段。**在启用前，确认当前 SSH 会话来自该网段，避免把自己锁在服务器外。**

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 80 proto tcp
sudo ufw enable
sudo ufw status verbose
```

不要开放 `27017`、`3000`、`3001`–`3007` 到公网；浏览器只应访问前端的 `80`（或后续 HTTPS 的 `443`）端口。

---

## 4. 部署项目

所有命令默认在 `~/LMS` 目录执行。如果使用多个终端窗口，每个终端都需先执行 `cd ~/LMS`。

本文的 `docker-compose.ubuntu.yml` 已显式设置 `MEDIA_SECURITY_PROFILE=trusted-local`，
不会拉取或启动 ClamAV。不要在 8GB 主机上叠加 `docker-compose.security.yml`，也不要
为了对外开放上传而把该模式描述为安全扫描。需要 `secure-production` 时，应使用
至少 10 GiB Docker 可用内存的独立主机或 runner，并先执行：

```bash
RUN_FAMILY_SECURITY_SCAN=1 npm run test:family-security-scan
```

只有该命令在候选提交上通过，才可批准相应的安全生产部署；它不是本指南中普通
安装步骤的一部分。

### 4.1 克隆代码

```bash
cd ~
git clone https://github.com/mflyn/LMS.git
cd LMS
git fetch --tags
```

只部署已经评审且通过发布门禁的固定提交，不直接把持续移动的分支作为运行版本。将下面的值替换为获批提交号：

```bash
RELEASE_COMMIT=替换为已批准的完整提交号
git checkout --detach "$RELEASE_COMMIT"
git rev-parse HEAD
```

### 4.2 配置密钥

```bash
cp docker-compose.ubuntu.env.example .env
chmod 600 .env
```

该 `.env` 位于仓库根目录，专供 `docker-compose.ubuntu.yml` 读取；各后端服务
目录不需要另建环境文件。

为五个密钥生成不同的随机值。下列命令会直接写入 `.env`，不会在终端回显密钥：

```bash
umask 077
for key in JWT_SECRET GATEWAY_IDENTITY_SECRET MEDIA_REFERENCE_SERVICE_TOKEN MEDIA_SIGNING_SECRET INTERNAL_SERVICE_TOKEN; do
  value=$(openssl rand -hex 32)
  sed -i "s|^${key}=.*|${key}=${value}|" .env
done
```

只校验格式并输出键名，不回显密钥值。五项都应显示 `OK`：

```bash
for key in JWT_SECRET GATEWAY_IDENTITY_SECRET MEDIA_REFERENCE_SERVICE_TOKEN MEDIA_SIGNING_SECRET INTERNAL_SERVICE_TOKEN; do
  value=$(sed -n "s/^${key}=//p" .env)
  if printf '%s' "$value" | grep -Eq '^[0-9a-f]{64}$'; then
    echo "$key: OK"
  else
    echo "$key: 未配置为独立的 64 位十六进制值" >&2
    exit 1
  fi
done
```

`.env` 不得提交到 Git，也不应复制到聊天记录、截图或云笔记中。

### 4.3 部署前校验

目标提交必须已经在具备 Node.js 22、Docker 和 Playwright Chromium 的 CI 或构建机上通过仓库唯一发布门禁：

```bash
npm run release:family
```

8GB 家庭服务器只负责运行已验证版本，不要求在服务器上重复完整门禁。完整门禁的范围和证据要求见 [v1.6 Release Gate](../development/family-growth-v1.6-release-gate.md)。

确认 Compose 能读取全部必填配置。该命令不会启动容器：

```bash
docker compose -f docker-compose.ubuntu.yml config -q
```

当前 Ubuntu Compose 以生产模式运行家庭 MVP，包含 MongoDB 单节点副本集、私有媒体卷和 7 个后端服务。它不启动 Redis、RabbitMQ、MinIO 或旧学校版 interaction-service。

### 4.4 确认 Docker 端口边界

Docker 发布端口时可能绕过 UFW 的常规入站规则，因此仓库中的 Ubuntu Compose 已直接提供安全默认值，不需要部署人员手工修改 YAML：

| 服务 | 主机绑定 | 用途 |
|------|----------|------|
| frontend | `0.0.0.0:80` | 家庭局域网或已授权 VPN 访问 |
| gateway | `127.0.0.1:3000` | 仅供宿主机健康检查和诊断 |
| mongo | `127.0.0.1:27017` | 仅供宿主机数据库诊断和恢复 |
| 其余后端 | 不发布主机端口 | 只通过 Docker 内网访问 |

不要把 Gateway、MongoDB 或各后端端口改成 `0.0.0.0`。确认配置仍可解析：

```bash
docker compose -f docker-compose.ubuntu.yml config -q
```

### 4.5 启动全部服务

```bash
docker compose -f docker-compose.ubuntu.yml up -d
```

首次启动会自动执行以下操作：

1. 拉取 MongoDB 6.0 镜像
2. 构建 7 个 Node.js 后端服务镜像
3. 构建前端 Nginx 镜像
4. 初始化 MongoDB 副本集
5. 按依赖顺序启动各服务

首次构建会下载依赖，旧电脑上可能需要数分钟。构建期间不要关机或执行 `docker compose down -v`。

如果 `docker compose up -d` 报错 `failed to bind host port`，说明端口被占用，跳到[端口冲突](#端口冲突)排查。

### 4.6 等待初始化完成

查看 MongoDB 副本集初始化进度：

```bash
docker compose -f docker-compose.ubuntu.yml logs -f mongo-init
```

看到服务以退出码 0 结束时表示初始化完成：

```
mongo-init exited (0)
```

按 `Ctrl+C` 退出日志查看。

如果 `mongo` 容器一直处于 `unhealthy` 状态（`docker compose ps` 显示 `(unhealthy)`），可能是副本集未能自动初始化，手动执行：

```bash
docker compose -f docker-compose.ubuntu.yml exec mongo mongosh --quiet --eval \
  'rs.initiate({_id:"rs0",members:[{_id:0,host:"mongo:27017"}]})'
```

等几秒确认 MongoDB 变健康后，再启动依赖它的服务：

```bash
docker compose -f docker-compose.ubuntu.yml up -d
```

### 4.7 查看全部服务状态

```bash
docker compose -f docker-compose.ubuntu.yml ps
```

除一次性初始化容器 `mongo-init` 显示为 `Exited (0)` 外，其余服务应为 `Up`，MongoDB 应为 `healthy`，类似：

```
Name                   Status
gateway                Up
user-service           Up
homework-service       Up
progress-service       Up
resource-service       Up
analytics-service      Up
notification-service   Up
frontend               Up
mongo                  Up (healthy)
mongo-init             Exited (0)
```

### 4.8 初始化角色数据

首次启动后，MongoDB 的 `roles` 集合为空，注册时会返回 `400 Invalid role: parent`。执行以下命令插入预定义角色：

```bash
docker compose -f docker-compose.ubuntu.yml exec mongo mongosh learning-tracker --quiet --eval \
  'db.roles.insertOne({name:"parent",description:"Family parent"})'
```

该操作只需在首次部署时执行一次。

---

## 5. 验证与使用

### 5.1 验证 API 网关

```bash
curl http://localhost:3000/health
```

正常返回：

```json
{"status":"ok","service":"api-gateway"}
```

### 5.2 验证前端

在浏览器中打开：

```
http://192.168.1.100       # 替换为你的服务器 IP
```

应看到家长登录页面"小学生学习追踪系统"。

### 5.3 验证注册流程

1. 打开前端页面 → 点"注册"
2. 填写用户名、称呼、邮箱、密码 → 提交
3. 自动跳转到 `/family/setup` → 创建家庭
4. 进入 `/app/today` → 导航中出现今日/任务/记录/错题/周报/提醒/星星与奖励

### 5.4 Docker 常用命令

```bash
# 查看全部日志
docker compose -f docker-compose.ubuntu.yml logs -f

# 查看某服务日志
docker compose -f docker-compose.ubuntu.yml logs -f gateway

# 重启某服务
docker compose -f docker-compose.ubuntu.yml restart user-service

# 停止全部
docker compose -f docker-compose.ubuntu.yml down

# 启动全部
docker compose -f docker-compose.ubuntu.yml up -d

# 查看资源占用
docker stats
```

---

## 6. 系统服务配置

### 6.1 开机自启 Docker

```bash
sudo systemctl enable docker
```

### 6.2 创建应用自启服务

将以下内容保存为 `/etc/systemd/system/lms-family.service`：

```ini
[Unit]
Description=Family Growth Tracker MVP
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/你的用户名/LMS
ExecStart=/usr/bin/docker compose -f docker-compose.ubuntu.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.ubuntu.yml down
StandardOutput=journal

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable lms-family
sudo systemctl start lms-family
```

验证：

```bash
sudo systemctl status lms-family
```

### 6.3 定时健康检查（可选）

`restart: always` 已覆盖容器异常退出。网关 `/health` 仅表示网关进程存活，不能证明 MongoDB、附件和下游服务都正常；不要用一个 cron 任务在失败时反复重启网关，以免掩盖真实错误。

手工检查时使用：

```bash
curl -fsS http://127.0.0.1:3000/health
docker compose -f ~/LMS/docker-compose.ubuntu.yml ps
docker compose -f ~/LMS/docker-compose.ubuntu.yml logs --tail=100 gateway
```

---

## 7. 长期运行建议

### 7.1 内存监控

```bash
# 实时查看 Docker 容器内存
docker stats

# 查看系统内存
free -h

# 查看每个 Node 进程内存
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"
```

8GB 机器应保留至少约 1GB 可用内存和少量 swap 余量。首次启动、上传附件、生成周报时记录一次基线；如果持续触发 swap、出现 `exit code 137` 或磁盘使用率超过 80%，先停止扩展功能并处理资源问题。

### 7.2 日志轮转

Docker 日志默认不限制大小，长期运行可能占满磁盘：

```bash
# 配置全局日志限制
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker
```

需要重启 Docker 后重新 `up -d` 使配置生效。

### 7.3 定期更新

```bash
# 先备份并确认没有本地未提交修改，再切换到已通过发布门禁的新提交
cd ~/LMS
git status --short
git fetch --tags
RELEASE_COMMIT=替换为已批准的完整提交号
git checkout --detach "$RELEASE_COMMIT"
docker compose -f docker-compose.ubuntu.yml build --pull
docker compose -f docker-compose.ubuntu.yml up -d

# 更新系统
sudo apt update && sudo apt upgrade -y
```

### 7.4 数据备份

不需要在 Ubuntu Server 安装极空间图形客户端。服务器通过 NAS 的标准文件共享协议写入备份；本文主方案使用 **SMB 共享 + Restic 客户端加密**。NFS 也可以使用，但 SMB 对家庭 NAS 的兼容性通常更好；仅在 NAS 已明确提供 SSH/SFTP 时才考虑 rsync over SSH。

#### 7.4.1 备份范围

| 内容 | 原因 | 方式 |
|------|------|------|
| MongoDB 逻辑备份 | 家庭、账号、任务、成长记录、错题、周报、奖励 | `mongodump --oplog --archive` |
| `resource-data` 媒体卷 | 题目图片/PDF、孩子答案、任务附件 | 归档整个 Docker 卷 |
| `.env` 与 Ubuntu Compose | 密钥、端口和服务配置；丢失后无法完整恢复 | 暂存后由 Restic 加密 |
| Git 提交版本 | 恢复时确认数据对应的代码版本 | 写入纯文本清单 |

不要直接复制运行中的 `mongo-data` Docker 卷，也不需要备份 Docker 镜像、`node_modules` 或可由 Git 重新取得的源码构建产物。

#### 7.4.2 NAS 端准备

在极空间中完成以下操作；菜单名称会因系统版本略有不同：

1. 为 NAS 设置 DHCP 地址保留，例如 `192.168.1.20`。
2. 创建专用共享文件夹，例如 `lms-backup`，不要与日常家庭文件混放。
3. 创建专用用户，例如 `lms-backup`，仅授予该共享文件夹读写权限；不要使用 NAS 管理员账户。
4. 启用 SMB 文件共享（建议 SMB3）。记录 NAS IP、共享名和该专用用户。

备份会在 Ubuntu 端加密，因此 NAS 中只保存 Restic 加密仓库；但仍应限制 NAS 共享的访问权限。

#### 7.4.3 Ubuntu 挂载 NAS 共享

以下示例假设 NAS IP 为 `192.168.1.20`、共享名为 `lms-backup`。将它们替换为你的实际信息。

```bash
sudo apt update
sudo apt install -y cifs-utils restic
sudo install -d -m 700 /etc/lms-backup /mnt/nas-lms-backup /var/backups/lms
sudo nano /etc/lms-backup/smb-credentials
```

凭据文件内容如下，使用 NAS 的专用备份用户；不要把密码写入聊天记录、脚本或 `/etc/fstab`：

```ini
username=lms-backup
password=替换为NAS专用备份用户密码
domain=WORKGROUP
```

限制凭据文件权限，并先测试挂载和写入：

```bash
sudo chmod 600 /etc/lms-backup/smb-credentials
sudo mount -t cifs //192.168.1.20/lms-backup /mnt/nas-lms-backup \
  -o credentials=/etc/lms-backup/smb-credentials,vers=3.0,uid=0,gid=0,dir_mode=0700,file_mode=0600,noserverino
sudo touch /mnt/nas-lms-backup/.write-test
sudo rm /mnt/nas-lms-backup/.write-test
sudo umount /mnt/nas-lms-backup
```

确认测试成功后，写入 `/etc/fstab`，让系统在网络就绪后按需挂载：

```bash
sudo nano /etc/fstab
```

追加一行：

```fstab
//192.168.1.20/lms-backup /mnt/nas-lms-backup cifs credentials=/etc/lms-backup/smb-credentials,vers=3.0,_netdev,nofail,x-systemd.automount,x-systemd.idle-timeout=60,uid=0,gid=0,dir_mode=0700,file_mode=0600,noserverino 0 0
```

验证配置：

```bash
sudo systemctl daemon-reload
sudo mount /mnt/nas-lms-backup
mountpoint -q /mnt/nas-lms-backup && echo 'NAS 挂载成功'
```

#### 7.4.4 初始化加密备份仓库

Restic 在写入 NAS 前加密数据。密码文件一旦丢失，备份无法恢复；将其记录在离线密码管理器中，而不是只留在这台服务器上。

```bash
sudo sh -c 'umask 077; openssl rand -base64 48 > /etc/lms-backup/restic-password'
sudo env \
  RESTIC_REPOSITORY=/mnt/nas-lms-backup/restic-repository \
  RESTIC_PASSWORD_FILE=/etc/lms-backup/restic-password \
  restic init
```

#### 7.4.5 创建每日备份脚本

创建脚本并将 `PROJECT_DIR` 改成实际 LMS 路径：

```bash
sudo nano /usr/local/sbin/lms-backup
```

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR=/home/你的用户名/LMS
COMPOSE=(docker compose -f "$PROJECT_DIR/docker-compose.ubuntu.yml")
NAS_MOUNT=/mnt/nas-lms-backup
STAGING_DIR=/var/backups/lms/$(date +%F)

export RESTIC_REPOSITORY="$NAS_MOUNT/restic-repository"
export RESTIC_PASSWORD_FILE=/etc/lms-backup/restic-password

mount "$NAS_MOUNT"
mountpoint -q "$NAS_MOUNT" || { echo "NAS 未挂载：$NAS_MOUNT" >&2; exit 1; }
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
trap 'rm -rf "$STAGING_DIR"' EXIT

MONGO_ID=$("${COMPOSE[@]}" ps -q mongo)
test -n "$MONGO_ID" || { echo '未找到运行中的 MongoDB 容器' >&2; exit 1; }
docker exec "$MONGO_ID" mongodump --oplog --archive=/tmp/lms-mongo.archive
docker cp "$MONGO_ID":/tmp/lms-mongo.archive "$STAGING_DIR/mongo.archive"
docker exec "$MONGO_ID" rm -f /tmp/lms-mongo.archive

RESOURCE_ID=$("${COMPOSE[@]}" ps -q resource-service)
test -n "$RESOURCE_ID" || { echo '未找到运行中的 resource-service 容器' >&2; exit 1; }
MEDIA_VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/family-growth/private-media"}}{{.Name}}{{end}}{{end}}' "$RESOURCE_ID")
test -n "$MEDIA_VOLUME" || { echo '未找到 resource-data 卷' >&2; exit 1; }
docker run --rm \
  -v "$MEDIA_VOLUME":/source:ro \
  -v "$STAGING_DIR":/backup \
  alpine tar czf /backup/media.tar.gz -C /source .

install -m 600 "$PROJECT_DIR/.env" "$STAGING_DIR/environment.env"
install -m 600 "$PROJECT_DIR/docker-compose.ubuntu.yml" "$STAGING_DIR/docker-compose.ubuntu.yml"
git -C "$PROJECT_DIR" rev-parse HEAD > "$STAGING_DIR/git-revision.txt"

restic backup --tag lms --tag daily "$STAGING_DIR"
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
restic snapshots --latest 1
```

设置脚本权限并手工执行第一次备份：

```bash
sudo chmod 700 /usr/local/sbin/lms-backup
sudo /usr/local/sbin/lms-backup
```

首次运行会拉取一个很小的 `alpine` 镜像，用于只读归档媒体卷。以后运行不会重复下载。

#### 7.4.6 用 systemd 定时执行

使用 systemd timer 比 cron 更适合家用服务器：如果机器在计划时间关机，`Persistent=true` 会在下次启动后补跑。

```bash
sudo nano /etc/systemd/system/lms-backup.service
```

```ini
[Unit]
Description=Encrypted LMS backup to family NAS
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lms-backup
```

```bash
sudo nano /etc/systemd/system/lms-backup.timer
```

```ini
[Unit]
Description=Run LMS backup every day

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

启用、检查和查看日志：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lms-backup.timer
systemctl list-timers lms-backup.timer
sudo journalctl -u lms-backup.service --since today
```

#### 7.4.7 恢复演练

每月至少一次，只恢复到临时目录或空的测试 MongoDB 容器，绝不直接覆盖正在使用的家庭数据：

```bash
sudo env \
  RESTIC_REPOSITORY=/mnt/nas-lms-backup/restic-repository \
  RESTIC_PASSWORD_FILE=/etc/lms-backup/restic-password \
  restic snapshots

sudo env \
  RESTIC_REPOSITORY=/mnt/nas-lms-backup/restic-repository \
  RESTIC_PASSWORD_FILE=/etc/lms-backup/restic-password \
  restic restore latest --target /var/tmp/lms-restore-test
```

恢复目录中应有 `mongo.archive`、`media.tar.gz`、`environment.env`、Compose 文件和 Git 提交号。将 `mongo.archive` 恢复到空的测试 MongoDB 容器时，使用 `mongorestore --archive=... --oplogReplay`；验证数据和媒体均可读取后再删除测试目录。

## 8. 安全与远程访问

### 8.1 先明确访问边界

本指南的默认方案是 **局域网访问**：孩子的 iPad 与服务器在同一家庭网络内，浏览器只访问 `http://服务器局域网IP/`。

仓库中的 Ubuntu Compose 默认让 Gateway `3000` 和 MongoDB `27017` 只监听宿主机回环地址，局域网设备无法直接连接；前端 `80` 是唯一面向家庭网络的入口。不要放宽这些绑定：Docker 发布端口可能绕过 UFW 的常规入站规则。

- 不在路由器中转发 `27017`、`3000` 或各微服务端口。
- 不让 MongoDB 使用公网 IP，也不要把它添加到 VPN 外的访问规则。
- 任何对外网页访问都只经由反向代理的 `443`；在完成 HTTPS、域名、更新 Node 运行时与访问控制审查前，不要将本机暴露到公网。

7 个后端镜像和前端构建镜像均使用 Node.js 22。

### 8.2 外网访问选项

需要从外网访问时，有以下常见方案：

| 方案 | 成本 | 说明 |
|------|------|------|
| Tailscale / WireGuard 私有 VPN | 通常低成本 | 仅授权设备可访问，适合家庭成员，推荐 |
| 公网 IP + HTTPS 反向代理 | 取决于宽带 | 需要域名、证书、补丁、日志和更严格的访问控制 |
| 云服务器反向代理 / 隧道 | 增加云成本 | 仍需要设计身份认证、数据路径和故障恢复 |

推荐方案：**私有 VPN**。它让经过授权的 iPad、家长设备和服务器位于同一虚拟网络；不要把“免端口映射”误认为“无需身份验证”。孩子仍应使用 LMS 自己的登录/PIN，家长使用独立账户。

```bash
# 安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# 完成授权后，允许 VPN 接口访问前端
sudo ufw allow in on tailscale0 to any port 80 proto tcp
```

若未来在中国内地将服务作为公开网站/App 对外提供，还需要单独评估 ICP 备案和隐私合规；本文不提供规避备案或将儿童数据暴露给第三方隧道的做法。

---

## 9. 故障排查

### 服务无法启动

```bash
# 查看完整日志
docker compose -f docker-compose.ubuntu.yml logs

# 重置所有容器（保留数据）
docker compose -f docker-compose.ubuntu.yml down
docker compose -f docker-compose.ubuntu.yml up -d

# 危险：仅在确认要永久删除全部家庭数据后才执行。
# 该命令会删除 MongoDB 和媒体卷；常规故障排查不要使用。
docker compose -f docker-compose.ubuntu.yml down -v
```

### MongoDB 副本集失败

```bash
# 手动初始化
docker compose -f docker-compose.ubuntu.yml exec mongo mongosh --eval "
  try {
    rs.status()
  } catch (error) {
    rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})
  }
"
```

### 注册时提示 "Invalid role: parent"

MongoDB 的 `roles` 集合缺少预定义角色。首次部署只需执行一次：

```bash
docker compose -f docker-compose.ubuntu.yml exec mongo mongosh learning-tracker --quiet --eval \
  'db.roles.insertOne({name:"parent",description:"Family parent"})'
```

### Node 进程 OOM（内存不足）

如果 Node 进程被系统杀死（`docker logs` 中看到 `exit code 137`）：

```bash
# 进一步降低内存限制
# 修改 docker-compose.ubuntu.yml 中的 NODE_OPTIONS
# 从 --max-old-space-size=256 改为 128
```

### 端口冲突

如果笔记本上已有服务占用 80 或 3000 端口：

```bash
# 查看端口占用
sudo lsof -i :80
sudo lsof -i :3000
```

Ubuntu 桌面版或预装 LAMP 的系统常自带 Apache2 占用 80 端口：

```bash
sudo systemctl stop apache2
sudo systemctl disable apache2   # 禁止开机自启
```

如果前端端口不够用，可修改 `docker-compose.ubuntu.yml` 中的映射。不要为排障把 MongoDB 暴露到公网。

### MongoDB 慢查询

如果磁盘是 HDD，MongoDB 查询可能变慢：

```bash
# 检查 MongoDB 是否使用了大量内存
docker stats --no-stream "$(docker compose -f docker-compose.ubuntu.yml ps -q mongo)"

# 仅在确认内存紧张时才调整 WiredTiger cache；过小会降低数据库性能。
# 先备份并记录原值，再修改 docker-compose.ubuntu.yml 中的
# --wiredTigerCacheSizeGB=0.5。

# 重建索引（连接后执行）
docker compose -f docker-compose.ubuntu.yml exec mongo mongosh learning-tracker --eval "
  db.growthtasks.createIndex({familyId:1, childId:1, dueDate:1})
  db.familymistakes.createIndex({familyId:1, childId:1, createdAt:-1})
  db.growthlogs.createIndex({familyId:1, childId:1, date:1})
"
```

---

## 附录：架构图

```
┌──────────────────────────────────────────────────┐
│                   笔记本 Ubuntu                    │
│                                                    │
│ iPad/家长 ──> 前端 Nginx :80 ──> Gateway :3000    │
│                                  │                │
│  user :3001   progress :3002   homework :3003     │
│  resource :3005  analytics :3006  notify :3007    │
│                                  │                │
│       MongoDB rs0（Docker 内网 + 本机诊断端口）       │
│                                  │                │
│                  Docker Volume：mongo-data         │
│                  Docker Volume：resource-data      │
└──────────────────────────────────────────────────┘
                 │ 每日备份
                 ▼
              家庭 NAS
```

---

## 参考

- [家庭成长跟踪产品需求](../product/family-learning-tracker.md)
- [API 契约](../api/family-learning-tracker-api.md)
- [Ubuntu 家庭版 Compose 配置](../../docker-compose.ubuntu.yml)
- [Ubuntu 环境变量模板](../../docker-compose.ubuntu.env.example)
- [部署文档入口与发布门禁](README.md)
- [家庭版架构约束](../architecture/family-learning-tracker-architecture.md)
