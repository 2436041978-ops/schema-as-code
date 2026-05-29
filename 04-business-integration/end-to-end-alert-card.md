# 端到端示例：告警卡片全链路

> 本文展示从业务需求到意图定义，再到编译、校验、拦截、观测的完整语义治理链路。所有 YAML 定义均来自 `intent-schema-compiler` 控制平面，所有编译产物和推演结果均可复现。

---

## 一、业务场景：告警卡片

### 1.1 需求描述

运维平台收到一条 P0 告警：CPU 使用率超过阈值。系统需要生成一张告警卡片，展示给用户。

**业务规则**：
- P0 告警代表系统级故障，必须立即响应
- 卡片必须展示根因、置信度、处置建议
- 处置建议中禁止出现"自动修复""无需确认"等高危表述
- 用户必须手动确认后才能执行修复操作

### 1.2 传统实现的问题

传统实现中，这些规则散落在：
- 设计师的 Figma 标注里（"这里用红色"）
- 产品经理的 PRD 里（"高危操作需要二次确认"）
- 前端工程师的注释里（// TODO: 确认文案）
- LLM 的 Prompt 里（"请不要建议自动修复"）

**结果**：三个月后，另一个产品的设计师复用了卡片组件，把红色改成了橙色；AI 助手生成的文案里写着"严重故障，建议自动修复"——语义完全跑偏。

---

## 二、意图协议定义（控制平面）

在 `intent-schema-compiler` 仓库中，我们为告警卡片场景定义完整的意图协议。

### 2.1 语义层：定义"这个世界应该有什么语义"

文件路径：`语义层/semantic-tokens.yaml`

```yaml
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
        - term: "紧急"
          confidence_threshold: 0.95
          allowed_contexts: ["AW-001"]
        - term: "危急"
          confidence_threshold: 0.95
          allowed_contexts: ["AW-001"]

  status.warning:
    canonical_id: "ST-002"
    version: "1.0.0"
    description: "潜在风险，需关注"
    visual_mapping:
      color_token: "status.warning"
      motion_token: "static"
    llm_constraints:
      - "生成内容必须说明风险等级和影响面"
      - "必须提供监控指标参考值"
```

### 2.2 治理层：定义"什么绝对不能突破"

文件路径：`治理层/human-ai-boundary.yaml`

```yaml
human_ai_boundary:
  alert-card-generation:
    intent_id: "AW-001"
    semantic_domain: "observational"

    immutable_boundaries:
      - boundary_type: "safety"
        rule_ref: "rules/safety/destructive.yaml"
        violation_action: "block"

      - boundary_type: "compliance"
        rule_ref: "rules/compliance/alert-level.yaml"
        violation_action: "escalate"

    human_mandatory:
      - "告警等级判定（P0/P1/P2/P3）"
      - "是否触发自动修复（destructive 操作确认）"
      - "升级路径选择"

    ai_assisted:
      - "根因分析文本生成"
      - "修复建议列表生成"
      - "影响面描述生成"

    ai_prohibited:
      - "直接执行修复操作"
      - "修改告警阈值配置"
      - "关闭或忽略告警"
```

文件路径：`治理层/response-schema.yaml`

```yaml
schema_id: "RESP-ALERT-001"
schema_name: "Alert Card Response Schema"
intent_binding: "AW-001"

required_fields:
  - field: "alert_level"
    type: "string"
    enum: ["P0", "P1", "P2", "P3"]
    source: "semantic_token.status"
    validation: "exact_match"

  - field: "root_cause"
    type: "string"
    min_length: 10
    max_length: 200
    validation: "non_empty + semantic_token_reference"

  - field: "confidence_score"
    type: "number"
    minimum: 0.0
    maximum: 1.0
    validation: "range_check"

  - field: "remediation"
    type: "array"
    items:
      type: "object"
      properties:
        action_type:
          type: "string"
          enum: ["manual", "automated", "escalation"]
        description:
          type: "string"
        risk_level:
          type: "string"
          enum: ["low", "medium", "high", "critical"]
    validation: "destructive_action_guard"

prohibited_patterns:
  - pattern: "自动执行"
    severity: "critical"
    action: "block"
  - pattern: "无需确认"
    severity: "critical"
    action: "block"
  - pattern: "(?i)ignore.*warning"
    severity: "high"
    action: "escalate"
```

### 2.3 执行层：定义"怎么验证契约被遵守"

文件路径：`执行层/scenario-tests.yaml`

