#!/bin/bash

# 小学生学习追踪系统 - 服务启动脚本

echo "启动小学生学习追踪系统..."

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "脚本目录: $SCRIPT_DIR"

# 检查环境变量文件
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "警告: .env 文件不存在，请复制 .env.example 并配置相应的环境变量"
    exit 1
fi

# 检查MongoDB是否运行
if ! pgrep -f mongod > /dev/null; then
    echo "警告: MongoDB 未运行，请先启动 MongoDB"
    exit 1
fi

# 加载环境变量
set -a
source "$SCRIPT_DIR/.env"
set +a

echo "环境变量已加载:"
echo "- JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "- GATEWAY_PORT: $GATEWAY_PORT"

# 启动API网关
echo "启动 API 网关..."
cd "$SCRIPT_DIR/gateway" && node server.js &
GATEWAY_PID=$!
echo "API网关 PID: $GATEWAY_PID"

# 启动用户服务
echo "启动用户服务..."
cd "$SCRIPT_DIR/services/user-service" && node server.js &
USER_SERVICE_PID=$!
echo "用户服务 PID: $USER_SERVICE_PID"

# 启动数据服务
echo "启动数据服务..."
cd "$SCRIPT_DIR/services/data-service" && node server.js &
DATA_SERVICE_PID=$!
echo "数据服务 PID: $DATA_SERVICE_PID"

# 等待服务启动
sleep 5

echo "所有服务已启动:"
echo "- API 网关: http://localhost:$GATEWAY_PORT (PID: $GATEWAY_PID)"
echo "- 用户服务: http://localhost:3001 (PID: $USER_SERVICE_PID)"
echo "- 数据服务: http://localhost:3003 (PID: $DATA_SERVICE_PID)"

# 保存PID以便后续停止
echo $GATEWAY_PID > "$SCRIPT_DIR/gateway.pid"
echo $USER_SERVICE_PID > "$SCRIPT_DIR/user-service.pid"
echo $DATA_SERVICE_PID > "$SCRIPT_DIR/data-service.pid"

echo "使用 ./stop-services.sh 停止所有服务"