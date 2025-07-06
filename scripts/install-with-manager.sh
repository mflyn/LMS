#!/bin/bash

# 支持多种包管理器的官网依赖安装脚本
# 支持 npm、yarn、pnpm

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

# 检测可用的包管理器
detect_package_managers() {
    local managers=()
    
    if command -v npm &> /dev/null; then
        managers+=("npm")
    fi
    
    if command -v yarn &> /dev/null; then
        managers+=("yarn")
    fi
    
    if command -v pnpm &> /dev/null; then
        managers+=("pnpm")
    fi
    
    echo "${managers[@]}"
}

# 选择包管理器
choose_package_manager() {
    local available_managers=($(detect_package_managers))
    
    if [ ${#available_managers[@]} -eq 0 ]; then
        log_error "未找到任何包管理器，请先安装 Node.js"
        exit 1
    fi
    
    echo "检测到以下包管理器："
    for i in "${!available_managers[@]}"; do
        echo "  $((i+1)). ${available_managers[i]}"
    done
    
    # 如果只有一个，直接使用
    if [ ${#available_managers[@]} -eq 1 ]; then
        PACKAGE_MANAGER="${available_managers[0]}"
        log_info "自动选择: $PACKAGE_MANAGER"
        return
    fi
    
    # 多个选择时询问用户
    while true; do
        read -p "请选择包管理器 (1-${#available_managers[@]}): " choice
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#available_managers[@]} ]; then
            PACKAGE_MANAGER="${available_managers[$((choice-1))]}"
            log_info "已选择: $PACKAGE_MANAGER"
            break
        else
            log_warning "无效选择，请输入 1-${#available_managers[@]} 之间的数字"
        fi
    done
}

# 设置包管理器配置
setup_package_manager() {
    log_info "配置 $PACKAGE_MANAGER 使用官方源..."
    
    case $PACKAGE_MANAGER in
        npm)
            npm config set registry https://registry.npmjs.org/
            ;;
        yarn)
            yarn config set registry https://registry.npmjs.org/
            ;;
        pnpm)
            pnpm config set registry https://registry.npmjs.org/
            ;;
    esac
    
    log_success "$PACKAGE_MANAGER 已配置为使用官方源"
}

# 清理缓存
clean_cache() {
    log_info "清理 $PACKAGE_MANAGER 缓存..."
    
    case $PACKAGE_MANAGER in
        npm)
            npm cache clean --force
            ;;
        yarn)
            yarn cache clean
            ;;
        pnpm)
            pnpm store prune
            ;;
    esac
    
    log_success "缓存清理完成"
}

# 安装依赖
install_dependencies() {
    local path="$1"
    local name="$2"
    
    log_info "安装 $name 依赖..."
    cd "$path"
    
    # 删除锁定文件
    case $PACKAGE_MANAGER in
        npm)
            [ -f "package-lock.json" ] && rm package-lock.json
            ;;
        yarn)
            [ -f "yarn.lock" ] && rm yarn.lock
            ;;
        pnpm)
            [ -f "pnpm-lock.yaml" ] && rm pnpm-lock.yaml
            ;;
    esac
    
    # 执行安装
    case $PACKAGE_MANAGER in
        npm)
            npm install --registry https://registry.npmjs.org/
            ;;
        yarn)
            yarn install --registry https://registry.npmjs.org/
            ;;
        pnpm)
            pnpm install --registry https://registry.npmjs.org/
            ;;
    esac
    
    log_success "$name 依赖安装完成"
}

# 显示安装命令对比
show_commands_comparison() {
    log_info "包管理器命令对比："
    echo "┌─────────────┬─────────────────────┬─────────────────────┬─────────────────────┐"
    echo "│    操作     │        npm          │       yarn          │       pnpm          │"
    echo "├─────────────┼─────────────────────┼─────────────────────┼─────────────────────┤"
    echo "│   安装依赖   │   npm install       │   yarn install      │   pnpm install      │"
    echo "│   添加依赖   │   npm install pkg   │   yarn add pkg      │   pnpm add pkg      │"
    echo "│   删除依赖   │   npm uninstall pkg │   yarn remove pkg   │   pnpm remove pkg   │"
    echo "│   运行脚本   │   npm run script    │   yarn run script   │   pnpm run script   │"
    echo "│   清理缓存   │   npm cache clean   │   yarn cache clean  │   pnpm store prune  │"
    echo "└─────────────┴─────────────────────┴─────────────────────┴─────────────────────┘"
}

