# 沙盒域与豁免通道操作手册

> 在 Schema-As-Code 联邦自治架构中，**沙盒域（Sandbox）**与**豁免通道（Exemption）**不是两套独立机制，而是同一套意图协议的两种状态。本文定义其合二为一的 YAML 契约、状态流转与操作规范。

---

## 一、核心概念：合二为一

传统治理的误区是把"创新"和"例外"分开管理：
- **沙盒**：给新业务线一个"法外之地"，规则宽松，但无人兜底
- **豁免**：给紧急需求一个"临时特批"，人工审批，但无法追踪

在 Schema-As-Code 体系中，两者被统一为**意图协议的 `governance_status` 字段**：

| 状态 | 本质 | 规则严格度 | 审计要求 | 退出条件 |
|:---|:---|:---|:---|:---|
| `formal` | 正式域意图 | 100% 强制执行 | 全量 Trace | 无 |
| `sandbox` | 沙盒域意图 | 仅执行安全边界（P0） | 抽样审计 | 晋升或废弃 |
| `exemption` | 豁免实例 | 单点临时放行 | 强制留痕 | 自动过期 |

**关键设计**：`sandbox` 与 `exemption` 共享同一套 YAML Schema，仅在 `governance_status` 与 `ttl` 字段上区分。它们都是"正式域的例外"，但例外本身必须被协议化、版本化、可审计。

---

## 二、合二为一的 YAML 契约

### 2.1 沙盒域意图定义

```yaml
# 03-domain-autonomy/sandbox/alert-card-v2.experimental.yaml
intent_id: "AW-001-SB"
governance_status: "sandbox"          # 关键字段：沙盒状态
parent_intent: "AW-001"               # 继承正式域意图的不可变边界
semantic_domain: "observational"

sandbox_config:
  ttl: "30d"                          # 沙盒生命周期，到期自动冻结
  max_products: 3                       # 最多允许 3 个产品绑定试用
  skip_tiers: ["aesthetic"]             # 沙盒期跳过美感推演（降低门槛）
  enforce_tiers: ["syntax", "safety"]   # 安全边界不可跳过
  auto_promote_threshold:              # 自动晋升条件
    min_validation_pass_rate: 0.95
    min_days_in_sandbox: 14
    max_drift_events: 0

immutable_boundaries:                  # 继承自父意图，不可修改
  - boundary_type: "safety"
    rule_ref: "rules/safety/destructive.yaml"
    violation_action: "block"

experimental_boundaries:               # 沙盒内可自由迭代
  - boundary_type: "semantic"
    description: "尝试新的告警等级枚举"
    proposed_change:
      field: "alert_level"
      enum_add: ["P0-CRITICAL", "P1-HIGH"]   # 实验性扩展
      fallback_on_block: true               # 被阻时回退到父意图枚举
```

### 2.2 豁免通道实例定义

```yaml
# 03-domain-autonomy/exemption/EX-2026-0529-001.yaml
exemption_id: "EX-2026-0529-001"
governance_status: "exemption"
parent_intent: "AW-001"

exemption_config:
  ttl: "72h"                          # 豁免有效期，到期自动失效
  trigger: "emergency_release"       # 触发原因
  requester: "product-a-oncall"
  approver: "semantic-architect"      # 必须人工审批
  scope:
    product: "product-a"
    component: "AlertCard"
    rule_id: "SEM-001"               # 被豁免的具体规则

  # 豁免不是"无规则"，而是"替换规则"
  substitute_rule:
    original: "alert_level must be in enum [P0, P1, P2, P3]"
    temporary: "alert_level allowed: [P0, P1, P2, P3, '严重']"
    drift_monitoring: true             # 豁免期间仍采集漂移数据
    auto_rollback_on_drift: true       # 漂移超阈值时自动撤销豁免
```

### 2.3 统一 Schema（合二为一的核心）

