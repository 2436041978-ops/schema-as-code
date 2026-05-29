# 域级规则立法指南

> 面向：Intent Steward + 域 TL  
> 定位：在联邦自治架构下，各业务域如何制定、发布、迭代自己的意图规则，同时遵守联邦元规则。

---

## 一、立法定位：联邦宪法 vs 域级法规

在 Schema-As-Code 联邦自治体系中，规则分为两层：

| 层级 | 文件 | 制定方 | 约束范围 | 变更频率 |
|------|------|--------|----------|----------|
| **联邦宪法** | `intent-schema-compiler` 控制平面 | 联邦治理委员会 | 全组织通用语义、跨域不可变边界 | 低 |
| **域级法规** | `schema-as-code/{domain}/` | Intent Steward + 域 TL | 本业务域特定场景、豁免策略 | 高 |

**核心原则**：
- 联邦宪法定义**不可变边界**（如 `status.critical` 的语义、高危操作的 `ai_prohibited`）
- 域级法规在宪法框架内，定义**场景细化规则**（如本域的告警阈值、特定的同义词映射、沙盒豁免）

---

## 二、立法权限边界

### 2.1 联邦保留事项（禁止域级立法）

以下规则必须由联邦治理委员会统一制定，各域无权修改：

- **语义令牌定义**：`status.critical`、`action.destructive` 等全局语义 ID
- **人机边界红线**：`ai_prohibited` 中的跨域高危操作（如资金转账、数据删除）
- **安全基线**：`violation_action: block` 的强制拦截项
- **版本契约**：语义协议的 SemVer 规范

### 2.2 域级自治事项（允许域级立法）

以下规则可由各域在联邦框架内自行制定：

- **场景绑定**：本域组件绑定哪些意图契约（`bindings/{domain}.yaml`）
- **阈值细化**：本域的 `confidence_threshold` 调整（如金融域要求 0.99，内部工具域允许 0.85）
- **同义词扩展**：本域特有的业务术语映射（如医疗域的"危急值"映射到 `status.critical`）
- **沙盒豁免**：本域实验性功能的临时豁免策略（需标注过期时间）
- **美感规则**：本域的文案长度、信息密度阈值（如 C 端域要求更短文案）

---

## 三、立法流程：五步法

```
提案(Propose) → 评审(Review) → 发布(Publish) → 执行(Enforce) → 迭代(Iterate)
```

### Step 1：提案（Propose）

Intent Steward 在域级仓库创建 `proposal/{rule-id}.yaml`：

```yaml
# proposal/FD-001.yaml
proposal_id: "FD-001"
domain: "fintech"
proposer: "steward@fintech.com"
date: "2026-05-29"

rule_type: "synonym_extension"  # 规则类型：同义词扩展

motivation: |
  金融域用户习惯使用"爆仓"描述系统级故障，
  需要将其映射到 status.critical 语义令牌。

rule_definition:
  synonym_mapping:
    - term: "爆仓"
      standard_token: "status.critical"
      allowed_contexts: ["FT-001", "FT-002"]  # 仅在本域意图契约生效
      confidence_threshold: 0.95

impact_analysis:
  affected_components: ["RiskAlertCard", "PositionMonitor"]
  breaking_change: false
  rollback_plan: "删除本条同义词映射即可回滚"
```

### Step 2：评审（Review）

评审由域内技术委员会 + 联邦治理委员会代表共同完成：

| 评审项 | 通过标准 | 评审方 |
|--------|----------|--------|
| 联邦合规性 | 不违反联邦宪法中的 `immutable_boundaries` | 联邦代表 |
| 语义一致性 | 不与其他域的同义词定义冲突 | 跨域 Steward |
| 技术可行性 | 可被 Compiler 正常编译为约束产物 | 平台团队 |
| 影响面可控 | 仅影响本域绑定的组件，不波及其他域 | 域 TL |

评审通过标记：
```yaml
review:
  status: "approved"
  reviewers: ["federal-rep", "domain-tl"]
  approved_at: "2026-05-30"
  expires_at: "2026-11-30"  # 沙盒规则需标注过期时间
```

### Step 3：发布（Publish）

评审通过后，规则合并到域级正式目录：

```
schema-as-code/
└── domains/
    └── fintech/
        ├── domain-manifest.yaml      # 域级宣言
        ├── bindings/                 # 本域意图绑定
        ├── rules/                    # 域级规则
        │   └── synonym-extensions.yaml
        └── exemptions/               # 沙盒豁免（如有）
```

### Step 4：执行（Enforce）

Compiler 在编译时自动合并联邦宪法 + 域级法规：

```
联邦语义层 (status.critical)
    │
    ├── 联邦同义词防火墙 ("严重" → critical)
    │
    └── 域级扩展同义词 ("爆仓" → critical)  ← 域级法规注入
```

