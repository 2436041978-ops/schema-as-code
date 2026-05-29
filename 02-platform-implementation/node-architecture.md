# Schema-As-Code 语义治理节点架构

> 本文定义声明式语义治理网格的数据平面实现——五个轻量治理节点的工程架构、接口协议与平台适配方案。

---

## 一、定位与核心原则

### 1.1 节点定位

语义治理节点是 Schema-As-Code 体系的数据平面（Data Plane），承接控制平面 `intent-schema-compiler` 的 YAML 意图协议，将其转化为可执行、可校验、可拦截、可观测的工程产物。

### 1.2 核心原则

| 原则 | 表述 |
|------|------|
| **轻量节点** | 每个节点以 `npm CLI` / `GitHub Action` / `配置文件` 形态交付，不强制微服务化 |
| **技术中立** | 核心层零框架依赖，适配层以插件/配置独立存在 |
| **正交穿透** | 横向治理平面与纵向生产链路（Token→组件→API→容器→DB）正交相交 |
| **声明式消费** | 节点只读取控制平面产物，不直接修改协议本体 |
| **闭环反哺** | 观测节点（Bridge）将漂移事件归因后，通过 PR 修正控制平面 |

---

## 二、总体架构：五节点拓扑

```
┌─────────────────────────────────────────────────────────────┐
│                    控制平面（Control Plane）                  │
│              intent-schema-compiler（YAML 协议本体）           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ GitOps / 声明式同步
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据平面（Data Plane）                    │
│                                                              │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │  Registry│───►│ Compiler │───►│ Validator│            │
│   │  语义注册 │    │ 契约编译  │    │ 四层推演  │            │
│   └──────────┘    └──────────┘    └──────────┘            │
│        │               │               │                      │
│        │               │               │                      │
│        └───────────────┴───────────────┘                      │
│                        │                                      │
│                        ▼                                      │
│   ┌──────────┐    ┌──────────┐                              │
│   │  Runtime │◄───│  Bridge  │                              │
│   │ 治理运行时│    │ 观测闭环  │                              │
│   └──────────┘    └──────────┘                              │
│        │                                                      │
│        └──────────────────────────────────────────────┐     │
│                                                       │     │
└───────────────────────────────────────────────────────┘     │
                              │                               │
                              │ 拦截事件 / 漂移数据            │
                              ▼                               │
              现有基础设施（Ant Design / Carbon / API / DB）   │
                              │                               │
                              └───────────────────────────────┘
                                          │
                                          ▼
                              反哺控制平面（自动 PR 修正意图协议）
```

### 2.1 节点职责总览

| 节点 | 标识 | 核心职责 | 交付形态 |
|------|------|---------|---------|
| **Registry** | `N1` | 语义 ID 全局注册、版本化管理、影响面分析 | Git 仓库 + CI 脚本 |
| **Compiler** | `N2` | 将 YAML 协议编译为各层可执行约束产物 | npm CLI + 插件化架构 |
| **Validator** | `N3` | 执行语法/语义/安全/美感四层推演安检 | npm CLI + YAML 规则库 |
| **Runtime** | `N4` | 在组件渲染/API 调用/LLM 执行时现场拦截 | npm 包（HOC/中间件/Tool 包装器） |
| **Bridge** | `N5` | 采集漂移事件、归因分析、自动反哺 PR | npm CLI + GitHub Action |

---

## 三、节点一：Intent Schema Registry（语义注册表）

### 3.1 定位

Registry 是控制平面的"版本与索引扩展"，负责管理语义协议的全局唯一性、版本兼容性与变更影响面。

### 3.2 轻量架构

```
Registry 节点
├── interface/                    # 接口层：协议不变
│   ├── registry-schema.json      # 语义注册表元数据 Schema
│   └── binding-schema.json       # 产品绑定配置 Schema
├── core/                         # 核心层：版本与影响面
│   ├── version-manager.js        # SemVer 管理 + 不可变性校验
│   └── impact-analyzer.js        # Git Diff → 影响面报告
└── adapter/                      # 适配层：可选
    ├── github-action/              # GitHub 集成
    ├── gitlab-ci/                # GitLab 集成
    └── local-cli/                # 本地脚本
```

