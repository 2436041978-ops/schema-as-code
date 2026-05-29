# Schema-As-Code 术语表

> 本文档定义 Schema-As-Code 联邦自治架构中的核心术语与概念，面向架构师、平台工程师、Intent Steward 及业务接入方。

---

## A

### Actor（执行者）
触发意图契约的实体身份，分为三类：
- **human**：人类用户直接操作（鼠标点击、键盘输入）
- **ai**：LLM / Agent / 自动化脚本发起的调用
- **human_via_ai**：用户通过 AI 中介间接触发的操作（如点击"采纳 AI 建议"）

> 参见：Governance Runtime 权限契约运行时拦截

---

## B

### Block（阻断）
四层推演校验中最高级别的失败动作。当语法/语义/安全层校验未通过时，系统直接拦截输出，不触发 LLM 自动重试，强制升级人工（Escalate）。

### Bridge（观测桥接器）
Schema-As-Code 数据平面第五模块。负责连接运行时观测与控制平面，实现"观测 → 归因 → 约束 → 验证"的闭环。核心功能包括：
- 采集 LoongSuite / OpenTelemetry 等平台的漂移事件
- 语义归一化（原始 Trace → 意图协议 ID 映射）
- 归因引擎（根因定位到具体 YAML 规则）
- 自动创建 Registry PR 收紧约束

### Breaking Change（破坏性变更）
语义令牌或意图契约的变更导致下游编译产物失效。例如：删除已发布的语义令牌、修改 `immutable: true` 的令牌定义。必须通过 SemVer Major 版本升级，并触发影响面分析。

---

## C

### Compiler（契约编译器）
Schema-As-Code 数据平面第二模块。将控制平面的 YAML 意图协议翻译为各层可消费的"约束产物"（Constraint Artifact）。采用三阶段编译架构：
1. 意图加载（Load）
2. 语义解析（Parse）
3. 约束推导（Derive）
4. 产物生成（Generate）
5. 场景验证（Verify）
6. 影响分析（Analyze）

### Constraint Artifact（约束产物）
Compiler 输出的机器可执行规则文件，包括：
- TypeScript 类型定义（`.d.ts`）
- ESLint 规则（`.json`）
- OpenAPI 扩展字段（`.yaml`）
- OPA Policy（`.rego`）
- DDL 注释 SQL（`.sql`）

### Control Plane（控制平面）
Schema-As-Code 架构的"宪法层"，以 `intent-schema-compiler` 仓库为载体。负责存储语义契约、版本化管理、作为全组织唯一事实源（Single Source of Truth）。不直接执行业务逻辑，只向数据平面"声明意图"。

---

## D

### Data Plane（数据平面）
Schema-As-Code 架构的"执行层"，由 Registry、Compiler、Validator、Runtime、Bridge 五个节点构成。负责将控制平面的声明转化为可执行规则，并在业务链路中执行拦截、校验与观测。

### Declarative（声明式）
Schema-As-Code 的核心范式。用户只需声明"系统应该是什么样子"（如 `status.critical` 代表系统故障），系统自动编译、分发、拦截、观测，无需关心具体实现路径。

### DESIGN.md
AI 设计工作流的描述层文档。设计师用 Markdown 描述视觉意图（色彩、排版、交互、动效），作为 LLM 的 Rich Context。与 Schema-As-Code（约束层）构成双层意图架构。

### Diff-Visible（Diff 可见）
约束显化的核心属性之一。由于意图协议以 YAML 形态存储于 Git，任何边界变更都可通过 `git diff` 精确追踪，包括修改人、修改时间、影响范围。

---

## E

### Edge Case（边界场景）
场景测试中的负向验证用例，用于证明约束规则在异常输入下仍能正确拦截。例如：同义词替代、自动执行建议、置信度越界。

### Escalate（升级人工）
Block 后的默认处理策略。当系统无法自动修正语义漂移时，将拦截事件升级给人类审核员，避免自动重试引入新的概率漂移。

---

## F

