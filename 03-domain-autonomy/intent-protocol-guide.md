# 意图协议编写指南

> 面向 Intent Steward、域级架构师、前端/AI 工程师的 Schema-As-Code 协议编写手册。

## 一、什么是意图协议

意图协议（Intent Protocol）是 Schema-As-Code 体系中的**最小治理单元**，它以 YAML 文件形式声明一个业务场景下的语义边界、治理规则与验证场景。

### 1.1 意图协议的三层抽象

| 层级 | 回答的问题 | 文件形态 | 编写者 |
|------|-----------|---------|--------|
| **语义层** | "这个场景应该有什么语义？" | `semantic-tokens.yaml` + `intent-contracts.yaml` | 设计师 + 语义架构师 |
| **治理层** | "什么绝对不能突破？" | `prompt-constraints.yaml` + `response-schema.yaml` + `human-ai-boundary.yaml` | 安全/合规工程师 + 域架构师 |
| **执行层** | "怎么证明规则有效？" | `scenario-tests.yaml` | QA + 测试工程师 |

### 1.2 意图协议的文件组织

每个意图协议以**目录**为单位组织，目录名采用 `kebab-case`：

```
intent-schema-compiler/
├── 语义层/
│   ├── status-tokens.yaml              # 状态类语义令牌
│   ├── action-tokens.yaml              # 操作类语义令牌
│   └── intent-contracts.yaml           # 意图契约注册表
├── 治理层/
│   ├── alert-response-schema.yaml      # 告警场景输出约束
│   ├── destructive-action-boundary.yaml # 高危操作边界
│   └── prompt-constraints.yaml         # Prompt 注入约束
└── 执行层/
    └── alert-scenario-tests.yaml       # 告警场景测试
```

> **原则**：一个目录 = 一个完整的意图治理域。不要在一个 YAML 里混写不同场景的语义。

---

## 二、语义层编写规范

### 2.1 语义令牌（Semantic Token）

语义令牌是**业务语义到系统标识的映射单元**，采用 `{domain}.{category}.{name}` 三段式命名。

#### 命名规范

```yaml
# ✅ 正确
status.critical          # 状态域-告警等级-严重
action.destructive       # 操作域-行为类型-破坏性
interaction.confirm      # 交互域-行为类型-确认

# ❌ 错误
critical                 # 缺少域和分类，易冲突
red-color                # 描述视觉而非语义
alertLevel               # 使用 camelCase，应为 snake_case
```

#### 最小完整结构

```yaml
# 语义层/status-tokens.yaml
semantic_tokens:
  status.critical:
    canonical_id: "ST-001"              # 全局唯一标识，不可变更
    version: "1.0.0"                    # 首次发布版本
    immutable: true                      # 标记不可变，变更必须发新版本
    description: "系统级故障，需立即响应"  # 人类可读的语义定义

    visual_mapping:                      # 视觉层绑定（可选）
      color_token: "status.critical"
      motion_token: "pulse.red.urgent"
      sound_token: "alert.high"

    llm_constraints:                     # LLM 生成约束（可选）
      - "生成内容必须包含明确的故障定位信息"
      - "禁止提供未经验证的修复建议"
      - "必须附带人工升级路径"

    synonym_firewall:                    # 同义词防火墙（可选）
      prohibited:
        - term: "严重"
          confidence_threshold: 0.95
          allowed_contexts: ["AW-001", "AW-002"]
        - term: "紧急"
          confidence_threshold: 0.90
          allowed_contexts: ["AW-001"]
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `canonical_id` | string | 是 | 全局唯一标识，格式 `{大写字母}-{数字}`，如 `ST-001` |
| `version` | string | 是 | 语义版本号，遵循 SemVer，如 `1.0.0` |
| `immutable` | boolean | 否 | 标记该令牌是否不可变。`true` 表示发布后冻结，变更必须发新版本 |
| `description` | string | 是 | 人类可读的语义定义，50 字以内 |
| `visual_mapping` | object | 否 | 绑定到 Design Token 的映射关系 |
| `llm_constraints` | array | 否 | 针对 LLM 输出的约束文本列表，会被 Compiler 注入 Prompt |
| `synonym_firewall` | object | 否 | 防止 LLM 用自然语言替代结构化令牌 |

### 2.2 意图契约（Intent Contract）

意图契约是**场景级的语义宪法**，定义该场景下的不可变边界与违规动作。

```yaml
# 语义层/intent-contracts.yaml
intent_contracts:
  destructive-action:
    intent_id: "IC-003"                  # 意图唯一标识
    semantic_domain: "transactional"      # 语义域：cognitive / interactive / transactional / observational
    version: "1.0.0"

    semantic_tokens:                      # 引用的语义令牌（引用闭环起点）
      - "status.critical"
      - "action.destructive"

    immutable_boundaries:                 # 不可变边界列表
      - boundary_type: "safety"           # 边界类型：semantic / safety / aesthetic / compliance
        constraint_rule_ref: "rules/safety/destructive.yaml"
        violation_action: "block"          # 违规动作：block / escalate / fallback

      - boundary_type: "compliance"
        constraint_rule_ref: "rules/compliance/alert-level.yaml"
        violation_action: "escalate"
