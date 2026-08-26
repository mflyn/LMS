# DeepSeek 与 Embedding 配置

[返回总目录](00_总目录与实施路线.md)

> 本文的 Web 设置步骤用于家长/管理员独立验证 DeepTutor。正式 LMS 集成必须通过内部
> DeepTutor Adapter 发送最小化上下文，并把采用的输出保存回 LMS；不能让孩子直接使用
> DeepTutor 设置页，也不能把 DeepTutor 会话当成权威学习档案。

## 1. LLM 与 Embedding 的区别

DeepTutor 中需要区分两类模型：

### LLM

负责：

- 回答问题；
- 推理和解题；
- 生成练习；
- 总结教材；
- 生成学习计划；
- K12 知识抽取。

本方案使用 DeepSeek。

### Embedding

负责：

- 把教材文本转换成向量；
- 把学生问题转换成向量；
- 从知识库中找出语义相近内容；
- 支撑 RAG 检索。

Embedding 不负责直接回答问题。DeepSeek 对话模型也不能直接代替 embedding 模型。

## 2. DeepSeek 配置

打开 DeepTutor：

```text
Settings → Models
```

添加 DeepSeek 或 OpenAI-compatible 配置。

建议值：

| 参数 | 建议 |
|---|---|
| Provider | DeepSeek；没有时用 OpenAI-compatible |
| Base URL | `https://api.deepseek.com` |
| Model | `deepseek-v4-flash` |
| API Key | DeepSeek 控制台创建 |
| Temperature | 0.1～0.3 |
| Reasoning effort | 默认；日常可用 minimal |

复杂任务可增加：

```text
deepseek-v4-pro
```

截至 2026-08-25，DeepSeek 官方 `/models` 与 API 文档列出的 Chat Completions 模型为：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

旧名称已经超过官方公告的停用日期，不应继续作为长期配置：

- `deepseek-chat`
- `deepseek-reasoner`

官方资料：

- https://api-docs.deepseek.com/quick_start/pricing-details-usd/
- https://api-docs.deepseek.com/updates/

## 3. 模型分工

| 任务 | 推荐模型 |
|---|---|
| 普通教材问答 | `deepseek-v4-flash` |
| 章节总结 | `deepseek-v4-flash` |
| 练习题生成 | `deepseek-v4-flash` |
| 普通数学解题 | 先用 Flash |
| 多步复杂推理 | `deepseek-v4-pro` |
| K12 批量抽取 | 先用 Flash，抽样检查 |
| 质量敏感的最终复核 | Pro 或人工复核 |

这样能控制成本和延迟。

## 4. DeepTutor 中的模型配置原则

1. 先只配置一个 Flash 模型；
2. 测试普通对话；
3. 再增加 Pro；
4. 不要一开始添加大量模型；
5. 每个模型配置写清用途；
6. 独立验证阶段 API Key 只保存在 DeepTutor 设置中；LMS 集成阶段由内部适配器使用独立 Key 或受控配置；
7. 不把 Key 写入 Git、Markdown 或截图；
8. 不把 Key 直接写入 `compose.yaml`。

建议命名：

```text
DeepSeek Flash - 日常教学
DeepSeek Pro - 复杂推理
```

每次部署或升级都应调用服务商 `GET /models` 或查看官方模型页，确认模型仍可用。模型名、
价格和兼容性会变化；文档日期只能表示本次核对结果，不能代替上线当天的验证。

## 5. Embedding 服务选择

DeepTutor 支持多种 embedding 提供商，例如：

- OpenAI；
- Azure OpenAI；
- Cohere；
- Jina；
- Ollama；
- vLLM/LM Studio；
- SiliconFlow；
- 阿里云；
- Gemini；
- Custom。

X230i 推荐云端：

1. SiliconFlow；
2. 阿里云 DashScope；
3. Jina；
4. 其他已有账户的兼容服务。

不推荐当前机器本地运行大型 embedding，因为会占用额外内存、磁盘和 CPU。

## 6. SiliconFlow 示例

DeepTutor 设置中可填写：

| 参数 | 示例 |
|---|---|
| Binding | `siliconflow` |
| Endpoint | `https://api.siliconflow.cn/v1/embeddings` |
| API Key | SiliconFlow Key |
| Model | 从服务商当前列表选择中文 embedding |
| Dimension | 初次留空，允许自动识别 |

重要：

> DeepTutor 当前的 embedding host 是完整 endpoint，不是普通 API base URL。

因此应包含：

```text
/v1/embeddings
```

而不是只填写：

```text
https://api.siliconflow.cn
```

DeepTutor 配置示例：

https://github.com/HKUDS/DeepTutor/blob/main/.env.example

## 7. Embedding 模型选择标准

优先考虑：

