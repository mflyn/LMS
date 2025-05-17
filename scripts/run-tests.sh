#!/bin/bash

# 运行测试并生成覆盖率报告的脚本

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
  echo -e "${BLUE}测试运行脚本${NC}"
  echo "用法: $0 [选项]"
  echo ""
  echo "选项:"
  echo "  -h, --help        显示帮助信息"
  echo "  -u, --unit        只运行单元测试"
  echo "  -i, --integration 只运行集成测试"
  echo "  -b, --basic       只运行基本测试（不依赖数据库）"
  echo "  -c, --coverage    生成覆盖率报告"
  echo "  -s, --service     指定服务名称（例如：analytics-service）"
  echo ""
  echo "示例:"
  echo "  $0 -u -c          运行单元测试并生成覆盖率报告"
  echo "  $0 -i -s analytics-service  运行分析服务的集成测试"
  echo "  $0 -b             运行所有基本测试"
}

# 默认参数
RUN_UNIT=false
RUN_INTEGRATION=false
RUN_BASIC=false
GENERATE_COVERAGE=false
SERVICE=""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -u|--unit)
      RUN_UNIT=true
      shift
      ;;
    -i|--integration)
      RUN_INTEGRATION=true
      shift
      ;;
    -b|--basic)
      RUN_BASIC=true
      shift
      ;;
    -c|--coverage)
      GENERATE_COVERAGE=true
      shift
      ;;
    -s|--service)
      SERVICE="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}未知选项: $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

# 如果没有指定测试类型，则运行所有测试
if [[ "$RUN_UNIT" == "false" && "$RUN_INTEGRATION" == "false" && "$RUN_BASIC" == "false" ]]; then
  RUN_UNIT=true
  RUN_INTEGRATION=true
  RUN_BASIC=true
fi

# 构建测试命令
build_test_command() {
  local test_type=$1
  local command="npx jest"
  
  # 添加测试类型
  if [[ "$test_type" == "unit" ]]; then
    command="$command --testMatch='**/__tests__/unit/**/*.test.js'"
  elif [[ "$test_type" == "integration" ]]; then
    command="$command --testMatch='**/__tests__/integration/**/*.test.js'"
  elif [[ "$test_type" == "basic" ]]; then
    command="$command backend/services/analytics-service/__tests__/integration/basic.test.js"
  fi
  
  # 添加服务名称
  if [[ -n "$SERVICE" ]]; then
    command="$command --testPathPattern='$SERVICE'"
  fi
  
  # 添加覆盖率选项
  if [[ "$GENERATE_COVERAGE" == "true" ]]; then
    command="$command --coverage"
  fi
  
  echo "$command"
}

# 运行测试
run_tests() {
  local test_type=$1
  local test_name=$2
  local command=$(build_test_command "$test_type")
  
  echo -e "${YELLOW}运行${test_name}...${NC}"
  echo -e "${BLUE}命令: $command${NC}"
  
  # 执行命令
  eval "$command"
  
  # 检查命令执行结果
  if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}${test_name}通过！${NC}"
  else
    echo -e "${RED}${test_name}失败！${NC}"
  fi
  
  echo ""
}

# 主函数
main() {
  echo -e "${BLUE}开始运行测试...${NC}"
  
  # 运行单元测试
  if [[ "$RUN_UNIT" == "true" ]]; then
    run_tests "unit" "单元测试"
  fi
  
  # 运行集成测试
  if [[ "$RUN_INTEGRATION" == "true" ]]; then
    run_tests "integration" "集成测试"
  fi
  
  # 运行基本测试
  if [[ "$RUN_BASIC" == "true" ]]; then
    run_tests "basic" "基本测试"
  fi
  
  echo -e "${BLUE}测试运行完成！${NC}"
}

# 执行主函数
main
