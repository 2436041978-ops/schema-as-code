# Phase 1：语义锚定——联邦宪法与试点域

> 联邦自治的第一阶段。目标：在 1-2 个核心产品内建立意图协议的"最小可行单元"，让组织第一次体验到"约束从隐性变为显性"的价值。

---

## 一、阶段目标

| 维度 | 目标 | 可量化标准 |
|:---|:---|:---|
| **协议** | 建立首批语义令牌与意图契约 | 定义 ≥ 5 个语义令牌，≥ 2 个意图契约 |
| **产品** | 完成 1 个核心产品的意图绑定 | 该产品 ≥ 3 个关键界面接入意图协议 |
| **组织** | 建立语义架构师角色与评审流程 | 完成 ≥ 1 次 Intent Review |
| **认知** | 让团队感受到"机器查清单" vs "人查清单"的差异 | 演示 1 次 Validator 自动拦截 |

---

## 二、联邦宪法确立

### 2.1 控制平面载体初始化

**动作**：将 `intent-schema-compiler` 仓库确立为组织的**单一事实源**。

**最小配置**：

```yaml
# .intentrc.yaml —— 仓库元数据
project:
  name: "intent-schema-compiler"
  type: "control-plane"
  version: "0.1.0"
  schema_version: "v0.1.0"

governance:
  semantic_domain: "experience-design"
  immutable_tokens: ["status.critical", "action.destructive"]
  pilot_products: ["monitor-dashboard", "alert-center"]
```

**Commit 要求**：
- 由联邦治理委员会（或技术 VP）完成首次 Commit
- Commit message：`constitution: 联邦宪法 v0.1.0 — 确立控制平面载体`

### 2.2 语义域划分

在首批试点中，只定义**四个基础语义域**：

| 语义域 | 标识 | 覆盖场景 | 示例令牌 |
|:---|:---|:---|:---|
| **认知型** | `cognitive` | 信息展示、状态传达 | `status.critical`, `status.warning` |
| **交互型** | `interactive` | 用户操作反馈 | `action.confirm`, `action.cancel` |
| **交易型** | `transactional` | 资金/数据变更 | `action.destructive`, `action.irreversible` |
| **观测型** | `observational` | 监控、告警、日志 | `observability.alert`, `observability.metric` |

**约束**：Phase 1 不扩展自定义语义域，避免过早分化。

---

## 三、试点域选择

### 3.1 选择标准

| 标准 | 权重 | 说明 |
|:---|:---|:---|
| **业务核心度** | 高 | 选择用户高频使用、出错代价高的产品 |
| **界面复杂度** | 中 | 包含 ≥ 3 种以上语义状态（成功/警告/错误/危险） |
| **团队配合度** | 高 | 前端 TL 愿意投入 2-3 天接入时间 |
| **LLM 介入度** | 中 | 已有或计划引入 AI 生成内容的产品优先 |

### 3.2 推荐试点场景

**场景 A：告警中心（Alert Center）**
- 优势：天然包含 `status.critical/warning/info` 三种语义令牌，人机边界清晰（高危操作必须确认）
- 风险：业务关键，出错影响大，需做好降级预案

**场景 B：配置管理（Config Management）**
- 优势：包含大量 `action.destructive` 场景（删除配置、重置参数），语义边界明确
- 风险：用户操作频率低，演示效果不如告警中心直观

**建议**：优先选择 **告警中心**，因为它的语义丰富度和演示冲击力最适合 Phase 1。

---

## 四、语义锚定执行步骤

### Step 1：语义令牌定义（1-2 天）

由**语义架构师**主导，前端 TL 与设计师参与。

