# Docker 镜像源配置指南

## 问题描述
在启动 Docker Compose 时遇到以下错误：
```
Error response from daemon: Get "https://registry-1.docker.io/v2/": net/http: request canceled while waiting for connection
```

这通常是由于网络问题导致无法连接到 Docker Hub 官方仓库。

## 解决方案

### 方案1：配置国内镜像源（推荐）

#### 1. 创建或编辑 Docker 配置文件

```bash
# 创建 Docker 配置目录（如果不存在）
sudo mkdir -p /etc/docker

# 编辑 daemon.json 文件
sudo vim /etc/docker/daemon.json
```

#### 2. 添加镜像源配置

将以下内容添加到 `/etc/docker/daemon.json` 文件中：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com",
    "https://ccr.ccs.tencentyun.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

#### 3. 重启 Docker 服务

```bash
# 重新加载 Docker 配置
sudo systemctl daemon-reload

# 重启 Docker 服务
sudo systemctl restart docker

# 验证配置是否生效
docker info | grep -A 10 "Registry Mirrors"
```

### 方案2：使用阿里云镜像加速器

1. 访问阿里云容器镜像服务：https://cr.console.aliyun.com/
2. 登录后在左侧菜单找到"镜像加速器"
3. 复制您专属的加速器地址
4. 按照页面提示配置

### 方案3：手动拉取镜像

如果镜像源配置后仍有问题，可以手动拉取所需镜像：

```bash
# 拉取所需的基础镜像
docker pull mongo:4.4
docker pull rabbitmq:3-management
docker pull minio/minio
docker pull redis:6

# 验证镜像是否拉取成功
docker images
```

### 方案4：修改 docker-compose.yml 使用国内镜像

如果上述方法都不行，可以修改 docker-compose.yml 文件，使用国内镜像源：

```yaml
# 将原来的镜像地址
mongo:4.4
# 改为
registry.cn-hangzhou.aliyuncs.com/library/mongo:4.4

# 其他镜像类似处理
```

## 验证解决方案

配置完成后，执行以下命令验证：

```bash
# 清理之前失败的容器
docker compose down

# 重新启动服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs
```

## 常见问题

### Q: 配置后仍然无法拉取镜像怎么办？
A: 
1. 检查网络连接
2. 尝试不同的镜像源
3. 检查防火墙设置
4. 考虑使用代理

### Q: 如何知道镜像源是否生效？
A: 使用 `docker info` 命令查看 "Registry Mirrors" 部分

### Q: 可以同时配置多个镜像源吗？
A: 可以，Docker 会按顺序尝试每个镜像源

## 注意事项

1. 修改 Docker 配置后必须重启 Docker 服务
2. 某些企业网络可能需要额外的代理配置
3. 如果使用 Docker Desktop，配置方法可能略有不同 