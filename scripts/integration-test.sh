#!/bin/bash

# 小学生学习追踪系统 - 本地集成测试脚本
# 作者：开发团队
# 版本：1.0.0
# 日期：2024-01-01

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend/web"
TEST_DIR="$PROJECT_ROOT/backend/tests"
LOG_DIR="$PROJECT_ROOT/logs"
REPORT_DIR="$PROJECT_ROOT/test-reports"

# 创建必要目录
mkdir -p "$LOG_DIR" "$REPORT_DIR"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 检查依赖函数
check_dependencies() {
    log_info "检查系统依赖..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装，请先安装Node.js"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm未安装，请先安装npm"
        exit 1
    fi
    
    log_success "所有依赖检查通过"
}

# 环境检查函数
check_environment() {
    log_info "检查环境配置..."
    
    # 检查环境变量文件
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_warning "未找到.env文件，从示例文件创建..."
        if [ -f "$PROJECT_ROOT/docs/env-example.md" ]; then
            # 提取env-example.md中的环境变量配置
            grep -E "^[A-Z_]+=.*$" "$PROJECT_ROOT/docs/env-example.md" > "$PROJECT_ROOT/.env" || true
            log_success "已创建.env文件"
        else
            log_error "未找到env-example.md文件"
            exit 1
        fi
    fi
    
    # 检查端口占用
    check_port() {
        local port=$1
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_warning "端口 $port 已被占用"
            return 1
        fi
        return 0
    }
    
    # 检查关键端口
    ports=(3000 3001 3003 3006 27017 6379)
    occupied_ports=()
    
    for port in "${ports[@]}"; do
        if ! check_port $port; then
            occupied_ports+=($port)
        fi
    done
    
    if [ ${#occupied_ports[@]} -gt 0 ]; then
        log_error "以下端口被占用: ${occupied_ports[*]}"
        log_info "请关闭占用这些端口的进程或使用以下命令清理Docker容器："
        echo "docker compose down"
        echo "docker system prune -f"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 启动后端服务
start_backend() {
    log_info "启动后端服务..."
    
    cd "$PROJECT_ROOT"
    
    # 清理旧容器
    docker compose down --remove-orphans || true
    
    # 启动服务
    docker compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    if ! docker compose ps | grep -q "Up"; then
        log_error "后端服务启动失败"
        docker compose logs
        exit 1
    fi
    
    log_success "后端服务启动成功"
}

# 验证后端服务
verify_backend() {
    log_info "验证后端服务..."
    
    # 检查API网关
    if curl -s http://localhost:3000/api/health > /dev/null; then
        log_success "API网关健康检查通过"
    else
        log_error "API网关健康检查失败"
        return 1
    fi
    
    # 检查数据库连接
    if docker compose exec -T mongo mongosh --eval "db.stats()" > /dev/null 2>&1; then
        log_success "MongoDB连接正常"
    else
        log_error "MongoDB连接失败"
        return 1
    fi
    
    # 检查Redis连接
    if docker compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Redis连接正常"
    else
        log_error "Redis连接失败"
        return 1
    fi
    
    log_success "后端服务验证通过"
}

# 运行后端测试
run_backend_tests() {
    log_info "运行后端测试..."
    
    if [ -d "$TEST_DIR" ]; then
        cd "$TEST_DIR"
        
        # 安装测试依赖
        if [ -f "package.json" ]; then
            npm install
        fi
        
        # 运行测试
        if npm test > "$LOG_DIR/backend-test.log" 2>&1; then
            log_success "后端测试通过"
        else
            log_error "后端测试失败"
            cat "$LOG_DIR/backend-test.log"
            return 1
        fi
    else
        log_warning "未找到后端测试目录，跳过后端测试"
    fi
}

# 启动前端服务
start_frontend() {
    log_info "启动前端服务..."
    
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        
        # 安装依赖
        if [ ! -d "node_modules" ]; then
            npm install
        fi
        
        # 配置环境变量
        if [ ! -f ".env.local" ]; then
            cat > .env.local << EOF
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=ws://localhost:3000
REACT_APP_ENV=development
REACT_APP_VERSION=1.0.0
REACT_APP_DEBUG=true
EOF
            log_info "已创建前端环境变量文件"
        fi
        
        # 启动开发服务器
        PORT=3001 npm start > "$LOG_DIR/frontend.log" 2>&1 &
        FRONTEND_PID=$!
        
        # 等待前端服务启动
        log_info "等待前端服务启动..."
        sleep 15
        
        # 检查前端服务是否启动
        if curl -s http://localhost:3001 > /dev/null; then
            log_success "前端服务启动成功"
        else
            log_error "前端服务启动失败"
            kill $FRONTEND_PID 2>/dev/null || true
            return 1
        fi
    else
        log_warning "未找到前端目录，跳过前端启动"
        FRONTEND_PID=""
    fi
}

# 运行前端测试
run_frontend_tests() {
    log_info "运行前端测试..."
    
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        
        # 运行测试
        if npm test -- --coverage --watchAll=false > "$LOG_DIR/frontend-test.log" 2>&1; then
            log_success "前端测试通过"
        else
            log_error "前端测试失败"
            cat "$LOG_DIR/frontend-test.log"
            return 1
        fi
    else
        log_warning "未找到前端目录，跳过前端测试"
    fi
}

# 运行集成测试
run_integration_tests() {
    log_info "运行集成测试..."
    
    # API连通性测试
    test_api_connectivity() {
        log_info "测试API连通性..."
        
        local endpoints=(
            "http://localhost:3000/api/health"
            "http://localhost:3001"
        )
        
        for endpoint in "${endpoints[@]}"; do
            if curl -s "$endpoint" > /dev/null; then
                log_success "端点 $endpoint 连通正常"
            else
                log_error "端点 $endpoint 连通失败"
                return 1
            fi
        done
    }
    
    # 数据库功能测试
    test_database_functionality() {
        log_info "测试数据库功能..."
        
        # 测试MongoDB
        if docker compose exec -T mongo mongosh --eval "
            use learning_tracker;
            db.test_collection.insertOne({test: 'data', timestamp: new Date()});
            db.test_collection.findOne({test: 'data'});
            db.test_collection.deleteOne({test: 'data'});
        " > /dev/null 2>&1; then
            log_success "MongoDB功能测试通过"
        else
            log_error "MongoDB功能测试失败"
            return 1
        fi
        
        # 测试Redis
        if docker compose exec -T redis redis-cli set test_key "test_value" > /dev/null && \
           docker compose exec -T redis redis-cli get test_key | grep -q "test_value" && \
           docker compose exec -T redis redis-cli del test_key > /dev/null; then
            log_success "Redis功能测试通过"
        else
            log_error "Redis功能测试失败"
            return 1
        fi
    }
    
    # 执行集成测试
    test_api_connectivity
    test_database_functionality
    
    log_success "集成测试完成"
}

# 性能测试
run_performance_tests() {
    log_info "运行性能测试..."
    
    # 检查是否安装了k6
    if command -v k6 &> /dev/null; then
        if [ -f "$PROJECT_ROOT/performance/load-test.js" ]; then
            k6 run "$PROJECT_ROOT/performance/load-test.js" > "$LOG_DIR/performance-test.log" 2>&1
            log_success "性能测试完成，结果保存在 $LOG_DIR/performance-test.log"
        else
            log_warning "未找到性能测试脚本，跳过性能测试"
        fi
    else
        log_warning "未安装k6，跳过性能测试"
    fi
}

# 生成测试报告
generate_report() {
    log_info "生成测试报告..."
    
    local report_file="$REPORT_DIR/integration-test-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# 集成测试报告

## 测试概述
- 测试日期：$(date '+%Y-%m-%d %H:%M:%S')
- 测试环境：本地开发环境
- 操作系统：$(uname -s) $(uname -r)
- Docker版本：$(docker --version)
- Node.js版本：$(node --version)

## 测试结果摘要

### 环境检查
- 依赖检查：✅ 通过
- 环境配置：✅ 通过
- 端口检查：✅ 通过

### 后端服务
- 服务启动：✅ 通过
- 健康检查：✅ 通过
- 数据库连接：✅ 通过
- 单元测试：$([ -f "$LOG_DIR/backend-test.log" ] && echo "✅ 通过" || echo "⚠️ 跳过")

### 前端服务
- 服务启动：$([ -n "$FRONTEND_PID" ] && echo "✅ 通过" || echo "⚠️ 跳过")
- 单元测试：$([ -f "$LOG_DIR/frontend-test.log" ] && echo "✅ 通过" || echo "⚠️ 跳过")

### 集成测试
- API连通性：✅ 通过
- 数据库功能：✅ 通过

### 性能测试
- 负载测试：$([ -f "$LOG_DIR/performance-test.log" ] && echo "✅ 完成" || echo "⚠️ 跳过")

## 详细日志
- 后端测试日志：$LOG_DIR/backend-test.log
- 前端测试日志：$LOG_DIR/frontend-test.log
- 前端服务日志：$LOG_DIR/frontend.log
- 性能测试日志：$LOG_DIR/performance-test.log

## 建议
1. 定期运行集成测试以确保系统稳定性
2. 关注性能测试结果，及时优化系统性能
3. 保持测试覆盖率在80%以上

## 下一步
- 在生产环境中进行部署前测试
- 配置持续集成流水线
- 添加更多端到端测试用例

EOF

    log_success "测试报告已生成：$report_file"
}

# 清理函数
cleanup() {
    log_info "清理测试环境..."
    
    # 停止前端服务
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        log_info "已停止前端服务"
    fi
    
    # 停止Docker服务（可选）
    if [ "$CLEANUP_DOCKER" = "true" ]; then
        cd "$PROJECT_ROOT"
        docker compose down
        log_info "已停止Docker服务"
    fi
    
    log_success "清理完成"
}

# 显示帮助信息
show_help() {
    cat << EOF
小学生学习追踪系统 - 集成测试脚本

用法：
    $0 [选项]

选项：
    -h, --help              显示帮助信息
    -c, --cleanup           测试完成后清理Docker容器
    -s, --skip-frontend     跳过前端测试
    -p, --performance       运行性能测试
    -v, --verbose           详细输出模式

示例：
    $0                      运行完整集成测试
    $0 -c                   运行测试并清理环境
    $0 -s                   跳过前端测试
    $0 -p                   包含性能测试

EOF
}

# 主函数
main() {
    local skip_frontend=false
    local run_perf_tests=false
    local verbose=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--cleanup)
                CLEANUP_DOCKER=true
                shift
                ;;
            -s|--skip-frontend)
                skip_frontend=true
                shift
                ;;
            -p|--performance)
                run_perf_tests=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                set -x
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 设置错误处理
    trap cleanup EXIT
    
    log_info "开始集成测试..."
    
    # 执行测试步骤
    check_dependencies
    check_environment
    start_backend
    verify_backend
    run_backend_tests
    
    if [ "$skip_frontend" = false ]; then
        start_frontend
        run_frontend_tests
    fi
    
    run_integration_tests
    
    if [ "$run_perf_tests" = true ]; then
        run_performance_tests
    fi
    
    generate_report
    
    log_success "集成测试完成！"
    log_info "测试报告保存在：$REPORT_DIR/"
    log_info "详细日志保存在：$LOG_DIR/"
}

# 执行主函数
main "$@" 