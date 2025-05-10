#!/bin/bash

# 清理测试覆盖率文件脚本
# 在提交代码前运行此脚本可以清理所有测试覆盖率相关的临时文件

echo "开始清理测试覆盖率文件..."

# 删除覆盖率报告目录
find . -type d -name "coverage" -exec rm -rf {} +
find . -type d -name "__coverage__" -exec rm -rf {} +
find . -type d -name ".coverage" -exec rm -rf {} +
find . -type d -name "reports" -exec rm -rf {} +
find . -type d -name "junit" -exec rm -rf {} +
find . -type d -name ".nyc_output" -exec rm -rf {} +

# 删除覆盖率报告文件
find . -name "*.lcov" -delete
find . -name "clover.xml" -delete
find . -name "coverage-final.json" -delete
find . -name "coverage-summary.json" -delete
find . -name "jest-junit.xml" -delete
find . -name "jest-*.json" -delete

# 删除Jest缓存
find . -type d -name ".jest-cache" -exec rm -rf {} +
find . -name ".jest-*" -delete

echo "清理完成！"