```yaml
scenario_tests:
  - test_id: "T-P0-001"
    test_name: "P0 告警生成与校验闭环"
    intent_binding: "AW-001"

    happy_path:
      input: { alert_source: "CPU_USAGE", threshold_breach: 95 }
      expected: "PASS"

    edge_cases:
      - case: "同义词替代"
        mock_response: { alert_level: "严重" }
        expected_validation: "BLOCK — 语义推演失败，命中同义词黑名单"

      - case: "自动执行建议"
        mock_response: 
          remediation: [{ action_type: "automated", description: "自动修复" }]
        expected_validation: "BLOCK — 安全推演失败，命中禁止模式"

      - case: "置信度不足"
        mock_response: { confidence_score: 0.5 }
        expected_validation: "ESCALATE — 触发降级策略"

      - case: "文案过短"
        mock_response: { root_cause: "CPU" }
        expected_validation: "WARN — 美感推演失败，文案长度不足"
```

---

## 三、编译产物：从 YAML 到可执行规则

Schema Compiler 将上述 YAML 协议编译为各层可消费的产物。

### 3.1 组件层产物：TypeScript 类型定义

```typescript
// dist/components/intent-types.ts
export interface AlertCardIntent {
  intentId: 'AW-001';
  semanticDomain: 'observational';

  safetyBoundary: {
    ruleRef: 'rules/safety/destructive.yaml';
    violationAction: 'block';
  };

  humanAiBoundary: {
    humanMandatory: ['告警等级判定', '是否触发自动修复', '升级路径选择'];
    aiProhibited: ['直接执行修复操作', '修改告警阈值配置', '关闭或忽略告警'];
  };
}

export type AlertLevel = 'P0' | 'P1' | 'P2' | 'P3';

export interface AlertResponse {
  alert_level: AlertLevel;
  root_cause: string;        // minLength: 10, maxLength: 200
  confidence_score: number;  // 0.0 - 1.0
  remediation: Array<{
    action_type: 'manual' | 'automated' | 'escalation';
    description: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  }>;
}
```

### 3.2 校验层产物：JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["alert_level", "root_cause", "confidence_score"],
  "properties": {
    "alert_level": {
      "type": "string",
      "enum": ["P0", "P1", "P2", "P3"]
    },
    "root_cause": {
      "type": "string",
      "minLength": 10,
      "maxLength": 200
    },
    "confidence_score": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    }
  }
}
```

### 3.3 ESLint 规则产物

```json
{
  "rules": {
    "intent/alert-card-guard": ["error", {
      "requiredFields": ["alert_level", "root_cause", "confidence_score"],
      "prohibitedPatterns": ["自动执行", "无需确认"],
      "appliesTo": ["AlertCard", "AlertModal"]
    }]
  }
}
```

---

## 四、四层推演校验：机器查清单

Validator 对 LLM 输出执行四层推演。

### 4.1 推演输入

```json
{
  "alert_level": "严重",
  "root_cause": "CPU",
  "confidence_score": 1.5,
  "remediation": [
    { "action_type": "automated", "description": "自动修复", "risk_level": "low" }
  ]
}
```

### 4.2 推演过程与结果

| 层级 | 校验内容 | 结果 | 动作 |
|:---|:---|:---|:---|
| **语法推演** | JSON 结构完整性、字段类型、必填项 | ❌ `confidence_score` 类型正确但值越界 | 继续 |
| **语义推演** | `alert_level` 必须是 `P0/P1/P2/P3` | ❌ `"严重"` 命中同义词黑名单 | **BLOCK** |
| **安全推演** | `remediation` 中禁止 `"automated"` | ❌ `"自动修复"` 命中禁止模式 | **BLOCK** |
| **美感推演** | `root_cause` 长度 `minLength: 10` | ❌ `"CPU"` 仅 3 字符 | **WARN** |

**最终判定**：`BLOCK` —— 语义层与安全层短路终止，不进入后续处理。

**错误详情**：
```
Found 4 error(s)

[SEMANTIC] Value "严重" is not defined in enum.
  Schema path: #/properties/alert_level/Enum
  Suggestion: 使用语义令牌 "status.critical" 替代

[SAFETY] Prohibited pattern "自动修复" detected in remediation[0].description.
  Rule: rules/safety/destructive.yaml
  Action: block

[SYNTAX] Float 1.5 exceeds maximum value of 1.
  Schema path: #/properties/confidence_score/Maximum

[AESTHETIC] String 'CPU' is less than minimum length of 10.
  Schema path: #/properties/root_cause/MinimumLength
```

---

## 五、运行时拦截：现场执法

### 5.1 React 组件层

```tsx
import { Button } from 'antd';
import { withIntentGuard } from '@intent-schema/runtime';

const DestructiveButton = withIntentGuard(Button, {
  intentId: 'alert-card-generation',
  action: 'execute_repair',
  semanticToken: 'status.critical'
});

// 使用
<DestructiveButton 
  onClick={handleRepair}
  humanConfirmed={userExplicitlyChecked}
/>
```

**拦截逻辑**：
- 如果 `actor_type === 'ai'` 且 `action` 在 `ai_prohibited` 列表中 → 渲染禁用态
- 如果 `humanConfirmed !== true` → 强制弹出二次确认弹窗

### 5.2 API 层

```javascript
// Express 中间件
app.use(apiGuardMiddleware());

