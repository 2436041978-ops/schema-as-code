# 模块 4：Governance Runtime — 权限契约的运行时拦截

> **定位**：Schema-As-Code 数据平面的执行臂。将编译后的约束产物部署到生产环境，在组件渲染、API 请求、LLM 工具调用的现场执行语义拦截。

---

## 一、总体架构

Governance Runtime 不是独立服务，而是**以 npm 包形态嵌入业务代码的轻量守卫层**。核心由三部分组成：

| 组件 | 职责 | 部署形态 |
|------|------|---------|
| **策略加载器（Policy Loader）** | 热加载 Compiler 产物，校验版本哈希 | 运行时内存模块 |
| **身份解析器（Actor Resolver）** | 判定当前执行者是 human / ai / human_via_ai | 请求上下文透传 |
| **拦截决策矩阵（Decision Matrix）** | 根据 Actor × Intent × Action 输出放行/阻断/升级 | 同步阻塞判断 |

```
业务代码（React/Express/LLM Tool）
    │
    ▼
┌─────────────────────────────────────┐
│         Governance Runtime            │
│  ┌─────────────┐ ┌─────────────┐    │
│  │ Policy Loader│ │Actor Resolver│    │
│  │  (热加载)     │ │  (身份判定)   │    │
│  └──────┬──────┘ └──────┬──────┘    │
│         │               │            │
│         └───────┬───────┘            │
│                 ▼                    │
│         ┌─────────────┐            │
│         │Decision Matrix│            │
│         │  (拦截矩阵)   │            │
│         └──────┬──────┘            │
│                │                    │
│         ┌──────┴──────┐            │
│         ▼            ▼            │
│      放行(PASS)   阻断(BLOCK)     │
│                   /升级(ESCALATE) │
└─────────────────────────────────────┘
    │
    ▼
下游基础设施（Ant Design / API / LLM）
```

---

## 二、核心机制：三种运行时守卫

Runtime 提供三种守卫，覆盖前端组件层、后端 API 层、LLM 工具层。

### 2.1 组件守卫：withIntentGuard（React/Vue）

**拦截时机**：组件渲染 / 用户交互触发前。

```typescript
// React HOC 形态
import { withIntentGuard } from '@intent/runtime';

const DestructiveButton = withIntentGuard(Button, {
  intentId: 'destructive-action',
  action: 'execute_delete'
});

// 使用
<DestructiveButton 
  onClick={handleDelete} 
  humanConfirmed={userExplicitlyChecked}
/>
```

**拦截逻辑**：
- 若 `actor === 'ai'` 且 `action` 命中 `ai_prohibited` → 渲染禁用态 + 触发升级
- 若 `human_mandatory` 包含当前动作且 `humanConfirmed === false` → 强制弹出确认弹窗
- 通过 → 正常渲染原组件

### 2.2 API 守卫：apiGuardMiddleware（Express/Koa）

**拦截时机**：HTTP 请求到达业务 Controller 前。

```javascript
// Express 中间件
const { apiGuardMiddleware } = require('@intent/runtime');
app.use(apiGuardMiddleware({
  policyPath: './policies/human-ai-boundary.json'
}));

// 请求头透传身份
// x-actor-type: ai | human | human_via_ai
// x-intent-id: destructive-action
```

**拦截逻辑**：
- `actor === 'ai'` 调用 `POST /api/destructive` → 直接返回 `403 INTENT_VIOLATION`
- 请求体缺少 `human_confirmed` 字段 → 返回 `422 HUMAN_CONFIRMATION_REQUIRED`
- 通过 → `next()` 进入业务逻辑

### 2.3 LLM 工具守卫：toolGuard（OpenAI / LangChain）

**拦截时机**：LLM 决定调用外部工具（Function Calling）前。

```javascript
const tools = [
  {
    name: 'execute_repair',
    intentBinding: 'destructive-action',
    function: async (args) => { /* 实际修复逻辑 */ }
  }
];

// 包装后交给 LLM
const guardedTools = toolGuard(tools, policyStore);
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages,
  tools: guardedTools  // LLM 只能调用被包装后的工具
});
```

**拦截逻辑**：
- 工具绑定的 `intentBinding` 命中 `ai_prohibited` → 不执行原函数，返回伪结果：`{ status: 'BLOCKED_BY_INTENT_POLICY', action_required: 'HUMAN_APPROVAL' }`
- 通过 → 执行原工具函数

---

## 三、运行时策略配置

Runtime 不自己定义策略，只消费 **Schema Compiler 产物**。

### 3.1 产物格式（human-ai-boundary.json）

```json
{
  "destructive-action": {
    "intent_id": "destructive-action",
    "human_mandatory": [
      "是否触发自动修复",
      "升级路径选择"
    ],
    "ai_prohibited": [
      "直接执行修复操作",
      "修改告警阈值配置",
      "POST:/api/v1/destructive"
    ],
    "escalation_path": {
      "blocked": "return_403",
      "human_required": "modal_confirm"
    }
  }
}
```

### 3.2 热加载机制

```javascript
class PolicyLoader {
  constructor(path) {
    this.path = path;
    this.policies = this.load();
    // 开发环境：文件系统 watch
    if (process.env.NODE_ENV === 'development') {
      fs.watch(path, () => { this.policies = this.load(); });
    }
  }

  load() {
    return JSON.parse(fs.readFileSync(`${this.path}/human-ai-boundary.json`, 'utf8'));
  }

  get(intentId) {
    return this.policies[intentId] || { human_mandatory: [], ai_prohibited: [] };
  }
}
```