### Fallback（降级处理）
四层推演中次于 Block 的违规动作。通常用于非致命性约束突破，如美感层（Aesthetic）校验失败时，系统告警但不阻断交付。

### Federal Autonomy（联邦自治）
Schema-As-Code 的组织治理范式。中央平台（控制平面 + 数据平面）提供统一的语义基础设施，各业务域（Domain）在元规则约束下自主立法、自主适配、自主演进。核心原则："统一骨架，域级血肉"。

### Five-Layer Penetration Model（五层穿透模型）
约束产物在基础设施中的纵向扩散规范，确保同一语义契约从设计语义到数据持久化的全链路一致性：
- L1 Token 层（视觉系统）
- L2 组件层（前端组件库）
- L3 API 层（接口契约）
- L4 容器层（服务网格）
- L5 数据库层（数据持久化）

### Four-Tier Inference（四层推演）
Validator 的核心校验机制，按优先级顺序执行：
1. **Syntax（语法推演）**：JSON 结构完整性、字段类型、必填项
2. **Semantic（语义推演）**：语义令牌匹配、同义词黑名单
3. **Safety（安全推演）**：禁止模式命中、人机边界越权
4. **Aesthetic（美感推演）**：文案长度、信息密度、可读性

---

## G

### Governance Entropy（治理熵增）
规模化组织中，由于缺乏统一语义治理平台，各子产品独立决策导致接口语义、视觉形态、交互路径随时间产生结构性断层。公式化表达：`治理熵增成本 ∝ N × M × K × T`。

### Governance Mesh（治理网格）
Schema-As-Code 的架构形态。像 Service Mesh 一样，以透明、分布式、无侵入的方式覆盖所有业务节点，不替代现有技术栈（Ant Design / Carbon / K8s），只向其注入语义规则与采集观测数据。

### Governance Runtime（治理运行时）
Schema-As-Code 数据平面第四模块。将编译后的规则产物部署到生产环境，实现运行时语义拦截。三种守卫形态：
- **Component Guard**：React/Vue HOC 组件渲染时拦截
- **API Guard**：Express/Koa 中间件请求拦截
- **LLM Tool Guard**：Function Calling 工具调用拦截

---

## H

### Happy Path（正向路径）
场景测试中的合法输入验证，证明系统在合规数据下能正常通过。例如：`alert_level: P0`、`root_cause` 长度满足 `minLength: 10`。

### Human-AI Boundary（人机边界）
意图契约中定义的人类与 AI 的权限划分。包括：
- `human_mandatory`：必须由人类决策的操作（如告警等级判定）
- `ai_prohibited`：AI 绝对禁止的操作（如直接执行修复）
- `ai_assisted`：AI 可辅助生成的内容（如根因分析文本）

---

## I

### Immutable Boundary（不可变边界）
意图契约中声明的绝对不可突破的约束。标记为 `immutable: true` 的语义令牌或规则，一旦发布即冻结，任何变更必须发布新版本（SemVer Major）。

### Impact Analysis（影响面分析）
Registry 的核心功能。当语义协议发生变更时，自动分析下游哪些产品、哪些组件、哪些 Prompt 模板需要同步更新。基于 Git Diff + 产品绑定配置（`bindings/*.yaml`）实现。

### Intent Contract（意图契约）
治理层的核心实体，定义特定场景下的不可变边界与违规动作。例如 `destructive-action` 契约声明：高危操作必须二次确认、AI 禁止直接执行修复。

### Intent Protocol（意图协议）
Schema-As-Code 控制平面的总称，包含语义层、治理层、执行层的三层 YAML 结构。是组织内设计意图的"唯一事实源"。

### Intent Schema Compiler（意图模式编译器）
Schema-As-Code 控制平面的物理载体，一个 GitHub 仓库。通过三层目录结构（语义层/治理层/执行层）将"人查的清单"转化为"机器查的清单"。

### Intent Steward（意图管家）
域级自治中的关键角色。负责维护本域的语义令牌、意图契约、适配器开发，并在沙盒域中试验新意图，成熟后向联邦平台申请注册。

---

## L

