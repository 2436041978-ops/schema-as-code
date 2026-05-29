# Schema-As-Code 编译与推演机制规范

> 本文档定义 Schema-As-Code 体系的核心机制与关键设计，覆盖从**意图声明**到**运行时约束**的全链路工程规范。适用于意图协议定义、约束编译、推演校验及动态执行的架构设计与实现。

**目标读者**：系统架构师、前端/后端/AI 工程师、设计系统负责人。

---

## 一、术语与符号

| 术语 | 定义 |
|------|------|
| **意图协议（Intent Protocol）** | 以 YAML/JSON 形式化承载的设计意图契约，包含语义定义、治理规则与验证场景 |
| **控制平面（Control Plane）** | `intent-schema-compiler` 仓库，作为语义事实源与版本基准 |
| **数据平面（Data Plane）** | 由 Registry、Compiler、Validator、Runtime、Bridge 构成的分布式执行网格 |
| **语义令牌（Semantic Token）** | 业务语义到系统标识的映射单元（如 `status.critical`），携带视觉映射、LLM 约束与同义词防火墙 |
| **约束产物（Constraint Artifact）** | 编译器输出的机器可执行规则文件（TS 类型、ESLint 规则、OpenAPI 扩展、OPA Policy 等） |
| **推演（Inference）** | 基于约束产物对具体对象（LLM 输出/组件 Props/API 响应）进行多层级校验的过程 |
| **阻断（Block）** | 推演未通过时的强制拦截动作，不触发自动重试，直接升级人工 |

---

## 二、总体机制架构

```
┌─────────────────────────────────────────────────────────────┐
│                     控制平面（Control Plane）                  │
│              intent-schema-compiler（意图协议本体）            │
│         语义层 ──► 治理层 ──► 执行层（YAML/JSON）            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ GitOps / 声明式同步
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据平面（Data Plane）                   │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│  │ Registry │───►│ Compiler │───►│ Validator│            │
│  │ 语义注册  │    │ 约束编译  │    │ 四层推演  │            │
│  └──────────┘    └──────────┘    └──────────┘            │
│       │               │               │                      │
│       │               │               │                      │
│       └───────────────┴───────────────┘                      │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────┐    ┌──────────┐                              │
│  │ Runtime  │◄───│  Bridge  │                              │
│  │ 动态执行  │    │ 观测闭环  │                              │
│  └──────────┘    └──────────┘                              │
│       │                                                      │
│       └──────────────────────────────────────────────┐     │
│                                                      │     │
└──────────────────────────────────────────────────────┘     │
                              │                              │
                              │ 拦截事件 / 漂移数据           │
                              ▼                              │
              现有基础设施（Ant Design / Carbon / API / DB / LLM）
```

**核心机制总览**：
1. **五层穿透模型**：定义约束产物在基础设施中的纵向扩散路径
2. **静态配置工程化**：定义控制平面的 YAML 三层结构规范
3. **三阶段编译架构**：定义从声明到产物的状态转换
4. **四层推演校验**：定义语法/语义/安全/美感的分层安检逻辑
5. **动态编译执行**：定义约束产物在运行时的热加载与版本对齐机制

---

## 三、机制一：五层穿透模型（Five-Layer Penetration Model）

### 3.1 定义
五层穿透模型是 Schema-As-Code 约束产物在基础设施中的纵向扩散规范，确保同一语义契约从设计语义到数据持久化的全链路一致性。

### 3.2 穿透层级

| 层级 | 标识 | 约束产物形态 | 作用域 | 拦截时机 |
|------|------|-------------|--------|---------|
| **Token 层** | `L1` | CSS 变量 / Theme 配置 / 语义注释 | 视觉系统 | 主题编译时 |
| **组件层** | `L2` | TS 类型定义 / Prop 约束 / ESLint 规则 | 前端组件库 | 开发编译时 + 组件渲染时 |
| **API 层** | `L3` | OpenAPI 扩展 / JSON Schema / 请求体校验 | 接口契约 | 请求到达业务逻辑前 |
| **容器层** | `L4` | OPA Policy / WASM 配置 / Sidecar 规则 | 服务网格 | 网络请求路由时 |
| **数据库层** | `L5` | DDL 注释 / CHECK 约束 / 字段语义标签 | 数据持久化 | 数据写入时（软约束） |

