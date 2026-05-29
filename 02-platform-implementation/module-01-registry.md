# 模块 1：Intent Schema Registry 语义注册表

> 声明式语义治理网格的"海马体"——记住所有版本历史，分析影响面，管理语义 ID 的全局唯一性。

---

## 一、模块定位

Intent Schema Registry 是 Schema-As-Code 体系的**控制平面入口**。它不替代 `intent-schema-compiler`（宪法文本），而是为其提供**版本化管理、影响面分析、跨产品绑定**的治理基础设施。

| 维度 | 说明 |
|------|------|
| **角色** | 语义注册表 + 版本档案馆 + 影响面计算器 |
| **输入** | `intent-schema-compiler` 的 YAML 协议文件 |
| **输出** | 版本化语义索引、影响面报告、下游绑定配置 |
| **形态** | Git-Native 仓库 + GitHub Action CI + npm 包发布 |
| **核心原则** | 语义 ID 全局唯一、版本不可变、变更影响可预测 |

---

## 二、最轻量设计方案：Git-As-Registry

**不建服务，不搭数据库，把 Git 仓库本身当作注册表。**

### 2.1 物理结构（一个仓库搞定）

```
intent-schema-registry/          # 就是一个普通 Git 仓库
├── README.md                    # 治理手册（谁改、怎么审、breaking change 定义）
├── .github/
│   └── workflows/
│       ├── validate.yml         # CI：YAML/JSON Schema 语法校验
│       ├── impact-analysis.yml  # CI：PR 时自动计算影响面
│       └── publish.yml          # CI：Merge 后自动发布到 NPM/私有包/CDN
│
├── schema/                      # 【核心】语义契约定义
│   ├── v1.0.0/                 # 版本隔离目录（SemVer）
│   │   ├── tokens/
│   │   │   ├── status.yaml     # 语义令牌：status.critical / status.warning
│   │   │   └── action.yaml     # 语义令牌：action.destructive / action.readonly
│   │   ├── intents/
│   │   │   ├── destructive-action.yaml   # 意图契约：高危操作
│   │   │   └── alert-card.yaml           # 意图契约：告警卡片
│   │   └── synonyms/
│   │       └── zh-CN.yaml      # 同义词防火墙：严重→critical
│   └── v1.1.0/                 # 新版本独立目录，旧版本不可变
│
├── rules/                       # 【核心】治理规则
│   ├── safety/
│   │   └── destructive.yaml    # 安全规则：不可逆操作清单
│   └── compliance/
│       └── alert-level.yaml      # 合规规则：P0-P3 定义
│
├── bindings/                    # 【关键】跨产品绑定配置
│   ├── product-a.yaml            # A 产品引用了哪些意图契约
│   ├── product-b.yaml
│   └── product-c.yaml
│
└── dist/                        # 【自动生成】编译产物目录（CI 生成，不人工改）
    ├── v1.0.0/
    │   ├── tokens.json           # 扁平化后的 Token 注册表
    │   ├── intents.json          # 意图契约索引
    │   └── impact-report.json    # 影响面分析结果
    └── latest -> v1.1.0/         # 软链，始终指向最新版本
```

### 2.2 核心实体规范

#### 语义令牌定义（`schema/v1.0.0/tokens/status.yaml`）

```yaml
token_id: status.critical
canonical_id: ST-001
version: 1.0.0
immutable: true                    # 关键：标记不可变，变更需走升级流程
description: "系统级故障，需立即响应"

visual_mapping:                    # 视觉层绑定
  color_token: "status.critical"
  motion_token: "pulse.red.urgent"
  sound_token: "alert.high"

llm_constraints:                   # LLM 层绑定
  - "生成内容必须包含明确的故障定位信息"
  - "禁止提供未经验证的修复建议"
  - "必须附带人工升级路径"

prohibited_synonyms:               # 同义词防火墙
  - "严重"
  - "紧急"
  - "危急"

# 关键：记录下游绑定，用于影响面分析
downstream_bindings:
  - product: product-a
    component: AlertCard
    file_path: "src/components/AlertCard.tsx"
  - product: product-b
    pattern: PaymentFlow
    file_path: "src/patterns/PaymentFlow/index.tsx"
```

#### 意图契约定义（`schema/v1.0.0/intents/destructive-action.yaml`）

```yaml
intent_id: destructive-action
semantic_domain: transactional
version: 1.0.0

immutable_boundaries:
  - boundary_type: safety
    rule_ref: "rules/safety/destructive.yaml"
    violation_action: block        # block / escalate / fallback

  - boundary_type: compliance
    rule_ref: "rules/compliance/alert-level.yaml"
    violation_action: escalate

human_ai_boundary:
  human_mandatory:
    - "是否触发自动修复"
  ai_prohibited:
    - "直接执行修复操作"
    - "修改告警阈值配置"
```

---

## 三、CI 流水线（3 个 GitHub Actions）

### 3.1 Workflow 1: `validate.yml`（PR 时触发）

