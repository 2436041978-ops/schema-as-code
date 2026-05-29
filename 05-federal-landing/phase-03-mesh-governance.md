# Phase 3：网格治理——全域联邦与观测闭环

> 承接 Phase 1（语义锚定）与 Phase 2（契约闭环），Phase 3 是 Schema-As-Code 联邦自治的**成熟态**——从试点域的单点验证，扩展到全域产品的网格化治理，并通过观测闭环实现持续自修正。

---

## 一、Phase 3 的核心命题

Phase 3 回答一个问题：**当组织拥有 10+ 产品线、100+ 意图契约、1000+ LLM 消费场景时，如何确保语义一致性不随规模衰减？**

答案不是"加人走查"，而是建立**自运行的语义治理网格**——让约束的编译、校验、拦截、观测、反哺形成闭环，治理成本从 O(N) 降至 O(1)。

---

## 二、全域联邦：从试点到全域的治理扩散

### 2.1 联邦域的三种状态

| 域状态 | 特征 | 判定标准 |
|--------|------|----------|
| **宪法域（Constitutional Domain）** | 完全自治，拥有独立意图协议立法权 | 具备 Intent Steward、完整 CI 流水线、自主版本发布 |
| **契约域（Contractual Domain）** | 部分自治，引用联邦核心协议，可扩展子域规则 | 绑定联邦核心语义令牌，通过 Compiler 编译，Runtime 拦截生效 |
| **接入域（Integrated Domain）** | 黑盒接入，仅消费编译产物，不持有协议定义权 | 使用 npm 包/ESLint 插件/Figma 插件，不直接修改 YAML |

### 2.2 全域联邦的拓扑结构

```
联邦治理委员会（Federal Committee）
    │
    ├── 核心宪法域（Core Domain）
    │   └── 定义联邦级语义令牌（status.critical, action.destructive）
    │   └── 定义跨域不可变边界（人机边界、安全红线）
    │
    ├── 业务域 A（Domain A）
    │   ├── Intent Steward：维护域级意图协议
    │   ├── 绑定联邦核心语义令牌
    │   └── 扩展域级规则（如金融域的"资金操作二次确认"）
    │
    ├── 业务域 B（Domain B）
    │   └── 同上
    │
    └── 接入域（黑盒）
        └── 仅消费 Compiler 产物，不参与协议立法
```

**关键原则**：联邦核心语义令牌（如 `status.critical`）由委员会统一维护，各域可扩展但不可修改。域级规则通过 `domain-rule-legislation.md` 流程注册，经委员会审批后进入 Compiler 编译管线。

### 2.3 全域影响面分析

当核心语义令牌发生 Breaking Change 时，Registry 自动计算全域影响面：

```yaml
# Registry 影响面报告示例
impact_report:
  changed_token: "status.critical"
  version: "2.0.0"
  type: "breaking"
  affected_domains:
    - domain: "infra"
      products: ["monitoring", "alerting"]
      components: ["AlertCard", "StatusBadge"]
    - domain: "business"
      products: ["payment", "refund"]
      components: ["RiskNotice"]
  required_actions:
    - "域 A 需在 7 日内升级绑定版本"
    - "域 B 需确认子域规则兼容性"
```

---

## 三、观测闭环：从漂移发现到规则自修正

### 3.1 闭环数据流

```
Runtime / Validator 拦截事件
    │
    ▼
Observability Bridge（采集 → 归一化 → 归因）
    │
    ├── 语义归一化：将原始 Trace 映射为意图协议 ID
    ├── 归因引擎：定位根因（哪条契约规则失效？哪条同义词映射过松？）
    └── 影响计算：评估漂移波及范围
    │
    ▼
自动反哺（Auto-Feedback）
    │
    ├── 常规漂移：自动创建 Registry PR（收紧同义词阈值 / 新增禁止模式）
    ├── 紧急漂移：Runtime 热补丁覆盖（小时级生效，无需等 Registry 发版）
    └── 人工审批：语义架构师 Merge PR，触发 Compiler 重新编译
    │
    ▼
全链路更新（GitOps 闭环）
    │
    └── 新约束产物自动分发至所有域
    └── 下一周期运行时验证拦截率提升
```

### 3.2 归因引擎的决策树

Bridge 采集到漂移事件后，按以下逻辑归因：

| 漂移类型 | 归因逻辑 | 反哺动作 |
|----------|----------|----------|
| **同义词替代**（如"严重"替代 `critical`） | 检查 `synonym-mapping.yaml` 的 `confidence_threshold` | 自动 PR：收紧阈值或缩小 `allowed_contexts` |
| **结构缺失**（如缺少 `human_confirmed`） | 检查 `human-ai-boundary.yaml` 的 `required_fields` | 自动 PR：补充字段约束或升级 `violation_action` |
| **LLM 参数漂移**（temperature 过高导致输出发散） | 结合 SemConv 的 `per_token_time` 与 `temperature` 字段 | 通知域 Steward 调整 LLM 配置，非自动修改 |
| **规则真空**（新场景无对应意图契约） | 检查 Registry 中是否存在绑定 | 创建 Issue 建议新增意图契约，走立法流程 |

### 3.3 双速闭环策略

| 速度 | 触发条件 | 响应时间 | 机制 |
|------|----------|----------|------|
| **紧急闭环** | 安全边界突破（如 AI 直接执行删除） | 小时级 | Runtime 热补丁 + 人工紧急通道 |
| **常规闭环** | 语义一致性得分 < 75% | 周级 | Bridge 自动 PR + 语义架构师审批 |
| **战略闭环** | 季度治理健康度评估 | 月级 | 委员会评审 + 架构演进路线调整 |