```yaml
# 03-domain-autonomy/meta/sandbox-exemption-schema.yaml
$schema: "intent-schema-v1.0"
title: "Sandbox & Exemption Unified Schema"

definitions:
  governance_status:
    type: "string"
    enum: ["formal", "sandbox", "exemption"]
    description: "意图治理状态，三者共享同一套结构"

  base_fields:
    type: "object"
    required: ["intent_id", "governance_status", "parent_intent"]
    properties:
      intent_id: { type: "string", pattern: "^[A-Z]{2}-[0-9]{3}(-SB|-EX)?$" }
      governance_status: { $ref: "#/definitions/governance_status" }
      parent_intent: { type: "string" }
      immutable_boundaries:
        type: "array"
        items:
          type: "object"
          properties:
            boundary_type: { enum: ["safety", "compliance"] }
            violation_action: { enum: ["block", "escalate"] }
        description: "安全与合规边界在任何状态下都不可豁免"

  conditional_fields:
    type: "object"
    properties:
      # 当 governance_status == "sandbox" 时必填
      sandbox_config:
        type: "object"
        required: ["ttl", "enforce_tiers"]
        properties:
          ttl: { type: "string", pattern: "^[0-9]+d$" }
          skip_tiers: { type: "array", items: { enum: ["aesthetic", "semantic"] } }
          enforce_tiers: { type: "array", items: { enum: ["syntax", "semantic", "safety", "aesthetic"] } }
          auto_promote_threshold:
            type: "object"
            properties:
              min_validation_pass_rate: { type: "number", minimum: 0, maximum: 1 }
              min_days_in_sandbox: { type: "integer" }
              max_drift_events: { type: "integer" }

      # 当 governance_status == "exemption" 时必填
      exemption_config:
        type: "object"
        required: ["ttl", "trigger", "approver", "scope"]
        properties:
          ttl: { type: "string", pattern: "^[0-9]+h$" }
          trigger: { type: "string" }
          requester: { type: "string" }
          approver: { type: "string" }
          scope:
            type: "object"
            properties:
              product: { type: "string" }
              component: { type: "string" }
              rule_id: { type: "string" }
          substitute_rule:
            type: "object"
            properties:
              original: { type: "string" }
              temporary: { type: "string" }
              drift_monitoring: { type: "boolean" }
              auto_rollback_on_drift: { type: "boolean" }
```

---

## 三、状态流转：沙盒 ↔ 豁免 ↔ 正式

```
┌─────────────┐     实验验证      ┌─────────────┐     紧急审批      ┌─────────────┐
│   formal    │◄─────────────────│   sandbox   │◄─────────────────│  exemption  │
│   正式域     │   晋升 (PR Merge) │   沙盒域     │   降级 (冻结)    │   豁免实例   │
└─────────────┘                   └─────────────┘                   └─────────────┘
       │                                │                                │
       │ 废弃                           │ 过期自动冻结                    │ TTL 到期
       ▼                                ▼                                ▼
┌─────────────┐                   ┌─────────────┐                   ┌─────────────┐
│  archived   │                   │   frozen    │                   │   expired   │
│   归档      │                   │   冻结      │                   │   失效      │
└─────────────┘                   └─────────────┘                   └─────────────┘
```

### 3.1 沙盒 → 正式（晋升）

触发条件（需同时满足）：
1. `min_days_in_sandbox` ≥ 14 天
2. `min_validation_pass_rate` ≥ 95%
3. `max_drift_events` = 0
4. Intent Steward 人工审批通过

操作：
```bash
# 1. 提交晋升 PR
git mv sandbox/alert-card-v2.experimental.yaml formal/alert-card-v2.yaml

# 2. 修改 governance_status: "sandbox" → "formal"
# 3. 删除 sandbox_config 字段
# 4. 添加 version: "2.0.0" 与 changelog
# 5. 语义架构师 Merge → 触发 Compiler 全量编译
```

### 3.2 沙盒 → 豁免（紧急降级）

当沙盒意图在实验期间引发线上事故，可临时降级为豁免：

```yaml
# 操作：在沙盒 YAML 上叠加 exemption 补丁
exemption_override:
  source_sandbox: "AW-001-SB"
  reason: "线上 P0 事故，需临时回退语义枚举"
  ttl: "24h"
  substitute_rule:
    original: "enum_add: [P0-CRITICAL]"
    temporary: "revert to parent enum: [P0, P1, P2, P3]"
```

**关键**：豁免不是删除沙盒，而是给沙盒打"临时补丁"。补丁到期后，沙盒恢复原有实验规则。

### 3.3 豁免 → 正式（不可直接晋升）

**禁止豁免直接晋升正式域**。豁免的本质是"临时债务"，必须：
1. 先回到沙盒状态重新验证
2. 或废弃并修改正式域规则以覆盖该场景

---

## 四、Git 工作流：合二为一的操作手册

### 4.1 目录结构（单仓管理）