```yaml
name: Validate Schema
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. YAML 语法校验
      - name: Lint YAML
        uses: ibiqlik/action-yamllint@v3

      # 2. JSON Schema 校验
      - name: Validate against Meta-Schema
        run: |
          npx ajv-cli -s schema/meta-schema.json -d "schema/**/*.yaml"

      # 3. 不可变性检查：immutable: true 的 Token 不允许修改
      - name: Check Immutability
        run: |
          git diff origin/main -- schema/ | node scripts/check-immutable.js
```

### 3.2 Workflow 2: `impact-analysis.yml`（PR 时触发）

```yaml
name: Impact Analysis
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 需要完整历史做 diff

      # 自动计算影响面：哪些产品的哪些组件绑定了被变更的 Token/Intent
      - name: Generate Impact Report
        run: |
          node scripts/impact-analysis.js \
            --base origin/main \
            --head HEAD \
            --output dist/impact-report.json

      # 把影响面报告评论到 PR 里
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const report = require('./dist/impact-report.json');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 语义变更影响面分析\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``
            });
```

**`impact-analysis.js` 核心逻辑（伪代码）**：

```javascript
// 1. git diff 找出变更的 Token/Intent
const changedTokens = gitDiff('schema/', 'main', 'HEAD');

// 2. 遍历所有产品的 bindings/*.yaml，查找引用关系
const products = fs.readdirSync('bindings/');
const impacted = [];

for (const product of products) {
  const binding = yaml.load(fs.readFileSync(`bindings/${product}`));

  for (const token of changedTokens) {
    if (binding.uses.includes(token.id)) {
      impacted.push({
        product: binding.product_name,
        component: binding.components.find(c => c.tokens?.includes(token.id)),
        severity: token.immutable ? 'BREAKING' : 'COMPATIBLE'
      });
    }
  }
}

// 3. 输出影响面报告
return {
  changed_tokens: changedTokens,
  impacted_products: impacted,
  breaking_changes: impacted.filter(i => i.severity === 'BREAKING'),
  action_required: impacted.filter(i => i.severity === 'BREAKING').map(i => i.product)
};
```

### 3.3 Workflow 3: `publish.yml`（Merge 到 main 时触发）

```yaml
name: Publish Registry
on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. 编译为扁平化 JSON（供下游消费）
      - name: Compile Registry
        run: node scripts/compile.js --input schema/ --output dist/

      # 2. 发布为 NPM 包（下游 install 即可消费）
      - name: Publish to NPM
        run: |
          npm version patch
          npm publish --access public

      # 3. 同步到 CDN（供 Figma Plugin / 在线设计工具消费）
      - name: Sync to CDN
        run: |
          aws s3 sync dist/ s3://intent-registry/latest/
```

---

## 四、下游消费方式（3 种轻量接入）

| 消费方 | 接入方式 | 示例 |
|--------|---------|------|
| **前端项目** | `npm install @company/intent-registry` | `import { statusCritical } from '@company/intent-registry/tokens'` |
| **Figma 插件** | 读取 CDN 上的 `dist/latest/tokens.json` | 设计稿中校验颜色使用是否符合语义契约 |
| **LLM 服务** | 调用 Registry API（可选轻量封装） | Prompt 注入时拉取 `llm_constraints` 字段 |
| **CI 校验** | `npx intent-lint --registry @company/intent-registry` | 扫描代码中语义令牌误用 |

---

## 五、组织架构要求

### 5.1 最小治理单元（3 人兼职模型）

| 角色 | 人数 | 职责 | 权力边界 |
|------|------|------|---------|
| **语义架构师（Semantic Architect）** | 1 人（可兼职） | 定义语义域划分（认知/交互/交易/观测）、审核 Breaking Change、维护 `meta-schema.json` | 对 `schema/` 目录有 Merge 审批权 |
| **产品语义代表（Product Semantic Rep）** | 每产品 1 人（前端 TL 或设计负责人兼职） | 维护 `bindings/product-x.yaml`，在 PR 影响面报告中确认变更对本产品的影响 | 对本产品绑定文件有写权限 |
| **Registry 维护者（Registry Maintainer）** | 1 人（平台/infra 工程师兼职） | 维护 CI 脚本、处理发布流水线、解决合并冲突 | 对 `.github/workflows/` 和 `scripts/` 有写权限 |

**启动门槛**：**1 个语义架构师 + 1 个维护者 + 各产品兼职代表**。不需要专职团队。

### 5.2 决策流

```
产品团队发现语义漂移
    │
    ▼
提交 Issue 至 intent-schema-registry（附漂移案例）
    │
    ▼
语义架构师判定：是规则缺失还是规则过松
    │
    ├──► 规则缺失 ──► 创建 YAML 定义 PR ──► 语义架构师审批 ──► Merge ──► Compiler 自动分发
    │
    └──► 规则过松 ──► Bridge 自动创建收紧 PR ──► 语义架构师审批 ──► Merge ──► Compiler 自动分发
```

---

## 六、风险矩阵

