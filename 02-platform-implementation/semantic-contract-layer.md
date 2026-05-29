# 语义契约层：控制平面与数据平面交互架构

> 本文档定义 Schema-As-Code 体系中控制平面与数据平面的交互协议，包括声明式同步、编译产物分发、运行时拦截与观测反哺的完整链路规范。

---

## 一、定位与目标

**语义契约层（Semantic Contract Layer）** 是 Schema-As-Code 联邦自治架构的**调度中枢**，回答一个核心问题：

> 控制平面中的 YAML 意图协议，如何被转化为数据平面中可执行的约束产物，并在运行时形成闭环？

它既不是单纯的"文档规范"，也不是具体的"工程实现"，而是**两者之间的契约接口**——定义控制平面"输出什么"、数据平面"消费什么"、以及两者之间的**同步协议**。

---

## 二、控制平面（Control Plane）

### 2.1 定义

控制平面是 Schema-As-Code 体系的**唯一事实源（Single Source of Truth）**，以 `intent-schema-compiler` 仓库为载体，存储所有意图协议的 YAML 定义。

### 2.2 物理形态

```
intent-schema-compiler/          # 控制平面载体
├── 语义层/
│   ├── intent-schema.json      # 意图契约：不可变边界与违规动作
│   ├── semantic-tokens.yaml    # 语义令牌：业务语义 ↔ 系统标识
│   └── synonym-mapping.yaml    # 同义词防火墙：防 LLM 漂移
├── 治理层/
│   ├── prompt-constraints.yaml   # 输入侧：Prompt 不可变边界注入
│   ├── response-schema.yaml      # 输出侧：Response 安检门
│   └── human-ai-boundary.yaml    # 权限侧：人机边界划分
└── 执行层/
    ├── compilation-chain.md      # 编译思维链：从意图到约束的翻译逻辑
    └── scenario-tests.yaml       # 场景测试：Happy Path + Edge Case
```

### 2.3 核心职责

| 职责 | 说明 |
|:---|:---|
| **语义定义** | 定义业务语义到系统标识的映射（如 `status.critical`） |
| **边界声明** | 声明不可变边界与违规动作（`block` / `escalate` / `fallback`） |
| **版本冻结** | 标记 `immutable: true` 的语义令牌，变更必须发新版本 |
| **引用闭环** | 意图契约 → 语义令牌 → 约束规则 → 场景测试，形成可追溯链 |

### 2.4 输出规范

控制平面向下游输出的不是原始 YAML，而是**经过解析的语义图（Resolved Semantic Graph）**，包含：

- `semantic_tokens`: 令牌 ID → 视觉映射 + LLM 约束 + 同义词防火墙
- `intent_contracts`: 契约 ID → 不可变边界列表 + 人机边界矩阵
- `synonym_maps`: 同义词 → 标准令牌 + 置信度阈值 + 适用上下文
- `version_hash`: 当前 Git Commit SHA 的短哈希，用于版本对齐

---

## 三、数据平面（Data Plane）

### 3.1 定义

数据平面是 Schema-As-Code 体系的**分布式执行网格**，由五个节点构成，负责将控制平面的声明转化为可执行动作。

### 3.2 节点拓扑

```
控制平面（intent-schema-compiler）
           │
           │ 声明式同步（GitOps / Webhook）
           ▼
    ┌─────────────┐
    │  Registry   │  ← 语义注册表：版本管理 + 影响面分析
    └─────────────┘
           │
           │ 语义图分发
           ▼
    ┌─────────────┐
    │  Compiler   │  ← 契约编译器：YAML → 可执行产物
    └─────────────┘
           │
           │ 约束产物包
           ▼
    ┌─────────────┐
    │  Validator  │  ← 四层推演引擎：语法/语义/安全/美感安检
    └─────────────┘
           │
           │ 校验结果（PASS / BLOCK / WARN）
           ▼
    ┌─────────────┐
    │  Runtime    │  ← 治理运行时：组件/API/LLM 现场拦截
    └─────────────┘
           │
           │ 拦截事件 / 漂移数据
           ▼
    ┌─────────────┐
    │   Bridge    │  ← 观测桥接器：归因分析 + 反哺 PR
    └─────────────┘
           │
           │ 自动 PR（修正控制平面）
           └──────────────────────► 控制平面（闭环）
```

### 3.3 节点职责

| 节点 | 输入 | 输出 | 核心动作 |
|:---|:---|:---|:---|
| **Registry** | 控制平面 YAML | 版本化语义索引 + 影响面报告 | SemVer 管理、Breaking Change 检测、下游绑定分析 |
| **Compiler** | 解析后的语义图 | 约束产物包（L1-L5） | 6 步编译管线：Load → Parse → Derive → Generate → Verify → Analyze |
| **Validator** | 约束产物 + 待校验对象 | 推演报告（PASS/BLOCK/WARN） | 四层推演：语法 → 语义 → 安全 → 美感，短路终止 |
| **Runtime** | 编译产物策略文件 | 拦截事件日志 | 热加载、Actor 解析、权限矩阵执行 |
| **Bridge** | 运行时拦截事件 + 可观测 Trace | 归因报告 + 自动 PR | 语义归一化、根因定位、治理指标聚合 |