// POST /api/v1/alerts/resolve
// 请求体缺少 human_confirmed
// 返回：
{
  "error": "INTENT_VIOLATION",
  "message": "AI 被禁止执行此操作",
  "required_action": "ESCALATE_TO_HUMAN",
  "human_mandatory": ["是否触发自动修复"]
}
```

### 5.3 LLM 工具层

```javascript
const tools = [
  {
    name: 'execute_repair',
    intentBinding: 'alert-card-generation',
    function: async (args) => { /* 实际修复逻辑 */ }
  }
];

const guardedTools = toolGuard(tools, policyStore);
// LLM 调用 guardedTools 时，若意图匹配 ai_prohibited → 返回 BLOCK
```

---

## 六、观测闭环：从漂移反哺到规则迭代

### 6.1 漂移事件采集

Bridge 采集到一条拦截事件：

```json
{
  "event_name": "semantic_drift_blocked",
  "timestamp": "2026-05-29T13:13:00Z",
  "intent_id": "AW-001",
  "drift_type": "synonym_substitution",
  "original_token": "status.critical",
  "llm_output": "严重",
  "constraint_rule_ref": "rules/synonym-mapping.yaml",
  "schema_version": "1.0.0"
}
```

### 6.2 归因分析

归因引擎定位根因：

```
根因：synonym_rule_too_loose
规则：rules/synonym-mapping.yaml#"严重"
建议：收紧 "严重" 的置信度阈值，或从 AW-001 的 allowed_contexts 中移除
```

### 6.3 自动反哺

Bridge 自动创建 Registry PR：

```yaml
# PR 标题：[Auto] 治理观测反哺：收紧 "严重" 同义词规则
# 修改内容：
synonym_mapping:
  - term: "严重"
    standard_token: "critical"
    allowed_contexts: ["AW-001"]  # ← 移除 AW-002
    confidence_threshold: 0.99     # ← 从 0.95 收紧
```

语义架构师审批 Merge 后，Compiler 自动重新编译产物，全链路约束更新。

---

## 七、全链路时序图

```
业务需求：P0 告警卡片
    │
    ▼
intent-schema-compiler（控制平面）
    ├── 语义层：定义 status.critical
    ├── 治理层：定义 ai_prohibited / human_mandatory
    └── 执行层：定义场景测试
    │
    ▼
Schema Compiler
    ├── 编译为 TS 类型定义
    ├── 编译为 JSON Schema
    ├── 编译为 ESLint 规则
    └── 编译为 OPA Policy
    │
    ▼
Four-Tier Validator（安检门）
    ├── 语法推演：结构完整性
    ├── 语义推演：令牌匹配
    ├── 安全推演：禁止模式
    └── 美感推演：文案长度
    │
    ▼
Governance Runtime（现场执法）
    ├── React HOC：组件渲染拦截
    ├── API 中间件：请求体校验
    └── LLM Tool Guard：工具调用拦截
    │
    ▼
Observability Bridge（监察反馈）
    ├── 采集漂移事件
    ├── 归因引擎定位规则漏洞
    └── 自动 PR 反哺控制平面
    │
    ▼
回到 intent-schema-compiler（闭环）
```

---

## 八、快速开始

### 8.1 阅读协议

```bash
# 克隆控制平面载体
git clone https://github.com/2436041978-ops/intent-schema-compiler

# 阅读三层协议
cat intent-schema-compiler/语义层/semantic-tokens.yaml
cat intent-schema-compiler/治理层/human-ai-boundary.yaml
cat intent-schema-compiler/执行层/scenario-tests.yaml
```

### 8.2 安装编译器（即将发布）

```bash
npm install -g @intent-schema/compiler

# 编译协议
intent-compile --registry ./intent-schema-compiler --output ./dist

# 校验输出
intent-validate --input ./mock-llm-output.json --intent AW-001
```

### 8.3 接入运行时（即将发布）

```bash
npm install @intent-schema/runtime

# React HOC
import { withIntentGuard } from '@intent-schema/runtime';
```

---

## 九、结语

告警卡片只是一个开始。当这套链路跑通后，任何业务场景都可以遵循同样的模式：

1. **定义**：在控制平面编写 YAML 意图协议
2. **编译**：通过 Compiler 生成各层可执行产物
3. **校验**：通过 Validator 四层推演拦截漂移
4. **拦截**：通过 Runtime 在运行时强制执行
5. **观测**：通过 Bridge 闭环反哺规则迭代

**从"人查清单"到"机器查清单"，从"文档里的文字"到"系统里的契约"**——这就是 Schema-As-Code 的端到端价值。

---

**相关文档**：
- 控制平面载体：https://github.com/2436041978-ops/intent-schema-compiler
- 架构设计方案：见语雀 📁01 架构契约
- 编译推演机制：见语雀 📁02 机制规范
- 节点实现详情：见语雀 📁03 节点实现
