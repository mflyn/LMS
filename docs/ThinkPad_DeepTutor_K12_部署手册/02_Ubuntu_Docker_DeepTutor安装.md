# Ubuntu、Docker 与 DeepTutor 安装

[返回总目录](00_总目录与实施路线.md)

> 本文只安装和验证教育 AI 扩展中的 DeepTutor，不替代 LMS 的
> [本地 Ubuntu 部署指南](../deployment/local-ubuntu-deployment.md)。在 8 GB X230i 上
> 应先完成 LMS 基线和备份，再在管理员维护窗口启动 DeepTutor。完成 LMS 适配后，孩子
> 只访问 LMS，DeepTutor Web 不作为孩子入口。

## 1. 当前已完成状态

当前主机已经完成：

```text
Ubuntu 26.04 LTS
Docker Engine 29.1.3
Docker Compose v2.27.0
hello-world amd64 容器验证成功
Docker daemon 已启用
```

因此不需要重新安装 Ubuntu 或 Docker。本文仍保留完整检查和恢复步骤，方便日后迁移。

## 2. 系统检查

```bash
cat /etc/os-release
uname -m
free -h
df -h /
swapon --show
zramctl
systemctl get-default
docker --version
docker compose version
```

预期：

- `uname -m` 为 `x86_64`；
- Docker 和 Compose 均可用；
- 当前用户的 `id` 输出包含 `docker` 组；
- 根分区有足够空间；
- swap 或 zram 至少有一个可用。

## 3. Ubuntu 基础软件

```bash
sudo apt update
sudo apt full-upgrade -y

sudo apt install -y \
  ca-certificates curl git jq unzip \
  openssh-server rsync htop tmux \
  smartmontools python3 python3-venv \
  python3-pip zram-tools
```

设置：

```bash
sudo timedatectl set-timezone Asia/Shanghai
sudo hostnamectl set-hostname homesvr
sudo systemctl enable --now ssh
```

检查 SSD：

```bash
sudo smartctl -a /dev/sda
```

重点关注：

- `Reallocated_Sector_Ct`
- `Current_Pending_Sector`
- `Offline_Uncorrectable`
- `Media_Wearout_Indicator` 或同类寿命字段
- SATA CRC 错误

## 4. Desktop 与 Server 模式

检查默认启动目标：

```bash
systemctl get-default
```

如果输出 `graphical.target`，说明系统默认启动桌面。8 GB 内存仍可部署，但桌面环境会占用额外内存。

若主机以后专门作为服务器，可选择：

```bash
sudo systemctl set-default multi-user.target
sudo reboot
```

恢复桌面启动：

```bash
sudo systemctl set-default graphical.target
sudo reboot
```

初期不需要卸载桌面软件。先部署、观察 `free -h` 和 `docker stats`，再决定是否切换。

## 5. swap 与 zram

### 5.1 检查现状

```bash
swapon --show
zramctl
free -h
```

Ubuntu 26.04 Desktop 可能已经创建 swap 文件，不要重复创建。

### 5.2 配置 zram

如果 `zramctl` 没有设备：

```bash
sudo apt install -y zram-tools
sudoedit /etc/default/zramswap
```

建议：

```ini
ALGO=zstd
PERCENT=25
PRIORITY=100
```

应用：

```bash
sudo systemctl restart zramswap
zramctl
swapon --show
```

8 GB 内存建议约 2 GB zram。

### 5.3 磁盘 swap

如果 `swapon --show` 已有 4 GB 以上 swap，保持不变。

如果完全没有 swap，可创建 4 GB：

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

验证无误后，在 `/etc/fstab` 添加：

```text
/swapfile none swap sw 0 0
```

## 6. Docker 权限说明

此前出现过：

```text
sudo docker compose
docker: unknown command: docker compose
```

原因是 Compose 插件对普通用户可见，但 root 环境找不到用户目录下的插件。

当前推荐工作方式：

```bash
docker compose version
docker ps
```

不再使用：

```bash
sudo docker compose ...
```

如果新服务器需要配置：

```bash
sudo usermod -aG docker "$USER"
```

退出 SSH 并重新登录，然后：

```bash
id
docker run --rm hello-world
docker compose version
```

如果系统级 Compose 缺失：

```bash
sudo apt update
sudo apt install -y docker-compose-v2
```

## 7. 创建持久化目录