```
03-domain-autonomy/
├── formal/                    # 正式域意图（只读，Breaking Change 需审批）
├── sandbox/
│   └── active/                # 活跃沙盒
│   └── frozen/                # 过期/待清理沙盒
├── exemption/
│   └── active/                # 活跃豁免（TTL 倒计时）
│   └── expired/               # 已失效豁免（审计留痕）
└── meta/
    └── sandbox-exemption-schema.yaml   # 统一校验 Schema
```

### 4.2 创建沙盒（日常操作）

```bash
# 1. 从正式域 Fork
# 2. 修改 governance_status 与 sandbox_config
# 3. 提交 PR 到 sandbox/active/

# PR 模板（必须填写）
```
```yaml
pr_type: "sandbox_creation"
parent_intent: "AW-001"
proposed_change: "扩展告警等级枚举，增加 P0-CRITICAL"
risk_level: "semantic"                    # 仅语义层，不涉及安全
rollback_plan: "删除 sandbox/AW-001-SB.yaml，回退到父意图"
```
```

### 4.3 申请豁免（紧急操作）

```bash
# 1. 在 exemption/active/ 新建 YAML
# 2. 必须包含 approver 字段（语义架构师）
# 3. 提交 PR，标题前缀 [EXEMPTION]

# PR 模板（必须填写）
```
```yaml
pr_type: "exemption_request"
exemption_id: "EX-2026-0529-001"
urgency: "P0"                             # P0/P1/P2
trigger: "线上事故-告警等级误判"
root_cause: "LLM 输出 '严重' 被 sandbox 接受，但正式域拦截"
mitigation: "临时放行 '严重'，同时修复 LLM Prompt"
ttl: "24h"
```
```

### 4.4 自动化清理（CI 定时任务）

```yaml
# .github/workflows/sandbox-exemption-cleanup.yml
name: Sandbox & Exemption Cleanup
on:
  schedule:
    - cron: '0 0 * * *'    # 每日凌晨

jobs:
  cleanup:
    steps:
      - name: Freeze Expired Sandboxes
        run: |
          find sandbox/active/ -name "*.yaml" -exec             sh -c 'ttl=$(yq ".sandbox_config.ttl" "$1");                    created=$(git log --follow --format=%at -- "$1" | tail -1);                    now=$(date +%s);                    elapsed=$(( (now - created) / 86400 ));                    if [ "$elapsed" -ge "${ttl%d}" ]; then                      git mv "$1" "sandbox/frozen/$(basename $1)";                    fi' _ {} \;

      - name: Expire Exemptions
        run: |
          find exemption/active/ -name "*.yaml" -exec             sh -c 'ttl=$(yq ".exemption_config.ttl" "$1");                    created=$(yq ".exemption_config.created_at" "$1");                    # 类似计算，到期移入 expired/' _ {} \;

      - name: Auto-promote Qualified Sandboxes
        run: |
          # 检查 auto_promote_threshold 条件
          # 满足则自动创建晋升 PR
```

---

## 五、与五模块的集成

| 模块 | 对沙盒/豁免的支持 |
|:---|:---|
| **Registry** | 版本管理区分 `formal`/`sandbox`/`exemption`，影响面分析时标记沙盒依赖 |
| **Compiler** | 沙盒意图编译时跳过 `skip_tiers`，豁免意图编译时注入 `substitute_rule` |
| **Validator** | 沙盒输入执行精简版四层推演（跳过 aesthetic），豁免输入执行原始规则 + 补丁规则双轨校验 |
| **Runtime** | 沙盒组件渲染时显示 `sandbox-badge`，豁免组件渲染时显示 `exemption-countdown` |
| **Bridge** | 沙盒漂移事件计入 `auto_promote_threshold`，豁免漂移事件触发 `auto_rollback_on_drift` |

---

## 六、结语：例外本身必须被治理

沙盒域与豁免通道合二为一的核心哲学是：**"例外"不是治理的反面，而是治理的一种状态。**

当沙盒意图以 YAML 形态存在于 Git 中时，它获得了与正式域相同的属性：
- **Diff 可见**：谁创建了什么实验，何时到期
- **引用闭环**：沙盒继承父意图的安全边界，不能凭空发明
- **审计留痕**：豁免不是口头特批，而是带 TTL 的代码化契约
- **自动清理**：到期冻结、条件晋升、漂移回滚——无需人肉巡检

**合二为一，不是简化流程，而是把"例外"纳入协议。**

