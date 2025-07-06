#!/bin/bash

# 验证依赖安装结果的脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 检查目录和文件
check_directory() {
    local dir="$1"
    local name="$2"
    
    if [ -d "$dir" ]; then
        log_success "$name 目录存在"
        return 0
    else
        log_error "$name 目录不存在: $dir"
        return 1
    fi
}

check_node_modules() {
    local dir="$1"
    local name="$2"
    
    if [ -d "$dir/node_modules" ]; then
        local count=$(find "$dir/node_modules" -maxdepth 1 -type d | wc -l)
        log_success "$name node_modules 存在 (包含 $count 个依赖)"
        return 0
    else
        log_error "$name node_modules 不存在"
        return 1
    fi
}

check_package_json() {
    local file="$1"
    local name="$2"
    
    if [ -f "$file" ]; then
        log_success "$name package.json 存在"
        return 0
    else
        log_error "$name package.json 不存在"
        return 1
    fi
}

# 检查关键依赖包
check_key_dependencies() {
    local dir="$1"
    local name="$2"
    local deps=("${@:3}")
    
    log_info "检查 $name 关键依赖..."
    
    for dep in "${deps[@]}"; do
        if [ -d "$dir/node_modules/$dep" ]; then
            log_success "  ✓ $dep"
        else
            log_warning "  ✗ $dep 缺失"
        fi
    done
}

# 验证 Node.js 和 npm
verify_node_environment() {
    log_info "验证 Node.js 环境..."
    
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_success "Node.js 版本: $node_version"
    else
        log_error "Node.js 未安装"
        return 1
    fi
    
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log_success "npm 版本: $npm_version"
    else
        log_error "npm 未安装"
        return 1
    fi
    
    # 检查其他包管理器
    if command -v yarn &> /dev/null; then
        local yarn_version=$(yarn --version)
        log_info "yarn 版本: $yarn_version"
    fi
    
    if command -v pnpm &> /dev/null; then
        local pnpm_version=$(pnpm --version)
        log_info "pnpm 版本: $pnpm_version"
    fi
}

# 验证根目录
verify_root() {
    log_info "验证根目录..."
    
    check_package_json "package.json" "根目录" || return 1
    check_node_modules "." "根目录" || return 1
    
    # 检查关键依赖
    local root_deps=("express" "mongoose" "jsonwebtoken" "bcryptjs" "winston")
    check_key_dependencies "." "根目录" "${root_deps[@]}"
}

# 验证前端 Web
verify_frontend_web() {
    log_info "验证前端 Web..."
    
    check_directory "frontend/web" "前端 Web" || return 1
    check_package_json "frontend/web/package.json" "前端 Web" || return 1
    check_node_modules "frontend/web" "前端 Web" || return 1
    
    # 检查关键依赖
    local web_deps=("react" "react-dom" "antd" "axios" "react-router-dom")
    check_key_dependencies "frontend/web" "前端 Web" "${web_deps[@]}"
}

# 验证移动端
verify_frontend_mobile() {
    log_info "验证移动端..."
    
    check_directory "frontend/mobile" "移动端" || return 1
    check_package_json "frontend/mobile/package.json" "移动端" || return 1
    check_node_modules "frontend/mobile" "移动端" || return 1
    
    # 检查关键依赖
    local mobile_deps=("react" "react-native" "expo" "@react-navigation/native")
    check_key_dependencies "frontend/mobile" "移动端" "${mobile_deps[@]}"
}

# 验证网关
verify_gateway() {
    log_info "验证网关..."
    
    check_directory "backend/gateway" "网关" || return 1
    check_package_json "backend/gateway/package.json" "网关" || return 1
    check_node_modules "backend/gateway" "网关" || return 1
    
    # 检查关键依赖
    local gateway_deps=("express" "express-http-proxy" "cors" "helmet")
    check_key_dependencies "backend/gateway" "网关" "${gateway_deps[@]}"
}

# 验证后端服务
verify_backend_services() {
    log_info "验证后端服务..."
    
    local services=("analytics-service" "data-service" "homework-service" "interaction-service" "progress-service" "resource-service" "user-service")
    
    for service in "${services[@]}"; do
        if [ -d "backend/services/$service" ]; then
            log_info "检查 $service..."
            check_package_json "backend/services/$service/package.json" "$service"
            check_node_modules "backend/services/$service" "$service"
        else
            log_warning "$service 目录不存在"
        fi
    done
}