### 3.3 版本哈希对齐

Runtime 启动时校验产物哈希与 Registry 发布版本是否一致：

```javascript
const localHash = computeHash(policyFile);
const registryHash = fetchRegistryVersion();
if (localHash !== registryHash) {
  console.warn('[Intent Runtime] 策略版本不匹配，可能过期');
}
```

---

## 四、Actor 身份解析规范

Runtime 必须准确判定执行者身份：

| Actor 类型 | 判定依据 | 典型场景 |
|-----------|---------|---------|
| `human` | 用户直接操作（鼠标/键盘），通过认证服务签发的身份令牌 | 用户点击删除按钮 |
| `ai` | LLM / Agent / 自动化脚本发起，通过 `x-actor-type: ai` 请求头 | AI 助手建议修复方案 |
| `human_via_ai` | 用户通过 AI 中介间接触发（点击"采纳 AI 建议"） | 用户点击"自动修复"按钮，文案由 LLM 生成 |

**身份链传递**：`human_via_ai` 必须触发比纯 `human` 更严格的人工确认流程。

---

## 五、拦截决策矩阵

```
                    Intent 边界
Actor         ┌─────────────┬─────────────┬─────────────┐
              │  无限制      │ ai_assisted │ human_mandatory │ ai_prohibited
├─────────────┼─────────────┼─────────────┼─────────────┤
human         │   放行       │    放行      │ 需 humanConfirmed │ 需 humanConfirmed + 审计
human_via_ai  │   放行       │    放行      │   强制二次确认   │    阻断
ai            │   放行       │   执行       │     阻断        │    阻断
```

---

## 六、轻量部署方式

### 方式 A：npm 包（推荐，零运维）

```bash
npm install @intent/runtime
```

### 方式 B：CDN 加载（纯前端场景）

```html
<script src="https://cdn.example.com/intent-runtime@1.0.0/dist/index.js"></script>
```

### 方式 C：ESM Import（现代构建工具）

```javascript
import { withIntentGuard } from '@intent/runtime/react';
import { apiGuardMiddleware } from '@intent/runtime/express';
```

---

## 七、与现有基础设施集成

| 技术栈 | 集成文件 | 侵入性 |
|--------|---------|--------|
 React | `withIntentGuard(Component, config)` | 低：HOC 包裹 |
 Vue 3 | `v-intent-guard="config"` | 低：指令绑定 |
 Express | `app.use(apiGuardMiddleware)` | 低：中间件 |
 Koa | `app.use(apiGuardMiddleware)` | 低：中间件 |
 NestJS | `@UseGuards(IntentGuard)` | 低：装饰器 |
 OpenAI SDK | `toolGuard(tools, policyStore)` | 低：工具包装 |
 LangChain | `IntentToolWrapper` | 低：包装器 |

---

## 八、组织架构要求

| 角色 | 人数 | 职责 |
|------|------|------|
 Runtime 维护者 | 1 人（平台/全栈工程师兼职） | 维护守卫核心、策略热加载、CLI 诊断工具 |
 产品接入工程师 | 每产品 1 人（前端/后端 TL 兼职） | 植入 withIntentGuard 或 apiGuardMiddleware，处理 BLOCK 事件降级 |
 安全/合规审核员 | 1 人（兼职） | 审核 ai_prohibited 规则完整性，审计运行时拦截日志 |

---

## 九、风险矩阵

| 风险 | 描述 | 缓解措施 |
|------|------|---------|
 性能损耗 | 每次渲染/请求查策略文件，引入 1-5ms 延迟 | 内存缓存 + 懒加载 + 无绑定组件跳过守卫 |
 绕过风险 | 开发者不接入 withIntentGuard，直接调用底层 API | 网关兜底 + 代码扫描审计 + 渐进强制 |
 Actor 身份误判 | 人的操作识别为 AI，或 AI 伪造请求头 | 身份链必须由可信网关签发，前端不可伪造 |
 策略版本漂移 | 产品加载旧版策略，与 Registry 最新契约不一致 | 版本哈希校验 + CI 联动告警 |

---

## 十、行业参照

| 项目 | 出品方 | 借鉴点 |
|------|--------|--------|
 Casbin | 开源社区 | 策略即配置，权限规则 CSV/INI 定义，运行时加载 |
 OPA (Open Policy Agent) | CNCF | 策略与业务解耦，Rego 声明式表达 |
 AWS IAM / GCP IAM | 云厂商 | JSON 策略格式，Principal/Role 身份解析 |
 React Error Boundary | Meta | HOC 拦截模式，捕获渲染错误 |
 LangChain Tools | LangChain | Tool 包装器，装饰器可扩展为 intentTool |

---

## 十一、与上下游模块的关系

```
Schema Compiler（编译产物）
    │
    ├──► human-ai-boundary.json ──► Governance Runtime（加载策略）
    │
    └──► 各层守卫（React HOC / Express Middleware / Tool Guard）
              │
              ├──► 拦截事件 ──► Observability Bridge（上报）
              │
              └──► 放行/阻断 ──► 业务基础设施
```

---

**版本**：v0.1.0  
**维护者**：Schema-As-Code 平台团队  
**对应语雀文档**：《模块 4：Governance Runtime 权限契约的运行时拦截》