**产出物**：`schema/v0.1.0/semantic-tokens.yaml`

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
    llm_constraints:
      - "生成内容必须包含明确的故障定位信息"
      - "禁止提供未经验证的修复建议"
    synonym_firewall:
      prohibited:
        - term: "严重"
          confidence_threshold: 0.95

  status.warning:
    canonical_id: "ST-002"
    version: "1.0.0"
    immutable: false
    description: "潜在风险，需关注"
    visual_mapping:
      color_token: "status.warning"
      motion_token: "static"
    llm_constraints:
      - "生成内容必须说明风险等级和影响面"

  action.destructive:
    canonical_id: "ST-003"
    version: "1.0.0"
    immutable: true
    description: "不可逆操作，需人工确认"
    visual_mapping:
      color_token: "action.destructive"
      motion_token: "none"
    llm_constraints:
      - "必须附带人工升级路径"
      - "禁止建议自动执行"
```

**评审点**：
- 每个令牌是否有明确的 `canonical_id`？
- `immutable` 标记是否合理？（关键业务语义建议 `true`）
- `synonym_firewall` 是否覆盖了团队已知的 LLM 漂移案例？

### Step 2：意图契约定义（1 天）

**产出物**：`schema/v0.1.0/intent-contracts.yaml`

```yaml
intent_contracts:
  alert-card-generation:
    intent_id: "IC-001"
    semantic_domain: "observational"
    version: "1.0.0"
    immutable_boundaries:
      - boundary_type: "semantic"
        rule_ref: "rules/semantic/alert-level.yaml"
        violation_action: "block"
      - boundary_type: "safety"
        rule_ref: "rules/safety/destructive-action.yaml"
        violation_action: "block"

  destructive-operation:
    intent_id: "IC-002"
    semantic_domain: "transactional"
    version: "1.0.0"
    immutable_boundaries:
      - boundary_type: "safety"
        rule_ref: "rules/safety/destructive.yaml"
        violation_action: "block"
      - boundary_type: "compliance"
        rule_ref: "rules/compliance/human-confirmation.yaml"
        violation_action: "escalate"
```

**评审点**：
- `violation_action` 是否明确？（`block` / `escalate` / `fallback`）
- 是否引用了已定义的语义令牌？
- 每个契约是否有对应的场景测试？

### Step 3：产品绑定配置（0.5 天）

**产出物**：`bindings/monitor-dashboard.yaml`

```yaml
product_binding:
  product_id: "monitor-dashboard"
  product_name: "监控大盘"
  registry_version: "v0.1.0"

  components:
    - component_name: "AlertCard"
      intent_contract: "IC-001"
      semantic_tokens: ["status.critical", "status.warning"]

    - component_name: "BatchActionBar"
      intent_contract: "IC-002"
      semantic_tokens: ["action.destructive"]

  api_endpoints:
    - path: "/api/v1/alerts/batch-delete"
      intent_contract: "IC-002"
      human_mandatory: true
```

**评审点**：
- 每个关键组件是否绑定了意图契约？
- API 路径是否标记了 `human_mandatory`？
- 绑定关系是否可追踪？（通过 Git Diff 可见）

### Step 4：场景测试验证（1 天）

**产出物**：`schema/v0.1.0/scenario-tests.yaml`

```yaml
scenario_tests:
  - test_id: "T-001"
    intent_binding: "IC-001"
    description: "告警卡片正常生成"
    happy_path:
      input: { alert_source: "CPU_USAGE", threshold: 95 }
      expected: "PASS"

  - test_id: "T-002"
    intent_binding: "IC-001"
    description: "同义词漂移检测"
    edge_case:
      mock_response: { alert_level: "严重", root_cause: "CPU 满了" }
      expected_validation: "BLOCK — 语义推演失败"

  - test_id: "T-003"
    intent_binding: "IC-002"
    description: "高危操作缺少人工确认"
    edge_case:
      mock_request: { action: "batch_delete", human_confirmed: false }
      expected_validation: "BLOCK — 安全推演失败"