### 3.3 穿透原则

**原则 1：同构映射**
同一语义令牌（如 `status.critical`）在五层中的映射必须保持语义一致性：
- L1：`--status-critical-color: #D32F2F`
- L2：`type AlertLevel = 'status.critical' | 'status.warning'`
- L3：`alert_level: { type: string, enum: ['status.critical'] }`
- L4：`allow { input.alert_level == "status.critical" }`
- L5：`COMMENT 'intent: status.critical'`

**原则 2：增量穿透**
新增约束契约时，无需全量重构，只需通过 Compiler 生成对应层级的增量产物，通过 Registry 影响面分析定位需更新的下游节点。

**原则 3：双向溯源**
任意层级的约束产物必须携带**意图协议 ID**（`intent_id`）与**版本哈希**（`schema_version_hash`），支持从运行时拦截事件反向定位到控制平面的源 YAML 文件。

---

## 四、机制二：静态配置工程化（Static Configuration Engineering）

### 4.1 定义
静态配置工程化是将自然语言设计规范转化为机器可读 YAML 协议的过程，采用零代码声明式结构，使非工程师角色（设计师、产品经理）可直接参与意图协议的定义与修订。

### 4.2 YAML 三层结构规范

控制平面中的所有意图协议必须遵循以下三层目录结构与数据 schema：

#### 4.2.1 语义层（Semantic Layer）
承载"这个世界应该有什么语义"。

```yaml
# schema/semantic-tokens.yaml
semantic_tokens:
  status.critical:
    canonical_id: "ST-001"
    version: "1.0.0"
    immutable: true                    # 变更必须发新版本
    description: "系统级故障，需立即响应"

    visual_mapping:                    # L1 映射
      color_token: "status.critical"
      motion_token: "pulse.red.urgent"
      sound_token: "alert.high"

    llm_constraints:                   # L2/L3 映射
      - "生成内容必须包含明确的故障定位信息"
      - "禁止提供未经验证的修复建议"

    synonym_firewall:                  # 同义词黑名单
      prohibited:
        - term: "严重"
          confidence_threshold: 0.95
          allowed_contexts: ["AW-001", "AW-002"]
```

#### 4.2.2 治理层（Governance Layer）
承载"什么绝对不能突破"。

```yaml
# schema/human-ai-boundary.yaml
human_ai_boundary:
  destructive-action:
    intent_id: "IC-003"
    semantic_domain: "transactional"

    immutable_boundaries:
      - boundary_type: "safety"
        rule_ref: "rules/safety/destructive.yaml"
        violation_action: "block"      # block / escalate / fallback

    human_mandatory:                   # 必须由人决策
      - "是否触发自动修复"
      - "升级路径选择"

    ai_prohibited:                     # AI 绝对禁止
      - "直接执行修复操作"
      - "修改告警阈值配置"
      - "POST:/api/v1/destructive"    # 从 API 契约自动生成
```

#### 4.2.3 执行层（Execution Layer）
承载"怎么验证契约被遵守"。

```yaml
# schema/scenario-tests.yaml
scenario_tests:
  - test_id: "T-P0-001"
    intent_binding: "AW-001"

    happy_path:
      input: { alert_source: "CPU_USAGE", threshold_breach: 95 }
      expected: "PASS"

    edge_cases:
      - case: "同义词替代"
        mock_response: { alert_level: "严重" }
        expected_validation: "BLOCK — 语义推演失败"

      - case: "自动执行建议"
        mock_response: 
          remediation: [{ action_type: "automated", description: "自动修复" }]
        expected_validation: "BLOCK — 安全推演失败"

      - case: "缺少人工确认"
        mock_response: 
          alert_level: "P0"
          human_confirmed: null
        expected_validation: "BLOCK — 安全推演失败，人机边界缺失"
```

### 4.3 引用闭环规范
三层之间必须通过显式引用形成闭环：
- 意图契约（治理层）引用语义令牌（语义层）的 `canonical_id`
- 语义令牌引用约束规则（治理层）的 `rule_ref`
- 场景测试（执行层）引用意图契约的 `intent_id`
- 同义词防火墙引用语义令牌的 `llm_constraints`