### 3.3 技术中立适配方案

| 场景 | 适配方式 | 工作量 |
|------|---------|--------|
| **代码托管** | 提供 `registry-cli` 命令行，接受 `--repo-type=github|gitlab|gitee` 参数 | 1 人日 |
| **版本发布** | 产物以 `npm pack` 或 `tar.gz` 输出，不依赖特定 Registry 服务 | 0.5 人日 |
| **影响面分析** | 基于 `git diff` + `grep` 实现，不依赖特定代码分析工具 | 内置 |

### 3.4 轻量部署模式

```bash
# 模式 A：GitHub Action（推荐，零运维）
# .github/workflows/registry-sync.yml
- uses: intent-schema/registry-action@v1
  with:
    schema-path: ./schema
    version: ${{ github.ref_name }}

# 模式 B：本地 CLI（独立仓库或 monorepo 子目录）
npx intent-registry --validate --impact-analysis

# 模式 C：npm 包（下游消费）
npm install @company/intent-registry
```

### 3.5 核心输出

- **版本化语义索引**：`dist/v{x}/registry.json`
- **影响面报告**：`impact-report.json`（变更波及范围）
- **产品绑定配置**：`bindings/product-a.yaml`

---

## 四、节点二：Schema Compiler（契约编译器）

### 4.1 定位

Compiler 是控制平面到数据平面的"翻译器"，将 YAML 意图协议转化为各层基础设施可消费的约束产物。

### 4.2 轻量架构

```
Compiler 节点
├── interface/                    # 接口层
│   ├── compiler-config-schema.json   # 编译配置 Schema
│   └── artifact-manifest-schema.json # 产物清单 Schema
├── core/                         # 核心层：6 步编译管线
│   ├── loader.js                 # Stage 0: 意图加载
│   ├── resolver.js               # Stage 1: 语义解析
│   ├── deriver.js                # Stage 2: 约束推导
│   ├── generator.js              # Stage 3: 产物调度
│   ├── verifier.js               # Stage 4: 场景验证
│   └── impact-reporter.js        # Stage 5: 影响分析
└── adapter/                      # 适配层：平台插件
    ├── plugins/
    │   ├── token-css.js          # L1: CSS/LESS/Sass
    │   ├── token-ts.js           # L1: TypeScript 常量
    │   ├── component-react.js    # L2: React Props/ESLint
    │   ├── component-vue.js      # L2: Vue 指令/组合式
    │   ├── api-openapi.js        # L3: OpenAPI 扩展
    │   ├── api-graphql.js        # L3: GraphQL Directive
    │   ├── container-opa.js      # L4: OPA Rego
    │   ├── container-wasm.js     # L4: WASM JSON
    │   └── database-sql.js       # L5: DDL 注释
    └── templates/                # 产物模板（Handlebars）
        ├── tokens.css.hbs
        ├── intent-types.ts.hbs
        └── openapi-ext.yaml.hbs
```

### 4.3 技术中立适配方案

**核心原则**：新增一个平台支持 = 新增一个 100-200 行的插件文件，不改核心层。

| 目标平台 | 插件文件 | 输入 | 输出 |
|---------|---------|------|------|
| **Ant Design** | `component-react.js` + `token-ts.js` | YAML Token | `ConfigProvider` 扩展 + TS 类型 |
| **Carbon** | `component-react.js` / `component-vue.js` + `token-sass.js` | YAML Token | Sass 变量注释 + 组件 Props |
| **Tailwind** | `token-css.js`（扩展） | YAML Token | CSS 变量 + `tailwind.config.js` 扩展 |
| **Express** | `api-openapi.js` | YAML 约束 | OpenAPI 扩展片段 |
| **Koa** | `api-openapi.js`（复用） | YAML 约束 | 同上，由 Koa 中间件消费 |
| **OPA** | `container-opa.js` | YAML 边界 | Rego 策略文件 |
| **AWS API Gateway** | `api-openapi.js`（复用） | YAML 约束 | OpenAPI 导入 AWS |
| **MySQL** | `database-sql.js` | YAML 令牌 | DDL 注释 SQL |
| **PostgreSQL** | `database-sql.js`（扩展） | YAML 令牌 | PG 兼容注释 |

