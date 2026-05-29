# 基础设施层适配规范

> 本文档定义 Schema-As-Code 语义治理网格与现有基础设施的集成协议，确保约束产物从设计语义到数据持久化的全链路一致性。

## 一、定位与目标

### 1.1 本文档回答的问题
- 语义契约如何穿透 Token → 组件 → API → 容器 → 数据库五层生产链路？
- 如何与 Ant Design、Carbon Design System、LoongSuite GenAI SemConv 等现有基础设施共存？
- 新增一个目标平台需要遵循什么接口协议？

### 1.2 核心原则
| 原则 | 说明 |
|------|------|
| **正交穿透** | 治理网格横向铺设，不替代任何现有技术栈，只注入规则与采集观测 |
| **同构映射** | 同一语义令牌在五层中的映射必须保持语义一致性 |
| **增量穿透** | 新增约束时无需全量重构，仅编译变更节点及其下游依赖 |
| **双向溯源** | 任意层级的约束产物必须携带意图协议 ID 与版本哈希 |

---

## 二、五层穿透模型（Five-Layer Penetration Model）

### 2.1 穿透层级定义

| 层级 | 标识 | 约束产物形态 | 作用域 | 拦截时机 | 典型消费方 |
|------|------|-------------|--------|---------|-----------|
| **L1 Token 层** | `L1` | CSS 变量 / Theme 配置 / 语义注释 | 视觉系统 | 主题编译时 | Design Token 系统 |
| **L2 组件层** | `L2` | TS 类型定义 / Prop 约束 / ESLint 规则 | 前端组件库 | 开发编译时 + 组件渲染时 | React / Vue / Angular |
| **L3 API 层** | `L3` | OpenAPI 扩展 / JSON Schema / 请求体校验 | 接口契约 | 请求到达业务逻辑前 | Express / Koa / GraphQL |
| **L4 容器层** | `L4` | OPA Policy / WASM 配置 / Sidecar 规则 | 服务网格 | 网络请求路由时 | Envoy / Istio / K8s |
| **L5 数据库层** | `L5` | DDL 注释 / CHECK 约束 / 字段语义标签 | 数据持久化 | 数据写入时（软约束） | MySQL / PostgreSQL |

### 2.2 同构映射示例

同一语义令牌 `status.critical` 在五层中的映射：

```
L1 Token 层:
  --status-critical-color: #D32F2F;
  --status-critical-motion: pulse-red-urgent;

L2 组件层:
  type AlertLevel = 'status.critical' | 'status.warning' | 'status.info';

L3 API 层:
  alert_level: { type: string, enum: ['P0','P1','P2','P3'] }

L4 容器层:
  allow { input.alert_level == "P0" }

L5 数据库层:
  COMMENT 'intent: status.critical'
```

### 2.3 穿透接口协议

每层必须实现标准接口，接收 Compiler 产物并转化为平台特定规则：

```typescript
interface LayerAdapter {
  // 接收约束产物
  ingest(artifact: ConstraintArtifact): Promise<void>;

  // 返回当前层已激活的语义令牌列表
  listActiveTokens(): SemanticToken[];

  // 根据意图协议 ID 反向溯源到源 YAML
  traceSource(intentId: string): { yamlPath: string; version: string };

  // 卸载指定版本的约束产物
  evict(version: string): Promise<void>;
}
```

---

## 三、与现有基础设施的适配方案

### 3.1 Ant Design 适配

**现状**：Ant Design 采用 ConfigProvider + CSS-in-JS 主题方案，组件层以 React 为主。

**适配策略**：

| 层级 | 产物形态 | 集成点 | 侵入性 |
|------|---------|--------|--------|
| L1 | `theme` 配置扩展对象 | `ConfigProvider theme` 属性 | 低 |
| L2 | TS 类型定义 + ESLint 规则 | `props` 类型收窄 + `eslint-plugin-intent` | 低 |
| L3 | OpenAPI 扩展字段 | API Gateway 插件 | 低 |

**L1 示例**：
```typescript
// Compiler 产物：antd-theme-ext.ts
export const IntentTheme = {
  token: {
    colorCritical: 'var(--status-critical-color)',
    motionCritical: 'var(--status-critical-motion)',
  },
  // 语义注释，供运行时读取
  _intent_meta: {
    'colorCritical': { intentId: 'status.critical', immutable: true }
  }
};

// 使用方式
<ConfigProvider theme={{ ...defaultTheme, ...IntentTheme }}>
```