---

## 四、交互协议（核心）

### 4.1 声明式同步协议（GitOps）

控制平面与数据平面之间的**首要同步机制**是 Git 事件驱动。

#### 触发条件

| 事件 | 触发动作 | 消费节点 |
|:---|:---|:---|
| **PR 创建** | Registry 执行影响面分析，评论受影响产品列表 | Registry |
| **PR Merge** | 触发 Compiler 重新编译，生成新产物包 | Compiler |
| **Tag 发布** | 触发 Validator 场景测试重跑，标记版本合规 | Validator |
| **Breaking Change** | 触发 Bridge 告警，通知下游产品强制升级 | Bridge + Runtime |

#### 同步接口

```yaml
# .github/workflows/schema-sync.yml（示例）
sync_trigger:
  event_types: [pull_request, push, release]

  on_pr:
    action: registry.impact_analysis
    output: comment_to_pr

  on_merge:
    action: compiler.compile
    input: schema/${version}/
    output: dist/${version}/

  on_release:
    action: validator.batch_verify
    input: dist/${version}/ + scenario-tests.yaml
    output: verification_report.json
```

### 4.2 编译产物协议（Compiler → 下游）

Compiler 生成的约束产物必须遵循**五层穿透规范**，每层产物携带统一的元数据头：

```json
{
  "_meta": {
    "schema_version": "v1.1.0",
    "schema_version_hash": "a3f7d2e",
    "intent_contract_id": "destructive-action",
    "generated_at": "2026-05-29T10:00:00Z",
    "generator": "intent-compiler@2.1.0"
  },
  "payload": { ... }
}
```

#### 五层产物映射

| 层级 | 产物格式 | 消费方 | 部署方式 |
|:---|:---|:---|:---|
| **L1 Token** | CSS 变量 / JSON / TS 常量 | 设计系统主题 | npm 包 / CDN |
| **L2 Component** | TS 类型定义 / ESLint 规则 JSON | 前端组件库 | npm 包 / CI 注入 |
| **L3 API** | OpenAPI 扩展字段 / JSON Schema | API Gateway / 后端 | 网关插件 / 中间件 |
| **L4 Container** | OPA Policy / WASM JSON 配置 | 服务网格 / Sidecar | 配置中心下发 |
| **L5 Database** | DDL 注释 SQL / 字段约束 | 数据库 Schema | 迁移脚本 |

### 4.3 运行时拦截协议（Runtime ↔ Validator）

Runtime 在执行拦截时，必须向 Validator 发起**快速校验请求**（可选，用于复杂场景），或直接使用 Compiler 产物中的本地策略文件。

#### 请求格式

```json
{
  "intent_contract_id": "destructive-action",
  "schema_version": "v1.1.0",
  "actor_type": "ai",
  "payload": {
    "alert_level": "严重",
    "root_cause": "CPU",
    "confidence_score": 1.5
  },
  "context": {
    "product_id": "product-a",
    "llm_temperature": 0.9
  }
}
```

#### 响应格式

```json
{
  "passed": false,
  "overall_action": "block",
  "tiers": [
    {
      "tier": "semantic",
      "passed": false,
      "errors": [
        {
          "rule_id": "SEM-002",
          "field": "alert_level",
          "message": "Value '严重' is not defined in enum",
          "action": "block",
          "rule_ref": "schema/v1.1.0/synonym-mapping.yaml#严重"
        }
      ]
    }
  ],
  "metadata": {
    "validated_at": "2026-05-29T10:00:01Z",
    "duration_ms": 12
  }
}
```

### 4.4 观测反哺协议（Bridge → 控制平面）

Bridge 采集到漂移事件后，通过**标准化归因格式**反向驱动控制平面更新。

#### 归因事件格式

```yaml
# bridge/feedback/event-template.yaml
drift_event:
  event_id: "DE-20260529-001"
  detected_at: "2026-05-29T10:00:00Z"

  source:
    type: "llm_output"
    trace_id: "abc123"
    product_id: "product-a"

  drift:
    type: "synonym_substitution"
    original_token: "status.critical"
    llm_output: "严重"
    confidence: 0.92

  root_cause:
    - type: "synonym_rule_too_loose"
      rule_ref: "schema/v1.1.0/synonym-mapping.yaml#严重"
      suggestion: "收紧 '严重' 的置信度阈值至 0.99，或从 allowed_contexts 中移除 AW-001"

  impact:
    affected_products: ["product-a", "product-b"]
    severity: "high"

  proposed_action:
    type: "tighten_rule"
    auto_pr:
      title: "[Auto] 收紧 '严重' 同义词映射规则"
      branch: "auto-tighten/synonym-severe-20260529"
      reviewers: ["semantic-architect"]
```