### 4.4 避免开发过重的策略

1. **模板驱动**：产物格式由 `templates/*.hbs` 定义，非硬编码字符串拼接
2. **条件编译**：`compiler.config.yaml` 声明启用哪些插件，未启用的平台不加载
3. **产物即代码**：编译产物提交到 Git 或发布为 npm 包，下游 `npm install` 即可，无需实时编译
4. **增量编译**：基于 `git diff` 只编译变更节点，全量编译控制在 5 秒内

### 4.5 三阶段编译状态机

```
意图加载 → 语义解析 → 约束推导 → 产物生成 → 场景验证 → 影响分析
  (S0)      (S1)       (S2)       (S3)       (S4)       (S5)
```

---

## 五、节点三：Four-Tier Validator（四层推演引擎）

### 5.1 定位

Validator 是内容（LLM 输出 / 组件 Props / API 响应）进入生产链路前的"安检门"，按优先级顺序执行四层推演，支持短路终止。

### 5.2 轻量架构

```
Validator 节点
├── interface/                    # 接口层
│   ├── inference-input-schema.json   # 推演输入 Schema
│   └── inference-report-schema.json  # 推演报告 Schema
├── core/                         # 核心层：四层引擎 + 调度器
│   ├── syntax-tier.js            # T1: JSON Schema 校验（ajv）
│   ├── semantic-tier.js          # T2: 令牌匹配 + 同义词黑名单
│   ├── safety-tier.js            # T3: 正则 + 人机边界矩阵
│   ├── aesthetic-tier.js         # T4: 文案长度 + 可读性
│   └── scheduler.js              # 短路策略 + 优先级管理
└── adapter/                      # 适配层：场景引擎
    ├── engines/
    │   ├── llm-openai.js         # OpenAI 结构化输出校验
    │   ├── llm-anthropic.js      # Claude 输出校验
    │   ├── component-props.js    # React/Vue Props 校验
    │   └── api-http.js           # HTTP 响应体校验
    └── reporters/
        ├── console.js            # 本地 CLI 输出
        ├── github-pr.js          # PR 评论
        ├── junit.js              # CI 测试报告
        └── otel.js               # OpenTelemetry Span
```

### 5.3 四层推演策略

| 层级 | 标识 | 校验域 | 优先级 | 失败动作 | 短路策略 |
|------|------|--------|--------|---------|---------|
| **语法推演** | `T1` | 结构完整性、字段类型、必填项 | P0 | `BLOCK` | 终止后续层级 |
| **语义推演** | `T2` | 令牌精确匹配、同义词黑名单、语义引用 | P0 | `BLOCK` | 终止后续层级 |
| **安全推演** | `T3` | 禁止模式命中、高危操作确认、人机边界 | P0 | `BLOCK` | 终止后续层级 |
| **美感推演** | `T4` | 文案长度、信息密度、可读性评分 | P1 | `WARN` | 不终止，记录告警 |

### 5.4 避免开发过重的策略

1. **规则即配置**：四层规则全部写在 YAML 中（`rules/syntax/*.json`, `rules/semantic/*.yaml`），Validator 核心层只读配置，不写死规则
2. **零框架依赖**：核心层纯 Node.js，无 React/Vue/Express 依赖
3. **统一输入格式**：所有引擎最终都把待校验内容转为统一 JSON，四层引擎只消费标准 JSON
4. **并行执行**：T1/T2/T3 可并行执行，T4 依赖 T1 结果串行

---

## 六、节点四：Governance Runtime（治理运行时）

### 6.1 定位

Runtime 将编译后的规则产物部署到生产环境，实现"运行时语义拦截"，以 HOC/Sidecar/Gateway Plugin 形态嵌入业务链路。

