# Phase 1：语义锚定——联邦宪法与试点域

> 面向：联邦治理委员会 + 试点域 TL  
> 目标：在 1-2 个试点域内完成控制平面初始化，建立首批语义令牌与意图契约，验证 Schema-As-Code 的可显化与可阅读性。

---

## 一、Phase 1 核心目标

语义锚定不是"全面铺开"，而是**在最小范围内建立可复制的范式**。Phase 1 只回答三个问题：

1. **语义宪法长什么样？** —— 控制平面 YAML 的三层结构是否可被团队理解
2. **谁能写意图协议？** —— 识别首批 Intent Steward（意图管家）
3. **约束显化是否有效？** —— 用真实业务场景验证"机器查清单"的可行性

**Phase 1 成功标准**：
- [ ] 1 个试点域完成意图协议绑定（`intent-binding.yaml`）
- [ ] 首批 5-10 个语义令牌进入控制平面（`semantic-tokens.yaml`）
- [ ] 至少 1 条不可变边界被团队接受为"宪法级"规则（`immutable: true`）
- [ ] 试点域成员能在 30 分钟内阅读并理解 `intent-schema-compiler` 仓库结构

---

## 二、联邦宪法确立：控制平面初始化

### 2.1 创建联邦宪法仓库

**操作步骤**：

1. 在组织内选定代码托管平台（GitHub/GitLab/Gitee）
2. 创建仓库 `intent-schema-compiler`（或组织级命名如 `acme-intent-schema`）
3. 初始化三层目录结构：

```bash
intent-schema-compiler/
├── 语义层/
│   ├── semantic-tokens.yaml      # 语义令牌注册表
│   ├── intent-contracts.yaml     # 意图契约定义
│   └── synonym-mapping.yaml      # 同义词防火墙
├── 治理层/
│   ├── prompt-constraints.yaml   # LLM 输入约束
│   ├── response-schema.yaml      # LLM 输出安检
│   └── human-ai-boundary.yaml    # 人机边界划分
└── 执行层/
    ├── compilation-chain.md      # 编译思维链说明
    └── scenario-tests.yaml       # 场景测试用例
```

**Commit Message**：`init: 联邦宪法——控制平面骨架`

### 2.2 首批语义令牌立法

选择试点域内**最高频、最危险**的语义场景作为首批立法对象。推荐优先级：

| 优先级 | 语义令牌 | 业务场景 | 为什么优先 |
|:---|:---|:---|:---|
| P0 | `status.critical` | 系统故障告警 | 高频 + 高风险，漂移代价最大 |
| P0 | `action.destructive` | 删除/修复/资金操作 | 不可逆操作，安全边界必须锁定 |
| P1 | `status.warning` | 潜在风险提醒 | 高频，但风险低于 critical |
| P1 | `action.readonly` | 查询/浏览 | 建立基础语义区分 |
| P2 | `status.success` | 操作成功反馈 | 低优先级，后续补充 |

**立法操作**：
1. 由试点域 TL 与设计师共同定义业务语义
2. 由 Intent Steward 将定义写入 `semantic-tokens.yaml`
3. 标记不可变令牌：`immutable: true`（一旦发布，旧版本冻结）
4. 提交 PR，联邦治理委员会审批（至少 1 人 Review）

**Commit Message**：`feat(semantic): 添加首批语义令牌——critical/warning/destructive`

### 2.3 同义词防火墙初建

针对首批令牌，建立**最小同义词黑名单**（不必求全，先防最危险的漂移）：

```yaml
# 语义层/synonym-mapping.yaml
synonym_mapping:
  - term: "严重"
    standard_token: "status.critical"
    allowed_contexts: ["alert-card", "monitor-dashboard"]

  - term: "紧急"
    standard_token: "status.critical"
    allowed_contexts: ["alert-card"]

  - term: "高危"
    standard_token: "action.destructive"
    allowed_contexts: ["destructive-confirm"]
```

**Commit Message**：`feat(synonym): 建立首批同义词防火墙——严重/紧急/高危`

---

## 三、试点域选择标准

不是所有产品都适合作为 Phase 1 试点。选择标准：

| 维度 | 理想试点域特征 | 避免选择的域 |
|:---|:---|:---|
| **业务风险** | 中高风险（如支付、告警、运维），约束显化收益明显 | 纯展示型页面（如官网、活动页），语义单一 |
| **团队成熟度** | 有前端 TL 或架构师能承担 Intent Steward 角色 | 无技术负责人，全靠外包维护 |
| **AI 介入度** | 已有 LLM 生成内容进入界面（如 AI 助手、智能客服） | 纯人工编写界面，无概率性输出 |
| **改动成本** | 近期有迭代计划，可顺势接入意图协议 | 即将冻结或下线的项目 |
| **数据敏感度** | 涉及用户资金、隐私、系统安全 | 纯静态内容，无操作风险 |

**推荐试点域**：
- 告警中心 / 运维监控（高频 + 高风险 + AI 生成告警摘要）
- 支付确认 / 资金操作（不可逆 + 人机边界敏感）
- 智能客服 / AI 助手（LLM 直接面向用户，漂移风险高）

---

## 四、语义锚定操作步骤（SOP）

### Step 1：任命 Intent Steward（第 1 周）

- 试点域 TL 指定 1 人担任 Intent Steward（可兼职，建议由前端架构师或设计系统负责人担任）
- Steward 职责：维护本域的 `intent-binding.yaml`，参与联邦宪法 PR Review
- 在组织内部文档中登记：`docs/stewards.md`

### Step 2：语义盘点（第 1-2 周）