**引用校验**：Compiler 在阶段 1（语义解析）时校验所有跨层引用是否合法，非法引用视为编译错误。

---

## 五、机制三：三阶段编译架构（Three-Stage Compilation Architecture）

### 5.1 定义
三阶段编译架构是将控制平面的 YAML 声明转化为数据平面可执行约束产物的状态转换机制，采用声明式流水线，支持增量编译与平台适配。

### 5.2 三阶段状态机

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Stage 0   │───►│   Stage 1   │───►│   Stage 2   │
│  意图加载    │    │  语义解析    │    │  约束推导    │
│  (Load)     │    │  (Parse)    │    │  (Derive)   │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────┐
                                    │   Stage 3   │
                                    │  产物生成    │
                                    │  (Generate) │
                                    └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────┐
                                    │   Stage 4   │
                                    │  场景验证    │
                                    │  (Verify)   │
                                    └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────┐
                                    │   Stage 5   │
                                    │  影响分析    │
                                    │  (Analyze)  │
                                    └─────────────┘
```

### 5.3 各阶段规范

#### Stage 0：意图加载（Load）
- **输入**：控制平面 YAML 文件 + 目标版本号（`target_version`）
- **处理**：读取语义层、治理层、执行层全部定义文件，构建原始 AST
- **输出**：未解析的意图协议对象树（Raw Intent Tree）
- **错误处理**：YAML 语法错误直接阻断，返回 `SYNTAX_ERROR`

#### Stage 1：语义解析（Parse）
- **输入**：Raw Intent Tree
- **处理**：
  1. 构建语义依赖图（Semantic Dependency Graph）
  2. 校验跨层引用闭环（引用完整性检查）
  3. 解析同义词防火墙的上下文敏感规则
  4. 标记不可变令牌（`immutable: true`）
- **输出**：解析后的语义图（Resolved Semantic Graph）
- **错误处理**：引用缺失、循环依赖、非法语义域枚举 → `SEMANTIC_RESOLUTION_ERROR`

#### Stage 2：约束推导（Derive）
- **输入**：Resolved Semantic Graph
- **处理**：
  1. 将语义约束推导为 Prompt 约束文本
  2. 将安全约束推导为负向规则（黑名单/正则）
  3. 将结构约束推导为 JSON Schema 片段
  4. 将人机边界推导为权限矩阵（Actor × Action × Decision）
- **输出**：约束推导中间表示（Constraint IR，平台无关的中间格式）

#### Stage 3：产物生成（Generate）
- **输入**：Constraint IR + 目标平台配置（Platform Config）
- **处理**：按五层穿透模型，通过插件将 IR 翻译为平台特定产物：
  - L1：CSS/JSON/TS Token 文件
  - L2：TypeScript 接口 + ESLint 规则 JSON
  - L3：OpenAPI 扩展 YAML
  - L4：OPA Rego / WASM JSON 配置
  - L5：SQL 注释 + CHECK 约束
- **输出**：约束产物包（Constraint Artifact Bundle），按版本与平台组织目录

#### Stage 4：场景验证（Verify）
- **输入**：Constraint Artifact Bundle + 执行层场景测试用例
- **处理**：
  1. 使用生成的产物对 Happy Path 用例执行正向验证（必须 PASS）
  2. 对 Edge Case 用例执行负向验证（必须按预期 BLOCK/WARN）
  3. 校验产物与源协议的语义一致性（无漂移）
- **输出**：验证报告（Verification Report），包含覆盖率与失败用例

#### Stage 5：影响分析（Analyze）
- **输入**：当前版本与上一版本的 Diff
- **处理**：
  1. 比对语义令牌变更（新增/修改/删除）
  2. 遍历产品绑定配置（`bindings/*.yaml`），定位受影响的产品与组件
  3. 标记 Breaking Change（不可变令牌被修改）
- **输出**：影响面报告（Impact Report），包含下游产品清单与升级建议

### 5.4 增量编译机制
当仅部分 YAML 文件变更时，Compiler 通过**语义依赖图**定位受影响的推导路径，仅重新编译变更节点及其下游依赖，未变更节点的产物直接复用缓存。

---

## 六、机制四：四层推演校验机制（Four-Tier Inference Validation）

### 6.1 定义
四层推演校验是在内容（LLM 输出 / 组件 Props / API 响应）进入生产链路前的分层安检机制，按优先级顺序执行，支持短路终止。

### 6.2 推演层级与策略

| 层级 | 标识 | 校验域 | 优先级 | 失败动作 | 短路策略 |
|------|------|--------|--------|---------|---------|
| **语法推演** | `T1` | 结构完整性、字段类型、必填项 | P0 | `BLOCK` | 终止后续层级 |
| **语义推演** | `T2` | 令牌精确匹配、同义词黑名单、语义引用 | P0 | `BLOCK` | 终止后续层级 |
| **安全推演** | `T3` | 禁止模式命中、高危操作确认、人机边界 | P0 | `BLOCK` | 终止后续层级 |
| **美感推演** | `T4` | 文案长度、信息密度、可读性评分 | P1 | `WARN` | 不终止，记录告警 |

### 6.3 推演输入规范

```typescript
interface InferenceInput {
  payload: any;                    // 待校验对象（JSON / Props / Response）
  intent_contract_id: string;      // 绑定的意图契约 ID
  registry_version: string;        // 使用的协议版本
  actor_type: 'human' | 'ai' | 'system';  // 执行者身份
  context?: Record<string, any>;    // 上下文（如 LLM temperature、产品 ID）
}
```

### 6.4 推演输出规范

```typescript
interface InferenceReport {
  passed: boolean;
  overall_action: 'pass' | 'block' | 'warn';
  tiers: TierResult[];
  metadata: {
    validated_at: string;
    intent_contract: string;
    registry_version: string;
    duration_ms: number;
  };
}

interface TierResult {
  tier: 'syntax' | 'semantic' | 'safety' | 'aesthetic';
  passed: boolean;
  errors: Violation[];
}

interface Violation {
  rule_id: string;
  field: string;
  message: string;
  action: 'block' | 'warn';
  rule_ref: string;                // 指向控制平面源 YAML 的引用
}
```

### 6.5 核心原则：阻断优于修正
- 推演失败时**禁止**触发 LLM 自动重试或自动修正
- 自动重试会引入新的概率漂移，破坏语义确定性
- 正确行为：`BLOCK` → 记录日志 → 升级人工（Escalate）→ 人工修正后重新提交

---

## 七、机制五：动态编译执行机制（Dynamic Compilation Execution）

### 7.1 定义
动态编译执行是将静态约束产物在运行时转化为活跃拦截策略的机制，支持策略热加载、版本对齐与运行时身份解析。

### 7.2 核心子机制

#### 7.2.1 策略热加载（Hot Loading）
- Runtime 不直接读取控制平面 YAML，只消费 Compiler 产物（`human-ai-boundary.json`）
- 产物文件变更时，Runtime 通过文件系统 Watch（开发环境）或定时轮询（生产环境）重新加载
- 加载过程**无服务重启**，新策略在下一个事件循环生效

#### 7.2.2 版本哈希对齐（Version Hash Alignment）
- 每个约束产物携带 `schema_version_hash`（控制平面 Git Commit SHA 的短哈希）
- Runtime 启动时校验本地产物哈希与 Registry 发布版本是否一致
- 不一致时触发告警（非阻断），提示策略可能过期

#### 7.2.3 Actor 身份解析（Actor Resolution）
Runtime 必须能够准确判定当前执行者的身份类型：

| Actor 类型 | 判定依据 | 典型场景 |
|-----------|---------|---------|
| `human` | 用户直接操作（鼠标点击、键盘输入），通过认证服务签发的身份令牌 | 用户点击删除按钮 |
| `ai` | LLM / Agent / 自动化脚本发起的调用，通过 `x-actor-type: ai` 请求头或工具调用上下文 | AI 助手建议修复方案 |
| `human_via_ai` | 用户通过 AI 中介间接触发的操作（用户点击了"采纳 AI 建议"） | 用户点击"自动修复"按钮，但文案由 LLM 生成 |

**身份链传递**：`human_via_ai` 必须触发比纯 `human` 更严格的人工确认流程。

#### 7.2.4 运行时拦截矩阵
根据 Actor 类型与意图契约的权限矩阵，Runtime 执行以下动作：

| Actor \ 意图边界 | 无限制 | `ai_assisted` | `human_mandatory` | `ai_prohibited` |
|----------------|--------|--------------|-------------------|-----------------|
| `human` | 放行 | 放行 | 需 `humanConfirmed` | 需 `humanConfirmed` + 审计日志 |
| `human_via_ai` | 放行 | 放行 | 强制二次确认 | 阻断 |
| `ai` | 放行 | 执行 | 阻断 | 阻断 |

---

## 八、机制间的协作关系

### 8.1 正向链路（声明 → 编译 → 执行）

```
控制平面 YAML 声明
    │
    ▼
Registry（版本化 + 影响面分析）
    │
    ▼
Compiler（三阶段编译：Load → Parse → Derive → Generate → Verify → Analyze）
    │
    ▼
约束产物包（L1-L5）
    │
    ├──► Token 层产物 ──► 视觉系统消费
    ├──► 组件层产物 ──► 前端编译时校验 + 运行时 HOC
    ├──► API 层产物 ──► 网关中间件加载
    ├──► 容器层产物 ──► Sidecar / OPA 加载
    └──► 数据库层产物 ──► DDL 注释
              │
              ▼
    Runtime（动态加载 + Actor 解析 + 拦截矩阵）
              │
              ▼
    Validator（四层推演：T1→T2→T3→T4，短路终止）
              │
              ▼
    业务基础设施（Ant Design / Carbon / API / DB / LLM）
```

### 8.2 反向链路（观测 → 归因 → 反哺）

```
业务基础设施运行时
    │
    ▼
Runtime / Validator 拦截事件
    │
    ▼
Bridge（采集 → 语义归一化 → 归因引擎）
    │
    ▼
归因结果（根因定位到控制平面具体 YAML 规则）
    │
    ▼
自动 PR 修改控制平面（收紧同义词阈值 / 新增禁止模式）
    │
    ▼
人工审批（语义架构师 Merge）
    │
    ▼
触发新一轮 Compiler 编译
    │
    ▼
全链路约束自动更新（GitOps 闭环）
```

---

## 九、附录

### 附录 A：机制与模块的映射关系

| 本文档机制 | 对应工程模块 | 模块职责 |
|-----------|-------------|---------|
| 五层穿透模型 | Compiler（Plugin 层） | 按 L1-L5 生成平台产物 |
| 静态配置工程化 | 控制平面（intent-schema-compiler） | YAML 三层结构的存储与版本管理 |
| 三阶段编译架构 | Compiler（Core 层） | 6 步编译管线的实现 |
| 四层推演校验 | Validator | 四层引擎与短路策略的实现 |
| 动态编译执行 | Runtime + Compiler（产物分发） | 热加载、版本对齐、Actor 解析的实现 |
| 闭环反哺 | Bridge + Registry | 归因分析与自动 PR 的实现 |

### 附录 B：状态码与错误定义

| 状态码 | 含义 | 触发场景 |
|--------|------|---------|
| `PASS` | 全部推演通过 | T1-T4 均无阻断 |
| `BLOCK` | 推演失败，强制拦截 | T1/T2/T3 失败 |
| `WARN` | 美感层告警，不拦截 | T4 失败 |
| `ESCALATE` | 阻断后升级人工 | BLOCK 后无自动降级路径 |
| `VERSION_MISMATCH` | 运行时产物版本与 Registry 不一致 | 哈希校验失败 |
| `ACTOR_UNRESOLVED` | 无法判定执行者身份 | 缺少 `x-actor-type` 或认证信息 |

### 附录 C：版本兼容性规则

- **Major 版本变更（X.0.0）**：Breaking Change，旧产物冻结，下游必须手动升级绑定
- **Minor 版本变更（x.Y.0）**：新增语义令牌或意图契约，向下兼容，Compiler 自动分发
- **Patch 版本变更（x.x.Z）**：规则收紧或同义词扩展，产物自动热更新，无需人工干预

---

**文档版本**：v1.0  
**生效日期**：2026-05-29  
**维护者**：Schema-As-Code 架构工作组
