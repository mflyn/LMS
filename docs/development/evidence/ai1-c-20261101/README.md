# AI-1 C 批本地页面候选

状态：C_LOCAL_UI_REVIEW_PASSED / C_LOCAL_VERIFYING。仅本地页面与聚焦问题复评通过，C/B/AI-1总门禁仍OPEN。
本包从原基线重建完整A/B上下文加本次C增量；不覆盖[A/B之后的B原冻结包](../ai1-b-20261101/README.md)。
候选身份及文件哈希见[manifest](manifest.json)，可重建补丁见[candidate.patch](candidate.patch)，
命令、退出码、失败和独立证据哈希见[verification](verification.json)。源码哈希与记录相互核验，不包含node_modules或构建产物。

## 已验证范围

- 家长任务/错题双入口、纯文字脱敏确认、完整预览与费用确认、原命令重试、人工版本及审核回看。
- StrictMode可用；同会话焦点不丢稿；身份/孩子变化和403隔离；无效成功或错误响应保留原命令。
- 独立最终2套件49项通过；错误码类型及切孩子保护的两组独立变异准确失败。
- 标准前端59套件788项通过；后端AI-1定向4套件92项通过；CI构建通过。
- 三条Playwright用例使用实际构建页面，但所有API均为合成替身。双入口、刷新回看及丢响应原命令重试通过。
- 1280/768/390宽度无横向溢出；截图为合成数据，本机私有保留，不冒充真机。

## 证据边界

保留首次缺陷红灯、两次幸存变异、补强后的预期失败，以及误用裸CRA入口的旧学校测试失败和沙箱日志EPERM失败。
正常定向通过、前端配置范围完整回归、历史家庭后端全量161/2套件及4980/2用例失败分别记录，不写成全仓全绿。
原始日志含本机环境路径，仅本机保存；本包只归档日志名称、哈希、结果和范围。

B实际DeepTutor持久operation、正式生产工厂/Gateway装配、真实跨服务浏览器/HTTP及35项矩阵完整验收尚未完成。
没有模型调用、Git提交推送合并或部署。外部服务源码和修改授权、真实付费及人工价值验收分别待补齐。
AI-0人工审核限制保留；T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED保持。