- Steward 与设计师、产品经理共同盘点试点域内所有**涉及 AI 生成或用户操作的语义场景**
- 输出：《试点域语义盘点表》（Markdown 表格即可）

```markdown
| 场景 | 当前自然语言描述 | 提议语义令牌 | 风险等级 | 是否立法 |
|:---|:---|:---|:---|:---|
| P0 告警卡片 | "红色脉冲，必须人工确认" | `status.critical` + `action.destructive` | P0 | 是 |
| 批量删除 | "删除后不可恢复，需二次确认" | `action.destructive` | P0 | 是 |
| 系统通知 | "黄色提示，无需操作" | `status.warning` | P1 | 是 |
```

### Step 3：YAML 立法（第 2-3 周）

- Steward 将盘点结果转化为 YAML，提交到 `intent-schema-compiler`
- 联邦治理委员会 Review（重点检查：不可变边界是否合理、同义词防火墙是否过松/过紧）
- Merge 后自动触发版本标签：`git tag v0.1.0`

### Step 4：产品绑定（第 3 周）

- 在试点域代码仓库中创建 `intent-binding.yaml`：

```yaml
# 试点域仓库根目录/intent-binding.yaml
product_id: "alert-center"
registry_repo: "https://github.com/acme/intent-schema-compiler"
registry_version: "v0.1.0"

bound_intents:
  - intent_id: "alert-card"
    semantic_tokens:
      - "status.critical"
      - "status.warning"
    human_ai_boundary: "destructive-action"

  - intent_id: "batch-delete"
    semantic_tokens:
      - "action.destructive"
    human_ai_boundary: "destructive-action"
```

**Commit Message**：`feat(intent): 绑定联邦宪法 v0.1.0——告警卡片与批量删除`

### Step 5：验证阅读性（第 4 周）

- 组织试点域全员（含设计师、前端、后端、测试）阅读 `intent-schema-compiler` 仓库
- 目标：30 分钟内能回答"`status.critical` 代表什么、什么情况下会触发 BLOCK、同义词防火墙防什么"
- 收集反馈：哪些 YAML 字段含义不清、哪些规则与实际业务冲突

---

## 五、Phase 1 交付物清单

| 交付物 | 位置 | 验收标准 |
|:---|:---|:---|
| 控制平面仓库 | `intent-schema-compiler` | 三层目录完整，至少 3 个 YAML 文件 |
| 首批语义令牌 | `语义层/semantic-tokens.yaml` | 5-10 个令牌，至少 2 个标记 `immutable: true` |
| 同义词防火墙 | `语义层/synonym-mapping.yaml` | 覆盖试点域最高频的 3-5 个漂移词 |
| 意图契约 | `治理层/human-ai-boundary.yaml` | 至少 1 条 `violation_action: block` |
| 产品绑定配置 | 试点域仓库 `intent-binding.yaml` | 明确引用控制平面版本号 |
| 场景测试 | `执行层/scenario-tests.yaml` | 每个意图契约至少 1 个 Happy Path + 1 个 Edge Case |
| Intent Steward 名单 | 组织文档 | 明确姓名、职责、Review 权限 |

---

## 六、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|:---|:---|:---|:---|
| **语义令牌定义分歧** | 高 | 中 | 先立法试点域最高频的 2-3 个令牌，不追求全覆盖；分歧通过联邦委员会投票裁决 |
| **设计师抗拒 YAML** | 高 | 中 | 提供《意图协议编写指南》模板；Steward 负责翻译，设计师只需确认自然语言描述 |
| **同义词防火墙误伤** | 中 | 高 | 采用 `allowed_contexts` 限定映射范围；误报时通过 PR 快速调整，不升级 Major 版本 |
| **试点域进度阻塞** | 中 | 高 | 设置沙盒域（`experimental/`）允许快速迭代，不受不可变规则限制；成熟后晋升 |
| **委员会 Review 瓶颈** | 低 | 中 | 明确 Review 时限（48 小时）；紧急规则走快速通道（1 人 Review + 事后补审） |

---

## 七、下阶段衔接：Phase 2 契约闭环

Phase 1 语义锚定完成后，试点域已具备"宪法文本"。Phase 2 将引入：

- **Compiler**：将 YAML 编译为试点域可消费的 ESLint 规则、TS 类型、Prompt 前缀
- **Validator**：在试点域 CI 中执行四层推演，拦截语义漂移
- **Steward 嵌入**：Intent Steward 从"写 YAML"升级为"Review 编译产物"

**Phase 2 触发条件**：
- [ ] Phase 1 全部交付物验收通过
- [ ] 试点域全员完成意图协议阅读测试（通过率 ≥ 80%）
- [ ] 联邦治理委员会批准 Compiler 投产计划

---

## 附录：Phase 1 时间线（建议）

| 周次 | 动作 | 负责人 |
|:---|:---|:---|
| W1 | 任命 Steward、创建控制平面仓库、语义盘点 | 联邦委员会 + 试点域 TL |
| W2 | 首批语义令牌立法、同义词防火墙初建 | Intent Steward |
| W3 | 委员会 Review、Merge、产品绑定 | 联邦委员会 + Steward |
| W4 | 阅读性验证、反馈收集、交付验收 | 试点域全员 |

---

> **Schema-As-Code 联邦自治架构**  
> 上一篇：[《Schema-As-Code 立宪：意图协议的形式化定义》](../00-federal-manifesto/architecture-manifesto.md)  
> 下一篇：[《Phase 2：契约闭环——Compiler 投产与 Steward 嵌入》](./phase-02-contract-closure.md)