```bash
sudo mkdir -p \
  /srv/edu-stack/deeptutor/data \
  /srv/edu-stack/k12/input \
  /srv/edu-stack/k12/workspace \
  /srv/edu-stack/k12/data \
  /srv/edu-stack/k12/cards \
  /srv/edu-stack/k12/configs \
  /srv/edu-stack/graph-api/app \
  /srv/edu-stack/graph-api/data \
  /srv/edu-stack/manifests \
  /srv/edu-stack/ops

sudo chown -R "$USER":"$USER" /srv/edu-stack
sudo install -d -m 0700 -o "$USER" -g "$USER" /srv/edu-stack/secrets
```

检查：

```bash
find /srv/edu-stack -maxdepth 2 -type d
```

## 8. 创建 DeepTutor Compose

部署明确分成两个互斥 profile：

| profile | 用途 | 宿主机端口 | 可用数据 |
| --- | --- | --- | --- |
| `admin-validation` | 家长通过 SSH Tunnel 用虚构数据验证 DeepTutor | 仅 `127.0.0.1:3782` | 虚构题目和试验 KB |
| `lms-integration` | LMS 通过持久化 Adapter 调用 | 不发布任何端口 | 去身份化、最小必要上下文 |

两个 profile 不同时运行。官方单容器会在内部把前端 `/api/*` 和 `/ws/*` 代理到 FastAPI；
LMS 也不能直接调用 DeepTutor，而由 Adapter 在 `ai_control` 内部网络访问
`http://deeptutor:8001`。DeepTutor 另接只供云模型出站的 `model_egress` 网络，但不发布入站
端口。

```bash
cd /srv/edu-stack
nano .env
nano compose.yaml
```

先从 DeepTutor 官方发布页选择经过验证的明确 tag，并写入只允许当前用户读取的
`.env`。本手册锁定官方 tag `v1.5.6` 对应源码提交
`f2aa49f42e67dbfbb9ce6b95e3f62ccd04bb852a`；容器 tag 使用 `1.5.6`。首次拉取后还必须按
第 12 节记录实际镜像 digest，后续集成使用 `tag@digest`：

```dotenv
DEEPTUTOR_IMAGE=ghcr.io/hkuds/deeptutor:1.5.6
```

```bash
chmod 600 .env
```

内容：

```yaml
name: edu-stack

services:
  deeptutor:
    image: "${DEEPTUTOR_IMAGE:?请在.env中固定DeepTutor镜像版本}"
    container_name: deeptutor
    restart: unless-stopped

    volumes:
      - ./deeptutor/data:/app/data

    environment:
      TZ: Asia/Shanghai

    mem_limit: 3g
    cpus: 1.5

    networks:
      - ai_control
      - model_egress

networks:
  ai_control:
    internal: true
  model_egress: {}
```

另建只用于管理员验证的 `compose.admin-validation.yaml`：

```yaml
services:
  deeptutor:
    ports:
      - "127.0.0.1:3782:3782"
```

说明：

- 基础 Compose 不发布端口；只有管理员验证 overlay 发布回环 `3782`；
- `8001` 仅在容器内部使用；
- 完整 `/app/data` 映射到主机；
- 容器最多使用 3 GB 内存；
- 容器最多使用约 1.5 核；
- `restart: unless-stopped` 保证重启后自动恢复。
- `.env` 中可能包含部署信息，不提交到 Git，也必须进入加密备份。

### 8.1 启用 DeepTutor 原生认证

DeepTutor `1.5.6` 的运行配置来自挂载目录中的 JSON，不应尝试用 Compose 环境变量覆盖。
先用 `admin-validation` profile 启动一次以生成默认文件，然后编辑：

```text
/srv/edu-stack/deeptutor/data/user/settings/auth.json
/srv/edu-stack/deeptutor/data/user/settings/system.json
```

`auth.json` 至少设置：

```json
{
  "version": 1,
  "enabled": true,
  "username": "",
  "password_hash": "",
  "token_expire_hours": 8,
  "cookie_secure": false
}
```

保存并重启后，通过 SSH Tunnel 打开 `/register`；第一个注册用户是部署管理员。密码只在家长
密码管理器中保存，不写进命令、`.env` 或 Git。`cookie_secure=false` 只适用于回环 HTTP；
若以后通过统一 HTTPS 反向代理访问管理页，改为 `true`。`system.json` 的
`cors_origins` 只保留实际管理前端 origin；不要写 `*`。

认证关闭时 DeepTutor 把调用者视为本地管理员，因此 `lms-integration` 禁止在
`enabled=false` 的情况下启动。

### 8.2 创建最小权限服务用户

管理员在 DeepTutor `/admin/users` 创建非管理员用户 `lms-adapter`，再为该用户配置 grant：