# 验证测试环境
verify_test_environment() {
    log_info "验证测试环境..."
    
    if [ -f "backend/tests/package.json" ]; then
        check_node_modules "backend/tests" "测试"
        
        # 检查测试依赖
        local test_deps=("jest" "supertest" "@testing-library/react")
        check_key_dependencies "backend/tests" "测试" "${test_deps[@]}"
    else
        log_warning "测试目录不存在或没有 package.json"
    fi
}

# 计算磁盘使用情况
calculate_disk_usage() {
    log_info "计算磁盘使用情况..."
    
    # 统计 node_modules 数量
    local modules_count=$(find . -name "node_modules" -type d 2>/dev/null | wc -l)
    log_info "node_modules 目录数量: $modules_count"
    
    # 计算总大小
    if command -v du &> /dev/null; then
        local total_size=$(du -sh . 2>/dev/null | cut -f1)
        log_info "项目总大小: $total_size"
        
        # 计算 node_modules 大小
        local modules_size=$(find . -name "node_modules" -type d -exec du -sh {} + 2>/dev/null | awk '{sum+=$1} END {print sum "M"}' 2>/dev/null || echo "未知")
        log_info "所有 node_modules 大小: $modules_size"
    fi
}

# 运行简单测试
run_simple_tests() {
    log_info "运行简单验证测试..."
    
    # 测试 Node.js 脚本执行
    if node -e "console.log('Node.js 运行正常')" 2>/dev/null; then
        log_success "Node.js 脚本执行正常"
    else
        log_error "Node.js 脚本执行失败"
    fi
    
    # 测试 npm 命令
    if npm --version >/dev/null 2>&1; then
        log_success "npm 命令正常"
    else
        log_error "npm 命令异常"
    fi
}

# 生成验证报告
generate_report() {
    local total_checks="$1"
    local passed_checks="$2"
    local failed_checks="$((total_checks - passed_checks))"
    
    echo ""
    echo "=========================================="
    echo "安装验证报告"
    echo "=========================================="
    echo "总检查项: $total_checks"
    echo "通过检查: $passed_checks"
    echo "失败检查: $failed_checks"
    echo "通过率: $(( passed_checks * 100 / total_checks ))%"
    echo "=========================================="
    
    if [ $failed_checks -eq 0 ]; then
        log_success "🎉 所有检查通过！安装验证成功！"
        echo ""
        echo "🚀 您现在可以："
        echo "  • 运行 'npm test' 执行测试"
        echo "  • 运行 'cd frontend/web && npm start' 启动前端"
        echo "  • 运行 'cd frontend/mobile && npm start' 启动移动端"
        echo "  • 运行 'docker-compose up' 启动完整系统"
    else
        log_warning "⚠️  发现 $failed_checks 个问题，请检查上述错误信息"
        echo ""
        echo "🔧 建议操作："
        echo "  • 重新运行安装脚本"
        echo "  • 检查网络连接"
        echo "  • 确认系统环境满足要求"
    fi
}

# 主函数
main() {
    echo "=========================================="
    echo "依赖安装验证脚本"
    echo "=========================================="
    
    local total_checks=0
    local passed_checks=0
    
    # 执行各项验证
    verify_node_environment && ((passed_checks++)) || true
    ((total_checks++))
    
    verify_root && ((passed_checks++)) || true
    ((total_checks++))
    
    verify_frontend_web && ((passed_checks++)) || true
    ((total_checks++))
    
    verify_frontend_mobile && ((passed_checks++)) || true
    ((total_checks++))
    
    verify_gateway && ((passed_checks++)) || true
    ((total_checks++))
    
    verify_backend_services && ((passed_checks++)) || true
    ((total_checks++))
    
    verify_test_environment && ((passed_checks++)) || true
    ((total_checks++))
    
    # 额外信息
    calculate_disk_usage
    run_simple_tests
    
    # 生成报告
    generate_report $total_checks $passed_checks
}

# 执行主函数
main "$@" 