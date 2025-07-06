#!/bin/bash

# 小学生学习追踪系统 - 从官网拉取依赖包脚本
# 使用前请确保已配置好网络代理

set -e  # 遇到错误立即退出

echo "=========================================="
echo "开始从官网拉取所有项目依赖..."
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查网络连接
check_network() {
    log_info "检查网络连接..."
    if curl -s --max-time 10 https://registry.npmjs.org/ > /dev/null; then
        log_success "网络连接正常"
    else
        log_error "无法连接到 npm 官方源，请检查网络代理配置"
        exit 1
    fi
}

# 设置 npm 源为官方源
setup_npm_registry() {
    log_info "设置 npm 源为官方源..."
    npm config set registry https://registry.npmjs.org/
    yarn config set registry https://registry.npmjs.org/
    log_success "npm 和 yarn 源已设置为官方源"
}

# 清理缓存
clean_cache() {
    log_info "清理 npm 和 yarn 缓存..."
    npm cache clean --force
    yarn cache clean
    log_success "缓存清理完成"
}

# 安装根目录依赖
install_root_dependencies() {
    log_info "安装根目录依赖..."
    cd "$(dirname "$0")/.."
    
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
        log_warning "已删除旧的 package-lock.json"
    fi
    
    npm install --registry https://registry.npmjs.org/
    log_success "根目录依赖安装完成"
}

# 安装前端 Web 依赖
install_frontend_web() {
    log_info "安装前端 Web 依赖..."
    cd frontend/web
    
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
        log_warning "已删除前端 Web 的 package-lock.json"
    fi
    
    npm install --registry https://registry.npmjs.org/
    log_success "前端 Web 依赖安装完成"
    cd ../..
}

# 安装移动端依赖
install_frontend_mobile() {
    log_info "安装移动端依赖..."
    cd frontend/mobile
    
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
        log_warning "已删除移动端的 package-lock.json"
    fi
    
    npm install --registry https://registry.npmjs.org/
    log_success "移动端依赖安装完成"
    cd ../..
}

# 安装网关服务依赖
install_gateway() {
    log_info "安装网关服务依赖..."
    cd backend/gateway
    
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
        log_warning "已删除网关的 package-lock.json"
    fi
    
    npm install --registry https://registry.npmjs.org/
    log_success "网关服务依赖安装完成"
    cd ../..
}

# 安装后端服务依赖
install_backend_services() {
    log_info "安装后端微服务依赖..."
    
    # 服务列表
    services=(
        "analytics-service"
        "data-service" 
        "homework-service"
        "interaction-service"
        "progress-service"
        "resource-service"
        "user-service"
    )
    
    for service in "${services[@]}"; do
        if [ -d "backend/services/$service" ] && [ -f "backend/services/$service/package.json" ]; then
            log_info "安装 $service 依赖..."
            cd "backend/services/$service"
            
            if [ -f "package-lock.json" ]; then
                rm package-lock.json
                log_warning "已删除 $service 的 package-lock.json"
            fi
            
            npm install --registry https://registry.npmjs.org/
            log_success "$service 依赖安装完成"
            cd ../../..
        else
            log_warning "$service 不存在或没有 package.json 文件"
        fi
    done
}

# 安装测试依赖
install_test_dependencies() {
    log_info "安装测试依赖..."
    if [ -d "backend/tests" ] && [ -f "backend/tests/package.json" ]; then
        cd backend/tests
        
        if [ -f "package-lock.json" ]; then
            rm package-lock.json
            log_warning "已删除测试的 package-lock.json"
        fi
        
        npm install --registry https://registry.npmjs.org/
        log_success "测试依赖安装完成"
        cd ../..
    fi
}

# 验证安装
verify_installation() {
    log_info "验证安装结果..."
    
    # 检查关键依赖
    local error_count=0
    
    # 检查根目录
    if [ ! -d "node_modules" ]; then
        log_error "根目录 node_modules 不存在"
        ((error_count++))
    fi
    
    # 检查前端 Web
    if [ ! -d "frontend/web/node_modules" ]; then
        log_error "前端 Web node_modules 不存在"
        ((error_count++))
    fi
    
    # 检查移动端
    if [ ! -d "frontend/mobile/node_modules" ]; then
        log_error "移动端 node_modules 不存在"
        ((error_count++))
    fi
    
    # 检查网关
    if [ ! -d "backend/gateway/node_modules" ]; then
        log_error "网关 node_modules 不存在"
        ((error_count++))
    fi
    
    if [ $error_count -eq 0 ]; then
        log_success "所有依赖安装验证通过"
    else
        log_error "发现 $error_count 个安装问题"
        return 1
    fi
}

# 显示安装统计
show_statistics() {
    log_info "安装统计信息："
    echo "----------------------------------------"
    
    # 统计 node_modules 数量和大小
    local modules_count=$(find . -name "node_modules" -type d | wc -l)
    local total_size=$(du -sh . 2>/dev/null | cut -f1)
    
    echo "node_modules 目录数量: $modules_count"
    echo "项目总大小: $total_size"
    echo "----------------------------------------"
}

# 主执行流程
main() {
    log_info "开始执行官网依赖拉取流程"
    
    # 记录开始时间
    start_time=$(date +%s)
    
    # 执行安装步骤
    check_network
    setup_npm_registry
    clean_cache
    install_root_dependencies
    install_frontend_web
    install_frontend_mobile
    install_gateway
    install_backend_services
    install_test_dependencies
    verify_installation
    show_statistics
    
    # 计算耗时
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo "=========================================="
    log_success "所有依赖拉取完成！"
    log_info "总耗时: ${duration} 秒"
    echo "=========================================="
    
    # 提示后续操作
    echo ""
    log_info "后续操作建议："
    echo "1. 运行 'npm test' 验证后端功能"
    echo "2. 运行 'cd frontend/web && npm start' 启动前端"
    echo "3. 运行 'cd frontend/mobile && npm start' 启动移动端"
    echo "4. 运行 'docker-compose up' 启动完整系统"
}

# 错误处理
trap 'log_error "脚本执行过程中出现错误，请检查上述输出"; exit 1' ERR

# 执行主函数
main "$@" 