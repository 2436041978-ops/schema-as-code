# 模块 2：Schema Compiler 契约编译器

> 将控制平面的 YAML 意图协议翻译为各层可执行约束产物的轻量编译节点。

## 一、定位与核心职责

| 维度 | 定义 |
|------|------|
| **角色** | 数据平面（Data Plane）的中央处理中枢 |
| **输入** | `intent-schema-compiler` 控制平面的 YAML 协议（语义层 / 治理层 / 执行层） |
| **输出** | 五层穿透产物（Token / 组件 / API / 容器 / 数据库） |
| **核心命题** | 不是 Prompt Engineering，而是**意图的形式化契约注入**——把设计意图的不可变边界编译进 LLM 的输入约束和输出校验 |

Compiler 不替代任何现有技术栈，只向其**注入规则**。

## 二、最轻量架构：Node.js CLI + 插件化产物生成

### 2.1 物理结构（单包即可运行）

```
packages/compiler/
├── bin/
│   └── intent-compile              # CLI 入口
├── src/
│   ├── core/
│   │   ├── loader.js               # Stage 0: 意图加载
│   │   ├── resolver.js             # Stage 1: 语义解析
│   │   ├── deriver.js              # Stage 2: 约束推导
│   │   ├── generator.js            # Stage 3: 产物调度
│   │   ├── verifier.js             # Stage 4: 场景验证
│   │   └── impact-reporter.js      # Stage 5: 影响分析
│   └── plugins/                    # 适配层：按目标平台隔离
│       ├── token-css.js            # L1: CSS / Sass / Less
│       ├── token-ts.js             # L1: TypeScript 常量
│       ├── component-react.js      # L2: React Props / ESLint
│       ├── component-vue.js        # L2: Vue 指令 / 组合式
│       ├── api-openapi.js          # L3: OpenAPI 扩展
│       ├── api-graphql.js          # L3: GraphQL Directive
│       ├── container-opa.js        # L4: OPA Rego
│       ├── container-wasm.js        # L4: WASM JSON 配置
│       └── database-sql.js         # L5: DDL 注释 + CHECK
├── templates/                      # Handlebars 产物模板
│   ├── tokens.css.hbs
│   ├── intent-types.ts.hbs
│   └── openapi-ext.yaml.hbs
├── package.json
└── README.md
```

### 2.2 技术中立原则

- **核心层零依赖**：`src/core/` 纯 Node.js，不绑定任何框架
- **新增平台 = 新增插件文件**：每新增一个目标平台，只需新增 `src/plugins/{platform}.js`（100–200 行）+ 对应 `templates/*.hbs`
- **条件编译**：`compiler.config.yaml` 声明启用哪些插件，未启用的平台不加载、不编译

## 三、三阶段编译架构（6 步翻译）

```
Stage 0: 意图加载 ──► 读取 Registry YAML，构建原始 AST
Stage 1: 语义解析 ──► 构建语义依赖图，校验跨层引用闭环
Stage 2: 约束推导 ──► 将语义约束推导为平台无关的中间表示（Constraint IR）
Stage 3: 产物生成 ──► 插件将 IR 翻译为平台特定产物
Stage 4: 场景验证 ──► 用执行层测试用例验证产物正确性
Stage 5: 影响分析 ──► 比对版本差异，输出下游影响面报告
```

### 3.1 各阶段规范

#### Stage 0：意图加载（Load）

- **输入**：控制平面 YAML 文件 + 目标版本号（`target_version`）
- **处理**：读取语义层、治理层、执行层全部定义文件
- **输出**：未解析的意图协议对象树（Raw Intent Tree）
- **失败**：YAML 语法错误 → `SYNTAX_ERROR`，直接阻断

#### Stage 1：语义解析（Parse）

- **输入**：Raw Intent Tree
- **处理**：
  1. 构建语义依赖图（Semantic Dependency Graph）
  2. 校验跨层引用闭环（引用完整性检查）
  3. 解析同义词防火墙的上下文敏感规则
  4. 标记不可变令牌（`immutable: true`）
- **输出**：Resolved Semantic Graph
- **失败**：引用缺失、循环依赖、非法语义域枚举 → `SEMANTIC_RESOLUTION_ERROR`

#### Stage 2：约束推导（Derive）

