# T7 空卷重复挂载与私有目录权限修订

日期：2026-10-28。用户授权按最小方案处理 R3 的 resource 存储预检失败：先定点复现，
确认根因后修复、补永久反例、自查，再冻结候选重跑14–17。不修改真实数据或现有服务。
本记录为开发验证，`SELF_REVIEW_PASSED / INDEPENDENT_REVIEW_PENDING`，不自动关闭T7。

## 直接复现证据

在新项目 `family-growth-isolated-t7-05fbfa9f` 中，按R3固定378文件源码、原Dockerfile重新
受限构建resource镜像。不启动Mongo或业务服务；使用新空卷、network=none、0.5 CPU/256 MiB、
memory-swap=memory，依次运行三个独立容器，执行原 `assertCompletionStorageReadiness`。

| 容器 | 检查前 media / journal | 检查后 | 原预检结果 |
| --- | --- | --- | --- |
| A，初始化 | 0755 / 0755，uid=0 | chmod后0700 / 0700，探针清理后均为空 | PASS |
| B，重新挂载同卷 | **0755 / 0700**，uid=0 | 不再修改目录，保持原状 | COMPLETION_STORAGE_NOT_READY |
| C，再次重建 | **0755 / 0700**，uid=0 | 不再修改目录，保持原状 | COMPLETION_STORAGE_NOT_READY |

证据包含每次挂载的完整祖先链mode/uid/gid、运行uid、目录内容、fs调用序列、镜像ID和退出码。
因此本次不再只是猜测：媒体空卷在新容器挂载时继承镜像目录0755，破坏了A中设置的0700；
日志卷没有同样变化。生产拒绝正确，失败不是内存不足、Mongo索引、storageConfirmed遗漏或回收未实现。
旧Dockerfile只创建媒体路径，没有显式0700，也没有建立日志路径，形成镜像和预检契约缺口。

## 最小修订和永久保护

只修改resource Dockerfile的构建期目录准备：显式创建媒体和日志两个目录并各设0700。
不修改Compose挂载、UID、生产预检、默认开关、业务代码或fsync；不添加运行时递归chmod/chown。
所有动作发生在镜像构建层，不调整已有真实卷；不声称能自动迁移既有错误权限目录。

使用同一运行源码和修订Dockerfile构建独立fixed镜像，在另一组新空卷中运行三个独立容器：
首次挂载、重新挂载、再次重建的两个根目录检查前后均为0700且属主正确，原预检均通过，
探针后仍为空。未使用volume-nocopy、占位文件或合并容器来规避空卷重新初始化。

复用现有测试，不新增框架：

- `completionCompose.test.js`提取真实Dockerfile目录准备RUN命令，在临时目录实际执行并
  校验两个根目录的类型/0700/属主。旧Dockerfile红灯明确报媒体目录不安全。
- 两项永久变异用例分别移除媒体、日志chmod，必须被同一检查拒绝；显式umask022保证
  负向场景不依赖开发机/CI的默认umask。旧断言保留，未降低门槛。
- `completionStorageReadiness.test.js`新增两个根目录的异属主拒绝反例，验证任何探针open前拒绝、
  目录无新增文件、真实权限不被自动改写；既有错误权限/祖先链/符号链接/fsync失败等待用例保留。

最终两套相关测试130项通过；activation readiness、release isolation和原smoke测试49项通过。
`npm run lint`、`git diff --check`通过。第一次红灯使用名称过滤定向运行，不能将其64项未选择
用例误写为全套通过；之后130项完整相关回归没有跳过用例。

## 自查、候选与收尾

自查核对：family/Ubuntu Compose均使用这份Dockerfile；修订在VOLUME之前准备目录；
没有业务/权限规则变更；两个chmod的逐处移除均被测试保护。自查补上测试umask确定性，
保留调整前补丁和哈希；运行源码没有因此改变。独立复评待进行。

修复范围为Dockerfile和两份现有测试。新R4运行候选378文件相对R3仅Dockerfile不同，
新冻结补丁和哈希在 `release-gate-artifacts/t7-docker-isolation-r4-2026-10-28/`；R4实际
结果另见对应记录，不能由定点探针通过推断完整14–17通过。

定点复现的全部容器和四个新卷已收尾，随后仅移除自己的两个镜像tag、新下载基础镜像tag和
唯一临时目录；远端证据复制后逐项SHA-256一致。原11容器选定元数据及卷/网络/镜像集合
与复现前一致。原始记录在 `release-gate-artifacts/t7-storage-compatibility-2026-10-28/`，
本目录 `evidence.json` 绑定测试、红绿探针、构建、工具、清理和候选补丁。

R1/R2/R3历史失败、T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED保留。
未提交、推送、合并或部署，未操作真实数据、原服务或宿主权限。