### 6.2 轻量架构

```
Runtime 节点
├── interface/                    # 接口层
│   ├── policy-schema.json        # 运行时策略 Schema
│   └── actor-schema.json         # 执行者身份 Schema
├── core/                         # 核心层：策略加载 + 拦截矩阵
│   ├── policy-loader.js          # 热加载 + 版本哈希校验
│   ├── actor-resolver.js         # human / ai / human_via_ai 判定
│   └── decision-matrix.js        # Actor × Intent × Action → 决策
└── adapter/                      # 适配层：守卫实现
    ├── guards/
    │   ├── react-hoc.js          # React: withIntentGuard
    │   ├── vue-directive.js      # Vue: v-intent-guard
    │   ├── express-middleware.js # Express: apiGuardMiddleware
    │   ├── koa-middleware.js     # Koa: apiGuardMiddleware
    │   ├── nestjs-guard.js       # NestJS: @IntentGuard() 装饰器
    │   ├── openai-tools.js       # OpenAI: toolGuard
    │   └── langchain-tools.js    # LangChain: tool wrapper
    └── binding-loaders/
        ├── npm-loader.js         # 从 npm 包加载策略
        ├── cdn-loader.js         # 从 CDN 加载策略
        └── filesystem-loader.js  # 从本地文件加载策略
```

### 6.3 技术中立适配方案

| 技术栈 | 适配文件 | 集成方式 | 侵入性 |
|--------|---------|---------|--------|
| **React** | `react-hoc.js` | `withIntentGuard(Component, intentConfig)` | 低：包裹组件，不改内部 |
| **Vue 3** | `vue-directive.js` | `v-intent-guard="intentConfig"` | 低：指令绑定 |
| **Vue 2** | `vue-directive.js`（复用） | 同上 | 低 |
| **Express** | `express-middleware.js` | `app.use(apiGuardMiddleware)` | 低：中间件拦截 |
| **Koa** | `koa-middleware.js` | `app.use(apiGuardMiddleware)` | 低 |
| **NestJS** | `nestjs-guard.js` | `@UseGuards(IntentGuard)` | 低：装饰器 |
| **OpenAI SDK** | `openai-tools.js` | `toolGuard(tools, policyStore)` | 低：工具包装 |
| **LangChain** | `langchain-tools.js` | `IntentToolWrapper` | 低 |
| **原生 JS** | `web-component.js` | Custom Element 封装 | 低 |

### 6.4 运行时拦截矩阵

根据 Actor 类型与意图契约的权限矩阵，Runtime 执行以下动作：

| Actor \ 意图边界 | 无限制 | `ai_assisted` | `human_mandatory` | `ai_prohibited` |
|----------------|--------|--------------|-------------------|-----------------|
| `human` | 放行 | 放行 | 需 `humanConfirmed` | 需 `humanConfirmed` + 审计日志 |
| `human_via_ai` | 放行 | 放行 | 强制二次确认 | 阻断 |
| `ai` | 放行 | 执行 | 阻断 | 阻断 |

### 6.5 避免开发过重的策略

1. **策略外置**：Runtime 本身不定义策略，只消费 Compiler 产物（`human-ai-boundary.json`），策略变更无需改代码
2. **身份透传**：通过标准 Header（`x-actor-type`）或 Context 传递身份，不侵入认证系统
3. **降级策略**：策略文件加载失败时，默认进入 `escalate` 模式（升级人工），不阻断业务
4. **无服务化**：Runtime 以 npm 包形态被引入项目，不独立部署服务，无额外运维成本

---

## 七、节点五：Observability Bridge（观测桥接器）

### 7.1 定位

Bridge 连接运行时观测与控制平面，实现"观测 → 归因 → 约束 → 验证"的闭环，将漂移事件转化为治理指标的聚合与反哺。

### 7.2 轻量架构