- 中文语义检索能力；
- 数学和科学术语能力；
- 长文本支持；
- API 稳定性；
- 可控的调用价格；
- 明确的向量维度；
- 服务商在国内网络的可访问性。

不要只看模型参数规模。对家庭知识库而言，稳定、便宜、中文效果好比模型最大更重要。

## 8. 第一次知识库测试

准备一个小型 Markdown：

```markdown
# 勾股定理

直角三角形两条直角边的平方和等于斜边的平方。

公式：

a² + b² = c²

前置知识：

- 平方
- 平方根
- 直角三角形
```

然后：

1. 在 DeepTutor 新建测试知识库；
2. 上传该文件；
3. 建立索引；
4. 观察 embedding 连接测试；
5. 提问“勾股定理需要哪些前置知识”；
6. 确认回答引用了上传内容；
7. 重启容器并再次查询。

## 9. Embedding 一致性

建立完整 K12 知识库前，记录：

```text
provider
endpoint
model
dimension
DeepTutor version
index creation date
```

如果以后改变以下任一项，应重新索引：

- embedding 模型；
- 向量维度；
- provider；
- endpoint 返回格式；
- DeepTutor 的索引实现；
- 文档分块方式。

原始 Markdown 知识卡片应始终保留，因此即使索引损坏也能重新生成。

## 10. 成本控制

### LLM

- 日常优先 Flash；
- 设置合理的上下文长度；
- 不向模型发送整个知识库；
- 先检索再发送少量证据；
- 批量抽取只运行一个并发；
- 对重复数据建立缓存。
- 在 LMS 中按家庭设置每日/每月预算、单次最大输出和练习题量；
- 每个 generation job 记录 token、模型、延迟和估算成本，但日志不得包含孩子原始内容；
- 超出预算时转为家长手工流程，不自动切换到更昂贵模型。

### Embedding

- 先去重，再索引；
- 不把每条关系重复写入多个大文件；
- 按章节生成结构化知识卡片；
- 文档变化时尽量增量更新；
- 不反复切换模型。

## 11. 隐私与数据出境

使用云端 LLM 和 embedding 时，以下内容可能发送到服务商：

- 用户问题；
- 检索出的教材片段；
- 知识卡片文本；
- 为生成向量而提交的文档块；
- 学习历史中的部分上下文。

建议：

- 不上传真实姓名、手机号、学校、班级等信息；
- 不上传原始 Apple Pencil 手写图、签名媒体 URL 或完整成绩单；
- 由家长在 LMS 中确认错因后，只发送必要的题干摘要和去身份化历史；
- 不把账号密码写进资料；
- 不上传未经授权的完整教材 PDF；
- 阅读所选 API 服务商的数据保留政策；
- 敏感资料使用独立知识库。

正式集成的最小披露清单见
[LMS、DeepTutor 与 K12 集成设计](05_DeepTutor与K12集成设计.md#6-deeptutor-输入边界)。
Embedding 只处理课程卡片和合法教材片段；第一阶段不对孩子原始作业、手写图片或完整
学习记录建立云端向量。

## 12. 连接失败排查

### 12.1 DeepSeek

检查：

```text
Base URL 是否为 https://api.deepseek.com
模型名是否为 deepseek-v4-flash 或 deepseek-v4-pro
API Key 是否有效
账户余额是否足够
服务器 DNS 和 HTTPS 是否正常
```

主机网络测试：

```bash
curl -I https://api.deepseek.com
```

### 12.2 Embedding

检查：

- endpoint 是否完整；
- 模型是否在当前账户可用；
- Key 是否有 embedding 权限；
- dimension 是否错误；
- 是否错误发送了服务端不支持的 `dimensions` 参数；
- DeepTutor 是否需要重新测试连接；
- 旧索引是否与新模型冲突。

### 12.3 容器网络

```bash
docker compose exec deeptutor sh
```

进入后可检查 DNS，但不要在容器内永久修改配置；容器重建后这些修改会丢失。

## 13. 验收标准

- [ ] DeepSeek Flash 测试成功；
- [ ] DeepSeek Pro 可选测试成功；
- [ ] 普通对话可以返回中文；
- [ ] embedding 测试成功；
- [ ] 小型 Markdown 索引成功；
- [ ] 查询能召回对应文本；
- [ ] 重启后模型配置仍在；
- [ ] 重启后知识库仍在；
- [ ] 已记录 embedding 模型和维度；
- [ ] API Key 未进入 Git 和普通备份日志。
- [ ] 独立验证只使用虚构学生数据；
- [ ] 正式集成没有发送真实姓名、学校、原始手写图片和完整学习历史；
- [ ] LMS 已设置调用预算、超时、题量上限和失败降级；
- [ ] 所采用的教学制品记录模型、prompt、schema 和结果哈希。