Validator 四层推演时，同时校验联邦规则 + 域级规则。

### Step 5：迭代（Iterate）

域级规则需定期复审：

- **标准规则**：每季度评审一次，确认是否需升级至联邦宪法
- **沙盒豁免**：到期前 7 天自动提醒，过期未续期则自动失效
- **废弃规则**：标记 `deprecated: true`，保留 1 个 Major 版本后删除

---

## 四、规则格式规范

### 4.1 域级宣言文件（domain-manifest.yaml）

每个域必须有一份宣言，声明本域的自治范围：

```yaml
# domains/{domain}/domain-manifest.yaml
domain_id: "fintech"
domain_name: "金融域"

federal_alignment:
  registry_version: "v1.2.0"           # 本域遵循的联邦宪法版本
  compliance_level: "full"             # full / partial / sandbox

autonomy_scope:
  can_extend_synonyms: true            # 允许扩展同义词
  can_adjust_thresholds: true          # 允许调整阈值
  can_define_exemptions: true          # 允许定义沙盒豁免
  can_modify_immutable: false          # 禁止修改联邦不可变边界

steward:
  name: "张三"
  contact: "steward@fintech.com"
  appointed_at: "2026-01-15"

review_board:
  - "domain-tl"
  - "federal-rep"
```

### 4.2 域级规则文件（rules/*.yaml）

域级规则必须显式引用联邦宪法，避免隐性覆盖：

```yaml
# domains/fintech/rules/synonym-extensions.yaml
rule_id: "FD-SE-001"
domain: "fintech"
federal_reference: "semantic_tokens.status.critical"  # 必须引用联邦源规则
rule_type: "synonym_extension"

extensions:
  - term: "爆仓"
    standard_token: "status.critical"
    allowed_contexts: ["FT-001"]
    confidence_threshold: 0.95
    rationale: "金融用户常用术语"

  - term: "穿仓"
    standard_token: "status.critical"
    allowed_contexts: ["FT-001", "FT-003"]
    confidence_threshold: 0.95

metadata:
  created_at: "2026-05-29"
  expires_at: "2027-05-29"
  steward: "张三"
```

### 4.3 沙盒豁免文件（exemptions/*.yaml）

临时豁免必须标注严格的时空边界：

```yaml
# domains/fintech/exemptions/sandbox-001.yaml
exemption_id: "FE-001"
domain: "fintech"

federal_rule: "human-ai-boundary.destructive-action.ai_prohibited"
exemption_type: "temporary_sandbox"

scope:
  affected_intents: ["FT-EXPERIMENTAL-001"]
  affected_environments: ["staging"]
  start_time: "2026-06-01T00:00:00Z"
  end_time: "2026-08-31T23:59:59Z"

justification: |
  实验性功能"智能止损"需要在 staging 环境验证 AI 自动执行的可靠性，
  临时豁免 3 个月，到期后根据评估结果决定是否转正或下线。

conditions:
  max_daily_invocations: 100
  requires_human_audit_log: true
  rollback_on_incident: true

approvers:
  - "domain-tl"
  - "federal-security-rep"
```

---

## 五、与联邦控制平面的同步机制

### 5.1 单向依赖原则

域级法规**单向依赖**联邦宪法，联邦宪法**不依赖**域级法规：

```
联邦控制平面 (intent-schema-compiler)
    │
    ├── 语义层 ────────┐
    ├── 治理层 ────────┼──► 域级 Compiler 读取并合并
    └── 执行层 ────────┘
                              │
                              ▼
                    domains/fintech/rules/
                        域级规则注入
```

### 5.2 合并优先级

当联邦规则与域级规则冲突时，按以下优先级执行：

1. **联邦不可变边界**（最高优先级，不可覆盖）
2. **联邦标准规则**
3. **域级标准规则**
4. **域级沙盒豁免**（最低优先级，临时生效）

冲突检测由 Compiler 在编译阶段自动完成，冲突时阻断编译并告警。

### 5.3 向上反哺机制

域级规则运行成熟后，可申请"进贡"至联邦宪法：

```yaml
# 域级规则中的进贡标记
metadata:
  maturity: "stable"          # experimental / beta / stable
  upstream_candidate: true    # 申请进入联邦宪法
  upstream_issue: "https://github.com/.../issues/123"
```

联邦治理委员会每季度评审一次 `upstream_candidate`，通过的规则在下一 Major 版本纳入联邦宪法。

---

## 六、完整示例：金融域意图规则立法

### 6.1 背景

金融域需要处理"风险告警"场景，用户习惯使用"爆仓""穿仓"等术语，且对置信度要求极高。

### 6.2 立法文件

**文件 1：域级宣言**