```
Bridge 节点
├── interface/                    # 接口层
│   ├── drift-event-schema.json   # 漂移事件 Schema
│   └── governance-metrics-schema.json  # 治理指标 Schema
├── core/                         # 核心层：归一化 + 归因 + 指标
│   ├── normalizer.js             # 原始数据 → 意图协议 ID 映射
│   ├── root-cause-engine.js      # 归因：哪条规则失效
│   ├── impact-calculator.js      # 影响面计算
│   └── metrics-aggregator.js     # 4 大治理指标聚合
└── adapter/                      # 适配层：采集器 + 反馈通道
    ├── collectors/
    │   ├── otel-trace.js         # OpenTelemetry / LoongSuite
    │   ├── aliyun-sls.js         # 阿里云 SLS
    │   ├── aws-cloudwatch.js     # AWS CloudWatch
    │   ├── loki.js               # Grafana Loki
    │   └── file-log.js           # 本地日志文件（兜底）
    └── feedback/
        ├── github-pr.js          # 自动创建 Registry PR
        ├── gitlab-mr.js          # GitLab MR
        ├── feishu-webhook.js     # 飞书告警
        └── slack-webhook.js      # Slack 告警
```

### 7.3 技术中立适配方案

| 可观测平台 | 采集器文件 | 数据格式 |
|-----------|-----------|---------|
| **OpenTelemetry** | `otel-trace.js` | OTLP / Trace / Span Attributes |
| **LoongSuite SemConv** | `otel-trace.js`（复用） | `gen_ai.response.*` / `invoke_skill` |
| **阿里云 SLS** | `aliyun-sls.js` | SLS SDK 查询 |
| **AWS CloudWatch** | `aws-cloudwatch.js` | CloudWatch Logs Insights |
| **Grafana Loki** | `loki.js` | Loki HTTP API |
| **本地文件** | `file-log.js` | JSON Lines 日志 |

| 反馈通道 | 适配文件 | 触发条件 |
|---------|---------|---------|
| **GitHub** | `github-pr.js` | 语义一致性 < 75% 时自动创建收紧 PR |
| **GitLab** | `gitlab-mr.js` | 同上 |
| **飞书** | `feishu-webhook.js` | 漂移事件实时告警 |
| **钉钉** | `dingtalk-webhook.js` | 同上 |
| **Slack** | `slack-webhook.js` | 同上 |

### 7.4 避免开发过重的策略

1. **借船出海**：不存储原始 Trace/Log，只消费现有平台的查询 API，Bridge 本身无数据库
2. **归一化优先**：所有采集器输出统一格式的 `DriftEvent`，核心层只处理归一化后数据
3. **反馈可选**：告警通道通过 Webhook 配置，无通道时不阻断核心功能
4. **定时任务模式**：Bridge 以 GitHub Action 定时任务运行（如每周一次），非常驻服务

### 7.5 治理指标输出

| 指标 | 定义 | 目标值 |
|------|------|--------|
| **语义一致性得分** | 跨产品界面中语义令牌合规率 | ≥ 90% |
| **规则拦截率** | 四层推演引擎拦截的漂移事件占比 | ≥ 95% |
| **人工升级比例** | 无法自动处理、需人工介入的事件占比 | 随成熟度递减至 < 5% |
| **治理健康度** | 综合得分（一致性×0.4 + 拦截率×0.3 + (100-升级比例)×0.3） | ≥ 75% |

---

## 八、节点间通信协议

### 8.1 标准接口协议

所有节点通过以下三种方式通信，**不依赖特定 RPC 框架**：

| 通信方式 | 场景 | 数据格式 |
|---------|------|---------|
| **文件系统** | Compiler 读取 Registry YAML | YAML / JSON |
| **npm 包** | Runtime 消费 Compiler 产物 | JSON 策略文件 |
| **Git 操作** | Bridge 创建 Registry PR | Git + YAML |
| **CLI 管道** | Validator 输出报告到 CI | JSON / Markdown / JUnit XML |
| **HTTP Webhook** | Bridge 发送告警 | JSON |

### 8.2 版本契约

节点间必须显式声明兼容的版本范围：