# 主安装流程
main_install() {
    local start_dir=$(pwd)
    
    # 安装根目录依赖
    install_dependencies "$start_dir" "根目录"
    
    # 安装前端 Web 依赖
    install_dependencies "$start_dir/frontend/web" "前端 Web"
    cd "$start_dir"
    
    # 安装移动端依赖
    install_dependencies "$start_dir/frontend/mobile" "移动端"
    cd "$start_dir"
    
    # 安装网关依赖
    install_dependencies "$start_dir/backend/gateway" "网关"
    cd "$start_dir"
    
    # 安装后端服务依赖
    local services=("analytics-service" "data-service" "homework-service" "interaction-service" "progress-service" "resource-service" "user-service")
    
    for service in "${services[@]}"; do
        if [ -d "backend/services/$service" ] && [ -f "backend/services/$service/package.json" ]; then
            install_dependencies "$start_dir/backend/services/$service" "$service"
            cd "$start_dir"
        else
            log_warning "$service 不存在或没有 package.json 文件"
        fi
    done
    
    # 安装测试依赖
    if [ -f "backend/tests/package.json" ]; then
        install_dependencies "$start_dir/backend/tests" "测试"
        cd "$start_dir"
    fi
}

# 显示性能对比
show_performance_info() {
    log_info "包管理器性能特点："
    echo ""
    echo "📦 npm:"
    echo "  • 官方包管理器，兼容性最好"
    echo "  • 安装速度中等"
    echo "  • 磁盘占用较大"
    echo ""
    echo "🧶 yarn:"
    echo "  • 并行安装，速度较快"
    echo "  • 更好的缓存机制"
    echo "  • 支持工作区 (workspaces)"
    echo ""
    echo "⚡ pnpm:"
    echo "  • 硬链接机制，磁盘占用最小"
    echo "  • 安装速度最快"
    echo "  • 严格的依赖管理"
    echo ""
}

# 主函数
main() {
    echo "=========================================="
    echo "多包管理器官网依赖安装脚本"
    echo "=========================================="
    
    # 记录开始时间
    start_time=$(date +%s)
    
    # 选择包管理器
    choose_package_manager
    
    # 显示性能信息
    show_performance_info
    
    # 确认继续
    read -p "是否继续使用 $PACKAGE_MANAGER 进行安装? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "安装已取消"
        exit 0
    fi
    
    # 执行安装
    setup_package_manager
    clean_cache
    main_install
    
    # 计算耗时
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo "=========================================="
    log_success "所有依赖安装完成！"
    log_info "使用包管理器: $PACKAGE_MANAGER"
    log_info "总耗时: ${duration} 秒"
    echo "=========================================="
    
    # 显示命令对比
    show_commands_comparison
    
    # 后续操作提示
    echo ""
    log_info "后续操作建议："
    case $PACKAGE_MANAGER in
        npm)
            echo "  • 运行测试: npm test"
            echo "  • 启动前端: cd frontend/web && npm start"
            echo "  • 启动移动端: cd frontend/mobile && npm start"
            ;;
        yarn)
            echo "  • 运行测试: yarn test"
            echo "  • 启动前端: cd frontend/web && yarn start"
            echo "  • 启动移动端: cd frontend/mobile && yarn start"
            ;;
        pnpm)
            echo "  • 运行测试: pnpm test"
            echo "  • 启动前端: cd frontend/web && pnpm start"
            echo "  • 启动移动端: cd frontend/mobile && pnpm start"
            ;;
    esac
    echo "  • 启动系统: docker-compose up"
}

# 错误处理
trap 'log_error "脚本执行过程中出现错误"; exit 1' ERR

# 执行主函数
main "$@" 