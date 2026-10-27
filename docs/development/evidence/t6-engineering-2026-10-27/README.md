# T6 合成工程验证记录

工程状态：READY_FOR_REVIEW；任务状态 IN_PROGRESS；T6 总门禁 OPEN。本记录不是用户关闭批准，也不授权 Git 或真实部署。
起点：`62cedfa35dc581c494179f7edda82aba0754b94e`；所有新增业务数据、媒体、账号均为本机合成样本。

## 当前证据

| 验证 | 结果 | 边界 |
| --- | --- | --- |
| 共同来源 reader 作者反例 | 14 failed / 20 passed，修复后 34 passed；补 fallback 后 1 failed / 35 passed，再 36 passed | 输入类型、依赖错误分类、文本兼容及 HTTP 4096 字节上限 |
| Nash 独立 reader 复验 | 36/36 passed，Node 22.15.0 | 非作者运行，静态复评无新发现 |
| analytics attachments / family | 60/60、13/13 passed | 作者自测，独立静态评审另记 |
| homework 受影响七套件 | 378/378 passed | 主线程自测，来源、正式装配、材料恢复与原任务 |
| Nash 两项组合补测 | 125/125 passed | 两个文件；两次内存变异均触发预期断言失败，未改共享生产文件 |
| 正式 HTTP 全部五套件 | 26/26 passed | 主线程，T2–T6，真实 Gateway 与业务服务，临时 Mongo 副本集 |
| 家庭后端全量首轮 | 3 failed / 149 passed suites；5 failed / 4380 passed tests | 历史失败保留，不能写为全绿 |
| 家庭后端修订全量 | 152 suites / 4388 tests passed，856.747 秒 | 同一八项目范围；首轮失败不被覆盖 |
| 最终前端全量/构建 | 52 suites / 667 tests passed；build 成功 | 含最后孩子草稿 P2；既有 legacy 排除不变 |
| 最终构建正式浏览器 | Chromium 47/47 passed，4.1 分钟 | T2–T6，真实七服务；非真机、非 WebKit |
| 原 Task11 回归 | HTTP 6/6；Chromium 4/4 passed | 含 PIN 失效与移动宽度，最终修订源码 |
| 孩子草稿 P2 独立复验 | 43/43 passed | 非作者；原反例 3 failed/20 passed 已核实 |
| 状态门禁修订定向 | 184/184 passed | 含 T6 不得提前关闭、不得擅自 Git 授权反例 |
| legacy 装配修订定向 | 2/2 passed | 精确允许只读 sourceReader，所有完成协议冷加载排除断言仍保留 |
| Compose 静态配置 | family / ubuntu / root / china config --quiet passed | 合成环境变量，仅解析，不启动或部署 |

候选文件哈希和原始证据索引见 [validation.json](./validation.json)，实现补丁见 [candidate.patch](./candidate.patch)。
补丁排除本证据目录以避免自引用；源代码、API、计划、门禁、用户指南均纳入候选。
原始开发日志和独立复验记录按原字节归档至仓库忽略目录
`release-gate-artifacts/t6-engineering-2026-10-27/`，哈希见 validation。
`/tmp/lms-t6-engineering-20261027/` 等原路径也保留；原始日志不作为可提交的公开材料。

## 首轮失败与修订

