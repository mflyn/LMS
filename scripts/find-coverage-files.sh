#!/bin/bash

# 查找所有测试覆盖率相关的文件
# 此脚本会列出项目中所有的覆盖率相关文件，帮助您确定哪些文件需要从 Git 中删除

echo "查找项目中的测试覆盖率文件..."

# 查找覆盖率报告目录
echo "覆盖率报告目录:"
find . -type d -name "coverage" -not -path "*/node_modules/*" | sort
find . -type d -name "__coverage__" -not -path "*/node_modules/*" | sort
find . -type d -name ".coverage" -not -path "*/node_modules/*" | sort
find . -type d -name "reports" -not -path "*/node_modules/*" | sort
find . -type d -name "junit" -not -path "*/node_modules/*" | sort
find . -type d -name ".nyc_output" -not -path "*/node_modules/*" | sort

# 查找覆盖率报告文件
echo -e "\n覆盖率报告文件:"
find . -name "*.lcov" -not -path "*/node_modules/*" | sort
find . -name "clover.xml" -not -path "*/node_modules/*" | sort
find . -name "coverage-final.json" -not -path "*/node_modules/*" | sort
find . -name "coverage-summary.json" -not -path "*/node_modules/*" | sort
find . -name "jest-junit.xml" -not -path "*/node_modules/*" | sort
find . -name "jest-*.json" -not -path "*/node_modules/*" | sort

# 查找 Jest 缓存
echo -e "\nJest 缓存文件:"
find . -type d -name ".jest-cache" -not -path "*/node_modules/*" | sort
find . -name ".jest-*" -not -path "*/node_modules/*" | sort

echo -e "\n查找完成。如果您想从 Git 中删除这些文件，请运行:"
echo "npm run remove:coverage-git"
