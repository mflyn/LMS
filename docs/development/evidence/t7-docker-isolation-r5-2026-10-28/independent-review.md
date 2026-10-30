# R5 独立只读证据复评摘要

来源：独立QA代理Mill，agent `01a18272-8f83-7ed2-bf44-aec1fd7abcd2`，
2026-10-28 20:23:37 Asia/Shanghai返回的报告。本文件由主线程整理摘要，不冒称代理编辑或签署本文件。
代理仅本地只读解析、哈希重算和内存补丁重建，没有SSH、Git写入、服务器重跑或本地单测重跑。

结论：未发现R5阶段14–17阻断性问题，没有重现R4未执行smoke却判通过。分项证据通过复评，
不代表完整release01–18、Git clean、T4/T7总门禁或真实部署通过。

## 独立核对

- 冻结文件17/17、远端哈希59/59、运行源码379/379匹配。归档457条目无重复/越界；30份
  tracked补丁文件从基线内存重建匹配。运行源码无漂移，后续文档追加与旧快照分开。
- 8条构建、16条运行命令全部exit0且日志非空；镜像ID、iid及容器镜像一致。
  正式compose --wait --wait-timeout 240实际约55.197秒完成，8个常驻服务健康，init正常退出。
- smoke实际argv中的runner与冻结脚本一致；原源码摘要各处一致，以.cjs文件执行。
  网关恰好七个非health业务请求，开始/完成requestId匹配；顺序、五个201和两个200一致。
  原脚本检查200、image/png及非空响应后，输出实际91字节，不是空日志或mock后端。
- 九个Compose容器加smoke配额合计2 CPU/2944 MiB，memorySwap=memory；31个构建容器
  观察记录均为1.8 CPU/2816 MiB。164次预算采样未触发阈值。
- 原11容器全部已采集字段一致（仅mounts数组排序规范化），42卷、5网络、22镜像清单一致。
  13条收尾命令exit0，只针对本轮资源；唯一临时目录删除成功。

## 保留限制

远端59项哈希清单不包括后生成的cleanup-commands/result、服务器前后快照及目录删除记录；
独立QA已交叉核对并重算其哈希，主线程最终证据索引另行覆盖，不能说旧远端索引已覆盖它们。
未保存图片正文或正文哈希，91字节不是硬编码期望，也不能据此离线逐字节核验图片。
原资源不变限于已采集元数据/清单，没有读取原卷内容；配额不含共享daemon，预算是离散采样。
保留历史失败、T4/T7 OPEN、DEVICE_PENDING、两项非阻断补测和高级恢复/新回收后置范围。

## 独立重算指纹

| 文件（相对R5 raw目录） | SHA-256 |
| --- | --- |
| frozen-candidate.json | `a0688a597ae4ef2cadfa71f52a58573aea2648a199a2c5f3c0ff40e728257ec7` |
| source-manifest.json | `6e2e813c4d68d763c7f8d2688185efa649a128703b3f913131f265429acb2bec` |
| tools/runtime.py | `c9dafe9b127529db06139b5b2f05c20a7a9beb15fc01ce256acb582a24ea53e2` |
| remote/remote-evidence-hashes.json | `e13be07b6f89e107278e855fefe7f0a51440160b57dcb5aeae18ee6fb6c1dca6` |
| remote/cleanup-commands.json | `458cc3c3a2844637fa63566ed09ed734f4a1e315b50983b57e52fd584ba0e639` |
| remote/cleanup-result.json | `90a0906ef9252974ee7cd422a6ae01452369d09915dd41affaee5ea8baafe141` |
