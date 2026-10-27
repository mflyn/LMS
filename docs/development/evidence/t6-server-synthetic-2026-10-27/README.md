# T6 独立服务器合成验证收口

**验证结论：** PASS_T6_SERVER_SYNTHETIC_REGRESSION。
**工程门禁：** 保持已批准的 CLOSED / ENGINEERING_SYNTHETIC_ONLY，不新增验收批准。
**本次记录操作：** LOCAL_DOCUMENTATION_ONLY / NO_COMMIT / NO_PUSH / NO_PR_WRITE / NO_MERGE / NO_DEPLOY。

## 身份与证据归属

独立测试线程在 2026-10-27 实测，受测提交为 `a3aa01cf2f2fee99df654592b07f37b901ad2c46`，
分支 `codex/t6-engineering-delivery`，PR #34 未合并。独立源码 1791 文件，sourceDigest 为
`ad6df574fee80ca6a239cc1bc26cdd4b45b798eb77cf8ce96d32519404e07518`。
与前轮独立复评候选的 14 项差异只涉及文档/批准及对应门禁，业务实现和业务测试不变。

本开发线程只读复核全部 367 项封存证据的字节数及 SHA-256，并用 Git 对象核验 1791 个候选文件，
直接读取各 Jest/Playwright 结果验证下表计数和零重试。没有重新连接服务器或重跑产品测试。
来源、选定证据哈希及本次复核结果见 [证据索引](verification.json)。封存目录只读，不复制或改写原始日志。
本轮结果与开发自测、GitHub CI 分列，不能用任意一方替代另一方。

## 独立实测结果

| 验证 | 实际结果 | 归属/限制 |
| --- | --- | --- |
| T6 来源及生产装配专项 | 4 suites / 194 passed | 与完整后端重叠，不重复相加 |
| 完整家庭后端 | 152 suites / 4455 passed | 原预算不变 |
| 完整前端 | 52 suites / 678 passed | 既定 legacy 排除不变 |
| 正式 T2–T6 HTTP | 5 suites / 27 passed | 真实七服务，非 API mock |
| 独立恢复/拒绝/竞争组件探针 | 2 suites / 8 passed | 不计入标准前端 678 项 |
| Chromium / WebKit 完整 T2–T6 | 各 48 passed，0 failed/skipped/retries | 原 44 项无缺失 + T6 4 项；Mac 引擎 |
| 两引擎前后健康检查 | 4/4 | 原零错误/零警告断言保留 |
| 真实服务 403 浏览器探针 | 2/2 | 故意故障 console 保留，不冒称零 console 健康 |
| 文档、lint、Linux build | 通过，退出码 0 | 独立环境结果 |
| 四份 Compose 静态配置 | 工具发现问题纠正后 4/4 | 首轮四项 exit125 保留；没有部署 |

原 D2B 大图负例在完整后端中 passed，Jest duration 108467ms（含 hooks）。原测试 120000ms、查询
5000ms 上限未变，不据此推算精确预算余量，不宣称性能稳定性认证。专项、全量及检查点不能累加成独立总用例数。

## 闭环及保护

真实服务验证作品 → 错题（重新上传正确 purpose 的媒体）→ 订正任务 → 孩子完成 → 家长按所见版本审核
→ 孩子回看 → 可控日期提醒/人工复习；不自动掌握，不改变原任务或重复奖励。
无 resourceId 未知创建在真实 201 提交后丢响应，数据库仍一条、已绑定媒体保留。关闭、读失败、刷新、
同标签退出返回均保留保护，兄弟姐妹隔离；真实 GET 成功后仍须人工核对，空列表不自动解锁或重发 POST。

403 探针仅首列表 503 注入；随后只在临时合成库移除孩子成员关系，由真实服务拒绝 GET。
两引擎均清除私有行/人工解锁入口、保留未知标记，POST=1、DELETE=0、业务及媒体不变、pageerror=0。
预期 503/丢响应/403 console 原样保留；迟到响应、旧行草稿和未知 PATCH 锁另有永久反例及独立探针保护。

## 环境与收尾

Ubuntu 宿主运行固定官方 Node 22.23.4 Debian 12 镜像、Mongo 7.0.14 临时副本集，非 root，
2 CPU / 3 GiB，容器 cgroup swap0，产品源码只读、cache/log/tmp 独立。宿主有 swap，不称整机无 swap。
Mac Chromium/WebKit 经 SSH 同端口回环访问 Ubuntu 临时服务，不是 Linux 浏览器或真实 iPad。
完成协议 enabled，真实权限、凭据、索引、预检及上传保护保留；新回收/高级恢复未启用。

13 阶段前/中/后串行快照 PASS，不等于全时段 Docker 事件审计。原 10 服务 ID、StartedAt、镜像、
挂载、配置哈希和 HTTP200 未变；本轮容器为 0。浏览器/broker/租约/正逆向转发/私有配置已退出，
SSH 关闭，源码首尾一致；没有访问真实家庭数据、原 27017、NAS，或执行真实 cleanup/restore。
这是对封存收尾证据的复核，不是本开发线程重新连接后的现场观察。

## 原失败分类

| 记录 | 原失败及纠正 | 当前解释 |
| --- | --- | --- |
| QA-T6-TOOL-COMPOSE-001 | 隔离 HOME 隐藏用户 Compose 插件，四项 exit125；仅复制可执行文件到本轮 tools 后通过 | QA 工具发现问题，非产品缺陷；原失败保留 |
| QA-T6-TOOL-EXPORT-002 | name:undefined 与 JSON 省略字段比较误报；原脚本和失败保留 | 统一 JSON 表示后仍拒绝路径/rw/卷名变更，无产品重跑 |
| QA-T6-TOOL-CLOSE-003 | SSH exit 本身为 0，即时 socket 观察早于异步 unlink 而记 FAIL | 后续独立观察 socket 消失、driver 退出；无二次连接或产品重跑 |

319 份归档输入、120 份 JSON 结果指标脱敏一致由原 archive-quality 绑定；历史独立 68+112 份和
原准备 10 份保留。既有产品失败、本轮 QA 工具失败及 Docker INCOMPLETE_FAILED 不被新成功覆盖。
服务器导出清单明确 `excludesSelf: true`：287 份内容加清单自身共 288 份，原始下载文件的哈希全部匹配。
本地复核曾误将含清单的数量与 287 比较而失败；按原导出契约分别校验内容及清单后通过，未修改原证据或产品断言。

## 待验收及后置

M01–M08 全部保留 MANUAL_PENDING / DEVICE_PENDING：真实 iPad Safari、系统相机/文件选择器、
后台/锁屏/回收、真实网络切换、共享设备隐私、低龄理解、触控/软键盘/辅助功能、真实延迟复习学习效果。
D01–D04 保留 DEFERRED_UNCHANGED：T7 综合验收；T8 常驻部署/备份恢复/回滚；T9 长期价值及既有责任；
高级恢复/新回收。T5-NB-001/002 OPEN_NONBLOCKING、Docker INCOMPLETE_FAILED、T4 状态不变。
高级恢复/新回收继续 REMAINDER_DEFERRED 且运行关闭；本次不启动 T7/T8/T9，不新增公开交付或部署授权。

## 文档自查与复核

方案自查：只新增此独立记录/索引和当前文档入口，不修改冻结历史、业务设计或用户指南；不全局替换旧“未执行服务器”。
实施后以原证据重新核验身份、计数、失败分类和收尾，并执行既有文档门禁、250 项状态反例、链接及 diff 检查。
本节属于开发线程记录自查与复核，不冒称新的独立产品评审或用户批准；本次实际检查结果见交付消息。