1. 来源模块未实现导致加载失败（0 项运行）、用户名/签名测试夹具错误：仅作开发过程记录，不冒称业务反例。
2. homework 新套件先使用 standalone Mongo，正式事务被拒绝；按现有 setup 纳入副本集，不移除事务校验。
3. 统一 404 比较误包括每请求随机 requestId：保留 requestId 类型断言，并精确比较固定业务响应。
4. 合成 PDF 默认对象流被既有安全校验拒绝：改用现有允许的 `useObjectStreams:false` 夹具，不修改解析器。
5. 全量首轮文档反例仍绑定 T6 NOT_STARTED；依据已批准启动状态改为 T6 IN_PROGRESS / gate OPEN，并增加提前关闭与擅自 Git 授权拒绝测试。
6. 全量首轮 PATH 误选不兼容 `/usr/local/bin/git`，临时仓库测试报 `Unknown system error -86`；恢复系统正常 PATH。Jest JSON 因该原生错误循环对象序列化失败，完整文本日志仍保留。
7. legacy 注入白名单未包含新增只读 sourceReader：精确更新名单并断言 reader 仅有 require/describe 函数，原完成协议排除清单未减项。
8. 前端初始功能 12 红灯、导航 6 红灯、来源拒绝迟到列表 1 红灯、中间求助恢复 2 红灯保留；没有删除原断言。
9. 首两轮浏览器分别缺少必填截止日期、反馈 region/textbox 同名定位；补齐真实操作和精确 textbox 后通过。
10. 独立复评发现读取详情重置其他行草稿和未知写入锁；永久用例原代码 3 failed/20 passed，最终 667 passed。

## 自查与独立评审

- Hilbert 设计评审：补充未知媒体结果保留、同角色切换隔离、subject 缺省和来源服务故障语义；属于现有批准契约内的实现边界。
- Hilbert 共同库评审发现两项 P2，作者修复后由 Nash 独立复评及 36 项运行确认，VERIFIED_FIXED。
- Nash 后端静态评审未发现新实现缺陷，提出两项组合测试缺口；已补远端详情 404/503、原材料 pending 恢复及零写拒绝，并验证内存变异有效。
- 页面独立评审及 P2 复验已完成，详见 [review.md](./review.md)。作者自测、非作者运行及主线程正式验收分别记录。

## 实际命令

使用 Node 22.15.0；后端/Playwright 的 NODE_PATH 指向既有安装依赖，前端使用其既有依赖安装。
未执行 npm install、真实数据迁移、Docker 启动、部署或 Git 写入。

```sh
/usr/local/bin/node node_modules/jest/bin/jest.js --config=backend/jest.config.js --coverage=false --selectProjects family-common user-service homework-service progress-service resource-family analytics-family analytics-attachments notification-family --runInBand
/usr/local/bin/node node_modules/jest/bin/jest.js --config=backend/tests/t2/jest.config.js --runInBand
/usr/local/bin/node node_modules/jest/bin/jest.js --config=backend/tests/task11/jest.config.js --runInBand
# frontend/web, CI=true
/usr/local/bin/node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand --testPathIgnorePatterns=src/__tests__/legacy
/usr/local/bin/node node_modules/react-scripts/scripts/build.js
# repository root, T2_WEB_BUILD points to frontend/web/build
/usr/local/bin/node node_modules/@playwright/test/cli.js test --config=playwright.t2.config.js
/usr/local/bin/node node_modules/@playwright/test/cli.js test --project=chromium
/usr/local/bin/node scripts/check-family-docs.js
git diff --check
```

家长/孩子组件 API 使用 mock；正式 HTTP/浏览器运行真实 Gateway、user、homework、resource、progress、analytics、notification，
使用共享临时 Mongo 副本集和临时媒体。来源访问、权限、上传和奖励走真实服务；丢响应由合成代理注入。
完整含 Docker 的 release:family 脚本未执行，远程 CI 未运行；这里只确认脚本纳入新增入口。

真机简表：iPad Safari 登录和切换孩子；相册/相机选图；错题及来源长标题触控；返回/刷新后查看；
原未知命令恢复；任务审核后回看。均保持 DEVICE_PENDING，不以 820/390 像素浏览器截图代替。

## 保留边界

DEVICE_PENDING；历史失败 PRESERVED；Docker 审计 INCOMPLETE_FAILED；T5-NB-001/002 OPEN_NONBLOCKING。
高级恢复、新孤儿回收保持 REMAINDER_DEFERRED。T4 人工验收和总门禁状态不变，T7 综合验收、T8 真实部署、T9 家庭价值验证不提前完成。
不访问真实孩子数据、家庭 Ubuntu 或 NAS，不提交、推送、合并或部署；T6 工程完成后仍须用户批准才关闭总门禁。
