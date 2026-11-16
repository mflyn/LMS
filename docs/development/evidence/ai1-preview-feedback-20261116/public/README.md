# AI外发预览P2限定公开交付

## 范围与授权

本批为3份代码/测试、3份验收文档及本目录公开证据，基于 `9e97aa58d0dc98aaae0af14b18d586c733f87ef9`。
产品变更仅TutorPage读写错误隔离和创建中提示；不修改API、原命令协议、身份权限、费用配置或运行开关。
不包含WP1/T8执行器、依赖升级、部署配置或其他工作树增量。

用户已批准 `QA-AI1-PREVIEW-FEEDBACK-001` 限定本地验收及关闭，本轮进一步授权专用分支提交推送、Draft PR和CI检查。
历史“不提交推送”文字是对应批次当时的授权快照，不改写；本次不授权合并、真人入口更新、模型、服务器或部署。
回退方式为撤回未合并PR；若未来合并，另行评估revert本批。不清原命令或业务数据。

## 冻结原件与公开摘要

- [候选补丁](candidate.patch)保持原字节，SHA-256 `d1b5fa514de3844c7532fa191653a1471ec2ab358003bda73806b45fda5cbf8d`，用于重建验收前候选，不包含批准后的文档增量。
- [候选文件清单](candidate-files.json)保留5文件原哈希及原manifest摘要，仅不公开本机重建目录。3份JS仍与冻结哈希相同；当前2份候选内文档已追加/同步批准记录，不冒充原哈希。
- [原归档109文件索引](preserved-archive-files.json)保持原字节，只含相对文件名、大小和哈希。原始日志、截图、机器配置和绝对路径不推送；索引不等于公开原始日志。
- [验证摘要](validation-summary.json)来自已核对的原回执和本轮38项复验结果，保留每批源码哈希、退出码及原始日志摘要。不公开完整Jest结果中的机器路径或合成会话正文。
- [交付检查](delivery-verification.json)绑定最终交付文件、敏感信息检查、文档校验及补丁重建结果；不替代GitHub新SHA的CI。

暂存全范围`git diff --cached --check`在原字节候选补丁的246/251行报告两处空白上下文行（exit2）；
这是把统一diff作为新文本文件提交时的格式提示，不修剪冻结证据。其余交付文件单独检查exit0，
原补丁可重建全部5份候选文件且哈希一致。未修改Git规则、测试断言或CI配置来屏蔽结果。

## 结果边界

开发组件最终8套件163项通过；复审从冻结重建目录另跑2套件38项通过，未重跑浏览器。
Chromium相关19项通过对应最终新增导航调整前的测试快照；最终源码新增专项为Chromium/WebKit各2项通过。
WebKit相关4通过/15失败仍保留，不能用两项专项替代；Chromium此前18通过/1失败及原红灯不改写。
两处旧提示断言经复审确认改为精确读写分离语义，原命令、调用次数及服务端状态断言保留。
正式HTTP使用本地合成LMS服务和远端operation替身，无真实Provider；API替身页面结果另行标识。

仅本P2为CLOSED / USER_APPROVED / LOCAL_ONLY。原请求REAL_REQUEST_EVIDENCE_PENDING、
T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、
历史失败、非阻断补测及后置范围不变；自动化通过不等于真人或真机验收。
