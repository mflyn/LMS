# 重复计划公开交付范围与证据说明

本轮用户授权提交专用分支、推送并创建 Draft PR；不授权合并、部署或更新真人测试入口。重复计划限定合成工程门禁已获批准关闭；真人/真机、自动 timer 多周期非阻断补测和其他未关闭/后置事项保持原状。

## 候选和最新 main

- 已验收原基线：`3816c3f2a45daff8b66221cfffb322de11bdce33`。
- 已验收原累计补丁 SHA-256：`dd58f6480900ab1bec1679043e7441ebae5cfb732a98f5569a5332df0807756b`。
- 本次交付基线：`b2c5266393c1ef6a5dac788bbf28211c6171e225`，保留 PR #53 的界面修改。
- 原始范围为37个候选文件与48个历史归档文件。唯一与更新后的 main 交叠的源码为 `frontend/web/src/App.js`：同时保留最新 `growth-theme.css` 导入和新增重复计划路由。其他获批非文档源码/测试保持原字节。

## 公开脱敏副本

原工作区、原冻结补丁和原证据另行保留，未改写。公开副本将一条本机绝对依赖目录替换为 `<EXISTING_DEPENDENCIES>`；该文字出现于当前测试方案及五份历史补丁。没有删除失败、变异、旧待审状态或更改业务代码。

历史 README、candidate-files.json 和 archive-files.json 中的哈希仍指向当时的原件，不声称等于脱敏后的补丁字节。公开仓库中的这些 candidate.patch 是脱敏衍生件，不能以原件哈希校验；请使用本目录 `published-files.json` 的 `publishedSha256` 校验公开文件，`originalSha256` 仅绑定本地保留原件。该映射另标记最新 main 整合及本次交付说明变更，不伪造原冻结候选。

## 验证边界

既有完整家庭回归为原候选8项目、215套件6502项通过；此前专项、独立复验和浏览器证据各自分批，不能相加成一次全仓通过。最新 main 整合后的本轮本地验证另见 `verification.json`，GitHub CI 另以实际推送 SHA 及运行记录为准。

保留历史失败、`MANUAL_PENDING`、`DEVICE_PENDING`、T4/T8/AI-1 OPEN、`SERVER_TIMING_UNVERIFIED`、Docker `INCOMPLETE_FAILED`、登录限流暂搁置及 WP1/T8 等后置范围。默认关闭配置不变；本次不新增安装、模型调用、服务器操作或真实验收结论。