| 风险 | 描述 | 概率 | 影响 | 缓解措施 |
|------|------|------|------|---------|
| **版本爆炸** | 每个 Breaking Change 都发新版本，导致 `schema/` 目录迅速膨胀 | 中 | 中 | **Immutable Append-Only** 策略：旧版本只读不删，但用软链 `latest` 指向前沿；提供版本淘汰策略（如只保留最近 3 个 Major 版本） |
| **治理僵化** | 过度严格的语义锁定导致产品创新受阻，设计师/开发者绕过 Registry | 高 | 高 | **沙盒语义域（experimental）**：允许未注册的新意图在 `schema/experimental/` 中快速迭代，成熟后再晋升到正式域 |
| **采纳阻力** | 前端团队觉得"多一层约束降低效率"，拒绝接入 | 高 | 高 | **渐进式接入**：先只对接 1 个核心产品 + 1 个核心意图（如告警系统）；用 CI 自动拦截代替人工审查，让团队感受到"省时间"而非"加负担" |
| **单点瓶颈** | 语义架构师成为瓶颈，所有语义定义都要他审批 | 中 | 中 | **语义域自治**：将语义域按业务线拆分（如 `schema/infra/`、`schema/business/`），各域有独立审批人，架构师只审跨域变更 |
| **与现有设计系统冲突** | Ant Design / Carbon 的 Token 命名与 Registry 语义 ID 不一致 | 低 | 中 | **映射层（Adapter）**：在 `bindings/` 中维护产品级映射，而非强制改造设计系统本身 |

---

## 七、行业参照

### 直接参照

| 项目 | 出品方 | 与 Registry 的对应关系 | 可借鉴点 |
|------|--------|----------------------|---------|
| **OpenAPI Registry / SwaggerHub** | SmartBear | API Schema 的注册与版本管理 | **Git-Native + SemVer** 的 Schema 版本化策略；影响面分析（哪些服务消费了哪个 API 定义） |
| **JSON Schema Store (schemastore.org)** | 社区 | JSON Schema 的集中注册与分发 | **静态文件 + CDN 分发**的轻量架构；社区驱动的 PR 审核模式 |
| **Backstage Software Catalog** | Spotify | 软件元数据的注册表 | **bindings/** 目录的设计灵感——Backstage 用 `catalog-info.yaml` 描述服务归属和依赖关系 |
| **Design Tokens Community Group (W3C)** | W3C | Design Token 的标准化格式 | **Token 的三层结构**（name/value/type）与语义化扩展路径 |
| **Adobe Spectrum Tokens** | Adobe | 跨平台 Design Token 管理 | **Token 的不可变性原则**——Spectrum 明确旧版本 Token 冻结，新版本独立发布 |
| **LoongSuite GenAI SemConv** | 阿里/蚂蚁 | AI 可观测语义规范 | **语义域划分**（Entry/Step/Skill Span）与 **YAML 模型定义** 的工程化路径 |

### 间接参照

| 项目 | 借鉴逻辑 |
|------|---------|
| **Protocol Buffers (Protobuf)** | Schema 的版本兼容策略：字段编号不可变、新增字段不破坏旧消费者 |
| **GraphQL Schema Registry** | 变更检测与影响面分析：Apollo Studio 能告诉你"修改这个字段会影响哪些客户端查询" |
| **Confluent Schema Registry** | Avro/Protobuf/JSON Schema 的演进策略：Backward/Forward/Full 兼容性检查 |

---

## 八、与五模块的衔接关系

```
Intent Schema Registry（本模块）
    │
    ├──► 向 Compiler 提供：版本化 YAML 协议 + 语义依赖图
    │         Compiler 编译为各层可执行产物（Token/组件/API/容器/DB）
    │
    ├──► 向 Validator 提供：规则库版本号 + 语义令牌白名单
    │         Validator 执行四层推演校验
    │
    ├──► 向 Runtime 提供：策略版本哈希 + 人机边界矩阵
    │         Runtime 执行运行时拦截
    │
    └──◄ 从 Bridge 接收：漂移归因报告 + 自动收紧 PR
              Bridge 将运行时观测反向反哺 Registry
```

**衔接协议**：
- **版本锁定**：所有下游模块必须显式声明兼容的 Registry 版本范围（`>=1.0.0 <2.0.0`）
- **影响面预计算**：Registry 在 PR 阶段即输出下游影响报告，Compiler/Validator 无需全量扫描
- **GitOps 闭环**：Bridge 的自动 PR 直接修改 Registry 的 YAML，触发新一轮 CI 编译与分发

---

## 九、Gap 期局限性声明（v0.1.0）

本文档描述的 Registry 架构、CI 配置与影响面分析脚本目前为架构推演原型，可直接复制作为设计参考，但尚未配套生产级校验引擎。

当前编译器为伪代码逻辑，未接入生产级 LLM API；同义词映射的上下文敏感解析、自动化测试生成及 CI 集成处于占位状态。

完整协议仓库已开源发布于 GitHub，欢迎审阅与 Fork。

---

**项目地址**：https://github.com/2436041978-ops/intent-schema-compiler
