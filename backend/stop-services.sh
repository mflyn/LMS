#!/bin/bash

# 小学生学习追踪系统 - 服务启动脚本

echo "停止小学生学习追踪系统服务..."

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "警告: .env 文件不存在，请复制 .env.example 并配置相应的环境变量"
    exit 1
fi

# 检查MongoDB是否运行
if ! pgrep -x "mongod" > /dev/null; then
    echo "警告: MongoDB 未运行，请先启动 MongoDB"
    exit 1
fi

# 停止API网关
if [ -f "$SCRIPT_DIR/gateway.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/gateway.pid")
    kill $PID 2>/dev/null
    rm "$SCRIPT_DIR/gateway.pid"
    echo "API 网关已停止 (PID: $PID)"
fi

# 停止用户服务
if [ -f "$SCRIPT_DIR/user-service.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/user-service.pid")
    kill $PID 2>/dev/null
    rm "$SCRIPT_DIR/user-service.pid"
    echo "用户服务已停止 (PID: $PID)"
fi

# 停止数据服务
if [ -f "$SCRIPT_DIR/data-service.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/data-service.pid")
    kill $PID 2>/dev/null
    rm "$SCRIPT_DIR/data-service.pid"
    echo "数据服务已停止 (PID: $PID)"
fi

echo "所有服务已停止"