```

**验证方式**：使用 JSON Schema Validator（https://www.jsonschemavalidator.net/）手动验证，截图存档。

---

## 五、组织角色与流程

### 5.1 Phase 1 最小角色配置

| 角色 | 人数 | 来源 | 职责 |
|:---|:---|:---|:---|
| **语义架构师** | 1 | 设计系统负责人或前端架构师兼任 | 定义语义域、审核语义令牌、裁定 Breaking Change |
| **Intent Steward（试点域）** | 1 | 试点产品的前端 TL 兼任 | 维护产品绑定配置、推动组件接入、收集反馈 |
| **联邦治理委员会观察员** | 1 | 技术 VP 或架构委员会代表 | 见证首次 Intent Review、批准宪法级变更 |

### 5.2 Intent Review 流程

Phase 1 只需一次正式评审：

```
语义架构师提交 PR（新增语义令牌 + 意图契约）
    │
    ▼
Intent Steward 评审（检查产品绑定是否完整）
    │
    ▼
联邦治理委员会观察员批准（确认无 Breaking Change）
    │
    ▼
Merge → 触发 Registry 版本记录 → 通知试点团队
```

**评审标准**：
- 语义令牌是否有 `canonical_id` 和 `immutable` 标记？
- 意图契约是否引用了已存在的语义令牌？
- 是否有对应的场景测试（至少 1 个 Happy Path + 1 个 Edge Case）？
- 产品绑定配置是否完整？

---

## 六、产出物清单

Phase 1 结束时，仓库中必须存在以下文件：

```
intent-schema-compiler/
├── schema/
│   └── v0.1.0/
│       ├── semantic-tokens.yaml          ✅ 首批语义令牌
│       ├── intent-contracts.yaml         ✅ 首批意图契约
│       ├── synonym-mapping.yaml          ✅ 同义词防火墙（可选）
│       └── scenario-tests.yaml           ✅ 场景测试
├── bindings/
│   └── monitor-dashboard.yaml            ✅ 试点产品绑定
├── .intentrc.yaml                        ✅ 仓库元数据
└── README.md                             ✅ 已更新 Phase 1 状态
```

---

## 七、成功标准与退出条件

### 7.1 成功标准（必须全部满足）

| # | 标准 | 验证方式 |
|:---|:---|:---|
| 1 | 定义 ≥ 5 个语义令牌，≥ 2 个意图契约 | 检查 `schema/v0.1.0/` 文件 |
| 2 | 完成 1 个产品的绑定配置 | 检查 `bindings/` 文件 |
| 3 | 完成 1 次 Intent Review | 检查 Git PR 记录 |
| 4 | 演示 1 次机器自动拦截（Validator 或 JSON Schema Validator） | 截图或录屏存档 |
| 5 | 试点团队反馈"比文档更高效" | 收集 ≥ 3 条正面反馈 |

### 7.2 退出条件（进入 Phase 2 的前提）

- 成功标准全部满足
- 联邦治理委员会批准进入 Phase 2
- 确定第二个试点产品（准备扩大覆盖）

---

## 八、常见风险与缓解

| 风险 | 症状 | 缓解措施 |
|:---|:---|:---|
| **语义令牌膨胀** | 团队试图一次性定义所有场景的令牌 | 限制 Phase 1 只定义 4 个基础语义域，其他放入 `experimental/` |
| **绑定配置遗漏** | 关键组件未绑定意图契约 | Steward 使用检查清单（Checklist）逐项核对 |
| **评审流程过重** | 一次 Intent Review 耗时超过 3 天 | 简化评审人至 2 人（架构师 + Steward），观察员仅知情 |
| **演示失败** | Validator 拦截未按预期触发 | 提前准备 Mock 数据，在本地验证后再演示 |

---

## 九、下阶段预告

Phase 1 完成语义锚定后，Phase 2 **契约闭环** 将启动：

- 部署 **Schema Compiler**，将 YAML 协议编译为试点产品可消费的 ESLint 规则与 TS 类型
- 部署 **Four-Tier Validator**，在 CI 中自动拦截语义漂移
- 建立 **Intent Steward** 的常态化工作机制

目标：让"机器查清单"从一次性演示变成日常开发流程。

---

**文档版本**：v1.0  
**对应语雀**：Phase 1：语义锚定——联邦宪法与试点域  
**控制平面载体**：https://github.com/2436041978-ops/intent-schema-compiler