### LoongSuite GenAI SemConv
阿里巴巴与蚂蚁集团联合推出的 GenAI 可观测语义规范，基于 OpenTelemetry 扩展。与 Schema-As-Code 形成阶段互补：LoongSuite 负责运行时观测（事后），Schema-As-Code 负责设计时约束（事前）。

---

## M

### Meta-Rule（元规则）
联邦自治架构中，中央平台制定的不可突破的顶层规则。各业务域在元规则约束下自主立法。例如：所有语义令牌必须遵循 `domain.category.name` 三段式命名；所有意图契约必须携带 `version` 字段。

### Monorepo（单体仓库）
Schema-As-Code 数据平面的推荐组织形态。将 Registry、Compiler、Validator、Runtime、Bridge 五个模块置于同一仓库 `packages/` 目录下，统一版本管理、统一 CI 流水线、统一发布节奏。

---

## N

### Node（节点）
Schema-As-Code 数据平面中的独立功能单元。五个节点通过标准接口协议（JSON Schema / YAML / CLI）通信，可独立部署、独立升级、独立扩展。

---

## O

### Observability Bridge（观测桥接器）
参见 **Bridge**。

---

## P

### Phase（阶段）
Schema-As-Code 联邦落地的渐进路径：
- **Phase 1 语义锚定**：建立联邦宪法，选定试点域，定义首批语义令牌
- **Phase 2 契约闭环**：Compiler 投产，Validator 嵌入 CI，Steward 上岗
- **Phase 3 网格治理**：全域联邦，观测闭环，组织级治理仪表盘上线

### Policy Loader（策略加载器）
Runtime 的核心子模块。负责从 Compiler 产物中热加载 `human-ai-boundary.json`，支持文件系统 Watch（开发环境）和定时轮询（生产环境），策略变更无需服务重启。

---

## R

### Registry（语义注册表）
Schema-As-Code 数据平面第一模块。负责：
- 语义 ID 全局唯一注册（`domain.category.name` 三段式）
- 版本化与兼容性管理（SemVer）
- 跨产品绑定配置（`bindings/*.yaml`）
- 变更影响面预计算（Git Diff → 影响面报告）

### Resolved Semantic Graph（解析语义图）
Compiler 阶段 1（语义解析）的输出。构建语义令牌、意图契约、约束规则、场景测试之间的完整依赖图，用于校验引用闭环和增量编译。

### Rule Ref（规则引用）
意图契约中通过 `rule_ref` 字段指向具体约束规则文件的路径。例如 `rules/safety/destructive.yaml`。实现契约与规则解耦，便于独立迭代。

---

## S

### Sandbox（沙盒域）
联邦自治中允许未注册意图快速迭代的隔离空间。`schema/experimental/` 目录下的语义令牌不受不可变性约束，成熟后通过 Steward 申请晋升到正式域。

### Schema-As-Code
本文档的核心范式。将设计意图的不可变边界、语义映射关系与治理校验规则，以机器可读的形式化格式（YAML/JSON）编码于版本控制系统中，并通过编译器转化为可执行约束产物的工程方法论。

### Semantic Contract Layer（语义契约层）
Schema-As-Code 架构中连接控制平面与数据平面的交互层。负责将控制平面的 YAML 声明翻译为数据平面可消费的协议，并管理版本对齐、产物分发、健康度指标。

### Semantic Drift（语义漂移）
LLM 输出中，业务语义偏离意图契约定义的现象。典型表现：用自然语言同义词（"严重"）替代结构化语义令牌（`status.critical`），或在未确认情况下建议自动执行修复。

### Semantic Token（语义令牌）
语义层的核心实体，业务语义到系统标识的映射单元。例如 `status.critical` 不仅映射到红色色值，还携带 LLM 约束、同义词防火墙、视觉动效定义。

### Short Circuit（短路策略）
四层推演中的执行优化。当语法层/语义层/安全层校验失败时，立即终止后续层级推演，直接返回 Block。避免无效计算，降低延迟。

