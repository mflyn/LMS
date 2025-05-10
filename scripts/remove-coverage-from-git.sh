#!/bin/bash

# 从 Git 仓库中删除已提交的测试覆盖率文件
# 此脚本会删除 Git 仓库中的覆盖率文件，但保留本地文件

echo "开始从 Git 仓库中删除测试覆盖率文件..."

# 删除覆盖率报告目录
git rm -r --cached coverage 2>/dev/null || true
git rm -r --cached __coverage__ 2>/dev/null || true
git rm -r --cached .coverage 2>/dev/null || true
git rm -r --cached reports 2>/dev/null || true
git rm -r --cached junit 2>/dev/null || true
git rm -r --cached .nyc_output 2>/dev/null || true

# 删除覆盖率报告文件
git rm --cached "*.lcov" 2>/dev/null || true
git rm --cached clover.xml 2>/dev/null || true
git rm --cached coverage-final.json 2>/dev/null || true
git rm --cached coverage-summary.json 2>/dev/null || true
git rm --cached jest-junit.xml 2>/dev/null || true
git rm --cached "jest-*.json" 2>/dev/null || true

# 删除 Jest 缓存
git rm -r --cached .jest-cache 2>/dev/null || true
git rm --cached ".jest-*" 2>/dev/null || true

echo "文件已从 Git 索引中删除。"
echo "请检查删除的文件列表，然后提交更改："
echo "git commit -m \"删除测试覆盖率中间文件\""
echo "git push origin <分支名>"
