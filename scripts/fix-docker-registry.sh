#!/bin/bash

# Docker 镜像源配置脚本
# 用于解决 Docker Hub 连接问题

echo "🔧 开始配置 Docker 镜像源..."

# 检查是否为 root 用户或有 sudo 权限
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  此脚本需要 root 权限，请使用 sudo 运行"
    exit 1
fi

# 备份原有配置
DOCKER_CONFIG_DIR="/etc/docker"
DAEMON_JSON="$DOCKER_CONFIG_DIR/daemon.json"

echo "📁 检查 Docker 配置目录..."
if [ ! -d "$DOCKER_CONFIG_DIR" ]; then
    echo "📂 创建 Docker 配置目录: $DOCKER_CONFIG_DIR"
    mkdir -p "$DOCKER_CONFIG_DIR"
fi

# 备份现有配置
if [ -f "$DAEMON_JSON" ]; then
    echo "💾 备份现有配置到 daemon.json.backup"
    cp "$DAEMON_JSON" "$DAEMON_JSON.backup"
fi

# 创建新的 daemon.json 配置
echo "📝 创建新的 Docker 配置..."
cat > "$DAEMON_JSON" << 'EOF'
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
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
EOF

echo "✅ Docker 配置文件已更新"

# 重启 Docker 服务
echo "🔄 重启 Docker 服务..."
systemctl daemon-reload
systemctl restart docker

# 等待 Docker 服务启动
echo "⏳ 等待 Docker 服务启动..."
sleep 5

# 检查 Docker 服务状态
if systemctl is-active --quiet docker; then
    echo "✅ Docker 服务已成功启动"
else
    echo "❌ Docker 服务启动失败"
    echo "📋 查看 Docker 服务状态:"
    systemctl status docker
    exit 1
fi

# 验证镜像源配置
echo "🔍 验证镜像源配置..."
docker info | grep -A 10 "Registry Mirrors" || echo "⚠️  未找到镜像源配置信息"

# 测试镜像拉取
echo "🧪 测试镜像拉取..."
if docker pull hello-world:latest; then
    echo "✅ 镜像拉取测试成功！"
    docker rmi hello-world:latest
else
    echo "❌ 镜像拉取测试失败"
    echo "💡 建议尝试以下操作："
    echo "   1. 检查网络连接"
    echo "   2. 尝试手动拉取项目所需镜像"
    echo "   3. 考虑使用代理"
fi

echo ""
echo "🎉 Docker 镜像源配置完成！"
echo "📌 现在可以尝试运行: docker compose up -d"
echo ""
echo "如果仍有问题，请查看完整指南: docs/Docker镜像源配置指南.md" 