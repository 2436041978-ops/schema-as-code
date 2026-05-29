# AI 黑盒接入指南：SDK 自动拉取

> 面向：AI 工程师、LLM 应用开发者、Agent 构建者  
> 定位：黑盒服务——无需理解底层 YAML 协议，通过 SDK 自动消费意图约束。

---

## 一、一分钟理解接入目标

你的 LLM 应用（ChatBot、Agent、RAG 系统）在生成内容时，需要遵守组织定义的语义边界：

- 告警场景下，不能用 `"严重"` 替代 `status.critical`
- 高危操作场景，必须建议人工确认，禁止直接给出可执行命令
- 金融场景，必须披露风险等级，不能省略免责声明

**传统方式**：你手动阅读设计规范文档，凭记忆在 Prompt 里写约束。  
**SDK 方式**：一行配置，自动拉取当前意图契约，在 LLM 调用前后自动注入约束与校验。

---

## 二、前置条件

| 条件 | 说明 |
|------|------|
| 控制平面已注册 | 组织已在 `intent-schema-compiler` 中定义语义令牌与意图契约 |
| 项目已绑定 | 你的 AI 项目已在 Registry 中注册（获得 `project_id`） |
| 网络可达 | 可访问组织内部的 Registry 服务或 CDN 地址 |

---

## 三、安装 SDK

### Node.js / TypeScript

```bash
npm install @intent-schema/sdk
```

### Python

```bash
pip install intent-schema-sdk
```

---

## 四、初始化配置

### 4.1 获取项目凭证

联系组织的 **Intent Steward** 或平台团队，获取：

- `project_id`: 你的 AI 项目在 Registry 中的绑定 ID
- `registry_endpoint`: 意图协议拉取地址（如 `https://schema-registry.your-org.com`）
- `api_key`: 只读权限的访问密钥

### 4.2 配置文件（推荐）

在项目根目录创建 `.intentrc.yaml`：

```yaml
project_id: "ai-assistant-prod"
registry_endpoint: "https://schema-registry.your-org.com"
api_key: "${INTENT_API_KEY}"  # 建议通过环境变量注入
auto_pull: true               # 每次启动自动拉取最新协议
version_lock: "latest"        # 或锁定具体版本如 "v1.2.0"
```

---

## 五、核心用法：三行代码接入

### 场景 1：Prompt 自动注入约束（Node.js）

```typescript
import { IntentClient } from '@intent-schema/sdk';
import OpenAI from 'openai';

// 1. 初始化 SDK（自动拉取意图协议）
const intent = await IntentClient.init({
  configPath: './.intentrc.yaml'
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 2. 构造 Prompt 时，自动注入当前意图的约束前缀
const prompt = await intent.wrapPrompt('alert-card', {
  userInput: 'CPU 使用率 95%，请生成告警文案'
});

// 3. 调用 LLM
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: prompt }]
});

// 4. 输出自动校验（四层推演）
const result = await intent.validateOutput('alert-card', completion.choices[0].message.content);

if (result.action === 'BLOCK') {
  console.error('语义拦截：', result.violations);
  // 触发降级：转人工或返回预设安全文案
} else {
  // 安全放行，返回给用户
  return result.sanitizedOutput;
}
```

**SDK 自动做了什么？**

1. 读取 `intent-schema-compiler` 中 `alert-card` 意图的 `prompt-constraints.yaml`
2. 在 system message 中注入约束："必须使用 status.critical 语义令牌，禁止用'严重'替代"
3. LLM 输出后，用 `response-schema.yaml` 执行 JSON Schema 校验
4. 命中同义词黑名单时，自动返回 `BLOCK` + 归因信息

### 场景 2：Python Agent 接入

```python
from intent_schema_sdk import IntentClient
from openai import OpenAI

intent = IntentClient.init(config_path="./.intentrc.yaml")
client = OpenAI()

# 自动注入约束并调用
response = intent.chat.completions.create(
    intent_id="destructive-action",
    client=client,
    model="gpt-4",
    messages=[{"role": "user", "content": "帮我修复这个故障"}]
)

# 如果 LLM 建议了自动修复命令，SDK 自动拦截
if response.intent_action == "BLOCK":
    print(f"拦截原因：{response.violations}")
    print("已触发人工升级流程")
else:
    print(response.content)
```