**L2 示例**：
```typescript
// Compiler 产物：intent-types.d.ts
interface DestructiveButtonProps {
  intentContract: 'destructive-action';
  humanConfirmed?: boolean;
  // 禁止在 destructive 场景下使用 primary 样式
  type?: never; 
}

// ESLint 规则产物
// "intent/destructive-action-guard": ["error", {
//   requiredChildren: ["ConfirmModal"],
//   prohibitedProps: { type: "primary" }
// }]
```

### 3.2 Carbon Design System 适配

**现状**：Carbon 采用 Sass/Less 变量 + 多框架组件（React/Vue/Angular），Token 层以 CSS 变量为主。

**适配策略**：

| 层级 | 产物形态 | 集成点 | 侵入性 |
|------|---------|--------|--------|
| L1 | Sass 变量注释 + CSS Custom Property | `_tokens.scss` 扩展 | 低 |
| L2 | 组件 Props 类型 + Storybook Addon | 组件库内部类型定义 | 低 |

**L1 示例**：
```scss
// Compiler 产物：carbon-tokens-ext.scss
/* intent: status.critical | canonical_id: ST-001 | immutable: true */
$status-critical-color: #D32F2F !default;
$status-critical-motion: pulse-red-urgent !default;

:root {
  --cds-status-critical-color: #{$status-critical-color};
  --cds-status-critical-motion: #{$status-critical-motion};
}
```

**L2 示例**：
```typescript
// Compiler 产物：carbon-react-intents.d.ts
import { ButtonProps } from '@carbon/react';

export interface IntentGuardedButtonProps extends ButtonProps {
  intentContract?: 'destructive-action' | 'alert-card';
  semanticToken?: 'status.critical' | 'status.warning';
}

// Storybook Addon 校验：示例代码中语义令牌合规性
```

### 3.3 LoongSuite GenAI SemConv 适配

**现状**：LoongSuite 在 OpenTelemetry 基础上定义了 GenAI 场景的统一可观测数据语言（Entry Span / Step Span / Skill Span / Token 级观测）。

**适配策略**：

Schema-As-Code 的 Bridge 节点通过标准化接口与 LoongSuite 对接：

```yaml
# Bridge 配置：observability-binding.yaml
observability_binding:
  provider: "loongsuite.genai.v1"
  trace_format: "opentelemetry"

  event_mapping:
    - governance_event: "semantic_drift_blocked"
      semconv_span: "invoke_skill"
      skill_name: "alert_card_generation"
      attributes:
        - "drift.type: synonym_substitution"
        - "original_token: critical"
        - "intent.schema_version: 2.1.0"

    - governance_event: "safety_boundary_triggered"
      semconv_span: "invoke_skill"
      attributes:
        - "boundary_type: destructive_action"
        - "violation_action: block"
```

**数据流**：
1. Runtime 拦截事件 → Bridge 归一化 → 写入 LoongSuite Trace（`invoke_skill` Span 扩展属性）
2. LoongSuite Token 级分析发现异常 → Bridge 归因引擎反向查询 Registry → 定位需收紧的契约规则
3. Bridge 自动创建 Registry PR → 人工审批 → 触发 Compiler 重新编译 → 全链路更新

### 3.4 其他平台适配速查

| 平台 | L1 产物 | L2 产物 | L3 产物 | L4 产物 |
|------|---------|---------|---------|---------|
| **Tailwind CSS** | CSS 变量 + `tailwind.config.js` 扩展 | 无（Utility 类通过 Token 映射） | 无 | 无 |
| **Element Plus** | SCSS 变量 + CSS 变量 | Vue 组件 Props 类型 | 无 | 无 |
| **Express** | 无 | 无 | OpenAPI 扩展 + 中间件 | 无 |
| **NestJS** | 无 | 无 | OpenAPI 扩展 + Guard | 无 |
| **AWS API Gateway** | 无 | 无 | OpenAPI 导入 + Lambda Authorizer | 无 |
| **OPA (Open Policy Agent)** | 无 | 无 | 无 | Rego 策略文件 |
| **Istio/Envoy** | 无 | 无 | 无 | WASM 过滤器配置 |
| **MySQL** | 无 | 无 | 无 | DDL 注释 + CHECK 约束 |
| **PostgreSQL** | 无 | 无 | 无 | PG 兼容注释 + Domain 约束 |