```

#### 语义域枚举

| 语义域 | 说明 | 典型场景 |
|--------|------|---------|
| `cognitive` | 认知型 | 信息展示、状态告知、数据可视化 |
| `interactive` | 交互型 | 表单填写、按钮操作、导航跳转 |
| `transactional` | 交易型 | 支付、删除、修改、高危操作 |
| `observational` | 观测型 | 监控、告警、日志、诊断 |

---

## 三、治理层编写规范

### 3.1 人机边界（Human-AI Boundary）

人机边界定义**AI 能做什么、不能做什么、什么必须由人决策**。

```yaml
# 治理层/human-ai-boundary.yaml
human_ai_boundary:
  destructive-action:                    # 与意图契约 ID 对应
    intent_id: "IC-003"

    human_mandatory:                      # 必须由人决策（AI 只能辅助，不能替代）
      - "告警等级判定（P0/P1/P2/P3）"
      - "是否触发自动修复（destructive 操作确认）"
      - "升级路径选择（值班工程师 / 自动工单）"

    ai_assisted:                            # AI 可以辅助生成（需人工审核后采用）
      - "根因分析文本生成"
      - "修复建议列表生成"
      - "影响面描述生成"

    ai_prohibited:                          # AI 绝对禁止（红线）
      - "直接执行修复操作"
      - "修改告警阈值配置"
      - "关闭或忽略告警"
      - "POST:/api/v1/destructive"          # 从 API 契约自动提取的路径
```

#### 权限矩阵速查

| Actor 类型 | `human_mandatory` | `ai_assisted` | `ai_prohibited` |
|-----------|-------------------|---------------|-----------------|
| `human` | 必须人工确认 | 可选采用 | 触发审计日志 |
| `human_via_ai` | 强制二次确认 | 建议 + 高亮 | 阻断 |
| `ai` | 阻断 | 阻断 | 阻断 |

### 3.2 Prompt 约束（Prompt Constraints）

Prompt 约束不是 Prompt Engineering，而是**契约注入**——把不可变边界编译进 LLM 的输入。

```yaml
# 治理层/prompt-constraints.yaml
prompt_constraints:
  rule_id: "IC-PROMPT-001"
  intent_binding: "AW-001"

  injection_strategy:
    type: "schema_prefix"                   # 注入位置：schema_prefix / system_message / user_message
    position: "system_message"             # 在 system message 前缀位置注入

  constraints:
    - constraint_id: "C-001"
      description: "语义令牌锁定"
      mechanism: |
        在 Prompt 的 system 消息中注入当前意图契约绑定的语义令牌列表。
        生成内容时，必须从 semantic-tokens.yaml 中定义的令牌集合中选择，
        禁止自行发明新的语义描述。
      example: |
        "你必须使用 status.critical 语义令牌描述系统故障状态，
         禁止使用'严重'/'紧急'等自然语言同义词替代。"

    - constraint_id: "C-002"
      description: "输出结构锁定"
      mechanism: "注入 JSON Schema 片段，要求输出必须符合定义的结构"
      example: |
        "你的响应必须包含以下字段：root_cause(字符串)、
         confidence_score(0-1浮点数)、remediation(对象数组)。
         禁止添加未定义字段。"

    - constraint_id: "C-003"
      description: "安全边界锁定"
      mechanism: "对于 destructive 类操作意图，强制注入负向约束"
      example: |
        "当前意图涉及不可逆操作。你不得生成任何可被直接执行的
         代码/命令/API 调用。你只能提供操作建议和确认流程。"

  violation_detection:
    method: "output_schema_validation"
    fallback: "block_and_escalate"          # 校验失败：阻断交付 + 升级人工
```

### 3.3 Response Schema（输出安检门）

Response Schema 定义 LLM 输出"必须有什么"和"绝对不能有什么"。

```yaml
# 治理层/response-schema.yaml
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

---

## 四、执行层编写规范

### 4.1 场景测试（Scenario Tests）

每条治理规则必须附带**可验证的场景测试**，证明规则在真实输入下的行为。