```json
// compiler.config.yaml 中的节点版本声明
node_compatibility:
  registry: ">=1.0.0 <2.0.0"
  validator: ">=1.2.0"
  runtime: ">=1.1.0"
  bridge: ">=0.5.0"
```

---

## 九、集成模式：三种落地姿势

### 模式 A：GitHub-Native（最轻量，推荐初创团队）

```
GitHub 仓库（intent-schema-registry）
    │
    ├── .github/workflows/
    │   ├── registry-validate.yml    # Registry 节点
    │   ├── compile.yml               # Compiler 节点
    │   ├── validate-pr.yml           # Validator 节点
    │   └── observability-sync.yml    # Bridge 节点
    │
    └── schema/                       # 控制平面 YAML
```

**特点**：全部用 GitHub Action，零服务器，节点以 Action 形态运行。

### 模式 B：npm-CLI（推荐中小团队）

```
Monorepo / 多仓库
    │
    ├── intent-schema-registry/        # Registry 仓库
    ├── intent-compiler/               # Compiler npm 包
    ├── intent-validator/              # Validator npm 包
    ├── intent-runtime/                # Runtime npm 包
    └── intent-bridge/                 # Bridge npm 包
```

**特点**：各节点独立 npm 包，团队按需安装，通过 `npx` 调用。

### 模式 C：平台化（推荐大型组织）

```
内部开发者平台
    │
    ├── Registry 服务（Git 后端 + 管理 UI）
    ├── Compiler 服务（CI 流水线集成）
    ├── Validator 服务（API 化校验）
    ├── Runtime 服务（Sidecar / Agent 分发）
    └── Bridge 服务（定时任务 + 仪表盘）
```

**特点**：节点服务化，提供管理界面，适合 10+ 产品线的组织。

---

## 十、开发成本控制策略

| 风险 | 防控策略 | 具体措施 |
|------|---------|---------|
| **适配器爆炸** | 核心层收敛，适配器按需 | 只维护高频平台适配器（React/Vue/Express/OpenAI），低频平台由社区/业务方贡献 |
| **核心层膨胀** | 插件化 + 条件编译 | Compiler 未启用的插件不加载；Validator 未使用的规则不解析 |
| **版本碎片化** | 统一版本契约 | 所有节点发布时声明兼容的 Registry 版本范围 |
| **测试成本** | 场景测试复用 | 执行层的 `scenario-tests.yaml` 同时作为 Compiler 验证输入和 Validator 测试用例 |
| **运维成本** | 优先无服务化 | Registry/Compiler/Validator/Bridge 均以 GitHub Action / CLI 形态运行，无需服务器 |

---

## 十一、与语雀材料的对应关系

| 语雀文档 | 对应节点章节 | 落地形态 |
|---------|-------------|---------|
| 《Schema-As-Code 语义治理节点架构》 | 本文全文 | 架构总览 |
| 模块 1：Registry 语义注册表 | 第三章 | Git 仓库 + GitHub Action |
| 模块 2：Schema Compiler 契约编译器 | 第四章 | npm CLI + 插件化产物生成 |
| 模块 3：Four-Tier Validator 四层推演引擎 | 第五章 | npm CLI + YAML 规则库 |
| 模块 4：Governance Runtime 权限契约运行时拦截 | 第六章 | npm 包（HOC/中间件/Tool包装器） |
| 模块 5：Observability Bridge 观测闭环与组织级治理指标 | 第七章 | npm CLI + GitHub Action 定时任务 |

---

## 十二、一句话总结

> **Schema-As-Code 语义治理节点架构 = 5 个轻量节点（Registry/Compiler/Validator/Runtime/Bridge），每个节点由"接口层 + 核心层 + 适配层"构成，通过标准 JSON/YAML/Git 协议通信，以 npm CLI / GitHub Action / 配置文件形态交付，零绑定特定技术栈，零强制微服务化，按需插件扩展。**

**技术中立性保障**：核心层零框架依赖，适配层以独立文件存在，新增平台支持 = 新增 1 个适配文件。  
**工程轻量化保障**：优先 CLI 与 GitHub Action，产物即代码，策略外置，无服务常驻。