---

## 四、技术中立性原则

### 4.1 三层隔离模型

每个适配器必须遵循 **接口层 / 适配层 / 核心层** 的三层隔离：

```
适配器内部结构
├── interface/          # 接口层：定义输入输出协议（稳定）
│   └── adapter-contract.json
├── core/               # 核心层：通用逻辑（平台无关）
│   └── token-resolver.js
└── adapter/            # 适配层：平台特定实现（可替换）
    ├── antd.js
    ├── carbon.js
    └── tailwind.js
```

**约束**：核心层代码**零依赖**特定框架。新增平台支持 = 新增一个 100-200 行的适配器文件，不改核心层。

### 4.2 版本兼容性

适配器必须声明兼容的 Schema 版本范围：

```json
{
  "adapter": "antd-v5",
  "schema_version": ">=1.0.0 <2.0.0",
  "compiler_version": ">=0.2.0",
  "breaking_changes": ["semantic-token.v2.color-format"]
}
```

---

## 五、新增平台适配指南

### 5.1 成本评估

新增一个目标平台支持的成本：

| 平台类型 | 预估工作量 | 需实现文件 |
|---------|-----------|-----------|
| 前端组件库（React/Vue） | 1-2 人日 | 1 个 L2 适配器 + 1 个类型模板 |
| CSS 框架（Tailwind/Sass） | 0.5-1 人日 | 1 个 L1 适配器 + 1 个 CSS 模板 |
| API 框架（Express/Koa） | 1 人日 | 1 个 L3 适配器 + 中间件封装 |
| 容器平台（K8s/OPA） | 2-3 人日 | 1 个 L4 适配器 + 策略模板 |
| 数据库（MySQL/PG） | 1 人日 | 1 个 L5 适配器 + DDL 模板 |

### 5.2 适配器开发 checklist

- [ ] 实现 `LayerAdapter` 接口（ingest / listActiveTokens / traceSource / evict）
- [ ] 提供产物模板（Handlebars / EJS / 字符串模板）
- [ ] 声明 schema_version 兼容范围
- [ ] 提供 Happy Path 测试用例（编译产物能被平台正确消费）
- [ ] 提供 Edge Case 测试用例（版本不匹配时优雅降级）
- [ ] 提交到 `plugins/` 目录并通过 CI 校验

---

## 六、附录

### 附录 A：五层穿透标准产物格式

```yaml
# Compiler 产物清单示例（alert-card v1.1.0）
artifact_bundle:
  version: "1.1.0"
  intent_id: "AW-001"

  l1_tokens:
    file: "tokens.css"
    format: "css-custom-properties"

  l2_components:
    - file: "intent-types.d.ts"
      format: "typescript"
      framework: "react"
    - file: "eslint-rules.json"
      format: "eslint-config"

  l3_api:
    file: "alert-card.openapi.yaml"
    format: "openapi-3.0"

  l4_container:
    file: "alert-card.rego"
    format: "opa-rego"

  l5_database:
    file: "alert-card-ddl.sql"
    format: "mysql-ddl"
```

### 附录 B：双向溯源示例

从 L3 API 层的运行时错误，反向定位到控制平面源 YAML：

```
运行时错误：POST /api/v1/alerts 返回 422
  → alert_level: "严重" 不在 enum 中
    → 调用 traceSource("AW-001")
      → 返回：
        yamlPath: "intent-schema-compiler/语义层/synonym-mapping.yaml"
        version: "1.1.0"
        line: 12
        rule: "term: '严重' → standard_token: 'critical'"
      → 结论：同义词映射规则过松，需收紧 confidence_threshold
```

---

**文档版本**：v1.0  
**维护者**：Schema-As-Code 平台团队  
**关联文档**：
- [《Schema-As-Code 语义治理节点架构》](../node-architecture.md)
- [《模块 2：Schema Compiler 契约编译器》](../module-02-compiler.md)
- [《模块 5：Observability Bridge 观测闭环》](../module-05-bridge.md)
