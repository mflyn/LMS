#!/bin/bash

# 小学生学习追踪系统 - API测试脚本

echo "=== 小学生学习追踪系统 API 测试 ==="
echo ""

BASE_URL="http://localhost:8000"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local headers="$5"
    
    echo -e "${YELLOW}测试: $name${NC}"
    
    if [ -n "$data" ]; then
        if [ -n "$headers" ]; then
            response=$(curl -s -X $method "$BASE_URL$url" -H "Content-Type: application/json" -H "$headers" -d "$data")
        else
            response=$(curl -s -X $method "$BASE_URL$url" -H "Content-Type: application/json" -d "$data")
        fi
    else
        if [ -n "$headers" ]; then
            response=$(curl -s -X $method "$BASE_URL$url" -H "$headers")
        else
            response=$(curl -s -X $method "$BASE_URL$url")
        fi
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 请求成功${NC}"
        echo "响应: $response"
    else
        echo -e "${RED}✗ 请求失败${NC}"
    fi
    echo ""
}

# 1. 测试健康检查
echo "=== 1. 健康检查测试 ==="
test_api "网关健康检查" "GET" "/health"
test_api "用户服务健康检查" "GET" "/api/auth/health"

# 2. 测试用户注册
echo "=== 2. 用户注册测试 ==="
register_data='{"username": "testuser2", "email": "test2@example.com", "password": "password123", "role": "student"}'
register_response=$(curl -s -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" -d "$register_data")
echo -e "${YELLOW}测试: 用户注册${NC}"
echo -e "${GREEN}✓ 请求成功${NC}"
echo "响应: $register_response"
echo ""

# 提取token
token=$(echo $register_response | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$token" ]; then
    echo -e "${GREEN}✓ 成功获取JWT Token${NC}"
    echo "Token: ${token:0:50}..."
else
    echo -e "${RED}✗ 未能获取JWT Token${NC}"
fi
echo ""

# 3. 测试用户登录
echo "=== 3. 用户登录测试 ==="
login_data='{"username": "testuser2", "password": "password123"}'
test_api "用户登录" "POST" "/api/auth/login" "$login_data"

# 4. 测试需要认证的API
echo "=== 4. 认证API测试 ==="
if [ -n "$token" ]; then
    test_api "获取用户Profile" "GET" "/api/users/profile" "" "Authorization: Bearer $token"
    
    # 测试无效token
    test_api "无效Token测试" "GET" "/api/users/profile" "" "Authorization: Bearer invalid_token"
    
    # 测试无token
    test_api "无Token测试" "GET" "/api/users/profile"
else
    echo -e "${RED}✗ 跳过认证测试（无有效token）${NC}"
fi

echo "=== API测试完成 ===" 