```yaml
# 执行层/scenario-tests.yaml
scenario_tests:
  - test_id: "T-P0-001"
    test_name: "P0 告警生成与校验闭环"
    intent_binding: "AW-001"

    happy_path:                              # 正常路径：必须 PASS
      input:
        alert_source: "CPU_USAGE"
        threshold_breach: 95
      expected: "PASS"

    edge_cases:                              # 边界情况：必须按预期拦截
      - case: "同义词替代"
        description: "LLM 用'严重'替代 status.critical"
        mock_response:
          alert_level: "严重"
          root_cause: "CPU 使用率超过阈值，导致服务响应延迟"
          confidence_score: 0.85
        expected_validation: "BLOCK — 语义推演失败，命中同义词黑名单"

      - case: "自动执行建议"
        description: "LLM 建议自动修复，违反安全边界"
        mock_response:
          alert_level: "P0"
          root_cause: "CPU 使用率超过阈值，导致服务响应延迟"
          confidence_score: 0.85
          remediation:
            - action_type: "automated"
              description: "自动执行修复脚本"
              risk_level: "critical"
        expected_validation: "BLOCK — 安全推演失败，命中禁止模式'自动执行'"

      - case: "置信度不足"
        description: "LLM 置信度低于阈值，触发降级策略"
        mock_response:
          alert_level: "P0"
          root_cause: "CPU 使用率超过阈值，导致服务响应延迟"
          confidence_score: 0.5
        expected_validation: "ESCALATE — 触发降级策略，需人工复核"

      - case: "结构缺失"
        description: "LLM 输出缺少必填字段 root_cause"
        mock_response:
          alert_level: "P0"
          confidence_score: 0.85
        expected_validation: "BLOCK — 语法推演失败，缺少必填字段 root_cause"

    fallback_tests:                          # 降级策略测试
      - case: "校验失败后的降级"
        description: "四层推演全部失败后，系统应阻断并升级人工"
        expected_action: "block_and_escalate"
        expected_escalation_target: "oncall_engineer"
```

#### 测试覆盖要求

| 规则类型 | 必须包含的测试 | 说明 |
|---------|--------------|------|
| 新增语义令牌 | 1 个 Happy Path + 2 个 Edge Case | 验证令牌匹配与黑名单 |
| 新增安全边界 | 1 个 Happy Path + 3 个 Edge Case | 验证禁止模式、人机边界、降级策略 |
| 修改现有规则 | 1 个回归测试 + 增量 Edge Case | 确保不破坏已有场景 |
| 删除规则 | 1 个负向测试 | 验证该场景不再被拦截 |

---

## 五、引用闭环规范

### 5.1 四层引用关系

意图协议通过显式引用形成**可验证的闭环**：

```
意图契约 (intent-contracts.yaml)
    │
    ├── 引用语义令牌 (semantic-tokens.yaml) ──► canonical_id
    │
    ├── 引用约束规则 (prompt-constraints.yaml / response-schema.yaml) ──► rule_id
    │
    └── 被场景测试引用 (scenario-tests.yaml) ──► intent_binding
```

### 5.2 引用完整性检查

Compiler 在阶段 1（语义解析）时执行引用校验：

| 检查项 | 错误类型 | 示例 |
|--------|---------|------|
| 意图契约引用了不存在的语义令牌 | `SEMANTIC_RESOLUTION_ERROR` | `semantic_tokens: ["status.unknown"]` |
| 约束规则引用了不存在的意图契约 | `INTENT_BINDING_ERROR` | `intent_binding: "AW-999"` |
| 场景测试缺少 Happy Path | `TEST_COVERAGE_ERROR` | 只有 edge_cases，无 happy_path |
| 同义词防火墙的 `allowed_contexts` 包含不存在的意图 ID | `CONTEXT_RESOLUTION_ERROR` | `allowed_contexts: ["AW-999"]` |

---

## 六、版本管理与不可变性

### 6.1 不可变令牌（Immutable Tokens）

标记 `immutable: true` 的语义令牌，发布后**冻结**：

```yaml
# ✅ 正确：immutable 令牌变更时发新版本
status.critical:
  version: "1.0.0"          # 原始版本，冻结
  immutable: true

# 变更时创建新令牌
status.critical.v2:
  version: "2.0.0"          # 新版本，独立存在
  immutable: true
  description: "系统级故障，需立即响应（v2 增加音效约束）"
```

### 6.2 版本兼容性规则