- **输入**：Resolved Semantic Graph
- **处理**：
  - 语义约束 → Prompt 约束文本
  - 安全约束 → 负向规则（黑名单 / 正则）
  - 结构约束 → JSON Schema 片段
  - 人机边界 → 权限矩阵（Actor × Action × Decision）
- **输出**：Constraint IR（平台无关的中间格式）

#### Stage 3：产物生成（Generate）

- **输入**：Constraint IR + 目标平台配置（Platform Config）
- **处理**：按五层穿透模型，通过插件并行翻译：

| 目标层级 | 插件 | 输出产物 |
|---------|------|---------|
| **L1 Token** | `token-css.js` / `token-ts.js` | CSS 变量 / TS 常量 |
| **L2 组件** | `component-react.js` / `component-vue.js` | TS 类型 / ESLint 规则 |
| **L3 API** | `api-openapi.js` / `api-graphql.js` | OpenAPI 扩展 / GraphQL Directive |
| **L4 容器** | `container-opa.js` / `container-wasm.js` | Rego 策略 / WASM 配置 |
| **L5 数据库** | `database-sql.js` | DDL 注释 + CHECK 约束 |

#### Stage 4：场景验证（Verify）

- **输入**：产物包 + 执行层 `scenario-tests.yaml`
- **处理**：
  - Happy Path 正向验证（必须 PASS）
  - Edge Case 负向验证（必须按预期 BLOCK / WARN）
  - 产物与源协议的语义一致性校验（无漂移）
- **输出**：Verification Report（覆盖率 + 失败用例）

#### Stage 5：影响分析（Analyze）

- **输入**：当前版本与上一版本的 Git Diff
- **处理**：
  1. 比对语义令牌变更（新增 / 修改 / 删除）
  2. 遍历产品绑定配置（`bindings/*.yaml`），定位受影响产品
  3. 标记 Breaking Change（不可变令牌被修改）
- **输出**：Impact Report（下游产品清单 + 升级建议）

## 四、增量编译机制

当仅部分 YAML 文件变更时，Compiler 通过**语义依赖图**定位受影响的推导路径，只重新编译变更节点及其下游依赖。

```javascript
// 伪代码：增量编译逻辑
const changedTokens = gitDiff('schema/', 'main', 'HEAD');
const affectedPlugins = resolveDownstream(changedTokens, semanticGraph);

for (const plugin of affectedPlugins) {
  await plugin.compile(changedTokens);  // 只编译受影响部分
}
```

**性能目标**：全量编译 ≤ 5 秒，增量编译 ≤ 1 秒。

## 五、产物输出规范

### 5.1 产物目录结构

```
dist/
└── v1.1.0/                          # 按 Registry 版本隔离
    ├── tokens/
    │   ├── tokens.css               # L1: CSS 变量
    │   ├── tokens.json              # L1: JSON 配置
    │   └── tokens.ts                # L1: TypeScript 常量
    ├── components/
    │   ├── intent-types.ts          # L2: TS 类型定义
    │   └── eslint-rules.json        # L2: ESLint 规则
    ├── api/
    │   └── destructive-action.openapi.yaml  # L3: OpenAPI 扩展
    ├── policies/
    │   └── destructive-action.rego  # L4: OPA Rego
    └── ddl/
        └── semantic-comments.sql    # L5: DDL 注释
```

### 5.2 产物版本锁定

每个产物文件头部必须携带版本注释，确保下游可溯源：

```css
/* intent-schema-compiler v1.1.0 */
/* generated_at: 2026-05-29T10:00:00Z */
/* schema_hash: a1b2c3d */
:root {
  --status-critical-color: #D32F2F;
}
```

```typescript
// intent-schema-compiler v1.1.0
// generated_at: 2026-05-29T10:00:00Z
// schema_hash: a1b2c3d
export const STATUS_CRITICAL = {
  canonicalId: 'ST-001',
  color: 'var(--status-critical-color)',
} as const;
```

## 六、CLI 使用方式

### 6.1 安装

```bash
npm install -g @your-org/intent-compiler
```

### 6.2 命令

```bash
# 全量编译
intent-compile --registry ./intent-schema-compiler --version v1.1.0

# 增量编译（基于 git diff）
intent-compile --registry ./intent-schema-compiler --version v1.1.0 --diff-only

# 单插件调试
intent-compile --plugin token --registry ./intent-schema-compiler --watch

# 验证产物（不输出文件，只检查编译可行性）
intent-compile --registry ./intent-schema-compiler --dry-run

# 输出指定格式
intent-compile --registry ./intent-schema-compiler --format json
```