---

## 六、SDK 能力详解

### 6.1 自动拉取与缓存

```typescript
// 默认行为：启动时拉取，本地缓存 5 分钟
const intent = await IntentClient.init({
  autoPull: true,
  cacheTtl: 300  // 秒
});

// 手动刷新（适合长驻进程）
await intent.refresh();
```

### 6.2 版本锁定与灰度

```yaml
# .intentrc.yaml
version_lock: "v1.2.0"      # 生产环境建议锁定
# 或
version_lock: "latest"      # 测试环境可追最新
```

SDK 会在请求头中携带 `X-Intent-Version`，便于平台侧统计各版本的接入分布。

### 6.3 人机边界自动处理

当意图契约中定义了 `human_mandatory` 时，SDK 自动在响应中插入确认层：

```typescript
const result = await intent.validateOutput('destructive-action', llmOutput);

if (result.requiresHumanConfirmation) {
  // SDK 自动包装为确认对话框数据结构
  return {
    type: 'CONFIRMATION_REQUIRED',
    message: '该操作涉及不可逆修复，请人工确认',
    payload: result.sanitizedOutput
  };
}
```

### 6.4 观测埋点（可选）

SDK 自动将拦截/放行事件上报 Bridge，无需额外配置：

```typescript
// 默认开启，可通过配置关闭
const intent = await IntentClient.init({
  telemetry: {
    enabled: true,
    endpoint: 'https://intent-bridge.your-org.com'
  }
});
```

---

## 七、黑盒原则：你不需要知道的事

作为 AI 工程师，你**不需要**关心以下内容：

| 你不需要关心 | 平台团队负责 |
|-------------|-------------|
| YAML 协议怎么写 | Intent Steward 编写语义令牌 |
| 同义词黑名单维护 | 语义架构师通过 PR 更新 |
| JSON Schema 怎么编 | Compiler 自动从 YAML 编译 |
| 四层推演具体逻辑 | Validator 服务统一执行 |
| 版本影响面分析 | Registry 自动计算 |

**你只需要**：安装 SDK → 配置项目 ID → 在 LLM 调用处替换为 `intent.wrapPrompt` / `intent.validateOutput`。

---

## 八、常见问题

**Q1：SDK 拉取失败怎么办？**  
A：默认降级为旁路模式（pass-through），LLM 调用正常进行，但约束不生效。建议配置告警：
```yaml
failover:
  mode: "pass_through"  # 或 "block_all"（保守模式）
  alert_webhook: "https://hooks.slack.com/..."
```

**Q2：延迟影响大吗？**  
A：本地缓存命中时 < 1ms；首次拉取或刷新时 ~50-100ms。建议启动时预拉取，运行时走缓存。

**Q3：支持哪些 LLM 平台？**  
A：当前 SDK 支持 OpenAI、Anthropic、Azure OpenAI、通义千问。其他平台可通过 `intent.getConstraints()` 手动获取约束后注入。

**Q4：如何调试约束是否生效？**  
A：开启 debug 模式查看注入的完整 Prompt：
```typescript
const prompt = await intent.wrapPrompt('alert-card', { userInput: '...' });
console.log(prompt); // 查看 system message 中注入的约束文本
```

---

## 九、下一步

1. 联系平台团队获取 `project_id` 和 `api_key`
2. 安装 SDK：`npm install @intent-schema/sdk` 或 `pip install intent-schema-sdk`
3. 创建 `.intentrc.yaml` 并配置项目绑定
4. 在第一个 LLM 调用处替换为 `intent.wrapPrompt`
5. 验证约束生效：故意让 LLM 输出违规内容，观察是否被 BLOCK

**接入支持**：如有问题，联系组织 Intent Steward 或提交 Issue 至 `schema-as-code` 仓库。

---

**相关文档**：
- [控制平面载体：intent-schema-compiler](https://github.com/2436041978-ops/intent-schema-compiler)
- [前端黑盒接入指南](./frontend-blackbox-guide.md)
- [端到端示例：告警卡片全链路](./end-to-end-alert-card.md)
