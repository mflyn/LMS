#!/bin/bash

# 快速从官网拉取依赖脚本
# 适合已配置好代理的环境快速安装

echo "🚀 开始快速安装依赖..."

# 设置官方源
echo "📦 设置 npm 官方源..."
npm config set registry https://registry.npmjs.org/

# 根目录依赖
echo "📁 安装根目录依赖..."
npm install --registry https://registry.npmjs.org/

# 前端 Web 依赖
echo "🌐 安装前端 Web 依赖..."
cd frontend/web
npm install --registry https://registry.npmjs.org/
cd ../..

# 移动端依赖
echo "📱 安装移动端依赖..."
cd frontend/mobile
npm install --registry https://registry.npmjs.org/
cd ../..

# 网关依赖
echo "🚪 安装网关依赖..."
cd backend/gateway
npm install --registry https://registry.npmjs.org/
cd ../..

# 后端服务依赖
echo "⚙️ 安装后端服务依赖..."
for service in analytics-service data-service homework-service interaction-service progress-service resource-service user-service; do
    if [ -d "backend/services/$service" ] && [ -f "backend/services/$service/package.json" ]; then
        echo "  📦 安装 $service..."
        cd "backend/services/$service"
        npm install --registry https://registry.npmjs.org/
        cd ../../..
    fi
done

# 测试依赖
if [ -f "backend/tests/package.json" ]; then
    echo "🧪 安装测试依赖..."
    cd backend/tests
    npm install --registry https://registry.npmjs.org/
    cd ../..
fi

echo "✅ 依赖安装完成！"
echo ""
echo "📋 后续操作："
echo "  • 运行测试: npm test"
echo "  • 启动前端: cd frontend/web && npm start"
echo "  • 启动系统: docker-compose up" 