```yaml
# domains/fintech/domain-manifest.yaml
domain_id: "fintech"
domain_name: "金融交易域"
federal_alignment:
  registry_version: "v1.2.0"
  compliance_level: "full"
autonomy_scope:
  can_extend_synonyms: true
  can_adjust_thresholds: true
  can_define_exemptions: false
steward:
  name: "张三"
  contact: "steward@fintech.com"
```

**文件 2：同义词扩展规则**

```yaml
# domains/fintech/rules/synonym-extensions.yaml
rule_id: "FD-SE-001"
domain: "fintech"
federal_reference: "semantic_tokens.status.critical"
rule_type: "synonym_extension"

extensions:
  - term: "爆仓"
    standard_token: "status.critical"
    allowed_contexts: ["FT-RISK-001"]
    confidence_threshold: 0.99
    rationale: "金融用户常用术语，需高置信度匹配"

  - term: "穿仓"
    standard_token: "status.critical"
    allowed_contexts: ["FT-RISK-001", "FT-RISK-002"]
    confidence_threshold: 0.99
```

**文件 3：阈值调整规则**

```yaml
# domains/fintech/rules/threshold-adjustments.yaml
rule_id: "FD-TA-001"
domain: "fintech"
federal_reference: "human-ai-boundary.destructive-action"
rule_type: "threshold_adjustment"

adjustments:
  - target: "confidence_threshold"
    original_value: 0.95
    adjusted_value: 0.99
    rationale: "金融域对 AI 决策容错率极低"
    affected_intents: ["FT-RISK-001"]
```

**文件 4：组件绑定配置**

```yaml
# domains/fintech/bindings/risk-alert-binding.yaml
domain: "fintech"
product: "risk-monitor"
components:
  - component_name: "RiskAlertCard"
    intent_contract: "FT-RISK-001"
    semantic_tokens:
      - "status.critical"
      - "status.warning"
    runtime_guards:
      - type: "react-hoc"
        implementation: "withIntentGuard"
      - type: "api-middleware"
        required_fields: ["human_confirmed", "risk_level"]
```

### 6.3 编译产物

Compiler 合并联邦宪法 + 域级法规后，生成金融域专用约束产物：

```typescript
// dist/fintech/v1.0.0/components/RiskAlertCard.types.ts
export interface RiskAlertCardProps {
  intentContract: 'FT-RISK-001';
  alertLevel: 'status.critical' | 'status.warning';  // 联邦枚举
  riskDescription: string;                           // 域级要求：允许"爆仓""穿仓"
  humanConfirmed: boolean;                          // 联邦强制
  confidenceScore: number;                          // 域级调整：必须 ≥ 0.99
}
```

---

## 七、常见错误与规避

| 错误 | 案例 | 后果 | 规避方法 |
|------|------|------|----------|
| **隐性覆盖** | 域级规则未显式引用 `federal_reference`，导致语义漂移 | 联邦规则被静默覆盖，跨域一致性破坏 | 所有域级规则必须标注 `federal_reference` |
| **阈值竞赛** | A 域调低阈值，B 域被迫跟进，最终全组织阈值失效 | 安全基线被击穿 | 阈值调整需联邦安全代表审批 |
| **沙盒逃逸** | 临时豁免未设过期时间，长期运行 | 实验规则污染生产环境 | 强制要求 `expires_at`，过期自动失效 |
| **同义词污染** | 域级同义词未限定 `allowed_contexts`，全局生效 | 医疗域的"危急值"映射到金融域 | 严格限定 `allowed_contexts` 为本域意图契约 |

---

## 八、检查清单：域级立法自检

在提交域级规则 PR 前，Intent Steward 必须确认：

- [ ] 所有规则标注了 `federal_reference`
- [ ] 未修改联邦 `immutable: true` 的语义令牌
- [ ] 同义词映射限定了 `allowed_contexts`
- [ ] 沙盒豁免设置了 `expires_at`
- [ ] 影响面分析覆盖了本域所有绑定组件
- [ ] 评审通过 `federal-rep` 签字
- [ ] `domain-manifest.yaml` 中的 `registry_version` 为最新

---

## 附录：联邦元规则清单（速查）

| 元规则 ID | 规则内容 | 违反后果 |
|-----------|----------|----------|
| FR-001 | 禁止修改联邦不可变语义令牌 | 编译阻断 |
| FR-002 | 禁止全局生效的同义词映射（必须限定 `allowed_contexts`） | 编译阻断 |
| FR-003 | 沙盒豁免必须设置过期时间（≤ 90 天） | 编译警告，超期失效 |
| FR-004 | 域级规则必须显式引用联邦源规则 | 编译阻断 |
| FR-005 | 阈值调整不得低于联邦安全基线 | 需联邦安全代表特批 |

---

> **下一篇关联**：域级规则立法完成后，需通过《Intent Steward 手册》培训各域执行者，并通过《沙盒域与豁免通道操作手册》管理实验性规则的生命周期。
