# AI-1 DeepTutor 本地契约、编排与独立 HTTP

基线仍为 DeepTutor v1.7.1 `f7aed0744c36c5afef16a4261c31ebee1208cac2`；本包接续 remote-store 首批，不覆盖旧冻结记录。
当前候选已完成限定独立复评；`manifest.json`和`candidate.patch`绑定12个DeepTutor文件，
`verification.json`区分红灯、作者、独立与变异证据；不是B批或总门禁验收。

## 范围

真实部分：RFC8785 请求摘要、闭合 JSON、profile/预留上界/截止点检查、SQLite、单次 claim 编排、
FastAPI 独立窄 app、专用合成凭据及回环 uvicorn HTTP。Provider prepare/send 是显式替身，
尚不证明真实模型 token 上界、最终序列化和隐式重试控制；也未挂载 DeepTutor 正式 main。
API 路径只在独立 app 中验证，正式 `/internal/deeptutor` 挂载与上层认证组合仍待验证。

## 已执行与失败保留

契约、编排、HTTP 各先运行缺失实现反例，再实现。作者初期全选79项通过；随后补JS生成中文JCS向量和截止点反例。
自查发现 prepare 跨截止点会先claim后落unknown，永久反例先红，准备结束后重新采时修复。
独立首评确认取消任务仍留sending、纯BOM被错误保存为成功两项P2；作者新增反例出现5失败/54通过，
修订后作者全选87通过（1.14秒）、1项pytest配置warning；独立最终87通过（1.13秒）、1项warning，均退出0。
12文件运行前后hash一致。两项P2及prepare时钟缺口限定复评通过，不把旧67项独立结果说成当前87项。
独立另以Node22遍历Unicode码点核对trim空白集合，并用实际LMS buildRequest重建golden与fixture完整比较。
三项作者变异（移除取消落unknown、恢复Python strip、移除prepare后采时）均被永久反例拦截；不是独立变异证据。
并发替身用Event持有首次send，不以顺序完成的gather假装在途竞争；reject/claim用真实双线程。
回环HTTP在成功提交后丢失响应体，客户端实际RemoteProtocolError，GET/原PUT重放单一终态、Provider计数1。
query-only重建只读accepted、PUT拒绝且零发送。旧accepted备份覆盖后显式STORE_ISOLATED拒绝读写/发送，原记录不伪造。

全选命令：`python3 -m pytest --confcutdir=tests/services/ai1 tests/services/ai1 -q -p no:cacheprovider`。
该命令隔离纯模块与独立HTTP测试，不加载根应用夹具；根入口缺依赖的历史失败和pytest配置warning保持，
不写成完整DeepTutor回归通过。RFC8785只更新依赖声明并运行既有同步生成器，未安装任何依赖。

B/D/AI-1总门禁OPEN；实际Provider、正式装配、完整LMS跨服务联调及另行付费/人工验收尚待完成。
保留AI-0人工审核、历史全量失败、T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED。无模型、服务器、Git发布或部署。