### Single Source of Truth（唯一事实源）
Schema-As-Code 控制平面的核心原则。所有产品、所有模块、所有校验，最终都回溯到 `intent-schema-compiler` 仓库中的 YAML 协议。消除多源冲突，确保全局一致性。

### Synonym Firewall（同义词防火墙）
语义令牌中防止 LLM 漂移的机制。显式声明哪些自然语言词汇在特定上下文中必须映射为哪个标准令牌，超出允许上下文时标记为待确认。例如："严重" → `status.critical`（仅在告警上下文 `AW-001` 中生效）。

---

## T

### Three-Stage Compilation（三阶段编译）
Compiler 的状态转换机制：
1. **Load**：读取 YAML 文件，构建原始 AST
2. **Parse**：构建语义依赖图，校验引用闭环
3. **Derive**：将语义约束推导为平台无关的中间表示（Constraint IR）
4. **Generate**：通过插件将 IR 翻译为平台特定产物
5. **Verify**：用场景测试验证产物正确性
6. **Analyze**：比对版本 Diff，输出影响面报告

---

## V

### Validator（四层推演引擎）
Schema-As-Code 数据平面第三模块。在内容（LLM 输出 / 组件 Props / API 响应）进入生产链路前执行分层安检。核心原则：阻断优于修正（Block over Retry）。

### Version Hash Alignment（版本哈希对齐）
Runtime 启动时校验本地产物哈希与 Registry 发布版本是否一致。不一致时触发告警，提示策略可能过期，防止运行时与协议版本漂移。

### Violation Action（违规动作）
意图契约中定义的突破边界后的系统行为：
- `block`：直接阻断交付
- `escalate`：升级人工审核
- `fallback`：降级处理（仅用于美感层）

---

## W

### Warn（警告）
四层推演中美感层（Aesthetic）的校验失败动作。系统记录告警但不阻断交付，用于提示文案过长、信息密度过高、可读性不足等非致命性问题。

---

## Y

### YAML Three-Layer Structure（YAML 三层结构）
Schema-As-Code 控制平面的目录组织规范：
- **语义层（Semantic）**：语义令牌、意图契约、同义词防火墙
- **治理层（Governance）**：Prompt 约束、Response Schema、人机边界
- **执行层（Execution）**：编译思维链、场景测试

三层之间通过显式引用形成闭环：意图契约 → 语义令牌 → 约束规则 → 场景测试 → 意图契约。

---

## 附录：术语速查表

| 术语 | 中文 | 所属层级 | 关键记忆点 |
|:---|:---|:---|:---|
| Schema-As-Code | 意图协议即代码 | 范式 | 机器可读、版本管理、自动编译 |
| Control Plane | 控制平面 | 架构 | 宪法文本、唯一事实源 |
| Data Plane | 数据平面 | 架构 | 电网执行 |
| Compiler | 契约编译器 | 节点 | YAML → 产物 |
| Validator | 四层推演引擎 | 节点 | 安检门 |
| Runtime | 治理运行时 | 节点 | 现场执法 |
| Bridge | 观测桥接器 | 节点 | 监察反馈 |
| Registry | 语义注册表 | 节点 | 版本管理 |
| Semantic Token | 语义令牌 | 语义层 | 业务语义 ↔ 系统标识 |
| Intent Contract | 意图契约 | 治理层 | 不可变边界 |
| Human-AI Boundary | 人机边界 | 治理层 | 权限划分 |
| Synonym Firewall | 同义词防火墙 | 语义层 | 防 LLM 漂移 |
| Four-Tier Inference | 四层推演 | 机制 | 语法/语义/安全/美感 |
| Breaking Change | 破坏性变更 | 版本 | Major 升级 |
| Intent Steward | 意图管家 | 角色 | 域级自治负责人 |
| Federal Autonomy | 联邦自治 | 组织 | 统一骨架，域级血肉 |

---

> 本文档版本：`v1.0.0`  
> 维护者：Schema-As-Code 联邦治理委员会  
> 更新策略：术语新增需通过 PR Review，Breaking Change 需升级 Major 版本