- 只分配试点所用的一个 LLM profile；
- 只分配 `family-math-pilot` 等经过审核的教育 KB；
- `skills=[]`、`partners=[]`；
- `enabled_tools=["rag"]`，如果试点不需要检索则设为 `[]`；
- `mcp_tools=[]`；
- `exec_enabled=false`。

服务用户密码存入 `/srv/edu-stack/secrets/deeptutor-adapter-password`，权限 `0600`，由 Adapter
以只读 secret 挂载。管理员账号和管理员 token 不得进入 Adapter。固定版本的原生 grant
负责模型、KB、工具、MCP 和执行权限；capability 与 API 路由仍由 Adapter 二次白名单校验。

在 Ubuntu 终端安全写入服务用户密码；输入过程不回显，密码也不会出现在命令历史或进程参数中：

```bash
umask 077
read -r -s -p "DeepTutor lms-adapter password: " DEEPTUTOR_ADAPTER_PASSWORD
printf '\n'
printf '%s' "$DEEPTUTOR_ADAPTER_PASSWORD" > /srv/edu-stack/secrets/deeptutor-adapter-password
unset DEEPTUTOR_ADAPTER_PASSWORD
chmod 0600 /srv/edu-stack/secrets/deeptutor-adapter-password
```

Adapter 实现完成后，在 `compose.lms-integration.yaml` 中使用 Compose secret；容器内只从
`/run/secrets/deeptutor_adapter_password` 读取，不把密码复制进环境变量：

```yaml
services:
  lms-adapter:
    image: "${LMS_ADAPTER_IMAGE:?请固定Adapter镜像版本}"
    secrets:
      - deeptutor_adapter_password

secrets:
  deeptutor_adapter_password:
    file: ./secrets/deeptutor-adapter-password
```

Compose 会将该文件只读挂载到容器的 `/run/secrets`。启动前检查宿主机目录权限为 `0700`、
密码文件权限为 `0600`；备份时按第 14 节使用加密备份，不将明文 secret 单独复制到 NAS。

### 8.3 Adapter 允许面

Adapter 只允许：

- `POST /api/v1/auth/login` 获取短期会话；
- `WS /api/v1/ws` 的 `start_turn`、`subscribe_turn`、`subscribe_session`、
  `check_active_turn` 和心跳消息；
- 部署验证明确需要的健康检查。