---

## 五、版本对齐机制

### 5.1 版本哈希校验

Runtime 启动时，必须校验本地加载的策略文件版本与控制平面最新版本是否一致：

```javascript
// runtime/policy-loader.js 伪代码
const localHash = fs.readJsonSync('./policies/meta.json').schema_version_hash;
const remoteHash = await registry.getLatestHash('v1.1.0');

if (localHash !== remoteHash) {
  logger.warn('POLICY_VERSION_MISMATCH', {
    local: localHash,
    remote: remoteHash,
    action: 'continue_with_warning' // 或 escalate
  });
}
```

### 5.2 兼容性矩阵

| 控制平面版本 | Compiler 兼容 | Validator 兼容 | Runtime 兼容 |
|:---|:---|:---|:---|
 `v1.0.0` | `>=1.0.0` | `>=1.0.0` | `>=1.0.0` |
| `v1.1.0` | `>=1.1.0` | `>=1.1.0` | `>=1.0.0`（向后兼容） |
| `v2.0.0`（Breaking） | `>=2.0.0` | `>=2.0.0` | `>=2.0.0` |

---

## 六、接口规范汇总

### 6.1 控制平面输出接口

| 接口 | 路径 | 格式 | 消费者 |
|:---|:---|:---|:---|
| 语义图 API | `schema/{version}/semantic-graph.json` | JSON | Compiler |
| 意图契约 API | `schema/{version}/intent-contracts.json` | JSON | Compiler + Runtime |
| 同义词映射 API | `schema/{version}/synonym-maps.json` | JSON | Validator + Bridge |
| 版本元数据 | `schema/{version}/meta.json` | JSON | 所有节点 |

### 6.2 数据平面输入接口

| 接口 | 路径 | 格式 | 提供者 |
|:---|:---|:---|:---|
| 编译产物包 | `dist/{version}/` | 多格式（CSS/TS/JSON/Rego/SQL） | Compiler |
| 推演结果 | `validator/reports/{id}.json` | JSON | Validator |
| 拦截日志 | `runtime/logs/{date}.jsonl` | JSON Lines | Runtime |
| 归因报告 | `bridge/reports/{date}.yaml` | YAML | Bridge |

---

## 七、附录：完整配置示例

### 7.1 控制平面 YAML 片段

```yaml
# intent-schema-compiler/语义层/semantic-tokens.yaml
semantic_tokens:
  status.critical:
    canonical_id: "ST-001"
    version: "1.0.0"
    immutable: true
    description: "系统级故障，需立即响应"

    visual_mapping:
      color_token: "status.critical"
      motion_token: "pulse.red.urgent"
      sound_token: "alert.high"

    llm_constraints:
      - "生成内容必须包含明确的故障定位信息"
      - "禁止提供未经验证的修复建议"
      - "必须附带人工升级路径"

    synonym_firewall:
      prohibited:
        - term: "严重"
          confidence_threshold: 0.95
          allowed_contexts: ["AW-001", "AW-002"]
```

### 7.2 Compiler 配置片段

```yaml
# schema-as-code/compiler.config.yaml
registry_endpoint: "https://raw.githubusercontent.com/2436041978-ops/intent-schema-compiler/main"
target_version: "v1.1.0"

plugins:
  - name: token-css
    output: ./dist/v1.1.0/tokens/
  - name: component-ts
    output: ./dist/v1.1.0/components/
    framework: react
  - name: api-openapi
    output: ./dist/v1.1.0/api/
  - name: container-opa
    output: ./dist/v1.1.0/policies/
  - name: database-sql
    output: ./dist/v1.1.0/ddl/
```

### 7.3 Runtime 策略片段

```json
{
  "_meta": {
    "schema_version": "v1.1.0",
    "schema_version_hash": "a3f7d2e"
  },
  "policies": {
    "destructive-action": {
      "human_mandatory": ["是否触发自动修复"],
      "ai_prohibited": ["直接执行修复操作", "修改告警阈值配置"],
      "escalation_path": {
        "blocked": "return_403",
        "human_required": "modal_confirm"
      }
    }
  }
}
```

---

## 八、Gap 声明

本文档定义的交互协议为 **v1.0.0 规范**，当前 Compiler 与 Bridge 的完整实现处于占位状态。Registry 版本管理、Runtime 热加载、Bridge 自动 PR 的具体实现细节，将在各模块独立文档中展开。

---

**文档版本**：v1.0.0  
**生效日期**：2026-05-29  
**维护者**：Schema-As-Code 架构工作组