---

## 四、组织级治理指标

Phase 3 需建立可量化的治理健康度体系，作为委员会评审和域级考核的依据。

### 4.1 四大核心指标

| 指标 | 定义 | 计算方式 | 目标值 |
|------|------|----------|--------|
| **语义一致性得分（Semantic Consistency Score）** | 跨产品界面中语义令牌合规率 | 合规事件数 / 总事件数 × 100% | ≥ 90% |
| **规则拦截率（Rule Interception Rate）** | 四层推演引擎拦截的漂移事件占比 | 拦截事件数 / 总校验事件数 × 100% | ≥ 95% |
| **人工升级比例（Human Escalation Ratio）** | 无法自动处理、需人工介入的事件占比 | 升级事件数 / 总拦截事件数 × 100% | 随成熟度递减至 < 5% |
| **意图协议覆盖率（Intent Protocol Coverage）** | 持有意图契约的产品数 / 总产品数 × 100% | 绑定意图协议的产品数 / 全域产品总数 | ≥ 80% |

### 4.2 指标仪表盘

治理指标以静态 HTML 或内部 BI 看板形式呈现，数据源来自 Bridge 的 Metrics 聚合：

```yaml
# Bridge 指标输出示例
governance_metrics:
  period: "2026-Q2"
  overall_health_score: 87.5          # 综合健康度（A/B/C/D 分级）
  semantic_consistency: 92.3          # 语义一致性得分
  interception_rate: 96.7             # 规则拦截率
  escalation_ratio: 4.2              # 人工升级比例
  protocol_coverage: 85.0             # 意图协议覆盖率

  breakdown_by_domain:
    - domain: "infra"
      consistency: 94.5
      interception: 98.1
    - domain: "business"
      consistency: 89.2
      interception: 95.3
```

---

## 五、持续运营机制

### 5.1 联邦委员会月度评审

| 议程 | 内容 | 输出 |
|------|------|------|
| **治理健康度通报** | Bridge 指标仪表盘回顾 | 全域健康度报告 |
| **Breaking Change 评审** | 审核本月 Registry 版本变更 | 批准/驳回版本发布 |
| **域级立法审批** | 审核各域提交的意图协议扩展 | 批准/要求修改 |
| **紧急事件复盘** | 回顾热补丁触发事件 | 规则优化建议 |

### 5.2 Intent Steward 周度运营

- **周一**：Review 上周 Bridge 生成的自动 PR，确认是否 Merge
- **周三**：处理域内产品接入申请，更新绑定配置
- **周五**：输出域级治理周报（一致性得分、拦截事件、待处理 Issue）

### 5.3 平台团队季度迭代

- **Compiler 插件扩展**：新增目标平台适配（如新增 Vue3 插件、新增 OPA 容器插件）
- **Validator 规则优化**：基于漂移归因数据，调整四层推演权重
- **Runtime 性能优化**：降低 HOC/中间件拦截的时延开销

---

## 六、Phase 3 的准入标准

组织进入 Phase 3 需满足以下前置条件：

| 条件 | 标准 | 验证方式 |
|------|------|----------|
| **试点域验证** | 至少 1 个业务域完成 Phase 2 契约闭环 | 该域的 Runtime 拦截日志 + Validator 校验报告 |
| **Compiler 投产** | Compiler 已稳定运行 1 个季度，产物无重大缺陷 | CI 编译成功率 ≥ 99% |
| **Steward 就位** | 各域 Intent Steward 已任命并完成培训 | 组织架构表 + 培训签到 |
| **委员会成立** | 联邦治理委员会已成立，具备 Breaking Change 审批权 | 委员会章程 + 成员名单 |
| **观测接入** | Bridge 已接入至少 1 个可观测平台（LoongSuite / OTel / SLS） | Bridge 采集日志 |

---

## 七、从 Phase 3 到持续演进

Phase 3 不是终点。当网格治理稳定运行后，组织进入**持续演进态**：

1. **语义自治成熟**：各域 Steward 具备独立立法能力，委员会仅审核跨域影响
2. **AI 辅助立法**：基于历史漂移数据，AI 辅助生成意图协议草案（人类审批）
3. **跨组织联邦**：当存在多个独立组织（如集团子公司）时，建立跨组织语义联邦，共享核心语义令牌

---

## 八、结语

Phase 3 的网格治理，是 Schema-As-Code 联邦自治从"项目"走向"基础设施"的关键一跃。

它意味着：
- **语义一致性**不再是设计师的个人责任，而是系统的自动属性
- **约束迭代**不再是季度性的文档更新，而是周级甚至日级的自动反哺
- **组织治理**不再是成本中心，而是可量化、可审计、可优化的杠杆资产

当网格带电、闭环自转时，设计意图治理才真正完成了从"依靠人的理解和记忆"到"依靠系统的编译和执行"的进化。

---

**上一篇**：[Phase 2：契约闭环——Compiler 投产与 Steward 嵌入](./phase-02-contract-closure.md)

**关联文档**：
- [联邦落地手册](./landing-playbook.md)
- [组织落地手册](../03-domain-autonomy/steward-handbook.md)
- [模块 5：Observability Bridge 观测闭环](../02-platform-implementation/module-05-bridge.md)