统一拒绝 settings、system、plugins、MCP、skills、subagents、partners、imports、attachments
等管理或扩展路由。允许的 capability 固定为试点使用的 `deep_solve`，KB 固定为 grant 中的
教育 KB，tools 必须是配置白名单的子集。DeepTutor `operationId` 不是原生协议字段；Adapter
必须先持久化 LMS operation，再调用 `start_turn`，详见
[完整设计的 DeepTutor 接口边界](../architecture/family-ai-learning-platform-design.md#114-deeptutor-接口边界)。

## 9. 启动前检查

```bash
cd /srv/edu-stack
ls -la
docker compose -f compose.yaml -f compose.admin-validation.yaml config
```

`docker compose config` 必须无错误且渲染出的 `image:` 不是 `latest`，再继续：

```bash
docker compose -f compose.yaml -f compose.admin-validation.yaml pull
docker compose -f compose.yaml -f compose.admin-validation.yaml up -d
docker compose -f compose.yaml -f compose.admin-validation.yaml ps
docker compose -f compose.yaml -f compose.admin-validation.yaml logs --tail=100 deeptutor
```

验证：

```bash
curl -I http://127.0.0.1:3782
docker stats --no-stream
```

如果容器启动较慢：

```bash
docker compose -f compose.yaml -f compose.admin-validation.yaml logs -f deeptutor
```

按 `Ctrl+C` 只会退出日志查看，不会停止容器。

完成管理员配置和虚构数据验证后，切换到 LMS 集成 profile：

```bash
docker compose -f compose.yaml -f compose.admin-validation.yaml down
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
docker compose -f compose.yaml port deeptutor 3782
docker compose -f compose.yaml port deeptutor 8001
```

最后两个命令必须都不返回宿主机映射。Adapter 加入同一 `ai_control` 网络后，执行集成测试：

- 无凭据登录以外的 API 和 WebSocket 被拒绝；
- `lms-adapter` 可以调用获批 capability 和 KB；
- 未获批 KB、额外 tool、MCP 和代码执行被拒绝；
- Adapter 对 settings、system、plugins、skills、subagents 等路由返回本地拒绝；
- 孩子和家长浏览器无法解析或访问 DeepTutor 容器地址；
- 管理员验证 overlay 已停止，`3782/8001` 均没有宿主机监听。

## 10. 从其他电脑访问

推荐 SSH Tunnel：

```bash
ssh -L 3782:127.0.0.1:3782 lyn@服务器IP
```

然后在本地浏览器打开：

```text
http://127.0.0.1:3782
```

优点：

- 不向局域网或公网暴露 DeepTutor；
- 无需配置 TLS；
- 无需开放 `8001`；
- 适合初次部署和排错。

如果需要手机访问，可后续选择：

- Tailscale；
- Caddy + 域名 + HTTPS；
- 仅局域网绑定。

不要直接在路由器上把 `3782` 转发到公网。

孩子的 iPad 不使用这个 SSH Tunnel。进入正式家庭流程后，iPad 通过局域网或 VPN
访问 LMS；LMS 再通过内部适配器调用 DeepTutor。

## 11. 持久化验证

完成初始设置后：

```bash
du -sh /srv/edu-stack/deeptutor/data
find /srv/edu-stack/deeptutor/data -maxdepth 3 -type f | head
```

重启测试：

```bash
docker compose -f compose.yaml -f compose.admin-validation.yaml restart deeptutor
docker compose -f compose.yaml -f compose.admin-validation.yaml ps
```

确认：

- 模型配置仍然存在；
- API Key 配置仍然存在；
- 会话和知识库仍然存在；
- 页面仍可访问。

## 12. 记录镜像 digest

Compose 已要求固定 tag。首次验证成功后还要记录仓库返回的实际 digest：

```bash
docker image inspect \
  "$(docker compose -f compose.yaml config --images | head -n 1)" \
  --format '{{index .RepoDigests 0}}'
```

把输出与验证日期写入 `/srv/edu-stack/manifests/deeptutor-image.txt`。恢复时使用相同
tag/digest，避免镜像仓库中的浮动标签带来行为变化。

升级前：

```bash
cd /srv/edu-stack
docker compose -f compose.yaml -f compose.admin-validation.yaml stop deeptutor
rsync -aH deeptutor/data/ backup/deeptutor-before-upgrade/
docker compose -f compose.yaml -f compose.admin-validation.yaml pull
docker compose -f compose.yaml -f compose.admin-validation.yaml up -d
docker compose -f compose.yaml -f compose.admin-validation.yaml logs --tail=100 deeptutor
```

## 13. 常见问题

### 13.1 `docker compose` 普通用户正常，sudo 失败

不要加 `sudo`。确认：

```bash
id
docker compose version
```

### 13.2 找不到 `compose.yaml`

```bash
cd /srv/edu-stack
ls -la
docker compose config
```

### 13.3 页面打开但后端不可达

```bash
docker compose ps
docker compose logs --tail=200 deeptutor
```

单容器模式通常不需要发布 `8001`。先确认当前镜像仍使用官方
`web/proxy.ts` 代理以及 `DEEPTUTOR_API_BASE_URL` 没有被错误覆盖。只有直接 API
调试需要临时添加 `127.0.0.1:8001:8001`，调试结束后移除。

### 13.4 权限错误

```bash
ls -ld /srv/edu-stack/deeptutor/data
sudo chown -R "$USER":"$USER" /srv/edu-stack
```

如果 `~/.docker` 因早期 sudo 操作归 root 所有：

```bash
sudo chown -R "$USER":"$USER" "$HOME/.docker"
chmod -R g+rwX "$HOME/.docker"
```

### 13.5 内存不足或被 OOM Kill

```bash
free -h
docker stats --no-stream
journalctl -k --since "1 hour ago" | grep -i -E 'oom|killed process'
```

处理顺序：

1. 停止其他容器；
2. 关闭桌面或切换到文本模式；
3. 检查 zram/swap；
4. 暂停 K12/MinerU；
5. 降低 DeepTutor 并发；
6. 必要时将容器内存上限临时调整到 3.5 GB，但必须保留系统余量。

## 14. 官方资料

- Docker Ubuntu 安装：https://docs.docker.com/engine/install/ubuntu/
- Docker 非 root 使用：https://docs.docker.com/engine/install/linux-postinstall/
- Docker Compose：https://docs.docker.com/compose/install/linux/
- DeepTutor README：https://github.com/HKUDS/DeepTutor
- DeepTutor 容器说明：https://github.com/HKUDS/DeepTutor/blob/main/CONTAINERIZATION.md