### 6.3 配置（compiler.config.yaml）

```yaml
registry_path: ./intent-schema-compiler
output_path: ./dist
target_version: v1.1.0

plugins:
  - name: token
    output: ./dist/v1.1.0/tokens/
    format: [css, json, ts]
  - name: component
    output: ./dist/v1.1.0/components/
    framework: react
  - name: api
    output: ./dist/v1.1.0/api/
    spec_version: "3.0.0"
  - name: container
    output: ./dist/v1.1.0/policies/
    runtime: opa
  - name: database
    output: ./dist/v1.1.0/ddl/
    dialect: mysql
```

## 七、与上下游模块的关系

```
上游：Intent Schema Registry（语义注册表）
    │ 提供：版本化 YAML 协议 + 影响面预计算
    ▼
Compiler（本模块）
    │ 读取：语义层 / 治理层 / 执行层 YAML
    │ 输出：五层穿透产物（dist/）
    ▼
下游：
    ├── Validator ──► 消费产物执行四层推演
    ├── Runtime ──► 加载产物执行运行时拦截
    └── Bridge ──► 采集产物执行效果反哺 Registry
```

**版本契约**：Compiler 必须显式声明兼容的 Registry 版本范围：

```json
// package.json
"peerDependencies": {
  "@your-org/intent-registry": ">=1.0.0 <2.0.0"
}
```

## 八、最轻量启动路径

### 8.1 最小可用产物（MVP）

Phase 1 只需实现 **2 个插件**即可证明价值：

1. **`token-ts.js`**：将 `semantic-tokens.yaml` 编译为 TypeScript 常量
2. **`component-react.js`**：将 `intent-contracts.yaml` 编译为 React Props 类型 + ESLint 规则

### 8.2 启动 checklist

| 步骤 | 动作 | 产出 |
|------|------|------|
 1 | 实现 `loader.js` + `resolver.js` | 能读取并解析 YAML |
 2 | 实现 `token-ts.js` 插件 | `dist/tokens.ts` |
 3 | 实现 `component-react.js` 插件 | `dist/intent-types.ts` + `dist/eslint-rules.json` |
 4 | 编写 `scenario-tests.yaml` 验证用例 | 编译产物通过 Happy Path + Edge Case |
 5 | 发布 `npm` 包 | 下游可 `npm install` 消费 |

## 九、风险与缓解

| 风险 | 描述 | 缓解措施 |
|------|------|---------|
| **产物漂移** | Registry 更新了，下游产物未同步 | **产物即代码**：编译产物必须提交到 Git 或随 Registry 版本发布，下游通过 `npm install` 锁定版本 |
| **插件碎片化** | 各团队写自己的插件，格式不统一 | **模板标准化**：提供官方 Handlebars 模板，插件只负责数据转换，不负责格式发明 |
| **编译性能衰减** | 语义令牌增长导致全量编译变慢 | **增量编译**：基于 Git Diff 只编译变更节点；未变更产物直接复用缓存 |
| **产物格式锁定** | 下游深度依赖产物格式，升级成本高 | **产物版本化**：产物随 Registry 版本一起版本化，下游明确锁定版本 |
| **过度工程** | 试图让 Compiler 直接生成业务逻辑代码 | **边界公约**：Compiler 只生成"约束声明和类型守卫"，不生成业务逻辑；数据库层只生成注释和软约束 |

## 十、行业参照

| 项目 | 出品方 | 借鉴点 |
|------|--------|--------|
| **Protobuf Compiler (protoc)** | Google | 插件化架构（`--plugin` 机制）；产物版本锁定 |
| **OpenAPI Generator** | OpenAPI Tools | 模板驱动生成（Mustache）；多目标语言支持 |
| **GraphQL Code Generator** | The Guild | Watch Mode（Schema 变更自动重编译）；配置即代码 |
| **json-schema-to-typescript** | bcherny | 轻量 CLI（单文件工具，无服务依赖）；注释透传 |
| **Tailwind CSS 配置生成** | Tailwind Labs | Token 扁平化策略（嵌套配置 → 扁平 CSS 变量） |

---

**模块状态**：v0.1.0（MVP 阶段，Token + React 插件已可用）
**维护者**：Schema-As-Code 平台团队
**上游依赖**：`intent-schema-compiler`（控制平面）
**下游消费**：Validator / Runtime / Bridge