| 变更类型 | 版本号变化 | 兼容性 | 下游影响 |
|---------|-----------|--------|---------|
| 新增语义令牌 | `x.Y.0`（Minor） | 向后兼容 | 自动分发，无需下游更新 |
| 收紧同义词防火墙 | `x.Y.0`（Minor） | 向后兼容 | 自动热更新 |
| 修改 immutable 令牌 | `X.0.0`（Major） | **Breaking Change** | 下游必须手动升级绑定 |
| 删除意图契约 | `X.0.0`（Major） | **Breaking Change** | 必须提前 2 个版本 deprecation |

### 6.3 Breaking Change 处理流程

1. 在旧版本中标记 `deprecation: true`，并给出迁移指引
2. 通知所有绑定该意图的产品（通过 Registry 影响面分析）
3. 给予 2 个版本的迁移窗口期
4. 发布新版本，旧版本进入只读冻结

---

## 七、常见错误与最佳实践

### 7.1 常见错误

| 错误 | 示例 | 修正 |
|------|------|------|
| **语义令牌命名不规范** | `redColor` / `alert-level` | `status.critical`（三段式，snake_case） |
| **缺少 canonical_id** | 直接写 `status.critical` 无 ID | 补充 `canonical_id: "ST-001"` |
| **同义词防火墙过松** | `confidence_threshold: 0.3` | 提高到 `0.95`，减少误放行 |
| **边界类型混用** | 把 `aesthetic` 边界标记为 `safety` | 按实际影响选择正确的 `boundary_type` |
| **测试缺少降级策略** | 只有 PASS/FAIL，无 ESCALATE | 补充 `fallback_tests` |
| **引用断裂** | 意图契约引用了已删除的语义令牌 | 每次删除前执行影响面分析 |

### 7.2 最佳实践

1. **语义令牌优先**：先定义语义令牌，再写意图契约，最后写治理规则——避免无根约束
2. **最小权限原则**：`ai_prohibited` 默认全部禁止，`ai_assisted` 逐项开放
3. **测试驱动立法**：新增规则前，先写 `scenario-tests.yaml` 的 Edge Case，确保规则可验证
4. **版本即承诺**：发布 `immutable: true` 前，确保语义定义经过评审，因为发布后冻结
5. **文档即代码**：所有 YAML 变更走 Git PR Review，禁止直接 push 到 main

---

## 八、快速开始模板

### 8.1 新建一个意图协议（复制即用）

```yaml
# === 语义层 ===
# 语义层/my-intent-tokens.yaml
semantic_tokens:
  my_domain.my_token:
    canonical_id: "MD-001"
    version: "1.0.0"
    immutable: false                      # 首次发布可设为 false，成熟后改为 true
    description: "描述这个令牌的业务语义"
    llm_constraints:
      - "约束文本 1"
      - "约束文本 2"

# === 治理层 ===
# 治理层/my-intent-boundary.yaml
human_ai_boundary:
  my-intent:
    intent_id: "IC-001"
    human_mandatory: []
    ai_assisted: []
    ai_prohibited: []

# === 执行层 ===
# 执行层/my-intent-tests.yaml
scenario_tests:
  - test_id: "T-001"
    intent_binding: "IC-001"
    happy_path:
      input: {}
      expected: "PASS"
    edge_cases: []
```

### 8.2 检查清单（发布前）

- [ ] 语义令牌有 `canonical_id` 和 `version`
- [ ] 意图契约引用了存在的语义令牌
- [ ] 治理规则有对应的场景测试（至少 1 Happy + 2 Edge）
- [ ] `immutable: true` 的令牌已确认冻结
- [ ] 所有 YAML 通过 `yamllint` 语法校验
- [ ] Git PR 已提交，等待 Intent Steward 审批

---

## 九、附录

### 9.1 术语速查

| 术语 | 说明 |
|------|------|
| **Intent Protocol** | 意图协议，一个业务场景的完整语义治理单元 |
| **Semantic Token** | 语义令牌，业务语义到系统标识的映射 |
| **Intent Contract** | 意图契约，场景级的语义宪法 |
| **Canonical ID** | 全局唯一标识，不可变更 |
| **Immutable** | 不可变标记，发布后冻结 |
| **Synonym Firewall** | 同义词防火墙，防止 LLM 漂移 |
| **Human-AI Boundary** | 人机边界，定义 AI 能做什么、不能做什么 |
| **Scenario Test** | 场景测试，验证规则在真实输入下的行为 |

### 9.2 参考链接

- 控制平面载体：https://github.com/2436041978-ops/intent-schema-compiler
- 完整架构仓库：`schema-as-code`（Monorepo，即将发布）
- 语雀知识库：https://www.yuque.com/u222739/draddi

---

> **文档版本**：v1.0  
> **维护者**：Schema-As-Code 联邦自治委员会  
> **最后更新**：2026-05-29
