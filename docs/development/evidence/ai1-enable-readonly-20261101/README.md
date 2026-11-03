# AI-1 真实启用前置只读核验

状态：READ_ONLY_REVIEWED / QUALIFIED_COUNTER_PENDING；B/D/AI-1 OPEN。
2026-11-02获准步骤1后的正式版资料核对与未发送询问草稿见[步骤1结果](step1-20261102.md)；下文保留2026-11-01原观察。
本轮只访问公开官方文档及下载官方tokenizer数据包做静态检查，不调用模型、不读密钥、
不运行包内Python、不安装依赖、不改运行配置或业务实现。当前工程候选仍为§29.22冻结包。

## 官方来源与观察

核验日期2026-11-01；价格只代表访问时页面，不是未来价格保证或启用授权。

1. [官方人民币价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)：
   `deepseek-v4-pro`对应`DeepSeek-V4-Pro-0813`；无缓存输入/输出高峰9/27元每百万tokens，
   空闲4.5/13.5元。按较高价格而非缓存折扣计算；官方保留修改价格的权利。
2. [Chat Completions契约](https://api-docs.deepseek.com/api/create-chat-completion/)：
   显式`thinking.type=disabled`可关闭思考，`max_tokens=4096`处于允许范围；无tools时默认无工具调用。
   当前受限SDK参数与这些条款兼容，不等同输入计数资格或真实调用验收。
3. [官方Token说明](https://api-docs.deepseek.com/quick_start/token_usage/)：
   字符比例只是近似，实际usage由模型返回；页面离线包链接解析为
   [deepseek_v4_tokenizer.zip](https://cdn.deepseek.com/api-docs/deepseek_v4_tokenizer.zip)。
4. [V4模型说明](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro)及
   [消息编码说明](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/0e1a0e5e52aea73055f50fef6f2423db370265b6/encoding/README.md)：
   公开模型不用Jinja模板，提供专用encoding脚本；非思考chat前缀包含关闭思考标记。
   [固定提交配置](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/0e1a0e5e52aea73055f50fef6f2423db370265b6/tokenizer_config.json)
   标注PreTrainedTokenizerFast及1048576长度。

ZIP通过HTTPS有界GET取得，最大16MiB、最长30秒；仅标准库读取中央目录及JSON，没有解压执行。
包SHA256：`e7310d1dafe0a86d8a5629fe78a7c763760f651db9b8682718a1781dcd6fe495`。
三个文件及hash见`inspection.json`。demo只做`encode("Hello!")`，不是完整messages计数。
ZIP配置标注LlamaTokenizerFast、model_max_length=16384，带Jinja模板且无`</think>`后缀；
tokenizer数据为BPE、128000词表及1283 added tokens、空normalizer sequence。

**推论边界：**两份公开配置存在差异，不据此声称某个文件错误、API计费错误或词表必然不同。
固定提交tokenizer.json的有界下载超时（curl28），未取得文件，不能作词表hash比对；
下载仍运行时一次本地读取报FileNotFound，属于准备顺序错误，不是模型/计数反例。
现有证据未证明ZIP模板、公开模型encoding和托管0813的完整计费消息封装一一对应。
因此不能直接将demo、字符经验比例或任意常数余量登记为qualified counter。
独立只读复核确认该判断，未发现足以关闭计数资格的现有证据；JSON字节与SDK发送一致，
不等同JSON就是服务端最终模型输入。类名/长度差异也不能单独证明词表不同。
归档前核对68项工程候选指纹全部一致；文档状态检查及diff检查通过，未重复业务测试。

## 费用算例与待完成条件

在输入上界8192、输出4096确实成立且9/27价格有效的前提下：
`8192*9 + 4096*27 = 184320`微元，即单次0.18432元；三个单次尝试为0.55296元。
这是条件算例，不是已执行费用、整轮预算授权或自动费用硬上限。AI-0的10元不转移。

最小剩余工作：确认托管模型对应的完整编码/计数依据（含system、角色、生成前缀及额外开销），
固定数据/实现hash与profile版本，给出覆盖允许输入的上界论证并做离线边界反例及独立复评。
不得通过少量usage样本一致就证明所有输入上界；真实模型测试另需预算授权。
资格未成立前保持默认关闭和缺counter启动拒绝。费用授权、家长内容/价值验收、DEVICE_PENDING仍待验。
历史全量失败、T4/T8 OPEN、T9 NOT_STARTED、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED均不变。不操作服务器、不提交推送合并部署。

## 最小补缺方案（待评审）

本方案不是已获实现授权或计数资格证明。工程候选已获限定合成验收，见Gate §29.24；真实启用仍阻断。
目标是证明现有固定纯文字请求的输入上界，不要求复刻整个DeepSeek服务，也不新增计数服务/通用框架。

### 推荐路径：官方对应关系加本地完整消息计数

1. 先用一次有界资料核对确定三项：托管0813对应的tokenizer/编码版本；非思考、无工具的system/user及assistant生成前缀完整封装；计费输入是否还有额外token及其确定上界。
   复用已归档ZIP和固定公开版本，只下载缺少的数据/编码文件，不下载权重、不运行远程代码、不安装未批准依赖。
   单次资料核对最多2小时，不重复失败下载。若公开资料不足，整理一次官方询问草稿交用户发送，不自行联系外部。
   官方询问只描述API模型/参数/消息角色，不含正文、账号、密钥或孩子数据；要确认适用版本和额外计费开销，不要求服务方保证未来永久不变。
2. 仅当对应关系证据成立后，复用现有`counter.upper_bound(wire)`扩展点实现离线counter：从实际规范请求还原允许的消息，按已确认封装编码，纳入所有特殊token与已证明额外开销。
   数据、编码实现hash和模型profile版本绑定；保留8192输入/4096输出、原消息预览/hash、单次claim和发送前复核，不改公开API、不悄悄截断输入。
   上界可以保守，但每一项余量必须有依据；不能直接把JSON字节数、字符比例或任意固定余量当模型输入token数。
3. 使用现有pytest/Provider测试离线验证：空/最大合法正文、中文/英文/数字/换行/emoji/组合字符、特殊token样式文本、完整system与角色开销、8192/8193边界、损坏文件/profile不匹配、SDK发送体改变。
   补移除system/生成前缀/额外开销及替换counter数据的针对性反例或变异；完整请求不能漏计。测试样本通过不替代上界依据。
   独立复核依据与实现后，才可认定QUALIFIED_COUNTER完成；不把离线通过当真实费用或模型内容验收。
4. 另行复核当前价格、预算隔离，提出使用合成输入的小批真实模型调用验收申请，另行取得费用与调用授权；未批准不配置真实密钥、不调用模型。
   少量usage比对只能作为后续运行检查，不能反向证明此前所有输入均有上界。

### 备选与停止条件

- 若官方存在适用的无生成计数接口，可评估其返回值是否覆盖计费输入及是否只是估计；当前未确认这样的适用接口，不假定兼容其他厂商接口。
  此路径增加外发、凭据及可能费用，不能在本轮只读授权内调用，也不作为首选。
- 若无法取得托管模型/封装的充分依据，保持QUALIFIED_COUNTER_PENDING和真实发送关闭。降低输入长度、增大预留或仅限制账号余额不能自动证明当前8192契约成立。
- 若用户希望改成平台总额度或其他费用封顶策略，属于另行评审的契约变更，不以其悄悄替换当前设计。

交付仅需既有profile的资格说明、一个counter实现及现有测试增量；依赖新增或关键契约变化先报批。
保留AI-0人工审核限制、历史失败、DEVICE_PENDING及所有未关闭/后置状态，不扩展其他AI业务。
